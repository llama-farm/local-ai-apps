#!/bin/bash

#
# FDA Document Upload Helper Script
#
# This script uploads ALL your FDA documents to BOTH datasets.
# Questions and answers are mixed throughout your correspondence,
# so the same files are processed twice with different chunking strategies.
#

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  FDA Document Upload Helper${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get directory from user
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}Usage:${NC} $0 <directory-with-fda-files>"
    echo ""
    echo "Example:"
    echo "  $0 /path/to/fda-correspondence"
    echo "  $0 ./fda-files"
    echo ""
    exit 1
fi

FILES_DIR="$1"

# Check directory exists
if [ ! -d "$FILES_DIR" ]; then
    echo -e "${YELLOW}Error:${NC} Directory not found: $FILES_DIR"
    exit 1
fi

# Count files
PDF_COUNT=$(find "$FILES_DIR" -type f -name "*.pdf" 2>/dev/null | wc -l | tr -d ' ')
TXT_COUNT=$(find "$FILES_DIR" -type f -name "*.txt" 2>/dev/null | wc -l | tr -d ' ')
TOTAL=$((PDF_COUNT + TXT_COUNT))

echo -e "${GREEN}Found files:${NC}"
echo "  PDFs: $PDF_COUNT"
echo "  Text files: $TXT_COUNT"
echo "  Total: $TOTAL"
echo ""

if [ "$TOTAL" -eq 0 ]; then
    echo -e "${YELLOW}No PDF or TXT files found in $FILES_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}Uploading to BOTH datasets...${NC}"
echo ""

# Step 1: Upload to fda_letters
echo -e "${GREEN}[1/4] Uploading to fda_letters (PDFs)...${NC}"
lf datasets upload fda_letters "$FILES_DIR"/**/*.pdf 2>/dev/null || lf datasets upload fda_letters "$FILES_DIR"/*.pdf || echo "No PDFs found"

echo -e "${GREEN}[2/4] Uploading to fda_letters (TXT files)...${NC}"
lf datasets upload fda_letters "$FILES_DIR"/**/*.txt 2>/dev/null || lf datasets upload fda_letters "$FILES_DIR"/*.txt || echo "No TXT files found"

# Step 2: Upload to fda_corpus
echo -e "${GREEN}[3/4] Uploading to fda_corpus (PDFs)...${NC}"
lf datasets upload fda_corpus "$FILES_DIR"/**/*.pdf 2>/dev/null || lf datasets upload fda_corpus "$FILES_DIR"/*.pdf || echo "No PDFs found"

echo -e "${GREEN}[4/4] Uploading to fda_corpus (TXT files)...${NC}"
lf datasets upload fda_corpus "$FILES_DIR"/**/*.txt 2>/dev/null || lf datasets upload fda_corpus "$FILES_DIR"/*.txt || echo "No TXT files found"

echo ""
echo -e "${GREEN}✓ Upload complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Process both datasets:"
echo "     ${GREEN}lf datasets process fda_letters${NC}"
echo "     ${GREEN}lf datasets process fda_corpus${NC}"
echo ""
echo "  2. Verify data:"
echo "     ${GREEN}lf datasets list${NC}"
echo ""
echo "  3. Run batch processing at:"
echo "     ${GREEN}http://localhost:3000/batch${NC}"
echo ""
