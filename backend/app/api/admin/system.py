from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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
                "executed_at": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
            }
            for t in trades
        ]
    }


@router.get("/social/freshness")
async def get_social_freshness(db: Session = Depends(get_db)):
    return {
        "reddit": {"status": "not_configured", "last_fetch": None},
        "google_trends": {"status": "not_configured", "last_fetch": None},
        "news_api": {"status": "not_configured", "last_fetch": None},
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

    return {"brokers": statuses}


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
