# Getting Started with Insurance Helper

This guide walks you through setting up Insurance Helper step-by-step.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Docker Desktop** installed and running
  - Download: https://www.docker.com/products/docker-desktop
  - Verify: `docker --version`
  
- [ ] **Ollama** installed
  - Download: https://ollama.com/download
  - Verify: `ollama --version`
  
- [ ] **LlamaFarm CLI** installed
  - Install: `curl -fsSL https://raw.githubusercontent.com/llama-farm/llamafarm/main/install.sh | bash`
  - Verify: `lf --version`
  
- [ ] **Node.js 18+** installed
  - Download: https://nodejs.org/
  - Verify: `node --version`

---

## Step 1: Install AI Models

```bash
# Pull required models (~2.4GB total)
ollama pull gemma3:1b
ollama pull qwen3:1.7b
ollama pull nomic-embed-text

# Verify models are installed
ollama list
```

**Configure Ollama:**
1. Open Ollama app
2. Go to Settings → Advanced
3. Set **Context Length** to **32768** or higher
4. Restart Ollama

---

## Step 2: Initialize LlamaFarm

```bash
cd Insurance-helper

# Initialize LlamaFarm (creates configuration)
lf init

# Start LlamaFarm services
lf start
```

**First-time startup may take 2-5 minutes** as Docker images are downloaded.

You should see:
```
✓ ChromaDB started on port 8000
✓ LlamaFarm API started
✓ Workers initialized
```

---

## Step 3: Add Your Insurance Policy

This is the **most important step** for getting value from Insurance Helper.

### Option A: Using Your Real Policy (Recommended)

```bash
# Create data directory
mkdir -p data/policies

# Copy your insurance policy PDF
cp ~/Downloads/your-insurance-policy.pdf data/policies/

# Create dataset
lf datasets add insurance_policies \
  -s insurance_policy_processor \
  -b insurance_policies_db

# Ingest your policy
lf datasets ingest insurance_policies ./data/policies/*.pdf

# Process (creates embeddings) - THIS TAKES TIME
lf datasets process insurance_policies
```

**Processing time estimates:**
- 50-page policy: 5-10 minutes
- 100-page policy: 10-15 minutes  
- 200-page policy: 15-25 minutes

**What happens during processing:**
1. PDFs parsed to text
2. Text chunked into ~1000 char paragraphs
3. Each chunk gets a 768-dimension vector embedding
4. Embeddings stored in ChromaDB for semantic search

### Option B: Sample Insurance Documents (For Testing)

If you don't have your policy handy, you can test with sample documents:

```bash
mkdir -p data/policies

# Create sample insurance terms document
cat > data/policies/insurance-101.txt << 'EOF'
# Insurance Glossary

## Deductible
The amount you pay for covered health care services before your insurance plan starts to pay. For example, with a $2,000 deductible, you pay the first $2,000 of covered services yourself.

## Coinsurance
Your share of the costs of a covered health care service, calculated as a percentage. For example, if the health insurance plan's allowed amount for an office visit is $100 and you've met your deductible, your coinsurance payment of 20% would be $20. The health insurance plan pays the rest ($80).

## Out-of-Pocket Maximum
The most you have to pay for covered services in a plan year. After you spend this amount on deductibles, copayments, and coinsurance, your health plan pays 100% of the costs of covered benefits.

## Prior Authorization
Approval from your health insurer required before you receive certain services or medications. If you don't get prior authorization, the insurer might not cover the service.

## Explanation of Benefits (EOB)
A statement from your insurance company describing what was covered and how payment was made for a medical service. This is not a bill.

## CPT Code
Current Procedural Terminology code - a 5-digit number that describes the medical service or procedure performed.

## Denial Codes
- CO-50: These are non-covered services because this is not deemed a "medical necessity"
- PR-1: Deductible amount has not been met
- CO-97: The benefit for this service is included in the payment/allowance for another service
EOF

# Now ingest and process
lf datasets add insurance_policies \
  -s insurance_policy_processor \
  -b insurance_policies_db

lf datasets ingest insurance_policies ./data/policies/insurance-101.txt
lf datasets process insurance_policies
```

### Verify Your Knowledge Base

```bash
# Check dataset was created
lf datasets list

# Check embeddings were created
lf rag stats --database insurance_policies_db

# Test a query
lf rag query --database insurance_policies_db "what is a deductible"
```

You should see relevant text chunks returned!

---

## Step 4: Configure Frontend

```bash
# Copy example environment file
cp .env.local.example .env.local

# Install dependencies
npm install
```

The `.env.local` file should contain:
```env
NEXT_PUBLIC_LF_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LF_NAMESPACE=default
NEXT_PUBLIC_LF_PROJECT=insurance-helper-project
NEXT_PUBLIC_LF_MODEL=insurance_advisor
NEXT_PUBLIC_LF_DATABASE=insurance_policies_db
```

---

## Step 5: Run the App

```bash
npm run dev
```

Open your browser to: **http://localhost:3000**

You should see the Insurance Helper interface!

---

## Step 6: Try It Out

### Test Questions (with sample data)

If you used the sample insurance-101.txt file:

```
"What is a deductible?"
"Explain coinsurance vs copay"
"What does prior authorization mean?"
"My claim was denied with code CO-50. What does this mean?"
```

### Test with Your Real Policy

If you uploaded your actual insurance policy:

```
"Does my plan cover physical therapy?"
"What is my deductible?"
"How many PT sessions per year?"
"Do I need prior authorization for an MRI?"
"What is my out-of-pocket maximum?"
```

### Upload Documents in Browser

Try uploading an EOB or medical bill:
1. Drag PDF into the upload area
2. Ask: "Can you explain this EOB?"
3. Ask: "Why do I owe money on this bill?"

---

## Common Issues

### "No results from knowledge base"

```bash
# Check if embeddings were created
lf rag stats --database insurance_policies_db

# If it shows 0 chunks, re-process:
lf datasets process insurance_policies
```

### "LlamaFarm won't start"

```bash
# Check Docker is running
docker ps

# Restart LlamaFarm
lf stop
lf start

# If still failing, clean and restart
lf stop
docker system prune -af
lf start
```

### "Models not found"

```bash
# Verify models installed
ollama list

# Should show:
# - gemma3:1b
# - qwen3:1.7b  
# - nomic-embed-text

# If missing, pull again:
ollama pull gemma3:1b
ollama pull qwen3:1.7b
ollama pull nomic-embed-text
```

### "Slow responses"

1. Check Ollama context window is set to 32768+
2. Reduce RAG top-k in settings (try 4 instead of 8)
3. Ensure Docker has 4GB+ RAM allocated

---

## Next Steps

### Add More Documents

```bash
# Add more policies or documents
lf datasets ingest insurance_policies ./data/policies/new-policy.pdf
lf datasets process insurance_policies
```

### Switch to Specialized Agents

Edit `.env.local`:

```bash
# For claim denial analysis
NEXT_PUBLIC_LF_MODEL=claims_analyzer

# For coverage questions
NEXT_PUBLIC_LF_MODEL=coverage_advisor

# For bill/EOB analysis
NEXT_PUBLIC_LF_MODEL=billing_specialist
```

Then restart: `npm run dev`

### Explore Advanced Features

- **Multiple databases**: Set up separate insurance_knowledge_db for general info
- **Custom models**: Use larger models like qwen3:4b for complex scenarios
- **Batch processing**: Upload multiple years of policies

---

## Getting Help

- **LlamaFarm docs**: https://docs.llamafarm.dev
- **Issues**: Check the GitHub issues page
- **Discord**: Join the LlamaFarm community

---

**You're ready to use Insurance Helper! Start by asking questions about your insurance policy.** 🎉

To get more documents; use this script:

```
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

Run it in the console of your insurance company's Medical Reimbursement Policies: 
https://member.uhc.com/coverage/medical-reimbursement

---

## Using the Medical Member Handbook Uploader

### What's Different Now?

The Insurance Helper now has **two ways to add documents**:

1. **Handbook Uploader** (left sidebar, top) - For your Medical Member Handbook
   - **Permanent**: Processed and stored in database
   - **Searchable**: Creates embeddings for semantic search
   - **Summarized**: AI generates coverage summary
   - **Integrated**: Used for ALL future questions

2. **Bills & EOBs Uploader** (left sidebar, below handbook) - For one-off documents
   - **Temporary**: Parsed in browser only
   - **Not persisted**: Cleared on refresh
   - **Quick analysis**: For specific bills or EOBs

### Recommended Workflow

#### Step 1: Upload Your Member Handbook

1. Get your Medical Member Handbook PDF (usually 50-200 pages)
   - Download from your insurance company's member portal
   - Or scan physical handbook if needed

2. Click the **Medical Member Handbook** section
3. Select your handbook PDF
4. Click **Upload Handbook**
5. Wait 2-5 minutes for processing:
   - Uploading...
   - Processing and creating embeddings...
   - Generating coverage summary...

6. Review the generated summary
   - Plan type and network
   - Deductibles and out-of-pocket max
   - Copays and coinsurance
   - Coverage highlights
   - Contact information

#### Step 2: Ask Coverage Questions

Now you can ask personalized questions:

```
"What's my deductible?"
"How many physical therapy sessions does my plan cover?"
"Do I need prior authorization for an MRI?"
"What's my copay for a specialist visit?"
```

The agent will search **YOUR handbook first**, then general insurance knowledge.

#### Step 3: Upload Bills/EOBs for Analysis

When you receive a medical bill or EOB:

1. Drag and drop it into the **Bills & EOBs** section
2. Ask: "Can you explain this bill?"
3. Ask: "Why do I owe this amount?"
4. The agent uses:
   - The bill you just uploaded
   - Your handbook (from Step 1)
   - General insurance knowledge

---

## Troubleshooting Handbook Upload

### "Upload failed"

Check:
- File is actually a PDF (not scanned images)
- File size is under 50MB
- LlamaFarm is running (`lf status`)

### "Processing stuck"

- Processing can take 2-5 minutes for large handbooks
- Check browser console for errors
- Check LlamaFarm logs: `lf logs`
- If stuck >10 minutes, refresh and try again

### "No summary generated"

- Make sure processing completed (green checkmark)
- Try manually: Click "Generate Summary" if available
- Check that handbook has actual text (not just scanned images)

### "Agent doesn't use my handbook"

- Verify handbook status shows "Ready" with green checkmark
- Check that summary is displayed
- The agent automatically searches `member_handbook_db` - no action needed
- If still not working, check console for RAG query logs

---

## Advanced: Manual Handbook Management

If you prefer command-line:

```bash
# Add handbook via CLI
lf datasets ingest member_handbook ~/Downloads/my-handbook.pdf

# Process manually
lf datasets process member_handbook

# Check status
lf rag stats --database member_handbook_db

# Query handbook directly
lf rag query --database member_handbook_db "physical therapy coverage"
```

---

**With your handbook uploaded, you now have a personalized insurance assistant!**
