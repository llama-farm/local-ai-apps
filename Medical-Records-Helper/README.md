# Personal Medical Assistant 🏥

A **100% local, privacy-first** medical assistant that helps you understand your medical records using AI and evidence-based medical knowledge. Built with Next.js and [LlamaFarm](https://docs.llamafarm.dev), all PDF processing happens entirely in your browser – your health data never leaves your device.

## ✨ Key Features

- **🔒 Complete Privacy** – PDFs parsed client-side, no server uploads, PHI stays on your device
- **🤖 Multi-Hop Agentic RAG** – AI orchestrates query generation, knowledge retrieval, and synthesis
- **📚 Medical Knowledge Base** – 125,830 chunks from 18 authoritative textbooks (MedRAG dataset)
- **⚡ Two-Tier AI Architecture** – Fast model for queries, capable model for comprehensive responses
- **💬 Streaming Chat Interface** – Real-time responses with collapsible agent reasoning
- **📄 Smart Document Analysis** – Semantic chunking with medical context awareness
- **⚙️ Configurable Retrieval** – Adjust RAG top-k, score thresholds, and local document usage
- **🎨 Modern UI** – Built with shadcn/ui, Tailwind CSS, and responsive design

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [How It Works](#-how-it-works)
- [Detailed Setup](#-detailed-setup)
  - [Prerequisites](#1-prerequisites)
  - [Install AI Models](#2-install-ai-models)
  - [Set Up LlamaFarm](#3-set-up-llamafarm)
  - [Download Medical Knowledge Base](#4-download-medical-knowledge-base)
  - [Create & Process Dataset](#5-create-and-process-dataset)
  - [Configure Frontend](#6-configure-frontend)
  - [Run Application](#7-run-application)
- [Medical Knowledge Base](#-medical-knowledge-base)
- [Architecture](#-architecture)
- [Usage Guide](#-usage-guide)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Privacy & Security](#-privacy--security)
- [License & Disclaimer](#-license--disclaimer)

---

## 🚀 Quick Start

For experienced developers who want to get running quickly:

```bash
# 1. Install prerequisites
brew install --cask docker ollama
curl -fsSL https://raw.githubusercontent.com/llama-farm/llamafarm/main/install.sh | bash

# 2. Pull AI models (1.4GB total)
ollama pull gemma3:1b
ollama pull qwen3:1.7B
ollama pull nomic-embed-text

# 3. Initialize LlamaFarm
cd medical-records-project
lf init
lf start

# 4. Process included medical textbooks (2-3 hours)
lf datasets add medical_textbooks -s medical_textbook_processor -b medical_db
lf datasets ingest medical_textbooks ./data/textbooks/*.txt
lf datasets process medical_textbooks

# 5. Configure & run frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 and start uploading medical PDFs!

---

## 🔍 How It Works

### Multi-Hop Agentic RAG Workflow

```
┌─────────────────────┐
│ User uploads PDF    │
│ (parsed in browser) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ User asks question  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ STEP 1: Query Generation                │
│ Model: gemma3:1b (fast)                 │
│ - Analyzes uploaded medical documents   │
│ - Generates 4-6 focused search queries  │
│ - Output: <rag_question> XML tags       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ STEP 2: Parallel RAG Retrieval          │
│ - Executes multiple queries in parallel │
│ - Searches medical_db (ChromaDB)        │
│ - Retrieves top-K excerpts per query    │
│ - Deduplicates & ranks results          │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ STEP 3: Comprehensive Synthesis         │
│ Model: qwen3:1.7B (capable)             │
│ Input context:                          │
│ - User's original question              │
│ - Uploaded PDF excerpts                 │
│ - Initial analysis from Step 1          │
│ - All RAG results from Step 2           │
│ Output: Comprehensive, cited response   │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│ Streamed to user    │
│ with citations      │
└─────────────────────┘
```

### Why Multi-Hop?

**Traditional RAG:** Send question → retrieve docs → generate answer

**Multi-Hop Agentic RAG:**
1. **Query Expansion:** Small, fast model analyzes complex medical documents and generates multiple focused queries
2. **Comprehensive Retrieval:** Multiple parallel searches cast a wider net across the knowledge base
3. **Context-Rich Synthesis:** Final model receives ALL information to produce the most complete response

**Result:** Better understanding of nuanced medical questions, especially when lab results have multiple abnormal values.

---

## 🛠 Detailed Setup

### 1. Prerequisites

#### Docker

Docker runs the LlamaFarm API server, ChromaDB vector database, and Celery workers.

**macOS:**
```bash
brew install --cask docker
# Or download from https://www.docker.com/products/docker-desktop
```

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

**Windows:**
Download from https://www.docker.com/products/docker-desktop

#### Ollama

Ollama provides local LLM inference. **Download from https://ollama.com/download**

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download installer from https://ollama.com/download

**⚙️ Configure Ollama Context Window:**
1. Open Ollama → Settings → Advanced
2. Set context window size to **32768 or higher** (recommended for medical documents)

#### LlamaFarm CLI

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/llama-farm/llamafarm/main/install.sh | bash
```

**Windows:**
Download `lf.exe` from [latest release](https://github.com/llama-farm/llamafarm/releases) and add to PATH.

**Verify installation:**
```bash
lf --version
```

#### Node.js 18+

**macOS:**
```bash
brew install node
```

**Linux/Windows:**
Download from https://nodejs.org/

---

### 2. Install AI Models

Pull the three models used by this application:

```bash
# Fast model for query generation (134MB)
ollama pull gemma3:1b

# Capable model for synthesis (1GB)
ollama pull qwen3:1.7B

# Embedding model for vector search (274MB)
ollama pull nomic-embed-text
```

**⏱ Note:** First-time pulls may take 5-15 minutes depending on your connection.

**Verify installation:**
```bash
ollama list
```

Expected output:
```
NAME                    ID              SIZE
gemma3:1b               ...             134 MB
qwen3:1.7B              ...             1.0 GB
nomic-embed-text        ...             274 MB
```

---

### 3. Set Up LlamaFarm

```bash
cd /path/to/medical-records-project

# Initialize project (uses existing llamafarm.yaml)
lf init

# Start services (FastAPI server, Celery workers, ChromaDB)
lf start
```

The `lf start` command will:
- Start FastAPI server on port 8000
- Launch Celery workers for RAG processing
- Start ChromaDB vector database in Docker
- Open interactive chat TUI (exit with Ctrl+C)

**Verify services:**
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","version":"..."}
```

**📚 Learn more:** https://docs.llamafarm.dev

---

### 4. Medical Knowledge Base (Included)

The **MedRAG medical textbooks dataset** is already included in `data/textbooks/` – 18 authoritative medical textbooks with 125,830 chunks across 93MB of medical knowledge.

**No download required!** The text files are ready to ingest.

**📖 Dataset details:** See [Medical Knowledge Base](#-medical-knowledge-base) section below.

---

### 5. Create and Process Dataset

**⚠️ IMPORTANT:** Processing the full medical knowledge base takes **2-3 hours** and is CPU/RAM intensive.

#### Create the dataset

```bash
lf datasets add medical_textbooks \
  -s medical_textbook_processor \
  -b medical_db
```

Flags explained:
- `-s medical_textbook_processor` – Processing strategy (defined in `llamafarm.yaml`)
- `-b medical_db` – Target vector database name

#### Ingest files

```bash
lf datasets ingest medical_textbooks ./data/textbooks/*.txt
```

This uploads all 18 included textbooks and queues them for processing.

**Verify files added:**
```bash
lf datasets list
```

#### Process the dataset

**⏱ This will take 2-3 hours:**

```bash
lf datasets process medical_textbooks
```

What happens:
1. Text chunked using semantic paragraph strategy (800 chars, 200 overlap)
2. Embeddings generated with `nomic-embed-text` (768 dimensions)
3. Vectors stored in ChromaDB
4. Parallel processing via Celery workers

**Monitor progress:**
```bash
# Check status
lf datasets list

# View worker logs
docker logs -f llamafarm-worker

# Check RAG database stats
lf rag stats --database medical_db
```

#### Optional: Test with subset first

To verify everything works before committing to 2-3 hours:

```bash
# Create test dataset
lf datasets add test_medical -s medical_textbook_processor -b test_db

# Ingest just one textbook
lf datasets ingest test_medical ./data/textbooks/Anatomy_Gray.txt

# Process (5-10 minutes)
lf datasets process test_medical
```

Then update `.env.local` to use `NEXT_PUBLIC_LF_DATABASE=test_db` for testing.

---

### 6. Configure Frontend

#### Create environment file

```bash
cp .env.local.example .env.local
```

#### Edit `.env.local`

```bash
# LlamaFarm API Configuration
NEXT_PUBLIC_LF_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LF_NAMESPACE=default
NEXT_PUBLIC_LF_PROJECT=medical-records-project

# Model Configuration (matches llamafarm.yaml)
NEXT_PUBLIC_LF_MODEL=default        # qwen3:1.7B for synthesis
NEXT_PUBLIC_LF_FAST_MODEL=fast      # gemma3:1b for query generation

# Database (must match Step 5)
NEXT_PUBLIC_LF_DATABASE=medical_db  # or test_db if using subset
```

#### Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

---

### 7. Run Application

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

#### Verify everything works

1. **Health status:** Green checkmark in top-right corner
2. **Upload PDF:** Drag and drop a medical document
3. **Ask question:** Try "Explain what this document shows"

The agent will:
1. Analyze your document with gemma3:1b
2. Generate focused search queries
3. Query medical knowledge base in parallel
4. Synthesize comprehensive response with qwen3:1.7B

---

## 📚 Medical Knowledge Base

### MedRAG Textbooks Dataset

**Source:** [MedRAG/textbooks](https://huggingface.co/datasets/MedRAG/textbooks) on HuggingFace
**Total Content:** 125,830 chunks across 18 textbooks (~93 MB)
**Format:** Pre-chunked paragraphs optimized for RAG retrieval

### Included Textbooks

| Textbook | Chunks | Size | Subject |
|----------|--------|------|---------|
| Harrison's Internal Medicine | 32,628 | 23 MB | Internal Medicine |
| Schwartz's Surgery | 14,349 | 14 MB | Surgery |
| Adams Neurology | 12,370 | 8.6 MB | Neurology |
| Williams Obstetrics | 9,166 | 6.7 MB | Obstetrics |
| Novak's Gynecology | 7,947 | 5.9 MB | Gynecology |
| Katzung's Pharmacology | 7,356 | 5.2 MB | Pharmacology |
| Alberts Cell Biology | 7,070 | 5.0 MB | Cell Biology |
| Robbins Pathology | 5,297 | 3.8 MB | Pathology |
| Janeway's Immunology | 4,852 | 3.5 MB | Immunology |
| Ross Histology | 4,411 | 3.1 MB | Histology |
| Levy Physiology | 4,370 | 3.1 MB | Physiology |
| Nelson Pediatrics | 4,260 | 3.0 MB | Pediatrics |
| DSM-5 Psychiatry | 4,057 | 3.0 MB | Psychiatry |
| Gray's Anatomy | 3,017 | 2.3 MB | Anatomy |
| Lippincott Biochemistry | 1,973 | 1.4 MB | Biochemistry |
| First Aid USMLE Step 2 | 1,369 | 1.1 MB | Medical Review |
| First Aid USMLE Step 1 | 850 | 724 KB | Medical Review |
| Pathoma | 505 | 455 KB | Pathology |

### LlamaFarm Configuration

**Data Processing Strategy:** `medical_textbook_processor`
- Chunk size: 800 characters
- Overlap: 200 characters
- Strategy: Paragraph-based (preserves semantic meaning)
- Extractors: Keywords (YAKE), Content Statistics

**Vector Database:** `medical_db`
- Type: ChromaDB
- Collection: `medical_textbooks`
- Embeddings: `nomic-embed-text` (768 dims)
- Retrieval: Cosine similarity, configurable top-k

**Learn more:** [MedRAG Paper](https://teddy-xionggz.github.io/benchmark-medical-rag/)

---

## 🏗 Architecture

### Two-Tier Model Strategy

| Model | Purpose | Size | Speed | Temperature | Max Tokens | Use Case |
|-------|---------|------|-------|-------------|------------|----------|
| **gemma3:1b** | Query generation | 134MB | Fast | 0.3 | 300 | Structured outputs, XML tags |
| **qwen3:1.7B** | Synthesis | 1GB | Medium | 0.5 | 2000 | Comprehensive responses |
| **nomic-embed-text** | Embeddings | 274MB | Fast | N/A | N/A | Vector similarity search |

### Project Structure

```
medical-records-project/
├── app/
│   ├── page.tsx                    # Main chat interface
│   ├── layout.tsx                  # Root layout with theme
│   └── api/
│       ├── agent-chat/route.ts     # Multi-hop RAG orchestration ⭐
│       └── chat/route.ts           # Simple chat endpoint
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── chat/
│   │   ├── MessageBubble.tsx       # Message with collapsible thoughts ⭐
│   │   ├── MessageList.tsx         # Scrollable message history
│   │   └── Composer.tsx            # Input with keyboard shortcuts
│   ├── Dropzone.tsx                # Multi-file PDF upload ⭐
│   ├── SettingsDrawer.tsx          # RAG configuration
│   └── HealthStatus.tsx            # LlamaFarm connection status
├── lib/
│   ├── pdf.ts                      # Client-side PDF parsing (PDF.js) ⭐
│   ├── chunk.ts                    # Smart text chunking
│   ├── rank.ts                     # Local similarity scoring
│   ├── sse.ts                      # SSE stream parser ⭐
│   ├── lf.ts                       # LlamaFarm client
│   ├── types.ts                    # TypeScript definitions
│   └── utils.ts                    # Utilities (cn, uid)
├── scripts/
│   └── convert-medrag-to-txt.js    # Dataset conversion utility
├── llamafarm.yaml                  # LlamaFarm configuration ⭐
├── .env.local                      # Environment variables
└── README.md                       # This file
```

⭐ = Core files for understanding the system

### Key Implementation Details

#### `/app/api/agent-chat/route.ts`

Multi-hop RAG orchestration with two LLM calls:

```typescript
// STEP 1: Query generation (fast model)
const queryGenMessages = [{
  role: "user",
  content: `${QUERY_GENERATION_PROMPT}\n\n---\n\nQuestion: ${prompt}${contextBlock}`
}];

const queryGenResponse = await fetch(chatUrl, {
  method: "POST",
  body: JSON.stringify({
    model: LF_FAST_MODEL,      // gemma3:1b
    messages: queryGenMessages,
    temperature: 0.3,
    max_tokens: 300,
    rag_enabled: false,
  }),
});

// Parse <rag_question> XML tags
const ragQuestionRegex = /<rag_question>(.*?)<\/rag_question>/gs;
const queries = [...generatedQueriesText.matchAll(ragQuestionRegex)]
  .map(match => match[1].trim());

// STEP 2: Parallel RAG retrieval
const ragPromises = queries.map(query =>
  fetch(ragUrl, {
    method: "POST",
    body: JSON.stringify({
      query,
      database: LF_DATABASE,
      top_k: topK,
      score_threshold: scoreThreshold,
    }),
  })
);
const ragResponses = await Promise.all(ragPromises);

// STEP 3: Synthesis (capable model)
const synthesisResponse = await fetch(chatUrl, {
  method: "POST",
  body: JSON.stringify({
    model: LF_MODEL,              // qwen3:1.7B
    messages: [{
      role: "user",
      content: `${SYNTHESIS_PROMPT}\n\nUSER'S QUESTION: ${prompt}\n${userDocsContext}\n${initialAnalysisContext}\n${ragContext}`
    }],
    temperature: 0.5,
    max_tokens: 2000,
    stream: true,
    rag_enabled: false,           // RAG already done manually
  }),
});
```

#### `/lib/sse.ts`

Dual-format SSE parser supporting both OpenAI and custom agent format:

```typescript
const json = JSON.parse(data);

// Support both formats
const token = json.token ?? json.choices?.[0]?.delta?.content ?? "";
const citations = json.citations ?? json.choices?.[0]?.delta?.citations;
const done = json.done;

yield { token, citations, done };
```

#### `/components/chat/MessageBubble.tsx`

Collapsible thought processes with smart labeling:

```tsx
const { thoughts, mainContent, hasOpenThink } = parseContent(message.content);

{thoughts.map((thought, idx) => {
  const isThinking = idx === thoughts.length - 1 && hasOpenThink;
  return (
    <CollapsibleThought>
      {isThinking ? "Processing..." : idx === 0 ? "Agent steps" : "Analysis"}
      <ThoughtContent>{thought}</ThoughtContent>
    </CollapsibleThought>
  );
})}
```

#### `/lib/pdf.ts`

Client-side PDF parsing using CDN-hosted worker:

```typescript
import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export async function parsePdfToText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    pages.push(textContent.items.map(item => item.str).join(" "));
  }

  return { text: pages.join("\n\n"), pages: pdf.numPages };
}
```

---

## 📖 Usage Guide

### 1. Upload Medical Documents

**Drag and drop:**
- Drag one or more PDF files into the upload zone
- Files are parsed entirely in your browser (no server upload)
- See file details: pages, character count, chunks generated

**Click to browse:**
- Click the upload zone to open file picker
- Select multiple PDFs at once
- Each PDF is processed independently

**Remove files:**
- Click the X icon next to any uploaded file
- Data is immediately cleared from memory

### 2. Configure RAG Settings

**RAG Top-K (Settings drawer):**
- Controls how many excerpts to retrieve from medical knowledge base
- Default: 6 results
- Range: 3-12 results
- Higher = more comprehensive but slower

**Toggle Local Documents:**
- Click badge: "Using local docs" / "Not using local docs"
- **Enabled:** Combines your uploaded PDFs with RAG knowledge base
- **Disabled:** Only uses RAG knowledge base (ignores uploaded PDFs)

### 3. Ask Questions

**Example questions:**

For uploaded lab results:
- "Explain what this document shows"
- "What abnormal values are present and what do they mean?"
- "Should I be concerned about these results?"

For general medical questions:
- "What causes high LDL cholesterol?"
- "Explain vitamin D insufficiency treatment"
- "What is the relationship between glucose and diabetes?"

**Keyboard shortcuts:**
- `⌘/Ctrl + Enter` to send message
- Click Send button as alternative

### 4. Understanding Responses

**Collapsible sections:**

**"Agent steps"** (first thought block):
- Query generation process
- Search queries being executed
- RAG retrieval status

**"Analysis"** (second thought block):
- LLM reasoning about the question
- Context synthesis
- Decision-making process

**Main response:**
- Comprehensive answer with medical context
- Markdown formatting (bold, lists, headings)
- Citations from medical textbooks

**Citations:**
- Hidden by default (integrated into response)
- Source attribution in response text

### 5. Privacy Guarantees

**What stays local:**
- ✅ Your original PDF files
- ✅ All extracted text from PDFs
- ✅ Document metadata (pages, size, etc.)

**What gets sent to LlamaFarm (localhost only):**
- ✅ Short text excerpts from your PDFs (typically 6 chunks of 800 chars)
- ✅ Your questions
- ✅ AI-generated queries

**What NEVER leaves your device:**
- ❌ Complete PDF files
- ❌ PHI/PII identifiers
- ❌ Full document contents

---

## 💻 Development

### Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

**Hot reload enabled** – changes to React components auto-refresh.

### Build for Production

```bash
npm run build
npm run start
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Testing

```bash
# Unit tests
npm test

# E2E tests (if configured)
npm run test:e2e

# Specific test file
npm test -- pdf.test.ts
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_LF_BASE_URL` | `http://localhost:8000` | LlamaFarm API URL |
| `NEXT_PUBLIC_LF_NAMESPACE` | `default` | LlamaFarm namespace |
| `NEXT_PUBLIC_LF_PROJECT` | `medical-records-project` | Project ID |
| `NEXT_PUBLIC_LF_MODEL` | `default` | Synthesis model (qwen3:1.7B) |
| `NEXT_PUBLIC_LF_FAST_MODEL` | `fast` | Query gen model (gemma3:1b) |
| `NEXT_PUBLIC_LF_DATABASE` | `medical_db` | Vector database name |

### Extending the Application

#### Add a new LLM provider

1. Update `llamafarm.yaml`:
```yaml
runtime:
  models:
  - name: openai-gpt4
    provider: openai
    model: gpt-4
    api_key: ${OPENAI_API_KEY}
```

2. Update `.env.local`:
```bash
NEXT_PUBLIC_LF_MODEL=openai-gpt4
```

3. Restart LlamaFarm: `lf start`

#### Customize prompts

Edit `/app/api/agent-chat/route.ts`:

```typescript
const QUERY_GENERATION_PROMPT = `Your custom query generation instructions...`;
const SYNTHESIS_PROMPT = `Your custom synthesis instructions...`;
```

#### Add new data sources

1. Create new dataset:
```bash
lf datasets add my_dataset -s medical_textbook_processor -b my_db
```

2. Ingest files:
```bash
lf datasets ingest my_dataset ./my-files/*.txt
lf datasets process my_dataset
```

3. Update `.env.local`:
```bash
NEXT_PUBLIC_LF_DATABASE=my_db
```

---

## 🔧 Troubleshooting

### LlamaFarm Issues

**Error: "Cannot connect to LlamaFarm"**

**Check if Ollama is running:**
```bash
ollama list
# If empty or error, start Ollama:
ollama serve
```

**Check LlamaFarm status:**
```bash
lf start
curl http://localhost:8000/health
```

**View logs:**
```bash
docker logs -f llamafarm-server
docker logs -f llamafarm-worker
```

**Error: "Database 'medical_db' not found"**

**Verify dataset exists:**
```bash
lf datasets list
lf rag stats --database medical_db
```

**If missing, recreate:**
```bash
lf datasets add medical_textbooks -s medical_textbook_processor -b medical_db
lf datasets ingest medical_textbooks ./data/textbooks/*.txt
lf datasets process medical_textbooks
```

**Error: "Model 'qwen3:1.7B' not found"**

**Pull missing model:**
```bash
ollama pull qwen3:1.7B
```

**Verify in llamafarm.yaml:**
```yaml
runtime:
  models:
  - name: default
    model: qwen3:1.7B  # Must match Ollama model name exactly
```

### Frontend Issues

**Error: "PDF.js worker not found"**

**Verify CDN worker configuration:**
```typescript
// lib/pdf.ts should have:
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
```

**Clear browser cache:**
- Chrome: Cmd/Ctrl + Shift + Delete
- Uncheck everything except "Cached images and files"

**Error: "Cannot read property 'getPage' of undefined"**

**File is corrupted or password-protected:**
- Try different PDF
- Ensure PDF is text-based (not scanned image)

**No response streaming / blank chat**

**Check browser console:**
- Open DevTools (F12)
- Look for SSE parsing errors
- Verify `/api/agent-chat` endpoint is being hit

**Check network tab:**
- Should see `agent-chat` request with "EventStream" type
- Expand to see `data:` events

**Verify LlamaFarm connection:**
```bash
curl http://localhost:8000/health
```

### Processing Issues

**Dataset processing stuck at 0%**

**Check Celery worker logs:**
```bash
docker logs -f llamafarm-worker
```

**Common causes:**
- Worker crashed (restart: `docker restart llamafarm-worker`)
- Out of memory (reduce chunk size in `llamafarm.yaml`)
- Ollama not running (start: `ollama serve`)

**Restart worker:**
```bash
docker restart llamafarm-worker
lf datasets process medical_textbooks
```

**Out of memory during processing**

**Reduce chunk size:**

Edit `llamafarm.yaml`:
```yaml
rag:
  data_processing_strategies:
  - name: medical_textbook_processor
    chunking:
      max_chunk_size: 600  # Reduced from 800
      chunk_overlap: 150   # Reduced from 200
```

**Increase Docker memory:**
- Docker Desktop → Settings → Resources
- Set to at least 4GB RAM

**Process in batches:**
```bash
# Process one textbook at a time
lf datasets ingest medical_textbooks ./data/textbooks/Anatomy_Gray.txt
lf datasets process medical_textbooks
# Wait for completion, then add next file
```

### Performance Issues

**Slow RAG retrieval**

**Reduce top-k:**
- Settings drawer → RAG Top-K → Set to 3-4

**Increase score threshold:**
```typescript
// app/api/agent-chat/route.ts
score_threshold: 0.8  // Higher = fewer but better results
```

**Slow response generation**

**Use smaller model:**

Edit `llamafarm.yaml`:
```yaml
runtime:
  models:
  - name: default
    model: gemma3:1b  # Smaller, faster
```

Or use existing fast model:
```bash
# .env.local
NEXT_PUBLIC_LF_MODEL=fast
```

---

## 🔒 Privacy & Security

### Data Processing

**Client-Side (Browser):**
- PDF parsing via PDF.js WebAssembly
- Text chunking and semantic analysis
- Local similarity ranking
- All processing happens in JavaScript runtime

**Server-Side (Localhost Only):**
- LlamaFarm API on port 8000 (not exposed to internet)
- ChromaDB vector database (Docker container)
- Ollama LLM inference (local process)

**Network Transfer:**
- Only short text excerpts sent to localhost:8000
- Typical payload: 4-6 chunks × 800 chars = ~5KB
- All communication over HTTP localhost (no external calls)

### What Data is Stored

**In Browser Memory (cleared on refresh):**
- Parsed PDF text
- Generated chunks
- Chat message history

**In ChromaDB (persistent):**
- Medical textbook embeddings only
- No user documents or queries

**In LlamaFarm Logs (temporary):**
- API request/response logs (not persisted by default)
- Can be disabled in Docker logs configuration

### Security Best Practices

**✅ DO:**
- Use on trusted local network
- Keep Docker/Ollama/LlamaFarm updated
- Review uploaded PDFs before sharing screenshots
- Clear browser data after sensitive sessions

**❌ DON'T:**
- Expose LlamaFarm port 8000 to internet
- Share Docker logs containing queries
- Use on public/shared computers without clearing data
- Screenshot responses containing PHI and share publicly

### HIPAA Compliance Notes

This application is designed for **personal, educational use only**. It is **NOT HIPAA-compliant** out of the box.

For healthcare provider use:
- Deploy in isolated network environment
- Implement audit logging
- Add authentication/authorization
- Encrypt data at rest and in transit
- Consult legal/compliance team

---

## 📄 License & Disclaimer

### License

MIT License - see LICENSE file for details.

### Medical Disclaimer

**⚠️ IMPORTANT – READ CAREFULLY:**

This application is provided **for educational and informational purposes only**. It is **NOT** intended to be a substitute for professional medical advice, diagnosis, or treatment.

**You should ALWAYS:**
- ✅ Consult with a qualified healthcare provider before making medical decisions
- ✅ Seek immediate medical attention for emergencies
- ✅ Verify AI-generated information with licensed professionals
- ✅ Discuss any lab results or findings with your physician

**The AI models may:**
- ❌ Produce inaccurate or incomplete information
- ❌ Misinterpret medical terminology or context
- ❌ Provide outdated information (knowledge cutoff varies by model)
- ❌ Miss critical details in complex cases

**Never use this tool to:**
- ❌ Self-diagnose medical conditions
- ❌ Replace visits to healthcare professionals
- ❌ Make treatment decisions without medical supervision
- ❌ Delay seeking professional medical care

By using this application, you acknowledge that:
1. This is an experimental educational tool
2. No medical advice is being provided
3. You will consult healthcare professionals for actual medical decisions
4. The developers assume no liability for medical outcomes

**If you are experiencing a medical emergency, call 911 or your local emergency number immediately.**

---

## 🙏 Acknowledgments

Built with these amazing open-source projects:

- **[LlamaFarm](https://docs.llamafarm.dev)** – Local-first AI infrastructure
- **[Ollama](https://ollama.com)** – Run LLMs locally
- **[Next.js](https://nextjs.org)** – React framework
- **[shadcn/ui](https://ui.shadcn.com)** – UI components
- **[PDF.js](https://mozilla.github.io/pdf.js/)** – PDF parsing in browser
- **[Tailwind CSS](https://tailwindcss.com)** – Utility-first CSS
- **[MedRAG](https://teddy-xionggz.github.io/benchmark-medical-rag/)** – Medical textbook dataset
- **[ChromaDB](https://www.trychroma.com/)** – Vector database
- **[Celery](https://docs.celeryproject.org/)** – Distributed task queue

Special thanks to the open-source AI/ML community for making local-first AI possible.

---

## 📞 Support & Contributing

### Getting Help

- **Documentation:** https://docs.llamafarm.dev
- **Issues:** Report bugs or request features via GitHub Issues
- **Discussions:** Share use cases and ask questions in GitHub Discussions

### Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with clear commit messages
4. Add tests for new functionality
5. Update documentation as needed
6. Submit a pull request

### Roadmap

**Planned features:**
- [ ] Multi-language support
- [ ] Voice input for questions
- [ ] Export chat history to PDF
- [ ] Custom medical knowledge base uploads
- [ ] Integration with Apple Health / Google Fit
- [ ] Mobile app (React Native)

**Research directions:**
- Improve query generation for complex multi-finding documents
- Experiment with larger synthesis models (8B+)
- Fine-tuned medical domain models
- Multi-modal support (medical images, charts)

---

**Version:** 1.0.0
**Last Updated:** 2025-01-17
**Minimum Requirements:** Node.js 18+, Docker 20+, 8GB RAM, 10GB disk space
