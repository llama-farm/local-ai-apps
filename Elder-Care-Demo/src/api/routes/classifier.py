"""
Classification API Routes

Endpoints for training and using the voice transcript classifier.
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from src.models.schemas import (
    ClassificationTrainRequest,
    ClassificationTrainResponse,
    ClassificationPredictRequest,
    ClassificationPredictResponse,
    ClassificationResult,
    ModelStatus,
)
from src.services.classifier_service import classifier_service

router = APIRouter(prefix="/api/classifier", tags=["Classification"])

TRAINING_DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "training"


@router.post("/train", response_model=ClassificationTrainResponse)
async def train_classifier(request: ClassificationTrainRequest):
    """
    Train the voice transcript classifier on labeled examples.

    Uses SetFit for efficient few-shot learning with sentence transformers.
    Training data is loaded from data/training/voice_data.json.
    """
    try:
        result = await classifier_service.train_classifier(
            model_name=request.model_name,
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


@router.post("/predict", response_model=ClassificationPredictResponse)
async def predict(request: ClassificationPredictRequest):
    """
    Classify voice transcripts.

    Returns the predicted label and confidence scores for each input text.
    """
    try:
        return await classifier_service.predict(request.texts)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}. Is the model trained?"
        )


@router.post("/classify", response_model=ClassificationResult)
async def classify_single(text: str):
    """
    Classify a single voice transcript.

    Shorthand endpoint for quick classification.
    """
    try:
        return await classifier_service.classify_single(text)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Classification failed: {str(e)}. Is the model trained?"
        )


@router.get("/status", response_model=ModelStatus)
async def get_classifier_status():
    """Check if the voice classifier is trained."""
    model_name = "voice_classifier"
    info = classifier_service.get_model_info(model_name)

    return ModelStatus(
        model_name=model_name,
        is_trained=classifier_service.is_trained(model_name),
        samples_count=info.get("samples") if info else None,
        trained_at=info.get("trained_at") if info else None,
    )


@router.post("/interactive", response_model=ClassificationResult)
async def interactive_classify(
    text: str = "I'm feeling a bit dizzy today"
):
    """
    Interactive demo endpoint for classification.

    Try different phrases to see how they're classified:
    - Routine: "Good morning, time for my show"
    - Concern: "I'm feeling a bit dizzy"
    - Emergency: "Help! I've fallen!"
    - Positive: "I'm feeling great today"
    """
    try:
        return await classifier_service.classify_single(text)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Classification failed: {str(e)}. Train the model first via POST /api/classifier/train"
        )


@router.post("/demo", response_model=list[ClassificationResult])
async def demo_classification():
    """
    Demo endpoint that classifies several example phrases.

    Returns classifications for:
    - A routine phrase
    - A concern phrase
    - An emergency phrase
    - A positive phrase
    """
    demo_texts = [
        "Good morning, time for my show",
        "I'm feeling a bit dizzy",
        "Help! I've fallen and can't get up!",
        "I'm feeling great today"
    ]

    try:
        response = await classifier_service.predict(demo_texts)
        return response.results
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Demo failed: {str(e)}. Train the model first."
        )


# ==================== Model Persistence (Save/Load) ====================


@router.post("/save/{model_name}")
async def save_classifier_model(model_name: str = "voice_classifier"):
    """
    Save a trained classifier to disk.

    Use this after training to avoid the 30+ second training time during demos.
    """
    try:
        success = await classifier_service.save_model(model_name)
        if success:
            return {"status": "saved", "model_name": model_name}
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save classifier: {model_name}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Save failed: {str(e)}"
        )


@router.post("/load/{model_name}")
async def load_classifier_model(model_name: str = "voice_classifier"):
    """
    Load a previously saved classifier from disk.

    Loads instantly (~1 second) instead of training (~30 seconds).
    """
    try:
        success = await classifier_service.load_model(model_name)
        if success:
            return {"status": "loaded", "model_name": model_name}
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Classifier not found: {model_name}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Load failed: {str(e)}"
        )


# ==================== Training Data Preview ====================


@router.get("/training-data")
async def get_classifier_training_data(
    limit: int = Query(default=20, ge=1, le=100, description="Number of samples to return"),
    label: Optional[str] = Query(default=None, description="Filter by label (routine, concern, emergency, positive)")
):
    """
    Get voice transcript training data samples for preview.

    Returns labeled examples used to train the classifier.
    """
    try:
        data_file = TRAINING_DATA_DIR / "voice_data.json"
        if not data_file.exists():
            raise HTTPException(status_code=404, detail="Voice training data not found")

        with open(data_file) as f:
            data = json.load(f)

        # Filter by label if specified
        if label:
            data = [d for d in data if d.get("label") == label]

        # Count by label
        label_counts = {}
        for d in data:
            lbl = d.get("label", "unknown")
            label_counts[lbl] = label_counts.get(lbl, 0) + 1

        samples = data[:limit]
        return {
            "total_samples": len(data),
            "returned_samples": len(samples),
            "label_counts": label_counts,
            "samples": samples,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load training data: {str(e)}")
