from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.pm import PM

router = APIRouter(prefix="/api/fund/analytics", tags=["admin-analytics"])


@router.get("/alpha")
async def get_analytics_alpha(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    leaderboard = []
    for pm in pms:
        itd_return = (pm.current_capital - 100_000.0) / 100_000.0 * 100
        leaderboard.append(
            {
                "pm_id": pm.id,
                "name": pm.name,
                "emoji": pm.emoji,
                "provider": pm.llm_provider,
                "total_return_pct": round(itd_return, 2),
                "spy_return_pct": 0.0,
                "alpha_pct": round(itd_return, 2),
                "rolling_5d_alpha": 0.0,
                "sharpe": 0.0,
                "sortino": 0.0,
                "mdd": 0.0,
                "calmar": 0.0,
                "data_days": 0,
            }
        )
    leaderboard.sort(key=lambda x: x["alpha_pct"], reverse=True)
    return {"leaderboard": leaderboard}


@router.get("/provider")
async def get_analytics_provider(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    providers = {}
    for pm in pms:
        p = pm.llm_provider
        if p not in providers:
            providers[p] = {"provider": p, "pms": [], "avg_return": 0.0}
        itd = (pm.current_capital - 100_000.0) / 100_000.0 * 100
        providers[p]["pms"].append(pm.id)
        providers[p]["avg_return"] = round(
            (providers[p]["avg_return"] * (len(providers[p]["pms"]) - 1) + itd)
            / len(providers[p]["pms"]),
            2,
        )
    return {"providers": list(providers.values())}


@router.get("/conviction")
async def get_conviction_accuracy(db: Session = Depends(get_db)):
    return {
        "buckets": [
            {"range": "0.5-0.6", "total": 0, "correct": 0, "accuracy": 0.0},
            {"range": "0.6-0.7", "total": 0, "correct": 0, "accuracy": 0.0},
            {"range": "0.7-0.8", "total": 0, "correct": 0, "accuracy": 0.0},
            {"range": "0.8-0.9", "total": 0, "correct": 0, "accuracy": 0.0},
            {"range": "0.9-1.0", "total": 0, "correct": 0, "accuracy": 0.0},
        ]
    }


@router.get("/positions")
async def get_analytics_positions(db: Session = Depends(get_db)):
    return {"pm_positions": []}


@router.get("/tools")
async def get_tool_efficiency(db: Session = Depends(get_db)):
    return {"tools": []}


@router.get("/performance")
async def get_analytics_performance(db: Session = Depends(get_db)):
    return {
        "fund_sharpe": 0.0,
        "fund_sortino": 0.0,
        "fund_mdd": 0.0,
        "fund_calmar": 0.0,
        "benchmark_return": 0.0,
    }


@router.get("/backtest")
async def get_analytics_backtest(db: Session = Depends(get_db)):
    return {"backtest_results": []}
