#!/bin/bash
# Phase 4 Demo: LLM Agent with Tool Calling
# Demonstrates the agent making decisions and executing tools

set -e

echo "=============================================="
echo "Phase 4 Demo: LLM Agent with Tool Calling"
echo "=============================================="
echo ""

cd "$(dirname "$0")/.."

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

# Reset agent state
echo "Resetting agent state..."
curl -s -X POST http://localhost:8080/api/agent/reset | python3 -m json.tool
echo ""

# Demo 1: Routine situation
echo "=============================================="
echo "Demo 1: ROUTINE Situation"
echo "=============================================="
echo ""
echo "Margaret is having a normal afternoon, watching TV in the living room."
echo ""
curl -s -X POST http://localhost:8080/api/agent/demo/routine | python3 -m json.tool
echo ""

# Check tool log
echo "Tool executions after routine:"
curl -s http://localhost:8080/api/agent/log | python3 -m json.tool
echo ""

# Demo 2: Concerning situation
echo "=============================================="
echo "Demo 2: CONCERNING Situation"
echo "=============================================="
echo ""
echo "Margaret mentioned dizziness, blood pressure is borderline low, she's unusually still."
echo ""
curl -s -X POST http://localhost:8080/api/agent/demo/concern | python3 -m json.tool
echo ""

# Check monitoring state
echo "Current monitoring state:"
curl -s http://localhost:8080/api/agent/monitoring | python3 -m json.tool
echo ""

# Demo 3: Emergency situation
echo "=============================================="
echo "Demo 3: EMERGENCY Situation"
echo "=============================================="
echo ""
echo "Margaret called for help, vitals are severely abnormal, no movement in bathroom."
echo ""
curl -s -X POST http://localhost:8080/api/agent/demo/emergency | python3 -m json.tool
echo ""

# Check alerts
echo "Alerts sent:"
curl -s http://localhost:8080/api/agent/alerts | python3 -m json.tool
echo ""

# Check full tool log
echo "=============================================="
echo "Full Tool Execution Log"
echo "=============================================="
curl -s http://localhost:8080/api/agent/log | python3 -m json.tool
echo ""

echo "=============================================="
echo "Phase 4 Demo Complete!"
echo "=============================================="
echo ""
echo "Summary:"
echo "  - Agent analyzed 3 scenarios: routine, concern, emergency"
echo "  - Tools executed based on situation severity"
echo "  - Emergency triggered call_emergency_contact and send_alert"
echo ""
echo "Key insight: The LLM coordinates multiple signals to make decisions,"
echo "while specialized models (anomaly, classification) do the fast analysis."
