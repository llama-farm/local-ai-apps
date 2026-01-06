#!/bin/bash
# Phase 2 Demo: Anomaly Detection
# Demonstrates training and detecting anomalies via the API

set -e

echo "=============================================="
echo "Phase 2 Demo: Anomaly Detection"
echo "=============================================="
echo ""

cd "$(dirname "$0")/.."

# Check if LlamaFarm runtime is available
echo "Checking LlamaFarm Universal Runtime..."
if ! curl -s http://localhost:11540/health > /dev/null 2>&1; then
    echo "WARNING: LlamaFarm Universal Runtime not detected on port 11540"
    echo "Some features will not work without it."
    echo ""
    echo "To start it, run: nx start universal-runtime"
    echo ""
fi

# Start the API server in background
echo "Starting Elder Care API server..."
uv run uvicorn src.main:app --port 8080 &
API_PID=$!
sleep 3

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    kill $API_PID 2>/dev/null || true
}
trap cleanup EXIT

# Check API is running
echo "Checking API health..."
curl -s http://localhost:8080/health | python3 -m json.tool
echo ""

# Train biometric anomaly model
echo "=============================================="
echo "Step 1: Training Biometric Anomaly Model"
echo "=============================================="
echo ""
echo "Training on 250 normal biometric readings..."
curl -s -X POST http://localhost:8080/api/anomaly/train \
    -H "Content-Type: application/json" \
    -d '{"model_name": "biometric_anomaly", "data_type": "biometric"}' | python3 -m json.tool
echo ""

# Test normal biometric reading
echo "=============================================="
echo "Step 2: Testing Normal Biometric Reading"
echo "=============================================="
echo ""
echo "Input: HR=72, BP=120/78, Temp=98.2 (all normal)"
curl -s -X POST http://localhost:8080/api/anomaly/detect/biometric \
    -H "Content-Type: application/json" \
    -d '{"heart_rate": 72, "systolic_bp": 120, "diastolic_bp": 78, "temperature": 98.2, "activity_level": "resting"}' | python3 -m json.tool
echo ""

# Test abnormal biometric reading
echo "=============================================="
echo "Step 3: Testing ABNORMAL Biometric Reading"
echo "=============================================="
echo ""
echo "Input: HR=150, BP=80/50, Temp=95.0 (all concerning!)"
curl -s -X POST http://localhost:8080/api/anomaly/detect/biometric \
    -H "Content-Type: application/json" \
    -d '{"heart_rate": 150, "systolic_bp": 80, "diastolic_bp": 50, "temperature": 95.0, "activity_level": "resting"}' | python3 -m json.tool
echo ""

# Train motion anomaly model
echo "=============================================="
echo "Step 4: Training Motion Anomaly Model"
echo "=============================================="
echo ""
echo "Training on 250 normal motion patterns..."
curl -s -X POST http://localhost:8080/api/anomaly/train \
    -H "Content-Type: application/json" \
    -d '{"model_name": "motion_anomaly", "data_type": "motion"}' | python3 -m json.tool
echo ""

# Test normal motion reading
echo "=============================================="
echo "Step 5: Testing Normal Motion Pattern"
echo "=============================================="
echo ""
echo "Input: Living room at 2pm, 30min, normal intensity"
curl -s -X POST http://localhost:8080/api/anomaly/detect/motion \
    -H "Content-Type: application/json" \
    -d '{"room": "living_room", "hour": 14, "activity_duration_minutes": 30, "motion_intensity": 0.5}' | python3 -m json.tool
echo ""

# Test abnormal motion reading
echo "=============================================="
echo "Step 6: Testing ABNORMAL Motion Pattern"
echo "=============================================="
echo ""
echo "Input: Kitchen at 2am, very low intensity (unusual!)"
curl -s -X POST http://localhost:8080/api/anomaly/detect/motion \
    -H "Content-Type: application/json" \
    -d '{"room": "kitchen", "hour": 2, "activity_duration_minutes": 5, "motion_intensity": 0.05}' | python3 -m json.tool
echo ""

echo "=============================================="
echo "Phase 2 Demo Complete!"
echo "=============================================="
echo ""
echo "Summary:"
echo "  - Trained biometric anomaly detector (One-Class SVM)"
echo "  - Trained motion anomaly detector (Isolation Forest)"
echo "  - Demonstrated normal vs abnormal detection"
echo ""
echo "API documentation available at: http://localhost:8080/docs"
