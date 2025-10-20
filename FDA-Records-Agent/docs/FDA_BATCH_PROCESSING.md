# FDA Batch Processing Guide

This guide explains how to use the FDA batch processing feature to extract questions from FDA correspondence and validate answers in your response corpus.

## Overview

The FDA Batch Processing system:
1. **Extracts questions** from FDA correspondence (letters, emails, meeting minutes)
2. **Validates answers** by searching your response corpus
3. **Saves results** to timestamped JSON files for review

## Architecture

### Two Databases

1. **fda_letters_full** - Large chunks (2000 chars) for question extraction
2. **fda_corpus_chunked** - Small chunks (800 chars) for answer retrieval (RAG)

### Two Models (both Gemma3:1b)

1. **question_extractor** - Extracts FDA action items from documents
2. **answer_finder** - Validates if questions have been answered

## Setup Instructions

### 1. Prepare Your FDA Documents

Organize your documents in a directory on your computer:

```bash
/path/to/fda-documents/
├── fda-letters/
│   ├── warning-letter-001.pdf
│   ├── meeting-minutes-002.pdf
│   └── correspondence-003.txt
└── responses/
    ├── response-001.pdf
    └── response-002.pdf
```

### 2. Upload Documents to LlamaFarm

You need to upload documents to **both datasets** (for question extraction and answer finding):

```bash
# Upload FDA letters/correspondence (for question extraction)
lf datasets upload fda_letters /path/to/fda-documents/fda-letters/*.pdf
lf datasets upload fda_letters /path/to/fda-documents/fda-letters/*.txt

# Upload response corpus (for answer validation)
lf datasets upload fda_corpus /path/to/fda-documents/responses/*.pdf
lf datasets upload fda_corpus /path/to/fda-documents/responses/*.txt
```

**Note:** You can also use recursive patterns:

```bash
# Upload all PDFs recursively
lf datasets upload fda_letters /path/to/fda-documents/**/*.pdf
lf datasets upload fda_corpus /path/to/fda-documents/**/*.pdf
```

### 3. Process Datasets

Process the documents to create vector embeddings:

```bash
# Process FDA letters (creates large chunks for question extraction)
lf datasets process fda_letters

# Process response corpus (creates small chunks for RAG)
lf datasets process fda_corpus
```

**Processing time:**
- Depends on document count and size
- Typical: 5-10 documents in 2-3 minutes
- Monitor progress: `lf datasets list`

### 4. Verify Data

Check that documents were processed successfully:

```bash
# List all datasets
lf datasets list

# Should show:
# - fda_letters: X files, Y chunks
# - fda_corpus: X files, Z chunks

# Test RAG query
lf rag query --database fda_letters_full "clinical trials" --top-k 3
lf rag query --database fda_corpus_chunked "safety data" --top-k 3
```

## Running Batch Processing

### Via Web UI

1. Navigate to http://localhost:3000/batch
2. Click "Start Batch Processing"
3. Wait for processing to complete (progress shown in UI)
4. View results summary and download JSON files

### Via API

```bash
# Start batch processing
curl -X POST http://localhost:3000/api/fda-batch

# Get list of previous results
curl http://localhost:3000/api/fda-batch

# Download specific result file
curl "http://localhost:3000/api/fda-batch/file?path=2025-01-20/batch_2025-01-20T10-30-00-000Z.json"
```

## Understanding Results

### Result File Structure

```json
{
  "timestamp": "2025-01-20T10:30:00.000Z",
  "project": "fda-records-agent",
  "namespace": "default",
  "documents": [
    {
      "document_hash": "abc123...",
      "document_name": "Document_1.pdf",
      "questions": [
        {
          "question_text": "Please provide stability data at 25°C and 40°C for 12 months",
          "type": "critical",
          "context": "CMC/Stability",
          "page_reference": "Page 3",
          "confidence": 0.95
        }
      ],
      "validations": [
        {
          "question": "Please provide stability data...",
          "answered": true,
          "completeness": "complete",
          "confidence": 0.85,
          "summary": "Stability data provided in response document Section 3.2",
          "evidence": [
            {
              "text": "Stability studies conducted at 25°C/60%RH and 40°C/75%RH for 12 months...",
              "source": "response-001.pdf"
            }
          ]
        }
      ],
      "stats": {
        "total_questions": 5,
        "critical_questions": 4,
        "administrative_questions": 1,
        "answered": 3,
        "unanswered": 2
      }
    }
  ],
  "summary": {
    "total_documents": 10,
    "total_questions": 47,
    "total_answered": 32,
    "total_unanswered": 15
  }
}
```

### Question Types

- **critical**: Regulatory requests requiring formal response (CMC, safety, efficacy)
- **administrative**: Procedural/timeline requests (meetings, deadlines)

### Completeness Levels

- **complete**: Question fully answered with sufficient detail
- **partial**: Question partially answered, some information missing
- **none**: No answer found or not relevant

## Performance & Optimization

### Processing Speed

- **Question extraction**: ~1-2 seconds per chunk (2000 chars)
- **Answer validation**: ~2-3 seconds per question
- **Typical document**: 3-5 chunks, 5-10 questions
- **Estimated time**: ~10-15 seconds per document

### Improving Speed

1. **Reduce chunk count**: Use larger chunks in `fda_full_document_processor`
2. **Skip administrative questions**: Already implemented (saves ~30% time)
3. **Reduce top_k**: Lower `top_k` in `fda_corpus_chunked` database config
4. **Batch processing**: Process multiple documents in parallel (coming soon)

### Improving Accuracy

1. **Higher confidence threshold**: Filter questions with `confidence >= 0.9`
2. **Better prompts**: Customize prompts in `llamafarm.yaml`
3. **More context**: Increase `chunk_overlap` in processing strategies
4. **Manual review**: Review and refine extracted questions

## Troubleshooting

### "No documents found in fda_letters dataset"

**Solution:** Upload and process documents first:

```bash
lf datasets upload fda_letters /path/to/files/*.pdf
lf datasets process fda_letters
```

### "No chunks found for document"

**Cause:** Document not in vector database or wrong database name

**Solution:**
1. Verify dataset name: `lf datasets list`
2. Check database config in `llamafarm.yaml`
3. Re-process: `lf datasets process fda_letters`

### "RAG query failed"

**Cause:** LlamaFarm server not running or database not initialized

**Solution:**
```bash
# Check server health
curl http://localhost:8000/health

# Restart LlamaFarm
lf start

# Verify RAG database
lf rag stats --database fda_letters_full
```

### Questions extracted incorrectly

**Cause:** Model hallucinating or prompt too permissive

**Solution:**
1. Increase confidence threshold in batch API
2. Customize `fda_question_extractor` prompt in `llamafarm.yaml`
3. Review extraction patterns in your documents

### Answers not found when they exist

**Cause:** Low similarity score or insufficient chunks retrieved

**Solution:**
1. Increase `top_k` in `fda_corpus_chunked` database (default: 3)
2. Reduce `chunk_size` for finer granularity
3. Verify documents uploaded to `fda_corpus` dataset

## Result Storage

### File Organization

```
fda_results/
├── 2025-01-20/
│   ├── batch_2025-01-20T10-30-00-000Z.json
│   └── batch_2025-01-20T14-15-00-000Z.json
├── 2025-01-21/
│   └── batch_2025-01-21T09-00-00-000Z.json
└── index.json
```

### Backup & Export

```bash
# Backup all results
cp -r fda_results/ /path/to/backup/

# Export to CSV (using jq)
jq -r '.documents[] | .validations[] | [.question, .answered, .confidence, .summary] | @csv' \
  fda_results/2025-01-20/batch_*.json > results.csv
```

## Advanced Usage

### Custom Processing Strategies

Edit `llamafarm.yaml` to customize chunking:

```yaml
data_processing_strategies:
  - name: fda_full_document_processor
    parsers:
    - type: PDFParser
      config:
        chunk_size: 3000  # Increase for larger chunks
        chunk_overlap: 600
```

### Custom Prompts

Edit prompts in `llamafarm.yaml`:

```yaml
prompts:
- name: fda_question_extractor
  messages:
  - role: system
    content: |
      Your custom extraction instructions here...
```

### API Integration

Integrate batch processing into your workflows:

```typescript
// Trigger batch processing
const response = await fetch("http://localhost:3000/api/fda-batch", {
  method: "POST"
});

const result = await response.json();
console.log(`Processed ${result.documents_processed} documents`);
console.log(`Answered ${result.summary.total_answered}/${result.summary.total_questions} questions`);
```

## Next Steps

1. **Review extracted questions** manually for accuracy
2. **Refine prompts** based on your document types
3. **Add more documents** to improve answer coverage
4. **Export results** for compliance tracking
5. **Integrate with existing workflows** via API

## Support

For issues or questions:
1. Check logs: `docker logs -f llamafarm-server`
2. Review this guide and README.md
3. File an issue on GitHub

---

**Last Updated:** 2025-01-20
