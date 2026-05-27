/**
 * GhostTrace - Super Minimal Test
 * 
 * Absolutely minimal integration - ZERO configuration!
 */

const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.use(express.json());

(async () => {
  // Just initialize - no config needed!
  await ghosttrace.init();

  // Protect routes
  app.use('/api', ghosttrace.secure());

  // Routes
  app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello! Protected by GhostTrace.' });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Start
  app.listen(3000, () => {
    console.log('\n✅ App running!');
    console.log('  App: http://localhost:3000');
    console.log('  Dashboard: http://localhost:3001');
    console.log('\n📋 Visit dashboard to create your admin account\n');
  });
})();
