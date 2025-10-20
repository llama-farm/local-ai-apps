# FDA Document Analysis System - Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to transform the existing Medical Records Helper application into an **FDA Document Analysis System** capable of:

1. **Ingesting 600+ FDA documents** (correspondence, emails, PDFs)
2. **Extracting FDA questions and tasks** from documents using AI agents
3. **Searching across all documents** to determine if questions were answered
4. **Presenting results** with full metadata (document name, page, chunk, date, etc.)

The system will leverage the existing LlamaFarm infrastructure while implementing two new specialized agents and a dual-dataset architecture.

---

## Table of Contents

1. [Current System Overview](#1-current-system-overview)
2. [New System Requirements](#2-new-system-requirements)
3. [Architecture Design](#3-architecture-design)
4. [Dual-Dataset Strategy](#4-dual-dataset-strategy)
5. [Agent Architecture](#5-agent-architecture)
6. [UI/UX Design](#6-uiux-design)
7. [LlamaFarm API Integration](#7-llamafarm-api-integration)
8. [Implementation Phases](#8-implementation-phases)
9. [Technical Specifications](#9-technical-specifications)
10. [Testing Strategy](#10-testing-strategy)
11. [Timeline & Milestones](#11-timeline--milestones)

---

## 1. Current System Overview

### Existing Architecture

**Frontend (Next.js + TypeScript):**
- Client-side PDF parsing with PDF.js
- Multi-hop agentic RAG workflow
- Streaming chat interface with SSE
- Settings drawer for RAG configuration

**Backend (LlamaFarm):**
- FastAPI server (port 8000)
- ChromaDB vector database
- Celery workers for background processing
- Two-tier model strategy:
  - `gemma3:1b` (fast model for query generation)
  - `qwen3:1.7B` (capable model for synthesis)
  - `nomic-embed-text` (embedding model)

**Current Capabilities:**
- Upload and parse PDFs client-side
- Extract text and chunk semantically
- Multi-hop RAG: Generate queries → Retrieve knowledge → Synthesize response
- Medical knowledge base: 125,830 chunks from 18 textbooks

**Current Limitations:**
- Single-purpose medical Q&A (not optimized for FDA documents)
- No question/task extraction capability
- No document-to-document matching workflow
- No directory-level file management
- Limited metadata extraction and tracking

---

## 2. New System Requirements

### Core Functionality

**Document Ingestion:**
- Add entire directories via file picker
- Support 600+ FDA documents (PDFs, emails, correspondence)
- Process files into TWO separate datasets

**Question/Task Extraction:**
- Recursively analyze each document
- Identify FDA questions and tasks (not administrative tasks)
- Deduplicate questions per document
- Extract and preserve full metadata:
  - Document name
  - Page number
  - Chunk ID
  - Date (if extractable from document or filename)
  - Sender/Recipient (if extractable)
  - Subject/Topic
  - Question/Task text

**Answer Matching:**
- Search across 500+ other documents
- Determine if each question was answered
- Rank confidence of matches
- Link questions to potential answers with metadata

**UI Requirements:**
- Directory picker for bulk file addition
- Dataset management interface:
  - Create Dataset 1: "Question Extraction DB"
  - Create Dataset 2: "Answer Search DB"
- Processing progress indicators
- "Conduct Search" button to trigger analysis
- Results table/view showing:
  - All extracted questions
  - Answered vs Unanswered status
  - Source document metadata
  - Answer document metadata (if found)
  - Confidence scores
- Export results to CSV/JSON

---

## 3. Architecture Design

### High-Level System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                              │
│  - Directory Picker                                                 │
│  - Dataset Management Panel                                         │
│  - Processing Progress Tracker                                      │
│  - Results Dashboard (Questions + Answers)                          │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND ORCHESTRATION                          │
│  - File upload coordination                                         │
│  - LlamaFarm API client                                            │
│  - State management (datasets, processing status, results)          │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      LLAMAFARM API LAYER                            │
│  POST /v1/projects/{ns}/{id}/datasets/create                        │
│  POST /v1/projects/{ns}/{id}/datasets/ingest                        │
│  POST /v1/projects/{ns}/{id}/datasets/process                       │
│  GET  /v1/projects/{ns}/{id}/datasets/status                        │
│  POST /v1/projects/{ns}/{id}/agents/run                             │
│  POST /v1/projects/{ns}/{id}/rag/query                              │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────┬──────────────────────────────────────┐
│   DATASET 1:                 │   DATASET 2:                         │
│   Question Extraction DB     │   Answer Search DB                   │
│   - Full document text       │   - Full document text               │
│   - Enhanced metadata        │   - Enhanced metadata                │
│   - Question-optimized       │   - Answer-optimized chunking        │
│     chunking                 │   - Dense embeddings                 │
└──────────────────────────────┴──────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      AGENT ORCHESTRATION                            │
│  Agent 1: FDA Question Extractor                                    │
│  Agent 2: Answer Matcher                                            │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         RESULTS STORAGE                             │
│  - Extracted Questions (with metadata)                              │
│  - Question-Answer Pairs                                            │
│  - Unanswered Questions List                                        │
│  - Confidence Scores                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Dual-Dataset Strategy

### Why Two Datasets?

**Dataset 1: Question Extraction Database**
- **Purpose:** Optimized for identifying questions and tasks within documents
- **Chunking Strategy:** Smaller chunks (400 chars, 100 overlap) to preserve question boundaries
- **Embeddings:** Standard semantic embeddings for question detection
- **Extractors:**
  - Enhanced metadata extraction (dates, sender/recipient, subject)
  - Question/imperative sentence detection
  - Entity extraction (FDA actions, requirements, deadlines)

**Dataset 2: Answer Search Database**
- **Purpose:** Optimized for finding comprehensive answers across documents
- **Chunking Strategy:** Larger chunks (800 chars, 200 overlap) to preserve answer context
- **Embeddings:** Dense embeddings for semantic similarity
- **Extractors:**
  - Standard metadata extraction
  - Topic/subject extraction
  - Cross-reference detection

### LlamaFarm Configuration

**Based on sample FDA document analysis**, the configuration below is optimized for:
1. **Email threads** (plain text with headers, threading, informal exchanges)
2. **Meeting minutes** (structured PDFs with sections, Q&A, action items)
3. **Mixed document types** (emails exported as text, formal correspondence as PDFs)

**llamafarm.yaml modifications:**

```yaml
rag:
  databases:
    # Existing medical_db stays intact
    - name: medical_db
      type: ChromaStore
      config:
        collection_name: medical_textbooks
        distance_function: cosine
        port: 8000
      embedding_strategies:
        - name: medical_embeddings
          type: OllamaEmbedder
          config:
            model: nomic-embed-text
            base_url: http://host.docker.internal:11434
            dimension: 768
      retrieval_strategies:
        - name: medical_search
          type: BasicSimilarityStrategy
          config:
            distance_metric: cosine
            top_k: 6
          default: true

    # NEW: Question Extraction Database
    - name: fda_questions_db
      type: ChromaStore
      config:
        collection_name: fda_questions
        distance_function: cosine
        port: 8000
      embedding_strategies:
        - name: question_embeddings
          type: OllamaEmbedder
          config:
            model: nomic-embed-text
            base_url: http://host.docker.internal:11434
            dimension: 768
            batch_size: 16
            auto_pull: true
      retrieval_strategies:
        - name: question_search
          type: BasicSimilarityStrategy
          config:
            distance_metric: cosine
            top_k: 10
          default: true

    # NEW: Answer Search Database
    - name: fda_answers_db
      type: ChromaStore
      config:
        collection_name: fda_answers
        distance_function: cosine
        port: 8000
      embedding_strategies:
        - name: answer_embeddings
          type: OllamaEmbedder
          config:
            model: nomic-embed-text
            base_url: http://host.docker.internal:11434
            dimension: 768
            batch_size: 16
            auto_pull: true
      retrieval_strategies:
        - name: answer_search
          type: BasicSimilarityStrategy
          config:
            distance_metric: cosine
            top_k: 15
          default: true

  data_processing_strategies:
    # Existing medical_textbook_processor stays intact
    - name: medical_textbook_processor
      description: Simple processor for medical textbook text files
      parsers:
        - type: TextParser_Python
          config:
            chunk_size: 800
            chunk_overlap: 200
            chunk_strategy: paragraphs
            encoding: utf-8
            clean_text: false
            extract_metadata: true
          file_include_patterns:
            - '*.txt'
          priority: 10
      extractors:
        - type: KeywordExtractor
          config:
            algorithm: yake
            max_keywords: 15
            min_keyword_length: 3
          file_include_patterns:
            - '*.txt'
          priority: 10

    # NEW: FDA Email Thread Processor (for .txt email exports)
    - name: fda_email_question_processor
      description: Processes email threads for question extraction with email-specific parsing
      parsers:
        - type: EmailParser  # NEW: Specialized email parser
          config:
            chunk_size: 300          # Smaller chunks for email exchanges
            chunk_overlap: 50
            chunk_strategy: email_message  # Chunk by email message boundaries
            extract_email_headers: true    # Extract From, To, Subject, Date
            preserve_threading: true       # Maintain reply structure
            encoding: utf-8
          file_include_patterns:
            - '*.txt'
            - '*.eml'
            - '*.msg'
          priority: 15
      extractors:
        - type: EmailMetadataExtractor  # NEW CUSTOM EXTRACTOR
          config:
            extract_sender: true
            extract_recipient: true
            extract_cc: true
            extract_subject: true
            extract_date: true
            date_formats: ['ddd, DD MMM YYYY HH:mm:ss Z', 'YYYY-MM-DD']
          file_include_patterns:
            - '*.txt'
            - '*.eml'
          priority: 5
        - type: QuestionExtractor    # NEW CUSTOM EXTRACTOR
          config:
            min_confidence: 0.6
            include_imperatives: true  # "Please provide...", "Submit...", "Would it be possible..."
            exclude_administrative: true  # Filter out "Thank you", acknowledgments
            email_context_aware: true  # Understand questions in email context
            detect_request_patterns: true  # "requesting", "need clarification", "can you"
          file_include_patterns:
            - '*.txt'
            - '*.eml'
          priority: 8
        - type: KeywordExtractor
          config:
            algorithm: yake
            max_keywords: 10
            min_keyword_length: 3
            fda_specific: true        # IND numbers, submission types, etc.
          file_include_patterns:
            - '*.txt'
          priority: 10

    # NEW: FDA PDF Question Extraction Strategy (for meeting minutes, letters)
    - name: fda_pdf_question_processor
      description: Extracts questions and tasks from FDA PDFs (meeting minutes, formal letters)
      parsers:
        - type: PDFParser
          config:
            chunk_size: 400          # Smaller chunks for question boundaries
            chunk_overlap: 100
            chunk_strategy: paragraphs
            extract_metadata: true
            extract_page_numbers: true
            extract_sections: true   # Detect section headers
            preserve_formatting: true  # Maintain structure (Q&A format)
          file_include_patterns:
            - '*.pdf'
          priority: 10
      extractors:
        - type: PDFStructureExtractor  # NEW CUSTOM EXTRACTOR
          config:
            extract_document_type: true  # Meeting minutes, letter, report
            extract_reference_id: true   # IND number, application number
            extract_meeting_metadata: true  # Date, attendees, location
            extract_sections: true      # Background, Discussion, Action Items
          file_include_patterns:
            - '*.pdf'
          priority: 3
        - type: QuestionExtractor    # NEW CUSTOM EXTRACTOR
          config:
            min_confidence: 0.6
            include_imperatives: true  # "Please provide...", "Submit...", "Clarify..."
            exclude_administrative: true  # Filter out admin tasks
            detect_qa_format: true    # Recognize "Question X:" patterns
            detect_action_items: true  # "Action Item:", "Sponsor will..."
            fda_question_patterns: true  # "Does the Agency agree...", "FDA recommends..."
          file_include_patterns:
            - '*.pdf'
          priority: 5
        - type: DateExtractor
          config:
            formats: ['MM/DD/YYYY', 'YYYY-MM-DD', 'Month DD, YYYY', 'Month DD YYYY']
            extract_from_filename: true
            extract_from_content: true
            extract_meeting_dates: true
            extract_deadlines: true  # "Due Date:", "by [date]"
          file_include_patterns:
            - '*.pdf'
          priority: 8
        - type: EntityExtractor
          config:
            entity_types: ['PERSON', 'ORG', 'DATE', 'REQUIREMENT', 'REFERENCE_ID']
            extract_attendees: true    # From meeting minutes
            extract_sponsors: true     # Company names
            extract_fda_divisions: true  # FDA organizational units
            extract_application_numbers: true  # IND numbers, NDA numbers
          file_include_patterns:
            - '*.pdf'
          priority: 7
        - type: KeywordExtractor
          config:
            algorithm: yake
            max_keywords: 20
            min_keyword_length: 3
            fda_specific: true        # FDA-specific terms
            extract_regulatory_terms: true  # 505(b)(2), PREA, BTD, SPA, etc.
          file_include_patterns:
            - '*.pdf'
          priority: 10

    # NEW: FDA Email Answer Search Strategy
    - name: fda_email_answer_processor
      description: Processes email threads for answer retrieval
      parsers:
        - type: EmailParser
          config:
            chunk_size: 600          # Larger chunks for answer context
            chunk_overlap: 150
            chunk_strategy: email_message
            extract_email_headers: true
            preserve_threading: true
            encoding: utf-8
          file_include_patterns:
            - '*.txt'
            - '*.eml'
          priority: 15
      extractors:
        - type: EmailMetadataExtractor
          config:
            extract_sender: true
            extract_recipient: true
            extract_subject: true
            extract_date: true
          file_include_patterns:
            - '*.txt'
            - '*.eml'
          priority: 5
        - type: KeywordExtractor
          config:
            algorithm: yake
            max_keywords: 15
            min_keyword_length: 3
          file_include_patterns:
            - '*.txt'
          priority: 10

    # NEW: FDA PDF Answer Search Strategy
    - name: fda_pdf_answer_processor
      description: Processes FDA PDFs for answer retrieval with standard chunking
      parsers:
        - type: PDFParser
          config:
            chunk_size: 800          # Larger chunks for context
            chunk_overlap: 200
            chunk_strategy: paragraphs
            extract_metadata: true
            extract_page_numbers: true
            extract_sections: true
          file_include_patterns:
            - '*.pdf'
          priority: 10
      extractors:
        - type: PDFStructureExtractor
          config:
            extract_document_type: true
            extract_reference_id: true
            extract_sections: true
          file_include_patterns:
            - '*.pdf'
          priority: 3
        - type: DateExtractor
          config:
            formats: ['MM/DD/YYYY', 'YYYY-MM-DD', 'Month DD, YYYY']
            extract_from_filename: true
            extract_from_content: true
          file_include_patterns:
            - '*.pdf'
          priority: 8
        - type: KeywordExtractor
          config:
            algorithm: yake
            max_keywords: 15
            min_keyword_length: 3
          file_include_patterns:
            - '*.pdf'
          priority: 10
        - type: ContentStatisticsExtractor
          config:
            include_readability: true
            include_vocabulary: true
          file_include_patterns:
            - '*.pdf'
          priority: 20
```

### Sample Document Analysis

**Based on the two sample files provided:**

**Sample 1: Email Thread (message.txt)**
- **Type:** Email correspondence
- **Format:** Plain text with email headers
- **Key characteristics:**
  - Multiple threaded messages
  - Clear From/To/Subject/Date headers
  - Request-response pattern visible
  - **Example question found:** "Would it be possible to request an extra 90 days for us to adequately prepare the necessary submission?"
  - **Example answer found:** "Sure, you can have an extra 90 days to prepare the submission."
  - Document shows clear question→answer pairing in the same thread

**Sample 2: Meeting Minutes PDF (IND 113695 Meeting Minutes)**
- **Type:** Formal FDA meeting minutes
- **Format:** Structured PDF with sections, subsections, and Q&A format
- **Key characteristics:**
  - Structured sections: Background, Discussion, FDA Comments, Action Items
  - Multiple question-answer pairs in formal format
  - Rich metadata: IND number, meeting date, attendees, locations
  - Regulatory references (CFR citations, 505(b)(2), PREA, etc.)
  - **Example questions found:**
    - "Does the Agency agree that the ADME study is sufficient to support registration of the product?"
    - "Does the Agency concur that drug-drug interaction studies are not needed?"
    - "Does the Agency agree that pediatric data is not required in the NDA submission?"
  - **Example answers found:**
    - "FDA Preliminary Comment: The ADME study appears adequately designed..."
    - "Yes, FDA agrees." (for pediatric data question)
  - Multiple question types: Yes/No questions, clarification requests, agreement seeking
  - Action items with deadlines and responsibilities

**Patterns to Detect:**

1. **Question patterns in emails:**
   - "Would it be possible to..."
   - "Can you tell me..."
   - "requesting an extra..."
   - Questions embedded in conversational text

2. **Question patterns in meeting minutes:**
   - Numbered questions (e.g., "1. Does the Agency agree...")
   - "Does the Agency concur/agree..."
   - "FDA Preliminary Comment" (these often address implicit questions)
   - Section headers followed by questions

3. **Answer patterns:**
   - Direct responses: "Yes, FDA agrees."
   - "FDA Preliminary Comment:" followed by detailed response
   - Structured responses with subsections (a, b, c)
   - Action items that imply agreement/disagreement

4. **Administrative vs. Real Questions:**
   - **Administrative (EXCLUDE):**
     - "Thank you for your submission"
     - Acknowledgments of receipt
     - Meeting logistics
   - **Real Questions (INCLUDE):**
     - Requests for data/studies
     - Questions about regulatory requirements
     - Clarifications on approval pathways
     - Questions seeking FDA agreement

### Custom Extractors to Implement

**1. EmailParser (NEW)**
- Parses email headers (From, To, Sent, Subject)
- Detects email message boundaries in threads
- Preserves threading structure
- Handles multiple date formats in email headers
- Extracts email signature information

**2. EmailMetadataExtractor (NEW)**
- Extracts sender/recipient from email headers
- Extracts subject line
- Parses email dates in multiple formats
- Identifies email domains (FDA vs. company)
- Extracts CC/BCC recipients

**3. PDFStructureExtractor (NEW)**
- Detects document type (meeting minutes, letter, report, guidance)
- Extracts IND/NDA/BLA numbers from headers
- Extracts meeting metadata (date, location, attendees)
- Identifies section structure (Background, Discussion, Action Items)
- Extracts reference IDs and document numbers

**4. QuestionExtractor (ENHANCED)**
- Detects interrogative sentences (?, who, what, when, where, why, how)
- Detects imperative sentences (please provide, submit, clarify, explain)
- **NEW: Email-specific patterns:**
  - "Would it be possible to..."
  - "Can you tell me..."
  - "I would like to request..."
  - "requesting an extra..."
- **NEW: FDA-specific patterns:**
  - "Does the Agency agree..."
  - "Does the Agency concur..."
  - "Does FDA agree..."
- **NEW: Q&A format detection:**
  - Numbered questions (1., 2., etc.)
  - "Question:" followed by text
  - "Sponsor's Question:" patterns
- Filters out administrative/procedural questions
- Classifies question type (information request, clarification, compliance, agreement-seeking)
- Extracts confidence score
- **NEW: Context awareness:**
  - Understands questions in email threads
  - Recognizes formal Q&A structure in meeting minutes
  - Detects implied questions in "FDA Preliminary Comment" sections

**5. Enhanced DateExtractor**
- Extracts dates from document content
- Extracts dates from filenames (common FDA practice)
- Supports multiple date formats:
  - Email format: "Wed, 21 Sep 2016 14:41:15 -0700"
  - Standard: "MM/DD/YYYY", "YYYY-MM-DD"
  - Written: "Month DD, YYYY"
- Disambiguates relative dates ("within 30 days", "extra 90 days")
- Extracts meeting dates
- Extracts deadlines and due dates

**6. Enhanced EntityExtractor**
- Extracts sender/recipient names (from emails and meeting attendees)
- Extracts organizational entities:
  - FDA divisions (e.g., "Division of Oncology Products 2")
  - Companies (e.g., "CytRx Corporation")
  - Consulting firms (e.g., "Hurley Consulting Associates")
- Extracts regulatory references:
  - CFR citations (e.g., "21 CFR 314.54")
  - Regulatory pathways (e.g., "505(b)(2)", "PREA")
  - Application numbers (e.g., "IND 113695", "NDA XXXXXX")
- Extracts meeting metadata (attendees, roles, affiliations)
- Extracts deadlines and requirements

---

## 5. Agent Architecture

### Agent 1: FDA Question Extractor

**Purpose:** Analyze each document in Dataset 1 to extract all FDA questions and tasks

**Input:**
- Document from `fda_questions_db`
- Document metadata (filename, date, etc.)

**Process:**
1. **Retrieve all chunks** from the document (grouped by document_id)
2. **Pass chunks to LLM** with specialized prompt:
   ```
   You are an FDA regulatory analyst. Analyze this document and extract ALL questions,
   requests, and tasks directed to the recipient. Ignore administrative formalities.

   For each question/task:
   - Extract the exact text
   - Classify type (information request, clarification, compliance requirement, etc.)
   - Identify deadline (if mentioned)
   - Rate urgency (low, medium, high, critical)
   - Provide confidence score (0-1)

   Output as JSON array with:
   {
     "question_text": "...",
     "question_type": "information_request",
     "deadline": "2023-05-15",
     "urgency": "high",
     "confidence": 0.92,
     "chunk_id": "...",
     "page_number": 3
   }
   ```

3. **Post-process results:**
   - Deduplicate similar questions within the same document (using semantic similarity)
   - Merge metadata from extractors
   - Store results in structured format

**Output:**
- List of extracted questions with full metadata
- Stored in Results Database (see section 9)

**LlamaFarm Agent Configuration:**

```yaml
agents:
  - name: fda_question_extractor
    description: Extracts questions and tasks from FDA documents
    type: custom
    model: default  # qwen3:1.7B
    temperature: 0.3
    max_tokens: 1500
    system_prompt: |
      You are an FDA regulatory analyst with expertise in identifying questions,
      requests, and compliance tasks in FDA correspondence.

      Focus on:
      - Direct questions (interrogative sentences)
      - Implicit requests ("Please provide...", "We need clarification on...")
      - Compliance requirements ("Submit data showing...", "Explain how...")
      - Follow-up items from meetings

      Ignore:
      - Administrative formalities ("Thank you for your submission...")
      - Acknowledgments and routine confirmations
      - Standard disclaimer text
    output_format: json
    tools:
      - rag_query  # Can query fda_questions_db for context
    max_iterations: 1  # No multi-hop needed, single pass

  - name: answer_matcher
    description: Matches extracted questions to potential answers in other documents
    type: custom
    model: default  # qwen3:1.7B
    temperature: 0.3
    max_tokens: 2000
    system_prompt: |
      You are an FDA regulatory analyst. Given a question from one document,
      you will receive excerpts from other documents that might contain answers.

      Your task:
      1. Determine if any excerpt fully or partially answers the question
      2. Rate confidence (0-1) that this is a valid answer
      3. Explain why this excerpt matches (or doesn't match)
      4. Extract the specific answer text

      Be strict: only mark as "answered" if there's clear evidence.
      Partial answers should be flagged as "partial" with confidence score.
    output_format: json
    tools:
      - rag_query  # Queries fda_answers_db
    max_iterations: 1
```

### Agent 2: Answer Matcher

**Purpose:** For each extracted question, search Dataset 2 to find potential answers

**Input:**
- Extracted question (with metadata)
- Access to `fda_answers_db`

**Process:**
1. **Generate search queries** from the question:
   - Original question text
   - Reformulated as declarative statement
   - Key entity mentions (drug name, submission number, etc.)

2. **Query RAG system** (`fda_answers_db`):
   - Top-K retrieval (K=15)
   - Score threshold (0.6)
   - Exclude source document (don't match question to itself)

3. **LLM Analysis:**
   - Pass question + retrieved chunks to LLM
   - LLM determines if any chunk answers the question
   - Provides confidence score (0-1)
   - Extracts answer text if found
   - Classifies as: "answered", "partially_answered", "unanswered"

4. **Result compilation:**
   - Link question to answer document(s)
   - Store confidence scores
   - Preserve all metadata from both question and answer

**Output:**
- Question-Answer pairs (with confidence)
- Unanswered questions list
- Stored in Results Database

**Workflow:**

```
Question: "Please provide stability data for the 24-month timepoint"

        ↓ (Generate search queries)

Queries:
  - "stability data 24 month timepoint"
  - "24-month stability study results"
  - "long-term stability testing 24 months"

        ↓ (RAG search in fda_answers_db)

Retrieved Chunks (top 15):
  [1] "Stability testing at 24 months showed..." (score: 0.89)
  [2] "Long-term stability data through month 24..." (score: 0.85)
  [3] "Our stability program includes..." (score: 0.72)
  ...

        ↓ (LLM Analysis)

Result:
  {
    "status": "answered",
    "confidence": 0.92,
    "answer_document": "Response_Letter_2023_05_20.pdf",
    "answer_page": 7,
    "answer_chunk_id": "chunk_123",
    "answer_text": "Stability testing at 24 months showed...",
    "explanation": "Document explicitly provides 24-month stability data"
  }
```

---

## 6. UI/UX Design

### New UI Components

**1. Dataset Management Panel**

Location: New page `/datasets` or expanded sidebar

Components:
- **Dataset Cards** (2 cards side-by-side):
  ```
  ┌─────────────────────────────────────────────┐
  │ Dataset 1: Question Extraction              │
  │ Status: ● Ready                             │
  │ Documents: 247 / 600                        │
  │ Processing: ████████░░ 80%                  │
  │ [Add Files] [Process] [View Details]        │
  └─────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────┐
  │ Dataset 2: Answer Search                    │
  │ Status: ● Processing                        │
  │ Documents: 589 / 600                        │
  │ Processing: ████████████ 98%                │
  │ [Add Files] [Process] [View Details]        │
  └─────────────────────────────────────────────┘
  ```

- **Directory Picker:**
  - Native OS file/folder picker
  - Support for selecting multiple directories
  - Display selected paths before upload
  - File count and size estimates
  - "Upload All" button

- **Processing Progress:**
  - Real-time progress bar
  - Current file being processed
  - Estimated time remaining
  - Worker status (active/idle)

**2. Analysis Control Panel**

Location: Main dashboard after datasets are ready

Components:
- **Status Indicator:**
  ```
  ┌─────────────────────────────────────────────┐
  │ System Status                               │
  │ ✓ Dataset 1: Ready (247 documents)         │
  │ ✓ Dataset 2: Ready (589 documents)         │
  │ ✓ Agents: Initialized                       │
  │ ✓ LlamaFarm: Connected                      │
  └─────────────────────────────────────────────┘
  ```

- **Conduct Search Button:**
  ```
  ┌─────────────────────────────────────────────┐
  │         [🔍 Conduct FDA Analysis]            │
  │                                             │
  │  This will:                                 │
  │  1. Extract questions from all documents   │
  │  2. Search for answers across corpus       │
  │  3. Generate results report                │
  │                                             │
  │  Estimated time: 2-3 hours for 600 docs    │
  └─────────────────────────────────────────────┘
  ```

- **Live Progress Tracker:**
  ```
  ┌─────────────────────────────────────────────┐
  │ Analysis Progress                           │
  │                                             │
  │ Step 1: Extracting Questions                │
  │ ████████████████░░░░ 80% (198/247 docs)   │
  │ Current: "FDA_Letter_2023_04_15.pdf"       │
  │                                             │
  │ Questions extracted so far: 1,247          │
  │ Estimated completion: 25 minutes            │
  └─────────────────────────────────────────────┘
  ```

**3. Results Dashboard**

Location: Main page after analysis completes

Components:
- **Summary Cards:**
  ```
  ┌──────────────────┬──────────────────┬──────────────────┐
  │ Total Questions  │ Answered         │ Unanswered       │
  │      1,847       │   1,234 (67%)    │    613 (33%)     │
  └──────────────────┴──────────────────┴──────────────────┘
  ```

- **Filterable Results Table:**
  ```
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Filters: [All] [Answered] [Unanswered] [Partial]                    │
  │ Sort by: [Date ▼] | Search: [_________________] [Export CSV]        │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Question | Source Doc | Page | Answer Doc | Page | Confidence | Date│
  ├─────────────────────────────────────────────────────────────────────┤
  │ "Please │ Letter_    │  3   │ Response_  │  7   │   92%      │ ... │
  │ provide │ 2023_04_   │      │ 2023_05_   │      │            │     │
  │ stabil- │ 15.pdf"    │      │ 20.pdf"    │      │   ● Full   │     │
  │ ity..."  │            │      │            │      │            │     │
  ├─────────────────────────────────────────────────────────────────────┤
  │ "Clarify│ Meeting_   │  12  │ --         │  --  │   --       │ ... │
  │ the     │ Minutes_   │      │            │      │            │     │
  │ dosing  │ 2023_03_   │      │ (No answer │      │ ○ None     │     │
  │ ..."    │ 10.pdf"    │      │  found)    │      │            │     │
  ├─────────────────────────────────────────────────────────────────────┤
  ```

- **Detail View (expandable row):**
  ```
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Question Details                                                     │
  │                                                                      │
  │ Full Text:                                                           │
  │ "Please provide stability data for the 24-month timepoint,          │
  │  including temperature variations and humidity conditions."         │
  │                                                                      │
  │ Source: FDA_Letter_2023_04_15.pdf, Page 3, Chunk ID: chunk_0045    │
  │ Date: April 15, 2023                                                │
  │ Type: Information Request                                            │
  │ Urgency: High                                                        │
  │                                                                      │
  │ Answer Found:                                                        │
  │ "Stability testing at 24 months showed no degradation under         │
  │  accelerated conditions (40°C/75% RH). Results attached in Table 7."│
  │                                                                      │
  │ Answer Source: Response_Letter_2023_05_20.pdf, Page 7, chunk_0123  │
  │ Confidence: 92%                                                      │
  │ Match Explanation: "Document explicitly addresses 24-month          │
  │ stability data with temperature and humidity specifications."       │
  │                                                                      │
  │ [View Source PDF] [View Answer PDF] [Mark as Incorrect]            │
  └─────────────────────────────────────────────────────────────────────┘
  ```

- **Export Options:**
  - Export to CSV (spreadsheet-friendly)
  - Export to JSON (programmatic access)
  - Export to PDF report (human-readable)
  - Filter exports by status (all, answered, unanswered)

**4. Settings/Configuration**

New settings for FDA analysis:
- Question extraction confidence threshold (0.5 - 0.9)
- Answer matching confidence threshold (0.6 - 0.95)
- Exclude administrative questions (toggle)
- Top-K for answer retrieval (5-20)
- Enable/disable specific question types

---

## 7. LlamaFarm API Integration

### API Endpoints to Use

**Dataset Management:**

```typescript
// Create dataset
POST /v1/projects/{namespace}/{project}/datasets
Body: {
  name: "fda_questions_set",
  data_processing_strategy: "fda_question_processor",
  database: "fda_questions_db"
}

// Ingest files
POST /v1/projects/{namespace}/{project}/datasets/{dataset_name}/ingest
Body: {
  files: [
    { path: "/path/to/file1.pdf", ... },
    { path: "/path/to/file2.pdf", ... }
  ]
}

// Start processing
POST /v1/projects/{namespace}/{project}/datasets/{dataset_name}/process
Body: {
  async: true  // Run in background
}

// Check processing status
GET /v1/projects/{namespace}/{project}/datasets/{dataset_name}/status
Response: {
  status: "processing",
  progress: 0.75,
  processed_count: 450,
  total_count: 600,
  estimated_time_remaining: 1800  // seconds
}

// List datasets
GET /v1/projects/{namespace}/{project}/datasets
```

**Agent Execution:**

```typescript
// Run question extraction agent
POST /v1/projects/{namespace}/{project}/agents/run
Body: {
  agent_name: "fda_question_extractor",
  input: {
    document_id: "doc_12345",
    database: "fda_questions_db"
  },
  async: true
}

// Check agent status
GET /v1/projects/{namespace}/{project}/agents/{task_id}/status
Response: {
  status: "completed",
  result: {
    questions: [...],
    metadata: {...}
  }
}

// Run answer matcher agent
POST /v1/projects/{namespace}/{project}/agents/run
Body: {
  agent_name: "answer_matcher",
  input: {
    question: {...},
    search_database: "fda_answers_db",
    exclude_doc_id: "doc_12345"  // Don't match to source doc
  }
}
```

**RAG Queries:**

```typescript
// Query for answers
POST /v1/projects/{namespace}/{project}/rag/query
Body: {
  query: "stability data 24 month timepoint",
  database: "fda_answers_db",
  top_k: 15,
  score_threshold: 0.6,
  exclude_doc_ids: ["doc_12345"]  // Optional filter
}

Response: {
  results: [
    {
      content: "Stability testing at 24 months...",
      score: 0.89,
      metadata: {
        document_id: "doc_67890",
        document_name: "Response_Letter_2023_05_20.pdf",
        page: 7,
        chunk_id: "chunk_0123",
        date: "2023-05-20"
      }
    },
    ...
  ]
}
```

**Health Check:**

```typescript
// Check LlamaFarm health
GET /v1/health
Response: {
  status: "ok",
  version: "1.0.0",
  services: {
    api: "healthy",
    celery: "healthy",
    chroma: "healthy",
    ollama: "healthy"
  }
}
```

### Frontend API Client

**New file: `lib/lf-datasets.ts`**

```typescript
export interface Dataset {
  name: string;
  database: string;
  strategy: string;
  status: 'ready' | 'processing' | 'error';
  document_count: number;
  processing_progress?: number;
}

export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  processed_count: number;
  total_count: number;
  current_file?: string;
  estimated_time_remaining?: number;
}

export async function createDataset(
  name: string,
  strategy: string,
  database: string
): Promise<Dataset> {
  // Implementation
}

export async function ingestFiles(
  datasetName: string,
  files: File[]
): Promise<{ success: boolean; file_ids: string[] }> {
  // Implementation
}

export async function processDataset(
  datasetName: string
): Promise<{ task_id: string }> {
  // Implementation
}

export async function getProcessingStatus(
  datasetName: string
): Promise<ProcessingStatus> {
  // Implementation with polling
}

export async function listDatasets(): Promise<Dataset[]> {
  // Implementation
}
```

**New file: `lib/lf-agents.ts`**

```typescript
export interface QuestionExtractionResult {
  document_id: string;
  questions: ExtractedQuestion[];
}

export interface ExtractedQuestion {
  question_text: string;
  question_type: string;
  deadline?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  chunk_id: string;
  page_number?: number;
  metadata: Record<string, any>;
}

export interface AnswerMatchResult {
  question_id: string;
  status: 'answered' | 'partially_answered' | 'unanswered';
  confidence: number;
  answer_document_id?: string;
  answer_text?: string;
  answer_metadata?: Record<string, any>;
  explanation: string;
}

export async function runQuestionExtractor(
  documentId: string
): Promise<QuestionExtractionResult> {
  // Call LlamaFarm agent API
}

export async function runAnswerMatcher(
  question: ExtractedQuestion
): Promise<AnswerMatchResult> {
  // Call LlamaFarm agent API
}

export async function runBatchAnalysis(
  datasetName: string
): Promise<{ task_id: string }> {
  // Kick off batch processing for all documents
}

export async function getBatchAnalysisStatus(
  taskId: string
): Promise<{
  status: string;
  progress: number;
  results?: AnalysisResults;
}> {
  // Poll for batch analysis status
}
```

---

## 8. Implementation Phases

### Phase 1: Infrastructure Setup (Week 1)

**Goals:**
- Set up dual-dataset architecture
- Configure LlamaFarm with new databases and strategies
- Implement custom extractors

**Tasks:**
1. Update `llamafarm.yaml` with new databases and strategies
2. Implement custom extractors:
   - `QuestionExtractor` (Python class in `rag/extractors/`)
   - Enhanced `DateExtractor`
   - Enhanced `EntityExtractor`
3. Test dataset creation and ingestion with sample files (10-20 PDFs)
4. Verify embeddings and chunking strategies
5. Set up development database (ChromaDB collections)

**Deliverables:**
- Updated `llamafarm.yaml`
- Custom extractor implementations
- Test scripts for dataset operations
- Documentation of extractor outputs

**Testing:**
- Ingest 20 sample FDA documents into both datasets
- Verify metadata extraction (dates, entities, etc.)
- Check chunk sizes and overlap
- Inspect embeddings in ChromaDB

---

### Phase 2: Agent Development (Week 2)

**Goals:**
- Implement FDA Question Extractor agent
- Implement Answer Matcher agent
- Test agents on sample documents

**Tasks:**
1. Create agent configurations in `llamafarm.yaml`
2. Develop agent prompts and logic:
   - Question extraction prompt engineering
   - Answer matching prompt engineering
3. Implement agent execution endpoints (if not already available in LlamaFarm)
4. Create agent test suite:
   - Unit tests for question detection
   - Integration tests with sample documents
   - Edge case testing (complex questions, multi-part questions)
5. Benchmark agent performance (accuracy, speed)

**Deliverables:**
- Two fully functional agents
- Agent configuration files
- Test suite with >90% accuracy on sample set
- Performance benchmarks

**Testing:**
- Extract questions from 50 sample documents
- Manually verify question extraction accuracy
- Test answer matching with known question-answer pairs
- Measure agent runtime and resource usage

---

### Phase 3: Backend API Integration (Week 3)

**Goals:**
- Create Next.js API routes for dataset management
- Create API routes for agent orchestration
- Implement result storage and retrieval

**Tasks:**
1. Create API routes:
   - `/api/datasets/create`
   - `/api/datasets/ingest`
   - `/api/datasets/process`
   - `/api/datasets/status`
   - `/api/analysis/start` (triggers full analysis)
   - `/api/analysis/status` (polling endpoint)
   - `/api/results/list` (get all results)
   - `/api/results/export` (CSV/JSON/PDF export)

2. Implement LlamaFarm client wrappers:
   - `lib/lf-datasets.ts` (dataset operations)
   - `lib/lf-agents.ts` (agent execution)
   - `lib/lf-results.ts` (results storage/retrieval)

3. Set up results storage:
   - Option 1: Local JSON files
   - Option 2: SQLite database (lightweight, serverless)
   - Option 3: PostgreSQL (if scaling needed)

4. Implement polling mechanism for long-running operations

**Deliverables:**
- Complete API route implementations
- LlamaFarm client libraries
- Results storage system
- API documentation

**Testing:**
- Test each API endpoint with Postman/curl
- Test error handling and edge cases
- Test polling mechanism with long-running tasks
- Load test with 100+ documents

---

### Phase 4: Frontend UI Development (Week 4-5)

**Goals:**
- Build dataset management interface
- Build analysis control panel
- Build results dashboard

**Tasks:**
1. **Dataset Management UI:**
   - Create `/datasets` page
   - Implement directory picker component
   - Build dataset cards with status indicators
   - Implement file upload with progress tracking
   - Add processing status monitoring

2. **Analysis Control Panel:**
   - Create analysis dashboard
   - Build "Conduct Search" button with confirmation modal
   - Implement live progress tracker
   - Add step-by-step status indicators

3. **Results Dashboard:**
   - Build summary cards (total/answered/unanswered)
   - Create filterable results table
   - Implement expandable detail views
   - Add export functionality (CSV/JSON/PDF)
   - Build PDF viewer integration (optional)

4. **State Management:**
   - Set up React Context or Zustand for global state
   - Manage dataset state
   - Manage analysis state
   - Cache results for fast access

5. **Error Handling & UX:**
   - Add loading states
   - Implement error boundaries
   - Add user notifications (toast messages)
   - Handle network failures gracefully

**Deliverables:**
- Complete UI implementation
- Responsive design (desktop + tablet)
- User-friendly error messages
- Export functionality

**Testing:**
- Manual UI testing on different browsers
- Test file upload with various file sizes
- Test table performance with 1000+ results
- Test export functionality

---

### Phase 5: Integration & End-to-End Testing (Week 6)

**Goals:**
- Integrate all components
- Conduct full end-to-end testing
- Performance optimization

**Tasks:**
1. **Integration Testing:**
   - Test full workflow: Upload → Process → Analyze → View Results
   - Test with small dataset (50 documents)
   - Test with medium dataset (200 documents)
   - Identify bottlenecks

2. **Performance Optimization:**
   - Optimize LLM prompts for speed
   - Implement parallel processing where possible
   - Add caching for repeated operations
   - Optimize database queries

3. **Error Handling:**
   - Test failure scenarios (LlamaFarm down, network errors, etc.)
   - Implement retry logic for transient failures
   - Add recovery mechanisms for interrupted processes

4. **User Acceptance Testing:**
   - Have stakeholders test the system
   - Gather feedback on UI/UX
   - Iterate based on feedback

**Deliverables:**
- Fully integrated system
- Performance benchmarks
- User testing feedback
- Bug fixes

---

### Phase 6: Production Deployment & Documentation (Week 7)

**Goals:**
- Deploy to production environment
- Create comprehensive documentation
- Train users

**Tasks:**
1. **Deployment:**
   - Set up production LlamaFarm instance
   - Configure production ChromaDB
   - Deploy Next.js application
   - Set up monitoring and logging

2. **Documentation:**
   - User guide (how to use the system)
   - Admin guide (how to manage datasets)
   - Developer guide (how to extend the system)
   - API documentation
   - Troubleshooting guide

3. **Training:**
   - Create video walkthrough
   - Conduct live training session
   - Prepare FAQ document

**Deliverables:**
- Production deployment
- Complete documentation
- Training materials

---

## 9. Technical Specifications

### System Requirements

**Development Environment:**
- Node.js 18+
- Docker 20+
- Python 3.10+ (for LlamaFarm)
- 16GB RAM minimum (32GB recommended for 600 documents)
- 50GB disk space (for datasets and models)

**Production Environment:**
- Same as development, but:
  - 32GB RAM minimum
  - 100GB disk space
  - SSD recommended for ChromaDB performance

### Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React Query (for data fetching/caching)
- Zustand or React Context (state management)
- PDF.js (PDF viewing, optional)

**Backend:**
- LlamaFarm (FastAPI)
- ChromaDB (vector database)
- Celery (task queue)
- Redis (Celery broker)
- Ollama (LLM runtime)

**Models:**
- `gemma3:1b` or `qwen3:1.7B` (question extraction)
- `qwen3:1.7B` or `qwen3:8B` (answer matching)
- `nomic-embed-text` (embeddings)

**Storage:**
- SQLite (results database) - recommended for simplicity
- OR PostgreSQL (if scaling needed)
- File system (uploaded PDFs)

### Data Schema

**Results Database Schema (SQLite):**

```sql
-- Extracted Questions Table
CREATE TABLE extracted_questions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  page_number INTEGER,
  chunk_id TEXT,
  question_text TEXT NOT NULL,
  question_type TEXT,
  deadline TEXT,
  urgency TEXT,
  confidence REAL,
  extracted_date TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

-- Answer Matches Table
CREATE TABLE answer_matches (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- answered, partially_answered, unanswered
  confidence REAL,
  answer_document_id TEXT,
  answer_document_name TEXT,
  answer_page_number INTEGER,
  answer_chunk_id TEXT,
  answer_text TEXT,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (question_id) REFERENCES extracted_questions(id)
);

-- Processing Jobs Table
CREATE TABLE processing_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,  -- question_extraction, answer_matching
  status TEXT NOT NULL,  -- pending, running, completed, failed
  progress REAL DEFAULT 0,
  total_items INTEGER,
  processed_items INTEGER,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Indexes for performance
CREATE INDEX idx_questions_document ON extracted_questions(document_id);
CREATE INDEX idx_questions_type ON extracted_questions(question_type);
CREATE INDEX idx_answers_question ON answer_matches(question_id);
CREATE INDEX idx_answers_status ON answer_matches(status);
```

**TypeScript Types:**

```typescript
// lib/types.ts

export interface ExtractedQuestion {
  id: string;
  document_id: string;
  document_name: string;
  page_number?: number;
  chunk_id: string;
  question_text: string;
  question_type: 'information_request' | 'clarification' | 'compliance' | 'other';
  deadline?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  extracted_date: string;
  metadata: Record<string, any>;
}

export interface AnswerMatch {
  id: string;
  question_id: string;
  status: 'answered' | 'partially_answered' | 'unanswered';
  confidence: number;
  answer_document_id?: string;
  answer_document_name?: string;
  answer_page_number?: number;
  answer_chunk_id?: string;
  answer_text?: string;
  explanation: string;
  metadata: Record<string, any>;
}

export interface AnalysisResult {
  question: ExtractedQuestion;
  answer: AnswerMatch;
}

export interface AnalysisSummary {
  total_questions: number;
  answered: number;
  partially_answered: number;
  unanswered: number;
  average_confidence: number;
  processing_time: number;
}
```

### Performance Targets

**Question Extraction:**
- Time per document: 10-30 seconds (depending on length)
- Accuracy: >85% precision, >90% recall
- Throughput: 2-4 documents/minute (single worker)
- Parallelization: 4-8 workers for 600 documents (~2-3 hours)

**Answer Matching:**
- Time per question: 5-15 seconds (depending on corpus size)
- Accuracy: >80% correct matches
- Top-K retrieval: 15 candidates per question
- Parallelization: 8-16 workers

**Total System Performance:**
- Full analysis of 600 documents: 3-5 hours (with 8 workers)
- Question extraction: 1-2 hours
- Answer matching: 2-3 hours (assuming ~1500 questions)

**UI Performance:**
- Initial page load: <2 seconds
- Results table render (1000 rows): <1 second
- Export to CSV: <5 seconds
- Real-time status updates: Every 2-5 seconds (polling)

---

## 10. Testing Strategy

### Unit Tests

**Backend (Python):**
- Custom extractors (QuestionExtractor, DateExtractor, EntityExtractor)
- Agent logic (question extraction, answer matching)
- API endpoint handlers
- Database operations

**Frontend (TypeScript):**
- LlamaFarm client functions
- Data transformation utilities
- Result filtering and sorting logic
- Export functions

### Integration Tests

- Dataset creation and ingestion workflow
- End-to-end agent execution
- API route → LlamaFarm → API response flow
- File upload → processing → results retrieval

### End-to-End Tests

**Scenario 1: Small Dataset (20 documents)**
- Upload 20 FDA documents
- Process both datasets
- Run full analysis
- Verify results accuracy
- Test export functionality

**Scenario 2: Medium Dataset (100 documents)**
- Test performance with larger corpus
- Monitor resource usage
- Verify no memory leaks
- Check database performance

**Scenario 3: Full Dataset (600 documents)**
- Production-scale test
- Measure total processing time
- Test system stability over long run
- Verify results consistency

### User Acceptance Testing

- Have domain experts review extracted questions
- Verify answer matches are accurate
- Test UI usability
- Gather feedback on result presentation

---

## 11. Timeline & Milestones

### Week 1: Infrastructure Setup
- [ ] Update llamafarm.yaml
- [ ] Implement custom extractors
- [ ] Test dataset operations
- [ ] Verify embeddings

**Milestone:** Dual-dataset architecture functional

### Week 2: Agent Development
- [ ] Implement Question Extractor agent
- [ ] Implement Answer Matcher agent
- [ ] Create test suite
- [ ] Benchmark performance

**Milestone:** Agents functional with >85% accuracy

### Week 3: Backend API Integration
- [ ] Create API routes
- [ ] Implement LlamaFarm clients
- [ ] Set up results storage
- [ ] Implement polling

**Milestone:** Complete backend API ready

### Week 4-5: Frontend UI Development
- [ ] Dataset management UI
- [ ] Analysis control panel
- [ ] Results dashboard
- [ ] Export functionality

**Milestone:** Complete UI implementation

### Week 6: Integration & Testing
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] User acceptance testing

**Milestone:** Production-ready system

### Week 7: Deployment & Documentation
- [ ] Production deployment
- [ ] User documentation
- [ ] Training materials
- [ ] Go-live

**Milestone:** System in production

---

## Appendix A: Sample Prompts

### Question Extraction Prompt

```
You are an FDA regulatory analyst. Analyze the following FDA document excerpt and extract ALL questions, requests, and compliance tasks.

DOCUMENT METADATA:
- Document Name: {document_name}
- Page: {page_number}
- Date: {document_date}

DOCUMENT TEXT:
{document_text}

INSTRUCTIONS:
1. Identify all questions (sentences ending with "?")
2. Identify all requests (e.g., "Please provide...", "Submit...", "Clarify...")
3. Identify all compliance requirements (e.g., "You must...", "It is required...")
4. IGNORE administrative formalities and acknowledgments

For each question/task, extract:
- Exact text
- Type: information_request, clarification, compliance, or other
- Deadline (if mentioned, in YYYY-MM-DD format)
- Urgency: low, medium, high, or critical
- Confidence: 0.0 to 1.0 (how confident are you this is a real question/task?)

OUTPUT FORMAT (JSON array):
[
  {
    "question_text": "Please provide stability data for the 24-month timepoint",
    "question_type": "information_request",
    "deadline": "2023-06-30",
    "urgency": "high",
    "confidence": 0.95,
    "context": "Section discussing long-term stability requirements"
  },
  ...
]

If no questions/tasks found, return empty array: []
```

### Answer Matching Prompt

```
You are an FDA regulatory analyst. Determine if any of the provided document excerpts answer the following question.

QUESTION:
{question_text}

QUESTION METADATA:
- Source Document: {question_source_doc}
- Date: {question_date}
- Type: {question_type}

CANDIDATE ANSWER EXCERPTS:
{retrieved_excerpts}

INSTRUCTIONS:
1. Read each excerpt carefully
2. Determine if any excerpt fully or partially answers the question
3. If multiple excerpts provide answers, choose the best one
4. Be strict: only mark as "answered" if there's clear, direct evidence

OUTPUT FORMAT (JSON):
{
  "status": "answered" | "partially_answered" | "unanswered",
  "confidence": 0.0 - 1.0,
  "answer_excerpt_index": 2,  // which excerpt (0-indexed), or null
  "answer_text": "Direct quote from the excerpt that answers the question",
  "explanation": "Why this excerpt answers (or doesn't answer) the question"
}

EXAMPLES:

Question: "Please provide stability data for 24 months"
Excerpt: "Stability testing at 24 months showed no degradation..."
Result: {"status": "answered", "confidence": 0.95, ...}

Question: "Clarify the dosing regimen for pediatric patients"
Excerpt: "Our study included adult patients aged 18-65..."
Result: {"status": "unanswered", "confidence": 0.0, ...}

Question: "Explain the manufacturing process changes"
Excerpt: "We made several changes to the process, including..."
Result: {"status": "partially_answered", "confidence": 0.7, ...}
```

---

## Appendix B: File Structure

```
FDA-Records-Agent/
├── app/
│   ├── page.tsx                        # Main dashboard
│   ├── datasets/
│   │   └── page.tsx                    # Dataset management page
│   ├── analysis/
│   │   └── page.tsx                    # Analysis control panel
│   ├── results/
│   │   └── page.tsx                    # Results dashboard
│   └── api/
│       ├── datasets/
│       │   ├── create/route.ts
│       │   ├── ingest/route.ts
│       │   ├── process/route.ts
│       │   ├── status/route.ts
│       │   └── list/route.ts
│       ├── analysis/
│       │   ├── start/route.ts
│       │   └── status/route.ts
│       ├── results/
│       │   ├── list/route.ts
│       │   └── export/route.ts
│       ├── agent-chat/route.ts         # Keep existing
│       ├── chat/route.ts               # Keep existing
│       ├── health/route.ts             # Keep existing
│       └── rag/route.ts                # Keep existing
├── components/
│   ├── datasets/
│   │   ├── DatasetCard.tsx
│   │   ├── DirectoryPicker.tsx
│   │   ├── ProcessingProgress.tsx
│   │   └── DatasetManager.tsx
│   ├── analysis/
│   │   ├── AnalysisButton.tsx
│   │   ├── ProgressTracker.tsx
│   │   └── StatusPanel.tsx
│   ├── results/
│   │   ├── SummaryCards.tsx
│   │   ├── ResultsTable.tsx
│   │   ├── ResultDetail.tsx
│   │   ├── ExportButton.tsx
│   │   └── FilterBar.tsx
│   ├── ui/                             # Keep existing shadcn components
│   ├── chat/                           # Keep existing
│   ├── Dropzone.tsx                    # Keep existing
│   ├── HealthStatus.tsx                # Keep existing
│   └── SettingsDrawer.tsx              # Keep existing
├── lib/
│   ├── lf-datasets.ts                  # NEW: Dataset operations
│   ├── lf-agents.ts                    # NEW: Agent execution
│   ├── lf-results.ts                   # NEW: Results management
│   ├── db.ts                           # NEW: SQLite client
│   ├── pdf.ts                          # Keep existing
│   ├── chunk.ts                        # Keep existing
│   ├── rank.ts                         # Keep existing
│   ├── sse.ts                          # Keep existing
│   ├── lf.ts                           # Keep existing
│   ├── types.ts                        # Extend with new types
│   └── utils.ts                        # Keep existing
├── llamafarm.yaml                      # UPDATE with new config
├── data/
│   ├── textbooks/                      # Keep existing
│   ├── fda_documents/                  # NEW: FDA documents (gitignored)
│   └── results.db                      # NEW: SQLite database (gitignored)
├── .env.local                          # UPDATE with new variables
├── .env.local.example                  # UPDATE
├── PROJECT_OVERVIEW.md                 # UPDATE
├── README.md                           # UPDATE
└── FDA_DOCUMENT_ANALYSIS_PLAN.md      # THIS FILE
```

---

## Appendix C: Environment Variables

**Updated `.env.local.example`:**

```bash
# LlamaFarm Configuration
NEXT_PUBLIC_LF_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LF_NAMESPACE=default
NEXT_PUBLIC_LF_PROJECT=fda-records-agent

# Models
NEXT_PUBLIC_LF_MODEL=default                    # qwen3:1.7B for synthesis
NEXT_PUBLIC_LF_FAST_MODEL=fast                  # gemma3:1b for extraction

# Databases
NEXT_PUBLIC_LF_DATABASE=medical_db              # Existing medical KB
NEXT_PUBLIC_LF_QUESTIONS_DB=fda_questions_db    # NEW: Question extraction
NEXT_PUBLIC_LF_ANSWERS_DB=fda_answers_db        # NEW: Answer search

# Analysis Settings
NEXT_PUBLIC_QUESTION_CONFIDENCE_THRESHOLD=0.6   # Minimum confidence for questions
NEXT_PUBLIC_ANSWER_CONFIDENCE_THRESHOLD=0.7     # Minimum confidence for answers
NEXT_PUBLIC_RAG_TOP_K=15                        # Number of answer candidates
NEXT_PUBLIC_MAX_PARALLEL_WORKERS=8              # Concurrent processing

# Results Database
DATABASE_URL=sqlite:./data/results.db           # Local SQLite

# Optional: Polling intervals (milliseconds)
POLLING_INTERVAL_DATASET=5000                   # Poll dataset status every 5s
POLLING_INTERVAL_ANALYSIS=3000                  # Poll analysis status every 3s
```

---

## Appendix D: Deployment Checklist

- [ ] LlamaFarm installed and running
- [ ] Ollama models pulled (gemma3:1b, qwen3:1.7B, nomic-embed-text)
- [ ] Docker containers running (ChromaDB, Celery, Redis)
- [ ] llamafarm.yaml updated with new configurations
- [ ] Custom extractors implemented and registered
- [ ] Agents configured and tested
- [ ] Frontend environment variables set
- [ ] SQLite database initialized
- [ ] Test documents uploaded and processed
- [ ] Sample analysis run successfully
- [ ] Results dashboard displaying correctly
- [ ] Export functionality tested
- [ ] Documentation completed
- [ ] User training conducted

---

## Conclusion

This implementation plan provides a comprehensive roadmap for transforming the Medical Records Helper into an FDA Document Analysis System. The phased approach ensures each component is thoroughly tested before moving to the next phase.

**Key Success Factors:**
1. **Dual-dataset architecture** optimizes for both question extraction and answer retrieval
2. **Specialized agents** provide accurate, explainable results
3. **Comprehensive metadata** enables detailed tracking and reporting
4. **User-friendly UI** makes complex analysis accessible
5. **LlamaFarm integration** leverages existing infrastructure

**Estimated Timeline:** 7 weeks from start to production deployment

**Next Steps:**
1. Review this plan with stakeholders
2. Gather sample FDA documents for testing (20-50 documents)
3. Begin Phase 1: Infrastructure Setup
4. Set up weekly check-ins to track progress

---

**Document Version:** 1.0
**Last Updated:** 2025-01-20
**Author:** Generated by Claude Code based on project requirements
