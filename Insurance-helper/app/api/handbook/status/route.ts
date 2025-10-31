import { NextRequest, NextResponse } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "insurance-helper-project";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  try {
    // Check task status
    const taskUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/tasks/${taskId}`;

    const response = await fetch(taskUrl);

    if (!response.ok) {
      throw new Error(`Failed to check task status: ${response.statusText}`);
    }

    const taskData = await response.json();

    return NextResponse.json({
      status: taskData.status,
      progress: taskData.progress,
      result: taskData.result,
      error: taskData.error,
    });

  } catch (error: any) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check status" },
      { status: 500 }
    );
  }
}
