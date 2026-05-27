# Validating Agent Prompt: GhostTrace NPM Package Verification

## Mission
Validate that the GhostTrace transformation from standalone application to npm package has been implemented correctly and meets all requirements for ease of use, functionality, and reliability.

## Your Role
You are a QA engineer and integration specialist responsible for ensuring that:
1. The package can be installed and integrated easily
2. All existing functionality still works
3. The new API is intuitive and well-documented
4. No breaking changes affect current users
5. Security and performance standards are maintained

## Validation Checklist

### Phase 1: File Structure Validation

Verify the following files exist and are properly structured:

#### Core Files
- [ ] `index.js` - Main entry point exists
- [ ] `package.json` - Updated with correct metadata
- [ ] `README.md` - Contains integration guide
- [ ] `.env.example` - Updated with GHOST_ prefixed variables

#### Library Files
- [ ] `lib/init.js` - Initialization module
- [ ] `lib/middleware.js` - Middleware factory (secure function)
- [ ] `lib/dashboard-server.js` - Dashboard server
- [ ] `lib/config.js` - Configuration management
- [ ] `lib/setup-admin.js` - Admin user setup

#### Supporting Files
- [ ] `examples/express-basic.js` - Basic integration example
- [ ] `examples/express-social-media.js` - Social media example
- [ ] `examples/express-ecommerce.js` - E-commerce example
- [ ] `index.d.ts` - TypeScript definitions (optional but recommended)

### Phase 2: Code Quality Validation

For each file, verify:

#### index.js
```javascript
// Must export:
- init() function
- secure() function
- version string
- Default export for require() compatibility
```

**Validation:**
- [ ] Exports `init` function
- [ ] Exports `secure` function
- [ ] Exports `version` from package.json
- [ ] Has both module.exports and module.exports.default
- [ ] No syntax errors
- [ ] Proper require() paths

#### lib/init.js
```javascript
// Must:
- Accept config object
- Read from environment variables (GHOST_* prefix)
- Validate admin credentials
- Setup database connection
- Create/update admin user
- Start dashboard server
- Return initialized instance
- Log startup information
```

**Validation:**
- [ ] Config parameter defaults to empty object
- [ ] Reads GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASS
- [ ] Throws error if admin credentials missing
- [ ] Throws error with clear message format
- [ ] Calls setupDatabase() function
- [ ] Calls setupAdminUser() function
- [ ] Calls startDashboardServer() function
- [ ] Returns object with config, dashboardServer, and stop()
- [ ] Console logs include dashboard URL
- [ ] Console logs include admin email
- [ ] Console logs are formatted nicely (with emojis/boxes)
- [ ] Error handling for port conflicts
- [ ] Error handling for database connection failures
- [ ] Stores config in global.__ghosttrace_config

#### lib/middleware.js
```javascript
// Must:
- Export secure() function
- Accept options parameter
- Merge global config with route-specific options
- Call createProtectionMiddleware from middleware/protection.js
- Support riskThreshold, blockOnThreat, rateLimit options
```

**Validation:**
- [ ] Exports function named 'secure'
- [ ] Accepts optional options parameter
- [ ] Reads global.__ghosttrace_config
- [ ] Merges configs correctly (route options override global)
- [ ] Calls createProtectionMiddleware with merged config
- [ ] Returns Express middleware function
- [ ] Handles undefined global config gracefully
- [ ] Supports all protection.js options

#### lib/dashboard-server.js
```javascript
// Must:
- Create Express app for dashboard
- Mount all SOC/MDR routes
- Serve static files from public/
- Handle SPA routing
- Listen on configured port
- Return server instance
```

**Validation:**
- [ ] Creates new Express app
- [ ] Uses helmet() for security
- [ ] Uses cors() with proper config
- [ ] Uses express.json() and urlencoded()
- [ ] Mounts all routes: /api/auth, /api/soc, /api/alerts, /api/incidents, etc.
- [ ] Serves static files from ../public
- [ ] Has SPA fallback route (GET *)
- [ ] Listens on config.dashboardPort
- [ ] Returns Promise that resolves to server
- [ ] Error handling for port in use
- [ ] All routes use correct paths

#### lib/config.js
```javascript
// Must:
- Accept userConfig object
- Read environment variables with GHOST_ prefix
- Provide sensible defaults
- Have validate() method
- Store in global for middleware access
```

**Validation:**
- [ ] Constructor accepts userConfig parameter
- [ ] Reads GHOST_ADMIN_EMAIL, GHOST_ADMIN_PASS
- [ ] Reads GHOST_PORT, GHOST_PROXY
- [ ] Reads GHOST_BLOCK_THRESHOLD, GHOST_RATE_LIMIT, GHOST_BLOCK_ON_THREAT
- [ ] Has getDatabaseConfig() method
- [ ] Has getAIConfig() method
- [ ] Has validate() method
- [ ] validate() checks for required fields
- [ ] validate() throws error with clear message
- [ ] Stores self in global.__ghosttrace_config
- [ ] Default values are reasonable

#### lib/setup-admin.js
```javascript
// Must:
- Accept email and password
- Hash password with bcrypt
- Create or update admin user
- Return user object
```

**Validation:**
- [ ] Exports async function
- [ ] Accepts email and password parameters
- [ ] Uses bcrypt.hash() with proper salt rounds
- [ ] Uses User.upsert() or equivalent
- [ ] Sets role to 'admin'
- [ ] Returns user object
- [ ] Logs success message
- [ ] Handles duplicate email gracefully

### Phase 3: Integration Testing

Create a test Express application and verify:

#### Test App Setup
```javascript
// test-app.js
const express = require('express');
const ghosttrace = require('./index'); // Local link

const app = express();

(async () => {
  await ghosttrace.init({
    adminEmail: 'test@example.com',
    adminPassword: 'TestPassword123!',
    dashboardPort: 4001,
  });

  app.use('/api/test', ghosttrace.secure());

  app.get('/api/test', (req, res) => {
    res.json({ message: 'Hello World' });
  });

  app.listen(4000, () => {
    console.log('Test app running on 4000');
  });
})();
```

**Run Tests:**
- [ ] App starts without errors
- [ ] Console shows GhostTrace initialization message
- [ ] Dashboard URL is displayed
- [ ] Dashboard server starts on port 4001
- [ ] Main app runs on port 4000
- [ ] GET http://localhost:4000/api/test returns 200
- [ ] Response includes X-Client-DNA header
- [ ] Dashboard accessible at http://localhost:4001
- [ ] Can login with test@example.com / TestPassword123!

### Phase 4: Functionality Testing

#### Middleware Protection
Test that routes are properly protected:

**Test 1: Normal Request**
```bash
curl http://localhost:4000/api/test
```
- [ ] Returns 200 OK
- [ ] Includes X-Client-DNA header
- [ ] Request is logged

**Test 2: Malicious Request (SQL Injection)**
```bash
curl "http://localhost:4000/api/test?id=1' OR '1'='1"
```
- [ ] Returns 403 Forbidden (if blockOnThreat is true)
- [ ] Includes X-Blocked-By header
- [ ] Includes riskScore in response
- [ ] Alert created in dashboard

**Test 3: Rate Limiting**
```bash
for i in {1..150}; do curl http://localhost:4000/api/test; done
```
- [ ] First 120 requests succeed
- [ ] Subsequent requests return 429
- [ ] Includes Retry-After header
- [ ] Rate limit resets after window

**Test 4: Per-Route Configuration**
```javascript
app.use('/api/high-security', ghosttrace.secure({ riskThreshold: 50 }));
app.use('/api/low-security', ghosttrace.secure({ riskThreshold: 90 }));
```
- [ ] High security route blocks at score 50+
- [ ] Low security route blocks at score 90+
- [ ] Configurations are independent

#### Dashboard Functionality
- [ ] Login page accessible at /login.html
- [ ] Can login with admin credentials
- [ ] Redirects to dashboard after login
- [ ] Command Center shows stats
- [ ] Alert Queue shows alerts
- [ ] Incidents page loads
- [ ] Threat Hunt page works
- [ ] MITRE ATT&CK page displays
- [ ] Behavioral Profiles loads
- [ ] AI Triage page accessible
- [ ] Policy page loads
- [ ] Integrations page loads
- [ ] Audit Trail shows logs
- [ ] All API endpoints respond correctly

### Phase 5: Database Validation

#### Auto-Creation
- [ ] Database is created if it doesn't exist (Postgres)
- [ ] Falls back to SQLite if no config provided
- [ ] All tables are created automatically
- [ ] Migrations run successfully
- [ ] No manual SQL required

#### Data Persistence
- [ ] Admin user persists between restarts
- [ ] Alerts are saved to database
- [ ] Incidents are saved
- [ ] Behavioral profiles persist
- [ ] Request logs are stored
- [ ] Audit trail is maintained

### Phase 6: Configuration Validation

#### Environment Variables
Test that all GHOST_ prefixed variables work:

```env
GHOST_ADMIN_EMAIL=admin@test.com
GHOST_ADMIN_PASS=SecurePass123!
GHOST_PORT=5001
GHOST_PROXY=5002
GHOST_BLOCK_THRESHOLD=80
GHOST_RATE_LIMIT=100
GHOST_BLOCK_ON_THREAT=false
GHOST_DB_TYPE=postgres
GHOST_DB_HOST=localhost
GHOST_DB_PORT=5432
GHOST_DB_NAME=ghost_test
GHOST_DB_USER=postgres
GHOST_DB_PASS=postgres
```

**Validation:**
- [ ] Dashboard runs on port 5001
- [ ] Block threshold is 80
- [ ] Rate limit is 100
- [ ] Blocking is disabled (passive mode)
- [ ] Connects to specified database
- [ ] Admin login works with configured credentials

#### Programmatic Configuration
Test that programmatic config overrides env vars:

```javascript
await ghosttrace.init({
  adminEmail: 'override@test.com',
  adminPassword: 'OverridePass123!',
  dashboardPort: 6001,
  blockThreshold: 90,
});
```

**Validation:**
- [ ] Uses programmatic config values
- [ ] Ignores environment variables
- [ ] All options work as specified

### Phase 7: Error Handling Validation

#### Missing Required Config
```javascript
await ghosttrace.init({}); // No admin credentials
```
- [ ] Throws clear error
- [ ] Error message mentions GHOST_ADMIN_EMAIL
- [ ] Error message mentions GHOST_ADMIN_PASS
- [ ] Doesn't start dashboard
- [ ] Doesn't create database connection

#### Port Conflicts
```javascript
// Start two instances on same port
await ghosttrace.init({ adminEmail: '...', adminPassword: '...', dashboardPort: 3001 });
await ghosttrace.init({ adminEmail: '...', adminPassword: '...', dashboardPort: 3001 });
```
- [ ] Second init throws/rejects
- [ ] Error message is clear
- [ ] First instance continues running

#### Database Connection Failure
```javascript
await ghosttrace.init({
  adminEmail: 'test@test.com',
  adminPassword: 'Test123!',
  database: {
    type: 'postgres',
    host: 'invalid-host',
    port: 9999,
  },
});
```
- [ ] Logs warning about database failure
- [ ] Falls back to SQLite
- [ ] App continues to run
- [ ] Dashboard is accessible

### Phase 8: Documentation Validation

#### README.md
- [ ] Installation instructions are clear
- [ ] Quick start example works as written
- [ ] Environment variables are documented
- [ ] All configuration options explained
- [ ] Examples are provided
- [ ] Dashboard access is explained
- [ ] Features list is accurate
- [ ] License is included

#### Examples
For each example file:
- [ ] Code runs without modifications
- [ ] Comments explain each step
- [ ] Uses realistic use case
- [ ] Shows best practices
- [ ] Demonstrates key features

#### Code Comments
- [ ] Complex logic is commented
- [ ] Function parameters are documented
- [ ] Return values are documented
- [ ] Error conditions are explained
- [ ] Configuration options are described

### Phase 9: Backward Compatibility

#### Existing server.js
- [ ] Still runs as standalone app
- [ ] `node server.js` works as before
- [ ] All routes still accessible
- [ ] Dashboard runs on same port
- [ ] No breaking changes to existing deployments

#### API Compatibility
- [ ] All existing API endpoints work
- [ ] Response formats unchanged
- [ ] Authentication still works
- [ ] Middleware behavior consistent

### Phase 10: Security Validation

#### Admin Credentials
- [ ] Password is hashed with bcrypt
- [ ] Password not logged or exposed
- [ ] Minimum password length enforced
- [ ] Email validation (basic)

#### Middleware Security
- [ ] DNA fingerprinting works
- [ ] Anomaly detection functions
- [ ] SQL injection detected
- [ ] XSS prevention works
- [ ] Rate limiting effective
- [ ] Blocked requests logged

#### Dashboard Security
- [ ] Requires authentication
- [ ] JWT tokens are secure
- [ ] Sensitive data not exposed in logs
- [ ] CORS configured properly
- [ ] Helmet security headers present

### Phase 11: Performance Validation

#### Startup Time
- [ ] Init completes in < 5 seconds
- [ ] Database connection is fast
- [ ] Dashboard starts quickly

#### Runtime Performance
- [ ] Middleware adds < 10ms latency
- [ ] No memory leaks
- [ ] Handles 100+ requests/second
- [ ] Database queries optimized

#### Resource Usage
- [ ] Memory usage reasonable (< 200MB for dashboard)
- [ ] CPU usage low when idle
- [ ] No excessive logging

### Phase 12: Package Validation

#### package.json
- [ ] Name is correct ('ghosttrace')
- [ ] Version follows semver
- [ ] Main points to index.js
- [ ] Files array includes all necessary files
- [ ] Dependencies are correct
- [ ] peerDependencies includes express
- [ ] Scripts are appropriate
- [ ] Keywords are relevant
- [ ] License is specified

#### NPM Link Test
```bash
cd /path/to/ghosttrace
npm link

cd /path/to/test-app
npm link ghosttrace
```
- [ ] Link creates successfully
- [ ] Test app can require('ghosttrace')
- [ ] All exports are available
- [ ] No module resolution errors

## Validation Report Template

After completing all checks, generate a report:

```markdown
# GhostTrace NPM Package Validation Report

## Summary
- Total Checks: [X]
- Passed: [X]
- Failed: [X]
- Warnings: [X]

## Critical Issues (Must Fix)
1. [Issue description]
   - Location: [file:line]
   - Expected: [what should happen]
   - Actual: [what currently happens]
   - Fix: [suggested fix]

## Non-Critical Issues (Should Fix)
1. [Issue description]
   - Severity: Low/Medium
   - Impact: [description]
   - Suggestion: [recommendation]

## Warnings (Nice to Have)
1. [Issue description]
   - Suggestion: [recommendation]

## Passed Validations
- ✅ File structure correct
- ✅ Configuration system working
- ✅ Database auto-creation successful
- ✅ Middleware protection functioning
- ✅ Dashboard accessible
- ✅ Examples working
- ✅ Documentation complete
- ✅ Backward compatible
- ✅ Security validated
- ✅ Performance acceptable

## Test Results

### Integration Test
- Test App Startup: ✅ PASS
- Middleware Protection: ✅ PASS
- Dashboard Access: ✅ PASS
- Admin Login: ✅ PASS

### Functionality Test
- Normal Requests: ✅ PASS
- Malicious Requests: ✅ PASS
- Rate Limiting: ✅ PASS
- Per-Route Config: ✅ PASS

### Database Test
- Auto-Creation: ✅ PASS
- Data Persistence: ✅ PASS
- SQLite Fallback: ✅ PASS

### Configuration Test
- Environment Variables: ✅ PASS
- Programmatic Config: ✅ PASS
- Config Validation: ✅ PASS

### Error Handling Test
- Missing Config: ✅ PASS
- Port Conflicts: ✅ PASS
- DB Failures: ✅ PASS

## Recommendations

1. **High Priority**
   - [Recommendation]

2. **Medium Priority**
   - [Recommendation]

3. **Low Priority**
   - [Recommendation]

## Conclusion

The GhostTrace npm package transformation is [COMPLETE / INCOMPLETE].

[Summary of overall state and readiness for release]
```

## Validation Commands Reference

### Quick Test Script
Create `validate.sh`:

```bash
#!/bin/bash
echo "Starting GhostTrace Validation..."

# Check file structure
echo "✓ Checking file structure..."
test -f index.js || echo "❌ Missing index.js"
test -f lib/init.js || echo "❌ Missing lib/init.js"
test -f lib/middleware.js || echo "❌ Missing lib/middleware.js"
test -f lib/dashboard-server.js || echo "❌ Missing lib/dashboard-server.js"

# Check syntax
echo "✓ Checking syntax..."
node -c index.js || echo "❌ Syntax error in index.js"
node -c lib/init.js || echo "❌ Syntax error in lib/init.js"

# Try to require
echo "✓ Testing require..."
node -e "require('./index')" || echo "❌ Cannot require index.js"

# Run test app
echo "✓ Running test app..."
node test-app.js &
PID=$!
sleep 3

# Test endpoints
echo "✓ Testing endpoints..."
curl -s http://localhost:4000/api/test > /dev/null && echo "✅ Main app working" || echo "❌ Main app failed"
curl -s http://localhost:4001 > /dev/null && echo "✅ Dashboard working" || echo "❌ Dashboard failed"

# Cleanup
kill $PID

echo "Validation complete!"
```

## Final Checklist

Before approving the implementation:

- [ ] All critical files exist
- [ ] No syntax errors
- [ ] Test app runs successfully
- [ ] Dashboard accessible
- [ ] Authentication works
- [ ] Middleware protects routes
- [ ] Database auto-creates
- [ ] Admin user created
- [ ] Configuration system works
- [ ] Error handling is robust
- [ ] Documentation is complete
- [ ] Examples work
- [ ] Backward compatible
- [ ] Security validated
- [ ] Performance acceptable
- [ ] Package.json correct
- [ ] NPM link test passes

**Only approve if ALL items are checked ✅**

## Next Steps After Validation

If validation passes:
1. Generate validation report
2. List any minor improvements
3. Approve for release

If validation fails:
1. Generate detailed failure report
2. Prioritize issues (critical → non-critical)
3. Provide specific fixes for each issue
4. Request re-implementation
5. Re-validate after fixes
