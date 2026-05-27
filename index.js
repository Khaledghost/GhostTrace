/**
 * GhostTrace - Drop-in behavioral detection & response for Node.js/Express
 * 
 * Quick Start:
 *   const ghosttrace = require('ghosttrace');
 *   await ghosttrace.init({ adminEmail: '...', adminPassword: '...' });
 *   app.use('/api', ghosttrace.secure());
 */

const ghosttrace = {
  init: require('./lib/init'),
  secure: require('./lib/middleware'),
  version: require('./package.json').version,
};

module.exports = ghosttrace;
module.exports.default = ghosttrace;
