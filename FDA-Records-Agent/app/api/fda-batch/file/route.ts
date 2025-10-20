import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const RESULTS_DIR = path.join(process.cwd(), "fda_results");

/**
 * GET /api/fda-batch/file?path=<relative-path>
 *
 * Serve a specific result file
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const relativePath = searchParams.get("path");

    if (!relativePath) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    // Security: Prevent path traversal
    const safeRelativePath = relativePath.replace(/\.\./g, "");
    const filePath = path.join(RESULTS_DIR, safeRelativePath);

    // Ensure file is within RESULTS_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedResultsDir = path.resolve(RESULTS_DIR);

    if (!resolvedPath.startsWith(resolvedResultsDir)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read and return file content
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);

    // Check if request wants HTML (from browser)
    const acceptHeader = req.headers.get("accept") || "";
    if (acceptHeader.includes("text/html")) {
      // Return pretty-printed HTML
      const prettyJson = JSON.stringify(data, null, 2);
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FDA Batch Results - ${safeRelativePath}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      margin: 0;
      padding: 20px;
    }
    .header {
      background: #252526;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      color: #569cd6;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0;
      color: #858585;
    }
    pre {
      background: #252526;
      border: 1px solid #3e3e42;
      border-radius: 8px;
      padding: 20px;
      overflow-x: auto;
      line-height: 1.5;
      font-size: 14px;
    }
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-boolean { color: #569cd6; }
    .json-null { color: #569cd6; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 FDA Batch Processing Results</h1>
    <p><strong>File:</strong> ${safeRelativePath}</p>
    <p><strong>Documents Processed:</strong> ${data.documents?.length || 0}</p>
    <p><strong>Total Questions:</strong> ${data.summary?.total_questions || 0}</p>
    <p><strong>Answered:</strong> ${data.summary?.answered_questions || 0}</p>
  </div>
  <pre>${prettyJson}</pre>
</body>
</html>`;
      return new Response(html, {
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    // Return JSON for API calls
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to serve file:", error);
    return NextResponse.json({
      error: error.message || "Failed to serve file"
    }, { status: 500 });
  }
}
