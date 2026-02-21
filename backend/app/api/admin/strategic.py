from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.db.base import get_db
from app.models.pm import PM
from app.models.nav_history import NAVHistory
from app.engines.social import SocialEngine

router = APIRouter(prefix="/api/fund/strategic", tags=["admin-strategic"])
social_engine = SocialEngine()


@router.get("/overview")
async def get_strategic_overview(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()

    # 최근 NAV 데이터로 시장 레짐 판단
    recent_nav = db.query(NAVHistory).order_by(NAVHistory.id.desc()).limit(10).all()
    avg_return = 0.0
    if recent_nav:
        returns = [r.daily_return for r in recent_nav if r.daily_return != 0]
        avg_return = sum(returns) / len(returns) if returns else 0.0

    regime = "bull" if avg_return > 0.001 else "bear" if avg_return < -0.001 else "neutral"
    regime_confidence = min(abs(avg_return) * 1000, 1.0)

    pm_goals = {
        "atlas": "Monitor macro regime shifts — interest rates, VIX, USD strength",
        "council": "Achieve consensus across value/growth/macro perspectives",
        "drflow": "Detect unusual options flow (OI > 2x avg) for informed positioning",
        "insider": "Track Form 4 filings — follow directors buying their own stock",
        "maxpayne": "Fade extreme Fear & Greed readings (< 20 or > 80)",
        "satoshi": "Monitor BTC dominance and on-chain metrics for crypto rotation",
        "quantking": "Execute RSI + MACD + BB signals with 100% mechanical discipline",
        "asiatiger": "Capture Asian session momentum before US open gap fills",
        "momentum": "Maintain long exposure to 52-week high breakouts",
        "sentinel": "Hedge fund delta to maintain net exposure < 30%",
        "voxpopuli": "Detect Z-score 3σ+ Reddit/Trends tipping points in real-time",
    }

    return {
        "regime": regime,
        "regime_confidence": round(regime_confidence, 3),
        "avg_daily_return_pct": round(avg_return * 100, 4),
        "pms": [
            {
                "id": pm.id,
                "name": pm.name,
                "emoji": pm.emoji,
                "strategy": pm.strategy,
                "llm_provider": pm.llm_provider,
                "goal": pm_goals.get(pm.id, f"Execute {pm.strategy} strategy"),
                "current_capital": round(pm.current_capital, 2),
                "itd_return": round((pm.current_capital - 100_000) / 100_000 * 100, 2),
            }
            for pm in pms
        ],
    }


@router.get("/thesis-health")
async def get_thesis_health(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    theses = []

    for pm in pms:
        itd = (pm.current_capital - 100_000) / 100_000
        status = "active" if itd > -0.05 else "flagged" if itd > -0.15 else "invalidated"
        theses.append({
            "pm_id": pm.id,
            "pm_name": pm.name,
            "pm_emoji": pm.emoji,
            "thesis": f"{pm.strategy} — ITD {'+' if itd >= 0 else ''}{itd * 100:.1f}%",
            "status": status,
            "confidence": max(0.3, 0.7 + itd * 2),
        })

    active = sum(1 for t in theses if t["status"] == "active")
    flagged = sum(1 for t in theses if t["status"] == "flagged")
    invalidated = sum(1 for t in theses if t["status"] == "invalidated")

    return {
        "active": active,
        "flagged": flagged,
        "invalidated": invalidated,
        "theses": theses,
    }


@router.get("/rebalance-status")
async def get_rebalance_status(db: Session = Depends(get_db)):
    last_nav = db.query(NAVHistory).order_by(NAVHistory.id.desc()).first()
    return {
        "in_progress": False,
        "last_rebalance": (last_nav.recorded_at.isoformat() + "Z") if last_nav else None,
        "next_scheduled": None,
        "progress_pct": 0,
        "last_action": "Signal generation cycle",
    }


@router.get("/social-signals")
async def get_social_signals():
    """소셜 티핑포인트 시그널 (Vox Populi용)"""
    signals = social_engine.get_voxpopuli_signals()
    return {
        "signals": signals,
        "tipping_points": [s for s in signals if s["is_tipping_point"]],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
