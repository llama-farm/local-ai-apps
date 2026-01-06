#!/bin/bash
# Phase 1 Demo: Training Data Generation
# Shows the generated training data for elder care monitoring

set -e

echo "=============================================="
echo "Phase 1 Demo: Training Data Generation"
echo "=============================================="
echo ""

# Navigate to project directory
cd "$(dirname "$0")/.."

# Generate training data
echo "Generating training data..."
uv run python -c "from src.data.training_data_generator import save_training_data; stats = save_training_data(); print(f'Stats: {stats}')"

echo ""
echo "=============================================="
echo "Training Data Summary"
echo "=============================================="

# Show biometric data sample
echo ""
echo "--- Biometric Data (first 3 samples) ---"
uv run python -c "
import json
with open('data/training/biometric_data.json') as f:
    data = json.load(f)
    print(f'Total samples: {len(data)}')
    for i, sample in enumerate(data[:3]):
        print(f'  Sample {i+1}: HR={sample[\"heart_rate\"]}bpm, BP={sample[\"systolic_bp\"]}/{sample[\"diastolic_bp\"]}, Temp={sample[\"temperature\"]}F')
"

# Show motion data sample
echo ""
echo "--- Motion Data (first 3 samples) ---"
uv run python -c "
import json
with open('data/training/motion_data.json') as f:
    data = json.load(f)
    print(f'Total samples: {len(data)}')
    for i, sample in enumerate(data[:3]):
        print(f'  Sample {i+1}: Room={sample[\"room\"]}, Hour={sample[\"hour\"]}, Duration={sample[\"activity_duration_minutes\"]}min')
"

# Show voice data summary
echo ""
echo "--- Voice Transcript Data ---"
uv run python -c "
import json
with open('data/training/voice_data.json') as f:
    data = json.load(f)
    labels = {}
    for item in data:
        labels[item['label']] = labels.get(item['label'], 0) + 1
    print(f'Total samples: {len(data)}')
    print(f'Labels:')
    for label, count in sorted(labels.items()):
        print(f'  - {label}: {count} samples')
    print('Example phrases:')
    for label in ['routine', 'concern', 'emergency', 'positive']:
        examples = [d['text'] for d in data if d['label'] == label][:2]
        print(f'  {label}: \"{examples[0]}\"')
"

# Show demo scenario
echo ""
echo "--- Demo Scenario ---"
uv run python -c "
import json
with open('data/training/demo_scenario.json') as f:
    data = json.load(f)
    print(f'Title: {data[\"title\"]}')
    print(f'Duration: {data[\"total_duration_seconds\"]} seconds')
    print(f'Events: {len(data[\"events\"])}')
    print('Timeline:')
    for event in data['events'][:5]:
        print(f'  {event[\"time_label\"]}: [{event[\"type\"]}] {event.get(\"narrator\", \"\")}')
    print('  ...')
"

echo ""
echo "=============================================="
echo "Phase 1 Demo Complete!"
echo "=============================================="
echo ""
echo "Files created in data/training/:"
ls -la data/training/
