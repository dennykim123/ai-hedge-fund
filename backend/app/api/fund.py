from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import asyncio
import json

from app.db.base import get_db
from app.models.pm import PM
from app.models.position import Position
from app.models.nav_history import NAVHistory
from app.schemas.fund import FundStats, PMSummary

router = APIRouter(prefix="/api/fund", tags=["fund"])


@router.get("/stats", response_model=FundStats)
async def get_fund_stats(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    total_capital = sum(pm.current_capital for pm in pms)
    initial_total = len(pms) * 100_000.0

    # 오늘 return: 마지막 두 NAV 기록 비교
    last_two = db.query(NAVHistory).order_by(NAVHistory.id.desc()).limit(2).all()
    today_return = 0.0
    prior_day_return = 0.0
    if len(last_two) >= 1:
        today_return = last_two[0].daily_return * 100
    if len(last_two) >= 2:
        prior_day_return = last_two[1].daily_return * 100

    itd_return = (
        ((total_capital - initial_total) / initial_total * 100)
        if initial_total > 0
        else 0.0
    )
    total_positions = db.query(Position).count()
    return FundStats(
        nav=round(total_capital, 2),
        today_return=round(today_return, 4),
        prior_day_return=round(prior_day_return, 4),
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
                current_capital=round(pm.current_capital, 2),
                itd_return=round(itd, 2),
            )
        )
    return result


@router.get("/nav/history")
async def get_nav_history(limit: int = 90, db: Session = Depends(get_db)):
    """NAV 히스토리 (차트용)"""
    records = (
        db.query(NAVHistory)
        .order_by(NAVHistory.id.desc())
        .limit(limit)
        .all()
    )
    records.reverse()

    data = []
    initial_nav = None
    for r in records:
        if initial_nav is None:
            initial_nav = r.nav
        cum_return = ((r.nav - initial_nav) / initial_nav * 100) if initial_nav and initial_nav > 0 else 0.0
        data.append({
            "date": r.recorded_at.strftime("%Y-%m-%d") if r.recorded_at else "",
            "nav": round(r.nav, 2),
            "daily_return_pct": round(r.daily_return * 100, 4),
            "cumulative_return_pct": round(cum_return, 4),
        })

    return {"history": data, "count": len(data)}


# --- WebSocket 실시간 ---
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        msg = json.dumps(data)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


ws_manager = ConnectionManager()


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket, db: Session = Depends(get_db)):
    """실시간 NAV + 시그널 업데이트 WebSocket"""
    await ws_manager.connect(websocket)
    try:
        while True:
            # 최신 데이터 전송 (5초마다)
            pms = db.query(PM).filter(PM.is_active == True).all()
            total_nav = sum(pm.current_capital for pm in pms)
            last_nav = db.query(NAVHistory).order_by(NAVHistory.id.desc()).first()
            daily_ret = last_nav.daily_return * 100 if last_nav else 0.0

            await websocket.send_json({
                "type": "nav_update",
                "data": {
                    "nav": round(total_nav, 2),
                    "daily_return_pct": round(daily_ret, 4),
                    "active_pms": len(pms),
                    "timestamp": __import__("datetime").datetime.now().isoformat(),
                },
            })
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


@router.get("/pm-performance")
async def get_pm_performance(db: Session = Depends(get_db)):
    """PM별 성과 순위 (DashboardTab용)"""
    from app.models.trade import Trade
    pms = db.query(PM).filter(PM.is_active == True).all()
    result = []
    for pm in pms:
        itd = (pm.current_capital - 100_000.0) / 100_000.0 * 100
        trade_count = db.query(Trade).filter(Trade.pm_id == pm.id).count()
        result.append({
            "id": pm.id,
            "name": pm.name,
            "emoji": pm.emoji,
            "strategy": pm.strategy,
            "llm_provider": pm.llm_provider,
            "current_capital": round(pm.current_capital, 2),
            "itd_return": round(itd, 2),
            "trade_count": trade_count,
        })
    result.sort(key=lambda x: x["itd_return"], reverse=True)
    return {"pms": result}
