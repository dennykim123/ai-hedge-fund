from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.position import Position
from app.models.trade import Trade
from app.models.pm import PM

router = APIRouter(prefix="/api/fund", tags=["admin-portfolio"])

# 섹터 분류 (간소화)
SYMBOL_SECTORS = {
    "AAPL": "Technology", "MSFT": "Technology", "GOOGL": "Technology",
    "AMZN": "Consumer", "META": "Technology", "NVDA": "Technology",
    "TSLA": "Automotive", "COIN": "Crypto", "MSTR": "Crypto",
    "BTC-USD": "Crypto", "ETH-USD": "Crypto", "SOL-USD": "Crypto",
    "SPY": "Index ETF", "QQQ": "Index ETF", "IWM": "Index ETF",
    "TLT": "Bonds", "GLD": "Commodities", "UUP": "Currencies",
    "VIX": "Volatility", "UVXY": "Volatility", "SQQQ": "Inverse ETF",
    "EWJ": "Asia ETF", "EWY": "Asia ETF", "FXI": "Asia ETF",
    "GME": "Meme", "AMC": "Meme",
}


@router.get("/positions/breakdown")
async def get_positions_breakdown(db: Session = Depends(get_db)):
    positions = db.query(Position).all()
    pms = {pm.id: pm for pm in db.query(PM).all()}
    total_nav = sum(pm.current_capital for pm in pms.values())

    breakdown: dict[str, dict] = {}
    for p in positions:
        sym = p.symbol
        val = p.quantity * p.avg_cost
        if sym not in breakdown:
            breakdown[sym] = {
                "symbol": sym,
                "sector": SYMBOL_SECTORS.get(sym, "Other"),
                "total_quantity": 0.0,
                "total_value": 0.0,
                "pms": [],
                "pm_names": [],
                "pct_of_nav": 0.0,
            }
        pm = pms.get(p.pm_id)
        breakdown[sym]["total_quantity"] += p.quantity
        breakdown[sym]["total_value"] += val
        breakdown[sym]["pms"].append(p.pm_id)
        if pm:
            breakdown[sym]["pm_names"].append(pm.name)

    for sym, data in breakdown.items():
        data["total_value"] = round(data["total_value"], 2)
        data["pct_of_nav"] = round(data["total_value"] / total_nav * 100, 2) if total_nav > 0 else 0

    sorted_positions = sorted(breakdown.values(), key=lambda x: x["total_value"], reverse=True)
    return {"positions": sorted_positions, "total_nav": round(total_nav, 2)}


@router.get("/trades")
async def get_trades(limit: int = 50, db: Session = Depends(get_db)):
    trades = db.query(Trade).order_by(Trade.executed_at.desc()).limit(limit).all()
    pms = {pm.id: pm for pm in db.query(PM).all()}

    return {
        "trades": [
            {
                "id": t.id,
                "pm_id": t.pm_id,
                "pm_name": pms.get(t.pm_id, PM(name=t.pm_id, emoji="🤖")).name,
                "pm_emoji": pms.get(t.pm_id, PM(name=t.pm_id, emoji="🤖")).emoji,
                "symbol": t.symbol,
                "action": t.action,
                "quantity": round(t.quantity, 4),
                "price": round(t.price, 2),
                "value": round(t.quantity * t.price, 2),
                "conviction": round(t.conviction_score, 3),
                "reasoning": t.reasoning,
                "sector": SYMBOL_SECTORS.get(t.symbol, "Other"),
                "executed_at": t.executed_at.isoformat() if t.executed_at else None,
            }
            for t in trades
        ]
    }


@router.get("/heatmap")
async def get_heatmap(db: Session = Depends(get_db)):
    positions = db.query(Position).all()
    pms = db.query(PM).filter(PM.is_active == True).all()
    total_nav = sum(pm.current_capital for pm in pms)

    sectors: dict[str, dict] = {}
    for p in positions:
        sector = SYMBOL_SECTORS.get(p.symbol, "Other")
        val = p.quantity * p.avg_cost
        if sector not in sectors:
            sectors[sector] = {"sector": sector, "symbols": [], "total_value": 0.0, "pct": 0.0}
        if p.symbol not in sectors[sector]["symbols"]:
            sectors[sector]["symbols"].append(p.symbol)
        sectors[sector]["total_value"] += val

    for s in sectors.values():
        s["total_value"] = round(s["total_value"], 2)
        s["pct"] = round(s["total_value"] / total_nav * 100, 2) if total_nav > 0 else 0

    return {
        "sectors": sorted(sectors.values(), key=lambda x: x["total_value"], reverse=True),
        "total_nav": round(total_nav, 2),
    }


@router.get("/exposure")
async def get_exposure(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    positions = db.query(Position).all()
    total_nav = sum(pm.current_capital for pm in pms)

    long_value = sum(p.quantity * p.avg_cost for p in positions if p.quantity > 0)
    short_value = sum(abs(p.quantity) * p.avg_cost for p in positions if p.quantity < 0)
    net = long_value - short_value
    gross = long_value + short_value

    # PM별 익스포저
    pm_map = {pm.id: pm for pm in pms}
    pm_exposure = {}
    for p in positions:
        val = abs(p.quantity * p.avg_cost)
        if p.pm_id not in pm_exposure:
            pm = pm_map.get(p.pm_id)
            pm_exposure[p.pm_id] = {
                "pm_id": p.pm_id,
                "pm_name": pm.name if pm else p.pm_id,
                "pm_emoji": pm.emoji if pm else "🤖",
                "value": 0.0,
                "pct": 0.0,
            }
        pm_exposure[p.pm_id]["value"] += val

    for exp in pm_exposure.values():
        exp["value"] = round(exp["value"], 2)
        exp["pct"] = round(exp["value"] / total_nav * 100, 2) if total_nav > 0 else 0

    return {
        "net_exposure": {
            "long": round(long_value, 2),
            "short": round(short_value, 2),
            "net": round(net, 2),
            "gross": round(gross, 2),
            "net_pct": round(net / total_nav * 100, 1) if total_nav > 0 else 0,
            "gross_pct": round(gross / total_nav * 100, 1) if total_nav > 0 else 0,
        },
        "pm_exposure": sorted(pm_exposure.values(), key=lambda x: x["value"], reverse=True),
        "conflicts": [],
    }


@router.get("/pm-performance")  # pragma: no cover
async def get_pm_performance(db: Session = Depends(get_db)):  # pragma: no cover
    """PM별 성과 순위 (Admin 대시보드용) - fund.py의 동일 라우트에 가려짐"""
    pms = db.query(PM).filter(PM.is_active == True).all()  # pragma: no cover
    result = []  # pragma: no cover
    for pm in pms:  # pragma: no cover
        itd = (pm.current_capital - 100_000) / 100_000 * 100  # pragma: no cover
        trade_count = db.query(Trade).filter(Trade.pm_id == pm.id).count()  # pragma: no cover
        pos_count = db.query(Position).filter(Position.pm_id == pm.id).count()  # pragma: no cover
        result.append({  # pragma: no cover
            "id": pm.id,
            "name": pm.name,
            "emoji": pm.emoji,
            "strategy": pm.strategy,
            "llm_provider": pm.llm_provider,
            "current_capital": round(pm.current_capital, 2),
            "itd_return": round(itd, 2),
            "trade_count": trade_count,
            "position_count": pos_count,
        })

    result.sort(key=lambda x: x["itd_return"], reverse=True)  # pragma: no cover
    return {"pms": result}  # pragma: no cover
