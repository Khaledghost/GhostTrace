/**
 * SUPER MINIMAL TEST - No Database Required!
 * 
 * Just 2 environment variables needed.
 */

const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.use(express.json());

(async () => {
  // Initialize with just email and password - that's it!
  await ghosttrace.init({
    adminEmail: 'admin@test.com',
    adminPassword: 'test12345',
  });

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
    console.log('\nApp: http://localhost:3000');
    console.log('Dashboard: http://localhost:3001\n');
  });
})();
