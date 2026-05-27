# GhostTrace - Zero Configuration Guide

## 🚀 It Just Works!

GhostTrace requires **ZERO configuration**. No .env file, no database, no admin credentials.

## Quick Start

### 1. Install
```bash
npm install ghosttrace
```

### 2. Add to your app (2 lines!)
```javascript
const ghosttrace = require('ghosttrace');

await ghosttrace.init();  // That's it!
app.use('/api', ghosttrace.secure());
```

### 3. Start your app
```bash
node app.js
```

### 4. Create admin account
Visit `http://localhost:3001` and you'll see a setup page.
Create your admin account and you're done!

---

## How It Works

### First Run
1. **No admin exists** → Setup page appears
2. **Create admin account** → Via web form
3. **Login** → Access dashboard
4. **Monitor** → See threats in real-time

### Subsequent Runs
- Admin already exists → Go straight to login
- All settings persist (in-memory or database if configured)

---

## Optional: Auto-Create Admin

If you want to auto-create admin user on startup:

```javascript
await ghosttrace.init({
  adminEmail: 'admin@company.com',
  adminPassword: 'secure-password',
});
```

Or via .env:
```env
GHOST_ADMIN_EMAIL=admin@company.com
GHOST_ADMIN_PASS=secure-password
```

---

## Optional: Enable Database

By default, data is stored in-memory. To persist data:

```env
GHOST_DB_TYPE=postgres
GHOST_DB_HOST=localhost
GHOST_DB_PORT=5432
GHOST_DB_NAME=ghosttrace
GHOST_DB_USER=postgres
GHOST_DB_PASS=password
GHOST_DB_SYNC=true
```

---

## Optional: Configure AI

```env
GHOST_AI_PROVIDER=openai
GHOST_AI_KEY=sk-...
```

---

## That's It!

**Everything is optional.** GhostTrace has sensible defaults for everything.

No configuration files, no mandatory environment variables, no setup scripts.

Just `init()` and go! 🎉
