import { StreamEvent } from "./types";

export async function* parseSSEStream(
  response: Response
): AsyncGenerator<StreamEvent> {
  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);

    for (let i = 0; i < parts.length - 1; i++) {
      const chunk = parts[i];
      if (!chunk.startsWith("data:")) continue;

      const data = chunk.replace(/^data:\s*/, "").trim();
      if (data === "[DONE]") {
        yield { done: true };
        return;
      }

      try {
        const json = JSON.parse(data);

        // Support both OpenAI format and our custom agent format
        const token = json.token ?? json.choices?.[0]?.delta?.content ?? "";
        const citations = json.citations ?? json.choices?.[0]?.delta?.citations;
        const done = json.done;

        yield { token, citations, done };
      } catch (e) {
        // Ignore non-JSON heartbeats
        console.warn("Failed to parse SSE data:", data, e);
      }
    }

    buffer = parts[parts.length - 1];
  }
}
