"""
Model Status API Routes

Endpoints for checking model readiness across all services.
"""

from fastapi import APIRouter, HTTPException

from src.services.anomaly_service import anomaly_service
from src.services.classifier_service import classifier_service

router = APIRouter(prefix="/api/models", tags=["Models"])


@router.get("/status")
async def get_all_model_status():
    """
    Get the training status of all ML models.

    Returns which models are ready for use.
    """
    biometric_ready = anomaly_service.is_trained("biometric_anomaly")
    classifier_ready = classifier_service.is_trained("voice_classifier")

    return {
        "biometric_anomaly": biometric_ready,
        "voice_classifier": classifier_ready,
        "all_ready": biometric_ready and classifier_ready,
        "required_for_demo": ["biometric_anomaly", "voice_classifier"],
    }


def check_models_ready() -> tuple[bool, list[str]]:
    """
    Check if all required models are ready.

    Returns:
        (all_ready, missing_models)
    """
    missing = []

    if not anomaly_service.is_trained("biometric_anomaly"):
        missing.append("biometric_anomaly")

    if not classifier_service.is_trained("voice_classifier"):
        missing.append("voice_classifier")

    return len(missing) == 0, missing


def require_models_ready():
    """
    Raise HTTP 503 if models are not ready.

    Use this in endpoints that require trained models.
    """
    ready, missing = check_models_ready()
    if not ready:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Models not trained",
                "missing_models": missing,
                "message": f"Please train the following models first: {', '.join(missing)}",
                "hint": "Use the Anomaly Detection tab to train models, or call POST /api/anomaly/load/biometric_anomaly and POST /api/classifier/load/voice_classifier to load saved models."
            }
        )
