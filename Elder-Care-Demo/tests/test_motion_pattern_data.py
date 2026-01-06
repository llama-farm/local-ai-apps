"""
Tests for Motion Pattern Data Generation - Phase 2

Tests that motion pattern training data:
1. Uses 30-minute time windows
2. Tracks door events
3. Captures room transitions
4. Has sufficient samples (200+)
5. Covers full day (6am-10pm)
"""

import json
import pytest
from pathlib import Path

from src.data.training_data_generator import (
    generate_motion_pattern_data,
    generate_random_motion_pattern,
    MARGARET_ROUTINE,
    get_time_window_from_hour,
    get_hour_from_time_window,
    is_expected_room,
    ROOMS,
)


# ==================== Unit Tests for Routine Model ====================


class TestTimeWindowConversion:
    """Test time window utility functions."""

    def test_hour_to_time_window_midnight(self):
        """Midnight should be window 0."""
        assert get_time_window_from_hour(0, 0) == 0
        assert get_time_window_from_hour(0, 29) == 0
        assert get_time_window_from_hour(0, 30) == 1

    def test_hour_to_time_window_noon(self):
        """Noon should be window 24."""
        assert get_time_window_from_hour(12, 0) == 24
        assert get_time_window_from_hour(12, 30) == 25

    def test_hour_to_time_window_6am(self):
        """6am should be window 12."""
        assert get_time_window_from_hour(6, 0) == 12

    def test_time_window_to_hour(self):
        """Test reverse conversion."""
        assert get_hour_from_time_window(0) == (0, 0)
        assert get_hour_from_time_window(1) == (0, 30)
        assert get_hour_from_time_window(24) == (12, 0)
        assert get_hour_from_time_window(25) == (12, 30)


class TestMargaretRoutine:
    """Test Margaret's daily routine model."""

    def test_routine_covers_all_48_windows(self):
        """Routine should have entry for all 48 time windows."""
        for window in range(48):
            assert window in MARGARET_ROUTINE, f"Missing window {window}"

    def test_night_windows_expect_bedroom(self):
        """Night time (10pm-6am) should expect bedroom."""
        night_windows = list(range(0, 12)) + list(range(44, 48))
        for window in night_windows:
            expected_room, _, _ = MARGARET_ROUTINE[window]
            assert expected_room == "bedroom", f"Window {window} should be bedroom at night"

    def test_morning_kitchen_time(self):
        """7:30-9:00 AM should have kitchen activity."""
        kitchen_windows = [15, 16, 17]  # 7:30-9:00
        for window in kitchen_windows:
            expected_room, _, _ = MARGARET_ROUTINE[window]
            assert expected_room == "kitchen", f"Window {window} should be kitchen in morning"

    def test_afternoon_living_room(self):
        """1-4pm should be living room."""
        living_room_windows = list(range(26, 32))  # 1pm-4pm
        for window in living_room_windows:
            expected_room, _, _ = MARGARET_ROUTINE[window]
            assert expected_room == "living_room", f"Window {window} should be living room afternoon"

    def test_is_expected_room_function(self):
        """Test is_expected_room helper function."""
        # Noon should expect kitchen
        assert is_expected_room(24, "kitchen") is True
        assert is_expected_room(24, "bedroom") is False

        # 2am should expect bedroom
        assert is_expected_room(4, "bedroom") is True
        assert is_expected_room(4, "kitchen") is False


# ==================== Tests for Motion Pattern Data ====================


class TestMotionPatternDataStructure:
    """Test motion pattern data has correct structure."""

    def test_motion_pattern_has_time_windows(self):
        """Training data should include 30-min time window info."""
        data = generate_motion_pattern_data(50)
        for sample in data:
            assert "time_window" in sample
            assert 0 <= sample["time_window"] <= 47

    def test_motion_pattern_has_door_events(self):
        """Data should track door open/close events."""
        data = generate_motion_pattern_data(50)
        for sample in data:
            assert "door_events_count" in sample
            assert isinstance(sample["door_events_count"], int)
            assert sample["door_events_count"] >= 0

    def test_motion_pattern_has_room_transitions(self):
        """Data should capture room-to-room movement."""
        data = generate_motion_pattern_data(50)
        for sample in data:
            assert "current_room" in sample
            assert "previous_room" in sample
            assert sample["current_room"] in ROOMS
            assert sample["previous_room"] in ROOMS

    def test_motion_pattern_has_time_in_room(self):
        """Data should track time spent in room."""
        data = generate_motion_pattern_data(50)
        for sample in data:
            assert "time_in_room_minutes" in sample
            assert sample["time_in_room_minutes"] >= 0

    def test_motion_pattern_has_motion_intensity(self):
        """Data should have motion intensity 0-1."""
        data = generate_motion_pattern_data(50)
        for sample in data:
            assert "motion_intensity" in sample
            assert 0 <= sample["motion_intensity"] <= 1

    def test_motion_pattern_has_expected_location_flag(self):
        """Data should indicate if location matches routine."""
        data = generate_motion_pattern_data(50)
        for sample in data:
            assert "is_expected_location" in sample
            assert isinstance(sample["is_expected_location"], bool)


class TestMotionPatternDataCoverage:
    """Test motion pattern data has sufficient coverage."""

    def test_motion_pattern_has_200_plus_samples(self):
        """Should have at least 200 training samples."""
        data = generate_motion_pattern_data(250)
        assert len(data) >= 200

    def test_motion_pattern_covers_active_hours(self):
        """Data should cover 6am-10pm (windows 12-43)."""
        data = generate_motion_pattern_data(100)
        time_windows = set(s["time_window"] for s in data)

        # Should cover morning, afternoon, and evening
        morning_coverage = any(12 <= w <= 19 for w in time_windows)
        afternoon_coverage = any(24 <= w <= 31 for w in time_windows)
        evening_coverage = any(36 <= w <= 43 for w in time_windows)

        assert morning_coverage, "Should have morning samples"
        assert afternoon_coverage, "Should have afternoon samples"
        assert evening_coverage, "Should have evening samples"

    def test_motion_pattern_covers_all_rooms(self):
        """Data should have samples from all rooms."""
        data = generate_motion_pattern_data(100)
        rooms_seen = set(s["current_room"] for s in data)

        # At minimum, should see kitchen and living room (most common)
        assert "kitchen" in rooms_seen, "Should have kitchen samples"
        assert "living_room" in rooms_seen, "Should have living room samples"

    def test_mostly_follows_routine(self):
        """Most samples should follow expected routine."""
        data = generate_motion_pattern_data(100)
        expected_count = sum(1 for s in data if s["is_expected_location"])
        # At least 70% should follow routine
        assert expected_count / len(data) >= 0.70


# ==================== Tests for Random Motion Pattern Generation ====================


class TestRandomMotionPatternNormal:
    """Test random normal motion pattern generation."""

    def test_normal_pattern_in_active_hours(self):
        """Normal patterns should be during active hours."""
        for _ in range(10):
            pattern = generate_random_motion_pattern(is_normal=True)
            # Active hours: 6am-10pm (windows 12-43)
            assert 12 <= pattern["time_window"] <= 43

    def test_normal_pattern_follows_routine(self):
        """Normal patterns should follow Margaret's routine."""
        for _ in range(10):
            pattern = generate_random_motion_pattern(is_normal=True)
            assert pattern["is_expected_location"] is True

    def test_normal_pattern_has_valid_rooms(self):
        """Normal patterns should have valid room values."""
        for _ in range(10):
            pattern = generate_random_motion_pattern(is_normal=True)
            assert pattern["current_room"] in ROOMS
            assert pattern["previous_room"] in ROOMS


class TestRandomMotionPatternAbnormal:
    """Test random abnormal motion pattern generation."""

    def test_abnormal_patterns_generated(self):
        """Should generate abnormal patterns."""
        patterns = [generate_random_motion_pattern(is_normal=False) for _ in range(10)]
        # At least some should be truly abnormal
        has_abnormal = any(not p["is_expected_location"] for p in patterns)
        assert has_abnormal, "Should generate some abnormal patterns"

    def test_abnormal_patterns_have_anomalies(self):
        """Abnormal patterns should have anomalous characteristics."""
        patterns = [generate_random_motion_pattern(is_normal=False) for _ in range(20)]

        # Check for various anomaly types
        night_activity = any(p["time_window"] < 12 and p["current_room"] != "bedroom" for p in patterns)
        door_at_night = any(p["time_window"] < 12 and p["door_events_count"] > 0 for p in patterns)
        very_low_motion = any(p["motion_intensity"] < 0.1 and 12 <= p["time_window"] <= 43 for p in patterns)
        high_motion_night = any(p["time_window"] < 12 and p["motion_intensity"] > 0.5 for p in patterns)

        # At least one type of anomaly should be present
        has_some_anomaly = night_activity or door_at_night or very_low_motion or high_motion_night
        assert has_some_anomaly, "Should generate various anomaly types"


# ==================== Tests for Training Data File ====================


class TestMotionPatternDataFile:
    """Test motion pattern data file generation."""

    def test_motion_pattern_file_exists(self):
        """motion_pattern_data.json should exist."""
        filepath = Path("data/training/motion_pattern_data.json")
        assert filepath.exists(), "motion_pattern_data.json should be generated"

    def test_motion_pattern_file_valid_json(self):
        """File should contain valid JSON."""
        filepath = Path("data/training/motion_pattern_data.json")
        with open(filepath) as f:
            data = json.load(f)
        assert isinstance(data, list)
        assert len(data) >= 200

    def test_motion_pattern_file_has_required_fields(self):
        """Each sample should have all required fields."""
        filepath = Path("data/training/motion_pattern_data.json")
        with open(filepath) as f:
            data = json.load(f)

        required_fields = [
            "time_window",
            "current_room",
            "previous_room",
            "time_in_room_minutes",
            "door_events_count",
            "motion_intensity",
            "is_expected_location",
        ]

        for sample in data:
            for field in required_fields:
                assert field in sample, f"Missing field: {field}"
