# Document Assistant 📄

A **100% local, privacy-first** document assistant that helps you understand your documents using AI and RAG (Retrieval-Augmented Generation). Built with Next.js and [LlamaFarm](https://docs.llamafarm.dev), all PDF processing happens entirely in your browser – your documents never leave your device.

## ✨ Key Features

- **🔒 Complete Privacy** – PDFs parsed client-side, no server uploads, data stays on your device
- **🤖 Multi-Hop Agentic RAG** – AI orchestrates query generation, knowledge retrieval, and synthesis
- **📚 Flexible Knowledge Base** – Support for text and PDF documents with semantic chunking
- **⚡ Efficient AI Architecture** – Fast model for queries, capable model for comprehensive responses
- **💬 Streaming Chat Interface** – Real-time responses with citations and sources
- **📄 Smart Document Analysis** – Semantic chunking with context awareness
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
  - [Add Your Documents](#4-add-your-documents)
  - [Create & Process Dataset](#5-create-and-process-dataset)
  - [Configure Frontend](#6-configure-frontend)
  - [Run Application](#7-run-application)
- [Architecture](#-architecture)
- [Usage Guide](#-usage-guide)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Privacy & Security](#-privacy--security)
- [License](#-license)

---

## 🚀 Quick Start

For experienced developers who want to get running quickly:

```bash
# 1. Install Docker
# macOS: https://docs.docker.com/desktop/install/mac-install/
brew install --cask docker
# OR download from: https://www.docker.com/products/docker-desktop

# Linux:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Windows: Download from https://www.docker.com/products/docker-desktop

# 2. Install Ollama
# Download from: https://ollama.com/download
# macOS:
brew install ollama
# Linux:
curl -fsSL https://ollama.com/install.sh | sh
# Windows: Download installer from https://ollama.com/download

# Configure Ollama context window (important!)
# Open Ollama → Settings → Advanced → Set context window to 32768+

# 3. Install LlamaFarm CLI
curl -fsSL https://raw.githubusercontent.com/llama-farm/llamafarm/main/install.sh | bash
# Windows: Download lf.exe from https://github.com/llama-farm/llamafarm/releases

# 4. Pull AI models (1.4GB total, 5-15 min)
ollama pull gemma3:1b
ollama pull qwen3:1.7b
ollama pull nomic-embed-text

# 5. Initialize LlamaFarm
cd "Plain App"
lf init
lf start  # May take a few minutes on first run (downloads Docker images)

# 6. (Optional) Add and process your documents
# Place your .txt or .pdf files in a ./data directory
lf datasets add documents -s document_processor -b document_db
lf datasets ingest documents ./data/*.txt ./data/*.pdf
lf datasets process documents

# 7. Configure & run frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔍 How It Works

This application combines **client-side PDF processing** with **server-side RAG** to provide intelligent document assistance:

1. **Upload Documents** – Drop PDFs in your browser (parsed locally using pdf.js)
2. **Local Processing** – Documents are chunked semantically in your browser
3. **Smart Retrieval** – Queries are sent to LlamaFarm's RAG system with:
   - Local document chunks (if uploaded)
   - Vector database content (if configured)
   - Multi-hop reasoning for complex queries
4. **AI Response** – Streaming responses with citations and sources
5. **Complete Privacy** – Your documents never leave your device unless you explicitly add them to the LlamaFarm database

---

## 📖 Detailed Setup

### 1. Prerequisites

- **Docker Desktop** – For running LlamaFarm services
- **Node.js 18+** – For the Next.js frontend
- **Ollama** – For running local AI models
- **LlamaFarm CLI** – For RAG orchestration

### 2. Install AI Models

Pull the required models (total ~1.4GB):

```bash
ollama pull gemma3:1b      # Fast query model
ollama pull qwen3:1.7b     # Capable reasoning model
ollama pull nomic-embed-text  # Embeddings model
```

**Important**: Configure Ollama's context window:
- Open Ollama settings
- Navigate to Advanced
- Set context window to at least 32768

### 3. Set Up LlamaFarm

Initialize LlamaFarm in the project directory:

```bash
cd "Plain App"
lf init
lf start
```

This starts:
- ChromaDB (vector database)
- LlamaFarm API server
- Background workers

### 4. Add Your Documents

You have two options for adding documents:

**Option A: Upload via Browser (Temporary)**
- Simply drag and drop PDFs into the web interface
- Documents are processed locally and not persisted
- Great for one-off queries

**Option B: Add to Knowledge Base (Persistent)**
```bash
# Create a data directory
mkdir -p data

# Add your documents (PDF or TXT)
cp /path/to/your/documents/*.pdf data/
cp /path/to/your/documents/*.txt data/
```

### 5. Create & Process Dataset

If you want persistent knowledge base:

```bash
# Create and ingest dataset
lf datasets add documents -s document_processor -b document_db
lf datasets ingest documents ./data/*.txt ./data/*.pdf

# Process documents (creates embeddings)
lf datasets process documents
```

### 6. Configure Frontend

```bash
cp .env.local.example .env.local
npm install
```

Edit `.env.local` if needed (defaults should work):
```env
NEXT_PUBLIC_LF_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LF_NAMESPACE=default
NEXT_PUBLIC_LF_PROJECT=plain-app-project
NEXT_PUBLIC_LF_MODEL=default
NEXT_PUBLIC_LF_DATABASE=document_db
```

### 7. Run Application

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Next.js App   │  ← Upload PDFs (client-side parsing)
│   (Browser)     │  ← Chat interface
└────────┬────────┘
         │
         │ HTTP API
         ▼
┌─────────────────┐
│  LlamaFarm API  │  ← RAG orchestration
│   (localhost)   │  ← Query generation
└────────┬────────┘  ← Response synthesis
         │
         ├─────────────┐
         ▼             ▼
┌──────────────┐  ┌─────────────┐
│   ChromaDB   │  │   Ollama    │
│   (Vectors)  │  │  (AI Models)│
└──────────────┘  └─────────────┘
```

### Components

- **Frontend (Next.js)**: PDF parsing, chat UI, local document management
- **LlamaFarm**: RAG orchestration, query generation, response synthesis
- **ChromaDB**: Vector storage for document embeddings
- **Ollama**: Local AI model inference

---

## 📚 Usage Guide

### Basic Workflow

1. **Upload Documents** (optional)
   - Drag and drop PDFs into the upload area
   - Documents are chunked and ready for querying

2. **Ask Questions**
   - Type your question in the chat
   - Toggle "Use local docs" to include uploaded PDFs

3. **Review Responses**
   - See streaming AI responses
   - Check citations and sources
   - Adjust RAG settings if needed

### Settings

- **RAG Top-K**: Number of context chunks to retrieve (default: 6)
- **Use Local Docs**: Toggle to include/exclude uploaded PDFs
- **Score Threshold**: Minimum relevance score for retrieval (0.7)

---

## 🛠️ Development

### Run Tests

```bash
npm test              # Unit tests
npm run test:e2e      # E2E tests (requires app running)
```

### Build for Production

```bash
npm run build
npm start
```

### Customize

- **Prompts**: Edit `llamafarm.yaml` → `prompts` section
- **Models**: Change model names in `llamafarm.yaml` → `runtime` section
- **Chunking**: Adjust in `llamafarm.yaml` → `data_processing_strategies`
- **UI**: Components in `components/` directory

---

## 🔧 Troubleshooting

### LlamaFarm won't start
```bash
lf stop
docker system prune -af
lf start
```

### Embeddings not working
- Verify `ollama pull nomic-embed-text` completed
- Check Ollama is running: `ollama list`
- Restart LlamaFarm: `lf restart`

### PDF parsing fails
- Ensure PDFs are not password-protected
- Check browser console for errors
- Try smaller PDFs first

### Slow responses
- Reduce RAG top-k in settings
- Use faster model (gemma3:1b)
- Check Docker resource allocation

---

## 🔒 Privacy & Security

- **Client-side PDF parsing**: Documents are never uploaded to servers
- **Local AI models**: All inference happens on your machine
- **Optional cloud**: No cloud services required
- **Data control**: You own and control all data

When using "local docs" mode, PDFs are:
1. Parsed in your browser
2. Chunked locally
3. Sent to LlamaFarm (localhost) only as context

Your documents are **never** sent to external servers.

---

## 📄 License

MIT License - see LICENSE file for details.

**Disclaimer**: This is a general-purpose AI assistant. Always verify important information from authoritative sources.
