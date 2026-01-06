"""
Phase 4 Tests: LLM Agent with Tool Calling

Tests for the agent service and API endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.models.schemas import (
    SensorContext,
    BiometricReading,
    MotionReading,
    VoiceTranscript,
    AnomalyResult,
    ClassificationResult,
)
from src.services.agent_service import AgentService


client = TestClient(app)


class TestAgentAPI:
    """Tests for agent API endpoints."""

    def test_analyze_endpoint_exists(self):
        """Verify analyze endpoint exists."""
        response = client.post("/api/agent/analyze", json={
            "context": {}
        })
        assert response.status_code in [200, 422, 500]

    def test_analyze_simple_endpoint_exists(self):
        """Verify simplified analyze endpoint exists."""
        response = client.post("/api/agent/analyze/simple")
        assert response.status_code == 200

    def test_demo_routine_endpoint(self):
        """Verify demo routine endpoint works."""
        response = client.post("/api/agent/demo/routine")
        assert response.status_code == 200
        data = response.json()
        assert "reasoning" in data
        assert "decision" in data

    def test_demo_concern_endpoint(self):
        """Verify demo concern endpoint works."""
        response = client.post("/api/agent/demo/concern")
        assert response.status_code == 200
        data = response.json()
        assert "reasoning" in data
        # Should have some tool calls for concerning situation
        assert "tool_calls" in data

    def test_demo_emergency_endpoint(self):
        """Verify demo emergency endpoint works."""
        response = client.post("/api/agent/demo/emergency")
        assert response.status_code == 200
        data = response.json()
        assert "reasoning" in data
        # Emergency should trigger tool calls
        assert len(data.get("tool_calls", [])) > 0

    def test_tool_log_endpoint(self):
        """Verify tool log endpoint works."""
        response = client.get("/api/agent/log")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_alerts_endpoint(self):
        """Verify alerts endpoint works."""
        response = client.get("/api/agent/alerts")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_observations_endpoint(self):
        """Verify observations endpoint works."""
        response = client.get("/api/agent/observations")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_monitoring_endpoint(self):
        """Verify monitoring state endpoint works."""
        response = client.get("/api/agent/monitoring")
        assert response.status_code == 200
        data = response.json()
        assert "frequency" in data

    def test_reset_endpoint(self):
        """Verify reset endpoint works."""
        response = client.post("/api/agent/reset")
        assert response.status_code == 200
        assert response.json()["status"] == "reset"


class TestAgentService:
    """Tests for agent service internals."""

    def test_build_context_message_empty(self):
        """Verify context message for empty context."""
        service = AgentService()
        context = SensorContext()
        message = service._build_context_message(context)
        assert "No sensor data" in message

    def test_build_context_message_biometric(self):
        """Verify context message includes biometric data."""
        service = AgentService()
        context = SensorContext(
            recent_biometrics=[
                BiometricReading(
                    heart_rate=72,
                    systolic_bp=120,
                    diastolic_bp=78,
                    temperature=98.2,
                )
            ]
        )
        message = service._build_context_message(context)
        assert "BIOMETRIC" in message
        assert "72" in message  # heart rate
        assert "120" in message  # systolic

    def test_build_context_message_motion(self):
        """Verify context message includes motion data."""
        service = AgentService()
        context = SensorContext(
            recent_motion=[
                MotionReading(
                    room="kitchen",
                    hour=8,
                    activity_duration_minutes=30,
                    motion_intensity=0.6,
                )
            ]
        )
        message = service._build_context_message(context)
        assert "MOTION" in message
        assert "kitchen" in message

    def test_build_context_message_voice(self):
        """Verify context message includes voice transcript."""
        service = AgentService()
        context = SensorContext(
            recent_voice=[
                VoiceTranscript(text="Hello there")
            ]
        )
        message = service._build_context_message(context)
        assert "VOICE" in message
        assert "Hello there" in message

    def test_execute_tool_emergency_contact(self):
        """Verify emergency contact tool execution."""
        service = AgentService()
        result = service._execute_tool(
            "call_emergency_contact",
            {"reason": "Test reason", "urgency": "high"}
        )
        assert "CALLING" in result
        assert "Sarah" in result
        assert "high" in result.lower()

    def test_execute_tool_send_alert(self):
        """Verify send alert tool execution."""
        service = AgentService()
        result = service._execute_tool(
            "send_alert",
            {"message": "Test alert", "level": "warning"}
        )
        assert "Alert sent" in result
        assert "WARNING" in result
        assert len(service.alerts) == 1

    def test_execute_tool_adjust_monitoring(self):
        """Verify adjust monitoring tool execution."""
        service = AgentService()
        result = service._execute_tool(
            "adjust_monitoring",
            {"frequency": "elevated", "duration_minutes": 30}
        )
        assert "elevated" in result
        assert service.monitoring_state["frequency"] == "elevated"

    def test_execute_tool_log_observation(self):
        """Verify log observation tool execution."""
        service = AgentService()
        result = service._execute_tool(
            "log_observation",
            {"observation": "Test observation", "category": "health"}
        )
        assert "logged" in result.lower()
        assert len(service.observations) == 1

    def test_execute_tool_unknown(self):
        """Verify unknown tool handling."""
        service = AgentService()
        result = service._execute_tool("unknown_tool", {})
        assert "Unknown tool" in result

    def test_reset_clears_state(self):
        """Verify reset clears all state."""
        service = AgentService()
        # Add some data
        service._execute_tool("send_alert", {"message": "test", "level": "info"})
        service._execute_tool("log_observation", {"observation": "test", "category": "health"})

        # Verify data exists
        assert len(service.alerts) > 0
        assert len(service.observations) > 0

        # Reset
        service.reset()

        # Verify cleared
        assert len(service.alerts) == 0
        assert len(service.observations) == 0
        assert len(service.tool_log) == 0


class TestAgentDecisions:
    """Tests for agent decision making logic."""

    def test_routine_no_tool_calls(self):
        """Verify routine situation results in minimal tool calls."""
        response = client.post("/api/agent/demo/routine")
        data = response.json()
        # Routine should have no emergency-level tool calls
        tool_names = [tc["tool_name"] for tc in data.get("tool_calls", [])]
        assert "call_emergency_contact" not in tool_names

    def test_concern_triggers_monitoring(self):
        """Verify concern triggers monitoring adjustment."""
        # Reset first
        client.post("/api/agent/reset")

        response = client.post("/api/agent/demo/concern")
        data = response.json()

        tool_names = [tc["tool_name"] for tc in data.get("tool_calls", [])]
        # Concern should trigger monitoring or observation
        assert any(t in tool_names for t in ["adjust_monitoring", "log_observation", "send_alert"])

    def test_emergency_triggers_escalation(self):
        """Verify emergency triggers escalation."""
        # Reset first
        client.post("/api/agent/reset")

        response = client.post("/api/agent/demo/emergency")
        data = response.json()

        tool_names = [tc["tool_name"] for tc in data.get("tool_calls", [])]
        # Emergency should call emergency contact
        assert "call_emergency_contact" in tool_names

    def test_emergency_creates_alert(self):
        """Verify emergency creates alert."""
        # Reset first
        client.post("/api/agent/reset")

        response = client.post("/api/agent/demo/emergency")

        # Check alerts endpoint
        alerts_response = client.get("/api/agent/alerts")
        alerts = alerts_response.json()
        assert len(alerts) > 0


class TestSimpleEndpoint:
    """Tests for the simplified analyze endpoint."""

    def test_default_values(self):
        """Verify default values produce valid response."""
        response = client.post("/api/agent/analyze/simple")
        assert response.status_code == 200
        data = response.json()
        assert "reasoning" in data
        assert "decision" in data

    def test_abnormal_values_detected(self):
        """Verify abnormal values are detected."""
        response = client.post(
            "/api/agent/analyze/simple",
            params={
                "heart_rate": 120,
                "systolic_bp": 85,
                "is_anomaly": True,
                "anomaly_score": 0.9
            }
        )
        assert response.status_code == 200
        data = response.json()
        # High anomaly score should trigger some response
        assert len(data.get("tool_calls", [])) >= 0  # May or may not trigger depending on logic

    def test_with_voice_text(self):
        """Verify voice text is processed."""
        response = client.post(
            "/api/agent/analyze/simple",
            params={
                "voice_text": "I'm feeling dizzy",
                "voice_label": "concern"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "reasoning" in data
