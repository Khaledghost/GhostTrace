const { asyncHandler } = require('./asyncHandler');

/**
 * Automatically wrap async Express route handlers with asyncHandler.
 */
function wrapRouter(router) {
  router.stack.forEach((layer) => {
    if (!layer.route) return;
    layer.route.stack.forEach((routeLayer) => {
      const fn = routeLayer.handle;
      if (typeof fn === 'function' && fn.length < 4) {
        routeLayer.handle = asyncHandler(fn);
      }
    });
  });
  return router;
}

module.exports = { wrapRouter };
