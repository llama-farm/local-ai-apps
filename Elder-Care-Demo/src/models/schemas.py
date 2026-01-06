"""
Pydantic models for the Elder Care Monitoring API
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


# ==================== Biometric Models ====================

class BiometricReading(BaseModel):
    """A single biometric reading from sensors."""
    heart_rate: float = Field(..., ge=30, le=200, description="Heart rate in BPM")
    systolic_bp: float = Field(..., ge=60, le=220, description="Systolic blood pressure")
    diastolic_bp: float = Field(..., ge=40, le=140, description="Diastolic blood pressure")
    temperature: float = Field(..., ge=95.0, le=105.0, description="Body temperature in Fahrenheit")
    activity_level: str = Field(default="resting", description="Current activity level")
    timestamp: Optional[str] = None


class BiometricTrainingData(BaseModel):
    """Training data for biometric anomaly detection."""
    samples: list[BiometricReading]


# ==================== Motion Models ====================

class MotionReading(BaseModel):
    """A single motion sensor reading."""
    room: str = Field(..., description="Room where motion detected")
    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    activity_duration_minutes: int = Field(..., ge=0, description="Duration of activity")
    motion_intensity: float = Field(..., ge=0, le=1, description="Motion intensity 0-1")
    door_event: bool = Field(default=False, description="Whether door opened/closed")
    timestamp: Optional[str] = None


class MotionTrainingData(BaseModel):
    """Training data for motion anomaly detection."""
    samples: list[MotionReading]


# ==================== Enhanced Motion Pattern Models ====================

class MotionPatternReading(BaseModel):
    """
    Enhanced motion pattern reading for detecting abnormal movement through the house.
    Uses 30-minute time windows and tracks room transitions, door events, and activity.
    """
    time_window: int = Field(..., ge=0, le=47, description="30-min time slot (0-47 for 24 hours)")
    current_room: str = Field(..., description="Current room: bedroom, kitchen, living_room, bathroom")
    previous_room: str = Field(..., description="Previous room for transition tracking")
    time_in_room_minutes: int = Field(..., ge=0, le=120, description="Duration in current room")
    door_events_count: int = Field(default=0, ge=0, description="Front door events in this window")
    motion_intensity: float = Field(..., ge=0, le=1, description="Motion intensity 0-1 scale")
    is_expected_location: bool = Field(default=True, description="Based on Margaret's routine")
    timestamp: Optional[str] = None


class MotionPatternTrainingData(BaseModel):
    """Training data for motion pattern anomaly detection."""
    samples: list[MotionPatternReading]


# ==================== Anomaly Detection Models ====================

class AnomalyTrainRequest(BaseModel):
    """Request to train an anomaly detection model."""
    model_name: str = Field(default="biometric_anomaly", description="Name for the model")
    data_type: str = Field(..., description="Type of data: 'biometric' or 'motion'")


class AnomalyDetectRequest(BaseModel):
    """Request to detect anomalies."""
    data_type: str = Field(..., description="Type of data: 'biometric' or 'motion'")
    biometric: Optional[BiometricReading] = None
    motion: Optional[MotionReading] = None


class AnomalyResult(BaseModel):
    """Result of anomaly detection."""
    is_anomaly: bool
    score: float = Field(..., description="Anomaly score (higher = more anomalous)")
    details: dict[str, Any] = Field(default_factory=dict)
    input_data: dict[str, Any]


class AnomalyTrainResponse(BaseModel):
    """Response from training an anomaly model."""
    status: str
    model_name: str
    samples_fitted: int
    training_time_ms: float


# ==================== Classification Models ====================

class VoiceTranscript(BaseModel):
    """A voice transcript to classify."""
    text: str = Field(..., min_length=1, description="The transcript text")
    confidence: float = Field(default=1.0, ge=0, le=1, description="Speech recognition confidence")


class ClassificationTrainRequest(BaseModel):
    """Request to train the voice classifier."""
    model_name: str = Field(default="voice_classifier", description="Name for the classifier")


class ClassificationPredictRequest(BaseModel):
    """Request to classify voice transcripts."""
    texts: list[str] = Field(..., min_length=1, description="Texts to classify")


class ClassificationResult(BaseModel):
    """Result of text classification."""
    text: str
    label: str
    score: float = Field(..., description="Confidence score for predicted label")
    all_scores: dict[str, float] = Field(default_factory=dict, description="Scores for all labels")


class ClassificationTrainResponse(BaseModel):
    """Response from training classifier."""
    status: str
    model_name: str
    samples_fitted: int
    num_classes: int
    labels: list[str]
    training_time_ms: float


class ClassificationPredictResponse(BaseModel):
    """Response from classification prediction."""
    results: list[ClassificationResult]
    model_name: str


# ==================== Agent Models ====================

class SensorContext(BaseModel):
    """Current context from all sensors for agent analysis."""
    recent_biometrics: list[BiometricReading] = Field(default_factory=list)
    recent_motion: list[MotionReading] = Field(default_factory=list)
    recent_voice: list[VoiceTranscript] = Field(default_factory=list)
    anomalies_detected: list[AnomalyResult] = Field(default_factory=list)
    classifications: list[ClassificationResult] = Field(default_factory=list)
    summary: Optional[str] = None


class AgentAnalyzeRequest(BaseModel):
    """Request for agent to analyze current situation."""
    context: SensorContext
    additional_info: Optional[str] = None


class ToolCall(BaseModel):
    """A tool call made by the agent."""
    tool_name: str
    arguments: dict[str, Any]
    result: Optional[str] = None


class AgentResponse(BaseModel):
    """Response from the agent."""
    reasoning: str = Field(..., description="Agent's reasoning about the situation")
    decision: str = Field(..., description="What action to take")
    tool_calls: list[ToolCall] = Field(default_factory=list)
    raw_response: Optional[str] = None


# ==================== Streaming Models ====================

class StreamEvent(BaseModel):
    """An event in the streaming demo."""
    event_type: str
    time_label: str
    data: dict[str, Any]
    narrator: Optional[str] = None
    analysis_result: Optional[dict[str, Any]] = None


# ==================== Status Models ====================

class ModelStatus(BaseModel):
    """Status of a trained model."""
    model_name: str
    is_trained: bool
    samples_count: Optional[int] = None
    trained_at: Optional[str] = None


class SystemStatus(BaseModel):
    """Overall system status."""
    api_status: str = "ok"
    llamafarm_runtime: bool = False
    llamafarm_server: bool = False
    biometric_model: ModelStatus
    motion_model: ModelStatus
    voice_classifier: ModelStatus
