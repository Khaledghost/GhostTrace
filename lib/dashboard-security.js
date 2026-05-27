/**
 * Dashboard Security Middleware
 * Protects the dashboard with IP whitelisting and rate limiting
 */

const rateLimit = require('express-rate-limit');

/**
 * Extract client IP address
 */
function getClientIp(req) {
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

/**
 * Check if IP is in whitelist
 */
function isIpAllowed(ip, whitelist) {
  if (!whitelist || whitelist.length === 0) {
    return true; // No whitelist = allow all
  }
  
  // Normalize IPv6 localhost
  const normalizedIp = ip === '::1' || ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip;
  
  // Check if IP is in whitelist
  return whitelist.some(allowedIp => {
    // Exact match
    if (normalizedIp === allowedIp) return true;
    
    // CIDR range support (simple check)
    if (allowedIp.includes('/')) {
      // Basic CIDR matching (you can use a library like 'ipaddr.js' for advanced matching)
      const [network, bits] = allowedIp.split('/');
      return normalizedIp.startsWith(network.split('.').slice(0, parseInt(bits) / 8).join('.'));
    }
    
    // Wildcard support (e.g., 192.168.*.*)
    if (allowedIp.includes('*')) {
      const pattern = allowedIp.replace(/\*/g, '\\d+').replace(/\./g, '\\.');
      return new RegExp(`^${pattern}$`).test(normalizedIp);
    }
    
    return false;
  });
}

/**
 * IP whitelist middleware
 */
function ipWhitelistMiddleware(config) {
  return (req, res, next) => {
    // Skip if dashboard is public or no whitelist configured
    if (config.dashboardPublic || !config.dashboardIpWhitelist || config.dashboardIpWhitelist.length === 0) {
      return next();
    }
    
    const clientIp = getClientIp(req);
    
    if (!isIpAllowed(clientIp, config.dashboardIpWhitelist)) {
      console.warn(`[GhostTrace] Blocked dashboard access from ${clientIp}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied: IP not whitelisted',
        message: 'This dashboard is private. Contact the administrator for access.',
      });
    }
    
    next();
  };
}

/**
 * Dashboard rate limiting
 */
function createDashboardRateLimiter(config) {
  const limit = config.dashboardRateLimit || 100;
  
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests to dashboard',
      message: 'Please try again later.',
    },
    skip: (req) => {
      // Skip rate limit for static assets
      return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(req.path);
    },
  });
}

/**
 * Combined dashboard security middleware
 */
function dashboardSecurity(config) {
  const ipWhitelist = ipWhitelistMiddleware(config);
  const rateLimiter = createDashboardRateLimiter(config);
  
  return (req, res, next) => {
    // Apply IP whitelist first
    ipWhitelist(req, res, (err) => {
      if (err) return next(err);
      
      // Then apply rate limiting
      rateLimiter(req, res, next);
    });
  };
}

module.exports = {
  dashboardSecurity,
  ipWhitelistMiddleware,
  createDashboardRateLimiter,
  getClientIp,
  isIpAllowed,
};
