"""
Anomaly Detection Service

Wraps LlamaFarm's Universal Runtime anomaly detection API.
Handles both biometric and motion anomaly detection.
"""

import json
import random
import time
from pathlib import Path
from typing import Any, Optional
import httpx

from src.models.schemas import (
    BiometricReading,
    MotionReading,
    MotionPatternReading,
    AnomalyResult,
    AnomalyTrainResponse,
)
from src.data.training_data_generator import (
    generate_random_motion_pattern,
    MARGARET_ROUTINE,
    get_hour_from_time_window,
)


# ==================== Random Biometric Generation Constants ====================

NORMAL_RANGES = {
    "heart_rate": {"min": 60, "max": 90, "mean": 72, "std": 6},
    "systolic_bp": {"min": 110, "max": 140, "mean": 122, "std": 8},
    "diastolic_bp": {"min": 70, "max": 90, "mean": 78, "std": 5},
    "temperature": {"min": 97.5, "max": 98.8, "mean": 98.1, "std": 0.3},
}

ABNORMAL_RANGES = {
    "heart_rate": {"low": {"min": 45, "max": 54}, "high": {"min": 101, "max": 130}},
    "systolic_bp": {"low": {"min": 80, "max": 94}, "high": {"min": 151, "max": 180}},
    "diastolic_bp": {"low": {"min": 45, "max": 54}, "high": {"min": 96, "max": 110}},
    "temperature": {"low": {"min": 95.5, "max": 96.4}, "high": {"min": 99.6, "max": 102.0}},
}


def _gaussian_in_range(mean: float, std: float, min_val: float, max_val: float) -> float:
    """Generate Gaussian random value clamped to range."""
    value = random.gauss(mean, std)
    return max(min_val, min(max_val, value))


def generate_random_biometrics(is_normal: bool = True) -> BiometricReading:
    """
    Generate randomized biometric readings.

    Args:
        is_normal: If True, generate values within healthy ranges.
                   If False, generate abnormal values outside healthy ranges.

    Returns:
        BiometricReading with randomized values.
    """
    if is_normal:
        # Generate normal values using Gaussian distribution within ranges
        hr = _gaussian_in_range(
            NORMAL_RANGES["heart_rate"]["mean"],
            NORMAL_RANGES["heart_rate"]["std"],
            NORMAL_RANGES["heart_rate"]["min"],
            NORMAL_RANGES["heart_rate"]["max"],
        )
        sys_bp = _gaussian_in_range(
            NORMAL_RANGES["systolic_bp"]["mean"],
            NORMAL_RANGES["systolic_bp"]["std"],
            NORMAL_RANGES["systolic_bp"]["min"],
            NORMAL_RANGES["systolic_bp"]["max"],
        )
        dia_bp = _gaussian_in_range(
            NORMAL_RANGES["diastolic_bp"]["mean"],
            NORMAL_RANGES["diastolic_bp"]["std"],
            NORMAL_RANGES["diastolic_bp"]["min"],
            NORMAL_RANGES["diastolic_bp"]["max"],
        )
        temp = _gaussian_in_range(
            NORMAL_RANGES["temperature"]["mean"],
            NORMAL_RANGES["temperature"]["std"],
            NORMAL_RANGES["temperature"]["min"],
            NORMAL_RANGES["temperature"]["max"],
        )
    else:
        # Generate abnormal values - randomly pick high or low for each
        hr_range = ABNORMAL_RANGES["heart_rate"][random.choice(["low", "high"])]
        hr = random.uniform(hr_range["min"], hr_range["max"])

        sys_range = ABNORMAL_RANGES["systolic_bp"][random.choice(["low", "high"])]
        sys_bp = random.uniform(sys_range["min"], sys_range["max"])

        dia_range = ABNORMAL_RANGES["diastolic_bp"][random.choice(["low", "high"])]
        dia_bp = random.uniform(dia_range["min"], dia_range["max"])

        temp_range = ABNORMAL_RANGES["temperature"][random.choice(["low", "high"])]
        temp = random.uniform(temp_range["min"], temp_range["max"])

    return BiometricReading(
        heart_rate=round(hr, 1),
        systolic_bp=round(sys_bp, 1),
        diastolic_bp=round(dia_bp, 1),
        temperature=round(temp, 1),
        activity_level="resting" if is_normal else random.choice(["resting", "light", "moderate"]),
    )


class AnomalyService:
    """Service for anomaly detection using LlamaFarm Universal Runtime."""

    def __init__(self, runtime_url: str = "http://localhost:11540"):
        self.runtime_url = runtime_url
        self.client = httpx.Client(timeout=60.0)
        self._trained_models: dict[str, bool] = {}

    def _load_training_data(self, data_type: str) -> list[dict[str, Any]]:
        """Load training data from JSON files."""
        data_dir = Path("data/training")

        if data_type == "biometric":
            filepath = data_dir / "biometric_data.json"
        elif data_type == "motion":
            filepath = data_dir / "motion_data.json"
        else:
            raise ValueError(f"Unknown data type: {data_type}")

        with open(filepath) as f:
            return json.load(f)

    def _biometric_to_features(self, reading: BiometricReading) -> dict[str, Any]:
        """Convert biometric reading to feature dict for anomaly detection."""
        return {
            "heart_rate": reading.heart_rate,
            "systolic_bp": reading.systolic_bp,
            "diastolic_bp": reading.diastolic_bp,
            "temperature": reading.temperature,
            "activity_level": reading.activity_level,
        }

    def _motion_to_features(self, reading: MotionReading) -> dict[str, Any]:
        """Convert motion reading to feature dict for anomaly detection."""
        return {
            "room": reading.room,
            "hour": reading.hour,
            "activity_duration_minutes": reading.activity_duration_minutes,
            "motion_intensity": reading.motion_intensity,
        }

    async def train_biometric_model(self, model_name: str = "biometric_anomaly") -> AnomalyTrainResponse:
        """Train anomaly detector on normal biometric data."""
        start_time = time.time()

        # Load training data
        raw_data = self._load_training_data("biometric")

        # Convert to feature format
        training_data = []
        for sample in raw_data:
            training_data.append({
                "heart_rate": sample["heart_rate"],
                "systolic_bp": sample["systolic_bp"],
                "diastolic_bp": sample["diastolic_bp"],
                "temperature": sample["temperature"],
                "activity_level": sample["activity_level"],
            })

        # Define schema for encoding
        schema = {
            "heart_rate": "numeric",
            "systolic_bp": "numeric",
            "diastolic_bp": "numeric",
            "temperature": "numeric",
            "activity_level": "label",
        }

        # Call LlamaFarm API
        # contamination=0.1 means we expect up to 10% of training data could be outliers
        # This makes the model more lenient and reduces false positives
        response = self.client.post(
            f"{self.runtime_url}/v1/anomaly/fit",
            json={
                "model": model_name,
                "backend": "one_class_svm",  # Recommended for biometrics
                "data": training_data,
                "schema": schema,
                "contamination": 0.1,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Training failed: {response.text}")

        result = response.json()
        training_time = (time.time() - start_time) * 1000

        self._trained_models[model_name] = True

        return AnomalyTrainResponse(
            status="fitted",
            model_name=model_name,
            samples_fitted=len(training_data),
            training_time_ms=training_time,
        )

    async def train_motion_model(self, model_name: str = "motion_anomaly") -> AnomalyTrainResponse:
        """Train anomaly detector on normal motion patterns."""
        start_time = time.time()

        # Load training data
        raw_data = self._load_training_data("motion")

        # Convert to feature format
        training_data = []
        for sample in raw_data:
            training_data.append({
                "room": sample["room"],
                "hour": sample["hour"],
                "activity_duration_minutes": sample["activity_duration_minutes"],
                "motion_intensity": sample["motion_intensity"],
            })

        # Define schema for encoding
        schema = {
            "room": "label",
            "hour": "numeric",
            "activity_duration_minutes": "numeric",
            "motion_intensity": "numeric",
        }

        # Call LlamaFarm API - use isolation_forest for temporal patterns
        response = self.client.post(
            f"{self.runtime_url}/v1/anomaly/fit",
            json={
                "model": model_name,
                "backend": "isolation_forest",
                "data": training_data,
                "schema": schema,
                "contamination": 0.1,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Training failed: {response.text}")

        result = response.json()
        training_time = (time.time() - start_time) * 1000

        self._trained_models[model_name] = True

        return AnomalyTrainResponse(
            status="fitted",
            model_name=model_name,
            samples_fitted=len(training_data),
            training_time_ms=training_time,
        )

    async def detect_biometric_anomaly(
        self,
        reading: BiometricReading,
        model_name: str = "biometric_anomaly"
    ) -> AnomalyResult:
        """Detect if a biometric reading is anomalous."""
        features = self._biometric_to_features(reading)

        response = self.client.post(
            f"{self.runtime_url}/v1/anomaly/score",
            json={
                "model": model_name,
                "backend": "one_class_svm",
                "data": [features],
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Detection failed: {response.text}")

        result = response.json()
        data = result.get("data", [{}])[0]

        # Build detailed analysis
        details = {
            "heart_rate_status": self._analyze_heart_rate(reading.heart_rate),
            "blood_pressure_status": self._analyze_blood_pressure(reading.systolic_bp, reading.diastolic_bp),
            "temperature_status": self._analyze_temperature(reading.temperature),
        }

        return AnomalyResult(
            is_anomaly=data.get("is_anomaly", False),
            score=data.get("score", 0.0),
            details=details,
            input_data=features,
        )

    async def detect_motion_anomaly(
        self,
        reading: MotionReading,
        model_name: str = "motion_anomaly"
    ) -> AnomalyResult:
        """Detect if a motion pattern is anomalous."""
        features = self._motion_to_features(reading)

        response = self.client.post(
            f"{self.runtime_url}/v1/anomaly/score",
            json={
                "model": model_name,
                "backend": "isolation_forest",
                "data": [features],
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Detection failed: {response.text}")

        result = response.json()
        data = result.get("data", [{}])[0]

        # Build detailed analysis
        details = {
            "room": reading.room,
            "expected_activity": self._get_expected_activity(reading.hour),
            "intensity_status": "low" if reading.motion_intensity < 0.2 else "normal",
        }

        return AnomalyResult(
            is_anomaly=data.get("is_anomaly", False),
            score=data.get("score", 0.0),
            details=details,
            input_data=features,
        )

    def _analyze_heart_rate(self, hr: float) -> str:
        """Analyze heart rate and return status."""
        if hr < 60:
            return "low (bradycardia)"
        elif hr > 100:
            return "high (tachycardia)"
        elif 68 <= hr <= 78:
            return "normal"
        else:
            return "slightly elevated"

    def _analyze_blood_pressure(self, systolic: float, diastolic: float) -> str:
        """Analyze blood pressure and return status."""
        if systolic < 90 or diastolic < 60:
            return "low (hypotension)"
        elif systolic > 140 or diastolic > 90:
            return "high (hypertension)"
        elif 118 <= systolic <= 128 and 75 <= diastolic <= 82:
            return "normal"
        else:
            return "borderline"

    def _analyze_temperature(self, temp: float) -> str:
        """Analyze temperature and return status."""
        if temp < 97.0:
            return "low (hypothermia risk)"
        elif temp > 99.5:
            return "elevated (possible fever)"
        elif 97.8 <= temp <= 98.6:
            return "normal"
        else:
            return "slightly off"

    def _get_expected_activity(self, hour: int) -> str:
        """Get expected room activity for a given hour."""
        if hour in [7, 8, 12, 18]:
            return "kitchen (meal time)"
        elif hour in [14, 15, 16, 19, 20]:
            return "living room"
        elif hour in [6, 21, 22]:
            return "bedroom"
        else:
            return "varies"

    # ==================== Motion Pattern Detection ====================

    def _load_motion_pattern_data(self) -> list[dict[str, Any]]:
        """Load motion pattern training data."""
        data_dir = Path("data/training")
        filepath = data_dir / "motion_pattern_data.json"
        with open(filepath) as f:
            return json.load(f)

    def _motion_pattern_to_features(self, reading: MotionPatternReading) -> dict[str, Any]:
        """Convert motion pattern reading to feature dict."""
        return {
            "time_window": reading.time_window,
            "current_room": reading.current_room,
            "previous_room": reading.previous_room,
            "time_in_room_minutes": reading.time_in_room_minutes,
            "door_events_count": reading.door_events_count,
            "motion_intensity": reading.motion_intensity,
        }

    async def train_motion_pattern_model(self, model_name: str = "motion_pattern_anomaly") -> AnomalyTrainResponse:
        """Train anomaly detector on normal motion patterns using enhanced data."""
        start_time = time.time()

        # Load enhanced motion pattern training data
        raw_data = self._load_motion_pattern_data()

        # Convert to feature format
        training_data = []
        for sample in raw_data:
            training_data.append({
                "time_window": sample["time_window"],
                "current_room": sample["current_room"],
                "previous_room": sample["previous_room"],
                "time_in_room_minutes": sample["time_in_room_minutes"],
                "door_events_count": sample["door_events_count"],
                "motion_intensity": sample["motion_intensity"],
            })

        # Define schema for encoding
        schema = {
            "time_window": "numeric",
            "current_room": "label",
            "previous_room": "label",
            "time_in_room_minutes": "numeric",
            "door_events_count": "numeric",
            "motion_intensity": "numeric",
        }

        # Call LlamaFarm API - use One-Class SVM for motion patterns
        response = self.client.post(
            f"{self.runtime_url}/v1/anomaly/fit",
            json={
                "model": model_name,
                "backend": "one_class_svm",
                "data": training_data,
                "schema": schema,
                "contamination": 0.05,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Training failed: {response.text}")

        training_time = (time.time() - start_time) * 1000
        self._trained_models[model_name] = True

        return AnomalyTrainResponse(
            status="fitted",
            model_name=model_name,
            samples_fitted=len(training_data),
            training_time_ms=training_time,
        )

    async def detect_motion_pattern_anomaly(
        self,
        reading: MotionPatternReading,
        model_name: str = "motion_pattern_anomaly"
    ) -> AnomalyResult:
        """Detect if a motion pattern is anomalous."""
        features = self._motion_pattern_to_features(reading)

        response = self.client.post(
            f"{self.runtime_url}/v1/anomaly/score",
            json={
                "model": model_name,
                "backend": "one_class_svm",
                "data": [features],
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Detection failed: {response.text}")

        result = response.json()
        data = result.get("data", [{}])[0]

        # Build detailed analysis
        details = self._analyze_motion_pattern(reading)

        return AnomalyResult(
            is_anomaly=data.get("is_anomaly", False),
            score=data.get("score", 0.0),
            details=details,
            input_data=features,
        )

    def _analyze_motion_pattern(self, reading: MotionPatternReading) -> dict[str, str]:
        """Analyze motion pattern and return detailed status."""
        hour, minute = get_hour_from_time_window(reading.time_window)
        time_str = f"{hour:02d}:{minute:02d}"

        # Get expected room for this time window
        expected = MARGARET_ROUTINE.get(reading.time_window, ("bedroom", (0.0, 0.1), 0.0))
        expected_room, expected_intensity, _ = expected

        # Analyze room location
        if reading.current_room == expected_room:
            room_status = "normal (expected location)"
        elif reading.time_window < 12 or reading.time_window >= 44:
            # Night time
            if reading.current_room != "bedroom":
                room_status = f"ABNORMAL: {reading.current_room} at {time_str} (should be bedroom)"
            else:
                room_status = "normal"
        else:
            room_status = f"unexpected: {reading.current_room} at {time_str} (usually {expected_room})"

        # Analyze motion intensity
        if reading.time_window < 12 or reading.time_window >= 44:
            # Night - motion should be very low
            if reading.motion_intensity > 0.3:
                intensity_status = f"HIGH for nighttime ({reading.motion_intensity:.2f})"
            else:
                intensity_status = "normal (low at night)"
        else:
            # Day - check against expected range
            min_int, max_int = expected_intensity
            if reading.motion_intensity < min_int - 0.1:
                intensity_status = f"LOW ({reading.motion_intensity:.2f}, expected {min_int:.1f}-{max_int:.1f})"
            elif reading.motion_intensity > max_int + 0.2:
                intensity_status = f"HIGH ({reading.motion_intensity:.2f}, expected {min_int:.1f}-{max_int:.1f})"
            else:
                intensity_status = "normal"

        # Analyze door events
        if reading.door_events_count > 0:
            if reading.time_window < 12 or reading.time_window >= 44:
                door_status = f"CONCERN: {reading.door_events_count} door events at {time_str}"
            else:
                door_status = f"{reading.door_events_count} events (normal daytime)"
        else:
            door_status = "no door activity"

        # Analyze time in room
        if reading.current_room == "bathroom" and reading.time_in_room_minutes > 30:
            time_status = f"LONG bathroom visit ({reading.time_in_room_minutes} min)"
        elif reading.time_in_room_minutes > 60 and reading.motion_intensity < 0.1:
            time_status = f"CONCERN: {reading.time_in_room_minutes} min with very low motion"
        else:
            time_status = f"{reading.time_in_room_minutes} minutes"

        return {
            "time_window": f"{time_str} (window {reading.time_window})",
            "room_status": room_status,
            "intensity_status": intensity_status,
            "door_status": door_status,
            "time_in_room_status": time_status,
            "expected_location": "yes" if reading.is_expected_location else "no",
        }

    def is_trained(self, model_name: str) -> bool:
        """Check if a model is trained - queries LlamaFarm if not in local cache."""
        # First check local cache
        if self._trained_models.get(model_name, False):
            return True
        # Then check LlamaFarm's saved models registry
        # Endpoint is /v1/anomaly/models (not /list)
        # Format: {"data": [{"filename": "model_backend.joblib", ...}, ...]}
        try:
            response = self.client.get(f"{self.runtime_url}/v1/anomaly/models")
            if response.status_code == 200:
                data = response.json()
                models = data.get("data", [])
                for m in models:
                    if isinstance(m, dict):
                        filename = m.get("filename", "")
                        # Filename format: "{model_name}_{backend}.joblib"
                        # e.g., "biometric_anomaly_one_class_svm.joblib"
                        if filename.startswith(f"{model_name}_"):
                            self._trained_models[model_name] = True
                            return True
        except Exception:
            pass
        return False

    async def save_model(self, model_name: str, backend: str = "one_class_svm") -> bool:
        """Save a trained model to disk."""
        response = self.client.post(
            f"{self.runtime_url}/v1/anomaly/save",
            json={"model": model_name, "backend": backend},
        )
        return response.status_code == 200

    async def load_model(self, model_name: str, backend: str = "one_class_svm") -> bool:
        """Load a model from disk."""
        response = self.client.post(
            f"{self.runtime_url}/v1/anomaly/load",
            json={"model": model_name, "backend": backend},
        )
        if response.status_code == 200:
            self._trained_models[model_name] = True
            return True
        return False


# Singleton instance
anomaly_service = AnomalyService()
