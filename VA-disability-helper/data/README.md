# VA Disability Helper - Data Directory

This directory is where you place VA-related documents that will be ingested into the RAG (Retrieval-Augmented Generation) databases.

## Supported File Types

- **PDF files** (`.pdf`) - VA regulations, rating schedules, decision letters, medical records
- **Text files** (`.txt`) - Plain text VA documents
- **Markdown files** (`.md`) - Formatted VA guidance documents

## Recommended Document Organization

### 1. VA Regulations (`va_regulations/`)
Place official VA regulations and CFR documents here:
- 38 CFR Part 4 (Rating Schedule)
- 38 CFR Part 3 (Adjudication)
- M21-1 Manual excerpts
- VA Circulars and Fast Letters

### 2. VA Knowledge Base (`va_knowledge/`)
General VA disability knowledge documents:
- VA pamphlets and guides
- Common conditions guides
- Evidence requirements
- Claims process documentation
- Secondary conditions information

### 3. VA Rating Schedules (`va_rating_schedules/`)
Specific rating schedule documents:
- Body system rating schedules (musculoskeletal, mental health, etc.)
- Diagnostic code guides
- Combined ratings tables
- Special Monthly Compensation (SMC) guidance

## Example Documents to Include

**Highly Recommended:**
- 38 CFR Part 4 - Schedule for Rating Disabilities (full text)
- VA M21-1 Adjudication Procedures Manual (relevant sections)
- VA presumptive conditions lists (Agent Orange, burn pits, Gulf War, etc.)
- Common condition fact sheets (PTSD, tinnitus, sleep apnea, etc.)
- Combined ratings table and calculator guidance
- TDIU (Total Disability Individual Unemployability) requirements
- Nexus letter examples and requirements
- C&P exam preparation guides
- DBQ (Disability Benefits Questionnaire) templates

**Optional but Helpful:**
- Court decisions (CAVC, Federal Circuit) on important cases
- VSO guidance documents
- Appeals process flowcharts
- Evidence development guides
- Specific condition research papers

## Processing Your Documents

After adding documents to this directory, you'll need to ingest them into the appropriate LlamaFarm database:

```bash
# Navigate to your project directory
cd /path/to/VA-disability-helper

# Ingest documents into the va_regulations database
lf datasets add va_regulations -s va_document_processor -b va_regulations_db
lf datasets ingest va_regulations data/va_regulations/**/*.pdf
lf datasets process va_regulations

# Ingest documents into the va_knowledge database
lf datasets add va_knowledge -s va_document_processor -b va_knowledge_db
lf datasets ingest va_knowledge data/va_knowledge/**/*.{pdf,txt,md}
lf datasets process va_knowledge

# Ingest documents into the va_rating_schedules database
lf datasets add va_rating_schedules -s va_document_processor -b va_rating_schedules_db
lf datasets ingest va_rating_schedules data/va_rating_schedules/**/*.pdf
lf datasets process va_rating_schedules
```

## Privacy Notice

All documents are processed **locally** on your machine. Nothing is sent to external servers. Your VA documents remain private and secure.

## Document Quality Tips

For best RAG results:
- Use high-quality PDFs with selectable text (not scanned images)
- Keep documents focused on specific topics when possible
- Remove duplicate content to avoid confusion
- Ensure documents are from official VA sources when possible
- Consider OCR for scanned PDFs before ingestion

## Where to Find VA Documents

**Official Sources:**
- [eCFR 38 CFR Part 4](https://www.ecfr.gov/current/title-38/chapter-I/part-4) - Rating Schedule
- [VA.gov Knowledge Base](https://www.va.gov/disability/) - Official guides
- [M21-1 Manual](https://www.knowva.ebenefits.va.gov/system/templates/selfservice/va_ssnew/help/customer/locale/en-US/portal/554400000001018/topic/554400000003489/M21-1-Adjudication-Procedures-Manual) - Adjudication procedures
- [VA Forms](https://www.va.gov/find-forms/) - DBQs and claim forms

**Community Resources:**
- VA claims Reddit communities (for examples and guidance)
- VSO websites (DAV, VFW, American Legion) - educational materials
- VA attorney blogs and guides

---

**Note:** This is a starter guide. Customize your document collection based on the specific VA disability topics most relevant to your needs.
