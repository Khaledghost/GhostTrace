#!/bin/bash
# Rebuild and link GhostTrace package for testing

set -e

echo ""
echo "🔨 Rebuilding GhostTrace Package..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install --production=false

# Create data directory if it doesn't exist
echo "📁 Creating data directory..."
mkdir -p data

# Remove existing npm link if it exists
echo "🔗 Removing old npm link..."
npm unlink -g 2>/dev/null || true

# Create new npm link
echo "🔗 Creating npm link..."
npm link

echo ""
echo "✅ GhostTrace package rebuilt successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Go to your test project:"
echo "   cd ~/test-ghosttrace"
echo ""
echo "2. Link to the updated package:"
echo "   npm link ghosttrace"
echo ""
echo "3. Run your test:"
echo "   node test.js"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
