"""
Phase 1 Tests: Training Data Generation

Tests verify that training data is properly generated with:
- Sufficient samples for ML training
- Correct data structure
- Realistic value ranges
"""

import json
from pathlib import Path
import pytest
from src.data.training_data_generator import (
    generate_biometric_data,
    generate_motion_data,
    generate_voice_data,
    generate_demo_scenario,
    save_training_data
)


class TestBiometricData:
    """Tests for biometric training data generation."""

    def test_biometric_data_count(self):
        """Verify we generate at least 200 biometric samples."""
        data = generate_biometric_data(250)
        assert len(data) >= 200, f"Expected 200+ samples, got {len(data)}"

    def test_biometric_data_structure(self):
        """Verify biometric data has required fields."""
        data = generate_biometric_data(10)
        required_fields = ["timestamp", "heart_rate", "systolic_bp", "diastolic_bp", "temperature", "activity_level"]

        for sample in data:
            for field in required_fields:
                assert field in sample, f"Missing field: {field}"

    def test_biometric_heart_rate_range(self):
        """Verify heart rate is in normal elderly range (60-90 bpm)."""
        data = generate_biometric_data(100)
        for sample in data:
            assert 60 <= sample["heart_rate"] <= 90, f"Heart rate out of range: {sample['heart_rate']}"

    def test_biometric_blood_pressure_range(self):
        """Verify blood pressure is in normal range."""
        data = generate_biometric_data(100)
        for sample in data:
            assert 110 <= sample["systolic_bp"] <= 140, f"Systolic out of range: {sample['systolic_bp']}"
            assert 70 <= sample["diastolic_bp"] <= 90, f"Diastolic out of range: {sample['diastolic_bp']}"

    def test_biometric_temperature_range(self):
        """Verify temperature is in normal range (97.5-98.8 F)."""
        data = generate_biometric_data(100)
        for sample in data:
            assert 97.5 <= sample["temperature"] <= 98.8, f"Temperature out of range: {sample['temperature']}"


class TestMotionData:
    """Tests for motion/activity training data generation."""

    def test_motion_data_count(self):
        """Verify we generate at least 200 motion samples."""
        data = generate_motion_data(250)
        assert len(data) >= 200, f"Expected 200+ samples, got {len(data)}"

    def test_motion_data_structure(self):
        """Verify motion data has required fields."""
        data = generate_motion_data(10)
        required_fields = ["timestamp", "room", "hour", "activity_duration_minutes", "motion_intensity"]

        for sample in data:
            for field in required_fields:
                assert field in sample, f"Missing field: {field}"

    def test_motion_valid_rooms(self):
        """Verify rooms are from expected set."""
        data = generate_motion_data(100)
        valid_rooms = {"bedroom", "kitchen", "living_room", "bathroom"}

        for sample in data:
            assert sample["room"] in valid_rooms, f"Invalid room: {sample['room']}"

    def test_motion_intensity_range(self):
        """Verify motion intensity is 0-1."""
        data = generate_motion_data(100)
        for sample in data:
            assert 0 <= sample["motion_intensity"] <= 1, f"Intensity out of range: {sample['motion_intensity']}"


class TestVoiceData:
    """Tests for voice transcript training data generation."""

    def test_voice_data_count(self):
        """Verify we have sufficient voice samples."""
        data = generate_voice_data()
        assert len(data) >= 80, f"Expected 80+ voice samples, got {len(data)}"

    def test_voice_data_structure(self):
        """Verify voice data has text and label fields."""
        data = generate_voice_data()

        for sample in data:
            assert "text" in sample, "Missing 'text' field"
            assert "label" in sample, "Missing 'label' field"
            assert isinstance(sample["text"], str) and len(sample["text"]) > 0, "Text must be non-empty string"

    def test_voice_labels_present(self):
        """Verify all expected labels are present."""
        data = generate_voice_data()
        labels = {sample["label"] for sample in data}
        expected_labels = {"routine", "concern", "emergency", "positive"}

        assert labels == expected_labels, f"Expected labels {expected_labels}, got {labels}"

    def test_voice_min_per_label(self):
        """Verify at least 20 samples per label."""
        data = generate_voice_data()
        label_counts = {}

        for sample in data:
            label = sample["label"]
            label_counts[label] = label_counts.get(label, 0) + 1

        for label, count in label_counts.items():
            assert count >= 20, f"Label '{label}' has only {count} samples, need 20+"


class TestDemoScenario:
    """Tests for demo scenario generation."""

    def test_scenario_structure(self):
        """Verify demo scenario has required structure."""
        scenario = generate_demo_scenario()

        assert "title" in scenario
        assert "events" in scenario
        assert len(scenario["events"]) > 0

    def test_scenario_event_structure(self):
        """Verify each event has required fields."""
        scenario = generate_demo_scenario()
        required_fields = ["time_label", "delay_ms", "type", "data"]

        for event in scenario["events"]:
            for field in required_fields:
                assert field in event, f"Event missing field: {field}"

    def test_scenario_has_escalation(self):
        """Verify scenario includes escalation events."""
        scenario = generate_demo_scenario()
        event_types = [e["type"] for e in scenario["events"]]

        assert "agent_decision" in event_types, "Missing agent decision event"
        assert "tool_execution" in event_types, "Missing tool execution event"


class TestSaveTrainingData:
    """Tests for saving training data to files."""

    def test_save_creates_files(self, tmp_path):
        """Verify save_training_data creates all expected files."""
        output_dir = tmp_path / "training"
        stats = save_training_data(str(output_dir))

        expected_files = [
            "biometric_data.json",
            "motion_data.json",
            "voice_data.json",
            "demo_scenario.json"
        ]

        for filename in expected_files:
            filepath = output_dir / filename
            assert filepath.exists(), f"Missing file: {filename}"

    def test_saved_files_are_valid_json(self, tmp_path):
        """Verify saved files are valid JSON."""
        output_dir = tmp_path / "training"
        save_training_data(str(output_dir))

        for filepath in output_dir.glob("*.json"):
            with open(filepath) as f:
                data = json.load(f)  # Should not raise
                assert data is not None

    def test_save_returns_stats(self, tmp_path):
        """Verify save_training_data returns correct statistics."""
        output_dir = tmp_path / "training"
        stats = save_training_data(str(output_dir))

        assert "biometric_samples" in stats
        assert "motion_samples" in stats
        assert "voice_samples" in stats
        assert "voice_labels" in stats
        assert stats["biometric_samples"] >= 200
        assert stats["motion_samples"] >= 200
