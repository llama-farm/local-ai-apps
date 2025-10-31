# Insurance Helper - Customization Guide

This document explains the insurance-specific customizations made to the Plain-App base.

## Overview

The Insurance Helper is based on the Plain-App template but extensively customized for insurance document analysis. This guide explains what was changed and how to extend it further.

---

## Key Customizations

### 1. Multi-Model Insurance Agents

**File:** `llamafarm.yaml` (lines 6-102)

Four specialized prompts were created:

#### `insurance_general_assistant`
- General insurance questions
- Policy navigation
- Concept explanations
- Uses clear, empathetic language

#### `insurance_claims_analyst`  
- Claim denial analysis
- Appeal strategies
- Denial code interpretation (CO-*, PR-*)
- Provides actionable next steps

#### `insurance_coverage_advisor`
- "Is X covered?" questions
- Policy interpretation
- Coverage calculations
- Prior authorization guidance

#### `insurance_billing_specialist`
- Medical bill analysis
- EOB interpretation
- Billing error detection
- Cost breakdowns

### 2. Multiple Model Configurations

**File:** `llamafarm.yaml` (lines 224-296)

Six models configured:

| Model Name | Base Model | Use Case |
|------------|------------|----------|
| `insurance_advisor` | qwen3:1.7b | General insurance (default) |
| `fast` | gemma3:1b | Query generation |
| `claims_analyzer` | qwen3:1.7b | Claim denials |
| `coverage_advisor` | qwen3:1.7b | Coverage questions |
| `billing_specialist` | qwen3:1.7b | Bills/EOBs |
| `reasoning` | qwen3:4b | Complex scenarios |

**To switch models**, set in `.env.local`:
```bash
NEXT_PUBLIC_LF_MODEL=claims_analyzer
```

### 3. Insurance-Specific Query Generation

**File:** `app/api/agent-chat/route.ts` (lines 10-59)

The query generation prompt was enhanced to:
- Identify document types (Policy, EOB, Bill, Claim)
- Extract CPT codes, ICD-10 codes, denial codes
- Capture dollar amounts and percentages
- Note in-network vs out-of-network
- Identify time-sensitive info (appeal deadlines)

**Example output:**
```xml
<doc_type>EOB</doc_type>
<summary>EOB for surgery with $8,200 allowed, patient owes $1,640</summary>
<rag_question>laparoscopic cholecystectomy CPT 47562 coverage</rag_question>
<rag_question>CO-50 denial code appeal process</rag_question>
```

### 4. Insurance-Specific Synthesis

**File:** `app/api/agent-chat/route.ts` (lines 61-83)

The synthesis prompt provides:
- **Summary**: Brief overview
- **What This Means**: Plain English explanation
- **Coverage Details**: Costs, percentages, limits
- **Your Responsibility**: What user pays/does
- **Next Steps**: Actionable items with timelines
- **Important Notes**: Deadlines, appeal rights
- **Questions to Ask**: Follow-up questions

### 5. Enhanced RAG Configuration

**File:** `llamafarm.yaml` (lines 104-220)

Two databases:

#### `insurance_policies_db`
- For user's insurance policies
- Collection: `insurance_policies`
- Top-K: 8 (higher for complex policies)
- Chunk size: 1000 chars (larger for insurance)
- Chunk overlap: 250 chars (more overlap)

#### `insurance_knowledge_db`  
- For general insurance knowledge
- Collection: `insurance_knowledge`
- Top-K: 10
- Same processing strategy

### 6. UI Updates

**File:** `app/page.tsx`

Changes:
- Title: "Insurance Helper" (line 159)
- Badge: "Private & Local" (line 161)
- Upload section: "Upload Insurance Documents" (line 176)
- Placeholder: "Policies, EOBs, bills, claims" (line 43 in Dropzone)
- Disclaimer: "This is not legal or medical advice" (line 244)

**File:** `components/chat/Composer.tsx`

Placeholder changed to:
```
"Ask about your policy coverage, medical bills, EOBs, or claim denials…"
```

---

## How to Extend

### Add a New Specialized Agent

1. **Add prompt to `llamafarm.yaml`:**

```yaml
prompts:
  - name: insurance_pharmacy_specialist
    messages:
      - role: system
        content: |
          You are a Pharmacy Benefits Specialist...
          [detailed prompt]
```

2. **Add model configuration:**

```yaml
models:
  - name: pharmacy_specialist
    description: Specialized for prescription coverage and formulary questions
    provider: ollama
    model: qwen3:1.7b
    prompt_format: unstructured
    prompts:
      - insurance_pharmacy_specialist
```

3. **Use it:**

```bash
# In .env.local
NEXT_PUBLIC_LF_MODEL=pharmacy_specialist
```

### Add a New Database

For specialty insurance knowledge (e.g., dental, vision):

```yaml
rag:
  databases:
    - name: dental_insurance_db
      type: ChromaStore
      config:
        collection_name: dental_insurance
        distance_function: cosine
        port: 8000
      [rest of config same as insurance_policies_db]
```

Then create and process:
```bash
lf datasets add dental_insurance -s insurance_policy_processor -b dental_insurance_db
lf datasets ingest dental_insurance ./data/dental/*.pdf
lf datasets process dental_insurance
```

### Customize Query Generation

Edit `/app/api/agent-chat/route.ts` at line 10 to modify `QUERY_GENERATION_PROMPT`.

**Example:** Add prescription-specific extraction:
```javascript
IMPORTANT FOR INSURANCE DOCUMENTS:
- Extract specific codes: CPT, ICD-10, denial codes, NDC codes
- Identify drug names and quantities
...
```

### Add New Document Types

Modify query generation to recognize new types:

```xml
<doc_type>Policy|EOB|Bill|Claim|Formulary|PriorAuth|Other</doc_type>
```

Then add type-specific instructions in the prompt.

---

## Advanced Customizations

### Dynamic Model Selection

You could modify `/app/api/agent-chat/route.ts` to auto-select models based on question type:

```typescript
// Detect question type
const isClaim = /deny|denied|appeal|CO-\d+|PR-\d+/i.test(prompt);
const isCoverage = /cover|covered|include|benefit/i.test(prompt);
const isBilling = /bill|EOB|charge|owe|balance/i.test(prompt);

// Select appropriate model
const selectedModel = isClaim ? 'claims_analyzer' 
  : isCoverage ? 'coverage_advisor'
  : isBilling ? 'billing_specialist'
  : LF_MODEL;
```

### Multi-Database Search

Search both policy DB and knowledge DB in parallel:

```typescript
const databases = ['insurance_policies_db', 'insurance_knowledge_db'];

const ragPromises = queries.flatMap(query =>
  databases.map(database =>
    fetch(ragUrl, {
      method: "POST",
      body: JSON.stringify({ query, database, top_k: topK }),
    })
  )
);
```

### Add Insurance Knowledge Base

Create a general insurance knowledge corpus:

1. **Download public insurance guides:**
   - Medicare.gov handbooks
   - State insurance department FAQs
   - Insurance company glossaries

2. **Process them:**
```bash
lf datasets add insurance_knowledge -s insurance_policy_processor -b insurance_knowledge_db
lf datasets ingest insurance_knowledge ./data/knowledge/*.pdf
lf datasets process insurance_knowledge
```

3. **Configure to search both:**

Modify agent-chat to search knowledge DB for definitions and policy DB for user's specific coverage.

---

## Configuration Files Reference

### llamafarm.yaml
- **Lines 1-5**: Project metadata
- **Lines 6-102**: Prompt definitions (4 specialized agents)
- **Lines 104-220**: RAG configuration (databases, chunking, extractors)
- **Lines 221-296**: Model configurations (6 models)

### .env.local
```env
NEXT_PUBLIC_LF_PROJECT=insurance-helper-project
NEXT_PUBLIC_LF_MODEL=insurance_advisor
NEXT_PUBLIC_LF_DATABASE=insurance_policies_db
```

### app/api/agent-chat/route.ts
- **Lines 1-8**: Environment configuration
- **Lines 10-59**: Insurance query generation prompt
- **Lines 61-83**: Insurance synthesis prompt
- **Lines 68-400**: Multi-hop RAG orchestration logic

---

## Testing Your Customizations

### 1. Test Query Generation

Add console.log in agent-chat route:
```typescript
console.log("Generated queries:", queries);
```

Check browser DevTools console to see generated queries.

### 2. Test RAG Retrieval

```bash
# Test from CLI
lf rag query --database insurance_policies_db "physical therapy coverage"
```

Should return relevant policy excerpts.

### 3. Test Model Switching

```bash
# Test different models
NEXT_PUBLIC_LF_MODEL=claims_analyzer npm run dev
# Ask a denial question

NEXT_PUBLIC_LF_MODEL=coverage_advisor npm run dev
# Ask a coverage question
```

### 4. Test Prompt Changes

After editing `llamafarm.yaml`:
```bash
lf restart  # Reload configuration
npm run dev  # Restart frontend
```

---

## Performance Optimization

### Reduce Latency

1. **Decrease chunk overlap** (faster embedding creation):
```yaml
chunk_overlap: 150  # Down from 250
```

2. **Reduce top-k** (fewer chunks to process):
```yaml
top_k: 4  # Down from 8
```

3. **Use smaller model** for synthesis:
```yaml
model: gemma3:1b  # Instead of qwen3:1.7b
```

### Improve Accuracy

1. **Increase top-k** (more context):
```yaml
top_k: 12  # Up from 8
```

2. **Larger chunks** (more context per chunk):
```yaml
chunk_size: 1200  # Up from 1000
chunk_overlap: 300  # Up from 250
```

3. **Use larger model**:
```yaml
model: qwen3:4b  # Instead of qwen3:1.7b
```

---

## Contributing Improvements

If you make valuable customizations, consider:

1. **Document them** in a CUSTOMIZATIONS.md file
2. **Share prompts** that work well for specific scenarios
3. **Create sample datasets** for testing
4. **Report issues** with insurance-specific edge cases

---

**You now understand how Insurance Helper works and how to customize it for your needs!**
