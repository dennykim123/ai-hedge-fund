"""
Crypto API: 암호화폐 전용 엔드포인트
- 실시간 가격 조회 (BTC, ETH, SOL, BNB, XRP, ADA, DOGE)
- Fear & Greed Index
- Satoshi PM 포트폴리오 및 트레이딩
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db

router = APIRouter(prefix="/api/crypto", tags=["crypto"])

CRYPTO_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "ADA-USD", "DOGE-USD"]


@router.get("/prices")
async def get_crypto_prices():
    """전체 암호화폐 현재가 조회"""
    from app.engines.market_data import get_current_price

    prices = []
    for symbol in CRYPTO_SYMBOLS:
        price = get_current_price(symbol)
        # 24h 변동률 (mock — 실제는 히스토리 데이터 필요)
        import random
        random.seed(hash(symbol + __import__("datetime").datetime.now().strftime("%Y%m%d%H")))
        change_24h = round(random.uniform(-8.0, 8.0), 2)

        coin = symbol.replace("-USD", "")
        prices.append({
            "symbol": symbol,
            "coin": coin,
            "price": round(price, 2) if price > 10 else round(price, 4),
            "change_24h": change_24h,
        })

    return {"prices": prices}


@router.get("/fear-greed")
async def get_fear_greed():
    """CNN Fear & Greed Index"""
    from app.engines.social import SocialEngine

    engine = SocialEngine()
    data = engine.fetch_fear_greed_index()
    return data


@router.get("/portfolio")
async def get_crypto_portfolio(db: Session = Depends(get_db)):
    """Satoshi PM의 포트폴리오 조회"""
    from app.models.pm import PM
    from app.models.position import Position
    from app.models.trade import Trade

    pm = db.query(PM).filter(PM.id == "satoshi").first()
    if not pm:
        return {"error": "satoshi_pm_not_found"}

    positions = db.query(Position).filter(Position.pm_id == "satoshi").all()
    trades = (
        db.query(Trade)
        .filter(Trade.pm_id == "satoshi")
        .order_by(Trade.id.desc())
        .limit(50)
        .all()
    )

    return {
        "pm": {
            "id": pm.id,
            "name": pm.name,
            "emoji": pm.emoji,
            "capital": round(pm.current_capital, 2),
            "initial_capital": round(pm.initial_capital, 2),
            "itd_return": round(
                (pm.current_capital - pm.initial_capital) / pm.initial_capital * 100, 2
            ) if pm.initial_capital > 0 else 0.0,
            "is_active": pm.is_active,
        },
        "positions": [
            {
                "symbol": p.symbol,
                "quantity": round(p.quantity, 6),
                "avg_cost": round(p.avg_cost, 2),
                "market_value": round(p.quantity * p.avg_cost, 2),
            }
            for p in positions
        ],
        "trades": [
            {
                "id": t.id,
                "symbol": t.symbol,
                "action": t.action,
                "quantity": round(t.quantity, 6),
                "price": round(t.price, 2),
                "value": round(t.quantity * t.price, 2),
                "conviction_score": round(t.conviction_score, 3),
                "reasoning": t.reasoning,
                "executed_at": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
            }
            for t in trades
        ],
    }


@router.post("/trade")
async def run_satoshi_cycle(db: Session = Depends(get_db)):
    """Satoshi PM 트레이딩 사이클 실행"""
    from app.models.pm import PM
    from app.engines.trading_cycle import run_pm_cycle, record_nav

    pm = db.query(PM).filter(PM.id == "satoshi").first()
    if not pm:
        return {"error": "satoshi_pm_not_found"}

    if not pm.is_active:
        return {"error": "satoshi_pm_inactive", "message": "Satoshi PM is deactivated"}

    result = await run_pm_cycle(pm, db)
    record_nav(db)
    return {"status": "completed", "result": result}
