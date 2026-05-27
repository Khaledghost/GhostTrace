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

  // SQLite support (embedded database)
  if (cfg.dialect === 'sqlite' || opts.dialect === 'sqlite') {
    const fs = require('fs');
    const path = require('path');
    const storage = cfg.storage || opts.storage || './data/ghosttrace.sqlite';
    
    // Ensure data directory exists
    const dir = path.dirname(storage);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    return new Sequelize({
      dialect: 'sqlite',
      storage,
      logging,
    });
  }

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

async function tryCreateDatabase() {
  const cfg = platformDb.getConfig();
  const opts = platformDb.buildSequelizeOptions(cfg);
  
  if (opts.url) {
    return;
  }

  try {
    const { Sequelize } = require('sequelize');
    const tempSequelize = new Sequelize('postgres', cfg.username, cfg.password, {
      host: cfg.host,
      port: cfg.port,
      dialect: 'postgres',
      logging: false,
      dialectOptions: cfg.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    });

    await tempSequelize.authenticate();
    
    const [results] = await tempSequelize.query(
      `SELECT 1 FROM pg_database WHERE datname = '${cfg.database}'`
    );

    if (results.length === 0) {
      await tempSequelize.query(`CREATE DATABASE "${cfg.database}"`);
      console.log(`  ✓ Created database: ${cfg.database}`);
    }

    await tempSequelize.close();
  } catch (error) {
    if (error.message) {
      console.warn(`  ⚠ Could not auto-create database: ${error.message || error}`);
    }
  }
}

const connectDB = async (options = {}) => {
  loadModels();
  const {
    retries = parseInt(process.env.DB_CONNECT_RETRIES || '10', 10),
    delayMs = parseInt(process.env.DB_CONNECT_DELAY_MS || '3000', 10),
    required = process.env.DB_REQUIRED !== 'false',
  } = options;

  await tryCreateDatabase();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      dbReady = true;
      const cfg = platformDb.getConfig();
      console.log(`  ✓ Database connected (${cfg.host}:${cfg.port}/${cfg.database})`);

      if (process.env.DB_SYNC === 'true' || process.env.GHOST_DB_SYNC === 'true' || cfg.dialect === 'sqlite') {
        await sequelize.sync({ alter: true });
        console.log('  ✓ Database tables synced');
        const policyService = require('../services/policyService');
        await policyService.seedDefaults();
        await policyService.refreshMemoryFromDb();
        const aiConfigService = require('../services/aiConfigService');
        await aiConfigService.seedFromEnv();
      }
      return;
    } catch (error) {
      dbReady = false;
      const errorMsg = error.message || error.toString() || 'Unknown error';
      console.error(`  ⚠ Database connection attempt ${attempt}/${retries} failed: ${errorMsg}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  if (required) {
    console.error('  ❌ Database connection failed after all retries');
    console.error('  💡 Tip: Set DB_ENABLED=false in .env to run without database');
    process.exit(1);
  }
  console.warn('  ⚠ Database unavailable — continuing without persistence');
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
