# GhostTrace NPM Package Restructuring Plan

## Overview
Transform GhostTrace from a standalone application into a user-friendly npm package that can be easily integrated into any Node.js/Express backend application with minimal configuration.

## Core Requirements

### 1. NPM Package Structure
- **Package Name**: `ghosttrace` (or `@ghosttrace/core`)
- **Entry Point**: Main module that exports the middleware and dashboard initialization
- **Separate Concerns**: Split into core middleware, dashboard server, and admin panel

### 2. Simple Integration API

```javascript
// User's existing backend (e.g., social-media-backend/server.js)
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();

// Initialize GhostTrace with configuration
ghosttrace.init({
  // Admin credentials (required)
  adminEmail: process.env.GHOST_ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.GHOST_ADMIN_PASS || 'secure-password',
  
  // Port configuration
  dashboardPort: process.env.GHOST_PORT || 3001,
  proxyPort: process.env.GHOST_PROXY || 3002,
  
  // Database configuration (auto-configured or manual)
  database: {
    type: 'postgres', // or 'mysql', 'mongodb', 'sqlite'
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'ghosttrace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
  },
  
  // Optional: AI configuration
  ai: {
    provider: 'openai', // or 'gemini', 'claude', etc.
    apiKey: process.env.OPENAI_API_KEY,
  }
});

// Secure specific routes or entire app
app.use('/api/auth', ghosttrace.secure());
app.use('/api/posts', ghosttrace.secure());
app.use('/api/users', ghosttrace.secure({ riskThreshold: 80 }));

// Or secure all routes at once
// app.use(ghosttrace.secure());

// User's normal routes
app.get('/api/posts', (req, res) => {
  res.json({ posts: [] });
});

app.listen(3000, () => {
  console.log('Backend running on port 3000');
  console.log('GhostTrace dashboard at http://localhost:3001');
});
```

### 3. Environment Variable Support

```env
# User's .env file
# Application settings
PORT=3000

# GhostTrace Admin Configuration (REQUIRED)
GHOST_ADMIN_EMAIL=admin@company.com
GHOST_ADMIN_PASS=SuperSecurePassword123!

# GhostTrace Port Configuration
GHOST_PORT=3001
GHOST_PROXY=3002

# GhostTrace Database (auto-creates if not exists)
GHOST_DB_HOST=localhost
GHOST_DB_PORT=5432
GHOST_DB_NAME=ghosttrace_db
GHOST_DB_USER=postgres
GHOST_DB_PASS=dbpassword

# GhostTrace Security Settings (optional)
GHOST_BLOCK_THRESHOLD=70
GHOST_RATE_LIMIT=120
GHOST_BLOCK_ON_THREAT=true

# GhostTrace AI (optional)
GHOST_AI_PROVIDER=openai
GHOST_AI_KEY=sk-...
```

## Architecture Changes

### Current Structure
```
ghost-trace/
├── server.js (standalone app)
├── routes/ (all routes mixed)
├── middleware/
├── services/
├── models/
├── public/ (dashboard UI)
└── package.json
```

### New Structure
```
ghosttrace/
├── package.json (npm package config)
├── index.js (main entry point)
├── README.md (integration guide)
│
├── lib/
│   ├── init.js (initialization logic)
│   ├── middleware.js (exports secure() method)
│   ├── dashboard-server.js (separate dashboard server)
│   └── config.js (configuration management)
│
├── src/
│   ├── core/ (behavioral detection engine)
│   │   ├── anomalyEngine.js
│   │   ├── mitreMapper.js
│   │   ├── aiExplainer.js
│   │   └── ...
│   │
│   ├── middleware/
│   │   ├── protection.js (refactored)
│   │   ├── requestLogger.js
│   │   └── auth.js
│   │
│   ├── services/
│   │   ├── threatDetectionService.js
│   │   ├── alertService.js
│   │   └── ...
│   │
│   ├── models/ (sequelize models)
│   │   ├── Alert.js
│   │   ├── Incident.js
│   │   └── ...
│   │
│   ├── routes/ (dashboard API routes)
│   │   ├── alerts.js
│   │   ├── incidents.js
│   │   └── ...
│   │
│   └── database/
│       ├── connection.js
│       └── migrations/
│
├── dashboard/ (web UI - runs on GHOST_PORT)
│   ├── public/
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── app.js
│   │   └── ...
│   └── server.js (dashboard express server)
│
├── examples/
│   ├── express-basic.js
│   ├── express-social-media.js
│   ├── express-ecommerce.js
│   └── fastify-example.js
│
└── docs/
    ├── INTEGRATION.md
    ├── API.md
    └── CONFIGURATION.md
```

## Implementation Steps

### Phase 1: Core Restructuring
1. **Create main entry point** (`index.js`)
   - Export `init()` function
   - Export `secure()` middleware factory
   - Export utility functions

2. **Refactor initialization** (`lib/init.js`)
   - Parse and validate configuration
   - Setup database connection (auto-create DB if needed)
   - Create admin user from GHOST_ADMIN_EMAIL/GHOST_ADMIN_PASS
   - Start dashboard server on GHOST_PORT
   - Setup proxy server on GHOST_PROXY (optional)
   - Return initialized instance

3. **Refactor middleware** (`lib/middleware.js`)
   - Convert `createProtectionMiddleware` to `secure()`
   - Accept per-route configuration
   - Maintain backward compatibility
   - Add route-specific settings override

4. **Separate dashboard server** (`dashboard/server.js`)
   - Move all SOC/MDR routes to dashboard server
   - Run on separate port (GHOST_PORT)
   - Keep user's main app clean
   - Auto-configure CORS for user's app port

### Phase 2: Configuration Management
1. **Environment variable handling**
   - Prefix all with `GHOST_` to avoid conflicts
   - Support both env vars and programmatic config
   - Validate required fields (admin credentials)
   - Provide sensible defaults

2. **Database auto-setup**
   - Auto-create database if it doesn't exist
   - Run migrations on first init
   - Support multiple DB types (Postgres, MySQL, MongoDB, SQLite)
   - Fallback to SQLite if no DB configured

3. **Admin user creation**
   - On first init, create admin user from env vars
   - Hash password securely
   - Update admin if credentials change
   - Support multiple admin users

### Phase 3: Dashboard Separation
1. **Independent dashboard server**
   - Runs on GHOST_PORT (default 3001)
   - Proxies to user's app if needed (GHOST_PROXY)
   - Serves static files (UI)
   - Handles all SOC/MDR API routes

2. **Authentication**
   - Separate auth for dashboard (JWT)
   - No interference with user's app auth
   - Admin login page at http://localhost:GHOST_PORT

3. **Communication**
   - Middleware sends data to dashboard via internal API
   - Dashboard reads from shared database
   - Optional webhook support for alerts

### Phase 4: NPM Package Configuration
1. **package.json updates**
   - Set `main` to `index.js`
   - Add `bin` for CLI tool (optional)
   - Define `peerDependencies` (express)
   - Set proper version and metadata
   - Add installation scripts

2. **Documentation**
   - Quick start guide
   - Integration examples (Express, Fastify, Koa)
   - API reference
   - Configuration options
   - Environment variables reference

3. **Examples**
   - Social media backend
   - E-commerce backend
   - API gateway
   - Microservices setup

### Phase 5: Developer Experience
1. **Zero-config mode**
   - If only admin creds provided, use SQLite
   - Auto-start dashboard
   - Console output with URLs
   - Health check endpoint

2. **CLI tool** (optional)
   ```bash
   npx ghosttrace init
   npx ghosttrace dashboard
   npx ghosttrace status
   ```

3. **TypeScript support**
   - Add type definitions
   - Support TypeScript projects

## Key Features to Maintain

### Security Middleware
- Behavioral DNA fingerprinting
- Anomaly detection
- MITRE ATT&CK mapping
- Real-time threat analysis
- AI-powered explanations
- Rate limiting
- SQL injection detection
- XSS prevention
- Brute force protection

### Dashboard Features
- Alert queue management
- Incident tracking
- Threat hunting
- MITRE ATT&CK heatmap
- Behavioral profiles
- AI triage
- Policy management
- Audit trail
- Real-time event stream

## Breaking Changes to Handle
1. Current `server.js` becomes reference implementation
2. `createProtectionMiddleware()` → `ghosttrace.secure()`
3. Dashboard now on separate port (not on same server)
4. Database connection managed by package
5. Admin credentials required on init

## Backward Compatibility
- Keep existing `server.js` as standalone mode
- Support both integration methods
- Maintain API compatibility
- Document migration path

## Testing Strategy
1. Unit tests for core functions
2. Integration tests for middleware
3. Example apps for each use case
4. E2E tests for dashboard
5. Performance benchmarks

## Release Plan
1. **v3.0.0-alpha**: Core restructuring
2. **v3.0.0-beta**: Dashboard separation
3. **v3.0.0-rc**: Documentation and examples
4. **v3.0.0**: Stable release with migration guide

## Success Metrics
- Installation takes < 2 minutes
- Integration requires < 10 lines of code
- Dashboard accessible immediately after init
- Zero manual database setup required
- Works with any Express backend out of the box
