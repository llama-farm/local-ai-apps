import { NextRequest } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${LF_BASE_URL}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return Response.json(
        {
          status: "error",
          message: `LlamaFarm returned ${response.status}`,
          url: LF_BASE_URL
        },
        { status: 503 }
      );
    }

    const data = await response.json();

    return Response.json({
      status: "healthy",
      llamafarm: data,
      url: LF_BASE_URL,
    });
  } catch (error: any) {
    return Response.json(
      {
        status: "error",
        message: error.message || "Could not connect to LlamaFarm",
        url: LF_BASE_URL,
      },
      { status: 503 }
    );
  }
}
