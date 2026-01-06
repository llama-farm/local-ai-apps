"""
API tests for streaming routes
"""

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch, MagicMock

from src.app import app


@pytest.fixture
def async_client():
    """Create async test client."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


class TestStreamingStatusRoute:
    """Tests for GET /api/streaming/status endpoint."""

    @pytest.mark.asyncio
    async def test_status_returns_data(self, async_client):
        """Status endpoint returns status information."""
        async with async_client as client:
            response = await client.get("/api/streaming/status")

        assert response.status_code == 200
        data = response.json()
        assert "is_running" in data
        assert "scenario_loaded" in data

    @pytest.mark.asyncio
    async def test_status_not_running_initially(self, async_client):
        """Status shows not running initially."""
        async with async_client as client:
            response = await client.get("/api/streaming/status")

        data = response.json()
        assert data["is_running"] is False


class TestStreamingScenarioRoute:
    """Tests for GET /api/streaming/scenario endpoint."""

    @pytest.mark.asyncio
    async def test_scenario_returns_data(self, async_client):
        """Scenario endpoint returns scenario details."""
        async with async_client as client:
            response = await client.get("/api/streaming/scenario")

        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert "description" in data
        assert "events" in data
        assert "total_events" in data

    @pytest.mark.asyncio
    async def test_scenario_has_events(self, async_client):
        """Scenario has events array."""
        async with async_client as client:
            response = await client.get("/api/streaming/scenario")

        data = response.json()
        assert len(data["events"]) > 0

    @pytest.mark.asyncio
    async def test_scenario_title_is_margarets(self, async_client):
        """Scenario is Margaret's story."""
        async with async_client as client:
            response = await client.get("/api/streaming/scenario")

        data = response.json()
        assert "Margaret" in data["title"]


class TestStreamingStartRoute:
    """Tests for GET /api/streaming/start endpoint."""

    @pytest.mark.asyncio
    async def test_start_requires_trained_models(self, async_client):
        """Start endpoint returns 503 when models not trained."""
        async with async_client as client:
            response = await client.get("/api/streaming/start?speed=10")

        assert response.status_code == 503
        data = response.json()
        assert "Models not trained" in data["detail"]["error"]

    @pytest.mark.asyncio
    async def test_start_returns_sse(self, async_client):
        """Start endpoint returns SSE content type when models ready."""
        # Mock the model readiness check
        with patch("src.api.routes.streaming.require_models_ready"):
            async with async_client as client:
                response = await client.get("/api/streaming/start?speed=10")

            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_start_accepts_speed_param(self, async_client):
        """Start endpoint accepts speed parameter."""
        # Mock the model readiness check
        with patch("src.api.routes.streaming.require_models_ready"):
            async with async_client as client:
                response = await client.get("/api/streaming/start?speed=2.0")

            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_start_validates_speed_range(self, async_client):
        """Start endpoint validates speed is in range."""
        async with async_client as client:
            # Speed too high
            response = await client.get("/api/streaming/start?speed=100")

        # Should return validation error
        assert response.status_code == 422


class TestStreamingStopRoute:
    """Tests for POST /api/streaming/stop endpoint."""

    @pytest.mark.asyncio
    async def test_stop_returns_success(self, async_client):
        """Stop endpoint returns success."""
        async with async_client as client:
            response = await client.post("/api/streaming/stop")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "stopped"


class TestStreamingResetRoute:
    """Tests for POST /api/streaming/reset endpoint."""

    @pytest.mark.asyncio
    async def test_reset_returns_success(self, async_client):
        """Reset endpoint returns success."""
        async with async_client as client:
            response = await client.post("/api/streaming/reset")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "reset"

    @pytest.mark.asyncio
    async def test_reset_includes_scenario_info(self, async_client):
        """Reset endpoint returns scenario info."""
        async with async_client as client:
            response = await client.post("/api/streaming/reset")

        data = response.json()
        assert "scenario_title" in data
        assert "total_events" in data
