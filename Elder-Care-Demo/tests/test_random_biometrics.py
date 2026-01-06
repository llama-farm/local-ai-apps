"""
Tests for Random Biometric Generation - Phase 1

Tests that randomized preset values:
1. Normal values fall within healthy ranges
2. Abnormal values are outside healthy ranges
3. Multiple calls produce different values
4. API endpoint returns valid BiometricReading
"""

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.services.anomaly_service import (
    generate_random_biometrics,
    NORMAL_RANGES,
    ABNORMAL_RANGES,
)


client = TestClient(app)


# ==================== Unit Tests for Generator Function ====================


class TestNormalBiometricRanges:
    """Test that normal biometrics fall within healthy ranges."""

    def test_normal_heart_rate_in_range(self):
        """Generated normal HR should be between 60-90 BPM."""
        for _ in range(10):
            reading = generate_random_biometrics(is_normal=True)
            assert 60 <= reading.heart_rate <= 90, f"HR {reading.heart_rate} out of normal range"

    def test_normal_systolic_bp_in_range(self):
        """Generated normal systolic BP should be between 110-140 mmHg."""
        for _ in range(10):
            reading = generate_random_biometrics(is_normal=True)
            assert 110 <= reading.systolic_bp <= 140, f"SysBP {reading.systolic_bp} out of normal range"

    def test_normal_diastolic_bp_in_range(self):
        """Generated normal diastolic BP should be between 70-90 mmHg."""
        for _ in range(10):
            reading = generate_random_biometrics(is_normal=True)
            assert 70 <= reading.diastolic_bp <= 90, f"DiaBP {reading.diastolic_bp} out of normal range"

    def test_normal_temperature_in_range(self):
        """Generated normal temp should be between 97.5-98.8 F."""
        for _ in range(10):
            reading = generate_random_biometrics(is_normal=True)
            assert 97.5 <= reading.temperature <= 98.8, f"Temp {reading.temperature} out of normal range"


class TestAbnormalBiometricRanges:
    """Test that abnormal biometrics are outside healthy ranges."""

    def test_abnormal_heart_rate_out_of_range(self):
        """Generated abnormal HR should be <55 or >100 BPM."""
        for _ in range(10):
            reading = generate_random_biometrics(is_normal=False)
            assert reading.heart_rate < 55 or reading.heart_rate > 100, \
                f"HR {reading.heart_rate} is in normal range (should be abnormal)"

    def test_abnormal_systolic_bp_out_of_range(self):
        """Generated abnormal systolic BP should be <95 or >150 mmHg."""
        for _ in range(10):
            reading = generate_random_biometrics(is_normal=False)
            assert reading.systolic_bp < 95 or reading.systolic_bp > 150, \
                f"SysBP {reading.systolic_bp} is in normal range (should be abnormal)"

    def test_abnormal_diastolic_bp_out_of_range(self):
        """Generated abnormal diastolic BP should be <55 or >95 mmHg."""
        for _ in range(10):
            reading = generate_random_biometrics(is_normal=False)
            assert reading.diastolic_bp < 55 or reading.diastolic_bp > 95, \
                f"DiaBP {reading.diastolic_bp} is in normal range (should be abnormal)"

    def test_abnormal_temperature_out_of_range(self):
        """Generated abnormal temp should be <96.5 or >99.5 F."""
        for _ in range(10):
            reading = generate_random_biometrics(is_normal=False)
            assert reading.temperature < 96.5 or reading.temperature > 99.5, \
                f"Temp {reading.temperature} is in normal range (should be abnormal)"


class TestRandomnessVariation:
    """Test that values vary on each call."""

    def test_normal_values_vary_each_call(self):
        """Multiple calls should produce different values."""
        readings = [generate_random_biometrics(is_normal=True) for _ in range(5)]
        heart_rates = [r.heart_rate for r in readings]
        # At least some values should be different
        assert len(set(heart_rates)) > 1, "Heart rates should vary between calls"

    def test_abnormal_values_vary_each_call(self):
        """Multiple abnormal calls should produce different values."""
        readings = [generate_random_biometrics(is_normal=False) for _ in range(5)]
        heart_rates = [r.heart_rate for r in readings]
        assert len(set(heart_rates)) > 1, "Abnormal heart rates should vary between calls"

    def test_all_fields_vary(self):
        """All biometric fields should vary between calls."""
        readings = [generate_random_biometrics(is_normal=True) for _ in range(10)]

        heart_rates = set(r.heart_rate for r in readings)
        systolic_bps = set(r.systolic_bp for r in readings)
        diastolic_bps = set(r.diastolic_bp for r in readings)
        temperatures = set(r.temperature for r in readings)

        assert len(heart_rates) > 1, "Heart rates should vary"
        assert len(systolic_bps) > 1, "Systolic BPs should vary"
        assert len(diastolic_bps) > 1, "Diastolic BPs should vary"
        assert len(temperatures) > 1, "Temperatures should vary"


# ==================== API Endpoint Tests ====================


class TestRandomBiometricEndpoint:
    """Test the random biometric API endpoint."""

    def test_random_normal_endpoint_returns_valid_reading(self):
        """GET /api/anomaly/random/biometric?type=normal returns valid reading."""
        response = client.get("/api/anomaly/random/biometric?type=normal")
        assert response.status_code == 200

        data = response.json()
        assert "heart_rate" in data
        assert "systolic_bp" in data
        assert "diastolic_bp" in data
        assert "temperature" in data
        assert "activity_level" in data

    def test_random_abnormal_endpoint_returns_valid_reading(self):
        """GET /api/anomaly/random/biometric?type=abnormal returns valid reading."""
        response = client.get("/api/anomaly/random/biometric?type=abnormal")
        assert response.status_code == 200

        data = response.json()
        assert "heart_rate" in data
        assert "systolic_bp" in data
        assert "diastolic_bp" in data
        assert "temperature" in data

    def test_random_endpoint_normal_values_in_range(self):
        """Normal endpoint values should be in healthy ranges."""
        response = client.get("/api/anomaly/random/biometric?type=normal")
        data = response.json()

        assert 60 <= data["heart_rate"] <= 90
        assert 110 <= data["systolic_bp"] <= 140
        assert 70 <= data["diastolic_bp"] <= 90
        assert 97.5 <= data["temperature"] <= 98.8

    def test_random_endpoint_abnormal_values_out_of_range(self):
        """Abnormal endpoint values should be outside healthy ranges."""
        response = client.get("/api/anomaly/random/biometric?type=abnormal")
        data = response.json()

        assert data["heart_rate"] < 55 or data["heart_rate"] > 100
        assert data["systolic_bp"] < 95 or data["systolic_bp"] > 150
        assert data["diastolic_bp"] < 55 or data["diastolic_bp"] > 95
        assert data["temperature"] < 96.5 or data["temperature"] > 99.5

    def test_random_endpoint_values_vary_on_multiple_calls(self):
        """Multiple calls should produce different values."""
        readings = []
        for _ in range(5):
            response = client.get("/api/anomaly/random/biometric?type=normal")
            readings.append(response.json())

        heart_rates = [r["heart_rate"] for r in readings]
        assert len(set(heart_rates)) > 1, "API should return different values each time"

    def test_random_endpoint_invalid_type_returns_error(self):
        """Invalid type parameter should return error."""
        response = client.get("/api/anomaly/random/biometric?type=invalid")
        assert response.status_code == 400

    def test_random_endpoint_missing_type_defaults_to_normal(self):
        """Missing type parameter defaults to normal."""
        response = client.get("/api/anomaly/random/biometric")
        assert response.status_code == 200

        data = response.json()
        # Should be in normal ranges
        assert 60 <= data["heart_rate"] <= 90
