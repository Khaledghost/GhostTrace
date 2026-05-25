const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'dna',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '0', 10),
      acquire: 30000,
      idle: 10000,
    },
  }
);

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
      console.log('PostgreSQL connected successfully');

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
      if (/password authentication failed/i.test(error.message) && attempt === 1) {
        console.error(
          'Hint: Postgres only sets the password on first boot. If you changed DB_PASS in .env,\n' +
          '      reset the data volume: docker compose down -v && docker compose up -d'
        );
      }
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

const isDbReady = () => dbReady;

module.exports = { sequelize, connectDB, isDbReady };
