# GhostTrace Package Testing Guide

## 🔄 Rebuilding the Package

The package has been updated with:
- ✅ Embedded SQLite database
- ✅ Dashboard security (IP whitelist, rate limiting)
- ✅ Zero configuration mode
- ✅ Optional admin credentials

---

## 🚀 Quick Rebuild & Test

### Method 1: Automated Script

```bash
cd /home/wal8y/Desktop/graduation
./rebuild-package.sh
```

Then in your test project:
```bash
cd ~/test-ghosttrace
npm link ghosttrace
node test.js
```

---

### Method 2: Manual Steps

```bash
# 1. Go to GhostTrace package directory
cd /home/wal8y/Desktop/graduation

# 2. Install dependencies (including sqlite3)
npm install

# 3. Create npm link
npm link

# 4. Go to your test project
cd ~/test-ghosttrace

# 5. Link to the updated package
npm link ghosttrace

# 6. Test it
node test.js
```

---

## 🧪 What to Test

### 1. Zero Config Test (Embedded SQLite)

```javascript
// test.js
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

(async () => {
  // No config needed!
  await ghosttrace.init();
  
  app.use('/api', ghosttrace.secure());
  
  app.get('/api/test', (req, res) => {
    res.json({ message: 'Hello!' });
  });
  
  app.listen(3000, () => {
    console.log('App: http://localhost:3000');
    console.log('Dashboard: http://localhost:3001');
  });
})();
```

**Expected:**
- ✅ No errors about database
- ✅ SQLite database created at `./data/ghosttrace.sqlite`
- ✅ Dashboard accessible at http://localhost:3001
- ✅ Private by default (localhost only)

---

### 2. Dashboard Security Test

```javascript
// test-security.js
const ghosttrace = require('ghosttrace');

(async () => {
  await ghosttrace.init({
    dashboardIpWhitelist: ['192.168.1.0/24'],
    dashboardRateLimit: 50,
  });
})();
```

**Expected:**
- ✅ Shows "PRIVATE (1 IPs whitelisted)" in output
- ✅ Only whitelisted IPs can access dashboard

---

### 3. Custom Database Path Test

```javascript
// test-custom-db.js
const ghosttrace = require('ghosttrace');

(async () => {
  await ghosttrace.init({
    database: {
      type: 'sqlite',
      storage: './my-custom-path/security.db',
    },
  });
})();
```

**Expected:**
- ✅ Database created at `./my-custom-path/security.db`
- ✅ Directory auto-created if doesn't exist

---

## 📊 Expected Console Output

```
🚀 Initializing GhostTrace Security Layer...
ℹ Connecting to database...
✓ Database connected (localhost:5432/ghosttrace)
ℹ No admin credentials provided - use setup page on first run
✓ Dashboard server started on port 3001

👻 GhostTrace Security Layer Initialized
────────────────────────────────────────
🌐 Dashboard: http://localhost:3001
👤 Admin: Create via setup page
🗄️  Database: sqlite ✓
🔒 Dashboard: PRIVATE (localhost only)
🛡️  Protection: ACTIVE (blocking)
📊 Risk Threshold: 70
🚦 Rate Limit: 120 req/min
────────────────────────────────────────
```

---

## 🔍 Verify Installation

```bash
# Check if package is linked
cd ~/test-ghosttrace
ls -la node_modules/ghosttrace

# Should show symlink to /home/wal8y/Desktop/graduation

# Check database was created
ls -lh data/

# Should show ghosttrace.sqlite file
```

---

## 🐛 Troubleshooting

### "Cannot find module 'sqlite3'"

**Solution:**
```bash
cd /home/wal8y/Desktop/graduation
npm install sqlite3
npm link
```

### "EACCES: permission denied"

**Solution:**
```bash
cd /home/wal8y/Desktop/graduation
sudo chown -R $USER:$USER .
npm link
```

### Old version still loading

**Solution:**
```bash
# Unlink old version
cd ~/test-ghosttrace
npm unlink ghosttrace

# Link new version
cd /home/wal8y/Desktop/graduation
npm link
cd ~/test-ghosttrace
npm link ghosttrace
```

### Database file not created

**Solution:**
```bash
# Create data directory manually
mkdir -p data

# Check permissions
ls -la data/
```

---

## ✅ Success Checklist

After rebuilding and testing, verify:

- [ ] `npm link` completed without errors
- [ ] Test project linked successfully
- [ ] No errors when running `node test.js`
- [ ] SQLite database created at `./data/ghosttrace.sqlite`
- [ ] Dashboard accessible at http://localhost:3001
- [ ] Setup page appears (no admin exists yet)
- [ ] Can create admin account
- [ ] Dashboard shows "sqlite ✓" in database status
- [ ] Dashboard shows "PRIVATE (localhost only)"

---

## 🎯 New Features to Test

1. **Embedded Database:**
   - No external DB needed
   - SQLite file at `./data/ghosttrace.sqlite`

2. **Dashboard Security:**
   - Private by default (localhost only)
   - IP whitelisting works
   - Rate limiting active

3. **Zero Configuration:**
   - Works with `ghosttrace.init()` - no params
   - No .env file needed

4. **Optional Admin:**
   - Setup page creates admin
   - Auto-create via config still works

---

## 📝 Quick Commands

```bash
# Rebuild package
cd /home/wal8y/Desktop/graduation && npm install && npm link

# Link in test project
cd ~/test-ghosttrace && npm link ghosttrace

# Test
node test.js

# Check version
node -e "console.log(require('ghosttrace').version)"

# View database
sqlite3 data/ghosttrace.sqlite ".tables"
```

---

**Ready to test! 🚀**
