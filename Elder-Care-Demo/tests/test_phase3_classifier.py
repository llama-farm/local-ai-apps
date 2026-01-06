"""
Phase 3 Tests: Classification

Tests for the voice transcript classification API and service.
Note: Some tests require LlamaFarm Universal Runtime to be running.
"""

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.services.classifier_service import ClassifierService


client = TestClient(app)


class TestClassifierAPI:
    """Tests for classification API endpoints."""

    def test_train_endpoint_exists(self):
        """Verify train endpoint exists."""
        response = client.post("/api/classifier/train", json={})
        # 200 means success (LlamaFarm running), 500 means it's not running but endpoint exists
        # 422 means validation error (endpoint exists)
        assert response.status_code in [200, 422, 500]

    def test_predict_endpoint_exists(self):
        """Verify predict endpoint exists."""
        response = client.post("/api/classifier/predict", json={
            "texts": ["test"]
        })
        # 500 means model not trained, but endpoint exists
        assert response.status_code in [200, 500]

    def test_status_endpoint(self):
        """Verify status endpoint works."""
        response = client.get("/api/classifier/status")
        assert response.status_code == 200
        data = response.json()
        assert "is_trained" in data
        assert "model_name" in data

    def test_interactive_endpoint_exists(self):
        """Verify interactive endpoint exists."""
        response = client.post("/api/classifier/interactive")
        # 500 means model not trained, but endpoint exists
        assert response.status_code in [200, 500]

    def test_demo_endpoint_exists(self):
        """Verify demo endpoint exists."""
        response = client.post("/api/classifier/demo")
        assert response.status_code in [200, 500]


class TestClassifierService:
    """Tests for classifier service internals."""

    def test_load_training_data(self):
        """Verify training data can be loaded."""
        service = ClassifierService()
        data = service._load_training_data()

        assert isinstance(data, list)
        assert len(data) >= 80  # At least 80 voice samples

    def test_training_data_structure(self):
        """Verify training data has correct structure."""
        service = ClassifierService()
        data = service._load_training_data()

        for item in data:
            assert "text" in item
            assert "label" in item
            assert isinstance(item["text"], str)
            assert isinstance(item["label"], str)

    def test_training_data_labels(self):
        """Verify training data has all expected labels."""
        service = ClassifierService()
        data = service._load_training_data()

        labels = set(item["label"] for item in data)
        expected = {"routine", "concern", "emergency", "positive"}

        assert labels == expected

    def test_is_trained_default_false(self):
        """Verify new service reports not trained."""
        service = ClassifierService()
        assert service.is_trained("voice_classifier") == False

    def test_get_model_info_none(self):
        """Verify get_model_info returns None for untrained model."""
        service = ClassifierService()
        info = service.get_model_info("voice_classifier")
        assert info is None


class TestClassificationTrainRequest:
    """Tests for train request validation."""

    def test_valid_train_request(self):
        """Verify valid train request passes validation."""
        response = client.post("/api/classifier/train", json={
            "model_name": "test_classifier"
        })
        # Should either succeed or fail due to LlamaFarm, not validation
        assert response.status_code in [200, 500]

    def test_default_model_name(self):
        """Verify default model name is used."""
        # This would require LlamaFarm, so we just check the endpoint accepts empty model_name
        response = client.post("/api/classifier/train", json={})
        # 422 if model_name is required, 500 if LlamaFarm down
        assert response.status_code in [200, 422, 500]


class TestClassificationPredictRequest:
    """Tests for predict request validation."""

    def test_predict_requires_texts(self):
        """Verify predict requires texts field."""
        response = client.post("/api/classifier/predict", json={})
        assert response.status_code == 422  # Validation error

    def test_predict_empty_texts(self):
        """Verify predict rejects empty texts list."""
        response = client.post("/api/classifier/predict", json={
            "texts": []
        })
        assert response.status_code == 422  # Validation error

    def test_predict_valid_texts(self):
        """Verify predict accepts valid texts."""
        response = client.post("/api/classifier/predict", json={
            "texts": ["Hello", "How are you"]
        })
        # Should either succeed or fail due to model not trained
        assert response.status_code in [200, 500]


class TestClassifyEndpoint:
    """Tests for single classification endpoint."""

    def test_classify_single_text(self):
        """Verify single classification endpoint accepts text."""
        response = client.post("/api/classifier/classify?text=Hello")
        assert response.status_code in [200, 500]


# Integration tests requiring LlamaFarm
@pytest.mark.integration
class TestClassifierIntegration:
    """Integration tests requiring LlamaFarm Universal Runtime."""

    @pytest.fixture(autouse=True)
    def check_llamafarm(self):
        """Skip if LlamaFarm is not running."""
        import httpx
        try:
            response = httpx.get("http://localhost:11540/health", timeout=2.0)
            if response.status_code != 200:
                pytest.skip("LlamaFarm Universal Runtime not available")
        except Exception:
            pytest.skip("LlamaFarm Universal Runtime not available")

    def test_train_classifier(self):
        """Test training voice classifier."""
        response = client.post("/api/classifier/train", json={
            "model_name": "test_voice_classifier"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "fitted"
        assert data["num_classes"] == 4
        assert set(data["labels"]) == {"routine", "concern", "emergency", "positive"}

    def test_classify_routine(self):
        """Test classifying routine phrase."""
        # Train first
        client.post("/api/classifier/train", json={
            "model_name": "voice_classifier"
        })

        response = client.post("/api/classifier/predict", json={
            "texts": ["Good morning, time for my show"]
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 1
        assert data["results"][0]["label"] == "routine"

    def test_classify_emergency(self):
        """Test classifying emergency phrase."""
        # Train first
        client.post("/api/classifier/train", json={
            "model_name": "voice_classifier"
        })

        response = client.post("/api/classifier/predict", json={
            "texts": ["Help! I've fallen and I can't get up!"]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["results"][0]["label"] == "emergency"

    def test_classify_concern(self):
        """Test classifying concern phrase."""
        # Train first
        client.post("/api/classifier/train", json={
            "model_name": "voice_classifier"
        })

        response = client.post("/api/classifier/predict", json={
            "texts": ["I'm feeling quite dizzy"]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["results"][0]["label"] == "concern"

    def test_classification_scores(self):
        """Test that classification returns confidence scores."""
        # Train first
        client.post("/api/classifier/train", json={
            "model_name": "voice_classifier"
        })

        response = client.post("/api/classifier/predict", json={
            "texts": ["I'm feeling great today"]
        })
        assert response.status_code == 200
        data = response.json()
        result = data["results"][0]

        assert "score" in result
        assert result["score"] > 0
        assert "all_scores" in result
