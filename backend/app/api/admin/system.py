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
