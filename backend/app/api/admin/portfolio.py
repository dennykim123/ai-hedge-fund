from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.position import Position
from app.models.trade import Trade

router = APIRouter(prefix="/api/fund", tags=["admin-portfolio"])


@router.get("/positions/breakdown")
async def get_positions_breakdown(db: Session = Depends(get_db)):
    positions = db.query(Position).all()
    breakdown = {}
    for p in positions:
        if p.symbol not in breakdown:
            breakdown[p.symbol] = {
                "symbol": p.symbol,
                "total_quantity": 0,
                "avg_cost": 0,
                "pms": [],
            }
        breakdown[p.symbol]["total_quantity"] += p.quantity
        breakdown[p.symbol]["pms"].append(p.pm_id)
    return {"positions": list(breakdown.values())}


@router.get("/trades")
async def get_trades(limit: int = 50, db: Session = Depends(get_db)):
    trades = db.query(Trade).order_by(Trade.executed_at.desc()).limit(limit).all()
    return {
        "trades": [
            {
                "id": t.id,
                "pm_id": t.pm_id,
                "symbol": t.symbol,
                "action": t.action,
                "quantity": t.quantity,
                "price": t.price,
                "conviction": t.conviction_score,
                "reasoning": t.reasoning,
                "executed_at": t.executed_at.isoformat() if t.executed_at else None,
            }
            for t in trades
        ]
    }


@router.get("/heatmap")
async def get_heatmap(db: Session = Depends(get_db)):
    positions = db.query(Position).all()
    sectors = {}
    for p in positions:
        sector = "Unknown"
        if sector not in sectors:
            sectors[sector] = {"sector": sector, "symbols": [], "total_value": 0}
        sectors[sector]["symbols"].append(p.symbol)
        sectors[sector]["total_value"] += p.quantity * p.avg_cost
    return {"sectors": list(sectors.values())}


@router.get("/exposure")
async def get_exposure(db: Session = Depends(get_db)):
    from app.models.pm import PM

    pms = db.query(PM).filter(PM.is_active == True).all()
    positions = db.query(Position).all()
    total_nav = sum(pm.current_capital for pm in pms)
    long_value = sum(p.quantity * p.avg_cost for p in positions if p.quantity > 0)
    short_value = sum(abs(p.quantity) * p.avg_cost for p in positions if p.quantity < 0)

    return {
        "net_exposure": {
            "long": long_value,
            "short": short_value,
            "net": long_value - short_value,
            "net_pct": round(
                (long_value - short_value) / total_nav * 100, 1
            )
            if total_nav > 0
            else 0,
        },
        "conflicts": [],
    }
