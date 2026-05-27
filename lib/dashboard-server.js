/**
 * Dashboard Server
 * Separate Express server for the GhostTrace SOC dashboard
 * Runs independently on a different port from the user's main app
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

async function startDashboardServer(config) {
  const app = express();
  const PORT = config.dashboardPort;

  // Dashboard security (IP whitelist + rate limiting)
  const { dashboardSecurity } = require('./dashboard-security');
  app.use(dashboardSecurity(config));

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        scriptSrcAttr: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", `http://localhost:${PORT}`, 'ws://localhost:*', 'wss://*'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Import middleware
  const { authenticate, redirectIfNeedsSetup, requireRole } = require('../middleware/auth');
  const { wrapRouter } = require('../utils/wrapRouter');
  const { generateClientDNA, generateClientDNAObject } = require('../utils/dna');

  // Helper for write operations
  const requireWriteRole = (roles) => (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    return requireRole(...roles)(req, res, next);
  };

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
  const routeMonitorRoutes = require('../routes/routeMonitor');

  // DNA telemetry (used by dashboard client details)
  app.get('/api/dna', (req, res) => {
    const dna = generateClientDNA(req);
    const dnaObj = generateClientDNAObject(req);
    res.json({
      success: true,
      dna,
      dnaObj,
      analysis: req.protectionAnalysis || null,
    });
  });

  // Mount authentication routes
  app.use('/api/auth', authRoutes);

  // Protected SOC / MDR APIs
  app.use('/api/soc', authenticate, wrapRouter(socRoutes));
  app.use('/api/alerts', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(alertRoutes));
  app.use('/api/incidents', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(incidentRoutes));
  app.use('/api/hunt', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(huntRoutes));
  app.use('/api/policies', authenticate, requireRole('admin'), wrapRouter(policyRoutes));
  app.use('/api/audit', authenticate, wrapRouter(auditRoutes));
  app.use('/api/integrations', authenticate, requireRole('admin'), wrapRouter(integrationRoutes));
  app.use('/api/ai', authenticate, requireRole('admin', 'analyst'), wrapRouter(aiRoutes));
  app.use('/api/threats', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(threatRoutes));
  app.use('/api/logger', authenticate, requireWriteRole(['admin', 'analyst']), wrapRouter(loggerRoutes));
  app.use('/api/sources', authenticate, requireRole('admin'), wrapRouter(dataSourceRoutes));
  app.use('/api/geo', authenticate, wrapRouter(geoRoutes));
  app.use('/api/routes', authenticate, wrapRouter(routeMonitorRoutes));

  // Serve static dashboard files FIRST (before routes)
  app.use(express.static(path.join(__dirname, '../public'), { 
    index: false,
    setHeaders: (res, filePath) => {
      // Set proper content types
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      }
    }
  }));

  // Dashboard HTML routes
  app.get('/setup.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'setup.html'));
  });

  app.get('/', redirectIfNeedsSetup, authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });

  app.get('/login.html', redirectIfNeedsSetup, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
  });

  // SPA fallback
  app.get('*', redirectIfNeedsSetup, authenticate, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (/\.[a-z0-9]{1,8}$/i.test(req.path)) return next();
    res.sendFile(path.join(__dirname, '../public', 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  // Error handlers
  const { errorHandler } = require('../middleware/errorHandler');
  const { apiNotFound } = require('../middleware/notFound');
  app.use('/api', apiNotFound);
  app.use(errorHandler);

  // Start server
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', (err) => {
      if (err) return reject(err);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${PORT} is already in use. Please set GHOST_PORT to a different port.`));
      } else {
        reject(err);
      }
    });
  });
}

module.exports = startDashboardServer;
