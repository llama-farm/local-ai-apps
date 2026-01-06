"""
Phase 2 Tests: Anomaly Detection

Tests for the anomaly detection API and service.
Note: Some tests require LlamaFarm Universal Runtime to be running.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from src.app import app
from src.models.schemas import BiometricReading, MotionReading
from src.services.anomaly_service import AnomalyService


client = TestClient(app)


class TestAnomalyAPI:
    """Tests for anomaly detection API endpoints."""

    def test_health_endpoint(self):
        """Verify health endpoint returns ok."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_anomaly_train_endpoint_exists(self):
        """Verify train endpoint exists and validates input."""
        # Should fail with missing data_type but endpoint should exist
        response = client.post("/api/anomaly/train", json={})
        # 422 means validation error (endpoint exists but bad input)
        assert response.status_code == 422

    def test_anomaly_detect_endpoint_exists(self):
        """Verify detect endpoint exists."""
        response = client.post("/api/anomaly/detect", json={
            "data_type": "biometric"
        })
        # Should fail because no biometric data, but endpoint exists
        assert response.status_code in [400, 422, 500]

    def test_biometric_status_endpoint(self):
        """Verify biometric status endpoint works."""
        response = client.get("/api/anomaly/status/biometric")
        assert response.status_code == 200
        assert "is_trained" in response.json()

    def test_motion_status_endpoint(self):
        """Verify motion status endpoint works."""
        response = client.get("/api/anomaly/status/motion")
        assert response.status_code == 200
        assert "is_trained" in response.json()


class TestAnomalyService:
    """Tests for anomaly service internals."""

    def test_biometric_to_features(self):
        """Verify biometric reading converts to features correctly."""
        service = AnomalyService()
        reading = BiometricReading(
            heart_rate=72,
            systolic_bp=120,
            diastolic_bp=78,
            temperature=98.2,
            activity_level="resting"
        )

        features = service._biometric_to_features(reading)

        assert features["heart_rate"] == 72
        assert features["systolic_bp"] == 120
        assert features["diastolic_bp"] == 78
        assert features["temperature"] == 98.2
        assert features["activity_level"] == "resting"

    def test_motion_to_features(self):
        """Verify motion reading converts to features correctly."""
        service = AnomalyService()
        reading = MotionReading(
            room="kitchen",
            hour=8,
            activity_duration_minutes=30,
            motion_intensity=0.6
        )

        features = service._motion_to_features(reading)

        assert features["room"] == "kitchen"
        assert features["hour"] == 8
        assert features["activity_duration_minutes"] == 30
        assert features["motion_intensity"] == 0.6

    def test_analyze_heart_rate_normal(self):
        """Verify heart rate analysis for normal values."""
        service = AnomalyService()
        assert "normal" in service._analyze_heart_rate(72)
        assert "normal" in service._analyze_heart_rate(75)

    def test_analyze_heart_rate_abnormal(self):
        """Verify heart rate analysis for abnormal values."""
        service = AnomalyService()
        assert "high" in service._analyze_heart_rate(110)
        assert "low" in service._analyze_heart_rate(50)

    def test_analyze_blood_pressure_normal(self):
        """Verify blood pressure analysis for normal values."""
        service = AnomalyService()
        assert "normal" in service._analyze_blood_pressure(120, 78)
        assert "normal" in service._analyze_blood_pressure(125, 80)

    def test_analyze_blood_pressure_abnormal(self):
        """Verify blood pressure analysis for abnormal values."""
        service = AnomalyService()
        assert "low" in service._analyze_blood_pressure(85, 55)
        assert "high" in service._analyze_blood_pressure(160, 95)

    def test_analyze_temperature_normal(self):
        """Verify temperature analysis for normal values."""
        service = AnomalyService()
        assert "normal" in service._analyze_temperature(98.2)
        assert "normal" in service._analyze_temperature(98.4)

    def test_analyze_temperature_abnormal(self):
        """Verify temperature analysis for abnormal values."""
        service = AnomalyService()
        assert "low" in service._analyze_temperature(96.0)
        assert "elevated" in service._analyze_temperature(100.5)

    def test_expected_activity_mealtimes(self):
        """Verify expected activity returns kitchen for meal times."""
        service = AnomalyService()
        assert "kitchen" in service._get_expected_activity(7)
        assert "kitchen" in service._get_expected_activity(12)
        assert "kitchen" in service._get_expected_activity(18)

    def test_expected_activity_afternoon(self):
        """Verify expected activity returns living room for afternoon."""
        service = AnomalyService()
        assert "living room" in service._get_expected_activity(14)
        assert "living room" in service._get_expected_activity(15)


class TestBiometricReadingModel:
    """Tests for BiometricReading pydantic model."""

    def test_valid_reading(self):
        """Verify valid biometric reading is accepted."""
        reading = BiometricReading(
            heart_rate=72,
            systolic_bp=120,
            diastolic_bp=78,
            temperature=98.2,
        )
        assert reading.heart_rate == 72

    def test_invalid_heart_rate_low(self):
        """Verify too-low heart rate is rejected."""
        with pytest.raises(ValueError):
            BiometricReading(
                heart_rate=20,  # Below 30 minimum
                systolic_bp=120,
                diastolic_bp=78,
                temperature=98.2,
            )

    def test_invalid_heart_rate_high(self):
        """Verify too-high heart rate is rejected."""
        with pytest.raises(ValueError):
            BiometricReading(
                heart_rate=250,  # Above 200 maximum
                systolic_bp=120,
                diastolic_bp=78,
                temperature=98.2,
            )

    def test_default_activity_level(self):
        """Verify default activity level is 'resting'."""
        reading = BiometricReading(
            heart_rate=72,
            systolic_bp=120,
            diastolic_bp=78,
            temperature=98.2,
        )
        assert reading.activity_level == "resting"


class TestMotionReadingModel:
    """Tests for MotionReading pydantic model."""

    def test_valid_reading(self):
        """Verify valid motion reading is accepted."""
        reading = MotionReading(
            room="kitchen",
            hour=8,
            activity_duration_minutes=30,
            motion_intensity=0.6,
        )
        assert reading.room == "kitchen"

    def test_invalid_hour(self):
        """Verify invalid hour is rejected."""
        with pytest.raises(ValueError):
            MotionReading(
                room="kitchen",
                hour=25,  # Invalid hour
                activity_duration_minutes=30,
                motion_intensity=0.6,
            )

    def test_invalid_intensity(self):
        """Verify invalid intensity is rejected."""
        with pytest.raises(ValueError):
            MotionReading(
                room="kitchen",
                hour=8,
                activity_duration_minutes=30,
                motion_intensity=1.5,  # Above 1.0 max
            )


class TestInteractiveEndpoints:
    """Tests for interactive demo endpoints."""

    def test_interactive_biometric_endpoint_exists(self):
        """Verify interactive biometric endpoint exists."""
        # Will fail if model not trained, but endpoint should exist
        response = client.post("/api/anomaly/interactive/biometric")
        # 500 means model not trained, but endpoint exists
        assert response.status_code in [200, 500]

    def test_interactive_motion_endpoint_exists(self):
        """Verify interactive motion endpoint exists."""
        response = client.post("/api/anomaly/interactive/motion")
        assert response.status_code in [200, 500]


# Integration tests that require LlamaFarm to be running
# These are marked with pytest.mark.integration and can be skipped

@pytest.mark.integration
class TestAnomalyIntegration:
    """Integration tests requiring LlamaFarm Universal Runtime."""

    @pytest.fixture(autouse=True)
    def check_llamafarm(self):
        """Skip if LlamaFarm is not running."""
        import httpx
        try:
            response = httpx.get("http://localhost:11540/health", timeout=2.0)
            if response.status_code != 200:
                pytest.skip("LlamaFarm Universal Runtime not available")
        except Exception:
            pytest.skip("LlamaFarm Universal Runtime not available")

    def test_train_biometric_model(self):
        """Test training biometric anomaly model."""
        response = client.post("/api/anomaly/train", json={
            "model_name": "test_biometric",
            "data_type": "biometric"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "fitted"
        assert data["samples_fitted"] >= 200

    def test_detect_normal_biometric(self):
        """Test detecting normal biometric reading."""
        # First train
        client.post("/api/anomaly/train", json={
            "model_name": "biometric_anomaly",
            "data_type": "biometric"
        })

        # Then detect
        response = client.post("/api/anomaly/detect/biometric", json={
            "heart_rate": 72,
            "systolic_bp": 120,
            "diastolic_bp": 78,
            "temperature": 98.2,
            "activity_level": "resting"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["is_anomaly"] == False

    def test_detect_abnormal_biometric(self):
        """Test detecting abnormal biometric reading."""
        # Train first
        client.post("/api/anomaly/train", json={
            "model_name": "biometric_anomaly",
            "data_type": "biometric"
        })

        # Detect abnormal reading
        response = client.post("/api/anomaly/detect/biometric", json={
            "heart_rate": 150,  # Very high
            "systolic_bp": 80,  # Very low
            "diastolic_bp": 50,  # Very low
            "temperature": 95.0,  # Very low
            "activity_level": "resting"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["is_anomaly"] == True
        assert data["score"] > 0.5
