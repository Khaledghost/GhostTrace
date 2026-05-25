/**
 * Parse and build database connection URIs for multiple engines.
 */

const DEFAULT_PORTS = {
  postgres: 5432,
  mysql: 3306,
  mariadb: 3306,
  mongodb: 27017,
  redis: 6379,
};

function defaultPort(type) {
  return DEFAULT_PORTS[type] || 5432;
}

function parseUri(uri, fallbackType) {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();

  try {
    if (trimmed.startsWith('redis://') || trimmed.startsWith('rediss://')) {
      const u = new URL(trimmed);
      return {
        type: 'redis',
        host: u.hostname,
        port: parseInt(u.port, 10) || 6379,
        database: u.pathname?.replace(/^\//, '') || '0',
        username: u.username || undefined,
        password: decodeURIComponent(u.password || ''),
        ssl: u.protocol === 'rediss:',
        connectionString: trimmed,
      };
    }

    if (trimmed.startsWith('mongodb://') || trimmed.startsWith('mongodb+srv://')) {
      return {
        type: 'mongodb',
        connectionString: trimmed,
        ssl: trimmed.includes('mongodb+srv'),
      };
    }

    const u = new URL(trimmed.replace(/^postgres:/, 'postgresql:'));
    const proto = u.protocol.replace(':', '');
    let type = fallbackType;
    if (proto === 'postgresql' || proto === 'postgres') type = 'postgres';
    else if (proto === 'mysql' || proto === 'mariadb') type = proto === 'mariadb' ? 'mariadb' : 'mysql';
    else if (!type) type = 'postgres';

    const database = u.pathname?.replace(/^\//, '').split('?')[0] || undefined;
    return {
      type,
      host: u.hostname,
      port: parseInt(u.port, 10) || defaultPort(type),
      database,
      username: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      ssl: u.searchParams.get('sslmode') === 'require' || u.protocol.endsWith('s'),
      schema: u.searchParams.get('schema') || u.searchParams.get('currentSchema') || undefined,
      connectionString: trimmed,
    };
  } catch (_) {
    return null;
  }
}

function mergeConfig(body) {
  const mode = body.connectionMode === 'uri' ? 'uri' : 'fields';
  let base = {
    id: String(body.id || '').trim(),
    label: body.label,
    type: (body.type || 'postgres').toLowerCase(),
    connectionMode: mode,
    host: body.host,
    port: body.port,
    database: body.database,
    username: body.username,
    password: body.password,
    ssl: !!body.ssl,
    schema: body.schema,
    connectionString: body.connectionString || body.uri,
    poolMax: parseInt(body.poolMax, 10) || 5,
    connectTimeoutMs: parseInt(body.connectTimeoutMs, 10) || 5000,
    rejectUnauthorized: body.rejectUnauthorized !== false,
  };

  if (base.type === 'mariadb') base.type = 'mysql';

  if (mode === 'uri' && base.connectionString) {
    const parsed = parseUri(base.connectionString, base.type);
    if (parsed) base = { ...base, ...parsed, connectionMode: 'uri' };
  }

  if (!base.port) base.port = defaultPort(base.type);
  if (!base.host && base.type !== 'mongodb') base.host = 'localhost';

  return base;
}

function buildPostgresUri(cfg) {
  const auth = cfg.username
    ? `${encodeURIComponent(cfg.username)}:${encodeURIComponent(cfg.password || '')}@`
    : '';
  const ssl = cfg.ssl ? '?sslmode=require' : '';
  return `postgresql://${auth}${cfg.host}:${cfg.port}/${cfg.database || ''}${ssl}`;
}

function buildMysqlUri(cfg) {
  const auth = cfg.username
    ? `${encodeURIComponent(cfg.username)}:${encodeURIComponent(cfg.password || '')}@`
    : '';
  return `mysql://${auth}${cfg.host}:${cfg.port}/${cfg.database || ''}`;
}

function buildMongoUri(cfg) {
  if (cfg.connectionString) return cfg.connectionString;
  const auth = cfg.username
    ? `${encodeURIComponent(cfg.username)}:${encodeURIComponent(cfg.password || '')}@`
    : '';
  return `mongodb://${auth}${cfg.host}:${cfg.port}/${cfg.database || ''}`;
}

function buildRedisUri(cfg) {
  const proto = cfg.ssl ? 'rediss' : 'redis';
  const auth = cfg.password ? `:${encodeURIComponent(cfg.password)}@` : '';
  return `${proto}://${auth}${cfg.host}:${cfg.port}/${cfg.database ?? 0}`;
}

function toDisplayUri(cfg) {
  if (cfg.connectionString) return cfg.connectionString;
  switch (cfg.type) {
    case 'postgres': return buildPostgresUri(cfg);
    case 'mysql': return buildMysqlUri(cfg);
    case 'mongodb': return buildMongoUri(cfg);
    case 'redis': return buildRedisUri(cfg);
    default: return '';
  }
}

module.exports = {
  DEFAULT_PORTS,
  defaultPort,
  parseUri,
  mergeConfig,
  toDisplayUri,
  buildPostgresUri,
  buildMysqlUri,
  buildMongoUri,
  buildRedisUri,
};
