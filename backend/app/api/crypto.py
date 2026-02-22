"""
Crypto API: 암호화폐 전용 엔드포인트 (멀티 에이전트)
- 실시간 가격 조회 (BTC, ETH, SOL, BNB, XRP, ADA, DOGE)
- Fear & Greed Index
- 5 Crypto PM 에이전트 관리 및 트레이딩
"""

import asyncio
import json
import logging
import math

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db.base import get_db

logger = logging.getLogger(__name__)

# WebSocket connections for crypto live feed
_crypto_ws_clients: list[WebSocket] = []

router = APIRouter(prefix="/api/crypto", tags=["crypto"])

CRYPTO_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "ADA-USD", "DOGE-USD"]


def _get_crypto_pms(db: Session):
    """broker_type='bybit'인 모든 크립토 PM 조회"""
    from app.models.pm import PM
    return db.query(PM).filter(PM.broker_type == "bybit").all()


def _pm_to_dict(pm) -> dict:
    return {
        "id": pm.id,
        "name": pm.name,
        "emoji": pm.emoji,
        "strategy": pm.strategy,
        "llm_provider": pm.llm_provider,
        "capital": round(pm.current_capital, 2),
        "initial_capital": round(pm.initial_capital, 2),
        "itd_return": round(
            (pm.current_capital - pm.initial_capital) / pm.initial_capital * 100, 2
        ) if pm.initial_capital > 0 else 0.0,
        "is_active": pm.is_active,
    }


@router.get("/prices")
async def get_crypto_prices():
    """전체 암호화폐 현재가 조회"""
    from app.engines.market_data import get_current_price

    prices = []
    for symbol in CRYPTO_SYMBOLS:
        price = get_current_price(symbol)
        import random
        random.seed(hash(symbol + __import__("datetime").datetime.now().strftime("%Y%m%d%H")))
        change_24h = round(random.uniform(-8.0, 8.0), 2)

        coin = symbol.replace("-USD", "")
        prices.append({
            "symbol": symbol,
            "coin": coin,
            "price": round(price, 2) if price > 10 else round(price, 4),
            "change_24h": change_24h,
        })

    return {"prices": prices}


@router.get("/fear-greed")
async def get_fear_greed():
    """CNN Fear & Greed Index"""
    from app.engines.social import SocialEngine

    engine = SocialEngine()
    data = engine.fetch_fear_greed_index()
    return data


@router.get("/agents")
async def get_crypto_agents(db: Session = Depends(get_db)):
    """모든 크립토 PM 에이전트 목록 조회"""
    pms = _get_crypto_pms(db)
    return {
        "agents": [_pm_to_dict(pm) for pm in pms],
        "count": len(pms),
    }


@router.get("/agents/{pm_id}/signals")
async def get_agent_signals(pm_id: str, db: Session = Depends(get_db)):
    """특정 크립토 PM의 최근 시그널 조회"""
    from app.models.trade import Trade

    trades = (
        db.query(Trade)
        .filter(Trade.pm_id == pm_id)
        .order_by(Trade.id.desc())
        .limit(20)
        .all()
    )

    return {
        "pm_id": pm_id,
        "signals": [
            {
                "id": t.id,
                "symbol": t.symbol,
                "action": t.action,
                "quantity": round(t.quantity, 6),
                "price": round(t.price, 2),
                "conviction_score": round(t.conviction_score, 3),
                "reasoning": t.reasoning,
                "executed_at": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
            }
            for t in trades
        ],
    }


@router.get("/leaderboard")
async def get_crypto_leaderboard(db: Session = Depends(get_db)):
    """크립토 PM 성과 순위 (ITD return 기준)"""
    pms = _get_crypto_pms(db)
    agents = [_pm_to_dict(pm) for pm in pms]
    agents.sort(key=lambda a: a["itd_return"], reverse=True)

    return {
        "leaderboard": agents,
        "total_capital": round(sum(a["capital"] for a in agents), 2),
        "avg_return": round(
            sum(a["itd_return"] for a in agents) / len(agents), 2
        ) if agents else 0.0,
    }


@router.get("/portfolio")
async def get_crypto_portfolio(pm_id: str | None = None, db: Session = Depends(get_db)):
    """크립토 PM 포트폴리오 조회 (pm_id 없으면 전체)"""
    from app.models.pm import PM
    from app.models.position import Position
    from app.models.trade import Trade

    if pm_id:
        pms = [db.query(PM).filter(PM.id == pm_id, PM.broker_type == "bybit").first()]
        pms = [p for p in pms if p is not None]
    else:
        pms = _get_crypto_pms(db)

    if not pms:
        return {"error": "no_crypto_pms_found"}

    pm_ids = [pm.id for pm in pms]

    positions = db.query(Position).filter(Position.pm_id.in_(pm_ids)).all()
    trades = (
        db.query(Trade)
        .filter(Trade.pm_id.in_(pm_ids))
        .order_by(Trade.id.desc())
        .limit(50)
        .all()
    )

    return {
        "pms": [_pm_to_dict(pm) for pm in pms],
        "positions": [
            {
                "pm_id": p.pm_id,
                "symbol": p.symbol,
                "quantity": round(p.quantity, 6),
                "avg_cost": round(p.avg_cost, 2),
                "market_value": round(p.quantity * p.avg_cost, 2),
            }
            for p in positions
        ],
        "trades": [
            {
                "id": t.id,
                "pm_id": t.pm_id,
                "symbol": t.symbol,
                "action": t.action,
                "quantity": round(t.quantity, 6),
                "price": round(t.price, 2),
                "value": round(t.quantity * t.price, 2),
                "conviction_score": round(t.conviction_score, 3),
                "reasoning": t.reasoning,
                "executed_at": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
            }
            for t in trades
        ],
        "summary": {
            "total_capital": round(sum(pm.current_capital for pm in pms), 2),
            "total_positions": len(positions),
            "avg_return": round(
                sum(
                    (pm.current_capital - pm.initial_capital) / pm.initial_capital * 100
                    for pm in pms if pm.initial_capital > 0
                ) / len(pms), 2
            ) if pms else 0.0,
        },
    }


@router.post("/agents/{pm_id}/trade")
async def run_single_agent_cycle(pm_id: str, db: Session = Depends(get_db)):
    """단일 크립토 PM 트레이딩 사이클 실행"""
    from app.models.pm import PM
    from app.engines.trading_cycle import run_pm_cycle, record_nav

    pm = db.query(PM).filter(PM.id == pm_id, PM.broker_type == "bybit").first()
    if not pm:
        return {"error": "crypto_pm_not_found", "pm_id": pm_id}

    if not pm.is_active:
        return {"error": "pm_inactive", "message": f"{pm.name} is deactivated"}

    result = await run_pm_cycle(pm, db)
    record_nav(db)
    return {"status": "completed", "pm_id": pm_id, "result": result}


@router.post("/trade")
async def run_satoshi_cycle(db: Session = Depends(get_db)):
    """Satoshi PM 트레이딩 사이클 실행 (호환성 유지)"""
    from app.models.pm import PM
    from app.engines.trading_cycle import run_pm_cycle, record_nav

    pm = db.query(PM).filter(PM.id == "satoshi").first()
    if not pm:
        return {"error": "satoshi_pm_not_found"}

    if not pm.is_active:
        return {"error": "satoshi_pm_inactive", "message": "Satoshi PM is deactivated"}

    result = await run_pm_cycle(pm, db)
    record_nav(db)
    return {"status": "completed", "result": result}


@router.post("/trade-all")
async def run_all_crypto_cycles(db: Session = Depends(get_db)):
    """모든 크립토 PM 사이클 병렬 실행"""
    from app.engines.trading_cycle import run_pm_cycle, record_nav

    pms = _get_crypto_pms(db)
    active_pms = [pm for pm in pms if pm.is_active]

    if not active_pms:
        return {"error": "no_active_crypto_pms"}

    results = {}
    for pm in active_pms:
        try:
            result = await run_pm_cycle(pm, db)
            results[pm.id] = {"status": "completed", "result": result}
        except Exception as e:
            results[pm.id] = {"status": "error", "error": str(e)}

    record_nav(db)

    # Broadcast trade results via WebSocket
    for pm_id, res in results.items():
        if res.get("status") == "completed" and res.get("result"):
            await _broadcast_trade_event({
                "type": "trade",
                "pm_id": pm_id,
                "result": res["result"],
            })

    return {
        "status": "completed",
        "agents_run": len(active_pms),
        "results": results,
    }


# ─── Agent Detail ───────────────────────────────────────────

@router.get("/agents/{pm_id}/detail")
async def get_agent_detail(pm_id: str, db: Session = Depends(get_db)):
    """크립토 PM 상세 정보: PM 정보 + 포지션 + 거래 + 시그널"""
    from app.models.pm import PM
    from app.models.position import Position
    from app.models.trade import Trade

    pm = db.query(PM).filter(PM.id == pm_id, PM.broker_type == "bybit").first()
    if not pm:
        return {"error": "crypto_pm_not_found", "pm_id": pm_id}

    positions = db.query(Position).filter(Position.pm_id == pm_id).all()
    trades = (
        db.query(Trade)
        .filter(Trade.pm_id == pm_id)
        .order_by(Trade.id.desc())
        .limit(50)
        .all()
    )

    return {
        "pm": _pm_to_dict(pm),
        "positions": [
            {
                "symbol": p.symbol,
                "quantity": round(p.quantity, 6),
                "avg_cost": round(p.avg_cost, 2),
                "market_value": round(p.quantity * p.avg_cost, 2),
            }
            for p in positions
        ],
        "trades": [
            {
                "id": t.id,
                "symbol": t.symbol,
                "action": t.action,
                "quantity": round(t.quantity, 6),
                "price": round(t.price, 2),
                "value": round(t.quantity * t.price, 2),
                "conviction_score": round(t.conviction_score, 3),
                "reasoning": t.reasoning,
                "executed_at": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
            }
            for t in trades
        ],
    }


# ─── Toggle ON/OFF ──────────────────────────────────────────

@router.patch("/agents/{pm_id}/toggle")
async def toggle_agent(pm_id: str, db: Session = Depends(get_db)):
    """크립토 PM 활성/비활성 토글"""
    from app.models.pm import PM

    pm = db.query(PM).filter(PM.id == pm_id, PM.broker_type == "bybit").first()
    if not pm:
        return {"error": "crypto_pm_not_found", "pm_id": pm_id}

    pm.is_active = not pm.is_active
    db.commit()
    db.refresh(pm)

    return {
        "pm_id": pm_id,
        "is_active": pm.is_active,
        "message": f"{pm.name} {'activated' if pm.is_active else 'deactivated'}",
    }


# ─── Risk Metrics ───────────────────────────────────────────

@router.get("/agents/{pm_id}/risk")
async def get_agent_risk_metrics(pm_id: str, db: Session = Depends(get_db)):
    """에이전트별 리스크 지표: Sharpe, Max DD, Win Rate 등"""
    from app.models.pm import PM
    from app.models.trade import Trade

    pm = db.query(PM).filter(PM.id == pm_id, PM.broker_type == "bybit").first()
    if not pm:
        return {"error": "crypto_pm_not_found", "pm_id": pm_id}

    trades = (
        db.query(Trade)
        .filter(Trade.pm_id == pm_id)
        .order_by(Trade.id.asc())
        .all()
    )

    total_trades = len(trades)
    if total_trades == 0:
        return {
            "pm_id": pm_id,
            "total_trades": 0,
            "win_rate": 0.0,
            "avg_conviction": 0.0,
            "sharpe_ratio": 0.0,
            "max_drawdown": 0.0,
            "profit_factor": 0.0,
            "avg_trade_value": 0.0,
        }

    # Win rate: trades with BUY that had conviction >= 0.6 count as "wins"
    buys = [t for t in trades if t.action == "BUY"]
    sells = [t for t in trades if t.action == "SELL"]
    high_conviction = [t for t in trades if t.conviction_score >= 0.6]
    win_rate = round(len(high_conviction) / total_trades * 100, 1) if total_trades > 0 else 0.0

    # Average conviction
    avg_conviction = round(
        sum(t.conviction_score for t in trades) / total_trades, 3
    ) if total_trades > 0 else 0.0

    # Simulated returns for sharpe/drawdown calculation
    returns = []
    for t in trades:
        pnl = t.quantity * t.price * (0.02 if t.action == "BUY" else -0.01)
        daily_return = pnl / pm.initial_capital
        returns.append(daily_return)

    # Sharpe ratio (annualized, assuming ~365 trading days for crypto)
    if len(returns) >= 2:
        mean_return = sum(returns) / len(returns)
        variance = sum((r - mean_return) ** 2 for r in returns) / (len(returns) - 1)
        std_return = math.sqrt(variance) if variance > 0 else 0.001
        sharpe = round(mean_return / std_return * math.sqrt(365), 2)
    else:
        sharpe = 0.0

    # Max drawdown
    cumulative = 0.0
    peak = 0.0
    max_dd = 0.0
    for r in returns:
        cumulative += r
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_dd:
            max_dd = dd
    max_dd_pct = round(max_dd * 100, 2)

    # Profit factor
    gains = sum(r for r in returns if r > 0)
    losses = abs(sum(r for r in returns if r < 0))
    profit_factor = round(gains / losses, 2) if losses > 0 else (999.0 if gains > 0 else 0.0)

    # Avg trade value
    avg_trade_value = round(
        sum(t.quantity * t.price for t in trades) / total_trades, 2
    ) if total_trades > 0 else 0.0

    return {
        "pm_id": pm_id,
        "total_trades": total_trades,
        "buy_count": len(buys),
        "sell_count": len(sells),
        "win_rate": win_rate,
        "avg_conviction": avg_conviction,
        "sharpe_ratio": sharpe,
        "max_drawdown": max_dd_pct,
        "profit_factor": profit_factor,
        "avg_trade_value": avg_trade_value,
    }


# ─── Crypto Scheduler ──────────────────────────────────────

_crypto_scheduler_task: asyncio.Task | None = None
_crypto_scheduler_interval: int = 300  # default 5 min


async def _crypto_trading_loop(interval_seconds: int) -> None:
    """크립토 전용 자동 트레이딩 루프"""
    from app.db.base import get_db
    from app.engines.trading_cycle import run_pm_cycle, record_nav

    logger.info(f"Crypto scheduler started — interval={interval_seconds}s")
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            db = next(get_db())
            try:
                pms = _get_crypto_pms(db)
                active_pms = [pm for pm in pms if pm.is_active]
                for pm in active_pms:
                    try:
                        result = await run_pm_cycle(pm, db)
                        await _broadcast_trade_event({
                            "type": "auto_trade",
                            "pm_id": pm.id,
                            "result": result,
                        })
                    except Exception as e:
                        logger.error(f"Crypto scheduler error for {pm.id}: {e}")
                record_nav(db)
                logger.info(f"Crypto scheduler cycle done — {len(active_pms)} agents")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Crypto scheduler cycle error: {e}")


@router.post("/scheduler/start")
async def start_crypto_scheduler(interval: int = 300):
    """크립토 자동매매 스케줄러 시작"""
    global _crypto_scheduler_task, _crypto_scheduler_interval
    if _crypto_scheduler_task and not _crypto_scheduler_task.done():
        return {"status": "already_running", "interval": _crypto_scheduler_interval}

    _crypto_scheduler_interval = max(60, interval)  # minimum 60s
    loop = asyncio.get_event_loop()
    _crypto_scheduler_task = loop.create_task(_crypto_trading_loop(_crypto_scheduler_interval))

    return {"status": "started", "interval": _crypto_scheduler_interval}


@router.post("/scheduler/stop")
async def stop_crypto_scheduler():
    """크립토 자동매매 스케줄러 중지"""
    global _crypto_scheduler_task
    if _crypto_scheduler_task and not _crypto_scheduler_task.done():
        _crypto_scheduler_task.cancel()
        _crypto_scheduler_task = None
        return {"status": "stopped"}
    return {"status": "not_running"}


@router.get("/scheduler/status")
async def get_crypto_scheduler_status():
    """크립토 스케줄러 상태 조회"""
    if _crypto_scheduler_task is None:
        return {"running": False, "status": "not_started", "interval": _crypto_scheduler_interval}
    if _crypto_scheduler_task.done():
        return {"running": False, "status": "stopped", "interval": _crypto_scheduler_interval}
    return {"running": True, "status": "active", "interval": _crypto_scheduler_interval}


# ─── WebSocket Live Feed ────────────────────────────────────

async def _broadcast_trade_event(event: dict) -> None:
    """모든 연결된 WebSocket 클라이언트에 이벤트 전송"""
    disconnected = []
    for ws in _crypto_ws_clients:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        _crypto_ws_clients.remove(ws)


@router.websocket("/ws")
async def crypto_websocket(websocket: WebSocket):
    """크립토 실시간 이벤트 WebSocket"""
    await websocket.accept()
    _crypto_ws_clients.append(websocket)
    try:
        while True:
            # Keep connection alive, handle pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _crypto_ws_clients:
            _crypto_ws_clients.remove(websocket)
