import { NextRequest } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "medical-records-project";
const LF_MODEL = process.env.NEXT_PUBLIC_LF_MODEL || "default";
const LF_DATABASE = process.env.NEXT_PUBLIC_LF_DATABASE || "medical_db";

const SYSTEM_PROMPT = `You are a careful healthcare record explainer. Summarize clearly, define jargon, and surface deltas vs prior results. ALWAYS cite sources with titles and page numbers when available. Avoid clinical advice. Output sections: TL;DR, Key Findings, Deltas, Suggested Questions.`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, excerpts = [], topK = 6, ragEnabled = true } = await req.json();

    if (!prompt) {
      return new Response("Missing prompt", { status: 400 });
    }

    const contextBlock = excerpts.length
      ? `\n\n<LOCAL_EXCERPTS>\n${excerpts.map((text: string, i: number) => `[ex${i + 1}] ${text}`).join("\n\n")}\n</LOCAL_EXCERPTS>`
      : "";

    const userContent = `${prompt}${contextBlock}`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    const lfUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/chat/completions`;

    const lfRequest: any = {
      model: LF_MODEL,
      stream: true,
      messages,
    };

    // Only add RAG parameters if enabled
    if (ragEnabled) {
      lfRequest.rag_enabled = true;
      lfRequest.database = LF_DATABASE;
      lfRequest.top_k = topK;
    }

    console.log("LlamaFarm request:", JSON.stringify({ url: lfUrl, body: lfRequest }, null, 2));

    const lfResponse = await fetch(lfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lfRequest),
    });

    if (!lfResponse.ok) {
      return new Response(`LlamaFarm error: ${lfResponse.statusText}`, {
        status: lfResponse.status,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = lfResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder("utf-8");

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            controller.enqueue(encoder.encode(decoder.decode(value, { stream: true })));
          }
        } catch (error) {
          console.error("Stream error:", error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return new Response(error.message || "Internal error", { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
