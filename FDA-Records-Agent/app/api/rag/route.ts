import { NextRequest } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "medical-records-project";
const LF_DATABASE = process.env.NEXT_PUBLIC_LF_DATABASE || "medical_db";

export async function POST(req: NextRequest) {
  try {
    const {
      query,
      database = LF_DATABASE,
      top_k = 5,
      score_threshold,
    } = await req.json();

    if (!query) {
      return new Response("Missing query", { status: 400 });
    }

    const lfUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/rag/query`;

    const lfRequest: any = {
      query,
      database,
      top_k,
    };

    if (score_threshold !== undefined) {
      lfRequest.score_threshold = score_threshold;
    }

    console.log("RAG query request:", JSON.stringify({ url: lfUrl, body: lfRequest }, null, 2));

    const lfResponse = await fetch(lfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lfRequest),
    });

    if (!lfResponse.ok) {
      const errorText = await lfResponse.text();
      console.error("RAG query error:", errorText);
      return new Response(`LlamaFarm RAG error: ${lfResponse.statusText}`, {
        status: lfResponse.status,
      });
    }

    const data = await lfResponse.json();
    return Response.json(data);
  } catch (error: any) {
    console.error("RAG API error:", error);
    return new Response(error.message || "Internal error", { status: 500 });
  }
}
