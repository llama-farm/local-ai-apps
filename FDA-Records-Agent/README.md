# FDA Records Agent - Batch Document Processing 📋

**Intelligent batch processing for FDA correspondence** – Extract questions from FDA letters and find answers within the same documents using local AI and RAG (Retrieval-Augmented Generation). Built with [LlamaFarm](https://docs.llamafarm.dev) for 100% local, privacy-first document analysis.

---

## 🎯 What Does This Do?

This tool processes FDA correspondence (warning letters, meeting minutes, regulatory emails) to:

1. **Extract FDA requests/questions** from documents using AI
2. **Validate** each extracted question (filter out false positives)
3. **Search for answers** within the same document corpus
4. **Output structured JSON** with question-answer pairs and metadata

### Example Use Case

**Input:** 500 FDA warning letters (PDFs)

**Output:** JSON file with:
- All specific FDA requests extracted: "Submit the immunogenicity data set including all antibody test results"
- Validation status for each question
- Answers found in correspondence
- Document metadata (filename, page numbers, confidence scores)

---

## ✨ Key Features

- **🔒 100% Local Processing** – All AI runs on your machine, no cloud APIs
- **⚡ High Performance** – Parallel processing (2-3x faster than serial)
- **🎯 Two-Stage Filtering** – Pre-filter heuristics + LLM validation
- **📊 Batch Processing UI** – Web interface with progress tracking
- **🧠 Context-Aware Extraction** – Requires specific context in questions
- **📄 Structured Output** – Clean JSON with combined question-answer objects
- **🔍 Smart Pre-Filtering** – Rejects garbage (headers, meta-instructions) instantly
- **🚀 Part of LlamaFarm** – Extensible RAG framework for local AI

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Setup](#-setup)
- [Usage](#-usage)
- [Performance](#-performance)
- [Configuration](#-configuration)
- [Output Format](#-output-format)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)

---

## 🚀 Quick Start

### Prerequisites

**Required:**
- Docker (for LlamaFarm services)
- Ollama (for local LLM inference)
- Node.js 18+ (for web UI)
- 8GB+ RAM
- 10GB+ disk space

### Installation

```bash
# 1. Clone this repository
git clone https://github.com/yourusername/FDA-Records-Agent.git
cd FDA-Records-Agent

# 2. Install Ollama
# macOS:
brew install ollama

# Linux:
curl -fsSL https://ollama.com/install.sh | sh

# Windows: Download from https://ollama.com/download

# 3. Install LlamaFarm CLI
curl -fsSL https://raw.githubusercontent.com/llama-farm/llamafarm/main/install.sh | bash
# Windows: Download lf.exe from https://github.com/llama-farm/llamafarm/releases

# 4. Pull AI models (1.5GB total)
ollama pull qwen3:1.7b          # Question extractor & task validator
ollama pull nomic-embed-text    # Vector embeddings for RAG

# 5. Start LlamaFarm services
lf start

# 6. Install frontend dependencies
npm install

# 7. Start the web UI
npm run dev
```

Open **http://localhost:3000/batch** to access the batch processing interface.

---

## 🏗 Architecture

### Processing Pipeline

```
┌─────────────────────────────────────────────┐
│ Step 1: Upload Documents to LlamaFarm      │
│ Command: lf datasets upload fda_letters    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Step 2: Generate Embeddings                 │
│ - Parse PDFs with LlamaIndex               │
│ - Chunk into 2000-char sections (questions)│
│ - Chunk into 800-char sections (answers)   │
│ - Generate 768-dim embeddings (nomic)      │
│ Command: lf datasets process fda_letters   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Step 3: Extract Questions (Per Chunk)      │
│ Model: qwen3:1.7b (question_extractor)     │
│ - Find FDA requests in large chunks        │
│ - Extract with surrounding context         │
│ - Pre-filter: Reject headers/meta-text     │
│ Output: Candidate questions                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Step 4: Validate Questions (Parallel)      │
│ Model: qwen3:1.7b (task_validator)         │
│ - Check if REAL FDA task                   │
│ - Reject vague questions                   │
│ - All candidates validated in parallel     │
│ Output: Validated questions                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Step 5: Find Answers (Parallel)            │
│ Model: qwen3:1.7b (answer_finder)          │
│ - Search same document for answers         │
│ - Keyword-based chunk retrieval            │
│ - Validate if answer is complete           │
│ - All questions processed in parallel      │
│ Output: Question + Answer pairs            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Step 6: Save to JSON                        │
│ Path: fda_results/YYYY-MM-DD/batch_*.json  │
│ - Document metadata                         │
│ - Questions with answers                    │
│ - Statistics and confidence scores         │
└─────────────────────────────────────────────┘
```

### Two-Tier Document Processing

**Large Chunks (fda_letters_full):**
- **Purpose:** Question extraction
- **Chunk size:** 2000 characters
- **Overlap:** 400 characters
- **Strategy:** Sentence-based (preserves complete thoughts)

**Small Chunks (fda_corpus_chunked):**
- **Purpose:** Answer retrieval
- **Chunk size:** 800 characters
- **Overlap:** 200 characters
- **Strategy:** Paragraph-based (semantic coherence)

### Performance Optimizations

1. **Pre-filtering** – Instant rejection of garbage (no LLM call):
   - Headers: "Center for Drug Evaluation..."
   - Meta-instructions: "Review Document_1.pdf..."
   - Page references: "See page 7..."
   - All-caps headers (>70% uppercase)

2. **Parallel Validation** – All question candidates validated simultaneously:
   - **Before:** 10 questions × 2 sec = 20 sec
   - **After:** 10 questions in parallel = ~2 sec

3. **Parallel Answer Finding** – All answers retrieved simultaneously:
   - **Before:** 10 answers × 5 sec = 50 sec
   - **After:** 10 answers in parallel = ~5 sec

**Total speedup:** 2-3x faster (5 min → 1.5-2 min for 2 documents)

---

## 🛠 Setup

### 1. Prepare Your Documents

Place FDA documents (PDFs or TXT files) in a directory:

```bash
mkdir fda-documents
cp /path/to/*.pdf fda-documents/
```

### 2. Upload to LlamaFarm

Upload to **both** datasets (questions and answers use different chunking):

```bash
# Upload to fda_letters (large chunks for question extraction)
lf datasets upload fda_letters fda-documents/*.pdf
lf datasets upload fda_letters fda-documents/*.txt

# Upload to fda_corpus (small chunks for answer retrieval)
lf datasets upload fda_corpus fda-documents/*.pdf
lf datasets upload fda_corpus fda-documents/*.txt
```

### 3. Process Datasets

Generate embeddings (may take 10-30 minutes depending on corpus size):

```bash
# Process both datasets
lf datasets process fda_letters
lf datasets process fda_corpus
```

**Monitor progress:**
```bash
lf datasets list
docker logs -f llamafarm-worker
```

### 4. Verify Setup

Check that databases are populated:

```bash
lf rag stats --database fda_letters_full
lf rag stats --database fda_corpus_chunked
```

Expected output:
```
Collection: fda_letters_full
Documents: 36
Embeddings: 36 chunks
```

---

## 📖 Usage

### Web UI (Recommended)

1. **Start the web interface:**
   ```bash
   npm run dev
   ```

2. **Open batch processing page:**
   ```
   http://localhost:3000/batch
   ```

3. **Configure batch:**
   - **Batch size:** 10-20 documents (recommended)
   - **Start index:** 0 (for first batch)

4. **Start processing:**
   - Click "Start Batch"
   - Monitor real-time progress in UI
   - Check terminal for detailed logs

5. **View results:**
   - Results saved to `fda_results/YYYY-MM-DD/batch_*.json`
   - Click "View" button to download JSON
   - See statistics: questions found, answered, unanswered

### Command Line

The web UI calls the Next.js API route. You can also use curl:

```bash
# Start batch processing
curl -X POST "http://localhost:3000/api/fda-batch?batchSize=20&startIndex=0"

# Check progress
curl "http://localhost:3000/api/fda-batch?action=progress"

# List previous results
curl "http://localhost:3000/api/fda-batch"
```

---

## ⚡ Performance

### Benchmarks

| Documents | Old (Serial) | New (Parallel) | Speedup |
|-----------|--------------|----------------|---------|
| 2 docs    | 5 min        | **1.5-2 min**  | 2.5-3x  |
| 10 docs   | 25 min       | **8-10 min**   | 2.5x    |
| 20 docs   | 50 min       | **15-20 min**  | 2.5-3x  |
| 100 docs  | 4.2 hrs      | **1.5 hrs**    | 2.8x    |

### Optimization Tips

**For fastest processing:**

1. **Increase batch size:**
   ```typescript
   // More parallelism within a batch
   batchSize: 50  // vs 20
   ```

2. **Use faster models** (lower accuracy):
   ```yaml
   # llamafarm.yaml
   models:
     - name: question_extractor
       model: gemma3:1b  # Faster than qwen3:1.7b
   ```

3. **Reduce validation strictness:**
   ```typescript
   // Pre-filter only, skip LLM validation
   // (Not recommended - quality will suffer)
   ```

4. **Process in batches overnight:**
   ```bash
   # Process 500 documents in 10 batches of 50
   # Total time: ~3-4 hours
   ```

---

## ⚙️ Configuration

### LlamaFarm Configuration (`llamafarm.yaml`)

**Key sections:**

#### Models

```yaml
runtime:
  default_model: question_extractor
  models:
    - name: question_extractor
      description: Fast model for extracting FDA questions
      provider: ollama
      model: qwen3:1.7b
      prompts:
        - fda_question_extractor

    - name: task_validator
      description: Validates if extracted text is a real FDA task
      provider: ollama
      model: qwen3:1.7b
      prompts:
        - fda_task_validator

    - name: answer_finder
      description: Finds answers to FDA questions
      provider: ollama
      model: qwen3:1.7b
      prompts:
        - fda_answer_finder
```

#### Prompts

**Question Extractor** – Requires context:
```yaml
prompts:
  - name: fda_question_extractor
    messages:
      - role: system
        content: |
          Find FDA requests and extract them WITH ENOUGH CONTEXT to be self-contained.

          CRITICAL: Include surrounding details so the request is SPECIFIC.
          - BAD: "Submit the data set" (WHICH data set?)
          - GOOD: "Submit the immunogenicity data set including all antibody test results"
```

**Task Validator** – Strict filtering:
```yaml
  - name: fda_task_validator
    messages:
      - role: system
        content: |
          You are validating if a text is a REAL, SPECIFIC FDA task.

          A REAL FDA task must:
          - Be SPECIFIC (not vague)
          - Include enough context
          - Be actionable on its own

          Answer with ONLY:
          <valid>yes</valid> or <valid>no</valid>
```

#### Databases

```yaml
rag:
  databases:
    - name: fda_letters_full
      type: ChromaStore
      config:
        collection_name: fda_letters_full
        distance_function: cosine
      embedding_strategies:
        - name: fda_embeddings
          type: OllamaEmbedder
          config:
            model: nomic-embed-text
            dimension: 768

    - name: fda_corpus_chunked
      type: ChromaStore
      # Same config, different collection
```

---

## 📊 Output Format

### JSON Structure

```json
{
  "timestamp": "2025-10-20T18:43:12.345Z",
  "project": "fda-records-agent-test",
  "namespace": "default",
  "batch_info": {
    "start_index": 0,
    "end_index": 2,
    "batch_size": 2,
    "total_documents": 3,
    "remaining": 1,
    "has_more": true
  },
  "documents": [
    {
      "document_hash": "81abd139a975...",
      "document_name": "761225_2024_Orig1s000OtherActionLtrs.pdf",
      "document_path": "~/.llamafarm/projects/.../lf_data/raw/81abd139...",
      "questions": [
        {
          "question_text": "Submit the immunogenicity data set including all antibody test results from the Phase 3 clinical trial",
          "type": "critical",
          "context": "761225_2024_Orig1s000OtherActionLtrs.pdf, Page 7",
          "page_reference": "Page 7",
          "confidence": 0.9,
          "document_name": "761225_2024_Orig1s000OtherActionLtrs.pdf",
          "document_path": "~/.llamafarm/projects/.../lf_data/raw/81abd139...",
          "answer": {
            "answered": true,
            "completeness": "complete",
            "confidence": 0.8,
            "summary": "Answer found: The sponsor confirmed submission of the immunogenicity dataset by Q2 2024 including all antibody test results...",
            "evidence": [
              {
                "text": "During the meeting, the sponsor confirmed that the immunogenicity data set will be submitted by Q2 2024...",
                "source": "761225_2024_Orig1s000OtherActionLtrs.pdf"
              }
            ]
          }
        }
      ],
      "stats": {
        "total_questions": 12,
        "critical_questions": 10,
        "administrative_questions": 2,
        "answered": 8,
        "unanswered": 4
      }
    }
  ],
  "summary": {
    "total_documents": 2,
    "total_questions": 24,
    "total_answered": 16,
    "total_unanswered": 8
  }
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `question_text` | Full text of FDA request (with context) |
| `type` | `"critical"` or `"administrative"` |
| `context` | Document name and page reference |
| `page_reference` | Page number where question found |
| `confidence` | 0-1 score (higher after validation) |
| `document_name` | Original PDF filename |
| `document_path` | Full filesystem path |
| `answer.answered` | `true` if answer found in corpus |
| `answer.completeness` | `"complete"`, `"partial"`, or `"none"` |
| `answer.summary` | Brief summary of answer or reason not found |
| `answer.evidence` | Array of text excerpts with sources |

---

## 🔧 Troubleshooting

### Common Issues

**Error: "No documents found in fda_letters dataset"**

**Solution:**
```bash
# Upload documents first
lf datasets upload fda_letters /path/to/files/*.pdf
lf datasets process fda_letters
```

---

**Error: "Duplicate GET function" (compile error)**

**Fixed in latest version.** If you see this:
```bash
git pull origin main
npm run dev
```

---

**Slow processing (5+ minutes for 2 documents)**

**Solutions:**
1. **Check parallelization** – Latest version uses `Promise.all()` for validation and answers
2. **Verify Ollama is running:**
   ```bash
   ollama list
   ollama ps  # Should show qwen3:1.7b loaded
   ```
3. **Check system resources:**
   ```bash
   docker stats  # RAM usage
   ```

---

**Too many false positives (garbage questions extracted)**

**Solutions:**
1. **Check prompt version** – Latest prompts require specific context
2. **Review validation prompt** – Should reject vague questions
3. **Check logs** – Terminal shows pre-filter rejections:
   ```
   ✗ Pre-filter (Header/boilerplate pattern): "Center for Drug Evaluation..."
   ✗ Pre-filter (Meta-instruction detected): "Review document and extract..."
   ```

---

**Questions too vague for RAG to find answers**

**Example:** "Submit the data set" (WHICH data set?)

**Fixed in latest prompts.** Update `llamafarm.yaml`:
```yaml
- name: fda_question_extractor
  content: |
    CRITICAL: Include surrounding details so the request is SPECIFIC.
    - BAD: "Submit the data set"
    - GOOD: "Submit the immunogenicity data set including all antibody test results"
```

---

## 💻 Development

### Project Structure

```
FDA-Records-Agent/
├── app/
│   ├── api/
│   │   ├── fda-batch/route.ts       # Main batch processing API ⭐
│   │   ├── datasets/
│   │   │   ├── upload/route.ts      # Dataset upload endpoint
│   │   │   ├── process/route.ts     # Dataset processing
│   │   │   └── clear/route.ts       # Clear databases
│   │   └── chat/route.ts            # Simple chat (legacy)
│   ├── batch/page.tsx                # Batch processing UI ⭐
│   └── page.tsx                      # Homepage
├── lib/
│   └── config.ts                     # LlamaFarm config loader
├── components/ui/                    # shadcn/ui components
├── docs/                             # Documentation files
│   ├── PROJECT_STATUS.md             # Current implementation status
│   ├── PROJECT_OVERVIEW.md           # Architecture overview
│   └── ...
├── llamafarm.yaml                    # LlamaFarm configuration ⭐
├── fda_results/                      # Output directory (gitignored)
├── data/                             # Sample documents (gitignored)
└── README.md                         # This file
```

⭐ = Core files for understanding the system

### Key Files

**`/app/api/fda-batch/route.ts`** – Main processing logic:
- `POST` – Start batch processing
- `GET` – List results or get progress (`?action=progress`)
- Functions:
  - `extractQuestionsFromChunk()` – LLM call to extract questions
  - `validateTask()` – LLM call to validate questions
  - `validateAnswer()` – LLM call to find answers
  - `quickRejectTask()` – Pre-filter heuristics
  - `stripThinkBlocks()` – Remove qwen3 `<think>` tags

**`/app/batch/page.tsx`** – Web UI:
- Batch configuration (size, start index)
- Real-time progress display
- Results table with download links

**`/lib/config.ts`** – Configuration loader:
- Reads `llamafarm.yaml` from app directory
- Provides `getLlamaFarmConfig()` and `getLlamaFarmBaseURL()`

### Running Tests

```bash
# Type checking
npm run type-check

# Lint
npm run lint

# Unit tests (if added)
npm test

# E2E tests (if added)
npm run test:e2e
```

### Environment Variables

Create `.env.local`:

```bash
# LlamaFarm API (default: http://localhost:8000)
NEXT_PUBLIC_LF_BASE_URL=http://localhost:8000

# Project configuration (should match llamafarm.yaml)
NEXT_PUBLIC_LF_NAMESPACE=default
NEXT_PUBLIC_LF_PROJECT=fda-records-agent-test
```

---

## 📚 Documentation

Additional documentation in `docs/`:

- **[PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** – Implementation status, setup verification, next steps
- **[PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)** – High-level architecture and design decisions
- **[FDA_BATCH_PROCESSING.md](docs/FDA_BATCH_PROCESSING.md)** – Detailed batch processing workflow
- **[IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md)** – Code implementation notes

---

## 🔗 Related Projects

This project is built on **[LlamaFarm](https://github.com/llama-farm/llamafarm)**, a local-first AI infrastructure framework.

**Learn more:**
- 📖 [LlamaFarm Documentation](https://docs.llamafarm.dev)
- 💬 [LlamaFarm Discord](https://discord.gg/llamafarm)
- 🐙 [LlamaFarm GitHub](https://github.com/llama-farm/llamafarm)

**Other LlamaFarm examples:**
- Medical Records Agent (multi-hop RAG)
- Government Document Analysis
- Legal Document Review

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgments

Built with:
- **[LlamaFarm](https://docs.llamafarm.dev)** – Local AI infrastructure
- **[Ollama](https://ollama.com)** – Local LLM runtime
- **[Next.js](https://nextjs.org)** – React framework
- **[ChromaDB](https://www.trychroma.com/)** – Vector database
- **[shadcn/ui](https://ui.shadcn.com)** – UI components

---

**Version:** 1.0.0
**Last Updated:** 2025-10-20
**Minimum Requirements:** Docker, Ollama, Node.js 18+, 8GB RAM, 10GB disk
