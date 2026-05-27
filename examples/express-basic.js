/**
 * GhostTrace - Basic Express Integration Example
 * 
 * This demonstrates the minimal integration needed to add
 * GhostTrace security to any Express application.
 * 
 * NO CONFIGURATION NEEDED!
 */

require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize GhostTrace (async IIFE)
(async () => {
  // That's it! No config needed.
  // Visit http://localhost:3001 to create your admin account.
  await ghosttrace.init();

  // Apply GhostTrace protection to all API routes
  app.use('/api', ghosttrace.secure());

  // Your application routes
  app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello, World!' });
  });

  app.get('/api/users', (req, res) => {
    res.json({ users: ['Alice', 'Bob', 'Charlie'] });
  });

  app.post('/api/data', (req, res) => {
    res.json({ success: true, received: req.body });
  });

  // Public route (not protected)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Start application
  app.listen(PORT, () => {
    console.log(`\n  🚀 Application running on http://localhost:${PORT}`);
    console.log(`  👻 GhostTrace dashboard at http://localhost:${process.env.GHOST_PORT || 3001}`);
    console.log(`\n  📋 Next step: Visit dashboard to create your admin account\n`);
  });
})().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
