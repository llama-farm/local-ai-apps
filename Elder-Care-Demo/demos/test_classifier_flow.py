#!/usr/bin/env python3
"""
Classifier End-to-End Demo

This script tests the full classifier workflow:
1. Check initial status
2. List existing models
3. Train a new classifier
4. Save the classifier
5. List models again (should show saved model)
6. Load the classifier
7. Classify test phrases
8. Check status after load

Run with: python demos/test_classifier_flow.py
"""

import httpx
import json
import sys
from datetime import datetime

# Configuration
LLAMAFARM_URL = "http://localhost:11540"
BACKEND_URL = "http://localhost:8080"

client = httpx.Client(timeout=120.0)


def print_header(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_json(data: dict):
    print(json.dumps(data, indent=2))


def check_llamafarm():
    """Check if LlamaFarm is running."""
    print_header("Checking LlamaFarm Connection")
    try:
        resp = client.get(f"{LLAMAFARM_URL}/health")
        if resp.status_code == 200:
            print("✓ LlamaFarm is running")
            return True
        else:
            print(f"✗ LlamaFarm returned status {resp.status_code}")
            return False
    except Exception as e:
        print(f"✗ Cannot connect to LlamaFarm: {e}")
        print(f"  Make sure LlamaFarm is running on {LLAMAFARM_URL}")
        return False


def check_backend():
    """Check if backend is running."""
    print_header("Checking Backend Connection")
    try:
        resp = client.get(f"{BACKEND_URL}/health")
        if resp.status_code == 200:
            print("✓ Backend is running")
            return True
        else:
            print(f"✗ Backend returned status {resp.status_code}")
            return False
    except Exception as e:
        print(f"✗ Cannot connect to Backend: {e}")
        print(f"  Make sure Backend is running on {BACKEND_URL}")
        return False


def list_classifier_models_llamafarm():
    """List models directly from LlamaFarm."""
    print_header("1. List Classifier Models (Direct from LlamaFarm)")
    try:
        # Correct endpoint is /v1/classifier/models (not /list)
        resp = client.get(f"{LLAMAFARM_URL}/v1/classifier/models")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            # Format: {"object": "list", "data": [...], "total": N}
            models = data.get("data", [])
            total = data.get("total", len(models))
            print(f"Total models: {total}")
            print(f"Models directory: {data.get('models_dir', 'unknown')}")
            print("\nModels:")
            for m in models[:10]:  # Show first 10
                name = m.get("name", "unknown")
                labels = m.get("labels", [])
                print(f"  - {name}: {labels}")
            if len(models) > 10:
                print(f"  ... and {len(models) - 10} more")
            print(f"\n✓ Found {total} model(s) in LlamaFarm registry")
            return models
        else:
            print(f"Response: {resp.text}")
            return []
    except Exception as e:
        print(f"✗ Error: {e}")
        return []


def check_classifier_status():
    """Check classifier status via backend API."""
    print_header("2. Check Classifier Status (via Backend)")
    try:
        resp = client.get(f"{BACKEND_URL}/api/classifier/status")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_json(data)
            is_trained = data.get("is_trained", False)
            print(f"\n{'✓' if is_trained else '✗'} Classifier is {'TRAINED' if is_trained else 'NOT TRAINED'}")
            return is_trained
        else:
            print(f"Response: {resp.text}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def train_classifier():
    """Train the classifier via backend API."""
    print_header("3. Train Classifier")
    print("Training classifier on voice transcript data...")
    print("(This may take 10-30 seconds)")
    try:
        resp = client.post(
            f"{BACKEND_URL}/api/classifier/train",
            json={"model_name": "voice_classifier"},
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_json(data)
            print(f"\n✓ Trained on {data.get('samples_fitted', 0)} samples")
            print(f"  Labels: {data.get('labels', [])}")
            print(f"  Training time: {data.get('training_time_ms', 0):.0f}ms")
            return True
        else:
            print(f"✗ Training failed: {resp.text}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def save_classifier():
    """Save the classifier via backend API."""
    print_header("4. Save Classifier")
    try:
        resp = client.post(f"{BACKEND_URL}/api/classifier/save/voice_classifier")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_json(data)
            print("\n✓ Classifier saved successfully")
            return True
        else:
            print(f"✗ Save failed: {resp.text}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def list_models_after_save():
    """List models after saving."""
    print_header("5. List Models After Save")
    models = list_classifier_models_llamafarm()
    if models:
        print("\nModels found:")
        for m in models:
            if isinstance(m, dict):
                print(f"  - {m.get('name', 'unknown')}")
            else:
                print(f"  - {m}")
    return models


def load_classifier():
    """Load the classifier via backend API."""
    print_header("6. Load Classifier")
    try:
        resp = client.post(f"{BACKEND_URL}/api/classifier/load/voice_classifier")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_json(data)
            print("\n✓ Classifier loaded successfully")
            return True
        else:
            print(f"✗ Load failed: {resp.text}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def classify_test_phrases():
    """Test classification on various phrases."""
    print_header("7. Classify Test Phrases")

    test_phrases = [
        ("I'm feeling great today!", "positive"),
        ("Good morning, time for my show", "routine"),
        ("I feel a bit dizzy", "concern"),
        ("Help! I've fallen!", "emergency"),
        ("What's on TV today", "routine"),
        ("My chest hurts", "concern"),
        ("Call 911 now!", "emergency"),
        ("I slept really well", "positive"),
    ]

    correct = 0
    total = len(test_phrases)

    for phrase, expected in test_phrases:
        try:
            resp = client.post(
                f"{BACKEND_URL}/api/classifier/interactive",
                params={"text": phrase}
            )
            if resp.status_code == 200:
                data = resp.json()
                predicted = data.get("label", "unknown")
                score = data.get("score", 0) * 100
                match = "✓" if predicted == expected else "✗"
                if predicted == expected:
                    correct += 1
                print(f"{match} \"{phrase[:30]}...\"")
                print(f"   Predicted: {predicted} ({score:.1f}%) | Expected: {expected}")
            else:
                print(f"✗ Failed to classify: {phrase}")
                print(f"   Error: {resp.text}")
        except Exception as e:
            print(f"✗ Error classifying '{phrase}': {e}")

    print(f"\n{'='*40}")
    print(f"Accuracy: {correct}/{total} ({100*correct/total:.0f}%)")


def check_status_after_operations():
    """Check status after all operations."""
    print_header("8. Final Status Check")

    # Check backend status
    print("\nBackend API status:")
    check_classifier_status()

    # Check LlamaFarm directly
    print("\nLlamaFarm models:")
    list_classifier_models_llamafarm()


def test_direct_llamafarm_fit():
    """Test training directly via LlamaFarm API."""
    print_header("DIRECT TEST: Train via LlamaFarm API")

    # Minimal training data
    training_data = [
        {"text": "I feel great", "label": "positive"},
        {"text": "Everything is wonderful", "label": "positive"},
        {"text": "I'm so happy", "label": "positive"},
        {"text": "Help me please", "label": "emergency"},
        {"text": "Call 911", "label": "emergency"},
        {"text": "I need help now", "label": "emergency"},
        {"text": "I feel dizzy", "label": "concern"},
        {"text": "My head hurts", "label": "concern"},
        {"text": "I'm not feeling well", "label": "concern"},
        {"text": "Good morning", "label": "routine"},
        {"text": "Time for breakfast", "label": "routine"},
        {"text": "What's on TV", "label": "routine"},
    ]

    print(f"Training with {len(training_data)} samples...")

    try:
        resp = client.post(
            f"{LLAMAFARM_URL}/v1/classifier/fit",
            json={
                "model": "test_direct_classifier",
                "base_model": "sentence-transformers/all-MiniLM-L6-v2",
                "training_data": training_data,
                "num_iterations": 5,  # Fewer iterations for speed
            }
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")

        if resp.status_code == 200:
            print("\n✓ Direct LlamaFarm training succeeded!")

            # Try to save it
            print("\nSaving model...")
            save_resp = client.post(
                f"{LLAMAFARM_URL}/v1/classifier/save",
                json={"model": "test_direct_classifier"}
            )
            print(f"Save status: {save_resp.status_code}")
            print(f"Save response: {save_resp.text[:200]}")

            # List models
            print("\nListing models...")
            list_resp = client.get(f"{LLAMAFARM_URL}/v1/classifier/list")
            print(f"List status: {list_resp.status_code}")
            print_json(list_resp.json())

            return True
        else:
            print("\n✗ Direct LlamaFarm training failed")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    print("\n" + "=" * 60)
    print("  CLASSIFIER END-TO-END DEMO")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Check connections
    if not check_llamafarm():
        print("\n✗ Cannot proceed without LlamaFarm")
        sys.exit(1)

    if not check_backend():
        print("\n✗ Cannot proceed without Backend")
        sys.exit(1)

    # Run the full flow
    print("\n" + "=" * 60)
    print("  RUNNING FULL CLASSIFIER WORKFLOW")
    print("=" * 60)

    # 1. List existing models
    list_classifier_models_llamafarm()

    # 2. Check initial status
    check_classifier_status()

    # 3. Train
    if not train_classifier():
        print("\n✗ Training failed, trying direct LlamaFarm test...")
        test_direct_llamafarm_fit()
        sys.exit(1)

    # 4. Save
    if not save_classifier():
        print("\n✗ Save failed")
        sys.exit(1)

    # 5. List models after save
    list_models_after_save()

    # 6. Load
    if not load_classifier():
        print("\n✗ Load failed")
        sys.exit(1)

    # 7. Classify test phrases
    classify_test_phrases()

    # 8. Final status
    check_status_after_operations()

    print("\n" + "=" * 60)
    print("  DEMO COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
