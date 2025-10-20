import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getLlamaFarmConfig, getLlamaFarmBaseURL } from "@/lib/config";

const execAsync = promisify(exec);

/**
 * POST /api/datasets/clear
 *
 * Clear datasets and optionally delete physical database files
 *
 * Options:
 * - clear_datasets: Array of dataset names to delete
 * - clear_databases: Array of database names to physically delete from ChromaDB
 * - clear_all: Boolean to clear everything
 */
export async function POST(req: NextRequest) {
  try {
    const config = await getLlamaFarmConfig();
    const LF_BASE_URL = getLlamaFarmBaseURL();
    const LF_NAMESPACE = config.namespace;
    const LF_PROJECT = config.name;

    const body = await req.json();
    const { clear_datasets = [], clear_databases = [], clear_all = false } = body;

    const results: any = {
      datasets_deleted: [],
      databases_cleared: [],
      errors: [],
    };

    // Delete datasets via API
    const datasetsToDelete = clear_all ? ["fda_letters", "fda_corpus"] : clear_datasets;

    for (const dataset of datasetsToDelete) {
      try {
        const deleteResponse = await fetch(
          `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}/datasets/${dataset}`,
          {
            method: "DELETE",
          }
        );

        if (deleteResponse.ok) {
          results.datasets_deleted.push(dataset);
        } else {
          const errorText = await deleteResponse.text();
          results.errors.push(`Failed to delete dataset ${dataset}: ${errorText}`);
        }
      } catch (err: any) {
        results.errors.push(`Error deleting dataset ${dataset}: ${err.message}`);
      }
    }

    // Clear physical ChromaDB databases
    const databasesToClear = clear_all
      ? ["fda_letters_full", "fda_corpus_chunked", "medical_db"]
      : clear_databases;

    for (const database of databasesToClear) {
      try {
        // Try to clear via Docker container
        const dockerCommand = `docker exec llamafarm-rag rm -rf /var/lib/llamafarm/chroma_data/${database}`;

        try {
          await execAsync(dockerCommand);
          results.databases_cleared.push(database);
        } catch (dockerErr) {
          // Try local path if docker fails
          const localPath = `${process.env.HOME}/.llamafarm/projects/${LF_NAMESPACE}/${LF_PROJECT}/lf_data/chroma_data/${database}`;
          const localCommand = `rm -rf "${localPath}"`;

          try {
            await execAsync(localCommand);
            results.databases_cleared.push(database);
          } catch (localErr) {
            results.errors.push(`Failed to clear database ${database} (tried both Docker and local paths)`);
          }
        }
      } catch (err: any) {
        results.errors.push(`Error clearing database ${database}: ${err.message}`);
      }
    }

    // If clear_all, also try to clear uploaded files
    if (clear_all) {
      try {
        const filesPath = `${process.env.HOME}/.llamafarm/projects/${LF_NAMESPACE}/${LF_PROJECT}/lf_data/files`;
        const clearFilesCommand = `rm -rf "${filesPath}"/* 2>/dev/null || true`;
        await execAsync(clearFilesCommand);
      } catch (err) {
        // Non-fatal, don't add to errors
        console.warn("Failed to clear uploaded files:", err);
      }
    }

    const success = results.errors.length === 0;

    return NextResponse.json({
      success,
      message: success
        ? "Successfully cleared requested items"
        : "Completed with some errors",
      ...results,
    });

  } catch (error: any) {
    console.error("Clear error:", error);
    return NextResponse.json({
      error: error.message || "Clear operation failed"
    }, { status: 500 });
  }
}

/**
 * GET /api/datasets/clear
 *
 * Get information about what can be cleared
 */
export async function GET(req: NextRequest) {
  try {
    const config = await getLlamaFarmConfig();
    const LF_BASE_URL = getLlamaFarmBaseURL();
    const LF_NAMESPACE = config.namespace;
    const LF_PROJECT = config.name;

    // Get project info
    const projectResponse = await fetch(
      `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}`
    );

    if (!projectResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch project info" }, { status: 500 });
    }

    const projectData = await projectResponse.json();
    const datasets = projectData.project?.config?.datasets || [];
    const databases = projectData.project?.config?.rag?.databases || [];

    return NextResponse.json({
      available_datasets: datasets.map((d: any) => ({
        name: d.name,
        file_count: d.files?.length || 0,
        database: d.database,
      })),
      available_databases: databases.map((db: any) => ({
        name: db.name,
        type: db.type,
      })),
    });

  } catch (error: any) {
    console.error("Info fetch error:", error);
    return NextResponse.json({
      error: error.message || "Failed to fetch clearable items"
    }, { status: 500 });
  }
}
