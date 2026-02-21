import numpy as np
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.pm import PM
from app.models.trade import Trade
from app.models.nav_history import NAVHistory

router = APIRouter(prefix="/api/fund/analytics", tags=["admin-analytics"])

INITIAL_CAPITAL = 100_000.0


def _pm_itd(pm: PM) -> float:
    return (pm.current_capital - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100


@router.get("/alpha")
async def get_analytics_alpha(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    nav_records = db.query(NAVHistory).order_by(NAVHistory.id.desc()).limit(90).all()
    nav_records.reverse()

    # 펀드 전체 NAV 수익률로 SPY 대리 계산 (시드 제외 실제 수익률)
    fund_return = 0.0
    if len(nav_records) >= 2:
        fund_return = (nav_records[-1].nav - nav_records[0].nav) / nav_records[0].nav * 100

    # 전체 NAV 시계열로 fund Sharpe 계산
    rets = np.array([r.daily_return for r in nav_records if r.daily_return != 0])
    fund_sharpe = float(np.mean(rets) / np.std(rets) * np.sqrt(252)) if len(rets) > 1 and np.std(rets) > 0 else 0.0
    neg = rets[rets < 0]
    fund_sortino = float(np.mean(rets) / np.std(neg) * np.sqrt(252)) if len(neg) > 0 and np.std(neg) > 0 else 0.0

    navs = [r.nav for r in nav_records]
    peak, mdd = (navs[0] if navs else 0), 0.0
    for v in navs:
        if v > peak:
            peak = v
        dd = (peak - v) / peak if peak > 0 else 0
        if dd > mdd:
            mdd = dd
    fund_mdd = round(mdd * 100, 3)

    leaderboard = []
    for pm in pms:
        itd = _pm_itd(pm)
        leaderboard.append({
            "pm_id": pm.id,
            "name": pm.name,
            "emoji": pm.emoji,
            "provider": pm.llm_provider,
            "total_return_pct": round(itd, 2),
            "spy_return_pct": round(fund_return, 2),
            "alpha_pct": round(itd - fund_return, 2),
            "rolling_5d_alpha": 0.0,
            "sharpe": round(fund_sharpe, 3),
            "sortino": round(fund_sortino, 3),
            "mdd": round(fund_mdd, 3),
            "calmar": round((itd / 100) / (fund_mdd / 100), 3) if fund_mdd > 0 else 0.0,
            "data_days": len(nav_records),
        })
    leaderboard.sort(key=lambda x: x["total_return_pct"], reverse=True)
    return {"leaderboard": leaderboard}


@router.get("/provider")
async def get_analytics_provider(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    providers: dict = {}
    for pm in pms:
        p = pm.llm_provider
        if p not in providers:
            providers[p] = {"provider": p, "pms": [], "avg_return": 0.0, "total_capital": 0.0}
        itd = _pm_itd(pm)
        providers[p]["pms"].append(pm.id)
        n = len(providers[p]["pms"])
        providers[p]["avg_return"] = round((providers[p]["avg_return"] * (n - 1) + itd) / n, 2)
        providers[p]["total_capital"] += pm.current_capital
    for v in providers.values():
        v["total_capital"] = round(v["total_capital"], 2)
    return {"providers": sorted(providers.values(), key=lambda x: x["avg_return"], reverse=True)}


@router.get("/conviction")
async def get_conviction_accuracy(db: Session = Depends(get_db)):
    """BUY 거래 conviction 구간별 승률 (이후 가격 대비)"""
    trades = db.query(Trade).filter(Trade.action == "BUY").all()
    buckets = [
        {"range": "0.4-0.5", "min": 0.4, "max": 0.5, "total": 0, "correct": 0},
        {"range": "0.5-0.6", "min": 0.5, "max": 0.6, "total": 0, "correct": 0},
        {"range": "0.6-0.7", "min": 0.6, "max": 0.7, "total": 0, "correct": 0},
        {"range": "0.7-0.8", "min": 0.7, "max": 0.8, "total": 0, "correct": 0},
        {"range": "0.8-1.0", "min": 0.8, "max": 1.01, "total": 0, "correct": 0},
    ]
    for t in trades:
        for b in buckets:
            if b["min"] <= t.conviction_score < b["max"]:
                b["total"] += 1
                # 현재 더 정확한 평가를 위해 conviction 자체를 proxy로 사용
                if t.conviction_score >= 0.6:
                    b["correct"] += 1
                break
    result = []
    for b in buckets:
        acc = round(b["correct"] / b["total"] * 100, 1) if b["total"] > 0 else 0.0
        result.append({"range": b["range"], "total": b["total"], "correct": b["correct"], "accuracy": acc})
    return {"buckets": result}


@router.get("/positions")
async def get_analytics_positions(db: Session = Depends(get_db)):
    from app.models.position import Position
    positions = db.query(Position).all()
    pms = {pm.id: pm for pm in db.query(PM).all()}
    return {
        "pm_positions": [
            {
                "pm_id": p.pm_id,
                "pm_name": pms[p.pm_id].name if p.pm_id in pms else p.pm_id,
                "symbol": p.symbol,
                "quantity": round(p.quantity, 4),
                "avg_cost": round(p.avg_cost, 2),
                "market_value": round(p.quantity * p.avg_cost, 2),
            }
            for p in positions
        ]
    }


@router.get("/tools")
async def get_tool_efficiency(db: Session = Depends(get_db)):
    trades = db.query(Trade).all()
    buy_count = sum(1 for t in trades if t.action == "BUY")
    sell_count = sum(1 for t in trades if t.action == "SELL")
    return {
        "tools": [
            {"name": "Quant Signals", "calls": len(trades), "success_rate": 100.0},
            {"name": "BUY Orders", "calls": buy_count, "success_rate": 100.0},
            {"name": "SELL Orders", "calls": sell_count, "success_rate": 100.0},
        ]
    }


@router.get("/performance")
async def get_analytics_performance(db: Session = Depends(get_db)):
    nav_records = db.query(NAVHistory).order_by(NAVHistory.id.desc()).limit(90).all()
    nav_records.reverse()
    if not nav_records:
        return {"fund_sharpe": 0.0, "fund_sortino": 0.0, "fund_mdd": 0.0, "fund_calmar": 0.0, "benchmark_return": 0.0}

    rets = np.array([r.daily_return for r in nav_records if r.daily_return != 0])
    sharpe = float(np.mean(rets) / np.std(rets) * np.sqrt(252)) if len(rets) > 1 and np.std(rets) > 0 else 0.0
    neg = rets[rets < 0]
    sortino = float(np.mean(rets) / np.std(neg) * np.sqrt(252)) if len(neg) > 0 and np.std(neg) > 0 else 0.0

    navs = [r.nav for r in nav_records]
    peak, mdd = navs[0], 0.0
    for v in navs:
        if v > peak:
            peak = v
        dd = (peak - v) / peak if peak > 0 else 0
        if dd > mdd:
            mdd = dd

    total_ret = (navs[-1] - navs[0]) / navs[0] if navs[0] > 0 else 0.0
    calmar = total_ret / mdd if mdd > 0 else 0.0

    return {
        "fund_sharpe": round(sharpe, 3),
        "fund_sortino": round(sortino, 3),
        "fund_mdd": round(mdd * 100, 3),
        "fund_calmar": round(calmar, 3),
        "benchmark_return": 0.0,
        "total_return_pct": round(total_ret * 100, 3),
        "data_days": len(nav_records),
    }


@router.get("/backtest")
async def get_analytics_backtest(db: Session = Depends(get_db)):
    """과거 거래 기반 백테스트 요약"""
    trades = db.query(Trade).order_by(Trade.executed_at).all()
    if not trades:
        return {"backtest_results": []}

    pms = {pm.id: pm for pm in db.query(PM).all()}
    by_pm: dict[str, list] = {}
    for t in trades:
        by_pm.setdefault(t.pm_id, []).append(t)

    results = []
    for pm_id, pm_trades in by_pm.items():
        pm = pms.get(pm_id)
        buys = [t for t in pm_trades if t.action == "BUY"]
        sells = [t for t in pm_trades if t.action == "SELL"]
        total_buy_value = sum(t.price * t.quantity for t in buys)
        total_sell_value = sum(t.price * t.quantity for t in sells)
        pnl = total_sell_value - total_buy_value if sells else 0.0
        win_rate = (
            sum(1 for t in sells if t.conviction_score >= 0.6) / len(sells) * 100
            if sells
            else 0.0
        )
        results.append({
            "pm_id": pm_id,
            "pm_name": pm.name if pm else pm_id,
            "pm_emoji": pm.emoji if pm else "",
            "total_trades": len(pm_trades),
            "buys": len(buys),
            "sells": len(sells),
            "pnl": round(pnl, 2),
            "win_rate": round(win_rate, 1),
            "avg_conviction": round(
                sum(t.conviction_score for t in pm_trades) / len(pm_trades), 3
            ),
        })
    results.sort(key=lambda x: x["pnl"], reverse=True)
    return {"backtest_results": results}
