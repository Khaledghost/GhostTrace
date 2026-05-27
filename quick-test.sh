#!/bin/bash

# Quick 2-minute test of GhostTrace package

echo "🚀 GhostTrace Quick Test"
echo "========================"

cd /home/wal8y/Desktop/graduation

# Create tarball
echo "📦 Creating package..."
npm pack > /dev/null 2>&1

# Create temp test dir
TEST_DIR="/tmp/ghosttrace-quick-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Setup
echo "🏗️  Setting up test..."
npm init -y > /dev/null 2>&1
npm install express dotenv > /dev/null 2>&1
npm install /home/wal8y/Desktop/graduation/ghosttrace-3.0.0.tgz > /dev/null 2>&1

# Create minimal test
cat > test.js << 'EOF'
const ghosttrace = require('ghosttrace');
const express = require('express');
const app = express();

(async () => {
  try {
    await ghosttrace.init({
      adminEmail: 'test@test.com',
      adminPassword: 'TestPass123!',
      dashboardPort: 7001,
    });
    
    app.use(ghosttrace.secure());
    
    app.get('/test', (req, res) => {
      res.json({ 
        ok: true, 
        version: ghosttrace.version,
        dna: req.clientDNA 
      });
    });
    
    app.listen(7000, () => console.log('READY'));
    
    setTimeout(() => process.exit(0), 20000);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
})();
EOF

cat > .env << 'EOF'
GHOST_ADMIN_EMAIL=test@test.com
GHOST_ADMIN_PASS=TestPass123!
DB_ENABLED=false
EOF

# Run test
echo "🧪 Running test..."
node test.js > output.log 2>&1 &
PID=$!

# Wait for ready
for i in {1..15}; do
  if grep -q "READY" output.log 2>/dev/null; then
    break
  fi
  sleep 1
done

sleep 2

# Test request
echo "📡 Testing endpoint..."
RESPONSE=$(curl -s http://localhost:7000/test)

# Cleanup
kill $PID 2>/dev/null
wait $PID 2>/dev/null
cd /home/wal8y/Desktop/graduation
rm -rf "$TEST_DIR"

# Results
if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Test passed!"
  echo "   Response: $RESPONSE"
  echo ""
  echo "🎉 Package is working correctly!"
  exit 0
else
  echo "❌ Test failed"
  echo "   Response: $RESPONSE"
  exit 1
fi
