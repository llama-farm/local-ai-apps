import { NextRequest } from "next/server";

const LF_BASE_URL = process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
const LF_NAMESPACE = process.env.NEXT_PUBLIC_LF_NAMESPACE || "default";
const LF_PROJECT = process.env.NEXT_PUBLIC_LF_PROJECT || "va-disability-helper-project";
const LF_MODEL = process.env.NEXT_PUBLIC_LF_MODEL || "va_advisor";
const LF_FAST_MODEL = "fast"; // Small, fast model for query generation
const LF_DATABASE = process.env.NEXT_PUBLIC_LF_DATABASE || "va_regulations_db";

const QUERY_GENERATION_PROMPT = `Analyze the user's VA disability question and generate focused search queries for VA knowledge retrieval.

STEP 1: Identify the question type (rating, claim decision, evidence needed, service connection, appeal, etc.)
STEP 2: Write a brief summary (2-3 sentences) of key VA disability-related information
STEP 3: Generate 5-8 diverse search queries covering DIFFERENT VA disability aspects

OUTPUT FORMAT:
<doc_type>Rating|Claim|Evidence|ServiceConnection|Appeal|Other</doc_type>
<summary>Brief 2-3 sentence summary highlighting VA disability-specific findings</summary>

<rag_question>first specific VA disability search query</rag_question>
<rag_question>second specific VA disability search query</rag_question>
<rag_question>third specific VA disability search query</rag_question>
<rag_question>fourth specific VA disability search query</rag_question>
<rag_question>fifth specific VA disability search query</rag_question>

IMPORTANT FOR VA DISABILITY QUESTIONS:
- Extract specific diagnostic codes (DC), rating percentages, CFR sections
- Identify conditions mentioned (PTSD, tinnitus, back pain, etc.)
- Note service connection elements (in-service event, current diagnosis, nexus)
- Capture claim timelines and deadlines (HLR, supplemental claim, appeal windows)
- Include VA-specific terminology (C&P exam, DBQ, nexus letter, IMO, buddy statement)
- Reference relevant regulations (38 CFR Part 4, M21-1, etc.)
- Keep queries 5-20 words each for VA complexity

EXAMPLE 1 - Rating Question:

Question: What percentage can I get for PTSD with nightmares and panic attacks?

<doc_type>Rating</doc_type>
<summary>Veteran asking about PTSD disability rating percentage based on specific symptoms including nightmares and panic attacks. Needs information on 38 CFR 4.130 diagnostic code 9411.</summary>

<rag_question>PTSD diagnostic code 9411 rating criteria symptoms</rag_question>
<rag_question>nightmares panic attacks PTSD percentage rating</rag_question>
<rag_question>30 percent 50 percent 70 percent PTSD difference</rag_question>
<rag_question>occupational and social impairment PTSD rating</rag_question>
<rag_question>C&P exam PTSD what to expect questions</rag_question>

EXAMPLE 2 - Service Connection:

Question: My back pain started during service but I didn't report it. Can I still get service connected?

<doc_type>ServiceConnection</doc_type>
<summary>Veteran has back pain that began during military service but lacks service treatment records documenting the condition. May need buddy statements and nexus letter for service connection.</summary>

<rag_question>service connection without service treatment records STRs</rag_question>
<rag_question>back pain lumbar spine service connection requirements</rag_question>
<rag_question>buddy statements lay evidence service connection</rag_question>
<rag_question>nexus letter IMO independent medical opinion requirements</rag_question>
<rag_question>continuity of treatment after service discharge</rag_question>`;

const SYNTHESIS_PROMPT = `You are an expert VA Disability Claims Assistant helping veterans understand their disability claims, ratings, and benefits. You will receive:
1. A veteran's VA disability-related question
2. Relevant excerpts from VA regulations, rating schedules, or knowledge base
3. Optional excerpts from the veteran's uploaded documents (decision letters, medical records, etc.)

Your task:
- Synthesize a comprehensive, accurate response about VA disability matters
- Explain VA disability concepts in clear, simple language (avoid jargon or define it)
- Break down complex terminology (service connection, nexus, DBQs, C&P exams, combined ratings, etc.)
- Cite specific CFR sections, diagnostic codes, or M21-1 manual sections when available
- Calculate ratings and combined ratings when possible
- Provide actionable next steps (e.g., "file a supplemental claim", "request higher-level review within 1 year")
- Be empathetic - disability claims are often stressful and confusing for veterans
- Always note this is general guidance, not legal advice

Format your response with:
- **Summary**: Brief overview of the VA disability situation (2-3 sentences)
- **What This Means**: Explain the VA concepts or situation in plain English
- **Rating/Evidence Details**: Specific diagnostic codes, percentages, requirements from regulations
- **Your Next Steps**: Actionable items with timelines (if applicable)
- **Important Deadlines**: Appeal deadlines, filing windows, or critical timeframes
- **Additional Resources**: Suggest VSO assistance, VA forms, or helpful references`;

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
  console.log("🔥🔥🔥 VA AGENT-CHAT ENDPOINT HIT 🔥🔥🔥");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await req.json();
        const { prompt, excerpts = [], topK = 10, scoreThreshold = 0.7, sessionId } = body;

        console.log("=== VA AGENT-CHAT REQUEST ===");
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
            ? `\n\nVeteran's uploaded document excerpts:\n${excerpts.map((text: string, i: number) => `[${i + 1}] ${text}`).join("\n\n")}`
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
          initialAnalysis = generatedQueriesText;

          // Parse XML tags to extract queries for RAG
          const ragQuestionRegex = /<rag_question>(.*?)<\/rag_question>/gs;
          const matches = [...generatedQueriesText.matchAll(ragQuestionRegex)];

          if (matches.length > 0) {
            queries = matches.map(match => match[1].trim()).filter(q => q.length > 0);
            console.log(`Extracted ${queries.length} queries from XML tags:`, queries);

            // Filter out low-quality queries
            const minWordCount = 3;
            const maxWordCount = 25;
            const genericTerms = ['what', 'how', 'explain', 'tell me', 'information about'];

            queries = queries.filter(q => {
              const words = q.split(/\s+/);
              const wordCount = words.length;

              if (wordCount < minWordCount) return false;
              if (wordCount > maxWordCount) return false;

              const isGeneric = genericTerms.some(term =>
                q.toLowerCase().trim().startsWith(term) && wordCount <= 4
              );
              if (isGeneric) return false;

              return true;
            });

            console.log(`After quality filtering: ${queries.length} queries`);
            sendUpdate(`Generated ${queries.length} high-quality search queries\n`);
          } else {
            console.log("No <rag_question> tags found in response, using original prompt");
            queries = [prompt];
          }

          queries = queries.slice(0, 8); // Max 8 queries
          console.log(`Using ${queries.length} queries for RAG search`);
          sendUpdate(`Using ${queries.length} focused queries to search VA databases\n`);
        }

        // Step 2: Execute RAG queries in parallel
        // Search ALL databases: regulations, knowledge base, and rating schedules
        sendUpdate("Searching VA regulations, knowledge base, and rating schedules...\n");

        const ragUrl = `${LF_BASE_URL}/v1/projects/${encodeURIComponent(LF_NAMESPACE)}/${encodeURIComponent(LF_PROJECT)}/rag/query`;

        console.log(`=== EXECUTING ${queries.length} RAG QUERIES ===`);
        console.log("RAG URL:", ragUrl);
        console.log("Databases to search:");
        console.log("  1. Regulations:", LF_DATABASE);
        console.log("  2. Knowledge base: va_knowledge_db");
        console.log("  3. Rating schedules: va_rating_schedules_db");

        // Search ALL three databases in parallel
        const databases = [LF_DATABASE, "va_knowledge_db", "va_rating_schedules_db"];
        const ragPromises = queries.flatMap(query =>
          databases.map(async (database) => {
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

        // Document-level metadata filtering for highly relevant documents
        const highScoreThreshold = 0.8;
        const documentScores = new Map<string, { count: number; maxScore: number; database: string }>();

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

        // Fetch additional chunks from highly relevant documents
        const documentsToExpand = Array.from(documentScores.entries())
          .filter(([_, stats]) => stats.count >= 2)
          .sort((a, b) => b[1].maxScore - a[1].maxScore)
          .slice(0, 3);

        console.log(`Found ${documentsToExpand.length} highly relevant documents to expand`);

        if (documentsToExpand.length > 0) {
          sendUpdate(`Fetching additional context from ${documentsToExpand.length} relevant document(s)...\n`);

          const expandPromises = documentsToExpand.map(async ([docSource, stats]) => {
            try {
              console.log(`[EXPAND] Fetching more chunks from: ${docSource}`);
              const response = await fetch(ragUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: prompt,
                  database: stats.database,
                  top_k: 15,
                  score_threshold: 0.5,
                  metadata_filter: { source: docSource }
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

          allResults = [...allResults, ...additionalChunks];
        }

        console.log(`Total results after document expansion: ${allResults.length}`);

        // Deduplicate results
        const uniqueResults = Array.from(
          new Map(allResults.map((r) => [r.content.substring(0, 100), r])).values()
        ).slice(0, 25);

        console.log(`Unique results after dedup: ${uniqueResults.length}`);

        sendUpdate(`Found ${uniqueResults.length} relevant excerpts\n`);
        sendUpdate("</think>\n\n");

        // Build citations
        const citations = uniqueResults.map((r, idx) => ({
          id: `cite-${idx}`,
          source: r.metadata?.source || "VA Knowledge Base",
          page: r.metadata?.page,
          score: r.score,
          snippet: r.content.substring(0, 150),
        }));

        sendCitations(citations);

        // Step 3: Synthesize response using LLM with RAG results
        console.log("=== SYNTHESIS STEP ===");

        const ragContext = uniqueResults
          .map((r, idx) => {
            const source = r.metadata?.source || "Unknown";
            const page = r.metadata?.page ? ` (p.${r.metadata.page})` : "";
            return `[VA Knowledge ${idx + 1}] Source: ${source}${page}\n${r.content}`;
          })
          .join("\n\n");

        console.log(`RAG context length: ${ragContext.length} chars`);

        const userDocsContext = excerpts.length
          ? `\n\nVETERAN'S UPLOADED DOCUMENTS:\n${excerpts.map((text: string, i: number) => `[Veteran Doc ${i + 1}]:\n${text}`).join("\n\n")}`
          : "";

        const initialAnalysisContext = initialAnalysis
          ? `\n\nINITIAL ANALYSIS (from first model):\n${initialAnalysis}`
          : "";

        const synthesisUserPrompt = `${SYNTHESIS_PROMPT}

---

VETERAN'S QUESTION: ${prompt}
${userDocsContext}
${initialAnalysisContext}

RETRIEVED VA KNOWLEDGE:
${ragContext}

---

Please provide a comprehensive response that:
1. Addresses the veteran's question directly
2. Explains key VA disability information in simple terms
3. Uses the retrieved knowledge to provide regulatory context
4. Cites sources when referencing regulations or rating schedules`;

        const synthesisMessages = [
          {
            role: "user",
            content: synthesisUserPrompt
          },
        ];

        console.log(`Calling synthesis with model (${LF_MODEL}), session_id=${sessionId || '(new)'}`);

        const synthesisHeaders: Record<string, string> = {
          "Content-Type": "application/json"
        };

        if (sessionId) {
          synthesisHeaders["X-Session-ID"] = sessionId;
          console.log("Including X-Session-ID header:", sessionId);
        }

        const synthesisPayload = {
          model: LF_MODEL,
          messages: synthesisMessages,
          temperature: 0.5,
          max_tokens: 2000,
          stream: true,
          rag_enabled: false,
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
        console.error("VA Agent chat error:", error);
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
