#!/bin/bash

# Test script for Claude API extraction
# Usage: ./test_claude_extractor.sh YOUR_API_KEY

if [ -z "$1" ]; then
    echo "Usage: $0 YOUR_CLAUDE_API_KEY"
    echo ""
    echo "This will test the Claude API extractor on one MyAccess PDF"
    exit 1
fi

export ANTHROPIC_API_KEY="$1"

echo "Testing Claude API extractor on MyAccess PDFs..."
echo "API Key set (first 10 chars): ${1:0:10}..."
echo ""

~/pdfplumber-env/bin/python3 ~/automations/commission_automator/src/extract_commissions.py
