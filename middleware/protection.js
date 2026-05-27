/**
 * Protection Middleware — AI-powered security layer for any Express/Node backend.
 *
 * QUICK START (drop into any Express app):
 *
 *   const createProtectionMiddleware = require('./middleware/protection');
 *   app.use(createProtectionMiddleware());
 *
 * ADVANCED (full configuration):
 *
 *   app.use(createProtectionMiddleware({
 *     enableAnalysis:       true,           // Run behavioral anomaly detection
 *     blockOnThreat:        true,           // Block requests above threshold
 *     riskBlockThreshold:   70,             // 0-100 risk score to block
 *     rateLimitPerWindow:   120,            // Max requests per window
 *     rateLimitWindowMs:    60000,          // Rate limit window (ms)
 *     explainOnBlock:       true,           // Include AI explanation in block response
 *     passthrough:          false,          // If true, never block (analysis only mode)
 *     identifyUser: (req) => ({ userId, accountId }),
 *     mapActivity:  (req) => ({ activityType, ... }),
 *     onThreat:     async (req, res, analysis) => { ... },   // custom threat handler
 *     allowlist:    ['/health', /^\/public\//],              // paths to skip
 *   }));
 */

const threatDetectionService = require('../services/threatDetectionService');
const { generateClientDNA, generateClientDNAObject } = require('../utils/dna');
const RequestLogger = require('./requestLogger');
const routeLogger = require('../services/routeLogger');

const DEFAULT_ALLOWLIST = [
  '/health',
  '/favicon.ico',
  /^\/public\//,
  /^\/styles\//,
  /^\/assets\//,
];

module.exports = function createProtectionMiddleware(options = {}) {
  const {
    enableAnalysis      = true,
    blockOnThreat       = true,
    riskBlockThreshold  = parseInt(process.env.BLOCK_RISK_THRESHOLD || '70', 10),
    anomalyBlockCount   = 2,
    rateLimitPerWindow  = parseInt(process.env.RATE_LIMIT || '120', 10),
    rateLimitWindowMs   = 60 * 1000,
    explainOnBlock      = true,
    passthrough         = false,
    allowlist           = [],
    identifyUser        = defaultIdentifyUser,
    mapActivity         = defaultMapActivity,
    onThreat            = null,
    routePath           = null,
  } = options;

  const combinedAllowlist = [...DEFAULT_ALLOWLIST, ...allowlist];
  const rateLimitMap = new Map();

  return async function protectionMiddleware(req, res, next) {
    const startTime = Date.now();
    
    try {
      // ── DNA Fingerprint ──────────────────────────────────────────────────
      const dna = generateClientDNA(req);
      const dnaObj = generateClientDNAObject(req);
      req.clientDNA = dna;
      req.clientDNAObj = dnaObj;
      res.setHeader('X-Client-DNA', dna);
      res.cookie?.('client_dna', dna, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });

      const pathStr = req.originalUrl || req.path || '';
      const isAnalystRoute = /^\/api\/(soc|alerts|incidents|hunt|policies|audit|threats|logger|sources|auth|integrations|routes)/.test(pathStr)
        || pathStr === '/' || pathStr.endsWith('.html') || pathStr.endsWith('.css') || pathStr.endsWith('.js');
      const skipBlockForAnalyst = !!(req.cookies?.auth_token && isAnalystRoute);

      // ─── Allowlist check ───────────────────────────────────────────────────
      const isAllowed = combinedAllowlist.some(p =>
        typeof p === 'string' ? pathStr.startsWith(p) : p.test(pathStr)
      );
      if (isAllowed) return next();

      // ── Rate Limiting ────────────────────────────────────────────────────
      const ip = extractIp(req);
      const rlKey = `${dna}|${ip}`;
      const now = Date.now();
      let rl = rateLimitMap.get(rlKey);
      if (!rl || rl.resetAt <= now) {
        rl = { count: 0, resetAt: now + rateLimitWindowMs };
        rateLimitMap.set(rlKey, rl);
      }
      rl.count++;
      if (rl.count > rateLimitPerWindow) {
        const retryAfter = Math.ceil((rl.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-Blocked-By', 'BehavioralDNA-RateLimit');
        
        // Log the blocked request
        const blockedAnalysis = { 
          blocked: true, 
          riskScore: 100, 
          threatLevel: 'critical',
          anomalies: [{ type: 'rate_limit_exceeded', severity: 'critical' }]
        };
        routeLogger.logRequest(req, res, blockedAnalysis);
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfterSeconds: retryAfter,
        });
      }

      // ── Behavioral Analysis ──────────────────────────────────────────────
      let analysis = null;
      if (enableAnalysis) {
        const { userId, accountId } = identifyUser(req);
        const baseActivity = mapActivity(req);

        const activity = {
          ...baseActivity,
          userId,
          accountId,
          ipAddress: ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
          deviceInfo: {
            ...(baseActivity.deviceInfo || {}),
            fingerprint: dna,
            features: dnaObj.features,
          },
          endpoint: req.originalUrl,
          rawUrl: req.originalUrl,
          query: req.query,
          method: req.method,
          body: req.body,
          requestSize: parseInt(req.headers['content-length'] || '0', 10),
        };

        try {
          analysis = await threatDetectionService.analyzeActivity(activity);
          req.protectionAnalysis = analysis;
          req.clientDNAKey = analysis.profileKey;

          // Capture response status for logging
          const originalSend = res.send;
          const originalJson = res.json;
          
          res.send = function(data) {
            res.send = originalSend;
            const result = originalSend.call(this, data);
            routeLogger.logRequest(req, res, analysis);
            return result;
          };
          
          res.json = function(data) {
            res.json = originalJson;
            const result = originalJson.call(this, data);
            routeLogger.logRequest(req, res, analysis);
            return result;
          };

          // ── Blocking logic ─────────────────────────────────────────────
          if (!passthrough && !skipBlockForAnalyst && blockOnThreat && analysis) {
            const shouldBlock =
              analysis.isThreat &&
              (analysis.riskScore >= riskBlockThreshold ||
               analysis.anomalies.length >= anomalyBlockCount ||
               analysis.threatLevel === 'critical');

            if (shouldBlock) {
              res.setHeader('X-Blocked-By', 'BehavioralDNA');
              res.setHeader('X-Risk-Score', analysis.riskScore);
              res.setHeader('X-Threat-Level', analysis.threatLevel);
              threatDetectionService._engine && (threatDetectionService.getAllStats().totalBlocked =
                (threatDetectionService.getAllStats().totalBlocked || 0) + 1);

              // Mark as blocked in log
              analysis.blocked = true;
              routeLogger.logRequest(req, res, analysis);

              // Custom threat handler takes priority
              if (typeof onThreat === 'function') {
                return onThreat(req, res, analysis);
              }

              const responseBody = {
                success: false,
                error: 'Request blocked: suspicious behavior detected',
                riskScore: analysis.riskScore,
                threatLevel: analysis.threatLevel,
                anomalies: analysis.anomalies.map(a => ({ type: a.type, severity: a.severity })),
              };

              if (explainOnBlock && analysis.explanation) {
                responseBody.explanation = analysis.explanation.explanation;
                responseBody.recommendedActions = analysis.explanation.actions;
              }

              return res.status(403).json(responseBody);
            }
          }
        } catch (err) {
          // Never fail the upstream request due to analysis errors
          const errorAnalysis = { error: true, message: err.message, riskScore: 0, threatLevel: 'none' };
          req.protectionAnalysis = errorAnalysis;
          routeLogger.logRequest(req, res, errorAnalysis);
        }
      } else {
        // Log even without analysis
        const basicAnalysis = { riskScore: 0, threatLevel: 'none', blocked: false };
        
        // Capture response for logging
        const originalSend = res.send;
        const originalJson = res.json;
        
        res.send = function(data) {
          res.send = originalSend;
          const result = originalSend.call(this, data);
          routeLogger.logRequest(req, res, basicAnalysis);
          return result;
        };
        
        res.json = function(data) {
          res.json = originalJson;
          const result = originalJson.call(this, data);
          routeLogger.logRequest(req, res, basicAnalysis);
          return result;
        };
      }

      next();
    } catch (error) {
      const errorAnalysis = { error: true, message: error.message, riskScore: 0, threatLevel: 'none' };
      req.protectionAnalysis = errorAnalysis;
      routeLogger.logRequest(req, res, errorAnalysis);
      next();
    }
  };
};

// ─── Default helpers ──────────────────────────────────────────────────────────

function defaultIdentifyUser(req) {
  return {
    userId: req.headers['x-user-id'] || req.user?.id || 'anonymous',
    accountId: req.headers['x-account-id'] || req.headers['x-tenant-id'] || 'default',
  };
}

function defaultMapActivity(req) {
  return {
    activityType: req.method === 'POST' && /login|auth|signin/i.test(req.path)
      ? 'login'
      : 'api_call',
  };
}

function extractIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}
