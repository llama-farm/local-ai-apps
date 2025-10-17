# Local AI Apps

A curated collection of **100% local-first** applications powered by [LlamaFarm](https://docs.llamafarm.dev). These apps prioritize privacy, run entirely on your machine, and demonstrate practical use cases for local AI.

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
