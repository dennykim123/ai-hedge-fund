from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db

router = APIRouter(prefix="/api/fund", tags=["admin-dashboard"])


@router.get("/intelligence/brief")
async def get_intelligence_brief(db: Session = Depends(get_db)):
    return {
        "brief": {
            "market_read": "Market Intelligence not yet available",
            "quality_score": 0,
            "timestamp": None,
            "hot_tickers": [],
            "events": [],
        }
    }


@router.get("/activity-feed")
async def get_activity_feed(limit: int = 30, db: Session = Depends(get_db)):
    from app.models.trade import Trade

    trades = db.query(Trade).order_by(Trade.executed_at.desc()).limit(limit).all()
    items = []
    for t in trades:
        items.append(
            {
                "emoji": "\U0001f4bc",
                "type": "trade",
                "summary": f"{t.pm_id} {t.action} {t.quantity} {t.symbol} @ ${t.price:.2f}",
                "time": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
                "details": {
                    "pm_id": t.pm_id,
                    "symbol": t.symbol,
                    "action": t.action,
                    "quantity": t.quantity,
                    "price": t.price,
                    "conviction": t.conviction_score,
                    "reasoning": t.reasoning,
                },
            }
        )
    return {"items": items}
