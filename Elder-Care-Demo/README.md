# Elder Care Monitoring Demo

<img src="ui/public/elder-care.svg" alt="Elder Care" width="80" align="right">

**Stop Using LLMs for Everything: A Guide to Private, Local AI**

A demonstration of using specialized ML models alongside LLM agents for elder care monitoring. This demo shows how fast, local ML models (One-Class SVM for anomaly detection, SetFit for text classification) can handle routine processing while an LLM agent coordinates high-level decision making.

## Why This Matters

| Approach | Latency | Privacy | Cost |
|----------|---------|---------|------|
| Cloud LLM for everything | 1-3 seconds | Data leaves your network | $$$ per token |
| **Local specialized ML** | **~10ms** | **Data stays local** | **Free after setup** |

This demo proves you can build production-quality AI applications that:
- Process sensitive health data **100% locally**
- Respond in **milliseconds** instead of seconds
- Use LLMs only where they add value (coordination, reasoning)

---

## Prerequisites

### Required
- **Python 3.10+** (3.12 recommended)
- **Node.js 20+** and npm
- **[uv](https://docs.astral.sh/uv/)** - Fast Python package manager
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

### Required for Full Functionality
- **[LlamaFarm](https://github.com/llama-farm/llamafarm)** - Local AI framework
- **[Docker](https://www.docker.com/products/docker-desktop/)** - For LlamaFarm services
- **[Ollama](https://ollama.ai/)** - Local LLM runtime

---

## Installing LlamaFarm

LlamaFarm provides the ML runtime (anomaly detection, classification) and LLM services.

### Option 1: CLI Installation (Recommended)

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/llama-farm/llamafarm/main/install.sh | bash
```

**Windows:**
```bash
winget install LlamaFarm.CLI
```

**Verify installation:**
```bash
lf --help
```

### Option 2: Desktop App

| Platform | Download |
|----------|----------|
| Mac (M1+) | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-mac-arm64.dmg) |
| Mac (Intel) | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-mac-x64.dmg) |
| Windows | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-win-x64.exe) |
| Linux (x86_64) | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-linux-x64.AppImage) |
| Linux (ARM64) | [Download](https://github.com/llama-farm/llamafarm/releases/latest/download/LlamaFarm-linux-arm64.AppImage) |

### Initialize LlamaFarm Project

```bash
# From the elder-care-demo directory
lf init .

# Or create a new project
lf init elder-care-demo
cd elder-care-demo
```

### Start LlamaFarm Services

```bash
lf start
```

This launches:
- **Server** at `http://localhost:8000` - API & Designer UI
- **Universal Runtime** at `http://localhost:11540` - ML inference
- **RAG Worker** - Document processing (optional)

For more details, see [LlamaFarm Documentation](https://docs.llamafarm.dev/docs/intro).

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/llama-farm/local-ai-apps.git
cd local-ai-apps/elder-care-demo

# Install Python dependencies
uv sync

# Install frontend dependencies
cd ui && npm install && cd ..

# Generate training data
uv run python -m src.data.training_data_generator
```

### 2. Start LlamaFarm (in a separate terminal)

```bash
lf start
```

### 3. Start the Demo

```bash
# Start both backend and frontend
./scripts/start-demo.sh

# Or start separately:
# Terminal 1 - Backend
uv run uvicorn src.app:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2 - Frontend
cd ui && npm run dev
```

### 4. Open the App

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | React UI with demo tabs |
| **Backend API** | http://localhost:8080 | FastAPI server |
| **API Docs** | http://localhost:8080/docs | Swagger/OpenAPI |
| **LlamaFarm** | http://localhost:8000 | Designer UI |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  ┌───────────┬───────────┬───────────┬───────────┐          │
│  │  Anomaly  │ Classifier│ LLM Agent │ Live Demo │          │
│  │    Tab    │    Tab    │    Tab    │    Tab    │          │
│  └───────────┴───────────┴───────────┴───────────┘          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                         │
│  ┌───────────┬───────────┬───────────┬───────────┐          │
│  │ /anomaly  │/classifier│  /agent   │/streaming │          │
│  └───────────┴───────────┴───────────┴───────────┘          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    LlamaFarm Services                        │
│  ┌───────────────────────┬───────────────────────┐          │
│  │   Universal Runtime   │      LLM Server       │          │
│  │  (Anomaly/Classify)   │  (qwen3:8b + Tools)   │          │
│  │     Port 11540        │      Port 8000        │          │
│  └───────────────────────┴───────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

---

## Features

### Tab 1: Anomaly Detection
- **One-Class SVM** trained on normal biometric readings
- Detects unusual heart rate, blood pressure, temperature
- **~10ms inference** vs ~1-2 seconds for LLM
- Model persistence: train once, load instantly

### Tab 2: Text Classification
- **SetFit** model for classifying voice transcripts
- Categories: `routine`, `concern`, `emergency`, `positive`
- Trained on 100 labeled examples
- View training data with label filtering

### Tab 3: LLM Agent with Tools
- LLM (qwen3:8b) analyzes situations and decides on actions
- Available tools:
  - `call_emergency_contact` - Alert family members
  - `send_alert` - Send notifications to care team
  - `adjust_monitoring` - Change monitoring frequency
  - `log_observation` - Record observations

### Tab 4: Live Streaming Demo
- Real-time SSE streaming of sensor events
- Watch "Margaret's Concerning Afternoon" unfold
- All ML processing happens live
- ~90 seconds at 1.5x speed

---

## Demo Scenario: Margaret's Concerning Afternoon

| Time | Event | ML Processing |
|------|-------|---------------|
| 2:15 PM | "I feel a bit dizzy" | Classification: CONCERN |
| 2:16 PM | Unusual stillness | Anomaly Detection |
| 2:17 PM | HR elevated, BP dropping | Anomaly Detection |
| 2:18 PM | "I'm not feeling well" | Classification: CONCERN |
| 2:19 PM | No kitchen activity | Anomaly Detection |
| 2:20 PM | Vitals slightly improved | Anomaly Detection |
| 2:21 PM | "I'm okay, just tired" | Classification: ROUTINE |
| 2:22 PM | Agent analyzes all data | LLM Reasoning |
| 2:22 PM | Decision: ESCALATE | Tool Calls |
| 2:23 PM | Calls Sarah (daughter) | Action Executed |
| 2:24 PM | Situation resolved | Resolution |

---

## API Reference

### Anomaly Detection
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/anomaly/train` | POST | Train anomaly model |
| `/api/anomaly/detect/biometric` | POST | Detect biometric anomalies |
| `/api/anomaly/detect/motion_pattern` | POST | Detect motion anomalies |
| `/api/anomaly/status/{type}` | GET | Get model status |
| `/api/anomaly/save/{model}` | POST | Save trained model |
| `/api/anomaly/load/{model}` | POST | Load saved model |

### Classification
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/classifier/train` | POST | Train classifier |
| `/api/classifier/interactive` | POST | Classify single text |
| `/api/classifier/predict` | POST | Batch classification |
| `/api/classifier/status` | GET | Get model status |
| `/api/classifier/training-data` | GET | Preview training data |
| `/api/classifier/save/{model}` | POST | Save trained model |
| `/api/classifier/load/{model}` | POST | Load saved model |

### Agent
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/analyze` | POST | Full analysis with context |
| `/api/agent/analyze/simple` | POST | Simple query-param analysis |
| `/api/agent/demo/{scenario}` | POST | Run demo (routine/concern/emergency) |
| `/api/agent/log` | GET | Get tool execution log |
| `/api/agent/alerts` | GET | Get alerts |
| `/api/agent/reset` | POST | Reset agent state |

### Streaming
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/streaming/status` | GET | Demo status |
| `/api/streaming/scenario` | GET | Scenario details |
| `/api/streaming/start` | GET | Start SSE stream |
| `/api/streaming/stop` | POST | Stop demo |
| `/api/streaming/reset` | POST | Reset demo |

---

## Running Tests

```bash
# Run all tests (208 tests)
uv run pytest tests/ -v

# Run specific test files
uv run pytest tests/test_phase1_data.py -v      # Data generation
uv run pytest tests/test_phase2_anomaly.py -v   # Anomaly detection
uv run pytest tests/test_phase3_classifier.py -v # Classification
uv run pytest tests/test_phase4_agent.py -v     # Agent logic

# Run streaming tests
uv run pytest tests/api/test_streaming_routes.py -v
```

---

## Project Structure

```
elder-care-demo/
├── data/
│   └── training/              # Generated training data
│       ├── biometric_data.json
│       ├── motion_data.json
│       ├── motion_pattern_data.json
│       ├── voice_data.json
│       └── demo_scenario.json
├── demos/
│   └── test_classifier_flow.py  # End-to-end classifier demo
├── scripts/
│   └── start-demo.sh          # Startup script
├── src/
│   ├── api/routes/            # FastAPI route handlers
│   ├── data/                  # Training data generator
│   ├── models/schemas.py      # Pydantic models
│   └── services/              # Business logic
│       ├── anomaly_service.py
│       ├── classifier_service.py
│       ├── agent_service.py
│       └── streaming_service.py
├── tests/                     # 208 tests
├── ui/                        # React frontend
│   ├── src/
│   │   ├── components/tabs/   # Tab components
│   │   ├── contexts/          # React context (model state)
│   │   └── lib/api.ts         # API client
│   └── package.json
├── llamafarm.yaml             # LlamaFarm project config
├── pyproject.toml             # Python dependencies
└── README.md
```

---

## Key Takeaways

1. **Not everything needs an LLM** - Simple ML models are 100x faster for routine tasks
2. **LLMs excel at coordination** - Use them for decision-making, not data processing
3. **Local models ensure privacy** - Sensitive health data never leaves your network
4. **Model persistence matters** - Train once, load instantly on restart
5. **Streaming enables real-time UX** - SSE provides immediate feedback

---

## Troubleshooting

### Models not persisting?
Make sure to train → save → load:
```bash
# Train and save
curl -X POST http://localhost:8080/api/classifier/train
curl -X POST http://localhost:8080/api/classifier/save/voice_classifier

# Load on restart
curl -X POST http://localhost:8080/api/classifier/load/voice_classifier
```

### LlamaFarm not responding?
```bash
# Check if services are running
lf status

# Restart services
lf stop && lf start
```

### Anomaly detection false positives?
The model needs retraining if you've modified normal ranges. Regenerate training data:
```bash
uv run python -m src.data.training_data_generator
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `uv run pytest tests/ -v`
4. Submit a pull request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Related Projects

- [LlamaFarm](https://github.com/llama-farm/llamafarm) - Local AI framework
- [LlamaFarm Docs](https://docs.llamafarm.dev) - Full documentation
- [local-ai-apps](https://github.com/llama-farm/local-ai-apps) - More example applications
