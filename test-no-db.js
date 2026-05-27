/**
 * Minimal GhostTrace Test (NO DATABASE REQUIRED)
 * 
 * This will work immediately without any database setup.
 */

require('dotenv').config();

// Force disable database for testing
process.env.DB_ENABLED = 'false';

const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.use(express.json());

console.log('\n🧪 Testing GhostTrace (In-Memory Mode)\n');

(async () => {
  try {
    // Initialize GhostTrace
    await ghosttrace.init({
      adminEmail: process.env.GHOST_ADMIN_EMAIL || 'admin@test.com',
      adminPassword: process.env.GHOST_ADMIN_PASS || 'test12345',
      dashboardPort: process.env.GHOST_PORT || 3001,
    });

    // Protect API routes
    app.use('/api', ghosttrace.secure());

    // Test routes
    app.get('/api/hello', (req, res) => {
      res.json({ 
        message: 'Hello! This route is protected by GhostTrace.',
        timestamp: new Date().toISOString(),
      });
    });

    app.post('/api/data', (req, res) => {
      res.json({ 
        success: true, 
        received: req.body,
        message: 'Data received and analyzed by GhostTrace',
      });
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'ok', ghosttrace: 'active' });
    });

    // Start app
    const PORT = 3000;
    app.listen(PORT, () => {
      console.log('\n✅ Test successful!\n');
      console.log('  📱 Your app: http://localhost:' + PORT);
      console.log('  👻 Dashboard: http://localhost:' + (process.env.GHOST_PORT || 3001));
      console.log('\n🧪 Try these:');
      console.log('  curl http://localhost:' + PORT + '/api/hello');
      console.log('  curl http://localhost:' + PORT + '/health');
      console.log('\n📊 Login to dashboard:');
      console.log('  Email: ' + (process.env.GHOST_ADMIN_EMAIL || 'admin@test.com'));
      console.log('  Pass: ' + (process.env.GHOST_ADMIN_PASS || 'test12345'));
      console.log('\n💡 Note: Running without database (in-memory only)\n');
    });

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error('\n💡 Check TROUBLESHOOTING.md for help\n');
    process.exit(1);
  }
})();
