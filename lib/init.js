/**
 * Initialization Module
 * Main entry point for setting up GhostTrace in a user's application
 */

const GhostTraceConfig = require('./config');
const setupAdminUser = require('./setup-admin');
const startDashboardServer = require('./dashboard-server');
const { connectDB, isDbReady } = require('../config/database');
const { getKey } = require('../utils/secretStore');

let initialized = false;

async function init(userConfig = {}) {
  if (initialized) {
    console.warn('  ⚠ GhostTrace already initialized, skipping...');
    return global.__ghosttrace_instance;
  }

  try {
    // Create and validate configuration
    const config = new GhostTraceConfig(userConfig);
    config.validate();

    console.log(`\n  🚀 Initializing GhostTrace Security Layer...`);

    // Initialize database only if configured
    const dbConfigured = config.database.enabled !== false && 
                         process.env.DB_ENABLED !== 'false';
    
    if (dbConfigured) {
      // Ensure encryption key exists when persistence is enabled
      getKey({ allowGenerate: true });
      try {
        console.log(`  ℹ Connecting to database...`);
        await connectDB({
          retries: 3,
          delayMs: 1000,
          required: false,
        });
        
        // Create/update admin user if credentials provided and DB is ready
        if (isDbReady() && config.adminEmail && config.adminPassword) {
          await setupAdminUser(config.adminEmail, config.adminPassword);
        } else if (isDbReady()) {
          console.log(`  ℹ No admin credentials provided - use setup page on first run`);
        } else {
          console.log(`  ℹ Running in-memory mode - use setup page on first run`);
        }
      } catch (error) {
        const errorMsg = error.message || error.toString() || 'Unknown error';
        console.warn(`  ⚠ Database connection failed: ${errorMsg}`);
        console.log(`  ℹ Running in-memory mode - use setup page on first run`);
      }
    } else {
      console.log(`  ℹ Running in-memory mode - use setup page on first run`);
    }

    // Restore data sources if enabled and DB is ready
    if (isDbReady() && process.env.RESTORE_DATASOURCES !== 'false') {
      try {
        const dbConnector = require('../core/dbConnector');
        const restored = await dbConnector.restorePersisted();
        if (restored.length) {
          console.log(`  ✓ Restored ${restored.filter((r) => r.ok).length}/${restored.length} data source(s)`);
        }
      } catch (error) {
        // Silent fail - not critical
      }
    }

    // Start dashboard server
    let dashboardServer;
    try {
      dashboardServer = await startDashboardServer(config);
      console.log(`  ✓ Dashboard server started on port ${config.dashboardPort}`);
    } catch (error) {
      console.error(`  ❌ Failed to start dashboard server: ${error.message}`);
      throw error;
    }

    // Success message
    console.log(`\n  👻 GhostTrace Security Layer Initialized`);
    console.log(`  ────────────────────────────────────────`);
    console.log(`  🌐 Dashboard: http://localhost:${config.dashboardPort}`);
    if (config.adminEmail) {
      console.log(`  👤 Admin: ${config.adminEmail}`);
    } else {
      console.log(`  👤 Admin: Create via setup page`);
    }
    const dbType = config.database.type || 'sqlite';
    const dbStatus = isDbReady() ? `${dbType} ✓` : 'in-memory';
    console.log(`  🗄️  Database: ${dbStatus}`);
    if (config.dashboardPublic) {
      console.log(`  🌍 Dashboard: PUBLIC (accessible from any IP)`);
    } else if (config.dashboardIpWhitelist && config.dashboardIpWhitelist.length > 0) {
      console.log(`  🔒 Dashboard: PRIVATE (${config.dashboardIpWhitelist.length} IPs whitelisted)`);
    } else {
      console.log(`  🔒 Dashboard: PRIVATE (localhost only)`);
    }
    console.log(`  🛡️  Protection: ${config.blockOnThreat ? 'ACTIVE (blocking)' : 'PASSIVE (monitoring)'}`);
    console.log(`  📊 Risk Threshold: ${config.blockThreshold}`);
    console.log(`  🚦 Rate Limit: ${config.rateLimit} req/min`);
    if (config.ai.provider) {
      console.log(`  🤖 AI: ${config.ai.provider}`);
    }
    console.log(`  ────────────────────────────────────────\n`);

    const instance = {
      config,
      dashboardServer,
      stop: async () => {
        console.log('  🛑 Stopping GhostTrace...');
        if (dashboardServer) {
          await new Promise((resolve) => dashboardServer.close(resolve));
        }
        const { sequelize } = require('../config/database');
        if (sequelize) {
          await sequelize.close();
        }
        initialized = false;
        console.log('  ✓ GhostTrace stopped');
      },
    };

    // Emit a startup audit entry (ensures audit trail is never empty)
    try {
      const auditService = require('../services/auditService');
      await auditService.log({
        action: 'ghosttrace.started',
        actor: 'system',
        resourceType: 'service',
        resourceId: `ghosttrace:${config.dashboardPort}`,
        metadata: { version: require('../package.json').version },
      });
    } catch (_) {
      // audit is best-effort only
    }

    // Store globally
    global.__ghosttrace_instance = instance;
    initialized = true;

    return instance;
  } catch (error) {
    console.error(`\n  ❌ Failed to initialize GhostTrace: ${error.message}\n`);
    throw error;
  }
}

module.exports = init;
