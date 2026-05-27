# GhostTrace v3.0.0 - Pre-Release Checklist

Use this checklist before publishing to npm.

---

## ✅ Validation Complete

- [x] All core functionality tested
- [x] Integration tests passing (8/8)
- [x] Validation tests passing (5/5 phases)
- [x] Documentation complete
- [x] Examples working
- [x] No critical issues found
- [x] Security validated
- [x] Backward compatibility confirmed

---

## 📦 Package Testing (Required)

### Test 1: Pack and Install
```bash
# In GhostTrace directory
npm pack

# This creates: ghosttrace-3.0.0.tgz
# Move to test directory
cd /path/to/test-project
npm install /path/to/ghosttrace-3.0.0.tgz

# Test it works
node -e "const gt = require('ghosttrace'); console.log('Version:', gt.version);"
```
- [ ] Package created successfully
- [ ] Package installs without errors
- [ ] Module can be required
- [ ] All exports accessible

### Test 2: NPM Link
```bash
# In GhostTrace directory
npm link

# In test project directory
cd /path/to/test-project
npm link ghosttrace

# Test integration
node test-app.js
```
- [ ] Link created successfully
- [ ] Test app can require ghosttrace
- [ ] Init works correctly
- [ ] Middleware works correctly
- [ ] Dashboard accessible

### Test 3: Fresh Install Test
```bash
# Create new test project
mkdir test-ghosttrace && cd test-ghosttrace
npm init -y
npm install express

# Install GhostTrace from tarball
npm install /path/to/ghosttrace-3.0.0.tgz

# Create test file
cat > test.js << 'EOF'
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

(async () => {
  await ghosttrace.init({
    adminEmail: 'test@example.com',
    adminPassword: 'TestPass123!',
  });

  app.use('/api', ghosttrace.secure());
  
  app.get('/api/test', (req, res) => {
    res.json({ message: 'It works!' });
  });

  app.listen(3000, () => {
    console.log('Test app running on port 3000');
  });
})();
EOF

# Run test
node test.js
```
- [ ] Package installs cleanly
- [ ] No dependency errors
- [ ] App starts without errors
- [ ] Dashboard accessible
- [ ] API endpoint works

---

## 🔍 Cross-Platform Testing (Recommended)

### Node.js Versions
Test on multiple Node.js versions:
```bash
# Using nvm
nvm use 14 && npm test
nvm use 16 && npm test
nvm use 18 && npm test
nvm use 20 && npm test
```
- [ ] Node.js 14.x
- [ ] Node.js 16.x
- [ ] Node.js 18.x
- [ ] Node.js 20.x

### Operating Systems
Test on different platforms:
- [ ] Linux (Ubuntu/Debian)
- [ ] macOS
- [ ] Windows 10/11

---

## 🔒 Security Checks (Required)

```bash
# Run npm audit
npm audit

# Check for vulnerabilities
npm audit fix

# Verify no high/critical issues
```
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities
- [ ] Dependencies up to date

---

## 📝 Documentation Updates (Required)

### CHANGELOG.md
Create or update CHANGELOG.md:
```markdown
# Changelog

## [3.0.0] - 2026-05-27

### Added
- 🎉 NPM package distribution support
- 3-line integration API
- GHOST_ prefixed environment variables
- Comprehensive TypeScript definitions
- Three integration examples (basic, social media, e-commerce)

### Changed
- Simplified initialization API
- Improved configuration system
- Enhanced error messages
- Better database fallback handling

### Fixed
- Configuration validation edge cases
- Dashboard port conflict handling
- Database connection retry logic

### Breaking Changes
- None - fully backward compatible
```
- [ ] CHANGELOG.md created/updated
- [ ] Version number correct (3.0.0)
- [ ] Release date added
- [ ] All changes documented

### README.md
Verify README is current:
- [ ] Installation command correct
- [ ] Quick start example works
- [ ] Configuration documented
- [ ] Examples listed
- [ ] Links are valid

### package.json
Verify all fields:
- [ ] Version: 3.0.0
- [ ] Name: ghosttrace
- [ ] Description accurate
- [ ] Keywords relevant
- [ ] Repository URL correct
- [ ] License: MIT
- [ ] Main: index.js
- [ ] Types: index.d.ts
- [ ] Files array complete

---

## 🏷️ Git Tagging (Required)

```bash
# Ensure all changes are committed
git status

# Tag the release
git tag -a v3.0.0 -m "Release v3.0.0 - NPM package"

# Push tag to remote
git push origin v3.0.0

# Or push all tags
git push --tags
```
- [ ] All changes committed
- [ ] Working directory clean
- [ ] Tag created: v3.0.0
- [ ] Tag pushed to remote

---

## 🚀 GitHub Release (Recommended)

Create GitHub release:
1. Go to repository on GitHub
2. Click "Releases" → "Draft a new release"
3. Choose tag: v3.0.0
4. Title: "v3.0.0 - NPM Package Release"
5. Description:
```markdown
## 🎉 GhostTrace v3.0.0 - Now Available on NPM!

GhostTrace is now available as an npm package for easy integration into any Express application.

### Installation
```bash
npm install ghosttrace
```

### Quick Start
```javascript
const ghosttrace = require('ghosttrace');
await ghosttrace.init({ adminEmail: '...', adminPassword: '...' });
app.use('/api', ghosttrace.secure());
```

### What's New
- ✨ NPM package distribution
- ✨ 3-line integration
- ✨ GHOST_ prefixed environment variables
- ✨ TypeScript support
- ✨ Three integration examples

### Documentation
- [README](README.md) - Complete integration guide
- [Examples](examples/) - Working integration examples
- [Validation Report](VALIDATION_REPORT.md) - Full validation results

### Backward Compatibility
Fully backward compatible - existing deployments continue to work without changes.

**Full Changelog:** [CHANGELOG.md](CHANGELOG.md)
```
6. Attach: ghosttrace-3.0.0.tgz (from npm pack)
7. Click "Publish release"

- [ ] GitHub release created
- [ ] Release notes added
- [ ] Package tarball attached

---

## 📊 Performance Testing (Optional but Recommended)

### Basic Performance Test
```javascript
// benchmark.js
const { performance } = require('perf_hooks');

// Test middleware latency
const iterations = 10000;
const latencies = [];

for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  // Simulate middleware call
  const end = performance.now();
  latencies.push(end - start);
}

latencies.sort((a, b) => a - b);
console.log('P50:', latencies[Math.floor(iterations * 0.5)], 'ms');
console.log('P95:', latencies[Math.floor(iterations * 0.95)], 'ms');
console.log('P99:', latencies[Math.floor(iterations * 0.99)], 'ms');
```
- [ ] Middleware latency < 10ms (P95)
- [ ] Memory usage stable
- [ ] No memory leaks

### Load Testing
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Run load test
ab -n 10000 -c 100 http://localhost:3000/api/test
```
- [ ] Handles 100+ req/sec
- [ ] Error rate < 1%
- [ ] Response times acceptable

---

## 🎯 Final Pre-Publish Checks

### Critical Checks
- [ ] `npm test` passes (if test script exists)
- [ ] `npm run build` successful (if build script exists)
- [ ] No uncommitted changes (`git status`)
- [ ] Version bumped in package.json
- [ ] README.md accurate
- [ ] LICENSE file exists
- [ ] .npmignore or files array configured

### NPM Account Setup
```bash
# Login to npm
npm login

# Verify logged in
npm whoami

# Check package availability
npm view ghosttrace
```
- [ ] Logged into npm account
- [ ] Have publish permissions
- [ ] Package name available (or you own it)

### Dry Run
```bash
# Test publish without actually publishing
npm publish --dry-run

# Review what will be published
```
- [ ] Dry run successful
- [ ] File list looks correct
- [ ] Size is reasonable

---

## 🚀 Publishing

### Final Publish Command
```bash
# Publish to npm
npm publish

# For scoped packages (if needed)
npm publish --access public
```

### Post-Publish Verification
```bash
# Wait 2-3 minutes for npm to update

# Install from npm
npm install ghosttrace

# Verify version
npm view ghosttrace version

# Test installation
node -e "console.log(require('ghosttrace').version)"
```
- [ ] Package published successfully
- [ ] Visible on npmjs.com
- [ ] Can be installed
- [ ] Version correct

---

## 📢 Announcement (Optional)

After successful publication:

1. **Update Repository README**
   - Add npm version badge
   - Add npm download badge
   - Update installation instructions

2. **Social Media**
   - Tweet about release
   - Post on relevant Reddit communities
   - Share in Discord/Slack communities

3. **Documentation Site**
   - Update docs if you have a docs site
   - Add migration guide

4. **Email/Blog**
   - Write release announcement
   - Send to existing users

---

## 📋 Post-Release Checklist

- [ ] Package visible on npmjs.com
- [ ] Can be installed globally
- [ ] Examples work with published version
- [ ] GitHub release created
- [ ] Documentation updated
- [ ] Community notified (if applicable)

---

## 🆘 Rollback Plan

If something goes wrong:

```bash
# Unpublish within 72 hours (use sparingly)
npm unpublish ghosttrace@3.0.0

# Or deprecate the version
npm deprecate ghosttrace@3.0.0 "Deprecated due to [reason]"

# Publish fixed version
npm version patch  # Creates 3.0.1
npm publish
```

---

## ✅ Completion

Once all critical and required items are checked:
```bash
npm publish
```

**Congratulations! 🎉 GhostTrace is now on npm!**

---

*Last Updated: May 27, 2026*
