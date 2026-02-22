from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.db.base import get_db

router = APIRouter(prefix="/api/fund", tags=["admin-system"])


@router.get("/system/overview")
async def get_system_overview(db: Session = Depends(get_db)):
    from app.core.scheduler import get_status
    from app.models.signal import Signal
    from app.models.trade import Trade

    scheduler = get_status()
    last_signal = db.query(Signal).order_by(Signal.id.desc()).first()
    last_trade = db.query(Trade).order_by(Trade.id.desc()).first()

    return {
        "services": {
            "backend": {"status": "healthy", "uptime": "running"},
            "database": {"status": "healthy"},
            "market_data": {"status": "active"},
            "llm_providers": {"status": "rule_based_fallback"},
            "scheduler": scheduler,
        },
        "signal_freshness": {
            "quant": (last_signal.created_at.isoformat() + "Z") if last_signal else None,
            "social": None,
            "llm": None,
        },
        "last_trade_at": (last_trade.executed_at.isoformat() + "Z") if last_trade else None,
    }


@router.get("/order-pipeline/stats")
async def get_order_pipeline_stats(db: Session = Depends(get_db)):
    return {
        "pending": 0,
        "executing": 0,
        "completed_24h": 0,
        "rejected_24h": 0,
    }


@router.get("/soq/status")
async def get_soq_status(db: Session = Depends(get_db)):
    return {
        "queue_depth": 0,
        "avg_latency_ms": 0,
        "orders_today": 0,
    }


@router.get("/executions/recent")
async def get_recent_executions(limit: int = 20, db: Session = Depends(get_db)):
    from app.models.trade import Trade

    trades = db.query(Trade).order_by(Trade.executed_at.desc()).limit(limit).all()
    return {
        "executions": [
            {
                "id": t.id,
                "pm_id": t.pm_id,
                "symbol": t.symbol,
                "action": t.action,
                "quantity": t.quantity,
                "price": t.price,
                "fee": getattr(t, "fee", 0.0) or 0.0,
                "executed_at": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
            }
            for t in trades
        ]
    }


@router.get("/social/freshness")
async def get_social_freshness(db: Session = Depends(get_db)):
    def _status(configured: bool) -> str:
        return "healthy" if configured else "not_configured"

    # Yahoo Finance — yfinance 설치 여부만 확인 (API 키 불필요)
    try:
        import yfinance  # noqa: F401
        yahoo_ok = True
    except ImportError:
        yahoo_ok = False

    # Fear & Greed Index — httpx만 있으면 됨 (API 키 불필요)
    fear_greed_ok = True

    news_ok = bool(settings.news_api_key)

    # pytrends는 API 키 불필요 — 라이브러리만 설치되면 됨
    try:
        from pytrends.request import TrendReq  # noqa: F401
        trends_ok = True
    except ImportError:
        trends_ok = False

    return {
        "yahoo_finance": {"status": _status(yahoo_ok), "last_fetch": None},
        "fear_greed": {"status": _status(fear_greed_ok), "last_fetch": None},
        "google_trends": {"status": _status(trends_ok), "last_fetch": None},
        "news_api": {"status": _status(news_ok), "last_fetch": None},
    }


@router.post("/reset")
async def reset_fund(db: Session = Depends(get_db)):
    """모든 거래 데이터를 삭제하고 PM 자본을 초기화합니다. NAV 히스토리도 비웁니다."""
    from app.models.signal import Signal
    from app.models.trade import Trade
    from app.models.position import Position
    from app.models.nav_history import NAVHistory
    from app.models.pm import PM
    from app.db.seed import seed_pms

    db.query(Signal).delete()
    db.query(Trade).delete()
    db.query(Position).delete()
    db.query(NAVHistory).delete()
    db.query(PM).delete()
    db.commit()

    seed_pms(db)

    # 초기 NAV 한 건만 기록 (시뮬레이션 데이터 없이)
    pms = db.query(PM).all()
    initial_nav = sum(pm.current_capital for pm in pms)
    db.add(NAVHistory(nav=initial_nav, daily_return=0.0))
    db.commit()

    return {"status": "ok", "message": "Fund reset complete. Clean start with zero history."}


@router.get("/broker/status")
async def get_broker_status(db: Session = Depends(get_db)):
    """각 PM의 브로커 상태 조회"""
    from app.models.pm import PM
    from app.engines.broker import get_broker_for_pm

    pms = db.query(PM).all()
    statuses = []
    for pm in pms:
        broker = get_broker_for_pm(pm.broker_type)
        statuses.append({
            "pm_id": pm.id,
            "name": pm.name,
            "emoji": pm.emoji,
            "broker_type": pm.broker_type,
            "broker_class": type(broker).__name__,
            "is_live": broker.is_live(),
            "is_active": pm.is_active,
        })

    return {
        "brokers": statuses,
        "bybit_testnet": settings.bybit_testnet,
    }


@router.post("/broker/toggle-live")
async def toggle_live_mode():
    """Bybit 테스트넷 ↔ 실거래 전환 (런타임 토글, 재시작 시 .env로 리셋)"""
    settings.bybit_testnet = not settings.bybit_testnet
    mode = "testnet" if settings.bybit_testnet else "LIVE"
    return {
        "status": "ok",
        "bybit_testnet": settings.bybit_testnet,
        "message": f"Bybit mode switched to {mode}",
    }


@router.post("/broker/kill-switch")
async def kill_switch(db: Session = Depends(get_db)):
    """긴급 정지: 모든 PM 비활성화"""
    from app.models.pm import PM

    db.query(PM).update({"is_active": False})
    db.commit()
    return {"status": "ok", "message": "All PMs deactivated. Trading halted."}


@router.post("/broker/resume")
async def resume_trading(db: Session = Depends(get_db)):
    """거래 재개: 모든 PM 활성화"""
    from app.models.pm import PM

    db.query(PM).update({"is_active": True})
    db.commit()
    return {"status": "ok", "message": "All PMs reactivated. Trading resumed."}


@router.get("/broker/reconcile")
async def reconcile_positions(db: Session = Depends(get_db)):
    """DB 포지션과 실제 브로커 잔고 비교 (Balance Reconciliation)"""
    from app.models.pm import PM
    from app.models.position import Position
    from app.engines.broker import get_broker_for_pm, PaperAdapter

    pms = db.query(PM).all()
    results = []

    for pm in pms:
        broker = get_broker_for_pm(pm.broker_type)

        # Paper 브로커는 실제 잔고 조회 불가 — DB만 표시
        if isinstance(broker, PaperAdapter):
            db_positions = db.query(Position).filter(Position.pm_id == pm.id).all()
            for pos in db_positions:
                results.append({
                    "pm_id": pm.id,
                    "pm_name": pm.name,
                    "emoji": pm.emoji,
                    "symbol": pos.symbol,
                    "db_qty": round(pos.quantity, 6),
                    "broker_qty": None,
                    "diff": None,
                    "status": "paper",
                })
            continue

        # 실제 브로커: 잔고 조회 시도
        try:
            broker_positions = await broker.get_positions()
        except Exception as e:
            results.append({
                "pm_id": pm.id,
                "pm_name": pm.name,
                "emoji": pm.emoji,
                "symbol": "*",
                "db_qty": None,
                "broker_qty": None,
                "diff": None,
                "status": "error",
                "error": str(e),
            })
            continue

        db_positions = db.query(Position).filter(Position.pm_id == pm.id).all()
        db_map = {p.symbol: p.quantity for p in db_positions}
        broker_map = {p["symbol"]: p["qty"] for p in broker_positions}

        all_symbols = set(db_map.keys()) | set(broker_map.keys())
        for symbol in sorted(all_symbols):
            db_qty = round(db_map.get(symbol, 0.0), 6)
            broker_qty = round(broker_map.get(symbol, 0.0), 6)
            diff = round(broker_qty - db_qty, 6)
            status = "match" if abs(diff) < 0.0001 else "mismatch"
            results.append({
                "pm_id": pm.id,
                "pm_name": pm.name,
                "emoji": pm.emoji,
                "symbol": symbol,
                "db_qty": db_qty,
                "broker_qty": broker_qty,
                "diff": diff,
                "status": status,
            })

    return {"positions": results}
