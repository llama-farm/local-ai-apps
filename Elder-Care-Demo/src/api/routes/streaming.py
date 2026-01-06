"""
Streaming Demo Routes

SSE streaming endpoints for the live demo tab.
"""

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from src.services.streaming_service import get_streaming_service
from src.api.routes.models import require_models_ready


router = APIRouter(prefix="/api/streaming", tags=["streaming"])


class DemoStatusResponse(BaseModel):
    """Response model for demo status."""
    is_running: bool
    scenario_loaded: bool
    scenario_title: Optional[str] = None
    total_events: int = 0


class ScenarioResponse(BaseModel):
    """Response model for scenario info."""
    title: str
    description: str
    total_duration_seconds: int
    total_events: int
    events: list


@router.get("/status")
async def get_status() -> DemoStatusResponse:
    """Get the current demo status."""
    service = get_streaming_service()
    scenario = service.get_scenario()

    return DemoStatusResponse(
        is_running=service.is_running(),
        scenario_loaded=scenario is not None,
        scenario_title=scenario.get("title") if scenario else None,
        total_events=len(scenario.get("events", [])) if scenario else 0,
    )


@router.get("/scenario")
async def get_scenario() -> ScenarioResponse:
    """Get the demo scenario details."""
    service = get_streaming_service()
    scenario = service.get_scenario()

    if not scenario:
        scenario = service.load_scenario()

    return ScenarioResponse(
        title=scenario.get("title", ""),
        description=scenario.get("description", ""),
        total_duration_seconds=scenario.get("total_duration_seconds", 0),
        total_events=len(scenario.get("events", [])),
        events=scenario.get("events", []),
    )


@router.get("/start")
async def start_demo(
    speed: float = Query(default=1.0, ge=0.1, le=10.0, description="Speed multiplier")
) -> StreamingResponse:
    """
    Start streaming the demo scenario.

    The demo streams as Server-Sent Events (SSE).

    Events sent:
    - demo_start: Initial event with scenario info
    - event: Each sensor/agent event with ML processing results
    - demo_complete: Final event when demo finishes
    - demo_stopped: If demo is manually stopped
    - error: If an error occurs

    Args:
        speed: Speed multiplier (1.0 = real-time, 2.0 = 2x speed, etc.)
    """
    # Require models to be trained before starting the demo
    require_models_ready()

    service = get_streaming_service()

    async def event_generator():
        async for event in service.stream_demo(speed_multiplier=speed):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.post("/stop")
async def stop_demo() -> dict:
    """Stop the currently running demo."""
    service = get_streaming_service()
    service.stop_demo()
    return {"status": "stopped", "was_running": service.is_running()}


@router.post("/reset")
async def reset_demo() -> dict:
    """Reset the demo state and reload scenario."""
    service = get_streaming_service()
    service.stop_demo()
    scenario = service.load_scenario()
    return {
        "status": "reset",
        "scenario_title": scenario.get("title"),
        "total_events": len(scenario.get("events", [])),
    }
