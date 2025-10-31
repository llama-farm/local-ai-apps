import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "insurance-helper-project";
const LF_DATASET = "member_handbook";
const LF_DATABASE = "member_handbook_db";

export async function POST(req: NextRequest) {
  console.log("=== HANDBOOK UPLOAD ENDPOINT ===");

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    console.log(`Received ${files.length} file(s)`);
    const filenames: string[] = [];
    const tempPaths: string[] = [];

    // Step 1: Ingest all files into LlamaFarm dataset
    for (const file of files) {
      console.log(`Processing file: ${file.name}, ${file.size} bytes`);
      filenames.push(file.name);

      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Save temporarily
      const tempPath = join("/tmp", `handbook_${Date.now()}_${file.name}`);
      await writeFile(tempPath, buffer);
      tempPaths.push(tempPath);
      console.log("Saved to:", tempPath);

      // Ingest file into LlamaFarm dataset
      console.log(`=== INGESTING FILE: ${file.name} ===`);
      const ingestUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/datasets/${LF_DATASET}/data`;

      const ingestFormData = new FormData();
      ingestFormData.append("file", new Blob([buffer], { type: file.type }), file.name);

      const ingestResponse = await fetch(ingestUrl, {
        method: "POST",
        body: ingestFormData,
      });

      if (!ingestResponse.ok) {
        const errorText = await ingestResponse.text();
        console.error("Ingest failed:", errorText);
        throw new Error(`Failed to ingest file ${file.name}: ${ingestResponse.statusText}`);
      }

      const ingestResult = await ingestResponse.json();
      console.log(`Ingest result for ${file.name}:`, ingestResult);
    }

    // Step 2: Process dataset once (create embeddings for all files)
    console.log("=== PROCESSING DATASET ===");
    const processUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/datasets/${LF_DATASET}/process`;

    const processResponse = await fetch(processUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error("Process failed:", errorText);
      throw new Error(`Failed to process dataset: ${processResponse.statusText}`);
    }

    const processResult = await processResponse.json();
    console.log("Process result:", processResult);

    // Clean up temp files
    for (const tempPath of tempPaths) {
      await unlink(tempPath);
    }
    console.log("Cleaned up all temp files");

    // Check if processing completed synchronously or if we need to poll
    const isComplete = processResult.message?.includes("completed") || processResult.status === "completed";
    const taskId = processResult.task_id;

    // Return response
    return NextResponse.json({
      success: true,
      message: `${files.length} handbook file(s) uploaded and processing ${isComplete ? 'completed' : 'started'}`,
      taskId,
      isComplete,
      dataset: LF_DATASET,
      database: LF_DATABASE,
      filenames,
      fileCount: files.length,
      processResult: isComplete ? processResult : undefined,
    });

  } catch (error: any) {
    console.error("Handbook upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload handbook" },
      { status: 500 }
    );
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
