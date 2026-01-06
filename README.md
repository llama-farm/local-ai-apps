# Local AI Apps

A curated collection of **100% local-first** applications powered by [LlamaFarm](https://docs.llamafarm.dev). These apps prioritize privacy, run entirely on your machine, and demonstrate practical use cases for local AI.

## Prerequisites

All applications in this repository require:

### 1. LlamaFarm

Download the desktop app for your platform:

| Platform | Download |
|----------|----------|
| Mac (M1+) | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-mac-arm64.dmg) |
| Mac (Intel) | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-mac-x64.dmg) |
| Windows | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-win-x64.exe) |
| Linux (x86_64) | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-linux-x64.AppImage) |
| Linux (ARM64) | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-linux-arm64.AppImage) |

Or install via CLI:
```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/llama-farm/llamafarm/main/install.sh | bash

# Windows
winget install LlamaFarm.CLI
```

### 2. Ollama (recommended)

For running local LLMs: [https://ollama.ai](https://ollama.ai)

### 3. Node.js

Version 18 or higher: [https://nodejs.org](https://nodejs.org)

## Applications

### 🏥 [Medical Records Helper](./Medical-Records-Helper)

A privacy-first medical assistant that helps you understand your medical records using AI and evidence-based medical knowledge.

**Key Features:**
- 🔒 **Complete Privacy** – PDFs parsed client-side, no data leaves your device
- 🤖 **Multi-Hop Agentic RAG** – AI orchestrates query generation, knowledge retrieval, and synthesis
- 📚 **Medical Knowledge Base** – 125,830 chunks from 18 authoritative textbooks (MedRAG dataset)
- ⚡ **Two-Tier AI Architecture** – Fast model for queries, capable model for comprehensive responses
- 💬 **Streaming Chat Interface** – Real-time responses with collapsible agent reasoning

**Tech Stack:** Next.js, LlamaFarm, Ollama, ChromaDB, shadcn/ui

**[View Documentation →](./Medical-Records-Helper/README.md)**

---

### 📋 [FDA Records Agent](./FDA-Records-Agent)

A privacy-first AI agent for analyzing FDA documents, warning letters, and regulatory filings using advanced RAG and medical knowledge.

**Key Features:**
- 🔒 **Complete Privacy** – PDFs parsed client-side, documents never leave your device
- 🤖 **Multi-Hop Agentic RAG** – AI orchestrates query generation, knowledge retrieval, and synthesis
- 📚 **Medical Knowledge Base** – 125,830 chunks from 18 authoritative textbooks
- ⚡ **Two-Tier AI Architecture** – Fast model for queries, capable model for analysis
- 💬 **Streaming Chat Interface** – Real-time regulatory analysis with citations

**Tech Stack:** Next.js, LlamaFarm, Ollama, ChromaDB, shadcn/ui

**[View Documentation →](./FDA-Records-Agent/README.md)**

---

### 🛡️ [VA Disability Helper](./VA-disability-helper)

A privacy-first AI assistant helping veterans understand VA disability claims, ratings, and benefits. Specialized for navigating the complex VA disability system.

**Key Features:**
- 🔒 **Complete Privacy** – All processing runs locally, your VA documents stay on your machine
- 🤖 **Multi-Database RAG** – Search across VA regulations, knowledge base, and rating schedules
- ⚖️ **Specialized AI Models** – Dedicated models for claims, ratings, evidence, and appeals
- 📊 **Combined Ratings Calculator** – Understand VA math and disability percentages
- 💬 **Document Analysis** – Upload decision letters, medical records, C&P exams for personalized guidance
- 🎯 **Expert Guidance** – Service connection, nexus letters, DBQs, presumptive conditions

**Tech Stack:** Next.js, LlamaFarm, Ollama, ChromaDB, shadcn/ui

**[View Documentation →](./VA-disability-helper/README.md)**

---

### 🏥 [Insurance Helper](./Insurance-helper)

A privacy-first AI assistant for understanding health insurance policies, medical bills, EOBs, and claim denials.

**Key Features:**
- 🔒 **Complete Privacy** – PDFs parsed client-side, insurance documents stay private
- 🤖 **Multi-Database RAG** – Search across policies, knowledge base, and member handbooks
- 💰 **Claims Analysis** – Understand denials, EOBs, and appeal strategies
- 📋 **Billing Breakdown** – Decode medical bills and identify errors
- 💬 **Document Upload** – Get personalized help with your specific insurance documents
- 🎯 **Expert Guidance** – Deductibles, coinsurance, prior auth, in-network vs out-of-network

**Tech Stack:** Next.js, LlamaFarm, Ollama, ChromaDB, shadcn/ui

**[View Documentation →](./Insurance-helper/README.md)**

---

### 👵 [Elder Care Demo](./Elder-Care-Demo)

**Stop Using LLMs for Everything** – A demonstration of using specialized ML models alongside LLM agents for elder care monitoring. Shows how fast, local ML models handle routine processing while an LLM agent coordinates high-level decision making.

**Key Features:**
- ⚡ **100x Faster** – One-Class SVM anomaly detection in ~10ms vs 1-2s for LLM
- 🎯 **SetFit Classification** – Voice transcript urgency classification (routine/concern/emergency/positive)
- 🤖 **LLM Agent with Tools** – qwen3:8b coordinates decisions and takes actions
- 📡 **Live Streaming Demo** – Watch "Margaret's Concerning Afternoon" unfold in real-time via SSE
- 🔒 **100% Local** – Sensitive health data never leaves your network
- ✅ **208 Tests** – Comprehensive test suite included

**Tech Stack:** FastAPI, React, LlamaFarm Universal Runtime, SetFit, One-Class SVM, Tailwind

**[View Documentation →](./Elder-Care-Demo/README.md)**

---

## About LlamaFarm

[LlamaFarm](https://docs.llamafarm.dev) is a local-first AI infrastructure framework that makes it easy to build privacy-preserving AI applications. It provides:

- 🔌 OpenAI-compatible API
- 🗄️ Built-in RAG (Retrieval-Augmented Generation)
- 🚀 Easy model management
- 🐳 Docker-based deployment
- 📊 Vector databases (ChromaDB, Qdrant, etc.)

## Contributing

We welcome contributions! To add a new local AI app:

1. Fork this repository
2. Create a new directory for your app
3. Include a comprehensive README with setup instructions
4. Ensure the app is 100% local-first (no external API dependencies for core functionality)
5. Add your app to this README
6. Submit a pull request

### Guidelines for New Apps

- ✅ Must run 100% locally
- ✅ Must use LlamaFarm for AI capabilities
- ✅ Must include complete setup documentation
- ✅ Must respect user privacy (no telemetry without explicit consent)
- ✅ Must be production-ready or clearly labeled as experimental

## License

Each application may have its own license. Please check the individual app directories for details.

## Community

- **Documentation:** https://docs.llamafarm.dev
- **Issues:** Report bugs or request features via GitHub Issues
- **Discussions:** Share ideas and ask questions in GitHub Discussions

---

**Built with ❤️ by the LlamaFarm community**
