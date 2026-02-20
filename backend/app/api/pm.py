from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.pm import PM
from app.models.position import Position

router = APIRouter(prefix="/api/pm", tags=["pm"])


@router.get("/{pm_id}")
async def get_pm_detail(pm_id: str, db: Session = Depends(get_db)):
    pm = db.query(PM).filter(PM.id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="PM not found")
    positions = db.query(Position).filter(Position.pm_id == pm_id).all()
    itd_return = (pm.current_capital - 100_000.0) / 100_000.0 * 100
    return {
        "id": pm.id,
        "name": pm.name,
        "emoji": pm.emoji,
        "strategy": pm.strategy,
        "llm_provider": pm.llm_provider,
        "current_capital": pm.current_capital,
        "itd_return": round(itd_return, 2),
        "position_count": len(positions),
        "positions": [
            {
                "symbol": p.symbol,
                "quantity": p.quantity,
                "avg_cost": p.avg_cost,
                "asset_type": p.asset_type,
            }
            for p in positions
        ],
    }
