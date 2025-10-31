import { NextRequest } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "insurance-helper-project";
const LF_MODEL = process.env.NEXT_PUBLIC_LF_MODEL || "insurance_advisor";
const LF_FAST_MODEL = "fast"; // Small, fast model for query generation
const LF_DATABASE = process.env.NEXT_PUBLIC_LF_DATABASE || "insurance_policies_db";

const QUERY_GENERATION_PROMPT = `Analyze the user's insurance document and generate focused search queries for insurance knowledge retrieval.

STEP 1: Identify the document type (policy, EOB, medical bill, claim denial, etc.)
STEP 2: Write a brief summary (2-3 sentences) of key insurance-related information
STEP 3: Generate 5-8 diverse search queries covering DIFFERENT insurance aspects

OUTPUT FORMAT:
<doc_type>Policy|EOB|Bill|Claim|Other</doc_type>
<summary>Brief 2-3 sentence summary highlighting insurance-specific findings</summary>

<rag_question>first specific insurance search query</rag_question>
<rag_question>second specific insurance search query</rag_question>
<rag_question>third specific insurance search query</rag_question>
<rag_question>fourth specific insurance search query</rag_question>
<rag_question>fifth specific insurance search query</rag_question>

IMPORTANT FOR INSURANCE DOCUMENTS:
- Extract specific codes: CPT, ICD-10, denial codes (CO-*, PR-*)
- Identify dollar amounts, coverage percentages, deductibles
- Note in-network vs out-of-network status
- Capture plan names, member IDs (partially), group numbers
- Identify time-sensitive information (filing deadlines, appeal windows)
- Include medical terminology and insurance jargon in queries
- Keep queries 5-20 words each for insurance complexity

EXAMPLE 1 - EOB:

Document shows: Claim for surgery (CPT 47562) billed $12,500, allowed $8,200, patient owes $1,640 (20% coinsurance), denial code CO-50 for additional charges

<doc_type>EOB</doc_type>
<summary>EOB shows laparoscopic cholecystectomy claim with $8,200 allowed amount. Patient responsible for $1,640 coinsurance. Additional charges denied with CO-50 code.</summary>

<rag_question>laparoscopic cholecystectomy CPT 47562 typical coverage</rag_question>
<rag_question>CO-50 denial code meaning and appeal process</rag_question>
<rag_question>20% coinsurance after deductible met calculation</rag_question>
<rag_question>allowed amount vs billed amount insurance adjustment</rag_question>
<rag_question>medical necessity documentation for surgical procedures</rag_question>

EXAMPLE 2 - Policy:

Document shows: PPO plan with $2,000 deductible, $6,500 out-of-pocket max, 80/20 coinsurance, requires prior auth for MRI, PT limited to 20 visits/year

<doc_type>Policy</doc_type>
<summary>PPO plan with $2,000 deductible and 80/20 coinsurance. Prior authorization required for advanced imaging. Physical therapy capped at 20 visits annually.</summary>

<rag_question>PPO prior authorization requirements MRI CT scan</rag_question>
<rag_question>deductible vs out-of-pocket maximum difference explained</rag_question>
<rag_question>80/20 coinsurance how much will I pay</rag_question>
<rag_question>physical therapy session limits typical coverage</rag_question>
<rag_question>in-network vs out-of-network cost difference PPO</rag_question>`;

const SYNTHESIS_PROMPT = `You are an expert Insurance Assistant helping users understand their insurance policies, medical bills, EOBs, and claims. You will receive:
1. A user's insurance-related question
2. Relevant insurance excerpts retrieved from policy documents or knowledge base
3. Optional excerpts from the user's uploaded documents (policies, EOBs, bills, claim letters)

Your task:
- Synthesize a comprehensive, accurate response about insurance matters
- Explain insurance concepts in clear, simple language (avoid jargon or define it)
- Break down complex insurance terminology (deductible, coinsurance, prior auth, etc.)
- Cite specific policy sections, EOB line items, or claim denial codes when available
- Calculate costs and coverage percentages when possible
- Provide actionable next steps (e.g., "call your insurer at the member services number", "file an appeal within 180 days")
- Be empathetic - insurance issues are often stressful and confusing
- Always note this is general guidance, not legal/medical advice

Format your response with:
- **Summary**: Brief overview of the insurance situation (2-3 sentences)
- **What This Means**: Explain the insurance concepts or situation in plain English
- **Coverage Details**: Specific coverage percentages, costs, limitations from policy/EOB
- **Your Responsibility**: What the user needs to pay or do (if applicable)
- **Next Steps**: Actionable items with timelines (if applicable)
- **Important Notes**: Deadlines, appeal rights, or critical information
- **Questions to Ask**: 2-3 follow-up questions to clarify or get more information`;

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
        const { prompt, excerpts = [], topK = 10, scoreThreshold = 0.7, sessionId } = body;

        console.log("=== AGENT-CHAT REQUEST ===");
        console.log("Prompt:", prompt);
        console.log("Excerpts count:", excerpts.length);
        console.log("TopK:", topK);
        console.log("Score threshold:", scoreThreshold);
        console.log("Session ID:", sessionId || "(new session)");

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
            ? `\n\nUser's uploaded document excerpts:\n${excerpts.map((text: string, i: number) => `[${i + 1}] ${text}`).join("\n\n")}`
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

            // Filter out low-quality queries (too generic, too short, or nonsensical)
            const minWordCount = 3;
            const maxWordCount = 25;
            const genericTerms = ['what', 'how', 'explain', 'tell me', 'information about'];

            queries = queries.filter(q => {
              const words = q.split(/\s+/);
              const wordCount = words.length;

              // Must have minimum words
              if (wordCount < minWordCount) return false;

              // Not too long
              if (wordCount > maxWordCount) return false;

              // Not purely generic question words
              const isGeneric = genericTerms.some(term =>
                q.toLowerCase().trim().startsWith(term) && wordCount <= 4
              );
              if (isGeneric) return false;

              return true;
            });

            console.log(`After quality filtering: ${queries.length} queries (from ${matches.length})`);
            sendUpdate(`Generated ${queries.length} high-quality search queries\n`);
          } else {
            console.log("No <rag_question> tags found in response, using original prompt");
            queries = [prompt];
          }

          queries = queries.slice(0, 8); // Max 8 queries
          console.log(`Using ${queries.length} queries for RAG search`);
          sendUpdate(`Using ${queries.length} focused queries to search databases\n`);
        }

        // Step 2: Execute RAG queries in parallel
        // Search BOTH handbook database and general policies database
        sendUpdate("Searching knowledge base and your handbook...\n");

        const ragUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/rag/query`;

        console.log(`=== EXECUTING ${queries.length} RAG QUERIES ===`);
        console.log("RAG URL:", ragUrl);
        console.log("Primary Database:", LF_DATABASE);
        console.log("Handbook Database: member_handbook_db");

        // Search both databases in parallel
        const databases = [LF_DATABASE, "member_handbook_db"];
        const ragPromises = queries.flatMap(query =>
          databases.map(async (database, dbIdx) => {
            try {
              console.log(`[RAG ${database}] Query: "${query}"`);
              const response = await fetch(ragUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query,
                  database,
                  top_k: topK,
                  score_threshold: scoreThreshold,
                }),
              });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[RAG ${database}] FAILED: ${response.status} - ${errorText}`);
              return { query, database, results: [] };
            }

            const data = await response.json();
            console.log(`[RAG ${database}] Success: ${data.results?.length || 0} results`);
            return { query, database, results: data.results || [] };
          } catch (error) {
            console.error(`[RAG ${database}] ERROR:`, error);
            return { query, database, results: [] };
          }
        })
      );

        const ragResponses = await Promise.all(ragPromises);
        let allResults: RAGResult[] = ragResponses.flatMap((r) => r.results);

        console.log(`=== RAG RESULTS ===`);
        console.log(`Total initial results: ${allResults.length}`);

        // ENHANCEMENT: Document-level metadata filtering
        // Identify highly relevant documents and fetch more chunks from them
        const highScoreThreshold = 0.8;
        const documentScores = new Map<string, { count: number; maxScore: number; database: string }>();

        // Analyze initial results to find highly relevant documents
        allResults.forEach(result => {
          const source = result.metadata?.source || result.metadata?.document_id;
          if (source && result.score >= highScoreThreshold) {
            const existing = documentScores.get(source) || { count: 0, maxScore: 0, database: "" };
            documentScores.set(source, {
              count: existing.count + 1,
              maxScore: Math.max(existing.maxScore, result.score),
              database: existing.database || ragResponses.find(r => r.results.includes(result))?.database || LF_DATABASE
            });
          }
        });

        // Fetch additional chunks from highly relevant documents (2+ high-scoring chunks)
        const documentsToExpand = Array.from(documentScores.entries())
          .filter(([_, stats]) => stats.count >= 2)
          .sort((a, b) => b[1].maxScore - a[1].maxScore)
          .slice(0, 3); // Top 3 most relevant documents

        console.log(`Found ${documentsToExpand.length} highly relevant documents to expand`);

        if (documentsToExpand.length > 0) {
          sendUpdate(`Fetching additional context from ${documentsToExpand.length} relevant document(s)...\n`);

          const expandPromises = documentsToExpand.map(async ([docSource, stats]) => {
            try {
              // Use document filename/source as metadata filter
              console.log(`[EXPAND] Fetching more chunks from: ${docSource}`);
              const response = await fetch(ragUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: prompt, // Use original question
                  database: stats.database,
                  top_k: 15, // Get more chunks from this document
                  score_threshold: 0.5, // Lower threshold for same-document chunks
                  metadata_filter: { source: docSource } // Filter by document
                }),
              });

              if (!response.ok) {
                console.error(`[EXPAND] Failed for ${docSource}`);
                return [];
              }

              const data = await response.json();
              console.log(`[EXPAND] Got ${data.results?.length || 0} additional chunks from ${docSource}`);
              return data.results || [];
            } catch (error) {
              console.error(`[EXPAND] Error fetching from ${docSource}:`, error);
              return [];
            }
          });

          const expandedResults = await Promise.all(expandPromises);
          const additionalChunks = expandedResults.flat();
          console.log(`Added ${additionalChunks.length} chunks from document expansion`);

          // Merge with original results
          allResults = [...allResults, ...additionalChunks];
        }

        console.log(`Total results after document expansion: ${allResults.length}`);

        // Deduplicate results by content similarity (simple hash-based)
        const uniqueResults = Array.from(
          new Map(allResults.map((r) => [r.content.substring(0, 100), r])).values()
        ).slice(0, 20); // Keep top 20 unique results (increased from 15)

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
          ? `\n\nUSER'S UPLOADED DOCUMENTS:\n${excerpts.map((text: string, i: number) => `[User Doc ${i + 1}]:\n${text}`).join("\n\n")}`
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

RETRIEVED KNOWLEDGE:
${ragContext}

---

Please provide a comprehensive response that:
1. Addresses the user's question directly
2. Explains key information from their documents in simple terms
3. Uses the retrieved knowledge to provide context and additional information
4. Cites sources when referencing knowledge base content`;

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

        console.log(`Calling synthesis with capable model (${LF_MODEL}), rag_enabled=false, session_id=${sessionId || '(new)'}`);

        // Build headers with optional X-Session-ID
        const synthesisHeaders: Record<string, string> = {
          "Content-Type": "application/json"
        };

        // Include X-Session-ID header if provided for conversation continuity
        if (sessionId) {
          synthesisHeaders["X-Session-ID"] = sessionId;
          console.log("Including X-Session-ID header:", sessionId);
        }

        const synthesisPayload = {
          model: LF_MODEL, // Use default (more capable) model for synthesis
          messages: synthesisMessages,
          temperature: 0.5,
          max_tokens: 2000,
          stream: true,
          rag_enabled: false, // RAG already done manually
        };

        const synthesisResponse = await fetch(chatUrl, {
          method: "POST",
          headers: synthesisHeaders,
          body: JSON.stringify(synthesisPayload),
        });

        console.log(`Synthesis response status: ${synthesisResponse.status}`);

        if (!synthesisResponse.ok) {
          throw new Error(`Synthesis failed: ${synthesisResponse.statusText}`);
        }

        // Capture session ID from response header
        const returnedSessionId = synthesisResponse.headers.get("X-Session-ID");
        if (returnedSessionId) {
          console.log("Received X-Session-ID from LlamaFarm:", returnedSessionId);
          // Send session_id to client immediately
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionId: returnedSessionId })}\n\n`));
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
