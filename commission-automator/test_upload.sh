#!/bin/bash

# Test upload script - bypasses browser drag-and-drop issues
# Usage: ./test_upload.sh

MONTH="2025-10"
PORTAL_URL="http://localhost:5011/upload"

# Find commission PDFs
COMMISSION_DIR="/home/sam/commission_automator/data/mbh/${MONTH}/commission_statements"
BANK_DIR="/home/sam/commission_automator/data/mbh/${MONTH}/bank_statement"

echo "Testing commission upload for month: $MONTH"
echo "==========================================="

# Check if files exist
if [ ! -d "$COMMISSION_DIR" ]; then
    echo "❌ No commission statements found at: $COMMISSION_DIR"
    exit 1
fi

if [ ! -d "$BANK_DIR" ]; then
    echo "❌ No bank statement found at: $BANK_DIR"
    exit 1
fi

# Build curl command with all PDFs
CURL_CMD="curl -X POST $PORTAL_URL"
CURL_CMD="$CURL_CMD -F 'month=$MONTH'"

# Add all commission PDFs
for pdf in "$COMMISSION_DIR"/*.pdf; do
    if [ -f "$pdf" ]; then
        echo "✓ Adding: $(basename "$pdf")"
        CURL_CMD="$CURL_CMD -F 'commission_statements=@$pdf'"
    fi
done

# Add bank statement
for pdf in "$BANK_DIR"/*.pdf; do
    if [ -f "$pdf" ]; then
        echo "✓ Adding bank statement: $(basename "$pdf")"
        CURL_CMD="$CURL_CMD -F 'bank_statement=@$pdf'"
        break  # Only take first one
    fi
done

echo ""
echo "Uploading files to portal..."
echo "==========================================="

# Execute upload
RESPONSE=$(eval $CURL_CMD 2>/dev/null)

# Check response
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Upload successful!"
    echo "$RESPONSE" | python3 -m json.tool
else
    echo "❌ Upload failed:"
    echo "$RESPONSE"
fi