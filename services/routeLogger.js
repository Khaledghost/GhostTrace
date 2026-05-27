/**
 * Route Logger Service
 * Tracks all requests through secured routes with full details
 */

class RouteLogger {
  constructor() {
    this.routes = new Map(); // route key -> metadata
    this.logs = []; // Array of request logs
    this.maxLogs = 1000; // Keep last 1000 requests
  }

  /**
   * Register a route with specific method
   */
  registerRoute(method, path, options = {}) {
    const key = `${method}:${path}`;
    
    if (!this.routes.has(key)) {
      console.log(`[RouteLogger] Registering route: ${method} ${path}`);
      this.routes.set(key, {
        method,
        path,
        registeredAt: new Date(),
        requestCount: 0,
        options,
      });
    }
  }

  /**
   * Update route with actual request method and path
   */
  updateRouteFromRequest(req) {
    const method = req.method;
    const path = this.extractRoutePath(req);
    const key = `${method}:${path}`;
    
    if (!this.routes.has(key)) {
      this.registerRoute(method, path, {});
    }
    
    // Update request count
    const route = this.routes.get(key);
    if (route) {
      route.requestCount++;
      route.lastRequest = new Date();
    }
    
    return key;
  }

  /**
   * Extract the route path from request (without query params)
   */
  extractRoutePath(req) {
    // Get the base path without query string
    let path = req.originalUrl || req.url || req.path;
    
    // Remove query string
    const queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
      path = path.substring(0, queryIndex);
    }
    
    return path;
  }

  /**
   * Log a request
   */
  logRequest(req, res, analysis) {
    // Update route tracking
    this.updateRouteFromRequest(req);
    
    const log = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      method: req.method,
      path: this.extractRoutePath(req),
      fullUrl: req.originalUrl || req.url,
      ip: this.extractIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      
      // Request details
      query: req.query,
      params: req.params,
      body: this.sanitizeBody(req.body),
      headers: this.sanitizeHeaders(req.headers),
      
      // Response details
      statusCode: res.statusCode,
      
      // GhostTrace analysis
      riskScore: analysis?.riskScore || 0,
      threatLevel: analysis?.threatLevel || 'none',
      blocked: analysis?.blocked || false,
      anomalies: analysis?.anomalies || [],
      
      // DNA fingerprint
      clientDNA: req.clientDNA || 'unknown',
    };

    this.logs.unshift(log);
    
    // Keep only max logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return log;
  }

  /**
   * Get all registered routes
   */
  getRoutes() {
    return Array.from(this.routes.values());
  }

  /**
   * Get logs with filters
   */
  getLogs(filters = {}) {
    let filtered = [...this.logs];

    if (filters.method) {
      filtered = filtered.filter(log => log.method === filters.method);
    }

    if (filters.path) {
      filtered = filtered.filter(log => log.path.includes(filters.path));
    }

    if (filters.ip) {
      filtered = filtered.filter(log => log.ip === filters.ip);
    }

    if (filters.blocked !== undefined) {
      filtered = filtered.filter(log => log.blocked === filters.blocked);
    }

    if (filters.minRiskScore) {
      filtered = filtered.filter(log => log.riskScore >= filters.minRiskScore);
    }

    // Pagination
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    return {
      total: filtered.length,
      logs: filtered.slice(offset, offset + limit),
    };
  }

  /**
   * Get stats
   */
  getStats() {
    const totalRequests = this.logs.length;
    const blockedRequests = this.logs.filter(log => log.blocked).length;
    const highRiskRequests = this.logs.filter(log => log.riskScore >= 70).length;
    
    const uniqueIPs = new Set(this.logs.map(log => log.ip)).size;
    const uniquePaths = new Set(this.logs.map(log => log.path)).size;

    const methodCounts = {};
    this.logs.forEach(log => {
      methodCounts[log.method] = (methodCounts[log.method] || 0) + 1;
    });

    return {
      totalRequests,
      blockedRequests,
      highRiskRequests,
      uniqueIPs,
      uniquePaths,
      methodCounts,
      registeredRoutes: this.routes.size,
    };
  }

  /**
   * Extract IP from request
   */
  extractIp(req) {
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
   * Sanitize request body (remove sensitive data)
   */
  sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize headers
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }
}

// Singleton instance
const routeLogger = new RouteLogger();

module.exports = routeLogger;
