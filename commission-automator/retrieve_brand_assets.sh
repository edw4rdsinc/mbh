#!/bin/bash
#
# Quick script to retrieve brand assets from Google Drive
# After sharing the folder with: drive-master@mcp-g-drive-474704.iam.gserviceaccount.com
#

cd /home/sam/chatbot-platform/mbh/commission-automator

echo "================================================"
echo "Brand Assets Retrieval"
echo "================================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    venv/bin/pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
fi

# First, check access
echo "1. Checking folder access..."
echo ""
./venv/bin/python3 check_folder_access.py

echo ""
echo "================================================"
echo ""
read -p "Does the service account have access? (y/n): " has_access

if [ "$has_access" = "y" ] || [ "$has_access" = "Y" ]; then
    echo ""
    echo "2. Downloading brand assets..."
    echo ""
    ./venv/bin/python3 get_brand_assets.py

    echo ""
    echo "================================================"
    echo "Complete!"
    echo "================================================"
    echo ""
    echo "Assets downloaded to: ./brand_assets/"
    echo "Metadata saved to: ./brand_assets/brand_assets_metadata.json"
    echo ""

    # Show what was downloaded
    if [ -f "brand_assets/brand_assets_metadata.json" ]; then
        echo "Summary:"
        cat brand_assets/brand_assets_metadata.json | python3 -m json.tool | grep -E '"name"|"colors"' | head -20
    fi
else
    echo ""
    echo "Please share the folder first:"
    echo "1. Go to: https://drive.google.com/drive/folders/1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO"
    echo "2. Click Share"
    echo "3. Add: drive-master@mcp-g-drive-474704.iam.gserviceaccount.com"
    echo "4. Set permission to 'Viewer'"
    echo "5. Run this script again"
fi
