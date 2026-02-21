"""
거래 사이클 자동 스케줄러
asyncio 기반 백그라운드 태스크 — 외부 의존성 없음
"""

import asyncio
import logging
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None


async def _trading_loop(interval_seconds: int) -> None:
    """주기적으로 거래 사이클 실행"""
    from app.db.base import get_db
    from app.engines.trading_cycle import run_all_pm_cycles, record_nav

    logger.info(f"Scheduler started — interval={interval_seconds}s")
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            db = next(get_db())
            try:
                results = await run_all_pm_cycles(db)
                nav = record_nav(db)
                executed = sum(1 for r in results if r.get("trade_executed"))
                logger.info(
                    f"[{datetime.now().strftime('%H:%M:%S')}] Cycle done — "
                    f"{len(results)} PMs, {executed} trades, NAV={nav['nav']:,.0f}"
                )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Scheduler cycle error: {e}")


def start_scheduler(interval_seconds: int | None = None) -> None:
    """스케줄러 시작 (lifespan에서 호출)"""
    global _scheduler_task
    if interval_seconds is None:
        interval_seconds = settings.scheduler_interval
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            _scheduler_task = loop.create_task(_trading_loop(interval_seconds))
        else:
            _scheduler_task = None
    except RuntimeError:
        _scheduler_task = None
    logger.info(f"Trading scheduler registered (every {interval_seconds}s)")


def stop_scheduler() -> None:
    """스케줄러 중지"""
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("Trading scheduler stopped")
    _scheduler_task = None


def get_status() -> dict:
    """스케줄러 상태 반환"""
    if _scheduler_task is None:
        return {"running": False, "status": "not_started"}
    if _scheduler_task.done():
        exc = _scheduler_task.exception() if not _scheduler_task.cancelled() else None
        return {"running": False, "status": "stopped", "error": str(exc) if exc else None}
    return {"running": True, "status": "active"}
