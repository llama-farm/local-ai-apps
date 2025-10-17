import { parseSSEStream } from "./sse";
import { ChatRequest, StreamEvent } from "./types";

export async function* streamChat(
  request: ChatRequest
): AsyncGenerator<StreamEvent> {
  // Use agentic endpoint for better RAG query generation
  const endpoint = request.ragEnabled ? "/api/agent-chat" : "/api/chat";

  console.log("=== FRONTEND ROUTING ===");
  console.log("ragEnabled:", request.ragEnabled);
  console.log("Endpoint:", endpoint);
  console.log("Request:", request);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Chat API failed: ${response.status} ${response.statusText}`);
  }

  yield* parseSSEStream(response);
}
