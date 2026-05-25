/**
 * Pluggable AI provider registry — OpenAI, Claude, Gemini, Grok, Ollama, custom.
 */

const openaiAdapter = require('./providers/openaiCompatible');
const anthropicAdapter = require('./providers/anthropic');
const geminiAdapter = require('./providers/gemini');
const ollamaAdapter = require('./providers/ollama');

const PROVIDER_META = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4, GPT-3.5',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    adapter: 'openai_compatible',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet, Haiku, Opus',
    defaultModel: 'claude-3-5-sonnet-20241022',
    adapter: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 1.5 Flash / Pro',
    defaultModel: 'gemini-1.5-flash',
    adapter: 'gemini',
    envKey: 'GEMINI_API_KEY',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  },
  grok: {
    id: 'grok',
    name: 'xAI Grok',
    description: 'Grok via OpenAI-compatible API',
    defaultModel: 'grok-2-latest',
    defaultBaseUrl: 'https://api.x.ai/v1',
    adapter: 'openai_compatible',
    envKey: 'GROK_API_KEY',
    models: ['grok-2-latest', 'grok-beta'],
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run Llama, Mistral, etc. locally',
    defaultModel: 'llama3',
    defaultBaseUrl: 'http://localhost:11434',
    adapter: 'ollama',
    envKey: null,
    models: ['llama3', 'mistral', 'codellama', 'phi3'],
  },
  custom: {
    id: 'custom',
    name: 'Custom Endpoint',
    description: 'Any OpenAI-compatible API (LM Studio, vLLM, etc.)',
    defaultModel: '',
    defaultBaseUrl: 'http://localhost:8080/v1',
    adapter: 'openai_compatible',
    envKey: 'CUSTOM_AI_API_KEY',
    models: [],
  },
};

function getAdapter(type) {
  switch (type) {
    case 'anthropic': return anthropicAdapter;
    case 'gemini': return geminiAdapter;
    case 'ollama': return ollamaAdapter;
    case 'openai_compatible':
    default: return openaiAdapter;
  }
}

function listProviders() {
  return Object.values(PROVIDER_META).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    defaultModel: p.defaultModel,
    defaultBaseUrl: p.defaultBaseUrl,
    models: p.models,
  }));
}

function resolveConfig(config) {
  const meta = PROVIDER_META[config.provider] || PROVIDER_META.custom;
  const adapterType = meta.adapter;
  return {
    ...config,
    provider: config.provider || meta.id,
    model: config.model || meta.defaultModel,
    baseUrl: config.baseUrl || meta.defaultBaseUrl,
    apiKey: config.apiKey || (meta.envKey ? process.env[meta.envKey] : '') || '',
    adapterType,
    adapter: getAdapter(adapterType),
  };
}

async function complete(config, { system, user, jsonMode = false, maxTokens = 2048, temperature = 0.3 }) {
  const resolved = resolveConfig(config);
  if (!resolved.apiKey && resolved.provider !== 'ollama') {
    throw new Error(`API key required for provider "${resolved.provider}"`);
  }
  const text = await resolved.adapter.complete({
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    system,
    user,
    jsonMode,
    maxTokens,
    temperature,
  });
  return {
    text,
    provider: resolved.provider,
    model: resolved.model,
  };
}

async function* stream(config, { system, user, maxTokens = 2048, temperature = 0.3 }) {
  const resolved = resolveConfig(config);
  if (!resolved.adapter.stream) {
    const result = await complete(config, { system, user, maxTokens, temperature });
    yield result.text;
    return;
  }
  yield* resolved.adapter.stream({
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    system,
    user,
    maxTokens,
    temperature,
  });
}

async function testConnection(config) {
  const resolved = resolveConfig(config);
  const start = Date.now();
  try {
    const { text } = await complete(config, {
      system: 'You are a test assistant.',
      user: 'Reply with exactly: OK',
      maxTokens: 16,
      temperature: 0,
    });
    return {
      ok: true,
      latencyMs: Date.now() - start,
      sample: (text || '').slice(0, 80),
      provider: resolved.provider,
      model: resolved.model,
    };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message, provider: resolved.provider };
  }
}

module.exports = {
  PROVIDER_META,
  listProviders,
  resolveConfig,
  complete,
  stream,
  testConnection,
};
