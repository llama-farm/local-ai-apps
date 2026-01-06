#!/bin/bash
#
# Start the Elder Care Demo
# This script starts both the FastAPI backend and React frontend
#
# Usage:
#   ./scripts/start-demo.sh          # Start with default ports
#   ./scripts/start-demo.sh --backend # Start only backend
#   ./scripts/start-demo.sh --frontend # Start only frontend
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
UI_DIR="$PROJECT_DIR/ui"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Elder Care Demo${NC}"
echo -e "${BLUE}  Stop Using LLMs for Everything${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Parse arguments
BACKEND_ONLY=false
FRONTEND_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend)
            BACKEND_ONLY=true
            shift
            ;;
        --frontend)
            FRONTEND_ONLY=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Function to check if a port is in use
port_in_use() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Killing existing process on port $port${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Start backend
start_backend() {
    echo -e "${GREEN}Starting FastAPI backend on port 8080...${NC}"

    # Kill existing process on port 8080
    kill_port 8080

    cd "$PROJECT_DIR"

    # Start backend in background
    uv run uvicorn src.app:app --host 0.0.0.0 --port 8080 --reload &
    BACKEND_PID=$!

    echo -e "${GREEN}Backend started (PID: $BACKEND_PID)${NC}"
    echo ""
}

# Start frontend
start_frontend() {
    echo -e "${GREEN}Starting React frontend on port 5173...${NC}"

    # Kill existing process on port 5173
    kill_port 5173

    cd "$UI_DIR"

    # Start frontend in background
    npm run dev &
    FRONTEND_PID=$!

    echo -e "${GREEN}Frontend started (PID: $FRONTEND_PID)${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"

    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    # Also clean up any remaining processes on ports
    kill_port 8080
    kill_port 5173

    echo -e "${GREEN}Demo stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check for uv
if ! command -v uv &> /dev/null; then
    echo -e "${RED}Error: uv is not installed. Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh${NC}"
    exit 1
fi

# Check for node/npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Install Node.js from https://nodejs.org${NC}"
    exit 1
fi

echo -e "${GREEN}Prerequisites OK${NC}"
echo ""

# Start services
if [ "$FRONTEND_ONLY" = true ]; then
    start_frontend
    echo -e "${GREEN}Frontend only mode${NC}"
    echo -e "${BLUE}Open http://localhost:5173 in your browser${NC}"
    echo -e "${YELLOW}Note: Backend must be running separately on port 8080${NC}"
elif [ "$BACKEND_ONLY" = true ]; then
    start_backend
    echo -e "${GREEN}Backend only mode${NC}"
    echo -e "${BLUE}API available at http://localhost:8080${NC}"
    echo -e "${BLUE}API docs at http://localhost:8080/docs${NC}"
else
    start_backend
    sleep 2  # Wait for backend to start
    start_frontend

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Demo is ready!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Frontend: http://localhost:5173${NC}"
    echo -e "${BLUE}Backend:  http://localhost:8080${NC}"
    echo -e "${BLUE}API Docs: http://localhost:8080/docs${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
fi

# Wait for processes
wait
