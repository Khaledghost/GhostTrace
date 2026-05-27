/**
 * GhostTrace - Production Security Example
 * 
 * Shows how to configure GhostTrace for production with:
 * - SQLite database (embedded)
 * - IP whitelisting
 * - Rate limiting
 * - Nginx-ready configuration
 */

require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.use(express.json());

// Trust proxy if behind Nginx
app.set('trust proxy', 1);

(async () => {
  // Initialize with security settings
  await ghosttrace.init({
    // Optional: Auto-create admin
    adminEmail: process.env.GHOST_ADMIN_EMAIL,
    adminPassword: process.env.GHOST_ADMIN_PASS,
    
    // Dashboard port
    dashboardPort: 3001,
    
    // Dashboard security
    dashboardPublic: false, // Private by default
    dashboardIpWhitelist: [
      '192.168.1.0/24',  // Office network
      '10.8.0.0/24',     // VPN network
    ],
    dashboardRateLimit: 100, // Max 100 requests per 15 minutes
    
    // Database (SQLite by default)
    database: {
      type: 'sqlite',
      storage: './data/production.db',
    },
    
    // Security thresholds
    blockThreshold: 70,
    rateLimit: 120,
    blockOnThreat: true,
  });

  // Protect API routes
  app.use('/api', ghosttrace.secure());

  // Your application routes
  app.get('/api/users', (req, res) => {
    res.json({ users: [] });
  });

  app.post('/api/data', (req, res) => {
    res.json({ success: true, data: req.body });
  });

  // Start application
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`\n  🚀 Application running on http://localhost:${PORT}`);
    console.log(`  👻 GhostTrace dashboard at http://localhost:3001`);
    console.log(`  🔒 Dashboard is PRIVATE (whitelisted IPs only)`);
    console.log(`  🗄️  Database: SQLite (./data/production.db)\n`);
  });
})().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
