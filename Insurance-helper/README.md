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

Script to get PDFs from insurance websites:
For example: Signa: https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/medical_a-z.html

United healthcare: https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html


Cut and paste into the Browser's Console
```javascript
/**
 * UHC Clinical Guidelines Document Downloader
 * 
 * Instructions:
 * 1. Navigate to https://www.uhcprovider.com/en/policies-protocols/clinical-guidelines.html
 * 2. Open Developer Console (F12 or Right-click > Inspect > Console)
 * 3. Copy and paste this entire script into the console
 * 4. Press Enter to run
 * 
 * The script will:
 * - Analyze the page structure
 * - Find all downloadable documents
 * - Create a download folder in your Downloads directory
 * - Download all documents with a delay between each to avoid overwhelming the server
 */

(function() {
    'use strict';
    
    console.log('🔍 UHC Document Downloader Starting...');
    
    // Configuration
    const config = {
        downloadDelay: 2000, // Delay between downloads in milliseconds
        maxConcurrent: 2,    // Max concurrent downloads
        timeout: 30000,      // Timeout for each download
        debug: true          // Enable debug logging
    };
    
    // Utility functions
    const utils = {
        log: (message, type = 'info') => {
            const styles = {
                info: 'color: #2196F3',
                success: 'color: #4CAF50',
                warning: 'color: #FF9800',
                error: 'color: #F44336'
            };
            console.log(`%c${message}`, styles[type]);
        },
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        sanitizeFilename: (filename) => {
            return filename.replace(/[^a-z0-9.-]/gi, '_').replace(/_{2,}/g, '_');
        },
        
        extractFilename: (url, defaultName = 'document') => {
            try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const filename = pathname.split('/').pop();
                return filename || `${defaultName}.pdf`;
            } catch (e) {
                return `${defaultName}.pdf`;
            }
        }
    };
    
    // Document finder
    const documentFinder = {
        findAllDocuments: function() {
            const documents = new Map(); // Use Map to avoid duplicates        
        
            // Method 1: Find all PDF links directly (most reliable)
            const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf" i]'));
            utils.log(`Found ${pdfLinks.length} PDF links`, 'info');
            
            pdfLinks.forEach(link => {
                if (link.href && !link.href.startsWith('javascript:')) {
                    documents.set(link.href, {
                        url: link.href,
                        text: link.textContent.trim() || 'PDF Document',
                        type: 'pdf-link'
                    });
                }
            });
            
            // Method 2: Find other document types
            const docExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.csv'];
            docExtensions.forEach(ext => {
                const links = Array.from(document.querySelectorAll(`a[href*="${ext}" i]`));
                links.forEach(link => {
                    if (link.href && !link.href.startsWith('javascript:')) {
                        documents.set(link.href, {
                            url: link.href,
                            text: link.textContent.trim() || `Document (${ext})`,
                            type: `${ext}-link`
                        });
                    }
                });
            });
            // Method 3: Find links with download-related text or attributes
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            allLinks.forEach(link => {
                const text = link.textContent.toLowerCase();
                const href = link.href.toLowerCase();
                const hasDownloadAttr = link.hasAttribute('download');
                const hasDownloadInText = text.includes('download') || text.includes('guideline') || text.includes('policy');
                const hasDownloadInHref = href.includes('download') || href.includes('getfile') || href.includes('getdocument');
                
                if ((hasDownloadAttr || hasDownloadInText || hasDownloadInHref) && 
                    !href.startsWith('javascript:') && 
                    !href.startsWith('#') &&
                    !documents.has(link.href)) {
                    documents.set(link.href, {
                        url: link.href,
                        text: link.textContent.trim() || 'Document',
                        type: 'potential-download'
                    });
                }
            });

            // Method 4: Find buttons with data attributes or onclick handlers
            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
            buttons.forEach(button => {
                // Check data attributes
                Object.keys(button.dataset || {}).forEach(key => {
                    const value = button.dataset[key];
                    if (value && (value.includes('.pdf') || value.includes('.doc') || value.includes('download'))) {
                        documents.set(value, {
                            url: value,
                            text: button.textContent.trim() || 'Button Download',
                            type: 'button-data'
                        });
                    }
                });
                
                // Log buttons with onclick for manual inspection
                if (button.onclick || button.getAttribute('onclick')) {
                    utils.log(`Button with onclick: "${button.textContent.trim()}"`, 'warning');
                }
            });
            // Method 5: Check for expandable sections and try to expand them
            const expandables = document.querySelectorAll('[aria-expanded="false"], details:not([open]), .accordion-button.collapsed, .collapsible');
            if (expandables.length > 0) {
                utils.log(`Found ${expandables.length} collapsed sections. Attempting to expand...`, 'info');
                
                let expanded = 0;
                expandables.forEach(elem => {
                    try {
                        if (elem.tagName === 'DETAILS') {
                            elem.open = true;
                            expanded++;
                        } else if (elem.hasAttribute('aria-expanded')) {
                            elem.setAttribute('aria-expanded', 'true');
                            elem.click();
                            expanded++;
                        } else if (elem.classList.contains('accordion-button') || elem.classList.contains('collapsible')) {
                            elem.click();
                            expanded++;
                        }
                    } catch (e) {
                        // Silent fail for individual elements
                    }
                });
                
                if (expanded > 0) {
                    utils.log(`Expanded ${expanded} sections. Waiting for content to load...`, 'info');
                    // Re-scan after a delay
                    setTimeout(() => {
                        const newPdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf" i]'));
                        newPdfLinks.forEach(link => {
                            if (link.href && !documents.has(link.href)) {
                                documents.set(link.href, {
                                    url: link.href,
                                    text: link.textContent.trim() || 'PDF Document (from expanded section)',
                                    type: 'expanded-pdf'
                                });
                            }
                        });
                        utils.log(`Found ${newPdfLinks.length - documents.size} new PDFs after expansion`, 'info');
                    }, 2000);
                }
            }
            
            return documents;
        }
    };
    
    // Download manager
    const downloadManager = {
        downloadQueue: [],
        downloading: 0,
        completed: 0,
        failed: 0,
        
        addToQueue: function(documents) {
            documents.forEach((doc, url) => {
                this.downloadQueue.push(doc);
            });
            utils.log(`Added ${documents.size} documents to download queue`, 'info');
        },        
        downloadFile: async function(doc) {
            try {
                utils.log(`Downloading: ${doc.text || doc.url}`, 'info');
                
                // Create a temporary link and click it
                const link = document.createElement('a');
                link.href = doc.url;
                link.download = utils.extractFilename(doc.url, doc.text);
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.completed++;
                utils.log(`✅ Downloaded: ${doc.text || doc.url}`, 'success');
                
            } catch (error) {
                this.failed++;
                utils.log(`❌ Failed to download: ${doc.url} - ${error.message}`, 'error');
            }
        },
        
        processQueue: async function() {
            utils.log(`Starting download of ${this.downloadQueue.length} documents...`, 'info');
            
            for (let i = 0; i < this.downloadQueue.length; i++) {
                const doc = this.downloadQueue[i];
                
                // Wait for available slot
                while (this.downloading >= config.maxConcurrent) {
                    await utils.sleep(100);
                }
                
                this.downloading++;
                
                // Download with delay
                this.downloadFile(doc).then(() => {
                    this.downloading--;
                });
                
                // Progress update
                if ((i + 1) % 5 === 0 || i === this.downloadQueue.length - 1) {
                    utils.log(`Progress: ${i + 1}/${this.downloadQueue.length} documents processed`, 'info');
                }
                
                // Delay between downloads
                if (i < this.downloadQueue.length - 1) {
                    await utils.sleep(config.downloadDelay);
                }
            }
            
            // Wait for all downloads to complete
            while (this.downloading > 0) {
                await utils.sleep(100);
            }
            
            // Final report
            utils.log('=' .repeat(50), 'info');
            utils.log(`Download Complete!`, 'success');
            utils.log(`✅ Successful: ${this.completed}`, 'success');
            utils.log(`❌ Failed: ${this.failed}`, 'error');
            utils.log(`📊 Total: ${this.downloadQueue.length}`, 'info');
        }
    };
            
    // Alternative download method using fetch
    const alternativeDownload = {
        downloadWithFetch: async function(url, filename) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/pdf,application/vnd.ms-excel,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = filename;
                link.click();
                window.URL.revokeObjectURL(downloadUrl);
                
                return true;
            } catch (error) {
                utils.log(`Fetch download failed: ${error.message}`, 'error');
                return false;
            }
        }
    };
    
    // Page analyzer
    const pageAnalyzer = {
        analyze: function() {
            console.log('📊 Page Analysis:');
            console.log('================');            
            
            const analysis = {
                url: window.location.href,
                title: document.title,
                totalLinks: document.querySelectorAll('a').length,
                pdfLinks: document.querySelectorAll('a[href*=".pdf"]').length,
                iframes: document.querySelectorAll('iframe').length,
                buttons: document.querySelectorAll('button').length,
                forms: document.querySelectorAll('form').length,
                expandableSections: document.querySelectorAll('[aria-expanded], details, .accordion').length
            };
            
            console.table(analysis);
            
            // Check for specific UHC elements
            const uhcElements = {
                hasLoginForm: !!document.querySelector('form[action*="login"]'),
                hasDownloadButtons: Array.from(document.querySelectorAll('button, a')).some(el => 
                    el.textContent.toLowerCase().includes('download')),
                hasPDFLinks: !!document.querySelector('a[href$=".pdf"]'),
                requiresAuth: document.body.textContent.includes('log in') || document.body.textContent.includes('sign in')
            };
            
            console.log('UHC Specific Elements:');
            console.table(uhcElements);
            
            if (uhcElements.requiresAuth) {
                utils.log('⚠️ This page may require authentication to access all documents', 'warning');
            }
            
            return analysis;
        }
    };

    // Main execution
    async function main() {
        try {
            // Step 1: Analyze the page
            utils.log('Step 1: Analyzing page structure...', 'info');
            const analysis = pageAnalyzer.analyze();
            
            // Step 2: Find all documents
            utils.log('Step 2: Searching for documents...', 'info');
            const documents = documentFinder.findAllDocuments();
            
            if (documents.size === 0) {
                utils.log('⚠️ No documents found on this page.', 'warning');
                utils.log('This might be because:', 'warning');
                utils.log('1. Documents are behind a login wall', 'warning');
                utils.log('2. Documents are loaded dynamically via JavaScript', 'warning');
                utils.log('3. Documents are in iframes or popup windows', 'warning');
                
                // Try to find and report any authentication requirements
                const loginElements = document.querySelectorAll('a[href*="login"], button:contains("Sign In"), input[type="password"]');
                if (loginElements.length > 0) {
                    utils.log('🔐 Authentication elements detected. Please log in first.', 'warning');
                }
                
                return;
            }
            
            utils.log(`✅ Found ${documents.size} documents`, 'success');
            
            // Display found documents
            console.log('Found Documents:');
            documents.forEach((doc, url) => {
                console.log(`- ${doc.text || 'Untitled'}: ${url}`);
            });

            // Step 3: Ask for confirmation
            const proceed = confirm(`Found ${documents.size} documents. Do you want to download all of them?\n\nNote: Files will be downloaded to your default Downloads folder.`);
            
            if (!proceed) {
                utils.log('Download cancelled by user', 'warning');
                return;
            }
            
            // Step 4: Start downloading
            utils.log('Step 3: Starting downloads...', 'info');
            downloadManager.addToQueue(documents);
            await downloadManager.processQueue();
            
        } catch (error) {
            utils.log(`Critical error: ${error.message}`, 'error');
            console.error(error);
        }
    }
    
    // Run the script
    main();
    
})();

// Additional helper function to manually trigger download of a specific URL
window.downloadUHCDocument = function(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || url.split('/').pop();
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log(`Downloaded: ${link.download}`);
};

console.log('💡 Tip: You can also use window.downloadUHCDocument(url, filename) to manually download specific documents');
```