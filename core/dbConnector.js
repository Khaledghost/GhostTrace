/**
 * DbConnector — Manages live connections to PostgreSQL, MySQL, MongoDB, Redis.
 *
 * Each data source is identified by a unique `id` and holds its own connection pool.
 * Connections are tested before being stored.
 */

const EventEmitter = require('events');

// ── Drivers (loaded lazily so missing drivers don't crash startup) ──────────

function getPg()      { try { return require('pg'); } catch { return null; } }
function getMysql()   { try { return require('mysql2/promise'); } catch { return null; } }
function getMongo()   { try { return require('mongoose'); } catch { return null; } }
function getRedis()   { try { return require('ioredis'); } catch { return null; } }

// ── Connection Store ──────────────────────────────────────────────────────────

class DbConnector extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, DataSource>} */
    this._sources = new Map();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Add and connect a data source.
   * @param {DataSourceConfig} config
   * @returns {Promise<DataSource>}
   */
  async addSource(config) {
    this._validateConfig(config);
    const existing = this._sources.get(config.id);
    if (existing) await this.removeSource(config.id);

    const source = {
      id:       config.id,
      label:    config.label || config.id,
      type:     config.type,      // 'postgres'|'mysql'|'mongodb'|'redis'
      config:   this._sanitize(config),
      status:   'connecting',
      error:    null,
      conn:     null,
      connectedAt: null,
      scanResult: null,
    };

    this._sources.set(config.id, source);

    try {
      source.conn = await this._connect(config);
      source.status = 'connected';
      source.connectedAt = new Date().toISOString();
      this.emit('connected', source);
    } catch (err) {
      source.status = 'error';
      source.error = err.message;
      this.emit('error', { id: config.id, error: err.message });
      throw err;
    }

    return this._publicView(source);
  }

  async removeSource(id) {
    const source = this._sources.get(id);
    if (!source) return;
    await this._disconnect(source);
    this._sources.delete(id);
    this.emit('removed', { id });
  }

  getSource(id) {
    const s = this._sources.get(id);
    return s ? this._publicView(s) : null;
  }

  getAll() {
    return [...this._sources.values()].map(s => this._publicView(s));
  }

  getRawConn(id) {
    return this._sources.get(id)?.conn || null;
  }

  getSourceObj(id) {
    return this._sources.get(id) || null;
  }

  // ── Connection helpers ─────────────────────────────────────────────────────

  async _connect(cfg) {
    switch (cfg.type) {
      case 'postgres': return this._connectPg(cfg);
      case 'mysql':    return this._connectMysql(cfg);
      case 'mongodb':  return this._connectMongo(cfg);
      case 'redis':    return this._connectRedis(cfg);
      default: throw new Error(`Unsupported type: ${cfg.type}`);
    }
  }

  async _connectPg(cfg) {
    const { Pool } = getPg();
    const pool = new Pool({
      host:     cfg.host || 'localhost',
      port:     parseInt(cfg.port || 5432, 10),
      database: cfg.database,
      user:     cfg.username,
      password: cfg.password,
      ssl:      cfg.ssl ? { rejectUnauthorized: false } : false,
      max:      5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return pool;
  }

  async _connectMysql(cfg) {
    const mysql = getMysql();
    const pool = mysql.createPool({
      host:     cfg.host || 'localhost',
      port:     parseInt(cfg.port || 3306, 10),
      database: cfg.database,
      user:     cfg.username,
      password: cfg.password,
      ssl:      cfg.ssl ? {} : undefined,
      connectionLimit: 5,
      connectTimeout: 5000,
    });
    await pool.query('SELECT 1');
    return pool;
  }

  async _connectMongo(cfg) {
    const mongoose = getMongo();
    const uri = cfg.connectionString || this._buildMongoUri(cfg);
    // Each source gets its own mongoose Connection instance
    const conn = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    });
    await conn.asPromise();
    return conn;
  }

  async _connectRedis(cfg) {
    const Redis = getRedis();
    const client = new Redis({
      host:     cfg.host || 'localhost',
      port:     parseInt(cfg.port || 6379, 10),
      password: cfg.password || undefined,
      db:       parseInt(cfg.database || 0, 10),
      tls:      cfg.ssl ? {} : undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    return client;
  }

  async _disconnect(source) {
    try {
      if (!source.conn) return;
      if (source.type === 'postgres') await source.conn.end();
      else if (source.type === 'mysql') await source.conn.end();
      else if (source.type === 'mongodb') await source.conn.close();
      else if (source.type === 'redis') source.conn.disconnect();
    } catch (_) {}
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _buildMongoUri(cfg) {
    const auth = cfg.username ? `${encodeURIComponent(cfg.username)}:${encodeURIComponent(cfg.password||'')}@` : '';
    return `mongodb://${auth}${cfg.host||'localhost'}:${cfg.port||27017}/${cfg.database||''}`;
  }

  _validateConfig(cfg) {
    if (!cfg.id)   throw new Error('Data source must have an id');
    if (!cfg.type) throw new Error('Data source must have a type');
    const TYPES = ['postgres','mysql','mongodb','redis'];
    if (!TYPES.includes(cfg.type)) throw new Error(`type must be one of: ${TYPES.join(', ')}`);
  }

  _sanitize(cfg) {
    const ports = { postgres: 5432, mysql: 3306, mongodb: 27017, redis: 6379 };
    return {
      host:             cfg.host || 'localhost',
      port:             parseInt(cfg.port, 10) || ports[cfg.type] || 5432,
      database:         cfg.database,
      username:         cfg.username,
      ssl:              cfg.ssl,
      connectionString: cfg.connectionString,
      // password stored but marked
      _hasPassword: !!(cfg.password),
    };
  }

  _publicView(source) {
    return {
      id:          source.id,
      label:       source.label,
      type:        source.type,
      status:      source.status,
      error:       source.error,
      connectedAt: source.connectedAt,
      scanResult:  source.scanResult,
      config: {
        host:     source.config.host,
        port:     source.config.port,
        database: source.config.database,
        username: source.config.username,
        ssl:      source.config.ssl,
        hasPassword: source.config._hasPassword,
      },
    };
  }
}

module.exports = new DbConnector();
