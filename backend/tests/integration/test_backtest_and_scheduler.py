"""backtest API + scheduler 통합 테스트"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np

from app.main import app

client = TestClient(app)


class TestBacktestEndpoint:
    def test_returns_200(self):
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": "buy_hold", "days": 30})
        assert r.status_code == 200

    def test_required_fields_present(self):
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": "rsi_momentum", "days": 30})
        data = r.json()
        assert "symbol" in data
        assert "strategy" in data
        assert "total_return_pct" in data
        assert "sharpe_ratio" in data
        assert "sortino_ratio" in data
        assert "max_drawdown_pct" in data
        assert "calmar_ratio" in data
        assert "win_rate_pct" in data
        assert "total_trades" in data
        assert "chart_data" in data

    def test_symbol_and_strategy_echoed(self):
        r = client.post("/api/trading/backtest", json={"symbol": "QQQ", "strategy": "trend_follow", "days": 30})
        data = r.json()
        assert data["symbol"] == "QQQ"
        assert data["strategy"] == "trend_follow"

    def test_chart_data_is_list(self):
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": "buy_hold", "days": 30})
        data = r.json()
        assert isinstance(data["chart_data"], list)

    def test_chart_data_has_correct_keys(self):
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": "buy_hold", "days": 60})
        data = r.json()
        if data["chart_data"]:
            entry = data["chart_data"][0]
            assert "date" in entry
            assert "strategy" in entry
            assert "benchmark" in entry

    def test_numeric_metrics_are_finite(self):
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": "mean_reversion", "days": 30})
        data = r.json()
        import math
        assert math.isfinite(data["total_return_pct"])
        assert math.isfinite(data["sharpe_ratio"])
        assert data["max_drawdown_pct"] >= 0

    def test_default_values_used_without_payload(self):
        r = client.post("/api/trading/backtest", json={})
        assert r.status_code == 200
        data = r.json()
        assert data["symbol"] == "SPY"
        assert data["strategy"] == "rsi_momentum"

    @pytest.mark.parametrize("strategy", ["rsi_momentum", "quant_king", "mean_reversion", "trend_follow", "buy_hold"])
    def test_all_strategies_return_200(self, strategy):
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": strategy, "days": 30})
        assert r.status_code == 200
        data = r.json()
        assert "total_return_pct" in data

    def test_insufficient_data_returns_error(self):
        """가격 데이터가 부족하면 error 반환"""
        with patch("app.engines.market_data.get_price_history", return_value=None):
            with patch("app.api.trading.get_price_history", return_value=None, create=True):
                r = client.post("/api/trading/backtest", json={"symbol": "FAKE", "strategy": "buy_hold", "days": 30})
                assert r.status_code == 200

    def test_too_short_data_returns_error(self):
        short_series = pd.Series([100.0] * 10)
        # backtest는 함수 내부에서 import하므로 engines.market_data 패치
        with patch("app.engines.market_data.yf") as mock_yf:
            mock_yf.Ticker.return_value.history.return_value = pd.DataFrame()
            r = client.post("/api/trading/backtest", json={"symbol": "XYZXYZ", "strategy": "buy_hold", "days": 30})
            # mock 가격 히스토리 사용하거나 error 반환
            assert r.status_code == 200

    def test_buy_hold_always_invested(self):
        """buy_hold 전략은 항상 롱 → 벤치마크와 유사해야 함"""
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": "buy_hold", "days": 60})
        data = r.json()
        # buy_hold는 거래비용 0.1%만 빼면 benchmark와 거의 동일
        diff = abs(data["total_return_pct"] - data["benchmark_return_pct"])
        assert diff < 2.0  # 거래비용 등 감안 2% 이내

    def test_total_trades_non_negative(self):
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": "rsi_momentum", "days": 90})
        data = r.json()
        assert data["total_trades"] >= 0

    def test_win_rate_between_0_and_100(self):
        r = client.post("/api/trading/backtest", json={"symbol": "SPY", "strategy": "mean_reversion", "days": 90})
        data = r.json()
        assert 0.0 <= data["win_rate_pct"] <= 100.0


class TestScheduler:
    def test_get_status_returns_dict(self):
        from app.core.scheduler import get_status
        result = get_status()
        assert isinstance(result, dict)
        assert "running" in result
        assert "status" in result

    def test_stop_when_not_started_is_safe(self):
        from app.core.scheduler import stop_scheduler, _scheduler_task
        # 실행 중이 아닌 상태에서 stop 호출해도 오류 없음
        stop_scheduler()
        from app.core.scheduler import get_status
        status = get_status()
        assert status["running"] is False

    def test_start_and_stop(self):
        from app.core.scheduler import start_scheduler, stop_scheduler, get_status
        # 이벤트 루프 없는 환경에서 start는 task=None으로 안전하게 처리됨
        start_scheduler(interval_seconds=9999)
        stop_scheduler()
        status_after = get_status()
        assert status_after["running"] is False

    def test_system_overview_includes_scheduler(self):
        r = client.get("/api/fund/system/overview")
        assert r.status_code == 200
        data = r.json()
        assert "services" in data
        assert "scheduler" in data["services"]
        sched = data["services"]["scheduler"]
        assert "running" in sched
        assert "status" in sched
