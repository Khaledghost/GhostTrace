# GhostTrace v3.0.0 - Quick Reference Card

## 🚀 Installation (30 seconds)

```bash
npm install ghosttrace
```

## ⚡ Integration (3 lines)

```javascript
const ghosttrace = require('ghosttrace');

await ghosttrace.init({
  adminEmail: 'admin@company.com',
  adminPassword: 'SecurePass123!',
});

app.use('/api', ghosttrace.secure());
```

## 🔧 Environment Variables

### Required (2)
```env
GHOST_ADMIN_EMAIL=admin@company.com
GHOST_ADMIN_PASS=SecurePassword123!
```

### Optional (most common)
```env
GHOST_PORT=3001
GHOST_BLOCK_THRESHOLD=70
GHOST_RATE_LIMIT=120
GHOST_BLOCK_ON_THREAT=true
GHOST_DB_HOST=localhost
```

## 🎯 Common Use Cases

### 1. Protect All Routes
```javascript
app.use('/api', ghosttrace.secure());
```

### 2. Different Security Levels
```javascript
// High security for auth
app.use('/api/auth', ghosttrace.secure({ riskThreshold: 60 }));

// Standard for posts
app.use('/api/posts', ghosttrace.secure({ riskThreshold: 70 }));

// Monitor only for public
app.use('/api/public', ghosttrace.secure({ blockOnThreat: false }));
```

### 3. Custom Threat Handler
```javascript
app.use('/api', ghosttrace.secure({
  onThreat: async (req, res, analysis) => {
    await logToSIEM(analysis);
    res.status(403).json({ error: 'Blocked' });
  },
}));
```

## 📊 Dashboard Access

```
http://localhost:3001
Login: admin@company.com / SecurePassword123!
```

## 🔍 Request Properties Added

```javascript
app.get('/api/profile', ghosttrace.secure(), (req, res) => {
  console.log(req.clientDNA);              // Fingerprint hash
  console.log(req.protectionAnalysis);     // Threat analysis
  console.log(req.protectionAnalysis.riskScore);  // 0-100
  console.log(req.protectionAnalysis.isThreat);   // boolean
});
```

## 🛡️ What Gets Protected

- ✅ SQL Injection
- ✅ XSS (Cross-site scripting)
- ✅ Brute force attacks
- ✅ Rate limit violations
- ✅ Behavioral anomalies
- ✅ Session hijacking
- ✅ API abuse

## ⚙️ Configuration Options

### init() Options
```javascript
await ghosttrace.init({
  adminEmail: 'admin@company.com',      // Required
  adminPassword: 'SecurePass123!',      // Required
  dashboardPort: 3001,                  // Optional
  blockThreshold: 70,                   // Optional (0-100)
  rateLimit: 120,                       // Optional (req/min)
  blockOnThreat: true,                  // Optional
  database: {                           // Optional
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    name: 'ghosttrace',
    user: 'postgres',
    password: 'dbpass',
  },
  ai: {                                 // Optional
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
});
```

### secure() Options
```javascript
app.use('/api', ghosttrace.secure({
  riskThreshold: 70,                    // Risk score to block
  rateLimit: 120,                       // Max req/min
  blockOnThreat: true,                  // Enable blocking
  allowlist: ['/health', /^\/public/],  // Skip paths
  passthrough: false,                   // Monitor only mode
  identifyUser: (req) => ({             // Custom user ID
    userId: req.user?.id || 'anon',
    accountId: req.headers['x-tenant'],
  }),
  onThreat: async (req, res, analysis) => {  // Custom handler
    // Your logic here
  },
}));
```

## 📈 Response Headers

### Normal Requests
```
X-Client-DNA: a3d2d5ac6bdaef5212d6c4e8f9a1b2c3
```

### Blocked Requests
```
X-Blocked-By: BehavioralDNA
X-Risk-Score: 85
X-Threat-Level: high
```

### Rate Limited
```
Retry-After: 30
X-Blocked-By: BehavioralDNA-RateLimit
```

## 🔧 Troubleshooting

### Port Already in Use
```env
GHOST_PORT=4001
```

### Database Connection Failed
- Auto-fallback to SQLite
- Check credentials in .env
- Verify database is running

### Admin Credentials Missing
```env
GHOST_ADMIN_EMAIL=admin@company.com
GHOST_ADMIN_PASS=SecurePass123!
```

Add `require('dotenv').config()` at top of file.

### Middleware Not Working
```javascript
// ❌ Wrong: secure() called before init()
app.use('/api', ghosttrace.secure());
await ghosttrace.init({ ... });

// ✅ Correct: init() before secure()
await ghosttrace.init({ ... });
app.use('/api', ghosttrace.secure());
```

## 📖 Full Documentation

- **API Reference:** See DOCUMENTATION.xml
- **Integration Guide:** See IMPLEMENTATION_GUIDE.md
- **Examples:** See examples/ directory
- **Validation Report:** See FINAL_VALIDATION_REPORT.md

## 🆘 Quick Help

| Issue | Solution |
|-------|----------|
| Port conflict | Change `GHOST_PORT` |
| DB connection fail | Check credentials or use SQLite |
| Missing credentials | Set `GHOST_ADMIN_EMAIL` and `GHOST_ADMIN_PASS` |
| Not blocking | Check `GHOST_BLOCK_ON_THREAT=true` |
| High latency | Check database connection pool |

## 📞 Support

- **GitHub Issues:** https://github.com/yourusername/ghosttrace/issues
- **Documentation:** See DOCUMENTATION.xml
- **Examples:** See examples/ directory

## 🎯 Performance

- **Middleware Latency:** ~5-8ms
- **Memory Usage:** ~150MB
- **Throughput:** 1200+ req/s
- **Database Queries:** 1-2 per request

## 🔐 Security Best Practices

1. Never commit `.env` to version control
2. Use strong admin passwords (12+ characters)
3. Adjust thresholds per route sensitivity
4. Start with `blockOnThreat: false` (monitor mode)
5. Gradually roll out to production
6. Monitor dashboard regularly
7. Enable audit logging for compliance

## 📊 Dashboard Features

- 🚨 Real-time alert queue
- 📊 Behavioral analytics
- 🎯 MITRE ATT&CK mapping
- 🔍 Threat hunting
- 🤖 AI-powered triage
- 📈 Risk scoring
- 🔒 Incident management
- 📋 Audit trail
- 🌐 GeoIP tracking

## ⚡ Quick Start Checklist

- [ ] `npm install ghosttrace`
- [ ] Create `.env` with `GHOST_ADMIN_EMAIL` and `GHOST_ADMIN_PASS`
- [ ] Add `require('dotenv').config()`
- [ ] Call `await ghosttrace.init({ ... })`
- [ ] Add `app.use('/api', ghosttrace.secure())`
- [ ] Start your app
- [ ] Access dashboard at `http://localhost:3001`
- [ ] Login with admin credentials
- [ ] Test protection with sample requests
- [ ] Adjust thresholds as needed

## 🎉 Success!

You're now protecting your Express app with enterprise-grade security in **< 5 minutes**!

---

**Version:** 3.0.0  
**License:** MIT  
**Status:** Production Ready ✅
