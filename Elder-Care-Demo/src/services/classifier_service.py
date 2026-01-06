"""
Text Classification Service

Wraps LlamaFarm's Universal Runtime classifier API for voice transcript classification.
Uses SetFit for efficient few-shot text classification.
"""

import json
import time
from pathlib import Path
from typing import Any, Optional
import httpx

from src.models.schemas import (
    ClassificationResult,
    ClassificationTrainResponse,
    ClassificationPredictResponse,
)


class ClassifierService:
    """Service for text classification using LlamaFarm Universal Runtime."""

    def __init__(self, runtime_url: str = "http://localhost:11540"):
        self.runtime_url = runtime_url
        self.client = httpx.Client(timeout=120.0)  # Training can take time
        self._trained_models: dict[str, dict[str, Any]] = {}

    def _load_training_data(self) -> list[dict[str, str]]:
        """Load voice transcript training data."""
        data_dir = Path("data/training")
        filepath = data_dir / "voice_data.json"

        with open(filepath) as f:
            return json.load(f)

    async def train_classifier(
        self,
        model_name: str = "voice_classifier",
        base_model: str = "sentence-transformers/all-MiniLM-L6-v2",
        num_iterations: int = 20
    ) -> ClassificationTrainResponse:
        """Train the voice transcript classifier."""
        start_time = time.time()

        # Load training data
        training_data = self._load_training_data()

        # Call LlamaFarm API
        response = self.client.post(
            f"{self.runtime_url}/v1/classifier/fit",
            json={
                "model": model_name,
                "base_model": base_model,
                "training_data": training_data,
                "num_iterations": num_iterations,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Training failed: {response.text}")

        result = response.json()
        training_time = (time.time() - start_time) * 1000

        # Get unique labels
        labels = list(set(d["label"] for d in training_data))

        # Store model info
        self._trained_models[model_name] = {
            "base_model": base_model,
            "labels": labels,
            "samples": len(training_data),
            "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        return ClassificationTrainResponse(
            status="fitted",
            model_name=model_name,
            samples_fitted=len(training_data),
            num_classes=len(labels),
            labels=labels,
            training_time_ms=training_time,
        )

    async def predict(
        self,
        texts: list[str],
        model_name: str = "voice_classifier"
    ) -> ClassificationPredictResponse:
        """Classify voice transcripts."""
        response = self.client.post(
            f"{self.runtime_url}/v1/classifier/predict",
            json={
                "model": model_name,
                "texts": texts,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Prediction failed: {response.text}")

        result = response.json()

        # Parse results
        classifications = []
        for item in result.get("data", []):
            classifications.append(ClassificationResult(
                text=item["text"],
                label=item["label"],
                score=item.get("score", 0.0),
                all_scores=item.get("all_scores", {}),
            ))

        return ClassificationPredictResponse(
            results=classifications,
            model_name=model_name,
        )

    async def classify_single(
        self,
        text: str,
        model_name: str = "voice_classifier"
    ) -> ClassificationResult:
        """Classify a single text."""
        response = await self.predict([text], model_name)
        if response.results:
            return response.results[0]
        raise RuntimeError("No classification result returned")

    def is_trained(self, model_name: str) -> bool:
        """Check if a model is trained - queries LlamaFarm if not in local cache."""
        # First check local cache
        if model_name in self._trained_models:
            return True
        # Then check LlamaFarm's saved models registry
        # Endpoint is /v1/classifier/models (not /list)
        try:
            response = self.client.get(f"{self.runtime_url}/v1/classifier/models")
            if response.status_code == 200:
                data = response.json()
                # Format: {"object": "list", "data": [{"name": "...", ...}, ...]}
                models = data.get("data", [])
                for m in models:
                    if isinstance(m, dict) and m.get("name") == model_name:
                        # Found saved model - load it to make it available
                        self._trained_models[model_name] = {
                            "labels": m.get("labels", []),
                            "num_classes": m.get("num_classes", 0),
                            "loaded_from_registry": True,
                        }
                        return True
        except Exception:
            pass
        return False

    def get_model_info(self, model_name: str) -> Optional[dict[str, Any]]:
        """Get info about a trained model."""
        return self._trained_models.get(model_name)

    async def save_model(self, model_name: str) -> bool:
        """Save a trained classifier to disk."""
        response = self.client.post(
            f"{self.runtime_url}/v1/classifier/save",
            json={"model": model_name},
        )
        return response.status_code == 200

    async def load_model(self, model_name: str) -> bool:
        """Load a classifier from disk."""
        response = self.client.post(
            f"{self.runtime_url}/v1/classifier/load",
            json={"model": model_name},
        )
        if response.status_code == 200:
            self._trained_models[model_name] = {"loaded": True}
            return True
        return False


# Singleton instance
classifier_service = ClassifierService()
