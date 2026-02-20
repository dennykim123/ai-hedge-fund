import numpy as np

from app.engines.performance import PerformanceEngine


def make_returns(n=252, annualized_return=0.10):
    daily = annualized_return / 252
    rng = np.random.default_rng(42)
    noise = rng.normal(0, 0.005, n)
    return list(np.full(n, daily) + noise)


def test_sharpe_ratio_positive_returns():
    engine = PerformanceEngine()
    returns = make_returns(252, 0.30)
    sharpe = engine.sharpe_ratio(returns)
    assert sharpe > 0


def test_max_drawdown():
    engine = PerformanceEngine()
    returns = [0.01] * 50 + [-0.02] * 50 + [0.01] * 100
    mdd = engine.max_drawdown(returns)
    assert mdd < -0.3


def test_sortino_ratio():
    engine = PerformanceEngine()
    returns = make_returns(252, 0.12)
    sortino = engine.sortino_ratio(returns)
    assert isinstance(sortino, float)


def test_metrics_bundle():
    engine = PerformanceEngine()
    fund_returns = make_returns(252, 0.15)
    bench_returns = make_returns(252, 0.10)
    metrics = engine.compute_all(fund_returns, bench_returns)
    assert "sharpe" in metrics
    assert "sortino" in metrics
    assert "mdd" in metrics
    assert "alpha" in metrics
    assert "beta" in metrics
    assert "calmar" in metrics


def test_sharpe_ratio_zero_std_returns_zero():
    # performance.py 27번: r.std()==0 경로를 직접 패치로 커버
    from unittest.mock import patch, MagicMock
    engine = PerformanceEngine()
    returns = [0.001] * 10

    mock_arr = MagicMock()
    mock_arr.__sub__ = MagicMock(return_value=mock_arr)
    mock_arr.std.return_value = 0.0
    mock_arr.mean.return_value = 0.0

    with patch("app.engines.performance.np.array", return_value=mock_arr):
        result = engine.sharpe_ratio(returns)
    assert result == 0.0
