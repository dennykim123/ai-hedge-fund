from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.pm import PM

router = APIRouter(prefix="/api/fund/strategic", tags=["admin-strategic"])


@router.get("/overview")
async def get_strategic_overview(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    return {
        "regime": "normal",
        "regime_confidence": 0.0,
        "pms": [
            {
                "id": pm.id,
                "name": pm.name,
                "emoji": pm.emoji,
                "strategy": pm.strategy,
                "goal": f"Execute {pm.strategy} strategy",
            }
            for pm in pms
        ],
    }


@router.get("/thesis-health")
async def get_thesis_health(db: Session = Depends(get_db)):
    return {
        "active": 0,
        "flagged": 0,
        "invalidated": 0,
        "theses": [],
    }


@router.get("/rebalance-status")
async def get_rebalance_status(db: Session = Depends(get_db)):
    return {
        "in_progress": False,
        "last_rebalance": None,
        "next_scheduled": None,
        "progress_pct": 0,
    }
