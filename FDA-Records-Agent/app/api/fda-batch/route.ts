import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getLlamaFarmConfig, getLlamaFarmBaseURL } from "@/lib/config";

const FDA_LETTERS_DB = "fda_letters_full";
const FDA_CORPUS_DB = "fda_corpus_chunked";
const RESULTS_DIR = path.join(process.cwd(), "fda_results");

// In-memory progress tracker for UI updates
let batchProgress = {
  isProcessing: false,
  currentDocument: 0,
  totalDocuments: 0,
  currentDocumentName: "",
  currentChunk: 0,
  totalChunks: 0,
  questionsFound: 0,
  questionsValidated: 0,
  status: "idle" as "idle" | "processing" | "complete" | "error",
  message: "",
};

interface Question {
  question_text: string;
  type: "critical" | "administrative";
  context: string;
  page_reference?: string;
  confidence: number;
  document_name?: string;
  document_path?: string;
}

interface AnswerValidation {
  question: string;
  answered: boolean;
  completeness: "complete" | "partial" | "none";
  confidence: number;
  summary: string;
  evidence: Array<{ text: string; source: string }>;
}

interface QuestionWithAnswer {
  question_text: string;
  type: "critical" | "administrative";
  context: string;
  page_reference: string;
  confidence: number;
  document_name: string;
  document_path: string;
  answer: {
    answered: boolean;
    completeness: "complete" | "partial" | "none";
    confidence: number;
    summary: string;
    evidence: Array<{ text: string; source: string }>;
  };
}

interface ProcessedDocument {
  document_hash: string;
  document_name: string;
  document_path: string;
  questions: QuestionWithAnswer[];
  stats: {
    total_questions: number;
    critical_questions: number;
    administrative_questions: number;
    answered: number;
    unanswered: number;
  };
}

/**
 * POST /api/fda-batch
 *
 * Batch process FDA documents:
 * 1. Get all documents from fda_letters dataset
 * 2. For each document:
 *    - Retrieve chunks from fda_letters_full database
 *    - Extract questions from each chunk
 *    - For each question, search fda_corpus_chunked and validate answer
 * 3. Save results to JSON file
 */
export async function POST(req: NextRequest) {
  try {
    // Initialize progress tracking
    batchProgress = {
      isProcessing: true,
      currentDocument: 0,
      totalDocuments: 0,
      currentDocumentName: "",
      currentChunk: 0,
      totalChunks: 0,
      questionsFound: 0,
      questionsValidated: 0,
      status: "processing",
      message: "Initializing batch processing...",
    };

    const config = await getLlamaFarmConfig();
    const LF_BASE_URL = getLlamaFarmBaseURL();
    const LF_NAMESPACE = config.namespace;
    const LF_PROJECT = config.name;

    // Ensure results directory exists
    await fs.mkdir(RESULTS_DIR, { recursive: true });

    // Get batch parameters from query string
    const { searchParams } = new URL(req.url);
    const batchSize = parseInt(searchParams.get("batchSize") || "20");
    const startIndex = parseInt(searchParams.get("startIndex") || "0");

    // Get project configuration to retrieve document hashes
    const projectResponse = await fetch(
      `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}`
    );

    if (!projectResponse.ok) {
      throw new Error(`Failed to fetch project: ${projectResponse.statusText}`);
    }

    const projectData = await projectResponse.json();
    const datasets = projectData.project?.config?.datasets || [];
    const fdaLettersDataset = datasets.find((d: any) => d.name === "fda_letters");

    if (!fdaLettersDataset || !fdaLettersDataset.files || fdaLettersDataset.files.length === 0) {
      return NextResponse.json({
        error: "No documents found in fda_letters dataset. Please upload documents first.",
        instructions: [
          "1. Add your FDA documents to a directory on your computer",
          "2. Run: lf datasets upload fda_letters /path/to/your/files/*.pdf",
          "3. Run: lf datasets process fda_letters",
          "4. Repeat steps 2-3 for fda_corpus dataset",
          "5. Try batch processing again"
        ]
      }, { status: 400 });
    }

    const allDocumentHashes = fdaLettersDataset.files;
    const totalDocuments = allDocumentHashes.length;

    // Process only the specified batch
    const documentHashes = allDocumentHashes.slice(startIndex, startIndex + batchSize);
    const endIndex = Math.min(startIndex + batchSize, totalDocuments);

    // Update progress with total
    batchProgress.totalDocuments = documentHashes.length;
    batchProgress.message = `Processing ${documentHashes.length} documents...`;

    console.log(`\nProcessing batch: documents ${startIndex + 1}-${endIndex} of ${totalDocuments}`);

    const processedDocuments: ProcessedDocument[] = [];

    // Process each document
    for (let i = 0; i < documentHashes.length; i++) {
      const documentHash = documentHashes[i];

      // Get real document name from metadata
      const documentName = await getDocumentName(documentHash, LF_NAMESPACE, LF_PROJECT) || `Document_${i + 1}.pdf`;

      // Update progress
      batchProgress.currentDocument = i + 1;
      batchProgress.currentDocumentName = documentName;
      batchProgress.message = `Processing ${documentName}...`;
      batchProgress.questionsFound = 0;
      batchProgress.questionsValidated = 0;

      // Construct document path
      const documentPath = path.join(
        process.env.HOME || "",
        ".llamafarm/projects",
        LF_NAMESPACE,
        LF_PROJECT,
        "lf_data/raw",
        documentHash
      );

      console.log(`\n[${i + 1}/${documentHashes.length}] Processing ${documentName} (${documentHash.substring(0, 12)}...)`);

      // Step 1: Get all chunks for this document from fda_letters_full
      const chunks = await getDocumentChunks(documentHash, FDA_LETTERS_DB, LF_BASE_URL, LF_NAMESPACE, LF_PROJECT);

      if (chunks.length === 0) {
        console.warn(`No chunks found for document ${documentHash.substring(0, 12)}`);
        continue;
      }

      console.log(`  Retrieved ${chunks.length} chunks`);

      // Update progress with chunk total
      batchProgress.totalChunks = chunks.length;
      batchProgress.currentChunk = 0;

      // Step 2: Extract questions from each chunk
      const allQuestions: Question[] = [];
      console.log(`  Extracting questions from ${chunks.length} chunks...`);

      for (let j = 0; j < chunks.length; j++) {
        const chunk = chunks[j];
        console.log(`    Chunk ${j + 1}/${chunks.length} (Page ${chunk.metadata?.page || j + 1})...`);

        const chunkQuestions = await extractQuestionsFromChunk(
          chunk.content,
          documentName,
          chunk.metadata?.page || j + 1,
          LF_BASE_URL,
          LF_NAMESPACE,
          LF_PROJECT
        );

        if (chunkQuestions.length > 0) {
          console.log(`      → Found ${chunkQuestions.length} questions`);
        }

        allQuestions.push(...chunkQuestions);
      }

      // Deduplicate questions
      const deduplicatedQuestions = deduplicateQuestions(allQuestions);
      console.log(`  ✓ Extracted ${deduplicatedQuestions.length} unique questions from ${allQuestions.length} total`);

      // Add document metadata to each question
      const questions = deduplicatedQuestions.map(q => ({
        ...q,
        document_name: documentName,
        document_path: documentPath,
      }));

      // Step 3: Validate answers for ALL questions in PARALLEL (huge performance gain)
      console.log(`  Validating answers for ${questions.length} questions IN PARALLEL...`);

      const answerPromises = questions.map(async (question, index) => {
        console.log(`    Starting question ${index + 1}/${questions.length}: "${question.question_text.substring(0, 60)}..."`);

        const validation = await validateAnswer(
          question,
          documentName,
          documentHash,
          chunks,
          LF_BASE_URL,
          LF_NAMESPACE,
          LF_PROJECT
        );

        console.log(`      → ${validation.answered ? '✓ Answered' : '✗ Not answered'} (confidence: ${validation.confidence})`);

        return {
          question_text: question.question_text,
          type: question.type,
          context: question.context,
          page_reference: question.page_reference || "",
          confidence: question.confidence,
          document_name: documentName,
          document_path: documentPath,
          answer: {
            answered: validation.answered,
            completeness: validation.completeness,
            confidence: validation.confidence,
            summary: validation.summary,
            evidence: validation.evidence,
          },
        };
      });

      const questionsWithAnswers = await Promise.all(answerPromises);
      console.log(`  ✓ Completed ${questionsWithAnswers.length} answer validations in parallel`);

      // Calculate stats
      const stats = {
        total_questions: questionsWithAnswers.length,
        critical_questions: questionsWithAnswers.filter(q => q.type === "critical").length,
        administrative_questions: questionsWithAnswers.filter(q => q.type === "administrative").length,
        answered: questionsWithAnswers.filter(q => q.answer.answered).length,
        unanswered: questionsWithAnswers.filter(q => !q.answer.answered).length,
      };

      processedDocuments.push({
        document_hash: documentHash,
        document_name: documentName,
        document_path: documentPath,
        questions: questionsWithAnswers,
        stats,
      });

      console.log(`  Questions answered: ${stats.answered}/${stats.total_questions}`);
    }

    // Save results to JSON file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dateFolder = new Date().toISOString().split("T")[0];
    const resultDir = path.join(RESULTS_DIR, dateFolder);
    await fs.mkdir(resultDir, { recursive: true });

    const resultFile = path.join(resultDir, `batch_${timestamp}.json`);
    await fs.writeFile(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      project: LF_PROJECT,
      namespace: LF_NAMESPACE,
      batch_info: {
        start_index: startIndex,
        end_index: endIndex,
        batch_size: documentHashes.length,
        total_documents: totalDocuments,
        remaining: totalDocuments - endIndex,
        has_more: endIndex < totalDocuments,
      },
      documents: processedDocuments,
      summary: {
        total_documents: processedDocuments.length,
        total_questions: processedDocuments.reduce((sum, d) => sum + d.stats.total_questions, 0),
        total_answered: processedDocuments.reduce((sum, d) => sum + d.stats.answered, 0),
        total_unanswered: processedDocuments.reduce((sum, d) => sum + d.stats.unanswered, 0),
      }
    }, null, 2));

    console.log(`\n✓ Results saved to: ${resultFile}`);

    // Mark processing complete
    batchProgress.isProcessing = false;
    batchProgress.status = "complete";
    batchProgress.message = `✓ Completed ${processedDocuments.length} documents`;

    return NextResponse.json({
      success: true,
      result_file: resultFile,
      documents_processed: processedDocuments.length,
      batch_info: {
        start_index: startIndex,
        end_index: endIndex,
        batch_size: documentHashes.length,
        total_documents: totalDocuments,
        remaining: totalDocuments - endIndex,
        has_more: endIndex < totalDocuments,
        next_start_index: endIndex < totalDocuments ? endIndex : null,
      },
      summary: {
        total_documents: processedDocuments.length,
        total_questions: processedDocuments.reduce((sum, d) => sum + d.stats.total_questions, 0),
        total_answered: processedDocuments.reduce((sum, d) => sum + d.stats.answered, 0),
        total_unanswered: processedDocuments.reduce((sum, d) => sum + d.stats.unanswered, 0),
      }
    });

  } catch (error: any) {
    console.error("Batch processing error:", error);

    // Mark error
    batchProgress.isProcessing = false;
    batchProgress.status = "error";
    batchProgress.message = `Error: ${error.message}`;

    return NextResponse.json({
      error: error.message || "Batch processing failed"
    }, { status: 500 });
  }
}

/**
 * GET /api/fda-batch/progress
 * Returns current batch processing progress for UI updates
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Check if this is a progress request
  if (searchParams.get("action") === "progress") {
    return NextResponse.json(batchProgress);
  }

  // Otherwise, return saved results (existing GET behavior)
  try {
    const config = await getLlamaFarmConfig();
    const LF_BASE_URL = getLlamaFarmBaseURL();
    const LF_NAMESPACE = config.namespace;
    const LF_PROJECT = config.name;

    await fs.mkdir(RESULTS_DIR, { recursive: true });

    // Get total document count from project
    let totalDocuments = 0;
    try {
      const projectResponse = await fetch(
        `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}`
      );
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        const datasets = projectData.project?.config?.datasets || [];
        const fdaLettersDataset = datasets.find((d: any) => d.name === "fda_letters");
        totalDocuments = fdaLettersDataset?.files?.length || 0;
      }
    } catch (e) {
      console.error("Failed to fetch project info:", e);
    }

    const dateFolders = await fs.readdir(RESULTS_DIR);
    const allResults: any[] = [];

    for (const dateFolder of dateFolders) {
      const folderPath = path.join(RESULTS_DIR, dateFolder);
      const stat = await fs.stat(folderPath);

      if (stat.isDirectory()) {
        const files = await fs.readdir(folderPath);

        for (const file of files) {
          if (file.endsWith(".json")) {
            const filePath = path.join(folderPath, file);
            const content = await fs.readFile(filePath, "utf-8");
            const data = JSON.parse(content);

            allResults.push({
              file: path.join(dateFolder, file),
              timestamp: data.timestamp,
              summary: data.summary,
            });
          }
        }
      }
    }

    // Sort by timestamp (newest first)
    allResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      total_documents: totalDocuments,
      results: allResults
    });
  } catch (error: any) {
    console.error("Failed to list results:", error);
    return NextResponse.json({
      error: error.message || "Failed to list results"
    }, { status: 500 });
  }
}

/**
 * Get the real document name from metadata
 */
async function getDocumentName(
  documentHash: string,
  LF_NAMESPACE: string,
  LF_PROJECT: string
): Promise<string | null> {
  try {
    // Read metadata file from lf_data/meta/{hash}.json
    const metadataPath = path.join(
      process.env.HOME || "",
      ".llamafarm/projects",
      LF_NAMESPACE,
      LF_PROJECT,
      "lf_data/meta",
      `${documentHash}.json`
    );

    const metadataContent = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(metadataContent);

    return metadata.original_file_name || null;
  } catch (error) {
    console.error(`Failed to get document name for ${documentHash.substring(0, 12)}:`, error);
    return null;
  }
}

/**
 * Get all chunks for a document from the RAG database
 */
async function getDocumentChunks(
  documentHash: string,
  database: string,
  LF_BASE_URL: string,
  LF_NAMESPACE: string,
  LF_PROJECT: string
): Promise<Array<{ content: string; metadata: any }>> {
  try {
    // Use a generic query to retrieve many results
    const response = await fetch(
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

    if (!response.ok) {
      console.error(`RAG query failed: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const results = data.results || [];

    // Filter to only chunks matching this document hash
    const matchingChunks = results.filter((result: any) => {
      const metadata = result.metadata || {};
      const fileHash = metadata.file_hash || metadata.source || "";
      return documentHash.includes(fileHash) || fileHash.includes(documentHash);
    });

    return matchingChunks.map((result: any) => ({
      content: result.content || "",
      metadata: result.metadata || {},
    }));
  } catch (error) {
    console.error(`Failed to get chunks for ${documentHash}:`, error);
    return [];
  }
}

/**
 * Strip <think></think> blocks from qwen3 responses
 */
function stripThinkBlocks(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Pre-filter task candidates before LLM validation (performance optimization)
 */
function quickRejectTask(taskText: string): { reject: boolean; reason: string } {
  const lower = taskText.toLowerCase();

  // Reject meta-instructions
  if (lower.includes("review document") || lower.includes("extract") || lower.includes("analyze")) {
    return { reject: true, reason: "Meta-instruction detected" };
  }

  // Reject if starts with common garbage patterns
  if (lower.startsWith("center for") || lower.startsWith("department of") || lower.startsWith("subject:")) {
    return { reject: true, reason: "Header/boilerplate pattern" };
  }

  // Reject if mostly uppercase (likely a header)
  const uppercaseRatio = (taskText.match(/[A-Z]/g) || []).length / taskText.length;
  if (uppercaseRatio > 0.7) {
    return { reject: true, reason: "All-caps header" };
  }

  // Reject if too few words
  const wordCount = taskText.split(/\s+/).length;
  if (wordCount < 5) {
    return { reject: true, reason: "Too short (< 5 words)" };
  }

  // Reject if contains page/document references (likely meta-text)
  if (/page \d+/i.test(taskText) || /document_\d+/i.test(taskText)) {
    return { reject: true, reason: "Contains page/doc references" };
  }

  return { reject: false, reason: "" };
}

/**
 * Validate if a task is a REAL FDA task (Stage 2 filter)
 */
async function validateTask(
  taskText: string,
  LF_BASE_URL: string,
  LF_NAMESPACE: string,
  LF_PROJECT: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "task_validator",
          messages: [
            {
              role: "user",
              content: `Is this a REAL FDA task or request?\n\nText: "${taskText}"`,
            },
          ],
          temperature: 0.1, // Low temperature for consistent validation
          max_tokens: 50,
          rag_enabled: false,
        }),
      }
    );

    if (!response.ok) {
      console.error(`Task validation failed: ${response.statusText}`);
      return false; // Default to rejecting if validation fails
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    // Strip <think> blocks from qwen3 response
    const content = stripThinkBlocks(rawContent);

    // Parse <valid>yes</valid> or <valid>no</valid>
    const validMatch = content.match(/<valid>([\s\S]*?)<\/valid>/);
    const isValid = validMatch && validMatch[1].trim().toLowerCase() === "yes";

    return isValid;
  } catch (error) {
    console.error("Task validation error:", error);
    return false; // Default to rejecting on error
  }
}

/**
 * Extract questions from a single chunk using LLM
 */
async function extractQuestionsFromChunk(
  chunkContent: string,
  documentName: string,
  page: number,
  LF_BASE_URL: string,
  LF_NAMESPACE: string,
  LF_PROJECT: string
): Promise<Question[]> {
  // Skip very short chunks
  if (chunkContent.trim().length < 100) {
    return [];
  }

  try {
    const response = await fetch(
      `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "question_extractor",
          messages: [
            {
              role: "user",
              content: `Document: ${documentName} (Page ${page})\n\nChunk Content:\n${chunkContent}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
          rag_enabled: false,
        }),
      }
    );

    if (!response.ok) {
      console.error(`Question extraction failed: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    // Strip <think> blocks (in case model outputs them)
    const content = stripThinkBlocks(rawContent);

    console.log(`LLM Response for ${documentName} Page ${page}:`, content.substring(0, 200));

    // Parse simplified XML format: <task>exact text</task>
    const questions: Question[] = [];

    // Extract all <task> tags
    const taskMatches = Array.from(content.matchAll(/<task>([\s\S]*?)<\/task>/g));

    console.log(`Found ${taskMatches.length} candidate tasks`);

    // STAGE 1: Quick pre-filter (no LLM calls)
    const preFilteredCandidates = taskMatches
      .map(match => match[1].trim())
      .filter(taskText => {
        // Length check
        if (taskText.length < 20 || taskText.length >= 1000) {
          console.log(`  ✗ Pre-filter (length ${taskText.length}): "${taskText.substring(0, 50)}..."`);
          return false;
        }

        // Quick heuristic rejection
        const quickCheck = quickRejectTask(taskText);
        if (quickCheck.reject) {
          console.log(`  ✗ Pre-filter (${quickCheck.reason}): "${taskText.substring(0, 50)}..."`);
          return false;
        }

        return true;
      });

    console.log(`After pre-filter: ${preFilteredCandidates.length} candidates (${taskMatches.length - preFilteredCandidates.length} rejected)`);

    // STAGE 2: Validate all candidates in PARALLEL (huge performance gain)
    const validationPromises = preFilteredCandidates.map(async (taskText) => {
      const isValid = await validateTask(taskText, LF_BASE_URL, LF_NAMESPACE, LF_PROJECT);
      return { taskText, isValid };
    });

    const validationResults = await Promise.all(validationPromises);

    // Collect valid questions
    for (const { taskText, isValid } of validationResults) {
      if (isValid) {
        const question: Question = {
          question_text: taskText,
          type: "critical",
          context: `${documentName}, Page ${page}`,
          page_reference: `Page ${page}`,
          confidence: 0.9, // Higher confidence since it passed validation
        };

        questions.push(question);
        console.log(`  ✓ Valid task: "${taskText.substring(0, 80)}..."`);
      } else {
        console.log(`  ✗ Invalid task (LLM rejected): "${taskText.substring(0, 60)}..."`);
      }
    }

    console.log(`Total validated questions: ${questions.length} (from ${taskMatches.length} candidates)`);
    return questions;
  } catch (error) {
    console.error("Question extraction error:", error);
    return [];
  }
}

/**
 * Validate if a question has been answered
 * Searches within the SAME document only
 */
async function validateAnswer(
  question: Question,
  sourceDocument: string,
  documentHash: string,
  documentChunks: Array<{ content: string; metadata: any }>,
  LF_BASE_URL: string,
  LF_NAMESPACE: string,
  LF_PROJECT: string
): Promise<AnswerValidation> {
  // Skip administrative questions for speed
  if (question.type === "administrative") {
    return {
      question: question.question_text,
      answered: false,
      completeness: "none",
      confidence: 0,
      summary: "Skipped administrative question",
      evidence: [],
    };
  }

  try {
    // Use the document's own chunks as context (no cross-document search)
    // Take up to 5 most relevant chunks based on simple keyword matching
    const questionWords = question.question_text.toLowerCase().split(/\s+/);
    const scoredChunks = documentChunks.map(chunk => {
      const chunkText = chunk.content.toLowerCase();
      const score = questionWords.filter(word => word.length > 3 && chunkText.includes(word)).length;
      return { ...chunk, score };
    });

    const topChunks = scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter(c => c.score > 0);

    const ragResults = topChunks.map(c => ({ content: c.content }));

    if (ragResults.length === 0) {
      return {
        question: question.question_text,
        answered: false,
        completeness: "none",
        confidence: 0,
        summary: "No relevant documents found",
        evidence: [],
      };
    }

    // Build context from RAG results
    const context = ragResults
      .map((r: any, idx: number) => `[Result ${idx + 1}]\n${r.content}`)
      .join("\n\n");

    // Ask LLM to validate if the question is answered
    const validationResponse = await fetch(
      `${LF_BASE_URL}/v1/projects/${LF_NAMESPACE}/${LF_PROJECT}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "answer_finder",
          messages: [
            {
              role: "user",
              content: `Document: ${sourceDocument}\n\nTask from FDA: ${question.question_text}\n\nContext: ${question.context}\n\nExcerpts from THIS SAME document:\n${context}`,
            },
          ],
          temperature: 0.5,
          max_tokens: 500,
          rag_enabled: false,
        }),
      }
    );

    if (!validationResponse.ok) {
      console.error(`Answer validation failed: ${validationResponse.statusText}`);
      return {
        question: question.question_text,
        answered: false,
        completeness: "none",
        confidence: 0,
        summary: "Validation failed",
        evidence: [],
      };
    }

    const validationData = await validationResponse.json();
    const rawValidationContent = validationData.choices?.[0]?.message?.content || "";

    // Strip <think> blocks from qwen3 response
    const validationContent = stripThinkBlocks(rawValidationContent);

    // Parse simplified XML format: <answered>yes/no</answered> and optional <quote>text</quote>
    const answeredMatch = validationContent.match(/<answered>([\s\S]*?)<\/answered>/);
    const quoteMatch = validationContent.match(/<quote>([\s\S]*?)<\/quote>/);

    const isAnswered = answeredMatch && answeredMatch[1].trim().toLowerCase() === "yes";
    const quoteText = quoteMatch ? quoteMatch[1].trim() : "";

    const evidence: Array<{ text: string; source: string }> = [];
    if (isAnswered && quoteText) {
      evidence.push({
        text: quoteText,
        source: sourceDocument,
      });
    }

    return {
      question: question.question_text,
      answered: isAnswered,
      completeness: isAnswered ? "complete" : "none",
      confidence: isAnswered ? 0.8 : 0,
      summary: isAnswered
        ? `Answer found: ${quoteText.substring(0, 100)}...`
        : "No answer found in document",
      evidence,
    };
  } catch (error) {
    console.error("Answer validation error:", error);
    return {
      question: question.question_text,
      answered: false,
      completeness: "none",
      confidence: 0,
      summary: "Validation error",
      evidence: [],
    };
  }
}

/**
 * Deduplicate questions using text similarity
 */
function deduplicateQuestions(questions: Question[]): Question[] {
  if (questions.length === 0) return [];

  const unique: Question[] = [];
  const seenTexts = new Set<string>();

  for (const q of questions) {
    const normalized = q.question_text.toLowerCase().trim().replace(/\s+/g, " ");
    const key = normalized.substring(0, 150);

    if (!seenTexts.has(key)) {
      seenTexts.add(key);
      unique.push(q);
    }
  }

  return unique;
}

