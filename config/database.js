const { Sequelize } = require('sequelize');
const platformDb = require('./platformDb');

function buildSequelize() {
  const cfg = platformDb.getConfig();
  const opts = platformDb.buildSequelizeOptions(cfg);
  const logging = process.env.NODE_ENV === 'development' ? console.log : false;
  const pool = {
    max: cfg.poolMax || parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    acquire: cfg.connectTimeoutMs || 30000,
    idle: 10000,
  };

  if (opts.url) {
    return new Sequelize(opts.url, { dialect: 'postgres', logging, pool });
  }

  return new Sequelize(cfg.database, cfg.username, cfg.password, {
    host: cfg.host,
    port: cfg.port,
    dialect: 'postgres',
    logging,
    dialectOptions: opts.dialectOptions,
    pool,
  });
}

const sequelize = buildSequelize();
let dbReady = false;

const loadModels = () => {
  require('../models');
};

const connectDB = async (options = {}) => {
  loadModels();
  const {
    retries = parseInt(process.env.DB_CONNECT_RETRIES || '10', 10),
    delayMs = parseInt(process.env.DB_CONNECT_DELAY_MS || '3000', 10),
    required = process.env.DB_REQUIRED !== 'false',
  } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      dbReady = true;
      const cfg = platformDb.getConfig();
      console.log(`PostgreSQL connected (${cfg.host}:${cfg.port}/${cfg.database})`);

      if (process.env.DB_SYNC === 'true') {
        await sequelize.sync({ alter: true });
        console.log('Database models synced');
        const policyService = require('../services/policyService');
        await policyService.seedDefaults();
        await policyService.refreshMemoryFromDb();
        const aiConfigService = require('../services/aiConfigService');
        await aiConfigService.seedFromEnv();
      }
      return;
    } catch (error) {
      dbReady = false;
      console.error(`PostgreSQL connection attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  if (required) {
    console.error('PostgreSQL connection failed after all retries');
    process.exit(1);
  }
  console.warn('PostgreSQL unavailable — continuing without persistence');
};

async function savePlatformConfig(patch) {
  const saved = platformDb.saveConfig(patch);
  const cfg = platformDb.getConfig();
  const dbConnector = require('../core/dbConnector');
  try {
    await dbConnector.testConnection({
      ...cfg,
      type: 'postgres',
      id: '__platform_test__',
      connectionMode: cfg.connectionMode,
      connectionString: cfg.connectionString,
    });
    return { config: saved, tested: true, needsRestart: true };
  } catch (err) {
    return { config: saved, tested: false, error: err.message, needsRestart: true };
  }
}

const isDbReady = () => dbReady;

module.exports = { sequelize, connectDB, isDbReady, savePlatformConfig };
