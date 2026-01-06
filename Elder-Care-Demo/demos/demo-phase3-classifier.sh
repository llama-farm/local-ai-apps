#!/bin/bash
# Phase 3 Demo: Voice Transcript Classification
# Demonstrates training and using the SetFit classifier

set -e

echo "=============================================="
echo "Phase 3 Demo: Voice Transcript Classification"
echo "=============================================="
echo ""

cd "$(dirname "$0")/.."

# Check if LlamaFarm runtime is available
echo "Checking LlamaFarm Universal Runtime..."
if ! curl -s http://localhost:11540/health > /dev/null 2>&1; then
    echo "WARNING: LlamaFarm Universal Runtime not detected on port 11540"
    echo "Classification requires it to be running."
    echo ""
    echo "To start it, run: nx start universal-runtime"
    echo ""
    exit 1
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

# Train the classifier
echo "=============================================="
echo "Step 1: Training Voice Transcript Classifier"
echo "=============================================="
echo ""
echo "Training SetFit model on 100 labeled voice transcripts..."
echo "(This may take 30-60 seconds)"
echo ""
curl -s -X POST http://localhost:8080/api/classifier/train \
    -H "Content-Type: application/json" \
    -d '{"model_name": "voice_classifier"}' | python3 -m json.tool
echo ""

# Test routine phrase
echo "=============================================="
echo "Step 2: Classifying ROUTINE Phrase"
echo "=============================================="
echo ""
echo "Input: \"Good morning, time for my show\""
curl -s -X POST "http://localhost:8080/api/classifier/interactive?text=Good%20morning%2C%20time%20for%20my%20show" \
    -H "Content-Type: application/json" | python3 -m json.tool
echo ""

# Test concern phrase
echo "=============================================="
echo "Step 3: Classifying CONCERN Phrase"
echo "=============================================="
echo ""
echo "Input: \"I'm feeling a bit dizzy today\""
curl -s -X POST "http://localhost:8080/api/classifier/interactive?text=I%27m%20feeling%20a%20bit%20dizzy%20today" \
    -H "Content-Type: application/json" | python3 -m json.tool
echo ""

# Test emergency phrase
echo "=============================================="
echo "Step 4: Classifying EMERGENCY Phrase"
echo "=============================================="
echo ""
echo "Input: \"Help! I've fallen and I can't get up!\""
curl -s -X POST "http://localhost:8080/api/classifier/interactive?text=Help%21%20I%27ve%20fallen%20and%20I%20can%27t%20get%20up%21" \
    -H "Content-Type: application/json" | python3 -m json.tool
echo ""

# Test positive phrase
echo "=============================================="
echo "Step 5: Classifying POSITIVE Phrase"
echo "=============================================="
echo ""
echo "Input: \"I'm feeling wonderful today!\""
curl -s -X POST "http://localhost:8080/api/classifier/interactive?text=I%27m%20feeling%20wonderful%20today%21" \
    -H "Content-Type: application/json" | python3 -m json.tool
echo ""

# Run full demo
echo "=============================================="
echo "Step 6: Batch Classification Demo"
echo "=============================================="
echo ""
echo "Classifying multiple phrases at once..."
curl -s -X POST http://localhost:8080/api/classifier/demo \
    -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "=============================================="
echo "Phase 3 Demo Complete!"
echo "=============================================="
echo ""
echo "Summary:"
echo "  - Trained SetFit classifier on 100 voice samples"
echo "  - 4 classes: routine, concern, emergency, positive"
echo "  - Demonstrated classification with confidence scores"
echo ""
echo "Key insight: SetFit classifies in ~10ms vs LLM taking 1-2 seconds!"
