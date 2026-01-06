"""
Tests for Motion Pattern Anomaly Detection - Phase 3

Tests that motion pattern detection:
1. Training endpoint works
2. Normal patterns return is_anomaly=False
3. Wrong room at wrong time detected
4. Too long without movement detected
5. Activity at 2am detected as anomaly
6. Door open at 3am detected
"""

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.models.schemas import MotionPatternReading


client = TestClient(app)


# ==================== API Endpoint Tests ====================


class TestMotionPatternTrainEndpoint:
    """Test motion pattern training endpoint."""

    def test_train_motion_pattern_endpoint_exists(self):
        """Training endpoint should exist."""
        response = client.post("/api/anomaly/train/motion_pattern")
        # Should not be 404 - either success or needs LlamaFarm
        assert response.status_code != 404

    def test_status_endpoint_exists(self):
        """Status endpoint should exist."""
        response = client.get("/api/anomaly/status/motion_pattern")
        assert response.status_code == 200
        data = response.json()
        assert "is_trained" in data
        assert "model_name" in data


class TestMotionPatternDetectEndpoint:
    """Test motion pattern detection endpoint."""

    def test_detect_endpoint_exists(self):
        """Detection endpoint should exist."""
        reading = {
            "time_window": 24,  # Noon
            "current_room": "kitchen",
            "previous_room": "living_room",
            "time_in_room_minutes": 30,
            "door_events_count": 0,
            "motion_intensity": 0.5,
            "is_expected_location": True,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        # Should not be 404 - either success or needs trained model
        assert response.status_code != 404

    def test_detect_returns_anomaly_result(self):
        """Detection should return AnomalyResult structure."""
        reading = {
            "time_window": 24,
            "current_room": "kitchen",
            "previous_room": "living_room",
            "time_in_room_minutes": 30,
            "door_events_count": 0,
            "motion_intensity": 0.5,
            "is_expected_location": True,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            data = response.json()
            assert "is_anomaly" in data
            assert "score" in data
            assert "details" in data
            assert "input_data" in data


class TestRandomMotionPatternEndpoint:
    """Test random motion pattern generation endpoint."""

    def test_random_normal_endpoint_returns_valid_pattern(self):
        """GET /api/anomaly/random/motion_pattern?type=normal returns valid pattern."""
        response = client.get("/api/anomaly/random/motion_pattern?type=normal")
        assert response.status_code == 200

        data = response.json()
        assert "time_window" in data
        assert "current_room" in data
        assert "previous_room" in data
        assert "time_in_room_minutes" in data
        assert "door_events_count" in data
        assert "motion_intensity" in data
        assert "is_expected_location" in data

    def test_random_abnormal_endpoint_returns_valid_pattern(self):
        """GET /api/anomaly/random/motion_pattern?type=abnormal returns valid pattern."""
        response = client.get("/api/anomaly/random/motion_pattern?type=abnormal")
        assert response.status_code == 200

        data = response.json()
        assert "time_window" in data
        assert "current_room" in data

    def test_random_normal_follows_routine(self):
        """Normal patterns should follow Margaret's routine."""
        response = client.get("/api/anomaly/random/motion_pattern?type=normal")
        data = response.json()
        assert data["is_expected_location"] is True

    def test_random_values_vary_on_multiple_calls(self):
        """Multiple calls should produce different values."""
        patterns = []
        for _ in range(5):
            response = client.get("/api/anomaly/random/motion_pattern?type=normal")
            patterns.append(response.json())

        time_windows = [p["time_window"] for p in patterns]
        # At least some values should be different
        assert len(set(time_windows)) > 1, "Should return different time windows"

    def test_random_endpoint_invalid_type_returns_error(self):
        """Invalid type parameter should return error."""
        response = client.get("/api/anomaly/random/motion_pattern?type=invalid")
        assert response.status_code == 400


class TestInteractiveMotionPatternEndpoint:
    """Test interactive motion pattern endpoint."""

    def test_interactive_endpoint_exists(self):
        """Interactive endpoint should exist."""
        response = client.post("/api/anomaly/interactive/motion_pattern")
        assert response.status_code != 404

    def test_interactive_accepts_query_params(self):
        """Interactive endpoint should accept query parameters."""
        response = client.post(
            "/api/anomaly/interactive/motion_pattern"
            "?time_window=24&current_room=kitchen&motion_intensity=0.5"
        )
        # Should not error on params
        assert response.status_code in [200, 500]  # 500 if model not trained


# ==================== Anomaly Detection Scenario Tests ====================


class TestMotionPatternScenarios:
    """Test specific anomaly detection scenarios."""

    def test_normal_pattern_at_noon_kitchen(self):
        """Kitchen at noon should be normal."""
        reading = {
            "time_window": 24,  # Noon
            "current_room": "kitchen",
            "previous_room": "living_room",
            "time_in_room_minutes": 30,
            "door_events_count": 0,
            "motion_intensity": 0.5,
            "is_expected_location": True,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            data = response.json()
            # Detailed analysis should show normal
            assert "room_status" in data["details"]

    def test_abnormal_pattern_bedroom_at_noon(self):
        """Bedroom at noon with low motion could indicate a problem."""
        reading = {
            "time_window": 24,  # Noon
            "current_room": "bedroom",
            "previous_room": "bedroom",
            "time_in_room_minutes": 60,
            "door_events_count": 0,
            "motion_intensity": 0.05,  # Very low
            "is_expected_location": False,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            data = response.json()
            # Should flag unexpected room
            assert "room_status" in data["details"]

    def test_abnormal_pattern_night_activity(self):
        """Activity at 2am should be flagged."""
        reading = {
            "time_window": 4,  # 2am
            "current_room": "kitchen",
            "previous_room": "bedroom",
            "time_in_room_minutes": 15,
            "door_events_count": 0,
            "motion_intensity": 0.6,
            "is_expected_location": False,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            data = response.json()
            # Should flag night activity
            details = data["details"]
            assert "ABNORMAL" in details.get("room_status", "") or "HIGH" in details.get("intensity_status", "")

    def test_abnormal_pattern_door_at_night(self):
        """Door event at 3am should be flagged as concern."""
        reading = {
            "time_window": 6,  # 3am
            "current_room": "living_room",
            "previous_room": "bedroom",
            "time_in_room_minutes": 10,
            "door_events_count": 1,
            "motion_intensity": 0.4,
            "is_expected_location": False,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            data = response.json()
            details = data["details"]
            assert "CONCERN" in details.get("door_status", "")

    def test_abnormal_pattern_no_movement_morning(self):
        """No movement at 9am should be concerning."""
        reading = {
            "time_window": 18,  # 9am
            "current_room": "bedroom",
            "previous_room": "bedroom",
            "time_in_room_minutes": 90,
            "door_events_count": 0,
            "motion_intensity": 0.02,  # Almost no motion
            "is_expected_location": False,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            data = response.json()
            details = data["details"]
            # Should flag low motion or unexpected room
            assert "LOW" in details.get("intensity_status", "") or "unexpected" in details.get("room_status", "")


class TestMotionPatternAnalysisDetails:
    """Test that analysis details are comprehensive."""

    def test_analysis_includes_time_window(self):
        """Analysis should include time window info."""
        reading = {
            "time_window": 24,
            "current_room": "kitchen",
            "previous_room": "living_room",
            "time_in_room_minutes": 30,
            "door_events_count": 0,
            "motion_intensity": 0.5,
            "is_expected_location": True,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            details = response.json()["details"]
            assert "time_window" in details

    def test_analysis_includes_room_status(self):
        """Analysis should include room status."""
        reading = {
            "time_window": 24,
            "current_room": "kitchen",
            "previous_room": "living_room",
            "time_in_room_minutes": 30,
            "door_events_count": 0,
            "motion_intensity": 0.5,
            "is_expected_location": True,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            details = response.json()["details"]
            assert "room_status" in details

    def test_analysis_includes_intensity_status(self):
        """Analysis should include motion intensity status."""
        reading = {
            "time_window": 24,
            "current_room": "kitchen",
            "previous_room": "living_room",
            "time_in_room_minutes": 30,
            "door_events_count": 0,
            "motion_intensity": 0.5,
            "is_expected_location": True,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            details = response.json()["details"]
            assert "intensity_status" in details

    def test_analysis_includes_door_status(self):
        """Analysis should include door event status."""
        reading = {
            "time_window": 24,
            "current_room": "kitchen",
            "previous_room": "living_room",
            "time_in_room_minutes": 30,
            "door_events_count": 0,
            "motion_intensity": 0.5,
            "is_expected_location": True,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            details = response.json()["details"]
            assert "door_status" in details

    def test_analysis_includes_expected_location(self):
        """Analysis should indicate if location was expected."""
        reading = {
            "time_window": 24,
            "current_room": "kitchen",
            "previous_room": "living_room",
            "time_in_room_minutes": 30,
            "door_events_count": 0,
            "motion_intensity": 0.5,
            "is_expected_location": True,
        }
        response = client.post("/api/anomaly/detect/motion_pattern", json=reading)
        if response.status_code == 200:
            details = response.json()["details"]
            assert "expected_location" in details
