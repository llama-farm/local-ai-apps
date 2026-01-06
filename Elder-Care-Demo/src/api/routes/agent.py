"""
Agent API Routes

Endpoints for the LLM agent that analyzes sensor data and takes actions.
"""

from fastapi import APIRouter, HTTPException
from typing import Any

from src.models.schemas import (
    SensorContext,
    AgentAnalyzeRequest,
    AgentResponse,
    BiometricReading,
    MotionReading,
    VoiceTranscript,
    AnomalyResult,
    ClassificationResult,
)
from src.services.agent_service import agent_service
from src.services.anomaly_service import anomaly_service
from src.services.classifier_service import classifier_service
from src.api.routes.models import require_models_ready

router = APIRouter(prefix="/api/agent", tags=["Agent"])


@router.post("/analyze", response_model=AgentResponse)
async def analyze_context(request: AgentAnalyzeRequest):
    """
    Have the agent analyze the current sensor context.

    The agent will:
    1. Review all provided sensor data
    2. Identify concerning patterns
    3. Decide on appropriate actions
    4. Execute tools if needed
    """
    try:
        return await agent_service.analyze(
            context=request.context,
            additional_info=request.additional_info
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent analysis failed: {str(e)}"
        )


@router.post("/analyze/simple", response_model=AgentResponse)
async def analyze_simple(
    heart_rate: float = 72,
    systolic_bp: float = 120,
    diastolic_bp: float = 78,
    temperature: float = 98.2,
    room: str = "living_room",
    hour: int = 14,
    voice_text: str = None,
    voice_label: str = None,
    is_anomaly: bool = False,
    anomaly_score: float = 0.0
):
    """
    Simplified endpoint to analyze sensor data.

    Accepts individual parameters instead of a complex context object.
    Useful for interactive demos.
    """
    # Build context from parameters
    biometric = BiometricReading(
        heart_rate=heart_rate,
        systolic_bp=systolic_bp,
        diastolic_bp=diastolic_bp,
        temperature=temperature,
    )

    motion = MotionReading(
        room=room,
        hour=hour,
        activity_duration_minutes=30,
        motion_intensity=0.5,
    )

    context = SensorContext(
        recent_biometrics=[biometric],
        recent_motion=[motion],
    )

    if voice_text:
        context.recent_voice = [VoiceTranscript(text=voice_text)]

        if voice_label:
            context.classifications = [
                ClassificationResult(
                    text=voice_text,
                    label=voice_label,
                    score=0.9,
                    all_scores={voice_label: 0.9}
                )
            ]

    if is_anomaly:
        context.anomalies_detected = [
            AnomalyResult(
                is_anomaly=True,
                score=anomaly_score,
                details={"triggered": "manual input"},
                input_data={"heart_rate": heart_rate, "bp": f"{systolic_bp}/{diastolic_bp}"}
            )
        ]

    try:
        return await agent_service.analyze(context)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent analysis failed: {str(e)}"
        )


@router.post("/demo/routine", response_model=AgentResponse)
async def demo_routine():
    """
    Demo: Routine day, nothing concerning.

    Uses REAL ML models for anomaly detection and classification.
    """
    # Require models to be trained
    require_models_ready()

    # Define the scenario data
    biometric = BiometricReading(
        heart_rate=72,
        systolic_bp=120,
        diastolic_bp=78,
        temperature=98.2,
    )
    voice_text = "I think I'll watch my show now"

    # Run through REAL models
    anomaly_result = await anomaly_service.detect_biometric_anomaly(biometric)
    classification = await classifier_service.classify_single(voice_text)

    # Build context with real results
    context = SensorContext(
        recent_biometrics=[biometric],
        recent_motion=[
            MotionReading(
                room="living_room",
                hour=14,
                activity_duration_minutes=30,
                motion_intensity=0.5,
            )
        ],
        recent_voice=[VoiceTranscript(text=voice_text)],
        anomalies_detected=[anomaly_result] if anomaly_result.is_anomaly else [],
        classifications=[classification],
        summary="Normal afternoon - Margaret is in the living room as expected"
    )

    return await agent_service.analyze(context)


@router.post("/demo/concern", response_model=AgentResponse)
async def demo_concern():
    """
    Demo: Some concerning signals, but not emergency.

    Uses REAL ML models for anomaly detection and classification.
    """
    # Require models to be trained
    require_models_ready()

    # Define the scenario data - borderline concerning vitals
    biometric = BiometricReading(
        heart_rate=85,
        systolic_bp=105,
        diastolic_bp=68,
        temperature=97.5,
    )
    voice_text = "I'm feeling a bit dizzy"

    # Run through REAL models
    anomaly_result = await anomaly_service.detect_biometric_anomaly(biometric)
    classification = await classifier_service.classify_single(voice_text)

    # Build context with real results
    context = SensorContext(
        recent_biometrics=[biometric],
        recent_motion=[
            MotionReading(
                room="living_room",
                hour=14,
                activity_duration_minutes=45,
                motion_intensity=0.15,  # Low motion
            )
        ],
        recent_voice=[VoiceTranscript(text=voice_text)],
        anomalies_detected=[anomaly_result] if anomaly_result.is_anomaly else [],
        classifications=[classification],
        summary="Margaret mentioned dizziness, vitals show borderline low BP, unusually still"
    )

    return await agent_service.analyze(context)


@router.post("/demo/emergency", response_model=AgentResponse)
async def demo_emergency():
    """
    Demo: Emergency situation requiring immediate action.

    Uses REAL ML models for anomaly detection and classification.
    """
    # Require models to be trained
    require_models_ready()

    # Define the scenario data - severely abnormal vitals
    biometric = BiometricReading(
        heart_rate=110,
        systolic_bp=85,
        diastolic_bp=52,
        temperature=96.8,
    )
    voice_text = "Help! I've fallen!"

    # Run through REAL models
    anomaly_result = await anomaly_service.detect_biometric_anomaly(biometric)
    classification = await classifier_service.classify_single(voice_text)

    # Build context with real results
    context = SensorContext(
        recent_biometrics=[biometric],
        recent_motion=[
            MotionReading(
                room="bathroom",
                hour=14,
                activity_duration_minutes=25,
                motion_intensity=0.02,  # Almost no motion
            )
        ],
        recent_voice=[VoiceTranscript(text=voice_text)],
        anomalies_detected=[anomaly_result] if anomaly_result.is_anomaly else [],
        classifications=[classification],
        summary="EMERGENCY: Margaret called for help, severely abnormal vitals, no movement in bathroom"
    )

    return await agent_service.analyze(context)


@router.get("/log", response_model=list[dict])
async def get_tool_log():
    """Get the log of all tool executions."""
    return agent_service.get_tool_log()


@router.get("/alerts", response_model=list[dict])
async def get_alerts():
    """Get all alerts that have been sent."""
    return agent_service.get_alerts()


@router.get("/observations", response_model=list[dict])
async def get_observations():
    """Get all observations that have been logged."""
    return agent_service.get_observations()


@router.get("/monitoring", response_model=dict)
async def get_monitoring_state():
    """Get current monitoring state."""
    return agent_service.get_monitoring_state()


@router.post("/reset")
async def reset_agent():
    """Reset all agent state (tool log, alerts, observations)."""
    agent_service.reset()
    return {"status": "reset", "message": "Agent state cleared"}
