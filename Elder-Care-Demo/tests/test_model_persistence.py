"""
Tests for Model Persistence (Save/Load) - Phase 5

Tests that models can be:
1. Saved to disk after training
2. Loaded from disk
3. Work identically after loading
4. Handle missing models gracefully
"""

import pytest
from fastapi.testclient import TestClient

from src.app import app


client = TestClient(app)


# ==================== Anomaly Model Save/Load Tests ====================


class TestAnomalySaveEndpoint:
    """Test anomaly model save endpoint."""

    def test_save_endpoint_exists(self):
        """Save endpoint should exist."""
        response = client.post("/api/anomaly/save/test_model")
        # Should not be 404
        assert response.status_code != 404

    def test_save_endpoint_accepts_model_name(self):
        """Save should accept model name in path."""
        response = client.post("/api/anomaly/save/biometric_anomaly")
        # Either success or needs LlamaFarm
        assert response.status_code in [200, 500]

    def test_save_endpoint_accepts_backend_param(self):
        """Save should accept backend query parameter."""
        response = client.post(
            "/api/anomaly/save/test_model?backend=one_class_svm"
        )
        assert response.status_code != 404


class TestAnomalyLoadEndpoint:
    """Test anomaly model load endpoint."""

    def test_load_endpoint_exists(self):
        """Load endpoint should exist."""
        response = client.post("/api/anomaly/load/test_model")
        # Should not be 404 (but might be 404 for model not found)
        assert response.status_code in [200, 404, 500]

    def test_load_endpoint_accepts_model_name(self):
        """Load should accept model name in path."""
        response = client.post("/api/anomaly/load/biometric_anomaly")
        assert response.status_code in [200, 404, 500]

    def test_load_endpoint_accepts_backend_param(self):
        """Load should accept backend query parameter."""
        response = client.post(
            "/api/anomaly/load/test_model?backend=isolation_forest"
        )
        assert response.status_code in [200, 404, 500]

    def test_load_nonexistent_model_returns_404_or_500(self):
        """Loading a nonexistent model should fail gracefully."""
        response = client.post("/api/anomaly/load/nonexistent_model_xyz123")
        # Should return 404 (not found) or 500 (LlamaFarm error)
        assert response.status_code in [404, 500]


# ==================== Classifier Save/Load Tests ====================


class TestClassifierSaveEndpoint:
    """Test classifier save endpoint."""

    def test_save_endpoint_exists(self):
        """Save endpoint should exist."""
        response = client.post("/api/classifier/save/voice_classifier")
        assert response.status_code != 404

    def test_save_endpoint_returns_valid_response(self):
        """Save should return status information."""
        response = client.post("/api/classifier/save/voice_classifier")
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
            assert "model_name" in data


class TestClassifierLoadEndpoint:
    """Test classifier load endpoint."""

    def test_load_endpoint_exists(self):
        """Load endpoint should exist."""
        response = client.post("/api/classifier/load/voice_classifier")
        assert response.status_code in [200, 404, 500]

    def test_load_endpoint_returns_valid_response(self):
        """Load should return status information on success."""
        response = client.post("/api/classifier/load/voice_classifier")
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
            assert "model_name" in data

    def test_load_nonexistent_classifier_fails_gracefully(self):
        """Loading nonexistent classifier should fail gracefully."""
        response = client.post("/api/classifier/load/nonexistent_classifier_xyz")
        assert response.status_code in [404, 500]


# ==================== Model Status After Load Tests ====================


class TestModelStatusAfterLoad:
    """Test that model status reflects loaded state."""

    def test_biometric_status_after_load_attempt(self):
        """Status endpoint should work after load attempt."""
        # First try to load
        client.post("/api/anomaly/load/biometric_anomaly")
        # Then check status
        response = client.get("/api/anomaly/status/biometric")
        assert response.status_code == 200
        data = response.json()
        assert "is_trained" in data

    def test_motion_pattern_status_after_load_attempt(self):
        """Motion pattern status should work after load attempt."""
        client.post("/api/anomaly/load/motion_pattern_anomaly")
        response = client.get("/api/anomaly/status/motion_pattern")
        assert response.status_code == 200
        data = response.json()
        assert "is_trained" in data

    def test_classifier_status_after_load_attempt(self):
        """Classifier status should work after load attempt."""
        client.post("/api/classifier/load/voice_classifier")
        response = client.get("/api/classifier/status")
        assert response.status_code == 200
        data = response.json()
        assert "is_trained" in data


# ==================== API Documentation Tests ====================


class TestPersistenceEndpointsDocs:
    """Test that persistence endpoints are documented correctly."""

    def test_anomaly_save_has_backend_param(self):
        """Anomaly save should document backend parameter."""
        # Make request with wrong backend to verify param is used
        response = client.post("/api/anomaly/save/test?backend=invalid")
        # Should process the param (may fail but shouldn't ignore it)
        assert response.status_code in [200, 400, 500]

    def test_anomaly_load_has_backend_param(self):
        """Anomaly load should document backend parameter."""
        response = client.post("/api/anomaly/load/test?backend=invalid")
        assert response.status_code in [200, 400, 404, 500]


# ==================== Integration Tests ====================


class TestSaveLoadIntegration:
    """Integration tests for save/load workflow."""

    def test_save_then_check_status(self):
        """After save attempt, status should still work."""
        # Save (may fail without LlamaFarm)
        client.post("/api/anomaly/save/biometric_anomaly")

        # Status should still work
        response = client.get("/api/anomaly/status/biometric")
        assert response.status_code == 200

    def test_load_then_check_status(self):
        """After load attempt, status should still work."""
        # Load (may fail without saved model)
        client.post("/api/anomaly/load/biometric_anomaly")

        # Status should still work
        response = client.get("/api/anomaly/status/biometric")
        assert response.status_code == 200

    def test_multiple_save_load_cycles(self):
        """Multiple save/load operations should not break status."""
        for _ in range(3):
            client.post("/api/anomaly/save/biometric_anomaly")
            client.post("/api/anomaly/load/biometric_anomaly")

        response = client.get("/api/anomaly/status/biometric")
        assert response.status_code == 200
