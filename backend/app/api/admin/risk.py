from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.pm import PM
from app.models.position import Position
from app.models.trade import Trade

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
    """최근 거래에 대한 리스크 심사 결과"""
    cutoff = datetime.now() - timedelta(days=7)
    trades = (
        db.query(Trade)
        .filter(Trade.executed_at >= cutoff)
        .order_by(Trade.executed_at.desc())
        .limit(limit)
        .all()
    )
    pms = {pm.id: pm for pm in db.query(PM).all()}
    decisions = []
    for t in trades:
        pm = pms.get(t.pm_id)
        approved = t.conviction_score >= 0.5
        decisions.append({
            "id": t.id,
            "pm_name": pm.name if pm else t.pm_id,
            "pm_emoji": pm.emoji if pm else "",
            "symbol": t.symbol,
            "action": t.action,
            "quantity": t.quantity,
            "conviction": round(t.conviction_score, 3),
            "status": "approved" if approved else "rejected",
            "reason": t.reasoning[:100] if t.reasoning else "",
            "decided_at": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
        })
    return {"decisions": decisions}


@router.get("/negotiations")
async def get_risk_negotiations(limit: int = 20, db: Session = Depends(get_db)):
    """PM 간 동일 종목 반대 포지션 (충돌) 조회"""
    positions = db.query(Position).all()
    pms = {pm.id: pm for pm in db.query(PM).all()}

    # 종목별 PM 포지션 그룹핑
    by_symbol: dict[str, list] = {}
    for p in positions:
        by_symbol.setdefault(p.symbol, []).append(p)

    negotiations = []
    for symbol, pos_list in by_symbol.items():
        longs = [p for p in pos_list if p.quantity > 0]
        shorts = [p for p in pos_list if p.quantity < 0]
        if longs and shorts:
            for lo in longs:
                for sh in shorts:
                    pm_long = pms.get(lo.pm_id)
                    pm_short = pms.get(sh.pm_id)
                    negotiations.append({
                        "symbol": symbol,
                        "long_pm": pm_long.name if pm_long else lo.pm_id,
                        "long_emoji": pm_long.emoji if pm_long else "",
                        "long_qty": lo.quantity,
                        "short_pm": pm_short.name if pm_short else sh.pm_id,
                        "short_emoji": pm_short.emoji if pm_short else "",
                        "short_qty": abs(sh.quantity),
                        "status": "active",
                    })
    return {"negotiations": negotiations}
