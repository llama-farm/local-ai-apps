"""
Training Data Generator for Elder Care Monitoring Demo

Generates realistic training data for Margaret's daily patterns:
- Biometric data (heart rate, blood pressure, temperature)
- Motion/activity data (room activity by time)
- Voice transcript data (categorized by urgency)
"""

import json
import random
from pathlib import Path
from datetime import datetime, timedelta
from typing import Any


def generate_biometric_data(num_samples: int = 500) -> list[dict[str, Any]]:
    """
    Generate normal biometric readings for Margaret.

    Normal ranges (matches NORMAL_RANGES in anomaly_service.py):
    - Heart rate: 60-90 bpm
    - Systolic BP: 110-140 mmHg
    - Diastolic BP: 70-90 mmHg
    - Temperature: 97.5-98.8 F

    Training data should COVER the full normal range to avoid false positives.
    """
    data = []
    activity_levels = ["resting", "light", "moderate"]
    activity_weights = [0.5, 0.35, 0.15]  # Margaret is mostly at rest

    base_time = datetime(2024, 1, 15, 6, 0, 0)  # Start at 6 AM

    for i in range(num_samples):
        # Activity level affects biometrics
        activity = random.choices(activity_levels, weights=activity_weights)[0]

        # Base ranges adjusted by activity
        # Use FULL normal ranges with appropriate std devs to cover edges
        if activity == "resting":
            hr_base, hr_std = 72, 8      # Mean 72, covers 60-90 well
            sys_base, sys_std = 122, 10  # Mean 122, covers 110-140 well
            dia_base, dia_std = 80, 6    # Mean 80, covers 70-90 well
            temp_base, temp_std = 98.1, 0.4  # Covers 97.5-98.8
        elif activity == "light":
            hr_base, hr_std = 76, 8
            sys_base, sys_std = 126, 10
            dia_base, dia_std = 82, 6
            temp_base, temp_std = 98.2, 0.4
        else:  # moderate
            hr_base, hr_std = 82, 6
            sys_base, sys_std = 130, 8
            dia_base, dia_std = 84, 5
            temp_base, temp_std = 98.3, 0.3

        # Generate reading with Gaussian distribution
        reading = {
            "timestamp": (base_time + timedelta(minutes=i * 5)).isoformat(),
            "heart_rate": round(random.gauss(hr_base, hr_std), 1),
            "systolic_bp": round(random.gauss(sys_base, sys_std), 1),
            "diastolic_bp": round(random.gauss(dia_base, dia_std), 1),
            "temperature": round(random.gauss(temp_base, temp_std), 1),
            "activity_level": activity
        }

        # Clamp to realistic ranges (these ARE the normal ranges)
        reading["heart_rate"] = max(60, min(90, reading["heart_rate"]))
        reading["systolic_bp"] = max(110, min(140, reading["systolic_bp"]))
        reading["diastolic_bp"] = max(70, min(90, reading["diastolic_bp"]))
        reading["temperature"] = max(97.5, min(98.8, reading["temperature"]))

        data.append(reading)

    return data


def generate_motion_data(num_samples: int = 250) -> list[dict[str, Any]]:
    """
    Generate normal motion/activity patterns for Margaret.

    Expected daily pattern:
    - 6:30 AM: Wake up, bedroom door opens
    - 7:00-9:00 AM: Kitchen activity (breakfast)
    - 9:00-11:00 AM: Living room (morning routine)
    - 12:00-1:00 PM: Kitchen (lunch)
    - 2:00-4:00 PM: Living room (TV, rest)
    - 6:00-7:00 PM: Kitchen (dinner)
    - 7:00-9:00 PM: Living room (evening)
    - 9:00 PM: Bedroom, door closes
    """
    data = []
    rooms = ["bedroom", "kitchen", "living_room", "bathroom"]

    # Define expected activity by hour
    hourly_patterns = {
        6: {"bedroom": 0.7, "bathroom": 0.3, "kitchen": 0.0, "living_room": 0.0},
        7: {"bedroom": 0.1, "bathroom": 0.1, "kitchen": 0.7, "living_room": 0.1},
        8: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.6, "living_room": 0.3},
        9: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.2, "living_room": 0.7},
        10: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.1, "living_room": 0.8},
        11: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.2, "living_room": 0.7},
        12: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.7, "living_room": 0.2},
        13: {"bedroom": 0.1, "bathroom": 0.1, "kitchen": 0.3, "living_room": 0.5},
        14: {"bedroom": 0.1, "bathroom": 0.1, "kitchen": 0.1, "living_room": 0.7},
        15: {"bedroom": 0.1, "bathroom": 0.1, "kitchen": 0.1, "living_room": 0.7},
        16: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.2, "living_room": 0.7},
        17: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.4, "living_room": 0.5},
        18: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.7, "living_room": 0.2},
        19: {"bedroom": 0.0, "bathroom": 0.1, "kitchen": 0.2, "living_room": 0.7},
        20: {"bedroom": 0.1, "bathroom": 0.1, "kitchen": 0.1, "living_room": 0.7},
        21: {"bedroom": 0.6, "bathroom": 0.2, "kitchen": 0.0, "living_room": 0.2},
        22: {"bedroom": 0.9, "bathroom": 0.1, "kitchen": 0.0, "living_room": 0.0},
    }

    base_date = datetime(2024, 1, 15)

    for i in range(num_samples):
        # Spread across multiple days
        day_offset = i // 16  # ~16 samples per day
        hour = 6 + (i % 16)  # Hours 6-21

        if hour > 22:
            hour = 22

        # Get pattern for this hour
        pattern = hourly_patterns.get(hour, hourly_patterns[10])
        room = random.choices(rooms, weights=[pattern[r] for r in rooms])[0]

        timestamp = base_date + timedelta(days=day_offset, hours=hour, minutes=random.randint(0, 59))

        # Activity duration varies by room
        if room == "bathroom":
            duration = random.randint(3, 15)
        elif room == "kitchen":
            duration = random.randint(10, 45)
        else:
            duration = random.randint(15, 90)

        reading = {
            "timestamp": timestamp.isoformat(),
            "room": room,
            "hour": hour,
            "activity_duration_minutes": duration,
            "motion_intensity": round(random.uniform(0.3, 0.8), 2),  # Normal activity
            "door_event": room == "bedroom" and hour in [6, 21, 22]  # Door events at wake/sleep
        }

        data.append(reading)

    return data


def generate_voice_data() -> list[dict[str, str]]:
    """
    Generate voice transcript training data with labels.

    Labels:
    - routine: Normal daily conversation
    - concern: Expressing discomfort but not emergency
    - emergency: Urgent help needed
    - positive: Expressing wellbeing
    """

    routine_phrases = [
        "Good morning, time to get up",
        "What's on TV today",
        "I think I'll have some tea",
        "The weather looks nice outside",
        "Time for my medication",
        "I should call Sarah later",
        "What day is it today",
        "I need to water the plants",
        "Let me check the mail",
        "Time for my afternoon show",
        "I wonder what's for dinner",
        "The cat needs feeding",
        "Let me turn on some music",
        "I should do some reading",
        "Time to rest my eyes a bit",
        "I'll make some lunch now",
        "Need to take my vitamins",
        "Going to sit in the garden",
        "Let me check the calendar",
        "I should organize these photos",
        "Time for my crossword puzzle",
        "Going to listen to the radio",
        "Let me put on my sweater",
        "I'll have a snack",
        "Need to refill my water glass"
    ]

    concern_phrases = [
        "I feel a bit dizzy",
        "My chest feels tight",
        "I'm not feeling well today",
        "I feel weak",
        "My head hurts",
        "I'm having trouble breathing",
        "I feel nauseous",
        "My legs feel wobbly",
        "I think I need to sit down",
        "I feel very tired suddenly",
        "Something doesn't feel right",
        "I'm feeling lightheaded",
        "My arm feels numb",
        "I'm feeling confused",
        "I can't catch my breath",
        "My heart is racing",
        "I feel very cold",
        "I'm sweating a lot",
        "I feel faint",
        "My vision is blurry",
        "I think I should rest",
        "I don't feel steady",
        "I'm having some pain",
        "I feel off today",
        "Something's wrong"
    ]

    emergency_phrases = [
        "Help! I've fallen and I can't get up",
        "I can't breathe, call 911",
        "I think I'm having a heart attack",
        "Help me please, I'm hurt",
        "Someone call an ambulance",
        "I've fallen, I need help",
        "I can't move, help me",
        "My chest, it hurts so bad",
        "I'm having a stroke I think",
        "Please help, I'm in pain",
        "I need emergency help now",
        "Call my daughter, something's wrong",
        "I'm bleeding, I need help",
        "I can't feel my legs",
        "Help! Fire!",
        "I'm choking, help",
        "Call for help immediately",
        "I've hurt myself badly",
        "This is an emergency",
        "I need an ambulance right now",
        "Please, someone help me",
        "I'm very sick, call the doctor",
        "Help! I'm stuck",
        "I need to go to the hospital",
        "Call 911 now"
    ]

    positive_phrases = [
        "I'm feeling great today",
        "What a lovely morning",
        "I slept really well last night",
        "I feel wonderful",
        "Today is a good day",
        "I'm feeling strong today",
        "My energy is good",
        "I feel happy",
        "Everything is fine",
        "I'm doing well",
        "Feeling better than yesterday",
        "I have a good appetite today",
        "I feel refreshed",
        "My spirits are high",
        "I'm comfortable and content",
        "Feeling quite well actually",
        "I'm in good shape today",
        "Nothing to worry about",
        "All is well here",
        "I'm feeling healthy",
        "Good day so far",
        "I feel peaceful",
        "Everything is as it should be",
        "I'm quite alright",
        "Feeling tip top"
    ]

    data = []

    for text in routine_phrases:
        data.append({"text": text, "label": "routine"})

    for text in concern_phrases:
        data.append({"text": text, "label": "concern"})

    for text in emergency_phrases:
        data.append({"text": text, "label": "emergency"})

    for text in positive_phrases:
        data.append({"text": text, "label": "positive"})

    return data


# ==================== Margaret's Daily Routine Model ====================

MARGARET_ROUTINE = {
    # time_window -> (expected_room, motion_intensity_range, door_events_likelihood)
    # time_window 0 = 0:00-0:30, 1 = 0:30-1:00, etc.
    # Wake hours: 6am = window 12, 10pm = window 44

    # Night (10pm - 6am): In bedroom, very low motion
    **{i: ("bedroom", (0.0, 0.1), 0.0) for i in range(0, 12)},       # 12am-6am
    **{i: ("bedroom", (0.0, 0.1), 0.0) for i in range(44, 48)},      # 10pm-12am

    # 6:00-7:00 (windows 12-13): Wake up, bedroom
    12: ("bedroom", (0.2, 0.4), 0.0),  # 6:00-6:30 - waking
    13: ("bedroom", (0.3, 0.5), 0.0),  # 6:30-7:00 - getting ready

    # 7:00-8:00 (windows 14-15): Bathroom then kitchen
    14: ("bathroom", (0.4, 0.6), 0.0),  # 7:00-7:30 - morning routine
    15: ("kitchen", (0.5, 0.7), 0.0),   # 7:30-8:00 - breakfast prep

    # 8:00-12:00 (windows 16-23): Morning - kitchen/living room
    16: ("kitchen", (0.5, 0.7), 0.0),   # 8:00-8:30 - breakfast
    17: ("kitchen", (0.4, 0.6), 0.1),   # 8:30-9:00 - cleanup, maybe check mail
    18: ("living_room", (0.3, 0.5), 0.0),  # 9:00-9:30
    19: ("living_room", (0.3, 0.5), 0.0),  # 9:30-10:00
    20: ("living_room", (0.3, 0.5), 0.0),  # 10:00-10:30
    21: ("living_room", (0.3, 0.5), 0.1),  # 10:30-11:00 - might step outside
    22: ("living_room", (0.3, 0.5), 0.0),  # 11:00-11:30
    23: ("kitchen", (0.4, 0.6), 0.0),   # 11:30-12:00 - lunch prep

    # 12:00-1:00 (windows 24-25): Lunch in kitchen
    24: ("kitchen", (0.5, 0.7), 0.0),   # 12:00-12:30 - lunch
    25: ("kitchen", (0.4, 0.6), 0.0),   # 12:30-1:00 - cleanup

    # 1:00-4:00 (windows 26-31): Afternoon rest in living room
    26: ("living_room", (0.2, 0.4), 0.0),  # 1:00-1:30 - TV time
    27: ("living_room", (0.2, 0.4), 0.0),  # 1:30-2:00
    28: ("living_room", (0.1, 0.3), 0.0),  # 2:00-2:30 - nap time
    29: ("living_room", (0.1, 0.3), 0.0),  # 2:30-3:00 - nap time
    30: ("living_room", (0.2, 0.4), 0.0),  # 3:00-3:30
    31: ("living_room", (0.3, 0.5), 0.0),  # 3:30-4:00

    # 4:00-5:00 (windows 32-33): Tea/snack time
    32: ("kitchen", (0.4, 0.6), 0.0),   # 4:00-4:30 - tea time
    33: ("kitchen", (0.4, 0.5), 0.0),   # 4:30-5:00

    # 5:00-7:00 (windows 34-37): Dinner prep and dinner
    34: ("kitchen", (0.5, 0.7), 0.0),   # 5:00-5:30 - prep
    35: ("kitchen", (0.5, 0.7), 0.0),   # 5:30-6:00 - prep
    36: ("kitchen", (0.5, 0.7), 0.0),   # 6:00-6:30 - dinner
    37: ("kitchen", (0.4, 0.6), 0.0),   # 6:30-7:00 - cleanup

    # 7:00-9:00 (windows 38-41): Evening TV time
    38: ("living_room", (0.2, 0.4), 0.0),  # 7:00-7:30
    39: ("living_room", (0.2, 0.4), 0.0),  # 7:30-8:00
    40: ("living_room", (0.2, 0.4), 0.0),  # 8:00-8:30
    41: ("living_room", (0.2, 0.3), 0.0),  # 8:30-9:00

    # 9:00-10:00 (windows 42-43): Bedtime routine
    42: ("bathroom", (0.3, 0.5), 0.0),   # 9:00-9:30 - evening routine
    43: ("bedroom", (0.2, 0.4), 0.0),    # 9:30-10:00 - getting to bed
}

ROOMS = ["bedroom", "kitchen", "living_room", "bathroom"]


def get_time_window_from_hour(hour: int, minute: int = 0) -> int:
    """Convert hour:minute to time window (0-47)."""
    return hour * 2 + (1 if minute >= 30 else 0)


def get_hour_from_time_window(time_window: int) -> tuple[int, int]:
    """Convert time window to (hour, minute_start)."""
    hour = time_window // 2
    minute = 30 if time_window % 2 else 0
    return hour, minute


def is_expected_room(time_window: int, room: str) -> bool:
    """Check if being in a room at a time window matches Margaret's routine."""
    expected = MARGARET_ROUTINE.get(time_window, ("bedroom", (0.0, 0.1), 0.0))
    return expected[0] == room


def generate_motion_pattern_data(num_samples: int = 250) -> list[dict[str, Any]]:
    """
    Generate motion pattern training data based on Margaret's daily routine.

    Each sample represents a 30-minute time window with:
    - time_window: 0-47 (30-min slots for 24 hours)
    - current_room: where Margaret is
    - previous_room: where she was before (for transitions)
    - time_in_room_minutes: how long she's been there
    - door_events_count: front door events in this window
    - motion_intensity: activity level 0-1
    - is_expected_location: based on routine
    """
    data = []

    # Generate samples across multiple days (6am-10pm active hours)
    # Active windows: 12-43 (6am to 10pm)
    active_windows = list(range(12, 44))  # 32 windows per day

    samples_per_day = num_samples // 8  # Spread across ~8 days
    remaining = num_samples % 8

    for day in range(8):
        day_samples = samples_per_day + (1 if day < remaining else 0)

        # Track room transitions through the day
        previous_room = "bedroom"  # Start in bedroom

        for sample_idx in range(day_samples):
            # Pick a random active window for this sample
            time_window = random.choice(active_windows)

            # Get expected pattern for this window
            expected_room, intensity_range, door_likelihood = MARGARET_ROUTINE[time_window]

            # Add some natural variation - 85% follow routine, 15% slight deviation
            if random.random() < 0.85:
                current_room = expected_room
            else:
                # Minor deviation - adjacent room or bathroom break
                deviations = {
                    "bedroom": ["bathroom", "bedroom"],
                    "kitchen": ["living_room", "bathroom", "kitchen"],
                    "living_room": ["kitchen", "bathroom", "living_room"],
                    "bathroom": ["bedroom", "living_room", "bathroom"],
                }
                current_room = random.choice(deviations.get(expected_room, [expected_room]))

            # Generate realistic time in room
            if current_room == "bathroom":
                time_in_room = random.randint(5, 20)
            elif current_room == expected_room:
                time_in_room = random.randint(15, 45)  # Longer in expected room
            else:
                time_in_room = random.randint(5, 25)

            # Motion intensity from expected range with small variation
            base_intensity = random.uniform(intensity_range[0], intensity_range[1])
            motion_intensity = max(0, min(1, base_intensity + random.gauss(0, 0.05)))

            # Door events - rare but possible
            door_events = 1 if random.random() < door_likelihood else 0

            # Is this expected location?
            is_expected = current_room == expected_room

            sample = {
                "time_window": time_window,
                "current_room": current_room,
                "previous_room": previous_room,
                "time_in_room_minutes": time_in_room,
                "door_events_count": door_events,
                "motion_intensity": round(motion_intensity, 2),
                "is_expected_location": is_expected,
            }

            data.append(sample)

            # Update previous room for next sample
            previous_room = current_room

    return data


def generate_random_motion_pattern(is_normal: bool = True) -> dict[str, Any]:
    """
    Generate a single random motion pattern reading.

    Args:
        is_normal: If True, generate normal pattern following routine.
                   If False, generate abnormal pattern (wrong room, night activity, etc.)
    """
    if is_normal:
        # Pick random active time window (6am-10pm)
        time_window = random.randint(12, 43)
        expected_room, intensity_range, door_likelihood = MARGARET_ROUTINE[time_window]

        # Follow expected pattern
        current_room = expected_room
        previous_room = random.choice(ROOMS)
        time_in_room = random.randint(10, 40)
        motion_intensity = round(random.uniform(intensity_range[0], intensity_range[1]), 2)
        door_events = 1 if random.random() < door_likelihood else 0

        return {
            "time_window": time_window,
            "current_room": current_room,
            "previous_room": previous_room,
            "time_in_room_minutes": time_in_room,
            "door_events_count": door_events,
            "motion_intensity": motion_intensity,
            "is_expected_location": True,
        }
    else:
        # Generate abnormal pattern - pick from several anomaly types
        anomaly_type = random.choice([
            "wrong_room_day",     # In bedroom at noon
            "night_activity",     # Active at 2am
            "door_at_night",      # Door event at 3am
            "no_movement",        # Zero motion during active hours
            "high_motion_night",  # High activity at midnight
        ])

        if anomaly_type == "wrong_room_day":
            # In bedroom during active daytime (e.g., noon)
            time_window = random.randint(24, 36)  # 12pm-6pm
            current_room = "bedroom"
            motion_intensity = random.uniform(0.05, 0.2)
            door_events = 0
        elif anomaly_type == "night_activity":
            # Active at 2-4am
            time_window = random.randint(4, 8)  # 2am-4am
            current_room = random.choice(["kitchen", "living_room"])
            motion_intensity = random.uniform(0.4, 0.7)
            door_events = 0
        elif anomaly_type == "door_at_night":
            # Door event at night (3am)
            time_window = random.randint(5, 7)  # 2:30am-3:30am
            current_room = "living_room"
            motion_intensity = random.uniform(0.3, 0.5)
            door_events = random.randint(1, 2)
        elif anomaly_type == "no_movement":
            # No movement during normally active time
            time_window = random.randint(16, 20)  # 8am-10am
            current_room = random.choice(ROOMS)
            motion_intensity = random.uniform(0.0, 0.05)  # Almost no motion
            door_events = 0
        else:  # high_motion_night
            # Very active at midnight
            time_window = random.randint(0, 4)  # 12am-2am
            current_room = random.choice(["kitchen", "living_room", "bathroom"])
            motion_intensity = random.uniform(0.6, 0.9)
            door_events = 0

        expected_room, _, _ = MARGARET_ROUTINE.get(time_window, ("bedroom", (0, 0.1), 0))

        return {
            "time_window": time_window,
            "current_room": current_room,
            "previous_room": random.choice(ROOMS),
            "time_in_room_minutes": random.randint(15, 60),
            "door_events_count": door_events,
            "motion_intensity": round(motion_intensity, 2),
            "is_expected_location": current_room == expected_room,
        }


def generate_demo_scenario() -> dict[str, Any]:
    """
    Generate the demo scenario - Margaret's concerning afternoon.

    Timeline (sped up for 2-3 minute demo):
    - Events happen every 5-10 seconds
    - Story builds tension through multiple signals
    - Culminates in agent taking action
    """

    scenario = {
        "title": "Margaret's Concerning Afternoon",
        "description": "A series of events that trigger the care monitoring system",
        "total_duration_seconds": 120,  # 2 minutes
        "events": [
            {
                "time_label": "2:15 PM",
                "delay_ms": 0,
                "type": "voice",
                "data": {
                    "text": "I feel a bit dizzy",
                    "confidence": 0.95
                },
                "expected_classification": "concern",
                "narrator": "Margaret mentions feeling dizzy while in the living room"
            },
            {
                "time_label": "2:16 PM",
                "delay_ms": 8000,
                "type": "motion",
                "data": {
                    "room": "living_room",
                    "activity_duration_minutes": 45,
                    "motion_intensity": 0.15,  # Very low - unusual stillness
                    "hour": 14
                },
                "expected_anomaly": True,
                "narrator": "Motion sensors detect unusual stillness - Margaret hasn't moved much"
            },
            {
                "time_label": "2:17 PM",
                "delay_ms": 16000,
                "type": "biometric",
                "data": {
                    "heart_rate": 95,
                    "systolic_bp": 95,
                    "diastolic_bp": 58,
                    "temperature": 97.2,
                    "activity_level": "resting"
                },
                "expected_anomaly": True,
                "narrator": "Heart rate elevated, blood pressure dropping - concerning signs"
            },
            {
                "time_label": "2:18 PM",
                "delay_ms": 24000,
                "type": "voice",
                "data": {
                    "text": "I think I need to sit down, I'm not feeling well",
                    "confidence": 0.92
                },
                "expected_classification": "concern",
                "narrator": "Margaret expresses more discomfort"
            },
            {
                "time_label": "2:19 PM",
                "delay_ms": 32000,
                "type": "motion",
                "data": {
                    "room": "living_room",
                    "activity_duration_minutes": 50,
                    "motion_intensity": 0.08,  # Almost no movement
                    "hour": 14
                },
                "expected_anomaly": True,
                "narrator": "Still no movement toward kitchen - missed her usual snack time"
            },
            {
                "time_label": "2:20 PM",
                "delay_ms": 40000,
                "type": "biometric",
                "data": {
                    "heart_rate": 88,
                    "systolic_bp": 100,
                    "diastolic_bp": 62,
                    "temperature": 97.4,
                    "activity_level": "resting"
                },
                "expected_anomaly": True,
                "narrator": "Vitals slightly improved but still concerning"
            },
            {
                "time_label": "2:21 PM",
                "delay_ms": 48000,
                "type": "voice",
                "data": {
                    "text": "I'm okay, just need to rest",
                    "confidence": 0.88
                },
                "expected_classification": "routine",
                "narrator": "Margaret tries to reassure, but pattern is concerning"
            },
            {
                "time_label": "2:22 PM",
                "delay_ms": 56000,
                "type": "agent_summary",
                "data": {
                    "anomalies_detected": 4,
                    "concern_classifications": 2,
                    "time_since_last_kitchen": "3+ hours",
                    "motion_pattern": "abnormally_still"
                },
                "narrator": "AI Agent analyzes accumulated data from last 10 minutes"
            },
            {
                "time_label": "2:22 PM",
                "delay_ms": 64000,
                "type": "agent_decision",
                "data": {
                    "decision": "escalate",
                    "reasoning": "Multiple concerning signals: elevated HR, low BP, expressed dizziness, unusual inactivity. Pattern suggests possible hypotensive episode.",
                    "actions": ["call_emergency_contact", "send_alert"]
                },
                "narrator": "Agent decides to contact Margaret's daughter Sarah"
            },
            {
                "time_label": "2:23 PM",
                "delay_ms": 72000,
                "type": "tool_execution",
                "data": {
                    "tool": "call_emergency_contact",
                    "arguments": {
                        "reason": "Multiple health concerns detected: dizziness, low blood pressure, elevated heart rate, unusual inactivity",
                        "urgency": "high"
                    },
                    "result": "Calling Sarah (daughter) at 555-0123..."
                },
                "narrator": "System contacts Sarah with situation summary"
            },
            {
                "time_label": "2:23 PM",
                "delay_ms": 80000,
                "type": "tool_execution",
                "data": {
                    "tool": "send_alert",
                    "arguments": {
                        "message": "Potential hypotensive episode detected. Margaret expressed dizziness, vitals show low BP (100/62), elevated HR (88). Currently resting in living room.",
                        "level": "urgent"
                    },
                    "result": "Alert sent to care team dashboard"
                },
                "narrator": "Care team receives detailed alert"
            },
            {
                "time_label": "2:24 PM",
                "delay_ms": 88000,
                "type": "resolution",
                "data": {
                    "outcome": "Sarah calls Margaret, confirms she's feeling better after resting. Plans to visit this evening to check on her. Doctor appointment scheduled for tomorrow.",
                    "status": "resolved_safely"
                },
                "narrator": "Situation resolved - early detection prevented potential emergency"
            }
        ]
    }

    return scenario


def save_training_data(output_dir: str = "data/training") -> dict[str, int]:
    """Generate and save all training data files."""

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Generate biometric data (500 samples for better coverage)
    biometric_data = generate_biometric_data(500)
    with open(output_path / "biometric_data.json", "w") as f:
        json.dump(biometric_data, f, indent=2)

    # Generate motion data (simple)
    motion_data = generate_motion_data(250)
    with open(output_path / "motion_data.json", "w") as f:
        json.dump(motion_data, f, indent=2)

    # Generate enhanced motion pattern data (with time windows and routine)
    motion_pattern_data = generate_motion_pattern_data(250)
    with open(output_path / "motion_pattern_data.json", "w") as f:
        json.dump(motion_pattern_data, f, indent=2)

    # Generate voice data
    voice_data = generate_voice_data()
    with open(output_path / "voice_data.json", "w") as f:
        json.dump(voice_data, f, indent=2)

    # Generate demo scenario
    demo_scenario = generate_demo_scenario()
    with open(output_path / "demo_scenario.json", "w") as f:
        json.dump(demo_scenario, f, indent=2)

    # Count labels in voice data
    label_counts = {}
    for item in voice_data:
        label = item["label"]
        label_counts[label] = label_counts.get(label, 0) + 1

    return {
        "biometric_samples": len(biometric_data),
        "motion_samples": len(motion_data),
        "motion_pattern_samples": len(motion_pattern_data),
        "voice_samples": len(voice_data),
        "voice_labels": label_counts,
        "demo_events": len(demo_scenario["events"])
    }


if __name__ == "__main__":
    print("Generating training data for Elder Care Monitoring Demo...")
    stats = save_training_data()
    print(f"\nGenerated:")
    print(f"  - Biometric samples: {stats['biometric_samples']}")
    print(f"  - Motion samples: {stats['motion_samples']}")
    print(f"  - Motion pattern samples: {stats['motion_pattern_samples']}")
    print(f"  - Voice samples: {stats['voice_samples']}")
    print(f"  - Voice labels: {stats['voice_labels']}")
    print(f"  - Demo scenario events: {stats['demo_events']}")
    print("\nTraining data saved to data/training/")
