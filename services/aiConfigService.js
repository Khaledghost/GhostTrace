const { AiProviderConfig } = require('../models');
const { isDbReady } = require('../config/database');
const { PROVIDER_META } = require('../core/ai/providerRegistry');

let memoryConfigs = [];
let memorySettings = {
  liveLogAnalysis: process.env.AI_LIVE_LOGS !== 'false',
  fallbackChain: true,
};

function maskKey(key) {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return `${'•'.repeat(12)}${key.slice(-4)}`;
}

function configFromEnv() {
  const configs = [];
  const mappings = [
    { provider: 'openai', env: 'OPENAI_API_KEY', model: process.env.OPENAI_MODEL },
    { provider: 'anthropic', env: 'ANTHROPIC_API_KEY', model: process.env.ANTHROPIC_MODEL },
    { provider: 'gemini', env: 'GEMINI_API_KEY', model: process.env.GEMINI_MODEL },
    { provider: 'grok', env: 'GROK_API_KEY', model: process.env.GROK_MODEL },
    { provider: 'ollama', env: null, model: process.env.OLLAMA_MODEL, enabled: process.env.OLLAMA_ENABLED === 'true' },
    { provider: 'custom', env: 'CUSTOM_AI_API_KEY', model: process.env.CUSTOM_AI_MODEL, baseUrl: process.env.CUSTOM_AI_BASE_URL },
  ];

  let priority = 0;
  for (const m of mappings) {
    const key = m.env ? process.env[m.env] : '';
    const enabled = m.provider === 'ollama' ? m.enabled : !!key;
    if (!enabled && m.provider !== 'ollama') continue;
    if (m.provider === 'ollama' && !m.enabled) continue;

    const meta = PROVIDER_META[m.provider];
    configs.push({
      id: `env-${m.provider}`,
      name: `${meta.name} (env)`,
      provider: m.provider,
      apiKey: key,
      baseUrl: m.baseUrl || meta.defaultBaseUrl,
      model: m.model || meta.defaultModel,
      enabled: true,
      isDefault: priority === 0,
      priority: priority++,
      options: memorySettings,
      _fromEnv: true,
    });
  }
  return configs;
}

async function seedFromEnv() {
  if (!isDbReady()) return;
  const count = await AiProviderConfig.count();
  if (count > 0) return;

  const envConfigs = configFromEnv();
  for (const c of envConfigs) {
    await AiProviderConfig.create({
      name: c.name,
      provider: c.provider,
      apiKey: c.apiKey,
      baseUrl: c.baseUrl,
      model: c.model,
      enabled: c.enabled,
      isDefault: c.isDefault,
      priority: c.priority,
      options: c.options,
    });
  }
}

async function list({ includeSecrets = false } = {}) {
  let rows = [];
  if (isDbReady()) {
    rows = await AiProviderConfig.findAll({ order: [['priority', 'ASC'], ['name', 'ASC']] });
  } else {
    rows = memoryConfigs.length ? memoryConfigs : configFromEnv();
  }

  return rows.map((r) => {
    const raw = r.toJSON ? r.toJSON() : { ...r };
    const j = { ...raw };
    j.hasApiKey = !!(raw.apiKey && raw.apiKey.length > 0) || j.provider === 'ollama';
    if (!includeSecrets) j.apiKey = maskKey(raw.apiKey);
    return j;
  });
}

async function getDefault() {
  if (isDbReady()) {
    let row = await AiProviderConfig.findOne({ where: { isDefault: true, enabled: true } });
    if (!row) {
      row = await AiProviderConfig.findOne({ where: { enabled: true }, order: [['priority', 'ASC']] });
    }
    if (row) return row.toJSON();
  }
  const env = configFromEnv();
  return env[0] || memoryConfigs.find((c) => c.enabled) || null;
}

async function getFallbackChain() {
  if (isDbReady()) {
    const rows = await AiProviderConfig.findAll({
      where: { enabled: true },
      order: [['priority', 'ASC']],
    });
    return rows.map((r) => r.toJSON()).filter((c) => c.apiKey || c.provider === 'ollama');
  }
  const env = configFromEnv();
  if (env.length) return env;
  return memoryConfigs.filter((c) => c.enabled !== false);
}

async function upsert(data) {
  const payload = {
    name: data.name,
    provider: data.provider,
    apiKey: data.apiKey,
    baseUrl: data.baseUrl,
    model: data.model,
    enabled: data.enabled !== false,
    isDefault: !!data.isDefault,
    priority: data.priority ?? 0,
    options: { ...memorySettings, ...(data.options || {}) },
  };

  if (isDbReady()) {
    if (data.isDefault) {
      await AiProviderConfig.update({ isDefault: false }, { where: {} });
    }
    let row;
    if (data.id && !String(data.id).startsWith('env-')) {
      row = await AiProviderConfig.findByPk(data.id);
      if (row) {
        if (!data.apiKey || data.apiKey.includes('•')) delete payload.apiKey;
        await row.update(payload);
      } else {
        row = await AiProviderConfig.create(payload);
      }
    } else {
      row = await AiProviderConfig.create(payload);
    }
    const j = row.toJSON();
    j.apiKey = maskKey(j.apiKey);
    return j;
  }

  if (data.id) {
    const idx = memoryConfigs.findIndex((c) => c.id === data.id);
    if (idx >= 0) {
      if (!data.apiKey || data.apiKey.includes('•')) delete payload.apiKey;
      memoryConfigs[idx] = { ...memoryConfigs[idx], ...payload };
      return memoryConfigs[idx];
    }
  }
  const mem = { id: `ai-${Date.now()}`, ...payload };
  memoryConfigs.push(mem);
  return mem;
}

async function remove(id) {
  if (String(id).startsWith('env-')) throw new Error('Cannot delete env-based config');
  if (isDbReady()) {
    await AiProviderConfig.destroy({ where: { id } });
    return true;
  }
  memoryConfigs = memoryConfigs.filter((c) => c.id !== id);
  return true;
}

function getGlobalSettings() {
  return { ...memorySettings };
}

function updateGlobalSettings(patch) {
  memorySettings = { ...memorySettings, ...patch };
  return memorySettings;
}

module.exports = {
  seedFromEnv,
  list,
  getDefault,
  getFallbackChain,
  upsert,
  remove,
  getGlobalSettings,
  updateGlobalSettings,
  maskKey,
};
