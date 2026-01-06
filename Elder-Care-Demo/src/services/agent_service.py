"""
LLM Agent Service

Handles interaction with the LlamaFarm LLM agent that has inline tool definitions.
The agent can analyze sensor data and take actions through tools.
"""

import json
import time
from datetime import datetime
from typing import Any, Optional
import httpx

from src.models.schemas import (
    SensorContext,
    AgentResponse,
    ToolCall,
    BiometricReading,
    MotionReading,
    VoiceTranscript,
    AnomalyResult,
    ClassificationResult,
)


class AgentService:
    """Service for LLM agent interactions with tool calling."""

    def __init__(
        self,
        server_url: str = "http://localhost:8000",  # LlamaFarm API server
        namespace: str = "default",
        project: str = "elder-care-demo"
    ):
        self.server_url = server_url
        self.namespace = namespace
        self.project = project
        self.client = httpx.Client(timeout=120.0)

        # Store tool execution results for demo
        self.tool_log: list[dict[str, Any]] = []
        self.alerts: list[dict[str, Any]] = []
        self.observations: list[dict[str, Any]] = []
        self.monitoring_state = {"frequency": "normal", "until": None}

    def _build_context_message(self, context: SensorContext) -> str:
        """Build a message summarizing the current sensor context."""
        parts = []

        if context.recent_biometrics:
            bio = context.recent_biometrics[-1]  # Most recent
            parts.append(f"""BIOMETRIC DATA:
- Heart Rate: {bio.heart_rate} bpm
- Blood Pressure: {bio.systolic_bp}/{bio.diastolic_bp} mmHg
- Temperature: {bio.temperature} F
- Activity Level: {bio.activity_level}""")

        if context.recent_motion:
            motion = context.recent_motion[-1]
            parts.append(f"""MOTION DATA:
- Room: {motion.room}
- Hour: {motion.hour}:00
- Duration: {motion.activity_duration_minutes} minutes
- Intensity: {motion.motion_intensity}""")

        if context.recent_voice:
            voice = context.recent_voice[-1]
            parts.append(f"""VOICE TRANSCRIPT:
"{voice.text}" (confidence: {voice.confidence})""")

        if context.anomalies_detected:
            anomaly_parts = []
            for a in context.anomalies_detected:
                anomaly_parts.append(f"- Score {a.score:.2f}: {a.details}")
            parts.append(f"""ANOMALIES DETECTED:
{chr(10).join(anomaly_parts)}""")

        if context.classifications:
            class_parts = []
            for c in context.classifications:
                class_parts.append(f'- "{c.text}" -> {c.label} ({c.score:.1%})')
            parts.append(f"""VOICE CLASSIFICATIONS:
{chr(10).join(class_parts)}""")

        if context.summary:
            parts.append(f"""SUMMARY:
{context.summary}""")

        return "\n\n".join(parts) if parts else "No sensor data available."

    async def analyze(
        self,
        context: SensorContext,
        additional_info: Optional[str] = None
    ) -> AgentResponse:
        """Have the agent analyze the current sensor context and decide on actions."""

        # Build the context message
        context_message = self._build_context_message(context)
        if additional_info:
            context_message += f"\n\nADDITIONAL CONTEXT:\n{additional_info}"

        context_message += "\n\nAnalyze this data and decide what action (if any) to take. Explain your reasoning."

        # Call LlamaFarm chat API
        # NOTE: Use simple completion with no RAG for speed
        try:
            response = self.client.post(
                f"{self.server_url}/v1/projects/{self.namespace}/{self.project}/chat/completions",
                json={
                    "messages": [
                        {"role": "user", "content": context_message}
                    ],
                    "model": "care_agent",
                    "temperature": 0.3,  # Lower temp for more consistent decisions
                    "max_tokens": 500,  # Limit response length for speed
                    "rag_enabled": False,  # No RAG - just direct LLM response
                    "stream": False,  # No streaming for simpler handling
                },
                headers={"X-No-Session": "true"},  # Stateless for demo
            )

            if response.status_code != 200:
                # If LlamaFarm isn't available, return a simulated response
                return self._simulate_response(context)

            result = response.json()

            # Parse the response
            assistant_message = result.get("choices", [{}])[0].get("message", {})
            content = assistant_message.get("content", "")
            tool_calls_raw = assistant_message.get("tool_calls", [])

            # Process tool calls
            tool_calls = []
            for tc in tool_calls_raw:
                func = tc.get("function", {})
                tool_call = ToolCall(
                    tool_name=func.get("name", "unknown"),
                    arguments=json.loads(func.get("arguments", "{}")),
                )
                # Execute the tool
                tool_call.result = self._execute_tool(tool_call.tool_name, tool_call.arguments)
                tool_calls.append(tool_call)

            # Extract reasoning and decision from content
            reasoning, decision = self._parse_response_content(content, tool_calls)

            return AgentResponse(
                reasoning=reasoning,
                decision=decision,
                tool_calls=tool_calls,
                raw_response=content,
            )

        except Exception as e:
            # If anything fails, simulate a response
            return self._simulate_response(context)

    def _simulate_response(self, context: SensorContext) -> AgentResponse:
        """Simulate agent response when LlamaFarm isn't available."""
        tool_calls = []
        reasoning = "Analyzing sensor data...\n"
        decision = "continue_monitoring"

        # Check for concerning patterns
        concerns = []

        if context.anomalies_detected:
            for a in context.anomalies_detected:
                if a.is_anomaly and a.score > 0.7:
                    concerns.append(f"High anomaly score: {a.score:.2f}")

        if context.classifications:
            for c in context.classifications:
                if c.label == "emergency":
                    concerns.append(f"Emergency phrase detected: '{c.text}'")
                elif c.label == "concern":
                    concerns.append(f"Concern phrase detected: '{c.text}'")

        if context.recent_biometrics:
            bio = context.recent_biometrics[-1]
            if bio.heart_rate > 100:
                concerns.append(f"Elevated heart rate: {bio.heart_rate}")
            if bio.systolic_bp < 100:
                concerns.append(f"Low blood pressure: {bio.systolic_bp}")

        # Decide based on concerns
        if len(concerns) >= 3 or any("emergency" in c.lower() for c in concerns):
            decision = "escalate"
            reasoning += f"Multiple concerning signals detected:\n- " + "\n- ".join(concerns)
            reasoning += "\n\nDecision: Escalating to emergency contact."

            # Call emergency contact
            tool_call = ToolCall(
                tool_name="call_emergency_contact",
                arguments={
                    "reason": "; ".join(concerns),
                    "urgency": "high"
                }
            )
            tool_call.result = self._execute_tool(tool_call.tool_name, tool_call.arguments)
            tool_calls.append(tool_call)

            # Send alert
            tool_call2 = ToolCall(
                tool_name="send_alert",
                arguments={
                    "message": f"Escalation triggered: {'; '.join(concerns)}",
                    "level": "urgent"
                }
            )
            tool_call2.result = self._execute_tool(tool_call2.tool_name, tool_call2.arguments)
            tool_calls.append(tool_call2)

        elif len(concerns) >= 1:
            decision = "monitor_closely"
            reasoning += f"Some concerning signals:\n- " + "\n- ".join(concerns)
            reasoning += "\n\nDecision: Increasing monitoring frequency."

            # Adjust monitoring
            tool_call = ToolCall(
                tool_name="adjust_monitoring",
                arguments={
                    "frequency": "elevated",
                    "duration_minutes": 30
                }
            )
            tool_call.result = self._execute_tool(tool_call.tool_name, tool_call.arguments)
            tool_calls.append(tool_call)

            # Log observation
            tool_call2 = ToolCall(
                tool_name="log_observation",
                arguments={
                    "observation": "; ".join(concerns),
                    "category": "health"
                }
            )
            tool_call2.result = self._execute_tool(tool_call2.tool_name, tool_call2.arguments)
            tool_calls.append(tool_call2)

        else:
            reasoning += "All readings within normal parameters."
            reasoning += "\n\nDecision: Continue normal monitoring."

        return AgentResponse(
            reasoning=reasoning,
            decision=decision,
            tool_calls=tool_calls,
            raw_response=None,
        )

    def _parse_response_content(
        self,
        content: str,
        tool_calls: list[ToolCall]
    ) -> tuple[str, str]:
        """Parse the agent's response to extract reasoning and decision."""
        reasoning = content
        decision = "continue_monitoring"

        if tool_calls:
            tool_names = [tc.tool_name for tc in tool_calls]
            if "call_emergency_contact" in tool_names:
                decision = "escalate"
            elif "send_alert" in tool_names:
                decision = "alert"
            elif "adjust_monitoring" in tool_names:
                decision = "monitor_closely"
            elif "log_observation" in tool_names:
                decision = "observe"

        return reasoning, decision

    def _execute_tool(self, tool_name: str, arguments: dict[str, Any]) -> str:
        """Execute a tool and return the result."""
        timestamp = datetime.now().isoformat()

        if tool_name == "call_emergency_contact":
            result = f"CALLING: Sarah (daughter) at 555-0123 - Urgency: {arguments.get('urgency', 'unknown')}"
            self.tool_log.append({
                "timestamp": timestamp,
                "tool": tool_name,
                "arguments": arguments,
                "result": result
            })
            return result

        elif tool_name == "send_alert":
            alert = {
                "timestamp": timestamp,
                "level": arguments.get("level", "info"),
                "message": arguments.get("message", ""),
            }
            self.alerts.append(alert)
            result = f"Alert sent to care team dashboard: [{alert['level'].upper()}] {alert['message']}"
            self.tool_log.append({
                "timestamp": timestamp,
                "tool": tool_name,
                "arguments": arguments,
                "result": result
            })
            return result

        elif tool_name == "adjust_monitoring":
            self.monitoring_state = {
                "frequency": arguments.get("frequency", "normal"),
                "duration_minutes": arguments.get("duration_minutes", 30),
                "started_at": timestamp,
            }
            result = f"Monitoring adjusted to {self.monitoring_state['frequency']} for {self.monitoring_state['duration_minutes']} minutes"
            self.tool_log.append({
                "timestamp": timestamp,
                "tool": tool_name,
                "arguments": arguments,
                "result": result
            })
            return result

        elif tool_name == "log_observation":
            observation = {
                "timestamp": timestamp,
                "category": arguments.get("category", "general"),
                "observation": arguments.get("observation", ""),
            }
            self.observations.append(observation)
            result = f"Observation logged: [{observation['category']}] {observation['observation']}"
            self.tool_log.append({
                "timestamp": timestamp,
                "tool": tool_name,
                "arguments": arguments,
                "result": result
            })
            return result

        else:
            result = f"Unknown tool: {tool_name}"
            self.tool_log.append({
                "timestamp": timestamp,
                "tool": tool_name,
                "arguments": arguments,
                "result": result,
                "error": True
            })
            return result

    def get_tool_log(self) -> list[dict[str, Any]]:
        """Get the log of all tool executions."""
        return self.tool_log

    def get_alerts(self) -> list[dict[str, Any]]:
        """Get all alerts that have been sent."""
        return self.alerts

    def get_observations(self) -> list[dict[str, Any]]:
        """Get all observations that have been logged."""
        return self.observations

    def get_monitoring_state(self) -> dict[str, Any]:
        """Get current monitoring state."""
        return self.monitoring_state

    def reset(self):
        """Reset all stored state (for demo resets)."""
        self.tool_log = []
        self.alerts = []
        self.observations = []
        self.monitoring_state = {"frequency": "normal", "until": None}


# Singleton instance
agent_service = AgentService()
