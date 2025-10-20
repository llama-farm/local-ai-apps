import { NextRequest } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "medical-records-project";
const LF_MODEL = process.env.NEXT_PUBLIC_LF_MODEL || "default";
const LF_FAST_MODEL = "fast"; // Small, fast model for query generation
const LF_DATABASE = process.env.NEXT_PUBLIC_LF_DATABASE || "medical_db";

const QUERY_GENERATION_PROMPT = `Analyze the user's medical document and generate search queries.

STEP 1: Write a brief summary (2-3 sentences) of the key findings in the document
STEP 2: Generate 4-6 diverse search queries covering DIFFERENT aspects

OUTPUT FORMAT:
<summary>Brief 2-3 sentence summary of the medical document</summary>

<rag_question>first specific search query</rag_question>
<rag_question>second specific search query</rag_question>
<rag_question>third specific search query</rag_question>
<rag_question>fourth specific search query</rag_question>

IMPORTANT:
- Identify ALL abnormal values (high cholesterol, low vitamin D, high glucose, etc.)
- Create a DIFFERENT query for each major finding
- Be specific (don't just say "kidney disease" - mention the actual tests)
- Keep queries 5-15 words each

EXAMPLE:

Document shows: High LDL (145), Low Vitamin D (23.1), High Glucose (120), High Cholesterol (216)

<summary>Lab results show elevated LDL cholesterol at 145 mg/dL, vitamin D insufficiency at 23.1 ng/mL, and slightly elevated fasting glucose at 120 mg/dL.</summary>

<rag_question>LDL cholesterol 145 mg/dL cardiovascular risk</rag_question>
<rag_question>vitamin D insufficiency 23 ng/mL treatment supplementation</rag_question>
<rag_question>fasting glucose 120 mg/dL prediabetes screening</rag_question>
<rag_question>high total cholesterol 216 dietary lifestyle changes</rag_question>`;

const SYNTHESIS_PROMPT = `You are a careful healthcare record explainer. You will receive:
1. A user's question
2. Relevant excerpts retrieved from a medical knowledge base
3. Optional excerpts from the user's uploaded medical documents

Your task:
- Synthesize a comprehensive, accurate response
- Define medical jargon in simple terms
- Cite sources with page numbers when available
- Avoid giving clinical advice
- Structure your response with clear sections

Format your response with:
- **TL;DR**: Brief summary (2-3 sentences)
- **Key Findings**: Main points from the sources
- **Additional Context**: Relevant background information
- **Suggested Questions**: 2-3 follow-up questions the user might want to ask`;

interface RAGResult {
  content: string;
  score: number;
  metadata?: {
    source?: string;
    page?: number;
    document_id?: string;
  };
}

export async function POST(req: NextRequest) {
  console.log("🔥🔥🔥 AGENT-CHAT ENDPOINT HIT 🔥🔥🔥");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await req.json();
        const { prompt, excerpts = [], topK = 10, scoreThreshold = 0.7 } = body;

        console.log("=== AGENT-CHAT REQUEST ===");
        console.log("Prompt:", prompt);
        console.log("Excerpts count:", excerpts.length);
        console.log("TopK:", topK);
        console.log("Score threshold:", scoreThreshold);

        if (!prompt) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Missing prompt" })}\n\n`));
          controller.close();
          return;
        }

        // Helper to send SSE updates
        const sendUpdate = (token: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
        };

        const sendCitations = (citations: any[]) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ citations })}\n\n`));
        };

        // Analyze question complexity
        const isSimpleQuestion = /^(what is|define|explain)\s+\w+\??$/i.test(prompt.trim());
        const wordCount = prompt.trim().split(/\s+/).length;
        const hasMultipleParts = /\b(and|also|additionally|furthermore)\b/i.test(prompt);

        console.log("=== QUESTION COMPLEXITY ANALYSIS ===");
        console.log("Prompt:", prompt);
        console.log("isSimpleQuestion:", isSimpleQuestion);
        console.log("wordCount:", wordCount);
        console.log("hasMultipleParts:", hasMultipleParts);
        console.log("Has excerpts:", excerpts.length > 0);

        // Define chatUrl here so it's available for both query generation AND synthesis
        const chatUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/chat/completions`;

        // Step 1: Generate RAG queries using LLM (or use simple heuristic)
        sendUpdate("<think>\n");

        let queries: string[] = [];
        let initialAnalysis = ""; // Store full response from query generation model

        // For very simple questions WITHOUT context, skip LLM and use question directly
        // But if user uploaded PDFs, always use LLM to extract specific terms
        if (isSimpleQuestion && wordCount <= 5 && !hasMultipleParts && excerpts.length === 0) {
          console.log("Using direct query (simple question, no context)");
          queries = [prompt.trim()];
          sendUpdate("Simple question detected - using direct search\n");
        } else {
          console.log("Using LLM for query generation (complex question or has context)");
          sendUpdate("Analyzing your question and generating focused search queries...\n");

          const contextBlock = excerpts.length
            ? `\n\nUser's uploaded medical document excerpts:\n${excerpts.map((text: string, i: number) => `[${i + 1}] ${text}`).join("\n\n")}`
            : "";

          // LlamaFarm strips system messages, so append instructions to user message
          const queryGenMessages = [
            {
              role: "user",
              content: `${QUERY_GENERATION_PROMPT}\n\n---\n\nQuestion: ${prompt}${contextBlock}`
            },
          ];

          const requestBody = {
            model: LF_FAST_MODEL,
            messages: queryGenMessages,
            temperature: 0.3,
            max_tokens: 300,
            rag_enabled: false,
          };

          console.log("=== CALLING QUERY GENERATION LLM ===");
          console.log(`Model: ${LF_FAST_MODEL}`);
          console.log(`URL: ${chatUrl}`);
          console.log("Messages being sent:");
          console.log(JSON.stringify(queryGenMessages, null, 2));
          console.log("\nFull request body:");
          console.log(JSON.stringify(requestBody, null, 2));

          const queryGenResponse = await fetch(chatUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          if (!queryGenResponse.ok) {
            throw new Error(`Query generation failed: ${queryGenResponse.statusText}`);
          }

          const queryGenData = await queryGenResponse.json();
          const generatedQueriesText = queryGenData.choices?.[0]?.message?.content || "";

          console.log("=== QUERY GENERATION RESPONSE ===");
          console.log(generatedQueriesText);

          // Store the full response from the query generation model
          const initialAnalysis = generatedQueriesText;

          // Parse XML tags to extract queries for RAG
          const ragQuestionRegex = /<rag_question>(.*?)<\/rag_question>/gs;
          const matches = [...generatedQueriesText.matchAll(ragQuestionRegex)];

          if (matches.length > 0) {
            queries = matches.map(match => match[1].trim()).filter(q => q.length > 0);
            console.log(`Extracted ${queries.length} queries from XML tags:`, queries);
            sendUpdate(`Generating ${queries.length} search queries based on your document...\n`);
          } else {
            console.log("No <rag_question> tags found in response, using original prompt");
            queries = [prompt];
          }

          queries = queries.slice(0, 8); // Max 8 queries
          console.log(`Using ${queries.length} queries for RAG search`);
          sendUpdate(`Generated ${queries.length} search queries\n`);
        }

        // Step 2: Execute RAG queries in parallel
        sendUpdate("Searching medical knowledge base...\n");

        const ragUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/rag/query`;

        console.log(`=== EXECUTING ${queries.length} RAG QUERIES ===`);
        console.log("RAG URL:", ragUrl);
        console.log("Database:", LF_DATABASE);

        const ragPromises = queries.map(async (query, idx) => {
          try {
            console.log(`[RAG ${idx + 1}/${queries.length}] Query: "${query}"`);
            const response = await fetch(ragUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query,
                database: LF_DATABASE,
                top_k: topK,
                score_threshold: scoreThreshold,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[RAG ${idx + 1}] FAILED: ${response.status} - ${errorText}`);
              return { query, results: [] };
            }

            const data = await response.json();
            console.log(`[RAG ${idx + 1}] Success: ${data.results?.length || 0} results`);
            return { query, results: data.results || [] };
          } catch (error) {
            console.error(`[RAG ${idx + 1}] ERROR:`, error);
            return { query, results: [] };
          }
        });

        const ragResponses = await Promise.all(ragPromises);
        const allResults: RAGResult[] = ragResponses.flatMap((r) => r.results);

        console.log(`=== RAG RESULTS ===`);
        console.log(`Total results: ${allResults.length}`);

        // Deduplicate results by content similarity (simple hash-based)
        const uniqueResults = Array.from(
          new Map(allResults.map((r) => [r.content.substring(0, 100), r])).values()
        ).slice(0, 15); // Keep top 15 unique results

        console.log(`Unique results after dedup: ${uniqueResults.length}`);
        console.log("Sample sources:", uniqueResults.slice(0, 3).map(r => r.metadata?.source));

        sendUpdate(`Found ${uniqueResults.length} relevant excerpts\n`);
        sendUpdate("</think>\n\n");

        // Build citations
        const citations = uniqueResults.map((r, idx) => ({
          id: `cite-${idx}`,
          source: r.metadata?.source || "Knowledge Base",
          page: r.metadata?.page,
          score: r.score,
          snippet: r.content.substring(0, 150),
        }));

        sendCitations(citations);

        // Step 3: Synthesize response using LLM with RAG results
        console.log("=== SYNTHESIS STEP ===");

        // Build RAG context from all retrieved results
        const ragContext = uniqueResults
          .map((r, idx) => {
            const source = r.metadata?.source || "Unknown";
            const page = r.metadata?.page ? ` (p.${r.metadata.page})` : "";
            return `[Knowledge Base ${idx + 1}] Source: ${source}${page}\n${r.content}`;
          })
          .join("\n\n");

        console.log(`RAG context length: ${ragContext.length} chars`);

        // Build context block from user's uploaded PDFs
        const userDocsContext = excerpts.length
          ? `\n\nUSER'S UPLOADED MEDICAL DOCUMENTS:\n${excerpts.map((text: string, i: number) => `[User Doc ${i + 1}]:\n${text}`).join("\n\n")}`
          : "";

        // Include initial analysis if we did query generation
        const initialAnalysisContext = initialAnalysis
          ? `\n\nINITIAL ANALYSIS (from first model):\n${initialAnalysis}`
          : "";

        // Build comprehensive synthesis prompt
        const synthesisUserPrompt = `${SYNTHESIS_PROMPT}

---

USER'S QUESTION: ${prompt}
${userDocsContext}
${initialAnalysisContext}

RETRIEVED MEDICAL KNOWLEDGE:
${ragContext}

---

Please provide a comprehensive response that:
1. Addresses the user's question directly
2. Explains each finding from their medical documents in simple terms
3. Uses the retrieved medical knowledge to provide context and education
4. Cites sources when referencing medical knowledge`;

        const synthesisMessages = [
          {
            role: "user",
            content: synthesisUserPrompt
          },
        ];

        console.log("=== FINAL SYNTHESIS PROMPT (FULL) ===");
        console.log("Synthesis prompt length:", synthesisUserPrompt.length, "chars");
        console.log("\n--- START OF SYNTHESIS PROMPT ---");
        console.log(synthesisUserPrompt);
        console.log("--- END OF SYNTHESIS PROMPT ---\n");

        console.log(`Calling synthesis with capable model (${LF_MODEL}), rag_enabled=false`);
        const synthesisResponse = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: LF_MODEL, // Use default (more capable) model for synthesis
            messages: synthesisMessages,
            temperature: 0.5,
            max_tokens: 2000,
            stream: true,
            rag_enabled: false, // RAG already done manually
          }),
        });

        console.log(`Synthesis response status: ${synthesisResponse.status}`);

        if (!synthesisResponse.ok) {
          throw new Error(`Synthesis failed: ${synthesisResponse.statusText}`);
        }

        // Stream the synthesis response
        const reader = synthesisResponse.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let tokenCount = 0;

        console.log("=== STREAMING SYNTHESIS RESPONSE ===");

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            console.log(`Stream complete. Total tokens sent: ${tokenCount}`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  tokenCount++;
                  console.log(`Token ${tokenCount}:`, token);
                  sendUpdate(token);
                }
              } catch (e) {
                console.error("Failed to parse SSE line:", line, e);
              }
            }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (error: any) {
        console.error("Agent chat error:", error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
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
