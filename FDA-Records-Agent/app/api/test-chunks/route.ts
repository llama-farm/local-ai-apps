import { NextRequest, NextResponse } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "fda-records-agent";

/**
 * GET /api/test-chunks?hash=<document_hash>&database=<database_name>
 *
 * Test endpoint to retrieve all chunks for a specific document
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentHash = searchParams.get("hash");
    const database = searchParams.get("database") || "fda_letters_full";

    if (!documentHash) {
      return NextResponse.json({ error: "Missing hash parameter" }, { status: 400 });
    }

    console.log(`\n=== Testing Chunk Retrieval ===`);
    console.log(`Document Hash: ${documentHash}`);
    console.log(`Database: ${database}`);

    // Strategy 1: Use generic query with high top_k to get many chunks
    const ragResponse = await fetch(
      `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}/rag/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "document content",
          database,
          top_k: 100,
        }),
      }
    );

    if (!ragResponse.ok) {
      throw new Error(`RAG query failed: ${ragResponse.statusText}`);
    }

    const ragData = await ragResponse.json();
    const allResults = ragData.results || [];

    console.log(`Total results from RAG: ${allResults.length}`);

    // Filter results by document hash
    const matchingChunks = allResults.filter((result: any) => {
      const metadata = result.metadata || {};
      const fileHash = metadata.file_hash || metadata.source || metadata.document_id || "";

      // Try different matching strategies
      const exactMatch = fileHash === documentHash;
      const containsHash = documentHash.includes(fileHash) || fileHash.includes(documentHash);
      const shortHashMatch = documentHash.substring(0, 12) === fileHash.substring(0, 12);

      return exactMatch || containsHash || shortHashMatch;
    });

    console.log(`Matching chunks found: ${matchingChunks.length}`);

    // Log sample metadata to understand structure
    if (allResults.length > 0) {
      console.log("\nSample metadata from first result:");
      console.log(JSON.stringify(allResults[0].metadata, null, 2));
    }

    if (matchingChunks.length > 0) {
      console.log("\nSample matching chunk metadata:");
      console.log(JSON.stringify(matchingChunks[0].metadata, null, 2));
    }

    // Show all unique file_hash values for debugging
    const allFileHashes = Array.from(
      new Set(
        allResults.map((r: any) => r.metadata?.file_hash || r.metadata?.source || "NO_HASH")
      )
    );

    return NextResponse.json({
      success: true,
      document_hash: documentHash,
      database,
      total_results_from_rag: allResults.length,
      matching_chunks: matchingChunks.length,
      all_file_hashes_in_db: allFileHashes,
      chunks: matchingChunks.map((chunk: any, idx: number) => ({
        index: idx,
        content_preview: chunk.content?.substring(0, 200) + "...",
        content_length: chunk.content?.length || 0,
        metadata: chunk.metadata,
        score: chunk.score,
      })),
      // Include all metadata keys we found for debugging
      metadata_keys_found: allResults.length > 0
        ? Object.keys(allResults[0].metadata || {})
        : [],
    });

  } catch (error: any) {
    console.error("Test chunks error:", error);
    return NextResponse.json({
      error: error.message || "Failed to retrieve chunks"
    }, { status: 500 });
  }
}
