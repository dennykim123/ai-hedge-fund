from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.pm import PM
from app.models.position import Position

router = APIRouter(prefix="/api/fund/risk", tags=["admin-risk"])


@router.get("/overview")
async def get_risk_overview(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    positions = db.query(Position).all()
    total_nav = sum(pm.current_capital for pm in pms)

    long_exposure = sum(p.quantity * p.avg_cost for p in positions if p.quantity > 0)
    short_exposure = sum(
        abs(p.quantity) * p.avg_cost for p in positions if p.quantity < 0
    )
    gross_pct = (
        ((long_exposure + short_exposure) / total_nav * 100) if total_nav > 0 else 0
    )
    net_pct = (
        ((long_exposure - short_exposure) / total_nav * 100) if total_nav > 0 else 0
    )

    return {
        "exposure": {"gross_pct": round(gross_pct, 1), "net_pct": round(net_pct, 1)},
        "margin": {"utilization_pct": 0.0},
        "vix": None,
        "active_conditions": 0,
        "concentration": {
            "top_ticker": None,
            "top_sector": None,
        },
        "decisions_24h": {
            "approval_rate": 100.0,
            "total": 0,
            "approved": 0,
            "rejected": 0,
        },
    }


@router.get("/decisions")
async def get_risk_decisions(limit: int = 20, db: Session = Depends(get_db)):
    return {"decisions": []}


@router.get("/negotiations")
async def get_risk_negotiations(limit: int = 20, db: Session = Depends(get_db)):
    return {"negotiations": []}
