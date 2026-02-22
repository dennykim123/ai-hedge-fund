"""
Risk Guard: 실거래 전 위험 관리 체크
- 일일 손실 한도 초과 시 거래 중단
- 연속 손실 횟수 초과 시 거래 일시 중지
- 단일 주문 금액 한도 체크
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.models.pm import PM
from app.models.trade import Trade

logger = logging.getLogger(__name__)


def check_risk(
    pm: PM,
    action: str,
    trade_amount: float,
    db: Session,
) -> tuple[bool, str]:
    """
    거래 전 리스크 체크.
    Returns (allowed: bool, reason: str)
    """
    # 1. 단일 주문 금액 한도
    max_trade = pm.current_capital * settings.position_limit_pct
    if trade_amount > max_trade:
        return False, f"Trade amount ${trade_amount:.2f} exceeds limit ${max_trade:.2f}"

    # 2. 일일 손실 한도 (오늘 실현 손실 합산)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades = (
        db.query(Trade)
        .filter(
            Trade.pm_id == pm.id,
            Trade.executed_at >= today_start,
            Trade.action == "SELL",
        )
        .all()
    )

    daily_pnl = 0.0
    for t in today_trades:
        if "P&L:" in t.reasoning:
            try:
                pnl_str = t.reasoning.split("P&L:")[1].strip().rstrip(")")
                daily_pnl += float(pnl_str.replace("$", "").replace("+", ""))
            except (ValueError, IndexError):
                pass

    max_daily_loss = pm.initial_capital * settings.max_daily_loss_pct
    if daily_pnl < -max_daily_loss:
        msg = f"Daily loss ${daily_pnl:.2f} exceeds limit -${max_daily_loss:.2f}"
        logger.warning("RISK HALT %s: %s", pm.id, msg)
        return False, msg

    # 3. 연속 손실 횟수
    recent_sells = (
        db.query(Trade)
        .filter(Trade.pm_id == pm.id, Trade.action == "SELL")
        .order_by(Trade.executed_at.desc())
        .limit(settings.max_consecutive_losses)
        .all()
    )

    if len(recent_sells) >= settings.max_consecutive_losses:
        all_losses = True
        for t in recent_sells:
            if "P&L:" in t.reasoning:
                try:
                    pnl_str = t.reasoning.split("P&L:")[1].strip().rstrip(")")
                    pnl_val = float(pnl_str.replace("$", "").replace("+", ""))
                    if pnl_val >= 0:
                        all_losses = False
                        break
                except (ValueError, IndexError):
                    all_losses = False
                    break
            else:
                all_losses = False
                break

        if all_losses:
            msg = f"{settings.max_consecutive_losses} consecutive losses — trading paused"
            logger.warning("RISK PAUSE %s: %s", pm.id, msg)
            return False, msg

    return True, "ok"
