/**
 * Middleware Factory
 * Creates the protection middleware with route-specific configuration
 */

const createProtectionMiddleware = require('../middleware/protection');
const routeLogger = require('../services/routeLogger');

function secure(options = {}) {
  // Get global config from init() call
  const globalConfig = global.__ghosttrace_config || {};
  
  // Get the route path - required for registration
  const routePath = options.path || options.routePath;
  const app = options.app || globalConfig.app;
  
  if (!routePath) {
    console.warn('[GhostTrace] Warning: No path provided to secure(). Routes will register on first request.');
  }
  
  // Merge global config with route-specific options
  const config = {
    enableAnalysis: true,
    blockOnThreat: options.blockOnThreat !== undefined ? options.blockOnThreat : globalConfig.blockOnThreat,
    riskBlockThreshold: options.riskThreshold || options.blockThreshold || globalConfig.blockThreshold || 70,
    rateLimitPerWindow: options.rateLimit || globalConfig.rateLimit || 120,
    explainOnBlock: true,
    allowlist: options.allowlist || [],
    routePath: routePath,
    ...options,
  };

  // Pre-register routes from the Express app if available
  if (app) {
    scheduleRouteRegistration(app, routePath, config);
  } else if (routePath) {
    // Fallback: register the secured prefix so it appears immediately
    routeLogger.registerRoute('USE', routePath, {
      blockOnThreat: config.blockOnThreat,
      riskBlockThreshold: config.riskBlockThreshold,
      rateLimitPerWindow: config.rateLimitPerWindow,
    });
  }

  return createProtectionMiddleware(config);
}

module.exports = secure;

function scheduleRouteRegistration(app, basePath, config) {
  if (!app) return;
  if (!app.__ghosttraceRoutesRegistered) {
    app.__ghosttraceRoutesRegistered = true;
  }

  // Register on next tick (after routes are defined in the same sync block)
  setImmediate(() => {
    registerRoutesFromApp(app, basePath, config);
  });

  // Also hook into app.listen to register after all routes are mounted
  if (!app.__ghosttraceListenPatched && typeof app.listen === 'function') {
    app.__ghosttraceListenPatched = true;
    const originalListen = app.listen.bind(app);
    app.listen = (...args) => {
      registerRoutesFromApp(app, basePath, config);
      return originalListen(...args);
    };
  }
}

function collectExpressRoutes(app) {
  const routes = [];
  const stack = app?._router?.stack || [];

  const walk = (layers, prefix = '') => {
    layers.forEach((layer) => {
      if (layer.route?.path) {
        const routePath = normalizePath(prefix + layer.route.path);
        const methods = Object.keys(layer.route.methods || {})
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());
        methods.forEach((method) => routes.push({ method, path: routePath }));
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const layerPath = getLayerPath(layer);
        walk(layer.handle.stack, normalizePath(prefix + layerPath));
      }
    });
  };

  walk(stack);
  return routes;
}

function getLayerPath(layer) {
  if (layer.path) return layer.path;
  if (!layer.regexp) return '';
  if (layer.regexp.fast_slash) return '';
  let path = layer.regexp.source;
  path = path
    .replace('^\\/', '/')
    .replace('\\/?(?=\\/|$)', '')
    .replace('(?=\\/|$)', '')
    .replace('(?:', '')
    .replace(')', '')
    .replace('\\/', '/')
    .replace('^', '')
    .replace('$', '');
  path = path.replace(/\(\[\^\\\/\]\+\?\)/g, ':param');
  return path || '';
}

function normalizePath(path) {
  if (!path) return '';
  return path.replace(/\/{2,}/g, '/');
}

function registerRoutesFromApp(app, basePath, config) {
  const routes = collectExpressRoutes(app);
  routes.forEach(({ method, path }) => {
    if (basePath && !path.startsWith(basePath)) return;
    routeLogger.registerRoute(method, path, {
      blockOnThreat: config.blockOnThreat,
      riskBlockThreshold: config.riskBlockThreshold,
      rateLimitPerWindow: config.rateLimitPerWindow,
      source: 'express',
    });
  });

  // If we still didn't find anything, register the secured prefix
  if (!routes.length && basePath) {
    routeLogger.registerRoute('USE', basePath, {
      blockOnThreat: config.blockOnThreat,
      riskBlockThreshold: config.riskBlockThreshold,
      rateLimitPerWindow: config.rateLimitPerWindow,
      source: 'fallback',
    });
  }
}
