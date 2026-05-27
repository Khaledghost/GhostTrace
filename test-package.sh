#!/bin/bash

# GhostTrace Local Package Testing Script
# This script tests the npm package before publishing

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║  GhostTrace Local Package Test Suite  ║"
echo "╔════════════════════════════════════════╝"
echo -e "${NC}"

# Variables
PACKAGE_DIR="/home/wal8y/Desktop/graduation"
TEST_DIR="/tmp/ghosttrace-test-$(date +%s)"
TARBALL="ghosttrace-3.0.0.tgz"

# Step 1: Create tarball
echo -e "${YELLOW}📦 Step 1: Creating package tarball...${NC}"
cd "$PACKAGE_DIR"

if [ -f "$TARBALL" ]; then
  rm "$TARBALL"
fi

npm pack > /dev/null 2>&1

if [ -f "$TARBALL" ]; then
  SIZE=$(du -h "$TARBALL" | cut -f1)
  echo -e "${GREEN}   ✓ Tarball created: $TARBALL ($SIZE)${NC}"
else
  echo -e "${RED}   ✗ Failed to create tarball${NC}"
  exit 1
fi

# Step 2: Inspect package contents
echo -e "\n${YELLOW}🔍 Step 2: Inspecting package contents...${NC}"
echo -e "${BLUE}   Files in package:${NC}"
tar -tzf "$TARBALL" | grep -E "^package/(index\.js|lib/|middleware/|README\.md)" | head -10
echo "   ..."
FILE_COUNT=$(tar -tzf "$TARBALL" | wc -l)
echo -e "${GREEN}   ✓ Package contains $FILE_COUNT files${NC}"

# Check for sensitive files
if tar -tzf "$TARBALL" | grep -qE "\.env|node_modules/|\.git/"; then
  echo -e "${RED}   ✗ WARNING: Package contains sensitive files!${NC}"
  tar -tzf "$TARBALL" | grep -E "\.env|node_modules/|\.git/"
  exit 1
else
  echo -e "${GREEN}   ✓ No sensitive files detected${NC}"
fi

# Step 3: Setup test environment
echo -e "\n${YELLOW}🏗️  Step 3: Setting up test environment...${NC}"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo -e "${BLUE}   Installing dependencies...${NC}"
npm init -y > /dev/null 2>&1
npm install express dotenv > /dev/null 2>&1
echo -e "${GREEN}   ✓ Test environment ready${NC}"

# Step 4: Install package from tarball
echo -e "\n${YELLOW}📥 Step 4: Installing GhostTrace from tarball...${NC}"
npm install "$PACKAGE_DIR/$TARBALL" > /dev/null 2>&1

if [ -d "node_modules/ghosttrace" ]; then
  echo -e "${GREEN}   ✓ Package installed successfully${NC}"
else
  echo -e "${RED}   ✗ Installation failed${NC}"
  exit 1
fi

# Verify main files exist
echo -e "${BLUE}   Verifying package structure...${NC}"
REQUIRED_FILES=(
  "node_modules/ghosttrace/index.js"
  "node_modules/ghosttrace/index.d.ts"
  "node_modules/ghosttrace/lib/init.js"
  "node_modules/ghosttrace/lib/middleware.js"
  "node_modules/ghosttrace/lib/dashboard-server.js"
  "node_modules/ghosttrace/README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}   ✓ $file${NC}"
  else
    echo -e "${RED}   ✗ Missing: $file${NC}"
    exit 1
  fi
done

# Step 5: Create test application
echo -e "\n${YELLOW}🧪 Step 5: Creating test application...${NC}"

cat > test-app.js << 'TESTAPP'
require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.use(express.json());

let server;

(async () => {
  try {
    console.log('Initializing GhostTrace...');
    
    const instance = await ghosttrace.init({
      adminEmail: 'test@test.com',
      adminPassword: 'TestPassword123!',
      dashboardPort: 6001,
    });

    console.log('GhostTrace initialized successfully');
    console.log('Version:', ghosttrace.version);

    // Apply middleware
    app.use('/api', ghosttrace.secure());

    // Test routes
    app.get('/api/test', (req, res) => {
      res.json({ 
        success: true,
        version: ghosttrace.version,
        dna: req.clientDNA,
        hasAnalysis: !!req.protectionAnalysis,
      });
    });

    app.get('/api/users', (req, res) => {
      res.json({ users: ['Alice', 'Bob'] });
    });

    // Start server
    server = app.listen(6000, '0.0.0.0', () => {
      console.log('TEST_SERVER_READY');
    });

    // Auto-shutdown after tests
    setTimeout(() => {
      console.log('Auto-stopping test server...');
      server.close(() => {
        instance.stop().then(() => {
          process.exit(0);
        });
      });
    }, 60000);

  } catch (error) {
    console.error('INITIALIZATION_ERROR:', error.message);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', () => {
  if (server) server.close(() => process.exit(0));
});
TESTAPP

cat > .env << 'ENVFILE'
GHOST_ADMIN_EMAIL=test@test.com
GHOST_ADMIN_PASS=TestPassword123!
GHOST_PORT=6001
DB_ENABLED=false
ENVFILE

echo -e "${GREEN}   ✓ Test application created${NC}"

# Step 6: Start test server
echo -e "\n${YELLOW}🚀 Step 6: Starting test server...${NC}"
node test-app.js > test-output.log 2>&1 &
TEST_PID=$!

echo -e "${BLUE}   Waiting for server to start (PID: $TEST_PID)...${NC}"

# Wait for server ready signal
TIMEOUT=30
READY=false
while [ $TIMEOUT -gt 0 ]; do
  if grep -q "TEST_SERVER_READY" test-output.log 2>/dev/null; then
    READY=true
    break
  fi
  
  if grep -q "INITIALIZATION_ERROR" test-output.log 2>/dev/null; then
    echo -e "${RED}   ✗ Server failed to start${NC}"
    echo -e "${RED}   Error:${NC}"
    cat test-output.log
    kill $TEST_PID 2>/dev/null || true
    exit 1
  fi
  
  sleep 1
  TIMEOUT=$((TIMEOUT - 1))
done

if [ "$READY" = false ]; then
  echo -e "${RED}   ✗ Timeout waiting for server${NC}"
  cat test-output.log
  kill $TEST_PID 2>/dev/null || true
  exit 1
fi

echo -e "${GREEN}   ✓ Server started successfully${NC}"

# Give it a moment to fully initialize
sleep 3

# Step 7: Run functional tests
echo -e "\n${YELLOW}🧪 Step 7: Running functional tests...${NC}"

FAILED_TESTS=0

# Test 1: Basic connectivity
echo -n "   Test 1: Basic connectivity... "
if curl -s -f http://localhost:6000/api/test > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 2: Response structure
echo -n "   Test 2: Response structure... "
RESPONSE=$(curl -s http://localhost:6000/api/test)
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "      Response: $RESPONSE"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 3: Version check
echo -n "   Test 3: Version export... "
if echo "$RESPONSE" | grep -q '3.0.0'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 4: DNA fingerprint
echo -n "   Test 4: DNA fingerprint... "
if echo "$RESPONSE" | grep -q '"dna"'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 5: DNA header
echo -n "   Test 5: DNA header... "
if curl -s -I http://localhost:6000/api/test 2>&1 | grep -qi "x-client-dna"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 6: Multiple routes
echo -n "   Test 6: Multiple routes... "
if curl -s http://localhost:6000/api/users | grep -q '"users"'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 7: Dashboard accessibility
echo -n "   Test 7: Dashboard server... "
if curl -s http://localhost:6001 > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 8: Dashboard login page
echo -n "   Test 8: Dashboard login... "
if curl -s http://localhost:6001/login.html | grep -qi "ghosttrace"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 9: Rate limiting (light test)
echo -n "   Test 9: Rate limiting... "
SUCCESS_COUNT=0
for i in {1..10}; do
  if curl -s -f http://localhost:6000/api/test > /dev/null 2>&1; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
done

if [ $SUCCESS_COUNT -eq 10 ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ (only $SUCCESS_COUNT/10 succeeded)${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Step 8: Performance check
echo -e "\n${YELLOW}⚡ Step 8: Performance check...${NC}"
echo -n "   Testing response time (100 requests)... "

START_TIME=$(date +%s%N)
for i in {1..100}; do
  curl -s http://localhost:6000/api/test > /dev/null 2>&1
done
END_TIME=$(date +%s%N)

DURATION=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to ms
AVG_TIME=$(( DURATION / 100 ))

if [ $AVG_TIME -lt 50 ]; then
  echo -e "${GREEN}✓ Average: ${AVG_TIME}ms${NC}"
else
  echo -e "${YELLOW}⚠ Average: ${AVG_TIME}ms (target: <50ms)${NC}"
fi

# Step 9: Check logs for errors
echo -e "\n${YELLOW}📋 Step 9: Checking logs...${NC}"
if grep -qi "error" test-output.log | grep -v "errorHandler"; then
  echo -e "${YELLOW}   ⚠ Warnings found in logs:${NC}"
  grep -i "error" test-output.log | grep -v "errorHandler" | head -5
else
  echo -e "${GREEN}   ✓ No errors in logs${NC}"
fi

# Step 10: Cleanup
echo -e "\n${YELLOW}🧹 Step 10: Cleaning up...${NC}"
echo -e "${BLUE}   Stopping test server...${NC}"
kill $TEST_PID 2>/dev/null || true
wait $TEST_PID 2>/dev/null || true

sleep 2

echo -e "${BLUE}   Removing test directory...${NC}"
cd "$PACKAGE_DIR"
rm -rf "$TEST_DIR"

echo -e "${GREEN}   ✓ Cleanup complete${NC}"

# Final Results
echo -e "\n${BLUE}╔════════════════════════════════════════╗"
echo -e "║           Test Results                 ║"
echo -e "╚════════════════════════════════════════╝${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed! (9/9)${NC}"
  echo -e "${GREEN}🚀 Package is ready for publishing!${NC}\n"
  echo -e "${BLUE}Next steps:${NC}"
  echo -e "   1. npm login"
  echo -e "   2. npm publish"
  echo -e "   3. git tag v3.0.0"
  echo -e "   4. git push --tags\n"
  exit 0
else
  echo -e "\n${RED}❌ $FAILED_TESTS test(s) failed${NC}"
  echo -e "${YELLOW}Please review the errors above and fix them before publishing.${NC}\n"
  exit 1
fi
