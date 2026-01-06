"""
Streaming Demo Service

Provides SSE streaming for the live demo, simulating real-time data
from Margaret's monitoring sensors. Integrates with anomaly detection,
classification, and agent services.
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Optional, Callable, Any
from dataclasses import dataclass

from src.services.anomaly_service import AnomalyService
from src.services.classifier_service import ClassifierService
from src.services.agent_service import AgentService


@dataclass
class StreamEvent:
    """Represents a single event in the demo stream."""
    event_type: str
    data: dict
    time_label: str
    narrator: str
    result: Optional[dict] = None


class StreamingService:
    """Service for streaming demo events with real-time ML processing."""

    def __init__(
        self,
        anomaly_service: Optional[AnomalyService] = None,
        classifier_service: Optional[ClassifierService] = None,
        agent_service: Optional[AgentService] = None,
    ):
        self.anomaly_service = anomaly_service or AnomalyService()
        self.classifier_service = classifier_service or ClassifierService()
        self.agent_service = agent_service or AgentService()
        self._scenario: Optional[dict] = None
        self._is_running = False
        self._speed_multiplier = 1.0

    def load_scenario(self, scenario_path: Optional[str] = None) -> dict:
        """Load the demo scenario from JSON file."""
        if scenario_path is None:
            scenario_path = str(
                Path(__file__).parent.parent.parent /
                "data" / "training" / "demo_scenario.json"
            )

        with open(scenario_path, 'r') as f:
            self._scenario = json.load(f)

        return self._scenario

    def get_scenario(self) -> Optional[dict]:
        """Get the currently loaded scenario."""
        if self._scenario is None:
            self.load_scenario()
        return self._scenario

    async def process_event(self, event: dict) -> dict:
        """Process a single event through the appropriate ML service."""
        event_type = event.get("type")
        data = event.get("data", {})
        result = {"processed": True, "service": event_type}

        try:
            if event_type == "biometric":
                # Process through anomaly detection
                anomaly_result = await self.anomaly_service.detect_biometric_anomaly(data)
                result["anomaly_detection"] = {
                    "is_anomaly": anomaly_result.is_anomaly,
                    "score": anomaly_result.score,
                    "details": anomaly_result.details,
                }

            elif event_type == "motion":
                # Process motion data through anomaly detection
                anomaly_result = await self.anomaly_service.detect_motion_anomaly(data)
                result["anomaly_detection"] = {
                    "is_anomaly": anomaly_result.is_anomaly,
                    "score": anomaly_result.score,
                    "details": anomaly_result.details,
                }

            elif event_type == "voice":
                # Process through classifier
                text = data.get("text", "")
                class_result = await self.classifier_service.classify(text)
                result["classification"] = {
                    "label": class_result.label,
                    "score": class_result.score,
                    "all_scores": class_result.all_scores,
                }

            elif event_type == "agent_decision":
                # Agent reasoning and decision
                result["agent"] = {
                    "decision": data.get("decision"),
                    "reasoning": data.get("reasoning"),
                    "actions": data.get("actions", []),
                }

            elif event_type == "tool_execution":
                # Tool execution
                tool_name = data.get("tool")
                tool_args = data.get("arguments", {})
                tool_result = await self.agent_service.execute_tool(tool_name, tool_args)
                result["tool_call"] = {
                    "tool_name": tool_name,
                    "arguments": tool_args,
                    "result": tool_result or data.get("result"),
                }

            elif event_type in ("agent_summary", "resolution"):
                # Pass through data as-is
                result[event_type] = data

        except Exception as e:
            result["error"] = str(e)
            result["fallback"] = True
            # Include expected results as fallback
            if "expected_classification" in event:
                result["classification"] = {
                    "label": event["expected_classification"],
                    "score": 0.85,
                    "all_scores": {},
                }
            if "expected_anomaly" in event:
                result["anomaly_detection"] = {
                    "is_anomaly": event["expected_anomaly"],
                    "score": 0.75 if event["expected_anomaly"] else 0.25,
                    "details": {},
                }

        return result

    async def stream_demo(
        self,
        speed_multiplier: float = 1.0,
        on_event: Optional[Callable[[dict], Any]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream the demo scenario as SSE events.

        Args:
            speed_multiplier: Speed up (>1) or slow down (<1) the demo
            on_event: Optional callback for each event

        Yields:
            SSE formatted event strings
        """
        self._is_running = True
        self._speed_multiplier = speed_multiplier

        scenario = self.get_scenario()
        if not scenario:
            yield self._format_sse("error", {"message": "No scenario loaded"})
            return

        # Send initial event
        yield self._format_sse("demo_start", {
            "title": scenario.get("title"),
            "description": scenario.get("description"),
            "total_events": len(scenario.get("events", [])),
        })

        previous_delay = 0

        for i, event in enumerate(scenario.get("events", [])):
            if not self._is_running:
                yield self._format_sse("demo_stopped", {"reason": "User stopped"})
                break

            # Calculate delay from previous event
            current_delay = event.get("delay_ms", 0)
            wait_time = (current_delay - previous_delay) / 1000.0 / speed_multiplier
            previous_delay = current_delay

            if wait_time > 0:
                await asyncio.sleep(wait_time)

            # Process the event through ML services
            result = await self.process_event(event)

            # Build the event payload
            payload = {
                "index": i,
                "total": len(scenario["events"]),
                "time_label": event.get("time_label"),
                "type": event.get("type"),
                "narrator": event.get("narrator"),
                "data": event.get("data"),
                "result": result,
            }

            if on_event:
                on_event(payload)

            yield self._format_sse("event", payload)

        # Send completion event
        yield self._format_sse("demo_complete", {
            "total_events": len(scenario.get("events", [])),
            "title": scenario.get("title"),
        })

        self._is_running = False

    def stop_demo(self):
        """Stop the currently running demo."""
        self._is_running = False

    def is_running(self) -> bool:
        """Check if demo is currently running."""
        return self._is_running

    def _format_sse(self, event_type: str, data: dict) -> str:
        """Format data as SSE event string."""
        json_data = json.dumps(data)
        return f"event: {event_type}\ndata: {json_data}\n\n"


# Singleton instance for route handlers
_streaming_service: Optional[StreamingService] = None


def get_streaming_service() -> StreamingService:
    """Get or create the streaming service singleton."""
    global _streaming_service
    if _streaming_service is None:
        _streaming_service = StreamingService()
    return _streaming_service
