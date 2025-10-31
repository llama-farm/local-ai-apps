# Insurance Helper 🏥💰

A **100% local, privacy-first** insurance assistant that helps you understand your health insurance policies, medical bills, Explanation of Benefits (EOBs), and claim denials using AI and RAG (Retrieval-Augmented Generation). Built with Next.js and [LlamaFarm](https://docs.llamafarm.dev), all document processing happens entirely in your browser – your sensitive insurance documents never leave your device.

## ✨ Key Features

- **🔒 Complete Privacy** – Insurance documents parsed client-side, no server uploads, HIPAA-sensitive data stays on your device
- **💼 Insurance-Specialized Agents** – Multi-hop RAG with agents specialized for claims, coverage, and billing
- **📋 Document Understanding** – Analyze policies, EOBs, medical bills, claim denials, and prior auth forms
- **🤖 Smart Query Generation** – AI extracts CPT codes, ICD-10 codes, denial codes, and dollar amounts automatically
- **💡 Plain English Explanations** – Complex insurance jargon translated into understandable language
- **📊 Cost Calculations** – Estimate out-of-pocket costs based on deductibles, coinsurance, and coverage limits
- **⚡ Multi-Model Architecture** – Fast model for query generation, specialized models for different insurance scenarios
- **💬 Streaming Chat Interface** – Real-time responses with citations from your policy documents
- **🎯 Actionable Guidance** – Next steps, appeal strategies, and what to ask your insurance company

---

## 🚀 Quick Start

For experienced developers who want to get running quickly:

```bash
# 1. Install prerequisites (if not already installed)
# Docker Desktop: https://www.docker.com/products/docker-desktop
# Ollama: https://ollama.com/download
# LlamaFarm CLI: https://docs.llamafarm.dev/installation

# 2. Pull AI models (~2.4GB total, 10-20 min)
ollama pull gemma3:1b          # Fast query generation (134MB)
ollama pull qwen3:1.7b         # Insurance analysis (1GB)
ollama pull nomic-embed-text   # Embeddings (274MB)

# Configure Ollama context window to 32768+ (Settings → Advanced)

# 3. Initialize LlamaFarm
cd Insurance-helper
lf init
lf start  # May take a few minutes on first run

# 4. (IMPORTANT) Add your insurance policies to the knowledge base
mkdir -p data/policies
# Copy your insurance policy PDFs to data/policies/

lf datasets add insurance_policies -s insurance_policy_processor -b insurance_policies_db
lf datasets ingest insurance_policies ./data/policies/*.pdf
lf datasets process insurance_policies  # Takes 5-15 min depending on policy size

# 5. Configure & run frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start asking questions about your insurance!

---

## 🎯 Specialized Insurance Agents

The Insurance Helper includes **four specialized agent prompts** optimized for different insurance scenarios:

### 1. General Insurance Assistant
**Model:** `insurance_advisor`  
**Use for:** General insurance questions, policy navigation, concept explanations

**Examples:**
- "What's the difference between deductible and out-of-pocket maximum?"
- "How does my HSA work with my high-deductible plan?"

### 2. Claims Analyst
**Model:** `claims_analyzer`  
**Use for:** Claim denials, appeals, denial codes

**Examples:**
- "My claim was denied with code CO-50. What does this mean?"
- "How do I appeal this denial?"

### 3. Coverage Advisor
**Model:** `coverage_advisor`  
**Use for:** "Is X covered?" questions, policy interpretation

**Examples:**
- "Is physical therapy covered by my plan?"
- "What's my coinsurance for specialist visits?"

### 4. Billing Specialist
**Model:** `billing_specialist`  
**Use for:** Medical bills, EOBs, billing errors

**Examples:**
- "Why is my bill different from my EOB?"
- "Is this balance billing?"

**To switch models**, edit `.env.local`:
```bash
NEXT_PUBLIC_LF_MODEL=claims_analyzer      # For denials
NEXT_PUBLIC_LF_MODEL=coverage_advisor     # For coverage
NEXT_PUBLIC_LF_MODEL=billing_specialist   # For bills/EOBs
```

---

## 💬 Example Questions

### Policy Coverage
```
"Does my plan cover physical therapy?"
"How many PT sessions can I have per year?"
"What's my deductible for in-network services?"
"Do I need prior authorization for an MRI?"
```

### EOB Analysis
```
"My EOB shows I owe $1,200. Why so much?" (Upload EOB PDF)
"What does 'allowed amount' mean?"
"The billed amount was $8,000 but insurance paid $3,500. Why?"
```

### Claim Denials
```
"My claim was denied with code CO-50. What does this mean and can I appeal?" (Upload denial letter)
"How long do I have to file an appeal?"
```

### Cost Estimation
```
"I need surgery with CPT code 47562. How much will I owe?"
"What's the cost difference if I go out-of-network?"
```

---

## 📚 Building Your Insurance Knowledge Base

### RECOMMENDED: Add Your Insurance Policy

```bash
# Step 1: Organize documents
mkdir -p data/policies
cp ~/Downloads/my-insurance-policy-2024.pdf data/policies/

# Step 2: Create dataset
lf datasets add insurance_policies \
  -s insurance_policy_processor \
  -b insurance_policies_db

# Step 3: Ingest documents
lf datasets ingest insurance_policies ./data/policies/*.pdf

# Step 4: Process (creates embeddings)
lf datasets process insurance_policies
# Takes 10-20 minutes for typical policy

# Step 5: Verify
lf rag stats --database insurance_policies_db
```

**What to add:**
- Your insurance policy PDF (50-200 pages)
- Summary of Benefits document
- Prescription drug formulary
- Any policy amendments or riders

---

## 🔄 Multi-Hop RAG for Insurance

Traditional RAG uses a single query. Insurance Helper uses **multi-hop RAG**:

```
User: "My EOB shows denial code CO-50 for physical therapy after surgery"
       ↓
┌──────────────────────────────────────────┐
│ STEP 1: Query Generation (gemma3:1b)    │
│ Generates 5-8 focused queries:          │
│ 1. "CO-50 denial code meaning"          │
│ 2. "physical therapy post-surgical"     │
│ 3. "appeal CO-50 denial"                │
│ 4. "PT session limits after surgery"    │
└──────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────┐
│ STEP 2: Parallel Retrieval               │
│ Executes all 5 queries → 50 total       │
│ Deduplicates to top 15 unique excerpts  │
└──────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────┐
│ STEP 3: Synthesis (qwen3:1.7b)          │
│ Comprehensive answer covering:           │
│ - What CO-50 means                       │
│ - Your policy's PT coverage              │
│ - Why denied & how to appeal             │
│ - Required documentation                 │
└──────────────────────────────────────────┘
```

**Result:** 3-4x more comprehensive information than single-query RAG.

---

## 🔒 Privacy & Security

### Your Insurance Data is Private

| Data | Location | Uploaded? |
|------|----------|-----------|
| PDFs in browser | Browser memory only | ❌ Never |
| Policy in data/policies/ | Your computer | ❌ Never |
| Embeddings | ChromaDB (Docker) | ❌ Local only |
| Top 6 excerpts | Sent to localhost:8000 | ⚠️ Localhost only |

**Your complete insurance documents NEVER leave your browser.**

---

## 🛠️ Troubleshooting

### LlamaFarm won't start
```bash
lf stop
docker system prune -af
lf start
```

### No results from knowledge base
```bash
# Verify embeddings were created
lf rag stats --database insurance_policies_db

# If 0 results, re-process:
lf datasets process insurance_policies
```

### Slow responses
- Reduce RAG top-k (try 4 instead of 8)
- Ensure Ollama context window is 32768+
- Check Docker has 4GB+ RAM allocated

---

## 📄 License

MIT License

**⚠️ Important Disclaimers:**

1. **Not Medical Advice**: Consult healthcare professionals for medical decisions
2. **Not Legal Advice**: Consult an attorney for insurance disputes
3. **Verify Everything**: Always verify with your insurance provider
4. **Emergency**: Call 911 for medical emergencies

---

**Questions?** Check [LlamaFarm docs](https://docs.llamafarm.dev) or open a GitHub issue.

**Your privacy is protected. All processing happens locally.** 🔒


---

## 📖 Medical Member Handbook Upload

The Insurance Helper includes a **dedicated handbook uploader** that allows you to upload your Medical Member Handbook for personalized coverage information.

### How It Works

1. **Upload**: Drop your handbook PDF in the uploader
2. **Processing**: The handbook is automatically:
   - Ingested into LlamaFarm's `member_handbook` dataset
   - Chunked and embedded for semantic search
   - Processed to create a comprehensive coverage summary
3. **Summary**: AI generates a structured summary including:
   - Plan type (HMO/PPO/EPO/HDHP)
   - Deductibles and out-of-pocket maximums
   - Coinsurance percentages
   - Copays for different services
   - Prescription coverage tiers
   - Prior authorization requirements
   - Contact information
4. **Integration**: When you ask questions, the agent automatically:
   - Searches both your handbook AND general insurance knowledge
   - Prioritizes your specific plan details
   - Provides personalized answers based on YOUR coverage

### What Makes This Different

**Traditional document upload** (for bills/EOBs):
- Parsed in browser only
- Not persisted
- Used for one-off questions

**Handbook upload** (for your policy):
- Ingested into LlamaFarm database
- Creates searchable embeddings
- Generates persistent summary
- Used for ALL future questions about coverage

### Example Questions After Handbook Upload

```
"What's my deductible?" 
→ Agent finds YOUR specific deductible from your handbook

"Is physical therapy covered?"
→ Agent searches YOUR handbook first, then general knowledge

"How many PT sessions per year?"
→ Agent returns YOUR plan's specific limits

"Do I need prior auth for an MRI?"
→ Agent checks YOUR plan's prior auth requirements
```

### Technical Details

**Dataset**: `member_handbook`  
**Database**: `member_handbook_db`  
**Processing time**: 2-5 minutes for typical handbook  
**Storage**: Summary stored in localStorage for quick access  
**Search**: Top-12 results (higher than general search for detailed coverage info)

