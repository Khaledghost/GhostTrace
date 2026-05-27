# Testing GhostTrace NPM Package Locally

## Method 1: npm link (Quick Testing)

### Step 1: Link the package globally

```bash
cd /home/wal8y/Desktop/graduation

# Create global symlink
npm link
```

This creates a global symlink for `ghosttrace` pointing to your local directory.

### Step 2: Create test project

```bash
# Create fresh test directory
mkdir -p ~/test-ghosttrace
cd ~/test-ghosttrace

# Initialize new project
npm init -y

# Install dependencies
npm install express dotenv

# Link to your local ghosttrace
npm link ghosttrace
```

### Step 3: Create test application

Create `test-app.js`:

```javascript
require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.use(express.json());

console.log('GhostTrace version:', ghosttrace.version);

(async () => {
  try {
    await ghosttrace.init({
      adminEmail: 'test@example.com',
      adminPassword: 'TestPassword123!',
      dashboardPort: 4001,
    });

    // Protect routes
    app.use('/api', ghosttrace.secure());

    // Test routes
    app.get('/api/hello', (req, res) => {
      res.json({ 
        message: 'Hello World',
        dna: req.clientDNA,
        analysis: req.protectionAnalysis,
      });
    });

    app.get('/api/users', (req, res) => {
      res.json({ users: ['Alice', 'Bob'] });
    });

    // Start server
    app.listen(4000, () => {
      console.log('\n✅ Test app running on http://localhost:4000');
      console.log('📊 Dashboard at http://localhost:4001\n');
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
})();
```

Create `.env`:

```env
GHOST_ADMIN_EMAIL=test@example.com
GHOST_ADMIN_PASS=TestPassword123!
GHOST_PORT=4001
```

### Step 4: Run tests

```bash
# Start the test app
node test-app.js
```

### Step 5: Verify functionality

In another terminal:

```bash
# Test normal request
curl http://localhost:4000/api/hello
# Should return: {"message":"Hello World","dna":"..."}

# Check for DNA header
curl -v http://localhost:4000/api/hello 2>&1 | grep X-Client-DNA
# Should show: X-Client-DNA: a3d2d5ac...

# Test SQL injection detection
curl "http://localhost:4000/api/hello?id=1' OR '1'='1"
# Should return: 403 Forbidden (if blocking enabled)

# Test rate limiting (run 150 times)
for i in {1..150}; do curl -s http://localhost:4000/api/hello; done
# After ~120 requests: Should return 429 Too Many Requests

# Access dashboard
open http://localhost:4001
# Or: curl http://localhost:4001
```

### Step 6: Test dashboard login

1. Open http://localhost:4001 in browser
2. Login with `test@example.com` / `TestPassword123!`
3. Verify all dashboard pages load
4. Check that alerts appear for SQL injection test

### Step 7: Clean up

```bash
# Stop the test app (Ctrl+C)

# Unlink from test project
cd ~/test-ghosttrace
npm unlink ghosttrace

# Unlink globally
cd /home/wal8y/Desktop/graduation
npm unlink -g
```

---

## Method 2: npm pack (Most Realistic)

This creates a tarball exactly like npm would, testing the actual package contents.

### Step 1: Create package tarball

```bash
cd /home/wal8y/Desktop/graduation

# Create tarball
npm pack
```

This creates `ghosttrace-3.0.0.tgz` in the current directory.

### Step 2: Inspect tarball contents

```bash
# List files in package
tar -tzf ghosttrace-3.0.0.tgz

# Extract to temp directory for inspection
mkdir -p /tmp/ghosttrace-test
tar -xzf ghosttrace-3.0.0.tgz -C /tmp/ghosttrace-test
ls -la /tmp/ghosttrace-test/package/
```

Verify all necessary files are included:
- ✅ index.js
- ✅ index.d.ts
- ✅ lib/
- ✅ middleware/
- ✅ services/
- ✅ models/
- ✅ core/
- ✅ utils/
- ✅ routes/
- ✅ config/
- ✅ public/
- ✅ README.md
- ✅ LICENSE
- ❌ No .env files
- ❌ No node_modules
- ❌ No .git

### Step 3: Install from tarball

```bash
# Create fresh test project
mkdir -p ~/test-ghosttrace-pack
cd ~/test-ghosttrace-pack

npm init -y
npm install express dotenv

# Install from local tarball
npm install /home/wal8y/Desktop/graduation/ghosttrace-3.0.0.tgz
```

### Step 4: Test the installation

Create `test-app.js` (same as Method 1):

```javascript
require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.use(express.json());

(async () => {
  await ghosttrace.init({
    adminEmail: 'test@example.com',
    adminPassword: 'TestPassword123!',
    dashboardPort: 4001,
  });

  app.use('/api', ghosttrace.secure());

  app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello World' });
  });

  app.listen(4000, () => {
    console.log('Test app: http://localhost:4000');
  });
})();
```

Create `.env`:

```env
GHOST_ADMIN_EMAIL=test@example.com
GHOST_ADMIN_PASS=TestPassword123!
```

### Step 5: Run and verify

```bash
node test-app.js
```

Test all functionality (same as Method 1, Step 5).

---

## Method 3: Local npm Registry (Verdaccio)

For the most realistic testing, use a local npm registry.

### Step 1: Install Verdaccio

```bash
npm install -g verdaccio
```

### Step 2: Start Verdaccio

```bash
# Start local registry (in a separate terminal)
verdaccio
```

Default: http://localhost:4873

### Step 3: Configure npm to use local registry

```bash
# Point npm to local registry
npm set registry http://localhost:4873

# Create user
npm adduser --registry http://localhost:4873
# Username: test
# Password: test
# Email: test@test.com
```

### Step 4: Publish to local registry

```bash
cd /home/wal8y/Desktop/graduation

# Publish to local Verdaccio
npm publish --registry http://localhost:4873
```

### Step 5: Install from local registry

```bash
# Create test project
mkdir -p ~/test-ghosttrace-verdaccio
cd ~/test-ghosttrace-verdaccio

npm init -y

# Install from local registry
npm install ghosttrace --registry http://localhost:4873
npm install express dotenv
```

### Step 6: Test and verify

Create test app and run (same as previous methods).

### Step 7: Clean up

```bash
# Stop Verdaccio (Ctrl+C in its terminal)

# Reset npm registry to default
npm set registry https://registry.npmjs.org/
```

---

## Method 4: Automated Testing Script

Create comprehensive test script:

### Create `test-local-package.sh`

```bash
#!/bin/bash

echo "🧪 Testing GhostTrace Local Package"
echo "====================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test directory
TEST_DIR="/tmp/ghosttrace-test-$(date +%s)"

echo -e "\n${YELLOW}1. Creating package tarball...${NC}"
cd /home/wal8y/Desktop/graduation
npm pack || exit 1
echo -e "${GREEN}✓ Tarball created${NC}"

echo -e "\n${YELLOW}2. Setting up test environment...${NC}"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"
npm init -y > /dev/null 2>&1
npm install express dotenv > /dev/null 2>&1
echo -e "${GREEN}✓ Test environment ready${NC}"

echo -e "\n${YELLOW}3. Installing GhostTrace from tarball...${NC}"
npm install /home/wal8y/Desktop/graduation/ghosttrace-3.0.0.tgz > /dev/null 2>&1
echo -e "${GREEN}✓ Package installed${NC}"

echo -e "\n${YELLOW}4. Creating test application...${NC}"
cat > test-app.js << 'EOF'
require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

(async () => {
  try {
    await ghosttrace.init({
      adminEmail: 'test@test.com',
      adminPassword: 'TestPass123!',
      dashboardPort: 5001,
    });

    app.use('/api', ghosttrace.secure());

    app.get('/api/test', (req, res) => {
      res.json({ 
        success: true,
        dna: req.clientDNA,
        version: ghosttrace.version,
      });
    });

    const server = app.listen(5000, () => {
      console.log('TEST_READY');
    });

    // Auto-shutdown after 30 seconds
    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 30000);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
})();
EOF

cat > .env << EOF
GHOST_ADMIN_EMAIL=test@test.com
GHOST_ADMIN_PASS=TestPass123!
GHOST_PORT=5001
EOF

echo -e "${GREEN}✓ Test app created${NC}"

echo -e "\n${YELLOW}5. Starting test server...${NC}"
node test-app.js > test-output.log 2>&1 &
TEST_PID=$!

# Wait for server to be ready
timeout=30
while ! grep -q "TEST_READY" test-output.log 2>/dev/null; do
  sleep 1
  timeout=$((timeout - 1))
  if [ $timeout -le 0 ]; then
    echo -e "${RED}✗ Server failed to start${NC}"
    cat test-output.log
    kill $TEST_PID 2>/dev/null
    exit 1
  fi
done

echo -e "${GREEN}✓ Server started (PID: $TEST_PID)${NC}"

# Give it a moment to fully initialize
sleep 3

echo -e "\n${YELLOW}6. Running functional tests...${NC}"

# Test 1: Normal request
echo -n "   Testing normal request... "
RESPONSE=$(curl -s http://localhost:5000/api/test)
if echo "$RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $RESPONSE"
fi

# Test 2: DNA header
echo -n "   Testing DNA header... "
if curl -s -I http://localhost:5000/api/test | grep -q "X-Client-DNA"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
fi

# Test 3: Dashboard accessibility
echo -n "   Testing dashboard... "
if curl -s http://localhost:5001 | grep -q "GhostTrace"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
fi

# Test 4: Version check
echo -n "   Testing version export... "
if echo "$RESPONSE" | grep -q "3.0.0"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
fi

echo -e "\n${YELLOW}7. Cleaning up...${NC}"
kill $TEST_PID 2>/dev/null
wait $TEST_PID 2>/dev/null
cd /home/wal8y/Desktop/graduation
rm -rf "$TEST_DIR"
echo -e "${GREEN}✓ Cleanup complete${NC}"

echo -e "\n${GREEN}✅ All tests passed!${NC}"
echo -e "GhostTrace package is ready for publishing.\n"
```

### Make it executable and run

```bash
chmod +x test-local-package.sh
./test-local-package.sh
```

---

## Complete Testing Checklist

### ✅ Pre-Testing

- [ ] All code changes committed
- [ ] Version updated in package.json (3.0.0)
- [ ] README.md updated
- [ ] Dependencies correct
- [ ] .npmignore or files array in package.json configured

### ✅ Package Contents

```bash
npm pack
tar -tzf ghosttrace-3.0.0.tgz
```

Verify:
- [ ] index.js included
- [ ] index.d.ts included
- [ ] lib/ directory included
- [ ] All necessary source files included
- [ ] public/ directory included
- [ ] README.md included
- [ ] LICENSE included
- [ ] node_modules NOT included
- [ ] .env files NOT included
- [ ] .git directory NOT included

### ✅ Installation Test

- [ ] `npm install ./ghosttrace-3.0.0.tgz` works
- [ ] No installation errors
- [ ] Dependencies install correctly
- [ ] TypeScript definitions detected

### ✅ Functionality Test

- [ ] `require('ghosttrace')` works
- [ ] `ghosttrace.init()` initializes successfully
- [ ] `ghosttrace.secure()` returns middleware
- [ ] `ghosttrace.version` returns correct version
- [ ] Dashboard server starts
- [ ] Database auto-creates
- [ ] Admin user created
- [ ] Middleware protects routes
- [ ] DNA fingerprinting works
- [ ] Threat detection functional
- [ ] Rate limiting works
- [ ] Dashboard accessible
- [ ] Admin login successful

### ✅ Integration Test

- [ ] Works in fresh Express app
- [ ] TypeScript project compatible
- [ ] Examples run without modification
- [ ] Per-route config works
- [ ] Custom handlers work
- [ ] Error handling proper

### ✅ Performance Test

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Run load test
ab -n 1000 -c 10 http://localhost:4000/api/hello
```

- [ ] Handles 1000+ requests
- [ ] Response time < 50ms
- [ ] No memory leaks
- [ ] Rate limiting triggers correctly

### ✅ Documentation Test

- [ ] README renders correctly on GitHub
- [ ] Examples work as written
- [ ] API documented matches implementation
- [ ] TypeScript types work in IDE

---

## Quick Test Commands

```bash
# Quick validation
cd /home/wal8y/Desktop/graduation
npm pack
mkdir -p /tmp/quick-test && cd /tmp/quick-test
npm init -y
npm install express dotenv
npm install ../../../graduation/ghosttrace-3.0.0.tgz

# Create minimal test
cat > test.js << 'EOF'
const ghosttrace = require('ghosttrace');
const express = require('express');
const app = express();

(async () => {
  await ghosttrace.init({
    adminEmail: 'test@test.com',
    adminPassword: 'Test123!',
  });
  app.use(ghosttrace.secure());
  app.get('/test', (req, res) => res.json({ ok: true }));
  app.listen(3000, () => console.log('Ready'));
})();
EOF

# Run
node test.js &
sleep 3
curl http://localhost:3000/test
kill %1
```

---

## Troubleshooting

### "Cannot find module 'ghosttrace'"

```bash
# Check installation
npm list ghosttrace

# Reinstall
npm uninstall ghosttrace
npm install ./ghosttrace-3.0.0.tgz
```

### "Port already in use"

```bash
# Find process
lsof -ti:3001

# Kill process
lsof -ti:3001 | xargs kill -9
```

### Changes not reflecting

```bash
# If using npm link
cd /home/wal8y/Desktop/graduation
npm unlink -g
npm link

# If using tarball, recreate it
npm pack
# Reinstall in test project
```

### Files missing from package

Check `.npmignore` or add to package.json:

```json
{
  "files": [
    "index.js",
    "index.d.ts",
    "lib/",
    "middleware/",
    "services/",
    "models/",
    "core/",
    "utils/",
    "routes/",
    "config/",
    "public/",
    "README.md",
    "LICENSE"
  ]
}
```

---

## Final Pre-Publish Checklist

- [ ] All local tests pass
- [ ] Package size reasonable (< 5MB)
- [ ] No sensitive files included
- [ ] README renders correctly
- [ ] Version number correct
- [ ] Git tags created
- [ ] Changelog updated

Once all tests pass, you're ready to publish:

```bash
npm login
npm publish
```

---

## Recommended Testing Sequence

1. **Quick test:** `npm pack` + install in temp directory (5 min)
2. **Full test:** Run automated test script (10 min)
3. **Integration test:** Test with actual project setup (15 min)
4. **Documentation test:** Verify examples work (10 min)
5. **Performance test:** Load testing (5 min)

**Total: ~45 minutes of testing before publish**
