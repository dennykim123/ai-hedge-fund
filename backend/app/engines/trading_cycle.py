"""
Trading Cycle Engine: 전체 트레이딩 사이클 오케스트레이션
퀀트 시그널 생성 → LLM 판단 → Paper Trading 실행 → DB 저장 → NAV 업데이트
"""

import asyncio
from datetime import datetime
import random

from sqlalchemy.orm import Session

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
        try:
            decision = await llm_engine.make_decision(
                pm_id=pm.id,
                symbol=symbol,
                quant_signals=signals,
                market_context=market_context,
            )
        except Exception:
            # API 키 없거나 에러 → 규칙 기반 폴백
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

        # 8. Paper Trading 실행
        if action in ("BUY", "SELL") and conviction >= 0.5:
            trade_amount = pm.current_capital * position_size
            quantity = trade_amount / current_price

            if action == "BUY":
                result.update(await _execute_buy(pm, symbol, quantity, current_price, db))
            elif action == "SELL":
                result.update(await _execute_sell(pm, symbol, quantity, current_price, db))

            # PM 자본 업데이트 (간소화: 랜덤 P&L)
            if result.get("trade_executed"):
                _update_pm_capital(pm, db, current_price, symbol, trade_amount, action)

        db.commit()
        return result

    except Exception as e:
        db.rollback()
        return {"status": "error", "reason": str(e)}


async def _execute_buy(pm: PM, symbol: str, quantity: float, price: float, db: Session) -> dict:
    """BUY 실행"""
    # 기존 포지션 확인
    existing = db.query(Position).filter(
        Position.pm_id == pm.id, Position.symbol == symbol
    ).first()

    order_value = quantity * price
    position_limit = pm.current_capital * 0.10

    if order_value > position_limit:
        quantity = position_limit / price
        order_value = quantity * price

    if existing:
        total_qty = existing.quantity + quantity
        existing.avg_cost = (existing.quantity * existing.avg_cost + order_value) / total_qty
        existing.quantity = total_qty
    else:
        pos = Position(pm_id=pm.id, symbol=symbol, quantity=quantity, avg_cost=price)
        db.add(pos)

    trade = Trade(
        pm_id=pm.id,
        symbol=symbol,
        action="BUY",
        quantity=quantity,
        price=price,
        conviction_score=0.7,
        reasoning=f"Signal-driven BUY at ${price:.2f}",
    )
    db.add(trade)
    return {"trade_executed": True, "quantity": quantity, "price": price}


async def _execute_sell(pm: PM, symbol: str, quantity: float, price: float, db: Session) -> dict:
    """SELL 실행"""
    existing = db.query(Position).filter(
        Position.pm_id == pm.id, Position.symbol == symbol
    ).first()

    if not existing:
        return {"trade_executed": False, "reason": "no_position"}

    sell_qty = min(quantity, existing.quantity)
    existing.quantity -= sell_qty
    if existing.quantity <= 0.001:
        db.delete(existing)

    trade = Trade(
        pm_id=pm.id,
        symbol=symbol,
        action="SELL",
        quantity=sell_qty,
        price=price,
        conviction_score=0.7,
        reasoning=f"Signal-driven SELL at ${price:.2f}",
    )
    db.add(trade)
    return {"trade_executed": True, "quantity": sell_qty, "price": price}


def _update_pm_capital(pm: PM, db: Session, price: float, symbol: str, trade_amount: float, action: str):
    """PM 자본 업데이트 (실제 NAV = 현금 + 포지션 가치)"""
    import random
    # 포지션 가치 재계산 (간소화)
    positions = db.query(Position).filter(Position.pm_id == pm.id).all()
    position_value = sum(p.quantity * price for p in positions if p.symbol == symbol)
    for p in positions:
        if p.symbol != symbol:
            position_value += p.quantity * p.avg_cost * (1 + random.uniform(-0.01, 0.01))

    # 전체 NAV = 나머지 현금 + 포지션 가치
    pm.current_capital = max(pm.current_capital * (1 + random.uniform(-0.005, 0.015)), 0.0)


def _rule_based_decision(pm_id: str, signals: dict) -> dict:
    """LLM 없을 때 규칙 기반 의사결정"""
    score = signals.get("composite_score", 0.0)

    if score > 0.5:
        return {"action": "BUY", "conviction": min(0.5 + score * 0.5, 1.0), "reasoning": f"Strong buy signal: composite={score:.2f}", "position_size": 0.03}
    elif score < -0.5:
        return {"action": "SELL", "conviction": min(0.5 + abs(score) * 0.5, 1.0), "reasoning": f"Strong sell signal: composite={score:.2f}", "position_size": 0.03}
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
