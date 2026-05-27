# Coding Agent Prompt: GhostTrace NPM Package Transformation

## Mission
Transform the GhostTrace SOC platform from a standalone application into a user-friendly npm package that can be easily integrated into any Node.js/Express backend with minimal configuration.

## Context
You are working on an open-source behavioral detection & response (BDR) platform. Currently, it runs as a standalone application. The goal is to make it installable via npm and usable with a simple `ghosttrace.secure()` call on any Express route.

## Core Requirements

### 1. Create Main Entry Point (`index.js`)

Create a new `index.js` file at the root that exports:

```javascript
const ghosttrace = {
  init: require('./lib/init'),
  secure: require('./lib/middleware'),
  version: require('./package.json').version,
};

module.exports = ghosttrace;
module.exports.default = ghosttrace;
```

### 2. Create Initialization Module (`lib/init.js`)

This is the core initialization function. It must:

**Required Parameters:**
- `adminEmail` (or from `GHOST_ADMIN_EMAIL`)
- `adminPassword` (or from `GHOST_ADMIN_PASS`)

**Optional Parameters:**
- `dashboardPort` (default: 3001, from `GHOST_PORT`)
- `proxyPort` (default: 3002, from `GHOST_PROXY`)
- `database` (auto-detect or use SQLite as fallback)
- `blockThreshold` (default: 70, from `GHOST_BLOCK_THRESHOLD`)
- `rateLimit` (default: 120, from `GHOST_RATE_LIMIT`)
- `blockOnThreat` (default: true, from `GHOST_BLOCK_ON_THREAT`)
- `ai` (optional AI configuration)

**Functionality:**
1. Validate admin credentials are provided
2. Setup database connection (create DB if doesn't exist)
3. Run database migrations
4. Create/update admin user with hashed password
5. Start dashboard server on `dashboardPort`
6. Log startup information (dashboard URL, config summary)
7. Return ghosttrace instance

**Error Handling:**
- Throw clear error if admin credentials missing
- Warn if database connection fails, fallback to SQLite
- Handle port conflicts gracefully

**Example:**
```javascript
const init = async (config = {}) => {
  // Load from env vars with config override
  const cfg = {
    adminEmail: config.adminEmail || process.env.GHOST_ADMIN_EMAIL,
    adminPassword: config.adminPassword || process.env.GHOST_ADMIN_PASS,
    dashboardPort: config.dashboardPort || parseInt(process.env.GHOST_PORT || '3001'),
    proxyPort: config.proxyPort || parseInt(process.env.GHOST_PROXY || '3002'),
    database: config.database || getDefaultDatabase(),
    blockThreshold: config.blockThreshold || parseInt(process.env.GHOST_BLOCK_THRESHOLD || '70'),
    rateLimit: config.rateLimit || parseInt(process.env.GHOST_RATE_LIMIT || '120'),
    blockOnThreat: config.blockOnThreat !== false && process.env.GHOST_BLOCK_ON_THREAT !== 'false',
    ai: config.ai || {},
  };

  // Validate required fields
  if (!cfg.adminEmail || !cfg.adminPassword) {
    throw new Error('GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASS are required');
  }

  // Initialize database
  await setupDatabase(cfg.database);

  // Create/update admin user
  await setupAdminUser(cfg.adminEmail, cfg.adminPassword);

  // Start dashboard server
  const dashboardServer = await startDashboardServer(cfg);

  // Log success
  console.log(`\n  👻 GhostTrace Security Layer Initialized`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  🌐 Dashboard: http://localhost:${cfg.dashboardPort}`);
  console.log(`  👤 Admin: ${cfg.adminEmail}`);
  console.log(`  🗄️  Database: ${cfg.database.type}`);
  console.log(`  🛡️  Protection: ${cfg.blockOnThreat ? 'ACTIVE' : 'PASSIVE'}`);
  console.log(`  ────────────────────────────────────────\n`);

  return {
    config: cfg,
    dashboardServer,
    stop: () => dashboardServer.close(),
  };
};
```

### 3. Create Middleware Module (`lib/middleware.js`)

Convert the existing `createProtectionMiddleware` into a cleaner `secure()` function:

```javascript
const createProtectionMiddleware = require('../middleware/protection');

function secure(options = {}) {
  // Merge global config (from init) with route-specific options
  const globalConfig = global.__ghosttrace_config || {};
  
  const config = {
    enableAnalysis: true,
    blockOnThreat: options.blockOnThreat !== undefined ? options.blockOnThreat : globalConfig.blockOnThreat,
    riskBlockThreshold: options.riskThreshold || options.blockThreshold || globalConfig.blockThreshold || 70,
    rateLimitPerWindow: options.rateLimit || globalConfig.rateLimit || 120,
    explainOnBlock: true,
    allowlist: options.allowlist || [],
    ...options,
  };

  return createProtectionMiddleware(config);
}

module.exports = secure;
```

### 4. Create Dashboard Server (`lib/dashboard-server.js`)

Extract all dashboard-related code into a separate server that runs independently:

```javascript
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

async function startDashboardServer(config) {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Import all existing routes
  const alertRoutes = require('../routes/alerts');
  const incidentRoutes = require('../routes/incidents');
  const huntRoutes = require('../routes/hunt');
  const policyRoutes = require('../routes/policies');
  const auditRoutes = require('../routes/audit');
  const socRoutes = require('../routes/soc');
  const integrationRoutes = require('../routes/integrations');
  const aiRoutes = require('../routes/ai');
  const threatRoutes = require('../routes/threatDetection');
  const loggerRoutes = require('../routes/logger');
  const dataSourceRoutes = require('../routes/datasources');
  const geoRoutes = require('../routes/geo');
  const authRoutes = require('../routes/auth');

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/soc', socRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api/hunt', huntRoutes);
  app.use('/api/policies', policyRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/integrations', integrationRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/threats', threatRoutes);
  app.use('/api/logger', loggerRoutes);
  app.use('/api/sources', dataSourceRoutes);
  app.use('/api/geo', geoRoutes);

  // Serve static dashboard files
  app.use(express.static(path.join(__dirname, '../public')));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });

  // Start server
  return new Promise((resolve, reject) => {
    const server = app.listen(config.dashboardPort, (err) => {
      if (err) return reject(err);
      resolve(server);
    });
  });
}

module.exports = startDashboardServer;
```

### 5. Create Config Module (`lib/config.js`)

Centralized configuration management:

```javascript
class GhostTraceConfig {
  constructor(userConfig = {}) {
    this.adminEmail = userConfig.adminEmail || process.env.GHOST_ADMIN_EMAIL;
    this.adminPassword = userConfig.adminPassword || process.env.GHOST_ADMIN_PASS;
    this.dashboardPort = userConfig.dashboardPort || parseInt(process.env.GHOST_PORT || '3001');
    this.proxyPort = userConfig.proxyPort || parseInt(process.env.GHOST_PROXY || '3002');
    this.blockThreshold = userConfig.blockThreshold || parseInt(process.env.GHOST_BLOCK_THRESHOLD || '70');
    this.rateLimit = userConfig.rateLimit || parseInt(process.env.GHOST_RATE_LIMIT || '120');
    this.blockOnThreat = userConfig.blockOnThreat !== false && process.env.GHOST_BLOCK_ON_THREAT !== 'false';
    
    // Database config
    this.database = userConfig.database || this.getDatabaseConfig();
    
    // AI config
    this.ai = userConfig.ai || this.getAIConfig();

    // Store globally for middleware access
    global.__ghosttrace_config = this;
  }

  getDatabaseConfig() {
    const dbType = process.env.GHOST_DB_TYPE || process.env.DB_TYPE || 'postgres';
    
    return {
      type: dbType,
      host: process.env.GHOST_DB_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.GHOST_DB_PORT || process.env.DB_PORT || '5432'),
      name: process.env.GHOST_DB_NAME || process.env.DB_NAME || 'ghosttrace',
      user: process.env.GHOST_DB_USER || process.env.DB_USER || 'postgres',
      password: process.env.GHOST_DB_PASS || process.env.DB_PASS || '',
    };
  }

  getAIConfig() {
    return {
      provider: process.env.GHOST_AI_PROVIDER || process.env.AI_PROVIDER,
      apiKey: process.env.GHOST_AI_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
      model: process.env.GHOST_AI_MODEL,
    };
  }

  validate() {
    const errors = [];
    
    if (!this.adminEmail) errors.push('Admin email is required (GHOST_ADMIN_EMAIL)');
    if (!this.adminPassword) errors.push('Admin password is required (GHOST_ADMIN_PASS)');
    
    if (this.adminPassword && this.adminPassword.length < 8) {
      errors.push('Admin password must be at least 8 characters');
    }
    
    if (errors.length > 0) {
      throw new Error(`GhostTrace configuration error:\n  - ${errors.join('\n  - ')}`);
    }
    
    return true;
  }
}

module.exports = GhostTraceConfig;
```

### 6. Update package.json

Update the package.json to reflect npm package usage:

```json
{
  "name": "ghosttrace",
  "version": "3.0.0",
  "description": "Drop-in behavioral detection & response for any Node.js/Express backend",
  "main": "index.js",
  "types": "index.d.ts",
  "keywords": [
    "security",
    "threat-detection",
    "behavioral-analytics",
    "express-middleware",
    "soc",
    "mdr",
    "mitre-attack"
  ],
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "prepublishOnly": "npm test"
  },
  "peerDependencies": {
    "express": "^4.18.0"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express-rate-limit": "^6.8.1",
    "geoip-lite": "^2.0.2",
    "helmet": "^7.0.0",
    "http-proxy-middleware": "^2.0.9",
    "ioredis": "^5.10.1",
    "jsonwebtoken": "^9.0.3",
    "moment": "^2.29.4",
    "mongoose": "^9.6.2",
    "mysql2": "^3.22.3",
    "node-fetch": "^3.3.2",
    "pg": "^8.11.3",
    "pg-hstore": "^2.3.4",
    "sequelize": "^6.37.8"
  },
  "devDependencies": {
    "nodemon": "^3.1.0",
    "jest": "^29.0.0"
  },
  "files": [
    "index.js",
    "lib/",
    "src/",
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

### 7. Create Integration Examples

Create `examples/express-social-media.js`:

```javascript
require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize GhostTrace
(async () => {
  await ghosttrace.init({
    adminEmail: process.env.GHOST_ADMIN_EMAIL,
    adminPassword: process.env.GHOST_ADMIN_PASS,
    dashboardPort: process.env.GHOST_PORT || 3001,
  });

  // Your existing middleware
  app.use(express.json());

  // Secure authentication routes
  app.use('/api/auth', ghosttrace.secure({ riskThreshold: 60 }));

  // Secure post creation (higher threshold)
  app.use('/api/posts', ghosttrace.secure({ riskThreshold: 70 }));

  // Secure user profile routes
  app.use('/api/users', ghosttrace.secure());

  // Your application routes
  app.post('/api/auth/login', (req, res) => {
    // Your login logic
    res.json({ success: true, token: 'your-jwt-token' });
  });

  app.get('/api/posts', (req, res) => {
    // Your posts logic
    res.json({ posts: [] });
  });

  app.post('/api/posts', (req, res) => {
    // Your post creation logic
    res.json({ success: true, postId: '123' });
  });

  // Start your application
  app.listen(PORT, () => {
    console.log(`Social media backend running on http://localhost:${PORT}`);
    console.log(`GhostTrace dashboard at http://localhost:${process.env.GHOST_PORT || 3001}`);
  });
})();
```

### 8. Create Updated README.md

Create a new user-focused README:

```markdown
# GhostTrace

**Drop-in behavioral detection & response for any Node.js/Express backend**

Add enterprise-grade security monitoring to your application in minutes, not days.

## Installation

```bash
npm install ghosttrace
```

## Quick Start

```javascript
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

// Initialize GhostTrace
await ghosttrace.init({
  adminEmail: 'admin@company.com',
  adminPassword: 'secure-password',
  dashboardPort: 3001,
});

// Secure your routes
app.use('/api', ghosttrace.secure());

// Your routes work normally
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

That's it! Your API is now protected and monitored.

## Dashboard

Open `http://localhost:3001` and login with your admin credentials to access:

- 🚨 Real-time alert queue
- 📊 Behavioral analytics
- 🎯 MITRE ATT&CK mapping
- 🔍 Threat hunting
- 🤖 AI-powered triage
- 📈 Risk scoring

## Configuration

### Environment Variables

```env
# Required
GHOST_ADMIN_EMAIL=admin@company.com
GHOST_ADMIN_PASS=secure-password

# Optional
GHOST_PORT=3001
GHOST_PROXY=3002
GHOST_BLOCK_THRESHOLD=70
GHOST_RATE_LIMIT=120
GHOST_BLOCK_ON_THREAT=true

# Database (defaults to SQLite)
GHOST_DB_TYPE=postgres
GHOST_DB_HOST=localhost
GHOST_DB_PORT=5432
GHOST_DB_NAME=ghosttrace
GHOST_DB_USER=postgres
GHOST_DB_PASS=password

# AI (optional)
GHOST_AI_PROVIDER=openai
GHOST_AI_KEY=sk-...
```

### Programmatic Configuration

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
    name: 'myapp_ghosttrace',
    user: 'postgres',
    password: 'password',
  },
  ai: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
});
```

## Route-Specific Configuration

```javascript
// Default protection
app.use('/api/posts', ghosttrace.secure());

// High security for auth routes
app.use('/api/auth', ghosttrace.secure({ 
  riskThreshold: 60,
  rateLimit: 30,
}));

// Monitor only (don't block)
app.use('/api/public', ghosttrace.secure({ 
  blockOnThreat: false,
}));
```

## Features

- ✅ Behavioral DNA fingerprinting
- ✅ Anomaly detection (Z-score analysis)
- ✅ MITRE ATT&CK mapping
- ✅ SQL injection detection
- ✅ XSS prevention
- ✅ Brute force protection
- ✅ Rate limiting
- ✅ AI-powered threat analysis
- ✅ Real-time alerting
- ✅ Incident management
- ✅ Threat hunting
- ✅ Audit trail

## Examples

See the `examples/` directory for:
- Express basic integration
- Social media backend
- E-commerce backend
- API gateway setup

## License

MIT
```

### 9. Database Migration Support

Update `config/database.js` to support auto-creation:

```javascript
const { Sequelize } = require('sequelize');

async function connectDB(config) {
  const { type, host, port, name, user, password } = config;

  let sequelize;

  if (type === 'sqlite' || !type) {
    // Fallback to SQLite
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: './ghosttrace.db',
      logging: false,
    });
  } else if (type === 'postgres') {
    // Try to create database if it doesn't exist
    const tempSequelize = new Sequelize('postgres', user, password, {
      host,
      port,
      dialect: 'postgres',
      logging: false,
    });

    try {
      await tempSequelize.query(`CREATE DATABASE ${name}`);
      console.log(`  ✓ Created database: ${name}`);
    } catch (err) {
      // Database might already exist
    }
    await tempSequelize.close();

    // Connect to actual database
    sequelize = new Sequelize(name, user, password, {
      host,
      port,
      dialect: 'postgres',
      logging: false,
    });
  }

  // Test connection
  await sequelize.authenticate();
  console.log(`  ✓ Database connected: ${type}`);

  // Sync models
  await sequelize.sync();
  console.log(`  ✓ Database tables created`);

  return sequelize;
}

module.exports = { connectDB };
```

### 10. Admin User Setup

Create `lib/setup-admin.js`:

```javascript
const bcrypt = require('bcryptjs');

async function setupAdminUser(email, password) {
  const User = require('../models/User');

  const hashedPassword = await bcrypt.hash(password, 10);

  const [user, created] = await User.upsert({
    email,
    password: hashedPassword,
    role: 'admin',
    username: email.split('@')[0],
  }, {
    conflictFields: ['email'],
  });

  if (created) {
    console.log(`  ✓ Admin user created: ${email}`);
  } else {
    console.log(`  ✓ Admin user updated: ${email}`);
  }

  return user;
}

module.exports = setupAdminUser;
```

## Implementation Checklist

- [ ] Create `index.js` main entry point
- [ ] Create `lib/init.js` with initialization logic
- [ ] Create `lib/middleware.js` with secure() function
- [ ] Create `lib/dashboard-server.js` for separate dashboard
- [ ] Create `lib/config.js` for configuration management
- [ ] Create `lib/setup-admin.js` for admin user creation
- [ ] Update `config/database.js` with auto-creation support
- [ ] Update `package.json` with npm package metadata
- [ ] Create `examples/express-social-media.js`
- [ ] Create `examples/express-basic.js`
- [ ] Create `examples/express-ecommerce.js`
- [ ] Update `README.md` with integration guide
- [ ] Create `.env.example` with GHOST_ prefixed vars
- [ ] Test integration with sample Express app
- [ ] Ensure backward compatibility with existing `server.js`
- [ ] Add TypeScript definitions (`index.d.ts`)

## Important Notes

1. **Preserve existing functionality**: All current features must continue working
2. **Backward compatibility**: Keep `server.js` working as standalone mode
3. **Error handling**: Provide clear error messages for configuration issues
4. **Logging**: Use console.log with clear prefixes for user feedback
5. **Security**: Never expose sensitive config in logs or errors
6. **Documentation**: Comment complex logic thoroughly
7. **Testing**: Create test files for each new module

## Validation Points

After implementation, verify:
- [ ] `npm install ghosttrace` works locally (via `npm link`)
- [ ] Simple integration example runs without errors
- [ ] Dashboard starts on configured port
- [ ] Admin login works with provided credentials
- [ ] Middleware protects routes correctly
- [ ] Database auto-creates if it doesn't exist
- [ ] Environment variables are properly read
- [ ] Per-route configuration overrides work
- [ ] Existing server.js still works as before
- [ ] All routes respond correctly
- [ ] No breaking changes to existing API

## Success Criteria

A developer should be able to:
1. Install: `npm install ghosttrace`
2. Add 5 lines to their existing Express app
3. Start their app and see GhostTrace dashboard URL
4. Login to dashboard immediately
5. See their routes protected automatically

Total time from install to protected app: **< 3 minutes**
