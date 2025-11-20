# VA Disability Helper

A privacy-first, locally-running AI assistant to help veterans understand VA disability claims, ratings, and benefits.

![VA Disability Helper](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Local-green)

## Overview

VA Disability Helper is a specialized AI assistant built on [LlamaFarm](https://llamafarm.ai) that helps veterans:

- **Understand VA disability ratings** - Learn how the VA rates different conditions and what percentages you may qualify for
- **Navigate the claims process** - Get guidance on initial claims, appeals, HLR, supplemental claims
- **Gather evidence** - Understand what evidence is needed for service connection
- **Interpret decision letters** - Make sense of VA decision letters and denial reasons
- **Calculate combined ratings** - Understand how VA math works for multiple disabilities
- **Learn about presumptive conditions** - Know which conditions don't require proving service connection

**100% Private & Local** - All AI processing happens on your machine. Your VA documents never leave your computer.

## Features

### Multi-Database RAG System

The assistant searches across three specialized knowledge bases:
1. **VA Regulations DB** - 38 CFR Part 4, M21-1 Manual, official VA regulations
2. **VA Knowledge DB** - General VA disability knowledge, common conditions, claims guidance
3. **VA Rating Schedules DB** - Diagnostic codes, rating criteria, percentage tables

### Specialized AI Models

- **VA General Assistant** - Comprehensive VA disability guidance
- **Claims Analyzer** - Specialized in analyzing denials and appeals
- **Rating Advisor** - Expert in diagnostic codes and percentage calculations
- **Evidence Specialist** - Focused on evidence requirements and nexus letters
- **Fast Query Model** - Generates focused search queries for better results

### Document Upload

Upload your VA documents (decision letters, medical records, C&P exams) for personalized assistance. Documents are parsed locally and never uploaded to any server.

## Prerequisites

Before installing this application, you need:

1. **LlamaFarm CLI** - Download and install from [https://llamafarm.ai](https://llamafarm.ai)
   - macOS: `brew install llamafarm` or download from the website
   - Windows: Download installer from the website
   - Linux: Follow installation instructions on the website
   - Verify installation: `lf --version`

2. **Node.js** - Version 18 or higher from [https://nodejs.org](https://nodejs.org)

3. **Ollama** (recommended) - For running local LLMs from [https://ollama.ai](https://ollama.ai)

## Installation

### 1. Clone or Download This Project

```bash
git clone <your-repo-url> VA-disability-helper
cd VA-disability-helper
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up LlamaFarm

Make sure LlamaFarm is running:

```bash
# Start LlamaFarm (if not already running)
lf start
```

The project's `llamafarm.yaml` will be automatically detected.

### 4. Pull Required Models

```bash
# Pull the required Ollama models
ollama pull qwen3:1.7b
ollama pull gemma3:1b
ollama pull qwen3:4b  # Optional - for complex reasoning

# Pull the embedding model
ollama pull nomic-embed-text
```

### 5. Add VA Documents (Optional but Recommended)

See the `data/README.md` for detailed instructions on adding VA regulations and knowledge documents.

Quick start:
```bash
# Create data directories
mkdir -p data/va_regulations data/va_knowledge data/va_rating_schedules

# Add your VA documents to the appropriate directories
# Then ingest them:

lf datasets add va_regulations -s va_document_processor -b va_regulations_db
lf datasets ingest va_regulations data/va_regulations/**/*.pdf
lf datasets process va_regulations
```

Repeat for `va_knowledge` and `va_rating_schedules`.

### 6. Start the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the VA Disability Helper.

## Usage

### Example Questions

- "What percentage can I get for PTSD with nightmares and panic attacks?"
- "How do I prove service connection without service treatment records?"
- "What is the difference between HLR and a supplemental claim?"
- "How is combined rating calculated for multiple disabilities?"
- "Do I need a nexus letter for presumptive conditions?"
- "What should I expect at my C&P exam for back pain?"
- "What is diagnostic code 5003 and what percentage can I get?"

### Uploading Documents

1. Click the upload area in the left sidebar
2. Select your VA documents (PDFs recommended)
3. Documents are parsed locally in your browser
4. Ask questions about your specific documents

### Chat Features

- **Citations** - See which VA regulations or documents informed each answer
- **Multi-turn conversations** - Follow-up questions maintain context
- **Session management** - Clear chat to start fresh

## Configuration

### Environment Variables

Create a `.env.local` file (optional):

```bash
NEXT_PUBLIC_LF_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LF_NAMESPACE=default
NEXT_PUBLIC_LF_PROJECT=va-disability-helper-project
NEXT_PUBLIC_LF_MODEL=va_advisor
NEXT_PUBLIC_LF_DATABASE=va_regulations_db
```

### Customizing Models

Edit `llamafarm.yaml` to change models or add new prompts:

```yaml
runtime:
  default_model: va_advisor
  models:
  - name: va_advisor
    provider: ollama
    model: qwen3:1.7b  # Change this to use a different model
```

## Project Structure

```
VA-disability-helper/
├── app/
│   ├── api/
│   │   └── agent-chat/
│   │       └── route.ts          # Main chat API with RAG
│   ├── layout.tsx                # App layout
│   └── page.tsx                  # Main chat interface
├── components/
│   ├── ui/                       # UI components (shadcn/ui)
│   ├── chat/                     # Chat-specific components
│   ├── Dropzone.tsx              # File upload component
│   └── HealthStatus.tsx          # LlamaFarm health check
├── lib/
│   ├── pdf.ts                    # PDF parsing utilities
│   ├── chunk.ts                  # Text chunking
│   ├── rank.ts                   # Excerpt ranking
│   ├── lf.ts                     # LlamaFarm API client
│   └── types.ts                  # TypeScript types
├── data/
│   ├── va_regulations/           # VA regulations PDFs
│   ├── va_knowledge/             # General VA knowledge
│   └── va_rating_schedules/      # Rating schedule documents
├── llamafarm.yaml                # LlamaFarm configuration
└── package.json
```

## How It Works

### RAG Pipeline

1. **Query Generation** - User's question is analyzed to generate focused search queries
2. **Parallel Search** - Queries are run against all three VA databases simultaneously
3. **Document Expansion** - Highly relevant documents are expanded to get more context
4. **Deduplication** - Results are deduplicated and ranked by relevance
5. **Synthesis** - A specialized VA model synthesizes the final answer with citations

### Multi-Model Approach

- **Fast Model** (`gemma3:1b`) - Quick query generation
- **VA Advisor** (`qwen3:1.7b`) - Main response synthesis
- **Specialized Models** - Claims analysis, rating calculations, evidence guidance
- **Reasoning Model** (`qwen3:4b`) - Complex scenarios requiring deeper analysis

## Privacy & Security

- **All processing is local** - No data sent to external APIs
- **Documents stay on your machine** - PDFs are parsed in your browser
- **No tracking or analytics** - Your VA information is completely private
- **Open source** - Inspect the code to verify privacy

## Limitations & Disclaimers

This tool provides **general guidance only** and is **not a substitute for legal advice**.

- Always verify information with official VA sources
- Consult with a VA-accredited attorney or VSO for legal advice
- VA regulations and policies change - ensure you have current information
- The AI may occasionally provide incorrect information - verify important details

## Troubleshooting

### LlamaFarm connection errors

```bash
# Check if LlamaFarm is running
lf health

# Restart LlamaFarm
lf restart
```

### Models not found

```bash
# Ensure models are pulled
ollama list

# Pull missing models
ollama pull qwen3:1.7b
ollama pull nomic-embed-text
```

### RAG not returning results

Check that you've processed your datasets:

```bash
lf datasets list
lf rag stats --database va_regulations_db
```

## Resources

- [VA.gov](https://www.va.gov/disability/) - Official VA disability information
- [eCFR Title 38](https://www.ecfr.gov/current/title-38) - VA regulations
- [LlamaFarm Documentation](https://llamafarm.ai/docs) - LlamaFarm setup and usage
- [VSO Locator](https://www.va.gov/vso/) - Find a Veterans Service Officer

## Contributing

Contributions are welcome! This project aims to help veterans navigate the complex VA disability system.

Ideas for contributions:
- Add more VA documents to the knowledge base
- Improve prompts for better accuracy
- Add new specialized models
- Create guides for specific conditions
- Enhance the UI/UX

## License

MIT License - See LICENSE file for details

## Acknowledgments

Built with:
- [LlamaFarm](https://llamafarm.ai) - Local AI infrastructure
- [Next.js](https://nextjs.org) - React framework
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Ollama](https://ollama.ai) - Local LLM runtime

---

**For Veterans, by Veterans**

This project is dedicated to helping veterans get the disability benefits they earned through their service.

*Not affiliated with or endorsed by the U.S. Department of Veterans Affairs*
