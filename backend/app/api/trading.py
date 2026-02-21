"""
Trading API: 시그널 실행, NAV 히스토리, 트레이딩 사이클 실행
"""

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.nav_history import NAVHistory
from app.models.signal import Signal
from app.models.pm import PM
from app.models.position import Position
from app.models.trade import Trade

router = APIRouter(prefix="/api/trading", tags=["trading"])


@router.get("/nav/history")
async def get_nav_history(limit: int = 90, db: Session = Depends(get_db)):
    """NAV 히스토리 반환 (최근 N일)"""
    records = (
        db.query(NAVHistory)
        .order_by(NAVHistory.id.desc())
        .limit(limit)
        .all()
    )
    records.reverse()

    data = []
    for r in records:
        data.append({
            "date": (r.recorded_at.isoformat() + "Z") if r.recorded_at else None,
            "nav": round(r.nav, 2),
            "daily_return": round(r.daily_return * 100, 4),
        })

    # 최신 NAV 기준 수익률 계산
    if data:
        initial = data[0]["nav"]
        for d in data:
            d["cumulative_return"] = round((d["nav"] - initial) / initial * 100, 4) if initial > 0 else 0.0

    return {"history": data, "count": len(data)}


@router.get("/nav/summary")
async def get_nav_summary(db: Session = Depends(get_db)):
    """NAV 요약 통계"""
    import numpy as np

    records = db.query(NAVHistory).order_by(NAVHistory.id.desc()).limit(90).all()
    records.reverse()

    if not records:
        pms = db.query(PM).all()
        nav = sum(pm.current_capital for pm in pms)
        return {"current_nav": nav, "initial_nav": nav, "total_return_pct": 0.0}

    navs = [r.nav for r in records]
    returns = [r.daily_return for r in records if r.daily_return != 0]

    current_nav = navs[-1]
    initial_nav = navs[0]
    total_return = (current_nav - initial_nav) / initial_nav * 100 if initial_nav > 0 else 0.0

    # 샤프 비율
    if returns and np.std(returns) > 0:
        sharpe = float(np.mean(returns) / np.std(returns) * np.sqrt(252))
    else:
        sharpe = 0.0

    # MDD
    peak = navs[0]
    max_dd = 0.0
    for nav in navs:
        if nav > peak:
            peak = nav
        dd = (peak - nav) / peak
        if dd > max_dd:
            max_dd = dd

    return {
        "current_nav": round(current_nav, 2),
        "initial_nav": round(initial_nav, 2),
        "total_return_pct": round(total_return, 4),
        "sharpe_ratio": round(sharpe, 3),
        "max_drawdown_pct": round(max_dd * 100, 3),
        "data_days": len(records),
    }


@router.post("/cycle/run")
async def run_trading_cycle(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """전체 트레이딩 사이클 실행 (백그라운드)"""
    background_tasks.add_task(_run_cycle_task, db)
    return {"status": "started", "message": "Trading cycle initiated"}


async def _run_cycle_task(db: Session):
    """실제 트레이딩 사이클 실행"""
    from app.engines.trading_cycle import run_all_pm_cycles, record_nav
    results = await run_all_pm_cycles(db)
    record_nav(db)
    return results


@router.post("/cycle/run-sync")
async def run_trading_cycle_sync(db: Session = Depends(get_db)):
    """동기식 트레이딩 사이클 실행 (결과 즉시 반환)"""
    from app.engines.trading_cycle import run_all_pm_cycles, record_nav
    results = await run_all_pm_cycles(db)
    nav = record_nav(db)
    return {
        "status": "completed",
        "results": results,
        "nav": nav,
    }


@router.get("/signals/recent")
async def get_recent_signals(limit: int = 50, db: Session = Depends(get_db)):
    """최근 시그널 목록"""
    signals = (
        db.query(Signal)
        .order_by(Signal.id.desc())
        .limit(limit)
        .all()
    )
    return {
        "signals": [
            {
                "id": s.id,
                "pm_id": s.pm_id,
                "symbol": s.symbol,
                "signal_type": s.signal_type,
                "value": round(s.value, 4),
                "metadata": s.metadata_,
                "created_at": (s.created_at.isoformat() + "Z") if s.created_at else None,
            }
            for s in signals
        ]
    }


@router.get("/positions/all")
async def get_all_positions(db: Session = Depends(get_db)):
    """전체 포지션 목록"""
    positions = db.query(Position).all()
    pms = {pm.id: pm for pm in db.query(PM).all()}

    result = []
    for pos in positions:
        pm = pms.get(pos.pm_id)
        result.append({
            "id": pos.id,
            "pm_id": pos.pm_id,
            "pm_name": pm.name if pm else pos.pm_id,
            "pm_emoji": pm.emoji if pm else "🤖",
            "symbol": pos.symbol,
            "quantity": round(pos.quantity, 4),
            "avg_cost": round(pos.avg_cost, 2),
            "market_value": round(pos.quantity * pos.avg_cost, 2),
            "asset_type": pos.asset_type,
        })

    return {"positions": result, "total_count": len(result)}


@router.get("/trades/recent")
async def get_recent_trades(limit: int = 50, db: Session = Depends(get_db)):
    """최근 거래 내역"""
    trades = (
        db.query(Trade)
        .order_by(Trade.id.desc())
        .limit(limit)
        .all()
    )
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
                "conviction_score": round(t.conviction_score, 3),
                "reasoning": t.reasoning,
                "executed_at": (t.executed_at.isoformat() + "Z") if t.executed_at else None,
            }
            for t in trades
        ]
    }


@router.post("/backtest")
async def run_backtest(payload: dict, db: Session = Depends(get_db)):
    """백테스트 실행: 특정 종목/전략의 과거 성과 시뮬레이션"""
    import numpy as np
    from app.engines.market_data import get_price_history
    from app.engines.quant import QuantEngine

    symbol = payload.get("symbol", "SPY")
    strategy = payload.get("strategy", "rsi_momentum")
    period = payload.get("days", 90)

    prices = get_price_history(symbol, days=period + 30)
    if prices is None or len(prices) < 30:
        return {"error": "insufficient_data"}

    prices = prices.iloc[-(period + 20):]
    qe = QuantEngine()

    # 전략별 포지션 시뮬레이션
    portfolio_value = 100.0
    benchmark_value = 100.0
    initial_price = float(prices.iloc[0])

    chart_data = []
    trades = 0
    wins = 0
    position = 0.0  # 0=현금, 1=롱

    for i in range(20, len(prices)):
        window = prices.iloc[:i]
        sig = qe.generate_signals(window, symbol)
        score = sig["composite_score"]
        rsi = sig["rsi"]

        # 전략별 진입/청산 로직
        if strategy == "buy_hold":
            new_pos = 1.0
        elif strategy == "rsi_momentum":
            if score > 0.2 or rsi < 38:
                new_pos = 1.0
            elif score < -0.2 or rsi > 62:
                new_pos = 0.0
            else:
                new_pos = position
        elif strategy == "mean_reversion":
            if rsi < 32:
                new_pos = 1.0
            elif rsi > 68:
                new_pos = 0.0
            else:
                new_pos = position
        elif strategy == "trend_follow":
            new_pos = 1.0 if score > 0.15 else (0.0 if score < -0.15 else position)
        else:  # quant_king
            new_pos = 1.0 if score > 0.1 else (0.0 if score < -0.1 else position)

        # 수익률 계산
        day_return = float(prices.iloc[i]) / float(prices.iloc[i - 1]) - 1
        bench_return = day_return
        strat_return = day_return if position == 1.0 else 0.0

        if new_pos != position:
            trades += 1
            if new_pos == 0.0 and strat_return > 0:
                wins += 1
            cost = 0.001  # 0.1% 거래비용
            portfolio_value *= (1 + strat_return - cost)
        else:
            portfolio_value *= (1 + strat_return)

        benchmark_value *= (1 + bench_return)
        position = new_pos

        if i % 3 == 0:
            from datetime import timedelta
            idx = prices.index[i]
            date_str = idx.strftime("%b %d") if hasattr(idx, "strftime") else str(idx)[:10]
            chart_data.append({
                "date": date_str,
                "strategy": round(portfolio_value, 3),
                "benchmark": round(benchmark_value, 3),
            })

    total_return = portfolio_value - 100.0
    bench_return_total = benchmark_value - 100.0

    # 수익률 시계열로 Sharpe/Sortino/MDD 계산
    if len(chart_data) > 1:
        strat_vals = [d["strategy"] for d in chart_data]
        daily_rets = np.array([(strat_vals[i] - strat_vals[i-1]) / strat_vals[i-1] for i in range(1, len(strat_vals))])
        sharpe = float(np.mean(daily_rets) / np.std(daily_rets) * np.sqrt(252)) if np.std(daily_rets) > 0 else 0.0
        neg = daily_rets[daily_rets < 0]
        sortino = float(np.mean(daily_rets) / np.std(neg) * np.sqrt(252)) if len(neg) > 0 and np.std(neg) > 0 else 0.0
        peak = strat_vals[0]
        mdd = 0.0
        for v in strat_vals:
            if v > peak:
                peak = v
            dd = (peak - v) / peak
            if dd > mdd:
                mdd = dd
        calmar = (total_return / 100) / mdd if mdd > 0 else 0.0
    else:
        sharpe = sortino = mdd = calmar = 0.0

    win_rate = (wins / trades * 100) if trades > 0 else 0.0

    return {
        "symbol": symbol,
        "strategy": strategy,
        "total_return_pct": round(total_return, 3),
        "benchmark_return_pct": round(bench_return_total, 3),
        "sharpe_ratio": round(sharpe, 3),
        "sortino_ratio": round(sortino, 3),
        "max_drawdown_pct": round(mdd * 100, 3),
        "calmar_ratio": round(calmar, 3),
        "win_rate_pct": round(win_rate, 1),
        "total_trades": trades,
        "chart_data": chart_data,
    }


@router.get("/risk/concentration")
async def get_risk_concentration(db: Session = Depends(get_db)):
    """포지션 집중도 분석 (RiskRadar용)"""
    positions = db.query(Position).all()
    pms = db.query(PM).filter(PM.is_active == True).all()
    total_nav = sum(pm.current_capital for pm in pms)

    # 심볼별 집중도
    symbol_exposure: dict[str, float] = {}
    for pos in positions:
        val = pos.quantity * pos.avg_cost
        symbol_exposure[pos.symbol] = symbol_exposure.get(pos.symbol, 0.0) + val

    # PM별 포지션 집중도
    pm_exposure: dict[str, float] = {}
    for pos in positions:
        val = pos.quantity * pos.avg_cost
        pm_exposure[pos.pm_id] = pm_exposure.get(pos.pm_id, 0.0) + val

    top_symbols = sorted(symbol_exposure.items(), key=lambda x: x[1], reverse=True)[:5]
    max_single_pct = (top_symbols[0][1] / total_nav * 100) if top_symbols and total_nav > 0 else 0

    # RiskRadar용 데이터 (0-100 스케일)
    import numpy as np
    returns_variance = 0.0  # 실제 NAV 데이터 있으면 계산
    nav_records = db.query(NAVHistory).order_by(NAVHistory.id.desc()).limit(20).all()
    if len(nav_records) > 1:
        rets = [r.daily_return for r in nav_records if r.daily_return != 0]
        if rets:
            returns_variance = float(np.std(rets) * np.sqrt(252) * 100)

    return {
        "total_nav": round(total_nav, 2),
        "symbol_exposure": [{"symbol": s, "value": round(v, 2), "pct": round(v / total_nav * 100, 2) if total_nav > 0 else 0} for s, v in top_symbols],
        "pm_exposure": [{"pm_id": pid, "value": round(v, 2), "pct": round(v / total_nav * 100, 2) if total_nav > 0 else 0} for pid, v in sorted(pm_exposure.items(), key=lambda x: x[1], reverse=True)[:5]],
        "max_single_position_pct": round(max_single_pct, 2),
        "radar": {
            "concentration": min(max_single_pct * 5, 100),  # 20% max → 100
            "volatility": min(returns_variance * 5, 100),
            "drawdown": 0.0,  # NAV 데이터로 계산
            "correlation": 30.0,  # placeholder
            "leverage": 0.0,  # paper trading이라 0
            "liquidity": 85.0,  # 대부분 유동성 있는 주식
        },
    }
