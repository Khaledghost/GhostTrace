# GhostTrace NPM Package Implementation Guide

## Overview

This guide contains everything needed to transform GhostTrace from a standalone application into a user-friendly npm package that developers can easily integrate into their backends.

## What's Changing?

### Before (Current State)
```javascript
// User has to clone entire repo and run as standalone server
git clone https://github.com/user/ghosttrace
cd ghosttrace
npm install
# Edit .env file
npm start
```

### After (Target State)
```javascript
// User installs as npm package
npm install ghosttrace

// In their existing app (e.g., social-media-backend/server.js)
const ghosttrace = require('ghosttrace');

await ghosttrace.init({
  adminEmail: process.env.GHOST_ADMIN_EMAIL,
  adminPassword: process.env.GHOST_ADMIN_PASS,
});

// Secure any route with one line
app.use('/api/auth', ghosttrace.secure());
```

**Result:** Dashboard runs on http://localhost:3001, main app runs on http://localhost:3000

## Implementation Flow

### Step 1: Review the Plan
Read `RESTRUCTURING_PLAN.md` to understand the complete architecture transformation.

**Key Points:**
- Separate dashboard server from main app
- Simple `ghosttrace.init()` and `ghosttrace.secure()` API
- Environment variables prefixed with `GHOST_`
- Auto-create database and admin user
- Zero-config mode with sensible defaults

### Step 2: Give Prompt to Coding Agent
Use the complete prompt from `CODING_AGENT_PROMPT.md`

**What to say to coding agent:**
```
Please implement the GhostTrace NPM package transformation according to the detailed specification in CODING_AGENT_PROMPT.md.

Read the file at /home/wal8y/Desktop/graduation/CODING_AGENT_PROMPT.md and implement everything specified there.

Key requirements:
1. Create index.js as main entry point
2. Create lib/ directory with init.js, middleware.js, dashboard-server.js, config.js, setup-admin.js
3. Update package.json for npm package distribution
4. Create examples/ directory with integration examples
5. Update README.md with user-focused integration guide
6. Ensure backward compatibility with existing server.js
7. Add comprehensive error handling and logging
8. Create .env.example with GHOST_ prefixed variables

Follow the checklist at the end of the prompt and mark each item as complete when done.
```

### Step 3: Test the Implementation
After coding is complete, manually test:

```bash
# Create test app
mkdir ../test-app
cd ../test-app
npm init -y
npm install express

# Link to your local ghosttrace
cd /home/wal8y/Desktop/graduation
npm link

cd ../test-app
npm link ghosttrace
```

Create `test-app.js`:
```javascript
require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

(async () => {
  await ghosttrace.init({
    adminEmail: 'admin@test.com',
    adminPassword: 'TestPass123!',
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

Run and verify:
```bash
node test-app.js

# In another terminal:
curl http://localhost:4000/api/hello
# Should return: {"message":"Hello World"}

# Open browser:
# http://localhost:4001 - Dashboard should be accessible
# Login with admin@test.com / TestPass123!
```

### Step 4: Give Prompt to Validating Agent
Use the complete validation checklist from `VALIDATING_AGENT_PROMPT.md`

**What to say to validating agent:**
```
Please validate the GhostTrace NPM package implementation according to the comprehensive checklist in VALIDATING_AGENT_PROMPT.md.

Read the file at /home/wal8y/Desktop/graduation/VALIDATING_AGENT_PROMPT.md and perform all validation checks.

Run through:
1. Phase 1: File Structure Validation
2. Phase 2: Code Quality Validation
3. Phase 3: Integration Testing
4. Phase 4: Functionality Testing
5. Phase 5: Database Validation
6. Phase 6: Configuration Validation
7. Phase 7: Error Handling Validation
8. Phase 8: Documentation Validation
9. Phase 9: Backward Compatibility
10. Phase 10: Security Validation
11. Phase 11: Performance Validation
12. Phase 12: Package Validation

Generate a validation report using the template provided at the end of the prompt.

List all issues found, categorized as:
- CRITICAL (must fix before release)
- NON-CRITICAL (should fix)
- WARNINGS (nice to have)

For each issue, provide:
- Exact location (file:line)
- Expected behavior
- Actual behavior
- Suggested fix
```

### Step 5: Review and Iterate

After validation agent report:

1. **If CRITICAL issues found:**
   - Fix issues immediately
   - Re-run validation
   - Repeat until no critical issues

2. **If only NON-CRITICAL issues:**
   - Evaluate priority
   - Fix important ones
   - Document others for future releases

3. **If all checks pass:**
   - Proceed to final review
   - Prepare for release

## Key Files Created

After implementation, you should have:

```
ghosttrace/
├── index.js                          ← Main entry point
├── package.json                      ← Updated for npm
├── README.md                         ← User-focused guide
├── .env.example                      ← GHOST_ variables
│
├── lib/
│   ├── init.js                       ← Initialize GhostTrace
│   ├── middleware.js                 ← secure() function
│   ├── dashboard-server.js           ← Separate dashboard
│   ├── config.js                     ← Config management
│   └── setup-admin.js                ← Admin user creation
│
├── examples/
│   ├── express-basic.js              ← Simple example
│   ├── express-social-media.js       ← Social media example
│   └── express-ecommerce.js          ← E-commerce example
│
├── server.js                         ← (Keep for backward compat)
└── [existing files unchanged]
```

## Environment Variables Reference

### Required
```env
GHOST_ADMIN_EMAIL=admin@company.com
GHOST_ADMIN_PASS=SecurePassword123!
```

### Optional
```env
GHOST_PORT=3001                       # Dashboard port
GHOST_PROXY=3002                      # Proxy port
GHOST_BLOCK_THRESHOLD=70              # Risk score to block
GHOST_RATE_LIMIT=120                  # Requests per minute
GHOST_BLOCK_ON_THREAT=true           # Enable blocking

# Database
GHOST_DB_TYPE=postgres
GHOST_DB_HOST=localhost
GHOST_DB_PORT=5432
GHOST_DB_NAME=ghosttrace
GHOST_DB_USER=postgres
GHOST_DB_PASS=password

# AI
GHOST_AI_PROVIDER=openai
GHOST_AI_KEY=sk-...
```

## Integration Examples

### Example 1: Basic Express App
```javascript
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

await ghosttrace.init({
  adminEmail: 'admin@company.com',
  adminPassword: 'SecurePass123!',
});

app.use('/api', ghosttrace.secure());

app.listen(3000);
```

### Example 2: Social Media Backend
```javascript
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

await ghosttrace.init({
  adminEmail: process.env.GHOST_ADMIN_EMAIL,
  adminPassword: process.env.GHOST_ADMIN_PASS,
  dashboardPort: 3001,
});

// High security for auth
app.use('/api/auth', ghosttrace.secure({ riskThreshold: 60 }));

// Standard security for posts
app.use('/api/posts', ghosttrace.secure());

// Monitor only for public endpoints
app.use('/api/public', ghosttrace.secure({ blockOnThreat: false }));

app.post('/api/auth/login', loginHandler);
app.get('/api/posts', getPostsHandler);
app.post('/api/posts', createPostHandler);

app.listen(3000);
```

### Example 3: Microservices
```javascript
// Each microservice includes ghosttrace
const ghosttrace = require('ghosttrace');

// Auth Service (port 3000)
await ghosttrace.init({
  adminEmail: 'admin@company.com',
  adminPassword: 'SecurePass123!',
  dashboardPort: 4001,  // Unique dashboard port
});

// User Service (port 3001)
await ghosttrace.init({
  adminEmail: 'admin@company.com',
  adminPassword: 'SecurePass123!',
  dashboardPort: 4002,  // Different dashboard port
});

// Each service has its own dashboard but shares data if using same DB
```

## Success Criteria

Implementation is complete when a developer can:

1. ✅ Run `npm install ghosttrace`
2. ✅ Add 5-10 lines to their Express app
3. ✅ Set 2 environment variables (admin email/pass)
4. ✅ Start their app and see GhostTrace initialized
5. ✅ Access dashboard at displayed URL
6. ✅ Login and see their app's traffic
7. ✅ All routes are automatically protected

**Total time: < 5 minutes from install to full protection**

## Common Issues and Solutions

### Issue: Port already in use
**Solution:** Set different `GHOST_PORT` in env or config

### Issue: Database connection failed
**Solution:** Package should auto-fallback to SQLite

### Issue: Admin credentials missing
**Solution:** Clear error message telling user to set GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASS

### Issue: Middleware not protecting routes
**Solution:** Ensure `ghosttrace.init()` is called before `ghosttrace.secure()`

## Release Checklist

Before publishing to npm:

- [ ] All validation checks pass
- [ ] Examples run successfully
- [ ] Documentation is complete
- [ ] README has quick start guide
- [ ] package.json is correct
- [ ] .npmignore excludes dev files
- [ ] Version number updated (3.0.0)
- [ ] Changelog created
- [ ] License file present
- [ ] Test with `npm pack` and install in fresh project
- [ ] Verify on clean machine

## Publishing to NPM

```bash
# Test package locally
npm pack
# This creates ghosttrace-3.0.0.tgz

# Test in another project
cd /tmp/test-project
npm install /home/wal8y/Desktop/graduation/ghosttrace-3.0.0.tgz

# If all good, publish
cd /home/wal8y/Desktop/graduation
npm login
npm publish
```

## Post-Release

1. Update GitHub README
2. Create release tag (v3.0.0)
3. Announce on social media
4. Update examples repository
5. Create migration guide for existing users
6. Monitor issues and feedback

## Support Plan

Expected user questions:
1. "How do I configure the database?"
2. "Can I use MongoDB instead of Postgres?"
3. "How do I secure only specific routes?"
4. "Can I run multiple instances?"
5. "How do I customize the dashboard?"

Prepare documentation for each.

## Future Enhancements

Consider for v3.1.0:
- CLI tool for management
- Multiple admin users
- Dashboard theming
- Webhook alerts
- Slack integration
- Docker compose generator
- Health check endpoints
- Metrics export (Prometheus)

## Contact

Questions about implementation:
- Review the plan documents
- Check examples
- Test with sample app
- Run validation checks

Ready to proceed? Start with Step 2: Give the prompt to coding agent.
