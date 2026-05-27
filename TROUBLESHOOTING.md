# GhostTrace Troubleshooting Guide

## Database Connection Issues

### Quick Fix: Run Without Database

Add this to your `.env` file:

```env
# Required
GHOST_ADMIN_EMAIL=admin@test.com
GHOST_ADMIN_PASS=test12345

# Disable database (run in-memory only)
DB_ENABLED=false
```

This will run GhostTrace without database persistence. All data will be in-memory only.

### Fix #2: Check Database Credentials

Make sure your database credentials are correct in `.env`:

```env
GHOST_DB_TYPE=postgres
GHOST_DB_HOST=localhost
GHOST_DB_PORT=5432
GHOST_DB_NAME=ghosttrace
GHOST_DB_USER=postgres
GHOST_DB_PASS=your_password
```

### Fix #3: Ensure PostgreSQL is Running

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Or on macOS
brew services list | grep postgresql

# Or check if port 5432 is listening
netstat -an | grep 5432
```

### Fix #4: Start PostgreSQL

```bash
# Linux
sudo systemctl start postgresql

# macOS
brew services start postgresql

# Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres
```

---

## Common Error Messages

### "Could not auto-create database"

**Cause:** Can't connect to PostgreSQL or insufficient permissions.

**Fix:** Either:
1. Set `DB_ENABLED=false` to skip database
2. Check database credentials
3. Make sure PostgreSQL is running

### "Port already in use"

**Cause:** Another service is using port 3001.

**Fix:** Change the port in `.env`:

```env
GHOST_PORT=3002
```

### "Admin email/password required"

**Cause:** Missing required credentials.

**Fix:** Add to `.env`:

```env
GHOST_ADMIN_EMAIL=admin@example.com
GHOST_ADMIN_PASS=password123
```

---

## Testing Without Database

### Minimal .env for Testing

```env
# Required
GHOST_ADMIN_EMAIL=admin@test.com
GHOST_ADMIN_PASS=test12345

# Disable database
DB_ENABLED=false

# Optional
GHOST_PORT=3001
GHOST_BLOCK_THRESHOLD=70
```

### Test Script

```javascript
// test.js
require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

(async () => {
  // Initialize without database
  await ghosttrace.init({
    adminEmail: 'admin@test.com',
    adminPassword: 'test12345',
  });

  // Protect routes
  app.use('/api', ghosttrace.secure());

  // Test route
  app.get('/api/test', (req, res) => {
    res.json({ message: 'Protected route works!' });
  });

  app.listen(3000, () => {
    console.log('Test app running on http://localhost:3000');
    console.log('Dashboard at http://localhost:3001');
  });
})();
```

Run:
```bash
DB_ENABLED=false node test.js
```

---

## Database Setup (For Persistence)

### Option 1: Docker PostgreSQL

```bash
# Start PostgreSQL in Docker
docker run -d \
  --name ghosttrace-db \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ghosttrace \
  postgres:latest

# Update .env
GHOST_DB_HOST=localhost
GHOST_DB_PORT=5432
GHOST_DB_NAME=ghosttrace
GHOST_DB_USER=postgres
GHOST_DB_PASS=password
GHOST_DB_SYNC=true
```

### Option 2: Local PostgreSQL

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib  # Ubuntu/Debian
brew install postgresql@14                     # macOS

# Create database
sudo -u postgres psql
CREATE DATABASE ghosttrace;
CREATE USER ghosttrace_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE ghosttrace TO ghosttrace_user;
\q

# Update .env
GHOST_DB_HOST=localhost
GHOST_DB_PORT=5432
GHOST_DB_NAME=ghosttrace
GHOST_DB_USER=ghosttrace_user
GHOST_DB_PASS=secure_password
GHOST_DB_SYNC=true
```

---

## Checking Your Setup

### Test Database Connection

```javascript
// test-db.js
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.GHOST_DB_HOST || 'localhost',
  port: parseInt(process.env.GHOST_DB_PORT || '5432'),
  database: process.env.GHOST_DB_NAME || 'ghosttrace',
  user: process.env.GHOST_DB_USER || 'postgres',
  password: process.env.GHOST_DB_PASS || '',
});

client.connect()
  .then(() => {
    console.log('✅ Database connection successful!');
    client.end();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.log('\n💡 Try setting DB_ENABLED=false in .env to skip database');
  });
```

### Test GhostTrace Modules

```javascript
// test-modules.js
try {
  const ghosttrace = require('ghosttrace');
  console.log('✅ GhostTrace loaded');
  console.log('  Version:', ghosttrace.version);
  console.log('  init:', typeof ghosttrace.init);
  console.log('  secure:', typeof ghosttrace.secure);
} catch (err) {
  console.error('❌ Error:', err.message);
}
```

---

## Environment Variables Checklist

### Required
- [ ] `GHOST_ADMIN_EMAIL` - Admin login email
- [ ] `GHOST_ADMIN_PASS` - Admin login password (min 8 chars)

### Database (Optional)
- [ ] `DB_ENABLED=false` - To disable database
- [ ] `GHOST_DB_HOST` - If using database
- [ ] `GHOST_DB_PORT` - If using database
- [ ] `GHOST_DB_NAME` - If using database
- [ ] `GHOST_DB_USER` - If using database
- [ ] `GHOST_DB_PASS` - If using database
- [ ] `GHOST_DB_SYNC=true` - To auto-create tables

### Optional
- [ ] `GHOST_PORT` - Dashboard port (default: 3001)
- [ ] `GHOST_BLOCK_THRESHOLD` - Risk threshold (default: 70)
- [ ] `GHOST_RATE_LIMIT` - Rate limit (default: 120)

---

## Still Having Issues?

### Enable Debug Logging

```env
NODE_ENV=development
```

### Check Logs

The error messages should now show more details. If you see:

```
⚠ Database connection attempt 1/3 failed: [error details here]
```

The error details will tell you exactly what's wrong.

### Minimal Working Example

Create `test-minimal.js`:

```javascript
require('dotenv').config({ path: '.env' });

// Override to disable database
process.env.DB_ENABLED = 'false';

const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

(async () => {
  try {
    await ghosttrace.init({
      adminEmail: 'admin@test.com',
      adminPassword: 'test12345',
      dashboardPort: 3001,
    });

    app.use('/api', ghosttrace.secure());
    
    app.get('/api/hello', (req, res) => {
      res.json({ message: 'Hello!' });
    });

    app.listen(3000, () => {
      console.log('\n✅ Test app started successfully!');
      console.log('  App: http://localhost:3000');
      console.log('  Dashboard: http://localhost:3001\n');
    });
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
})();
```

Run:
```bash
node test-minimal.js
```

This should work with NO database setup required!

---

## Contact & Support

- Check examples/ directory for working integrations
- Read QUICK_START_NPM.md for quick reference
- See IMPLEMENTATION_COMPLETE.md for detailed info
