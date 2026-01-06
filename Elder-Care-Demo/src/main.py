"""
Elder Care Monitoring Demo - Entry Point

Run with: uv run uvicorn src.main:app --port 8080 --reload
"""

import uvicorn
from src.app import app

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
    )
