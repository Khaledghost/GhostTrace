/**
 * API Not Found Handler
 * Only returns 404 for unmatched GhostTrace dashboard API routes
 * Does NOT interfere with user application routes
 */
function apiNotFound(req, res, next) {
  // This middleware is mounted on '/api' in the dashboard server
  // It should only catch unmatched dashboard API routes
  
  // If response already sent, skip
  if (res.headersSent) {
    return next();
  }
  
  // Define known dashboard API prefixes
  const dashboardAPIs = [
    '/soc', '/alerts', '/incidents', '/hunt', '/policies',
    '/audit', '/threats', '/logger', '/sources', '/geo',
    '/auth', '/integrations', '/routes', '/ai'
  ];
  
  // Check if the request path (after /api) matches a dashboard API
  const isDashboardAPI = dashboardAPIs.some(api => 
    req.path.startsWith(api)
  );
  
  // Only return 404 if it's clearly a dashboard API that wasn't found
  if (isDashboardAPI) {
    return res.status(404).json({
      success: false,
      error: 'API route not found',
      path: req.originalUrl,
    });
  }
  
  // For anything else, pass through (let user's app handle it)
  next();
}

module.exports = { apiNotFound };
