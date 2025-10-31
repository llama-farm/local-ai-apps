import { NextRequest, NextResponse } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "insurance-helper-project";
const LF_MODEL = process.env.NEXT_PUBLIC_LF_MODEL || "insurance_advisor";
const LF_DATABASE = "member_handbook_db";

const SUMMARY_PROMPT = `You are analyzing a Medical Member Handbook. Generate a comprehensive summary covering:

1. **Plan Type & Network**: (HMO/PPO/EPO/HDHP, network name)
2. **Deductibles**: Individual and family amounts
3. **Out-of-Pocket Maximum**: Individual and family amounts
4. **Coinsurance**: Percentage splits (e.g., 80/20)
5. **Copays**: Primary care, specialist, ER, urgent care
6. **Prescription Coverage**: Drug tiers and copays
7. **Prior Authorization**: Services requiring pre-approval
8. **Coverage Highlights**: Key covered services
9. **Important Limitations**: Visit limits, exclusions
10. **Contact Information**: Member services, claims phone numbers

Format as structured sections with bullet points. Be specific with dollar amounts and percentages.

Extract ACTUAL values from the handbook - do not use placeholders.`;

export async function POST(req: NextRequest) {
  console.log("=== GENERATING HANDBOOK SUMMARY ===");

  try {
    const body = await req.json();
    const { topK = 15 } = body;

    // Step 1: Retrieve comprehensive excerpts from handbook
    console.log("Retrieving handbook excerpts...");
    const ragUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/rag/query`;

    // Generate multiple queries to get comprehensive coverage
    const queries = [
      "plan type HMO PPO network",
      "deductible individual family",
      "out of pocket maximum",
      "coinsurance percentage",
      "copay primary care specialist emergency",
      "prescription drug coverage tiers",
      "prior authorization requirements",
      "covered services benefits",
      "limitations exclusions",
      "contact information member services",
    ];

    const ragPromises = queries.map(query =>
      fetch(ragUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          database: LF_DATABASE,
          top_k: topK,
          score_threshold: 0.6,
        }),
      })
    );

    const ragResponses = await Promise.all(ragPromises);
    const allResults = (await Promise.all(
      ragResponses.map(r => r.json())
    )).flatMap(data => data.results || []);

    // Deduplicate
    const uniqueResults = Array.from(
      new Map(allResults.map(r => [r.content.substring(0, 100), r])).values()
    ).slice(0, 20);

    console.log(`Retrieved ${uniqueResults.length} unique handbook excerpts`);

    // Step 2: Generate summary using LLM
    const handbookContext = uniqueResults
      .map((r, idx) => `[Section ${idx + 1}]\n${r.content}`)
      .join("\n\n");

    const chatUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/chat/completions`;

    const summaryResponse = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LF_MODEL,
        messages: [
          {
            role: "user",
            content: `${SUMMARY_PROMPT}\n\n---\n\nHANDBOOK CONTENT:\n${handbookContext}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        rag_enabled: false,
      }),
    });

    if (!summaryResponse.ok) {
      throw new Error(`Summary generation failed: ${summaryResponse.statusText}`);
    }

    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices?.[0]?.message?.content || "";

    console.log("Generated summary length:", summary.length);

    return NextResponse.json({
      summary,
      excerpts_used: uniqueResults.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate summary" },
      { status: 500 }
    );
  }
}
