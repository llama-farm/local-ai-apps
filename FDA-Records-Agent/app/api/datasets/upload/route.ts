import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getLlamaFarmConfig, getLlamaFarmBaseURL } from "@/lib/config";

/**
 * POST /api/datasets/upload
 *
 * Upload files from a directory to LlamaFarm datasets
 * Supports recursive directory traversal
 */
export async function POST(req: NextRequest) {
  try {
    const config = await getLlamaFarmConfig();
    const LF_BASE_URL = getLlamaFarmBaseURL();
    const LF_NAMESPACE = config.namespace;
    const LF_PROJECT = config.name;

    const body = await req.json();
    const { directory, datasets, recursive = true } = body;

    if (!directory) {
      return NextResponse.json({ error: "Directory path is required" }, { status: 400 });
    }

    if (!datasets || datasets.length === 0) {
      return NextResponse.json({ error: "At least one dataset name is required" }, { status: 400 });
    }

    // Check if directory exists
    try {
      const stat = await fs.stat(directory);
      if (!stat.isDirectory()) {
        return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
      }
    } catch (err) {
      return NextResponse.json({ error: `Directory not found: ${directory}` }, { status: 400 });
    }

    // Find all files recursively
    const files = await findFiles(directory, recursive);

    // Filter to supported file types
    const supportedFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return [".pdf", ".txt"].includes(ext);
    });

    if (supportedFiles.length === 0) {
      return NextResponse.json({
        error: "No supported files found (.pdf, .txt)",
        scanned: files.length
      }, { status: 400 });
    }

    // Upload files to each dataset
    const results: any[] = [];

    for (const dataset of datasets) {
      let uploadedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const filePath of supportedFiles) {
        try {
          const fileBuffer = await fs.readFile(filePath);
          const fileName = path.basename(filePath);

          // Create FormData
          const formData = new FormData();
          const blob = new Blob([fileBuffer], { type: "application/octet-stream" });
          formData.append("file", blob, fileName);

          // Upload to LlamaFarm
          const uploadResponse = await fetch(
            `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}/datasets/${dataset}/data`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (uploadResponse.ok) {
            uploadedCount++;
          } else {
            failedCount++;
            const errorText = await uploadResponse.text();
            errors.push(`${fileName}: ${errorText}`);
          }
        } catch (err: any) {
          failedCount++;
          errors.push(`${path.basename(filePath)}: ${err.message}`);
        }
      }

      results.push({
        dataset,
        uploaded: uploadedCount,
        failed: failedCount,
        errors: errors.slice(0, 10), // Limit to first 10 errors
      });
    }

    return NextResponse.json({
      success: true,
      directory,
      total_files_found: supportedFiles.length,
      results,
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({
      error: error.message || "Upload failed"
    }, { status: 500 });
  }
}

/**
 * Recursively find all files in a directory
 */
async function findFiles(dir: string, recursive: boolean): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && recursive) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          const subFiles = await findFiles(fullPath, recursive);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return files;
}
