import { NextRequest, NextResponse } from "next/server";
import { getLlamaFarmConfig, getLlamaFarmBaseURL } from "@/lib/config";

/**
 * POST /api/datasets/process
 *
 * Process datasets to generate embeddings and populate vector databases
 */
export async function POST(req: NextRequest) {
  try {
    const config = await getLlamaFarmConfig();
    const LF_BASE_URL = getLlamaFarmBaseURL();
    const LF_NAMESPACE = config.namespace;
    const LF_PROJECT = config.name;

    console.log("=== DATASET PROCESS API CALLED ===");
    console.log("Config:", { namespace: LF_NAMESPACE, project: LF_PROJECT, base_url: LF_BASE_URL });

    const body = await req.json();
    const { datasets, async_processing = false } = body;

    console.log("Request body:", { datasets, async_processing });

    if (!datasets || datasets.length === 0) {
      return NextResponse.json({ error: "At least one dataset name is required" }, { status: 400 });
    }

    const results: any[] = [];

    for (const dataset of datasets) {
      try {
        const processURL = `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}/datasets/${dataset}/process?async_processing=${async_processing}`;
        console.log(`Processing dataset: ${dataset}`);
        console.log(`Full URL: ${processURL}`);

        const processResponse = await fetch(
          processURL,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        console.log(`Response status for ${dataset}: ${processResponse.status}`);

        if (processResponse.ok) {
          const data = await processResponse.json();
          results.push({
            dataset,
            success: true,
            async: async_processing,
            task_id: data.task_id,
            message: data.message,
          });
        } else {
          const errorText = await processResponse.text();
          results.push({
            dataset,
            success: false,
            error: errorText,
          });
        }
      } catch (err: any) {
        results.push({
          dataset,
          success: false,
          error: err.message,
        });
      }
    }

    const allSuccessful = results.every(r => r.success);

    return NextResponse.json({
      success: allSuccessful,
      results,
    });

  } catch (error: any) {
    console.error("Process error:", error);
    return NextResponse.json({
      error: error.message || "Processing failed"
    }, { status: 500 });
  }
}

/**
 * GET /api/datasets/process?dataset=name
 *
 * Get processing status for a dataset
 */
export async function GET(req: NextRequest) {
  try {
    const config = await getLlamaFarmConfig();
    const LF_BASE_URL = getLlamaFarmBaseURL();
    const LF_NAMESPACE = config.namespace;
    const LF_PROJECT = config.name;

    const { searchParams } = new URL(req.url);
    const dataset = searchParams.get("dataset");

    if (!dataset) {
      return NextResponse.json({ error: "Dataset name is required" }, { status: 400 });
    }

    // Check dataset status via project endpoint
    const projectResponse = await fetch(
      `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}`
    );

    if (!projectResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch project info" }, { status: 500 });
    }

    const projectData = await projectResponse.json();
    const datasets = projectData.project?.config?.datasets || [];
    const datasetInfo = datasets.find((d: any) => d.name === dataset);

    if (!datasetInfo) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    return NextResponse.json({
      dataset,
      file_count: datasetInfo.files?.length || 0,
      files: datasetInfo.files || [],
    });

  } catch (error: any) {
    console.error("Status check error:", error);
    return NextResponse.json({
      error: error.message || "Status check failed"
    }, { status: 500 });
  }
}
