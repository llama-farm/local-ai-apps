"""
Anomaly Detection API Routes

Endpoints for training and detecting anomalies in biometric and motion data.
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from src.models.schemas import (
    BiometricReading,
    MotionReading,
    MotionPatternReading,
    AnomalyDetectRequest,
    AnomalyResult,
    AnomalyTrainRequest,
    AnomalyTrainResponse,
    ModelStatus,
)
from src.services.anomaly_service import anomaly_service, generate_random_biometrics
from src.data.training_data_generator import generate_random_motion_pattern

TRAINING_DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "training"

router = APIRouter(prefix="/api/anomaly", tags=["Anomaly Detection"])


@router.post("/train", response_model=AnomalyTrainResponse)
async def train_anomaly_model(request: AnomalyTrainRequest):
    """
    Train an anomaly detection model on normal data.

    - **data_type**: 'biometric' or 'motion'
    - **model_name**: Name to save the model as (optional)
    """
    try:
        if request.data_type == "biometric":
            result = await anomaly_service.train_biometric_model(request.model_name)
        elif request.data_type == "motion":
            result = await anomaly_service.train_motion_model(request.model_name)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown data type: {request.data_type}. Use 'biometric' or 'motion'."
            )

        return result

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training data not found. Run data generator first: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training failed: {str(e)}"
        )


@router.post("/detect", response_model=AnomalyResult)
async def detect_anomaly(request: AnomalyDetectRequest):
    """
    Detect if a sensor reading is anomalous.

    - **data_type**: 'biometric' or 'motion'
    - **biometric**: Biometric reading (if data_type is 'biometric')
    - **motion**: Motion reading (if data_type is 'motion')
    """
    try:
        if request.data_type == "biometric":
            if request.biometric is None:
                raise HTTPException(
                    status_code=400,
                    detail="biometric field required for data_type='biometric'"
                )
            result = await anomaly_service.detect_biometric_anomaly(request.biometric)

        elif request.data_type == "motion":
            if request.motion is None:
                raise HTTPException(
                    status_code=400,
                    detail="motion field required for data_type='motion'"
                )
            result = await anomaly_service.detect_motion_anomaly(request.motion)

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown data type: {request.data_type}"
            )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}. Is the model trained?"
        )


@router.post("/detect/biometric", response_model=AnomalyResult)
async def detect_biometric_anomaly(reading: BiometricReading):
    """
    Shorthand endpoint to detect biometric anomalies.

    Provide a biometric reading and get back anomaly detection result.
    """
    try:
        return await anomaly_service.detect_biometric_anomaly(reading)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}. Is the biometric model trained?"
        )


@router.post("/detect/motion", response_model=AnomalyResult)
async def detect_motion_anomaly(reading: MotionReading):
    """
    Shorthand endpoint to detect motion anomalies.

    Provide a motion reading and get back anomaly detection result.
    """
    try:
        return await anomaly_service.detect_motion_anomaly(reading)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}. Is the motion model trained?"
        )


@router.get("/status/biometric", response_model=ModelStatus)
async def get_biometric_model_status():
    """Check if the biometric anomaly model is trained."""
    return ModelStatus(
        model_name="biometric_anomaly",
        is_trained=anomaly_service.is_trained("biometric_anomaly"),
    )


@router.get("/status/motion", response_model=ModelStatus)
async def get_motion_model_status():
    """Check if the motion anomaly model is trained."""
    return ModelStatus(
        model_name="motion_anomaly",
        is_trained=anomaly_service.is_trained("motion_anomaly"),
    )


@router.post("/interactive/biometric", response_model=AnomalyResult)
async def interactive_biometric_demo(
    heart_rate: float = 72,
    systolic_bp: float = 120,
    diastolic_bp: float = 78,
    temperature: float = 98.2,
    activity_level: str = "resting"
):
    """
    Interactive demo endpoint for biometric anomaly detection.

    Accepts query parameters for easy testing:
    - heart_rate: BPM (default: 72)
    - systolic_bp: Systolic blood pressure (default: 120)
    - diastolic_bp: Diastolic blood pressure (default: 78)
    - temperature: Body temp in F (default: 98.2)
    - activity_level: resting, light, or moderate (default: resting)
    """
    reading = BiometricReading(
        heart_rate=heart_rate,
        systolic_bp=systolic_bp,
        diastolic_bp=diastolic_bp,
        temperature=temperature,
        activity_level=activity_level,
    )

    try:
        return await anomaly_service.detect_biometric_anomaly(reading)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}. Train the model first via POST /api/anomaly/train"
        )


@router.post("/interactive/motion", response_model=AnomalyResult)
async def interactive_motion_demo(
    room: str = "living_room",
    hour: int = 14,
    activity_duration_minutes: int = 30,
    motion_intensity: float = 0.5,
):
    """
    Interactive demo endpoint for motion anomaly detection.

    Accepts query parameters for easy testing:
    - room: bedroom, kitchen, living_room, or bathroom (default: living_room)
    - hour: Hour of day 0-23 (default: 14)
    - activity_duration_minutes: Duration in minutes (default: 30)
    - motion_intensity: 0-1 scale (default: 0.5)
    """
    reading = MotionReading(
        room=room,
        hour=hour,
        activity_duration_minutes=activity_duration_minutes,
        motion_intensity=motion_intensity,
    )

    try:
        return await anomaly_service.detect_motion_anomaly(reading)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}. Train the model first via POST /api/anomaly/train"
        )


# ==================== Random Biometric Generation ====================


@router.get("/random/biometric", response_model=BiometricReading)
async def get_random_biometric(
    type: str = Query(default="normal", description="Type of values: 'normal' or 'abnormal'")
):
    """
    Generate randomized biometric values.

    Each call produces different values within appropriate ranges:
    - **type=normal**: Values within healthy ranges (HR 65-80, SysBP 115-128, etc.)
    - **type=abnormal**: Values outside healthy ranges (HR <55 or >100, etc.)

    Use this to test the anomaly detector with varying inputs.
    """
    if type not in ("normal", "abnormal"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type: {type}. Use 'normal' or 'abnormal'."
        )

    is_normal = type == "normal"
    return generate_random_biometrics(is_normal=is_normal)


# ==================== Motion Pattern Anomaly Detection ====================


@router.post("/train/motion_pattern", response_model=AnomalyTrainResponse)
async def train_motion_pattern_model():
    """
    Train the motion pattern anomaly detector.

    Uses enhanced training data with:
    - 30-minute time windows
    - Room transitions
    - Door events
    - Margaret's daily routine model
    """
    try:
        result = await anomaly_service.train_motion_pattern_model()
        return result
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training data not found. Run data generator first: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training failed: {str(e)}"
        )


@router.post("/detect/motion_pattern", response_model=AnomalyResult)
async def detect_motion_pattern_anomaly(reading: MotionPatternReading):
    """
    Detect if a motion pattern is anomalous.

    Analyzes:
    - Is the room expected for this time of day?
    - Is the motion intensity normal?
    - Are there unexpected door events?
    - Has there been unusual stillness?
    """
    try:
        return await anomaly_service.detect_motion_pattern_anomaly(reading)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}. Is the motion pattern model trained?"
        )


@router.get("/status/motion_pattern", response_model=ModelStatus)
async def get_motion_pattern_model_status():
    """Check if the motion pattern anomaly model is trained."""
    return ModelStatus(
        model_name="motion_pattern_anomaly",
        is_trained=anomaly_service.is_trained("motion_pattern_anomaly"),
    )


@router.get("/random/motion_pattern", response_model=MotionPatternReading)
async def get_random_motion_pattern(
    type: str = Query(default="normal", description="Type of pattern: 'normal' or 'abnormal'")
):
    """
    Generate randomized motion pattern values.

    Each call produces different values:
    - **type=normal**: Normal pattern following Margaret's routine
    - **type=abnormal**: Abnormal pattern (wrong room, night activity, etc.)
    """
    if type not in ("normal", "abnormal"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type: {type}. Use 'normal' or 'abnormal'."
        )

    is_normal = type == "normal"
    data = generate_random_motion_pattern(is_normal=is_normal)

    return MotionPatternReading(
        time_window=data["time_window"],
        current_room=data["current_room"],
        previous_room=data["previous_room"],
        time_in_room_minutes=data["time_in_room_minutes"],
        door_events_count=data["door_events_count"],
        motion_intensity=data["motion_intensity"],
        is_expected_location=data["is_expected_location"],
    )


@router.post("/interactive/motion_pattern", response_model=AnomalyResult)
async def interactive_motion_pattern_demo(
    time_window: int = Query(default=24, ge=0, le=47, description="30-min time slot (0-47)"),
    current_room: str = Query(default="kitchen", description="Current room"),
    previous_room: str = Query(default="living_room", description="Previous room"),
    time_in_room_minutes: int = Query(default=30, ge=0, description="Time in room"),
    door_events_count: int = Query(default=0, ge=0, description="Door events"),
    motion_intensity: float = Query(default=0.5, ge=0, le=1, description="Motion intensity 0-1"),
):
    """
    Interactive demo endpoint for motion pattern anomaly detection.

    Accepts query parameters for easy testing:
    - time_window: 30-min slot (0=midnight, 12=6am, 24=noon, 36=6pm)
    - current_room: bedroom, kitchen, living_room, bathroom
    - previous_room: where Margaret was before
    - time_in_room_minutes: duration in current room
    - door_events_count: front door events in this window
    - motion_intensity: activity level 0-1
    """
    reading = MotionPatternReading(
        time_window=time_window,
        current_room=current_room,
        previous_room=previous_room,
        time_in_room_minutes=time_in_room_minutes,
        door_events_count=door_events_count,
        motion_intensity=motion_intensity,
        is_expected_location=True,  # Will be calculated
    )

    try:
        return await anomaly_service.detect_motion_pattern_anomaly(reading)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}. Train the motion pattern model first."
        )


# ==================== Model Persistence (Save/Load) ====================


@router.post("/save/{model_name}")
async def save_anomaly_model(
    model_name: str,
    backend: str = Query(default="one_class_svm", description="Backend: one_class_svm or isolation_forest")
):
    """
    Save a trained anomaly model to disk.

    Models can be loaded later for instant use without retraining.
    """
    try:
        success = await anomaly_service.save_model(model_name, backend)
        if success:
            return {"status": "saved", "model_name": model_name, "backend": backend}
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save model: {model_name}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Save failed: {str(e)}"
        )


@router.post("/load/{model_name}")
async def load_anomaly_model(
    model_name: str,
    backend: str = Query(default="one_class_svm", description="Backend: one_class_svm or isolation_forest")
):
    """
    Load a previously saved anomaly model from disk.

    Loads instantly without retraining (~1 second vs 10+ seconds).
    """
    try:
        success = await anomaly_service.load_model(model_name, backend)
        if success:
            return {"status": "loaded", "model_name": model_name, "backend": backend}
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Model not found: {model_name}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Load failed: {str(e)}"
        )


# ==================== Training Data Preview ====================


@router.get("/training-data/biometric")
async def get_biometric_training_data(
    limit: int = Query(default=10, ge=1, le=250, description="Number of samples to return")
):
    """
    Get biometric training data samples for preview.

    Returns a subset of the training data used to train the biometric anomaly model.
    """
    try:
        data_file = TRAINING_DATA_DIR / "biometric_data.json"
        if not data_file.exists():
            raise HTTPException(status_code=404, detail="Biometric training data not found")

        with open(data_file) as f:
            data = json.load(f)

        # Handle both list format and dict with samples key
        if isinstance(data, list):
            samples_list = data
        else:
            samples_list = data.get("samples", [])

        samples = samples_list[:limit]
        return {
            "total_samples": len(samples_list),
            "returned_samples": len(samples),
            "samples": samples,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load training data: {str(e)}")


@router.get("/training-data/motion_pattern")
async def get_motion_pattern_training_data(
    limit: int = Query(default=10, ge=1, le=250, description="Number of samples to return")
):
    """
    Get motion pattern training data samples for preview.

    Returns a subset of the training data used to train the motion pattern anomaly model.
    """
    try:
        data_file = TRAINING_DATA_DIR / "motion_pattern_data.json"
        if not data_file.exists():
            raise HTTPException(status_code=404, detail="Motion pattern training data not found")

        with open(data_file) as f:
            data = json.load(f)

        # Handle both list format and dict with samples key
        if isinstance(data, list):
            samples_list = data
        else:
            samples_list = data.get("samples", [])

        samples = samples_list[:limit]
        return {
            "total_samples": len(samples_list),
            "returned_samples": len(samples),
            "samples": samples,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load training data: {str(e)}")
