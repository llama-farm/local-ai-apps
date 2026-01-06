"""
Unit tests for streaming service
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json

from src.services.streaming_service import StreamingService, get_streaming_service


class TestStreamingService:
    """Tests for StreamingService."""

    def test_init_creates_services(self):
        """Service initializes with default services."""
        service = StreamingService()
        assert service.anomaly_service is not None
        assert service.classifier_service is not None
        assert service.agent_service is not None

    def test_load_scenario_loads_file(self):
        """load_scenario loads the scenario file."""
        service = StreamingService()
        scenario = service.load_scenario()

        assert scenario is not None
        assert "title" in scenario
        assert "events" in scenario
        assert len(scenario["events"]) > 0

    def test_get_scenario_returns_loaded(self):
        """get_scenario returns the loaded scenario."""
        service = StreamingService()
        service.load_scenario()
        scenario = service.get_scenario()

        assert scenario is not None
        assert scenario["title"] == "Margaret's Concerning Afternoon"

    def test_get_scenario_loads_if_not_loaded(self):
        """get_scenario loads scenario if not already loaded."""
        service = StreamingService()
        assert service._scenario is None

        scenario = service.get_scenario()
        assert scenario is not None
        assert service._scenario is not None

    def test_scenario_has_expected_structure(self):
        """Scenario has all expected fields."""
        service = StreamingService()
        scenario = service.load_scenario()

        assert "title" in scenario
        assert "description" in scenario
        assert "total_duration_seconds" in scenario
        assert "events" in scenario

        # Check events
        for event in scenario["events"]:
            assert "time_label" in event
            assert "delay_ms" in event
            assert "type" in event
            assert "data" in event
            assert "narrator" in event

    def test_stop_demo_sets_flag(self):
        """stop_demo sets running flag to False."""
        service = StreamingService()
        service._is_running = True

        service.stop_demo()

        assert service._is_running is False

    def test_is_running_returns_state(self):
        """is_running returns correct state."""
        service = StreamingService()
        assert service.is_running() is False

        service._is_running = True
        assert service.is_running() is True

    @pytest.mark.asyncio
    async def test_process_event_biometric(self):
        """process_event handles biometric events."""
        service = StreamingService()

        # Mock the anomaly service
        mock_result = MagicMock()
        mock_result.is_anomaly = True
        mock_result.score = 0.75
        mock_result.details = {"heart_rate": "elevated"}

        service.anomaly_service.detect_biometric_anomaly = AsyncMock(return_value=mock_result)

        event = {
            "type": "biometric",
            "data": {
                "heart_rate": 110,
                "systolic_bp": 85,
                "diastolic_bp": 52,
                "temperature": 96.8,
                "activity_level": "resting"
            }
        }

        result = await service.process_event(event)

        assert result["processed"] is True
        assert "anomaly_detection" in result
        assert result["anomaly_detection"]["is_anomaly"] is True

    @pytest.mark.asyncio
    async def test_process_event_voice(self):
        """process_event handles voice events."""
        service = StreamingService()

        # Mock the classifier service
        mock_result = MagicMock()
        mock_result.label = "concern"
        mock_result.score = 0.92
        mock_result.all_scores = {"concern": 0.92, "routine": 0.05}

        service.classifier_service.classify = AsyncMock(return_value=mock_result)

        event = {
            "type": "voice",
            "data": {"text": "I feel dizzy"}
        }

        result = await service.process_event(event)

        assert result["processed"] is True
        assert "classification" in result
        assert result["classification"]["label"] == "concern"

    @pytest.mark.asyncio
    async def test_process_event_agent_decision(self):
        """process_event handles agent_decision events."""
        service = StreamingService()

        event = {
            "type": "agent_decision",
            "data": {
                "decision": "escalate",
                "reasoning": "Multiple concerning signals",
                "actions": ["call_emergency_contact"]
            }
        }

        result = await service.process_event(event)

        assert result["processed"] is True
        assert "agent" in result
        assert result["agent"]["decision"] == "escalate"

    @pytest.mark.asyncio
    async def test_process_event_tool_execution(self):
        """process_event handles tool_execution events."""
        service = StreamingService()
        service.agent_service.execute_tool = AsyncMock(return_value="Call placed")

        event = {
            "type": "tool_execution",
            "data": {
                "tool": "call_emergency_contact",
                "arguments": {"reason": "Concern detected"},
                "result": "Calling Sarah..."
            }
        }

        result = await service.process_event(event)

        assert result["processed"] is True
        assert "tool_call" in result

    @pytest.mark.asyncio
    async def test_process_event_handles_errors(self):
        """process_event handles errors gracefully."""
        service = StreamingService()
        service.anomaly_service.detect_biometric_anomaly = AsyncMock(
            side_effect=Exception("Service error")
        )

        event = {
            "type": "biometric",
            "data": {"heart_rate": 110},
            "expected_anomaly": True
        }

        result = await service.process_event(event)

        assert result["processed"] is True
        assert "error" in result
        assert result["fallback"] is True
        # Should include fallback anomaly detection
        assert "anomaly_detection" in result

    @pytest.mark.asyncio
    async def test_stream_demo_emits_events(self):
        """stream_demo yields SSE formatted events."""
        service = StreamingService()
        service.load_scenario()

        # Mock all services to avoid real calls
        mock_anomaly = MagicMock()
        mock_anomaly.is_anomaly = False
        mock_anomaly.score = 0.3
        mock_anomaly.details = {}
        service.anomaly_service.detect_biometric_anomaly = AsyncMock(return_value=mock_anomaly)
        service.anomaly_service.detect_motion_anomaly = AsyncMock(return_value=mock_anomaly)

        mock_class = MagicMock()
        mock_class.label = "routine"
        mock_class.score = 0.9
        mock_class.all_scores = {}
        service.classifier_service.classify = AsyncMock(return_value=mock_class)

        service.agent_service.execute_tool = AsyncMock(return_value="Done")

        events = []
        async for event in service.stream_demo(speed_multiplier=100):  # Very fast for test
            events.append(event)
            # Stop after first few events
            if len(events) >= 3:
                service.stop_demo()

        assert len(events) >= 2
        # First event should be demo_start
        assert "event: demo_start" in events[0]

    def test_format_sse(self):
        """_format_sse creates proper SSE format."""
        service = StreamingService()
        result = service._format_sse("test_event", {"key": "value"})

        assert "event: test_event" in result
        assert 'data: {"key": "value"}' in result
        assert result.endswith("\n\n")


class TestGetStreamingService:
    """Tests for get_streaming_service singleton."""

    def test_returns_singleton(self):
        """get_streaming_service returns same instance."""
        # Reset the singleton
        import src.services.streaming_service as module
        module._streaming_service = None

        service1 = get_streaming_service()
        service2 = get_streaming_service()

        assert service1 is service2

    def test_creates_if_none(self):
        """get_streaming_service creates instance if none exists."""
        import src.services.streaming_service as module
        module._streaming_service = None

        service = get_streaming_service()
        assert service is not None
        assert isinstance(service, StreamingService)
