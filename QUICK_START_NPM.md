# GhostTrace Quick Start Guide

## 🚀 For Developers Using GhostTrace

### Installation
```bash
npm install ghosttrace
```

### Basic Integration (3 lines)
```javascript
const ghosttrace = require('ghosttrace');

await ghosttrace.init({
  adminEmail: 'admin@company.com',
  adminPassword: 'secure-password',
});

app.use('/api', ghosttrace.secure());
```

### Environment Variables
```env
GHOST_ADMIN_EMAIL=admin@company.com
GHOST_ADMIN_PASS=secure-password
GHOST_PORT=3001
GHOST_BLOCK_THRESHOLD=70
```

### Dashboard
Open `http://localhost:3001` and login with your admin credentials.

---

## 🧪 Testing Locally (Before Publishing)

### Test the package
```bash
npm test  # Or: node test-integration.js
```

### Test an example
```bash
node examples/express-basic.js
# Visit http://localhost:3000 (your app)
# Visit http://localhost:3001 (GhostTrace dashboard)
```

### Test with npm link
```bash
# In this directory
npm link

# In another project
npm link ghosttrace
```

---

## 📦 Publishing to npm

### First time setup
```bash
npm login
```

### Publish
```bash
# Public package (recommended for open source)
npm publish --access public

# Or private package
npm publish
```

### Update version
```bash
npm version patch  # 3.0.0 -> 3.0.1
npm version minor  # 3.0.0 -> 3.1.0
npm version major  # 3.0.0 -> 4.0.0
npm publish --access public
```

---

## 📁 Project Structure

```
ghosttrace/
├── index.js              # Main entry point
├── index.d.ts           # TypeScript definitions
├── lib/
│   ├── config.js        # Configuration management
│   ├── init.js          # Initialization
│   ├── middleware.js    # Middleware factory
│   ├── dashboard-server.js  # Dashboard server
│   └── setup-admin.js   # Admin user setup
├── examples/
│   ├── express-basic.js
│   ├── express-social-media.js
│   └── express-ecommerce.js
├── server.js            # Standalone mode (backward compat)
├── README.md            # Integration guide
├── .env.example         # Configuration template
└── test-integration.js  # Integration tests
```

---

## ✅ What's Working

- ✅ npm package structure
- ✅ Main entry point (index.js)
- ✅ Library modules (lib/)
- ✅ Configuration management
- ✅ Database auto-creation
- ✅ Admin user auto-setup
- ✅ Dashboard server separation
- ✅ Middleware factory
- ✅ Route-specific configuration
- ✅ TypeScript definitions
- ✅ Three complete examples
- ✅ Updated documentation
- ✅ Integration tests
- ✅ Backward compatibility

---

## 🎯 Usage Examples

### Basic Protection
```javascript
app.use('/api', ghosttrace.secure());
```

### High Security Route
```javascript
app.use('/api/auth', ghosttrace.secure({ 
  riskThreshold: 50,
  rateLimit: 20,
}));
```

### Monitor-Only Mode
```javascript
app.use('/api/public', ghosttrace.secure({ 
  blockOnThreat: false,
}));
```

### Custom Configuration
```javascript
await ghosttrace.init({
  adminEmail: 'admin@company.com',
  adminPassword: 'secure-password',
  dashboardPort: 3001,
  blockThreshold: 70,
  rateLimit: 120,
  database: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    name: 'myapp_security',
    user: 'postgres',
    password: 'password',
  },
});
```

---

## 🔧 Troubleshooting

### "Admin email/password required"
Set `GHOST_ADMIN_EMAIL` and `GHOST_ADMIN_PASS` environment variables.

### "Port already in use"
Change `GHOST_PORT` to a different port number.

### Database connection fails
- Check database credentials in `.env`
- Set `DB_ENABLED=false` to run without database
- Database will be auto-created if missing (PostgreSQL)

### Dashboard not loading
- Check that port 3001 (or `GHOST_PORT`) is not in use
- Verify dashboard server started (check console logs)
- Try accessing `http://localhost:3001/login.html`

---

## 📖 Documentation

- **README.md** - Complete integration guide
- **IMPLEMENTATION_COMPLETE.md** - Detailed implementation summary
- **examples/** - Three working examples
- **.env.example** - All configuration options

---

## 🆘 Support

- 📁 Check examples/ for working integrations
- 🧪 Run test-integration.js to verify setup
- 📖 Read README.md for detailed documentation
- 🐛 Check GitHub issues for known problems

---

**GhostTrace v3.0.0** - Drop-in security for Express apps 🛡️
