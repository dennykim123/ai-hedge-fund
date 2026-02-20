from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.pm import PM
from app.models.position import Position
from app.schemas.fund import FundStats, PMSummary

router = APIRouter(prefix="/api/fund", tags=["fund"])


@router.get("/stats", response_model=FundStats)
async def get_fund_stats(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    total_capital = sum(pm.current_capital for pm in pms)
    initial_total = len(pms) * 100_000.0
    itd_return = (
        ((total_capital - initial_total) / initial_total * 100)
        if initial_total > 0
        else 0.0
    )
    total_positions = db.query(Position).count()
    return FundStats(
        nav=total_capital,
        today_return=0.0,
        prior_day_return=0.0,
        itd_return=round(itd_return, 2),
        active_pms=len(pms),
        total_positions=total_positions,
    )


@router.get("/pms", response_model=list[PMSummary])
async def get_pms(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).order_by(PM.id).all()
    result = []
    for pm in pms:
        itd = (pm.current_capital - 100_000.0) / 100_000.0 * 100
        result.append(
            PMSummary(
                id=pm.id,
                name=pm.name,
                emoji=pm.emoji,
                strategy=pm.strategy,
                llm_provider=pm.llm_provider,
                current_capital=pm.current_capital,
                itd_return=round(itd, 2),
            )
        )
    return result
