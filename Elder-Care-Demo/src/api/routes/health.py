"""
Health Check API Routes
"""

from fastapi import APIRouter
import httpx

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "service": "elder-care-demo"}


@router.get("/health/detailed")
async def detailed_health_check():
    """
    Detailed health check including LlamaFarm service status.
    """
    status = {
        "api": "ok",
        "llamafarm_runtime": False,
        "llamafarm_server": False,
    }

    # Check LlamaFarm Universal Runtime (port 11540)
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get("http://localhost:11540/health")
            status["llamafarm_runtime"] = response.status_code == 200
    except Exception:
        pass

    # Check LlamaFarm Server (port 8000)
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get("http://localhost:8000/health")
            status["llamafarm_server"] = response.status_code == 200
    except Exception:
        pass

    return status
