"""main.py lifespan + fund.py WebSocket + ConnectionManager 테스트"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket

from app.main import app


class TestLifespan:
    def test_lifespan_runs_on_startup(self):
        """TestClient with_() 사용하면 lifespan이 실행됨"""
        with TestClient(app, raise_server_exceptions=True) as client:
            r = client.get("/health")
            assert r.status_code == 200


class TestConnectionManager:
    @pytest.mark.asyncio
    async def test_connect_adds_to_active(self):
        from app.api.fund import ConnectionManager
        mgr = ConnectionManager()
        mock_ws = AsyncMock(spec=WebSocket)

        await mgr.connect(mock_ws)
        assert mock_ws in mgr.active
        mock_ws.accept.assert_called_once()

    def test_disconnect_removes_from_active(self):
        from app.api.fund import ConnectionManager
        mgr = ConnectionManager()
        mock_ws = MagicMock()
        mgr.active.append(mock_ws)

        mgr.disconnect(mock_ws)
        assert mock_ws not in mgr.active

    def test_disconnect_nonexistent_is_noop(self):
        from app.api.fund import ConnectionManager
        mgr = ConnectionManager()
        mock_ws = MagicMock()
        mgr.disconnect(mock_ws)  # 에러 없이 통과

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all(self):
        from app.api.fund import ConnectionManager
        mgr = ConnectionManager()
        ws1 = AsyncMock(spec=WebSocket)
        ws2 = AsyncMock(spec=WebSocket)
        mgr.active = [ws1, ws2]

        await mgr.broadcast({"type": "test", "value": 42})
        ws1.send_text.assert_called_once()
        ws2.send_text.assert_called_once()

    @pytest.mark.asyncio
    async def test_broadcast_removes_dead_connections(self):
        from app.api.fund import ConnectionManager
        mgr = ConnectionManager()
        ws_good = AsyncMock(spec=WebSocket)
        ws_dead = AsyncMock(spec=WebSocket)
        ws_dead.send_text.side_effect = Exception("Connection closed")
        mgr.active = [ws_good, ws_dead]

        await mgr.broadcast({"type": "test"})
        assert ws_dead not in mgr.active
        assert ws_good in mgr.active


class TestWebSocketLive:
    def test_websocket_connect_and_receive(self):
        """WebSocket 엔드포인트 연결 후 첫 메시지 수신"""
        with TestClient(app) as client:
            with client.websocket_connect("/api/fund/ws/live") as ws:
                data = ws.receive_json()
                assert data["type"] == "nav_update"
                assert "nav" in data["data"]
                assert "daily_return_pct" in data["data"]
                assert "active_pms" in data["data"]
