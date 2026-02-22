"""
Trading Cycle Engine: 전체 트레이딩 사이클 오케스트레이션
퀀트 시그널 생성 → LLM 판단 → 브로커 주문 → DB 저장 → NAV 업데이트

브로커 라우팅:
  PM.broker_type == "kis"   → 한국투자증권 REST API (API 키 없으면 Paper 폴백)
  PM.broker_type == "bybit" → Bybit REST API      (API 키 없으면 Paper 폴백)
  PM.broker_type == "paper" → 로컬 시뮬레이션
"""

import asyncio
import logging
from datetime import datetime
import random

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.engines.quant import QuantEngine
from app.engines.llm import LLMEngine
from app.engines.market_data import (
    get_price_history,
    get_prices_for_pm,
    get_market_context,
    PM_WATCHLISTS,
)
from app.models.pm import PM
from app.models.position import Position
from app.models.trade import Trade
from app.models.signal import Signal
from app.models.nav_history import NAVHistory

logger = logging.getLogger(__name__)

quant_engine = QuantEngine()
llm_engine = LLMEngine()


async def run_pm_cycle(pm: PM, db: Session) -> dict:
    """단일 PM의 트레이딩 사이클 실행"""
    try:
        # 1. 관심 종목 중 랜덤 선택
        symbols = PM_WATCHLISTS.get(pm.id, ["SPY"])
        symbol = random.choice(symbols)

        # 2. 가격 히스토리 가져오기
        prices = get_price_history(symbol, days=60)
        if prices is None or len(prices) < 20:
            return {"status": "skipped", "reason": "insufficient_price_data"}

        # 3. 퀀트 시그널 생성
        signals = quant_engine.generate_signals(prices, symbol)

        # 4. 시그널 DB 저장
        signal_record = Signal(
            pm_id=pm.id,
            symbol=symbol,
            signal_type="composite",
            value=signals["composite_score"],
            metadata_={
                "rsi": signals["rsi"],
                "momentum": signals["momentum"],
                "volatility": signals["volatility"],
                "rsi_signal": signals["rsi_signal"],
                "momentum_signal": signals["momentum_signal"],
            },
        )
        db.add(signal_record)

        # 5. 현재 가격들 가져오기
        current_prices = get_prices_for_pm(pm.id)
        current_price = current_prices.get(symbol, float(prices.iloc[-1]))

        # 6. 시장 컨텍스트
        market_context = get_market_context()
        market_context["current_price"] = current_price

        # 7. LLM 판단 (API 키 없으면 규칙 기반 폴백)
        provider = getattr(pm, "llm_provider", "claude")
        if provider == "rule_based":
            decision = _rule_based_decision(pm.id, signals)
        else:
            try:
                decision = await llm_engine.make_decision(
                    pm_id=pm.id,
                    symbol=symbol,
                    quant_signals=signals,
                    market_context=market_context,
                    llm_provider=provider,
                )
            except (RuntimeError, ValueError, KeyError, ConnectionError) as e:
                # API 키 없거나 에러 → 규칙 기반 폴백
                logger.warning("LLM fallback for %s: %s", pm.id, e)
                decision = _rule_based_decision(pm.id, signals)

        action = decision.get("action", "HOLD")
        conviction = decision.get("conviction", 0.0)
        reasoning = decision.get("reasoning", "Rule-based decision")
        position_size = decision.get("position_size", 0.02)

        result = {
            "pm_id": pm.id,
            "symbol": symbol,
            "action": action,
            "conviction": conviction,
            "reasoning": reasoning,
            "composite_score": signals["composite_score"],
        }

        # 8. 브로커 주문 실행 (KIS / Bybit / Paper 자동 라우팅)
        if action in ("BUY", "SELL") and conviction >= settings.min_conviction:
            from app.engines.broker import get_broker_for_pm
            from app.engines.risk_guard import check_risk
            broker = get_broker_for_pm(getattr(pm, "broker_type", "paper"))

            trade_amount = pm.current_capital * position_size
            quantity = trade_amount / current_price

            # 리스크 체크 (실거래 브로커일 때만 엄격하게)
            if broker.is_live():
                allowed, risk_reason = check_risk(pm, action, trade_amount, db)
                if not allowed:
                    logger.warning("RISK BLOCKED %s %s %s: %s", pm.id, action, symbol, risk_reason)
                    result["risk_blocked"] = True
                    result["risk_reason"] = risk_reason
                    db.commit()
                    return result

            if action == "BUY":
                result.update(await _execute_buy(pm, symbol, quantity, current_price, db, broker))
            elif action == "SELL":
                result.update(await _execute_sell(pm, symbol, quantity, current_price, db, broker))

            if result.get("trade_executed"):
                result["broker"] = getattr(broker, "__class__", type(broker)).__name__
                result["broker_live"] = broker.is_live()
                _update_pm_capital(pm, db)

        db.commit()
        return result

    except (SQLAlchemyError, OSError, ValueError) as e:
        db.rollback()
        logger.error("PM cycle error for %s: %s", pm.id, e)
        return {"status": "error", "reason": str(e)}


async def _execute_buy(
    pm: PM, symbol: str, quantity: float, price: float, db: Session, broker=None
) -> dict:
    """BUY 실행 — 브로커 주문 → DB 기록"""
    from app.engines.broker import PaperAdapter
    if broker is None:
        broker = PaperAdapter()

    order_value = quantity * price
    position_limit = pm.current_capital * settings.position_limit_pct

    if order_value > position_limit:
        quantity = position_limit / price
        order_value = quantity * price

    cash = _get_cash(pm, db)
    if cash < order_value:
        quantity = cash * settings.cash_reserve_pct / price
        order_value = quantity * price
        if quantity <= 0:
            return {"trade_executed": False, "reason": "insufficient_cash"}

    # 브로커 주문 (실패 시 DB 기록 생략)
    try:
        order_result = await broker.place_order(symbol, quantity, "BUY")
        if order_result.get("status") not in ("filled", "partially_filled"):
            return {
                "trade_executed": False,
                "reason": order_result.get("reason", "broker_rejected"),
                "broker_raw": order_result,
            }
        # 실제 체결 가격이 있으면 사용
        filled_price = order_result.get("filled_avg_price") or price
    except (ConnectionError, TimeoutError, OSError, ValueError) as e:
        logger.error("Broker BUY error for %s %s: %s", pm.id, symbol, e)
        return {"trade_executed": False, "reason": f"broker_error: {e}"}

    # DB 기록
    existing = db.query(Position).filter(
        Position.pm_id == pm.id, Position.symbol == symbol
    ).first()
    if existing:
        total_qty = existing.quantity + quantity
        existing.avg_cost = (existing.quantity * existing.avg_cost + quantity * filled_price) / total_qty
        existing.quantity = total_qty
    else:
        db.add(Position(pm_id=pm.id, symbol=symbol, quantity=quantity, avg_cost=filled_price))

    db.add(Trade(
        pm_id=pm.id, symbol=symbol, action="BUY",
        quantity=quantity, price=filled_price, conviction_score=0.7,
        reasoning=f"[{broker.__class__.__name__}] BUY at ${filled_price:.4f}",
    ))
    return {"trade_executed": True, "quantity": quantity, "price": filled_price}


async def _execute_sell(
    pm: PM, symbol: str, quantity: float, price: float, db: Session, broker=None
) -> dict:
    """SELL 실행 — 포지션 확인 → 브로커 주문 → DB 기록"""
    from app.engines.broker import PaperAdapter
    if broker is None:
        broker = PaperAdapter()

    existing = db.query(Position).filter(
        Position.pm_id == pm.id, Position.symbol == symbol
    ).first()
    if not existing:
        return {"trade_executed": False, "reason": "no_position"}

    sell_qty = min(quantity, existing.quantity)

    try:
        order_result = await broker.place_order(symbol, sell_qty, "SELL")
        if order_result.get("status") not in ("filled", "partially_filled"):
            return {
                "trade_executed": False,
                "reason": order_result.get("reason", "broker_rejected"),
                "broker_raw": order_result,
            }
        filled_price = order_result.get("filled_avg_price") or price
    except (ConnectionError, TimeoutError, OSError, ValueError) as e:
        logger.error("Broker SELL error for %s %s: %s", pm.id, symbol, e)
        return {"trade_executed": False, "reason": f"broker_error: {e}"}

    pnl = (filled_price - existing.avg_cost) * sell_qty
    existing.quantity -= sell_qty
    if existing.quantity <= 0.001:
        db.delete(existing)

    db.add(Trade(
        pm_id=pm.id, symbol=symbol, action="SELL",
        quantity=sell_qty, price=filled_price, conviction_score=0.7,
        reasoning=f"[{broker.__class__.__name__}] SELL at ${filled_price:.4f} (P&L: ${pnl:+.2f})",
    ))
    return {"trade_executed": True, "quantity": sell_qty, "price": filled_price, "pnl": round(pnl, 2)}


def _get_cash(pm: PM, db: Session) -> float:
    """PM의 현금 잔고 = 총 자본 - 포지션 평가액"""
    positions = db.query(Position).filter(Position.pm_id == pm.id).all()
    position_value = sum(p.quantity * p.avg_cost for p in positions)
    return max(pm.current_capital - position_value, 0.0)


def _update_pm_capital(pm: PM, db: Session) -> float:
    """PM 자본 = 현금 잔고 + 포지션 현재가 기준 평가액. DB 업데이트로 변이 방지."""
    from app.engines.market_data import get_current_price

    positions = db.query(Position).filter(Position.pm_id == pm.id).all()
    position_value = sum(
        pos.quantity * get_current_price(pos.symbol) for pos in positions
    )

    cash = _get_cash(pm, db)
    new_capital = round(cash + position_value, 2)
    db.query(PM).filter(PM.id == pm.id).update({"current_capital": new_capital})
    logger.info("PM %s capital updated: %s", pm.id, new_capital)
    return new_capital


def _rule_based_decision(pm_id: str, signals: dict) -> dict:
    """LLM 없을 때 규칙 기반 의사결정"""
    score = signals.get("composite_score", 0.0)
    rsi = signals.get("rsi", 50.0)

    # RSI 과매도(< 35) + 양수 신호 → 강한 BUY
    # RSI 과매수(> 65) + 음수 신호 → 강한 SELL
    rsi_boost = 0.15 if rsi < 35 else (-0.15 if rsi > 65 else 0.0)
    adjusted_score = score + rsi_boost

    if adjusted_score > 0.25:
        conviction = min(0.5 + adjusted_score, 1.0)
        return {"action": "BUY", "conviction": conviction, "reasoning": f"Buy signal: composite={score:.2f} rsi={rsi:.1f}", "position_size": 0.04}
    elif adjusted_score < -0.25:
        conviction = min(0.5 + abs(adjusted_score), 1.0)
        return {"action": "SELL", "conviction": conviction, "reasoning": f"Sell signal: composite={score:.2f} rsi={rsi:.1f}", "position_size": 0.04}
    else:
        return {"action": "HOLD", "conviction": 0.3, "reasoning": f"Neutral signal: composite={score:.2f}", "position_size": 0.0}


async def run_all_pm_cycles(db: Session) -> list[dict]:
    """모든 활성 PM의 트레이딩 사이클 병렬 실행"""
    pms = db.query(PM).filter(PM.is_active == True).all()
    tasks = [run_pm_cycle(pm, db) for pm in pms]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r if isinstance(r, dict) else {"status": "error", "reason": str(r)} for r in results]


def record_nav(db: Session) -> dict:
    """현재 펀드 NAV를 히스토리에 저장"""
    pms = db.query(PM).filter(PM.is_active == True).all()
    total_nav = sum(pm.current_capital for pm in pms)

    # 이전 NAV 가져와서 daily return 계산
    last_nav = db.query(NAVHistory).order_by(NAVHistory.id.desc()).first()
    daily_return = 0.0
    if last_nav and last_nav.nav > 0:
        daily_return = (total_nav - last_nav.nav) / last_nav.nav

    nav_record = NAVHistory(nav=total_nav, daily_return=daily_return)
    db.add(nav_record)
    db.commit()
    return {"nav": total_nav, "daily_return": daily_return}


def seed_nav_history(db: Session, days: int = 90):
    """초기 NAV 히스토리 시딩 (90일 시뮬레이션 데이터)"""
    existing = db.query(NAVHistory).count()
    if existing > 0:
        return  # 이미 데이터 있으면 스킵

    import numpy as np
    from datetime import timedelta
    np.random.seed(42)

    initial_nav = 1_100_000.0  # 11 PMs × $100k
    nav = initial_nav
    base_date = datetime.now() - timedelta(days=days)

    for i in range(days):
        daily_return = np.random.normal(0.0008, 0.012)  # 연 20% 수익, 12% 변동성
        nav = nav * (1 + daily_return)
        record_date = base_date + timedelta(days=i)
        record = NAVHistory(
            nav=round(nav, 2),
            daily_return=round(daily_return, 6),
            recorded_at=record_date,
        )
        db.add(record)

    # 마지막으로 현재 PM 자본 합산해서 최신 NAV 저장
    pms = db.query(PM).all()
    if pms:
        current_nav = sum(pm.current_capital for pm in pms)
    else:
        current_nav = initial_nav

    db.add(NAVHistory(nav=round(current_nav, 2), daily_return=0.0))
    db.commit()
