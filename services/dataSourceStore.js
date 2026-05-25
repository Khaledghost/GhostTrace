const fs = require('fs');
const path = require('path');
const { encryptSecret, decryptSecret } = require('../utils/secretStore');

const STORE_PATH = process.env.DATASOURCES_FILE
  || path.join(__dirname, '..', 'data', 'datasources.json');

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAll() {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sources)) return [];
    return data.sources.map((source) => ({
      ...source,
      password: decryptSecret(source.password),
      connectionString: decryptSecret(source.connectionString),
    }));
  } catch (_) {
    return [];
  }
}

function saveAll(sources) {
  ensureDir();
  const payload = {
    updatedAt: new Date().toISOString(),
    sources: sources.map((source) => ({
      ...source,
      password: encryptSecret(source.password),
      connectionString: encryptSecret(source.connectionString),
    })),
  };
  fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

function upsert(config) {
  const sources = loadAll();
  const idx = sources.findIndex((s) => s.id === config.id);
  const entry = {
    id: config.id,
    label: config.label,
    type: config.type,
    connectionMode: config.connectionMode || 'fields',
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: encryptSecret(config.password),
    ssl: config.ssl,
    schema: config.schema,
    connectionString: encryptSecret(config.connectionString),
    poolMax: config.poolMax,
    connectTimeoutMs: config.connectTimeoutMs,
    rejectUnauthorized: config.rejectUnauthorized,
  };
  if (idx >= 0) sources[idx] = entry;
  else sources.push(entry);
  saveAll(sources);
  return entry;
}

function remove(id) {
  const sources = loadAll().filter((s) => s.id !== id);
  saveAll(sources);
}

module.exports = { loadAll, saveAll, upsert, remove, STORE_PATH };
