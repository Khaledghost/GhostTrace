/**
 * Configuration Management for GhostTrace
 * Handles all environment variables and user-provided config
 */

class GhostTraceConfig {
  constructor(userConfig = {}) {
    // Required credentials (optional - setup page will handle)
    this.adminEmail = userConfig.adminEmail || process.env.GHOST_ADMIN_EMAIL;
    this.adminPassword = userConfig.adminPassword || process.env.GHOST_ADMIN_PASS;
    
    // Port configuration
    this.dashboardPort = userConfig.dashboardPort || parseInt(process.env.GHOST_PORT || process.env.PORT || '3001', 10);
    this.proxyPort = userConfig.proxyPort || parseInt(process.env.GHOST_PROXY || '3002', 10);
    
    // Security thresholds
    this.blockThreshold = userConfig.blockThreshold || parseInt(process.env.GHOST_BLOCK_THRESHOLD || process.env.BLOCK_RISK_THRESHOLD || '70', 10);
    this.rateLimit = userConfig.rateLimit || parseInt(process.env.GHOST_RATE_LIMIT || process.env.RATE_LIMIT || '120', 10);
    this.blockOnThreat = userConfig.blockOnThreat !== false && process.env.GHOST_BLOCK_ON_THREAT !== 'false' && process.env.BLOCK_ON_THREAT !== 'false';
    
    // Dashboard security settings
    this.dashboardPublic = userConfig.dashboardPublic || process.env.GHOST_DASHBOARD_PUBLIC === 'true' || false;
    this.dashboardIpWhitelist = userConfig.dashboardIpWhitelist || this.parseIpList(process.env.GHOST_DASHBOARD_IPS);
    this.dashboardRateLimit = userConfig.dashboardRateLimit || parseInt(process.env.GHOST_DASHBOARD_RATE_LIMIT || '100', 10);
    
    // Database config
    this.database = userConfig.database || this.getDatabaseConfig();
    
    // AI config
    this.ai = userConfig.ai || this.getAIConfig();

    // Optional Express app reference (used for route registration)
    this.app = userConfig.app || null;

    // Encryption settings
    if (userConfig.requireEncryption !== undefined) {
      process.env.GHOST_REQUIRE_ENCRYPTION = userConfig.requireEncryption ? 'true' : 'false';
    }
    if (userConfig.encryptionKeyPath) {
      process.env.GHOST_ENCRYPTION_KEY_PATH = userConfig.encryptionKeyPath;
    }

    // Store globally for middleware access
    global.__ghosttrace_config = this;
  }

  parseIpList(envVar) {
    if (!envVar) return [];
    return envVar.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
  }

  getDatabaseConfig() {
    // Check if user explicitly configured external database
    const hasExternalDb = process.env.GHOST_DB_HOST || process.env.DB_HOST || 
                          process.env.GHOST_DB_USER || process.env.DB_USER ||
                          process.env.DATABASE_URL || process.env.DB_URI;
    
    // Use SQLite by default (embedded database)
    if (!hasExternalDb) {
      const dataDir = process.env.GHOST_DATA_DIR || './data';
      const dbPath = process.env.GHOST_DB_PATH || `${dataDir}/ghosttrace.sqlite`;
      
      return {
        enabled: true,
        type: 'sqlite',
        storage: dbPath,
      };
    }
    
    // External database configured
    const dbType = process.env.GHOST_DB_TYPE || process.env.DB_TYPE || 'postgres';
    
    return {
      enabled: true,
      type: dbType,
      host: process.env.GHOST_DB_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.GHOST_DB_PORT || process.env.DB_PORT || '5432', 10),
      name: process.env.GHOST_DB_NAME || process.env.DB_NAME || 'ghosttrace',
      user: process.env.GHOST_DB_USER || process.env.DB_USER || 'postgres',
      password: process.env.GHOST_DB_PASS || process.env.DB_PASS || '',
      ssl: process.env.GHOST_DB_SSL === 'true' || process.env.DB_SSL === 'true',
      poolMax: parseInt(process.env.GHOST_DB_POOL_MAX || process.env.DB_POOL_MAX || '10', 10),
      poolMin: parseInt(process.env.GHOST_DB_POOL_MIN || process.env.DB_POOL_MIN || '0', 10),
    };
  }

  getAIConfig() {
    return {
      provider: process.env.GHOST_AI_PROVIDER || process.env.AI_PROVIDER,
      apiKey: process.env.GHOST_AI_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
      model: process.env.GHOST_AI_MODEL,
      enabled: process.env.GHOST_AI_ENABLED !== 'false',
    };
  }

  validate() {
    const errors = [];
    
    // Admin credentials are optional - setup page will handle first-time setup
    // But if provided, they must be valid
    if (this.adminEmail && !this.adminEmail.includes('@')) {
      errors.push('Admin email must be a valid email address');
    }
    
    if (this.adminPassword && this.adminPassword.length < 8) {
      errors.push('Admin password must be at least 8 characters');
    }
    
    if (errors.length > 0) {
      throw new Error(
        `\n❌ GhostTrace configuration error:\n\n  ${errors.map(e => `• ${e}`).join('\n  ')}\n`
      );
    }
    
    return true;
  }
}

module.exports = GhostTraceConfig;
