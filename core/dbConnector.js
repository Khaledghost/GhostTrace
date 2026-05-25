/**
 * DbConnector — Manages live connections to PostgreSQL, MySQL, MongoDB, Redis.
 */

const EventEmitter = require('events');
const { mergeConfig, toDisplayUri } = require('../utils/connectionParser');
const dataSourceStore = require('../services/dataSourceStore');

function getPg()      { try { return require('pg'); } catch { return null; } }
function getMysql()   { try { return require('mysql2/promise'); } catch { return null; } }
function getMongo()   { try { return require('mongoose'); } catch { return null; } }
function getRedis()   { try { return require('ioredis'); } catch { return null; } }

class DbConnector extends EventEmitter {
  constructor() {
    super();
    this._sources = new Map();
    this._passwords = new Map();
  }

  async addSource(rawConfig) {
    const config = mergeConfig(rawConfig);
    this._validateConfig(config);

    const existing = this._sources.get(config.id);
    if (existing) await this.removeSource(config.id);

    if (config.password) this._passwords.set(config.id, config.password);

    const source = {
      id: config.id,
      label: config.label || config.id,
      type: config.type,
      config: this._sanitize(config),
      status: 'connecting',
      error: null,
      conn: null,
      connectedAt: null,
      scanResult: null,
    };

    this._sources.set(config.id, source);

    try {
      source.conn = await this._connect(config);
      source.status = 'connected';
      source.connectedAt = new Date().toISOString();
      dataSourceStore.upsert({ ...config, password: config.password });
      this.emit('connected', source);
    } catch (err) {
      source.status = 'error';
      source.error = err.message;
      this.emit('error', { id: config.id, error: err.message });
      throw err;
    }

    return this._publicView(source);
  }

  async updateSource(id, rawPatch) {
    const existing = dataSourceStore.loadAll().find((s) => s.id === id)
      || this._sources.get(id);
    if (!existing) throw new Error('Source not found');

    const merged = mergeConfig({
      ...existing,
      ...rawPatch,
      id,
      password: rawPatch.password || this._passwords.get(id) || existing.password,
    });

    await this.removeSource(id);
    return this.addSource(merged);
  }

  async removeSource(id) {
    const source = this._sources.get(id);
    if (source) {
      await this._disconnect(source);
      this._sources.delete(id);
    }
    dataSourceStore.remove(id);
    this._passwords.delete(id);
    this.emit('removed', { id });
  }

  async restorePersisted() {
    const saved = dataSourceStore.loadAll();
    const results = [];
    for (const cfg of saved) {
      try {
        await this.addSource(cfg);
        results.push({ id: cfg.id, ok: true });
      } catch (err) {
        results.push({ id: cfg.id, ok: false, error: err.message });
      }
    }
    return results;
  }

  getSource(id) {
    const s = this._sources.get(id);
    return s ? this._publicView(s) : null;
  }

  getAll() {
    return [...this._sources.values()].map((s) => this._publicView(s));
  }

  getRawConn(id) {
    return this._sources.get(id)?.conn || null;
  }

  getSourceObj(id) {
    return this._sources.get(id) || null;
  }

  async testConnection(rawConfig) {
    const config = mergeConfig(rawConfig);
    this._validateConfig(config);
    const conn = await this._connect(config);
    await this._disconnect({ type: config.type, conn });
    return { ok: true, uri: toDisplayUri(config) };
  }

  async _connect(cfg) {
    switch (cfg.type) {
      case 'postgres': return this._connectPg(cfg);
      case 'mysql': return this._connectMysql(cfg);
      case 'mongodb': return this._connectMongo(cfg);
      case 'redis': return this._connectRedis(cfg);
      default: throw new Error(`Unsupported type: ${cfg.type}`);
    }
  }

  async _connectPg(cfg) {
    const { Pool } = getPg();
    if (!Pool) throw new Error('pg driver not installed');

    const poolOpts = {
      max: cfg.poolMax || 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: cfg.connectTimeoutMs || 5000,
      ssl: cfg.ssl ? { rejectUnauthorized: cfg.rejectUnauthorized !== false } : false,
    };

    if (cfg.connectionMode === 'uri' && cfg.connectionString) {
      Object.assign(poolOpts, { connectionString: cfg.connectionString });
    } else {
      Object.assign(poolOpts, {
        host: cfg.host || 'localhost',
        port: parseInt(cfg.port || 5432, 10),
        database: cfg.database,
        user: cfg.username,
        password: cfg.password,
      });
    }

    const pool = new Pool(poolOpts);
    const client = await pool.connect();
    if (cfg.schema) await client.query(`SET search_path TO ${cfg.schema}`);
    await client.query('SELECT 1');
    client.release();
    return pool;
  }

  async _connectMysql(cfg) {
    const mysql = getMysql();
    if (!mysql) throw new Error('mysql2 driver not installed');

    const base = {
      connectionLimit: cfg.poolMax || 5,
      connectTimeout: cfg.connectTimeoutMs || 5000,
      ssl: cfg.ssl ? { rejectUnauthorized: cfg.rejectUnauthorized !== false } : undefined,
    };

    const pool = cfg.connectionMode === 'uri' && cfg.connectionString
      ? mysql.createPool({ ...base, uri: cfg.connectionString })
      : mysql.createPool({
        ...base,
        host: cfg.host || 'localhost',
        port: parseInt(cfg.port || 3306, 10),
        database: cfg.database,
        user: cfg.username,
        password: cfg.password,
      });

    await pool.query('SELECT 1');
    return pool;
  }

  async _connectMongo(cfg) {
    const mongoose = getMongo();
    if (!mongoose) throw new Error('mongoose driver not installed');

    const uri = cfg.connectionString || this._buildMongoUri(cfg);
    const conn = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: cfg.connectTimeoutMs || 5000,
      maxPoolSize: cfg.poolMax || 5,
    });
    await conn.asPromise();
    return conn;
  }

  async _connectRedis(cfg) {
    const Redis = getRedis();
    if (!Redis) throw new Error('ioredis driver not installed');

    const opts = {
      connectTimeout: cfg.connectTimeoutMs || 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      tls: cfg.ssl ? { rejectUnauthorized: cfg.rejectUnauthorized !== false } : undefined,
    };

    let client;
    if (cfg.connectionMode === 'uri' && cfg.connectionString) {
      client = new Redis(cfg.connectionString, opts);
    } else {
      client = new Redis({
        ...opts,
        host: cfg.host || 'localhost',
        port: parseInt(cfg.port || 6379, 10),
        password: cfg.password || undefined,
        db: parseInt(cfg.database || 0, 10),
      });
    }

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
    } catch (_) { /* ignore */ }
  }

  _buildMongoUri(cfg) {
    const auth = cfg.username
      ? `${encodeURIComponent(cfg.username)}:${encodeURIComponent(cfg.password || '')}@`
      : '';
    return `mongodb://${auth}${cfg.host || 'localhost'}:${cfg.port || 27017}/${cfg.database || ''}`;
  }

  _validateConfig(cfg) {
    if (!cfg.id) throw new Error('Data source must have an id');
    if (!cfg.type) throw new Error('Data source must have a type');
    const TYPES = ['postgres', 'mysql', 'mongodb', 'redis', 'mariadb'];
    if (!TYPES.includes(cfg.type)) {
      throw new Error(`type must be one of: ${TYPES.join(', ')}`);
    }
    if (cfg.connectionMode === 'uri') {
      if (!cfg.connectionString) throw new Error('Connection URI is required in URI mode');
      return;
    }
    if (cfg.type !== 'mongodb' && !cfg.host) throw new Error('Host is required');
    if (cfg.type !== 'redis' && !cfg.database && cfg.type !== 'mongodb') {
      throw new Error('Database name is required');
    }
  }

  _sanitize(cfg) {
    return {
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      username: cfg.username,
      ssl: cfg.ssl,
      schema: cfg.schema,
      connectionMode: cfg.connectionMode || 'fields',
      connectionString: cfg.connectionMode === 'uri' ? '***' : undefined,
      poolMax: cfg.poolMax,
      connectTimeoutMs: cfg.connectTimeoutMs,
      rejectUnauthorized: cfg.rejectUnauthorized,
      _hasPassword: !!(cfg.password || this._passwords.get(cfg.id)),
      displayUri: toDisplayUri(cfg).replace(/:([^:@/]+)@/, ':***@'),
    };
  }

  _publicView(source) {
    return {
      id: source.id,
      label: source.label,
      type: source.type,
      status: source.status,
      error: source.error,
      connectedAt: source.connectedAt,
      scanResult: source.scanResult,
      config: source.config,
    };
  }
}

module.exports = new DbConnector();
