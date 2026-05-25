/**
 * BehavioralDNA — AI-Powered Security Layer
 * ==========================================
 * Drop-in security middleware for any Node.js/Express backend.
 *
 * Configuration via environment variables (see ENV_SETUP.md).
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');

const threatDetectionRoutes    = require('./routes/threatDetection');
const behavioralTrackingRoutes = require('./routes/behavioralTracking');
const loggerRoutes             = require('./routes/logger');
const dataSourceRoutes         = require('./routes/datasources');
const geoRoutes                = require('./routes/geo');
const dbConnector              = require('./core/dbConnector');
const alertRoutes              = require('./routes/alerts');
const incidentRoutes           = require('./routes/incidents');
const huntRoutes               = require('./routes/hunt');
const policyRoutes             = require('./routes/policies');
const auditRoutes              = require('./routes/audit');
const socRoutes                = require('./routes/soc');
const integrationRoutes        = require('./routes/integrations');
const aiRoutes                 = require('./routes/ai');
const { errorHandler }         = require('./middleware/errorHandler');
const { apiNotFound }          = require('./middleware/notFound');
const { validateEnvironment }  = require('./config/security');
const { wrapRouter }           = require('./utils/wrapRouter');
const RequestLogger            = require('./middleware/requestLogger');
const createProtectionMiddleware = require('./middleware/protection');
const authRoutes = require('./routes/auth');
const { authenticate, redirectIfNeedsSetup, requireRole } = require('./middleware/auth');

const { connectDB, isDbReady } = require('./config/database');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const TARGET_ORIGIN = process.env.TARGET_ORIGIN || '';
const NODE_ENV = process.env.NODE_ENV || 'development';

const requireWriteRole = (roles) => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireRole(...roles)(req, res, next);
};

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ─── Security headers ────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.PUBLIC_URL || `http://localhost:${PORT}`, 'ws://localhost:*', 'wss://*'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || '*').split(','),
  credentials: true,
}));

// ─── API rate limiting ────────────────────────────────────────────────────────

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: process.env.BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || '1mb' }));
app.use(cookieParser());

// ─── Request logging ──────────────────────────────────────────────────────────

app.use(RequestLogger.middleware());

// ─── Behavioral DNA Protection Layer ─────────────────────────────────────────
// This is the core — sits in front of everything and analyzes every request.

app.use(createProtectionMiddleware({
  enableAnalysis:    true,
  blockOnThreat:     process.env.BLOCK_ON_THREAT !== 'false',
  riskBlockThreshold: parseInt(process.env.BLOCK_RISK_THRESHOLD || '70', 10),
  rateLimitPerWindow: parseInt(process.env.RATE_LIMIT || '120', 10),
  explainOnBlock:    true,
  allowlist: [
    '/health',
    '/favicon.ico',
    '/api/auth/login',
    '/api/auth/setup',
    '/api/auth/setup-status',
    '/setup.html',
    '/api/ai/status',
    '/api/dna',
    '/api/behavior/track',
    '/login.html',
    /^\/api\/(soc|alerts|incidents|hunt|policies|audit|threats|logger|sources|integrations|ai|geo)\//,
    '/api/geo/stream',
    '/api/logger/logs/live',
    '/api/threats/feed',
    '/api/soc/feed',
    '/api/alerts/stream',
    '/api/sources/events/stream',
    /\.(css|js|html|png|jpeg|jpg|svg)$/,
    '/assets/',
  ],
}));

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);

// Public API for behavior tracking
app.use('/api/behavior', wrapRouter(behavioralTrackingRoutes));

// Protected SOC / MDR APIs
app.use('/api/soc', authenticate, wrapRouter(socRoutes));
app.use('/api/alerts', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(alertRoutes));
app.use('/api/incidents', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(incidentRoutes));
app.use('/api/hunt', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(huntRoutes));
app.use('/api/policies', authenticate, requireRole('admin'), wrapRouter(policyRoutes));
app.use('/api/audit', authenticate, wrapRouter(auditRoutes));
app.use('/api/integrations', authenticate, requireRole('admin'), wrapRouter(integrationRoutes));
app.use('/api/ai', authenticate, requireRole('admin', 'analyst'), wrapRouter(aiRoutes));
app.use('/api/threats', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(threatDetectionRoutes));
app.use('/api/logger', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(loggerRoutes));
app.use('/api/sources', authenticate, requireRole('admin'), wrapRouter(dataSourceRoutes));
app.use('/api/geo', authenticate, wrapRouter(geoRoutes));

// Static Dashboard (Order matters: public files first, then index protection)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/setup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

app.get('/', redirectIfNeedsSetup, authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', redirectIfNeedsSetup, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ─── Debug: inspect computed DNA ─────────────────────────────────────────────

app.get('/api/dna', (req, res) => {
  res.json({
    success: true,
    dna: req.clientDNA || null,
    dnaObj: req.clientDNAObj || null,
    analysis: req.protectionAnalysis || null,
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  const dbEnabled = process.env.DB_ENABLED !== 'false';
  const dbStatus = dbEnabled ? (isDbReady() ? 'up' : 'down') : 'disabled';
  const healthy = dbStatus !== 'down';
  let aiStatus = { configured: false };
  try {
    aiStatus = await require('./services/aiService').getStatus();
  } catch (_) { /* optional */ }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'OK' : 'DEGRADED',
    service: 'GhostTrace SOC Platform',
    version: require('./package.json').version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mode: NODE_ENV,
    checks: { database: dbStatus },
    ai: aiStatus,
  });
});

// ─── Proxy to upstream backend ───────────────────────────────────────────────
// All /backend/* requests are proxied (already protected by middleware above)

if (TARGET_ORIGIN) {
  app.use('/backend', createProxyMiddleware({
    target: TARGET_ORIGIN,
    changeOrigin: true,
    pathRewrite: { '^/backend': '' },
    on: {
      error: (err, req, res) => {
        res.status(502).json({ success: false, error: 'Upstream backend unavailable' });
      },
    },
  }));
}

// ─── SPA fallback (authenticated; skip missing static assets) ─────────────────

app.get('*', redirectIfNeedsSetup, authenticate, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (/\.[a-z0-9]{1,8}$/i.test(req.path)) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) next(err);
  });
});

// ─── API 404 + error handler ──────────────────────────────────────────────────

app.use('/api', apiNotFound);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  validateEnvironment();

  if (process.env.DB_ENABLED !== 'false') {
    await connectDB();
  }

  if (process.env.RESTORE_DATASOURCES !== 'false') {
    const restored = await dbConnector.restorePersisted();
    if (restored.length) {
      console.log(`  📡  Restored ${restored.filter((r) => r.ok).length}/${restored.length} data source(s)`);
    }
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n  👻 GhostTrace SOC Platform`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  🌐  Dashboard:   http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`  🔒  Mode:        ${NODE_ENV}`);
    console.log(`  🗄️   Database:    ${process.env.DB_ENABLED === 'false' ? 'disabled' : isDbReady() ? 'connected' : 'unavailable'}`);
    console.log(`  🤖  AI:          ${process.env.GEMINI_API_KEY ? 'Gemini' : process.env.OLLAMA_ENABLED === 'true' ? 'Ollama' : 'Rule-based fallback'}`);
    if (TARGET_ORIGIN) {
      console.log(`  ➡️   Proxying to: ${TARGET_ORIGIN}`);
    }
    console.log(`  ─────────────────────────────────────\n`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully`);
    server.close(() => {
      const { sequelize } = require('./config/database');
      sequelize.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
