# Medical Member Handbook Workflow

This document explains the technical workflow for uploading and using the Medical Member Handbook.

## Architecture Overview

```
User uploads handbook PDF
         ↓
┌──────────────────────────────────────┐
│ Frontend: HandbookUploader component │
│ - File selection                     │
│ - Upload to /api/handbook/upload    │
│ - Poll /api/handbook/status          │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Backend: /api/handbook/upload        │
│ 1. Receive PDF file                  │
│ 2. Call LlamaFarm datasets API       │
│ 3. Ingest file into member_handbook  │
│ 4. Trigger processing (embeddings)   │
│ 5. Return task ID                    │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ LlamaFarm Processing (2-5 min)       │
│ 1. Parse PDF to text                 │
│ 2. Chunk text (1000 chars, 250 overlap)│
│ 3. Generate embeddings (nomic-embed) │
│ 4. Store in ChromaDB                 │
│ 5. Mark task as completed            │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Backend: /api/handbook/summarize     │
│ 1. Query handbook with 10 queries    │
│ 2. Retrieve 20 unique excerpts       │
│ 3. Send to LLM (qwen3:1.7b)         │
│ 4. Generate structured summary       │
│ 5. Return summary to frontend        │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Frontend: Display & Store            │
│ 1. Show summary in UI                │
│ 2. Store in localStorage             │
│ 3. Mark handbook as "Ready"          │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Agent Chat: Query Integration        │
│ When user asks question:             │
│ 1. Generate 5-8 search queries       │
│ 2. Search BOTH databases:            │
│    - insurance_policies_db           │
│    - member_handbook_db              │
│ 3. Deduplicate results               │
│ 4. Synthesize answer with:           │
│    - User's question                 │
│    - Handbook excerpts               │
│    - Policy excerpts                 │
│    - Stored summary (context)        │
└──────────────────────────────────────┘
```

## API Endpoints

### POST /api/handbook/upload

**Purpose**: Upload and ingest handbook into LlamaFarm

**Input**: 
- `FormData` with `file` (PDF)

**Process**:
1. Save file temporarily
2. Call LlamaFarm ingest API:
   ```
   POST /v1/projects/{namespace}/{project}/datasets/member_handbook/ingest
   ```
3. Call LlamaFarm process API:
   ```
   POST /v1/projects/{namespace}/{project}/datasets/member_handbook/process
   ```
4. Return task ID for status polling

**Output**:
```json
{
  "success": true,
  "taskId": "task_12345",
  "dataset": "member_handbook",
  "database": "member_handbook_db",
  "filename": "my-handbook.pdf"
}
```

### GET /api/handbook/status?taskId=...

**Purpose**: Check processing status

**Input**: 
- Query param: `taskId`

**Process**:
1. Call LlamaFarm tasks API:
   ```
   GET /v1/projects/{namespace}/{project}/tasks/{taskId}
   ```

**Output**:
```json
{
  "status": "completed" | "processing" | "failed",
  "progress": 0.75,
  "result": {...},
  "error": "error message if failed"
}
```

### POST /api/handbook/summarize

**Purpose**: Generate comprehensive coverage summary

**Input**: 
```json
{
  "topK": 15
}
```

**Process**:
1. Execute 10 parallel RAG queries against `member_handbook_db`:
   - "plan type HMO PPO network"
   - "deductible individual family"
   - "out of pocket maximum"
   - "coinsurance percentage"
   - "copay primary care specialist emergency"
   - "prescription drug coverage tiers"
   - "prior authorization requirements"
   - "covered services benefits"
   - "limitations exclusions"
   - "contact information member services"

2. Deduplicate to 20 unique excerpts

3. Send to LLM with structured prompt

4. Return generated summary

**Output**:
```json
{
  "summary": "# Plan Type & Network\n- PPO Plan\n...",
  "excerpts_used": 18,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Database Configuration

### llamafarm.yaml

```yaml
rag:
  databases:
    - name: member_handbook_db
      type: ChromaStore
      config:
        collection_name: member_handbook
        distance_function: cosine
        port: 8000
      retrieval_strategies:
        - name: handbook_search
          config:
            top_k: 12  # Higher for detailed coverage info

datasets:
  - name: member_handbook
    data_processing_strategy: insurance_policy_processor
    database: member_handbook_db
    files: []
```

## Frontend Components

### HandbookUploader.tsx

**State management**:
- `status`: idle | uploading | processing | summarizing | ready | error
- `filename`: Name of uploaded file
- `taskId`: Processing task ID from LlamaFarm
- `summary`: Generated coverage summary
- `selectedFile`: File object before upload

**Key functions**:
- `handleFileSelect`: Capture file selection
- `handleUpload`: Upload to API, start processing
- `generateSummary`: Call summarize API after processing
- `useEffect` with polling: Check task status every 2 seconds
- `useEffect` on mount: Load stored summary from localStorage

**UI states**:
1. **Idle**: File selector + upload button
2. **Uploading**: Progress indicator
3. **Processing**: "Processing..." with explanation
4. **Summarizing**: "Generating summary..."
5. **Ready**: Display summary + clear button
6. **Error**: Show error message + retry

## Integration with Agent Chat

### Modified agent-chat route

**Key change**: Search TWO databases in parallel

Before:
```typescript
const ragPromises = queries.map(query =>
  fetch(ragUrl, { database: LF_DATABASE, ... })
);
```

After:
```typescript
const databases = [LF_DATABASE, "member_handbook_db"];
const ragPromises = queries.flatMap(query =>
  databases.map(database =>
    fetch(ragUrl, { database, ... })
  )
);
```

**Result**: Each query searches BOTH:
- `insurance_policies_db` (general policies you added via CLI)
- `member_handbook_db` (user's uploaded handbook)

**Deduplication**: Results from both databases are combined and deduplicated

**Synthesis**: Final answer includes context from:
1. User's question
2. User's uploaded bills/EOBs (if any)
3. Handbook excerpts (personalized)
4. General policy excerpts
5. Stored handbook summary (for quick context)

## Data Flow Example

### Scenario: User asks "What's my deductible?"

1. **Query generation** (gemma3:1b):
   - Generates queries: ["individual deductible amount", "family deductible", "deductible met calculation"]

2. **RAG retrieval** (parallel):
   - Query 1 searches `insurance_policies_db` → 8 results
   - Query 1 searches `member_handbook_db` → 12 results
   - Query 2 searches both databases → more results
   - Total: ~40 results

3. **Deduplication**:
   - Remove duplicates
   - Keep top 15 unique excerpts
   - **Handbook results often score higher** (more specific to user's plan)

4. **Synthesis** (qwen3:1.7b):
   - Receives all 15 excerpts
   - Receives stored summary (shows "PPO, $2000 individual deductible")
   - Generates answer: "Your individual deductible is $2,000..." with citations

## Performance Characteristics

**Upload time**: 1-2 seconds  
**Processing time**: 2-5 minutes (depends on handbook size)  
**Summary generation**: 10-15 seconds  
**Query time**: 2-3 seconds (searches both databases in parallel)

## Error Handling

### Upload failures
- File too large (>50MB) → Show error
- Invalid PDF → Show error
- LlamaFarm not running → Connection error

### Processing failures
- Task fails → Poll returns error status
- Processing timeout → UI shows timeout message
- No embeddings created → Re-try processing

### Summary failures
- No results from handbook → Check if processing completed
- LLM error → Retry with lower token limit
- Empty summary → Check handbook has text content

## Storage & Persistence

**LocalStorage** (browser):
```javascript
{
  "handbook_summary": {
    "summary": "...",
    "filename": "my-handbook.pdf",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

**ChromaDB** (LlamaFarm):
- Collection: `member_handbook`
- Embeddings: 768-dimension vectors
- Metadata: filename, page numbers, chunk IDs
- Persists across restarts

## Future Enhancements

1. **Multiple handbooks**: Support uploading handbooks for different years
2. **Handbook comparison**: "What changed between 2024 and 2025?"
3. **Smart summary updates**: Re-generate summary when handbook is updated
4. **Handbook versioning**: Track changes over time
5. **Export summary**: Download as PDF or print
6. **Handbook search UI**: Dedicated search interface for handbook
7. **Highlight changes**: Show what's new in updated handbooks

---

**This workflow ensures your handbook is properly processed, summarized, and integrated into every insurance question you ask.**
