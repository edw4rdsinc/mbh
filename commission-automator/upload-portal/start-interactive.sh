#!/bin/bash

# Commission Upload Portal - Interactive Mode Startup Script

echo "=================================================="
echo "  Commission Portal - Interactive Review Mode"
echo "=================================================="

# Check if we should backup original server.js
if [ ! -f "server-original.js" ]; then
    echo "📦 Backing up original server.js..."
    cp server.js server-original.js
fi

# Activate interactive server
echo "🔄 Activating interactive server..."
cp server-interactive.js server.js

# Check if index.html needs updating
if [ ! -f "public/index-original.html" ]; then
    echo "📦 Backing up original index.html..."
    cp public/index.html public/index-original.html
fi

# Activate interactive UI
echo "🔄 Activating interactive UI..."
cp public/index-interactive.html public/index.html

# Check dependencies
echo "📦 Checking dependencies..."
npm list ws &>/dev/null || npm install ws

# Start server
echo ""
echo "🚀 Starting interactive commission portal..."
echo ""
node server.js