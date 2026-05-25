const providerRegistry = require('../core/ai/providerRegistry');
const aiConfigService = require('./aiConfigService');

const SOC_SYSTEM = `You are an expert SOC analyst AI embedded in BehavioralDNA, an open-source MDR platform.
Be concise, actionable, and security-focused. Use MITRE ATT&CK references when relevant.`;

async function completeWithFallback({ system, user, jsonMode, maxTokens, temperature, providerId }) {
  let chain = [];
  if (providerId) {
    if (require('../config/database').isDbReady?.()) {
      const { AiProviderConfig } = require('../models');
      const row = await AiProviderConfig.findByPk(providerId);
      if (row) chain = [row.toJSON()];
    } else {
      const all = await aiConfigService.list({ includeSecrets: true });
      const one = all.find((c) => c.id === providerId);
      if (one) chain = [one];
    }
  }
  if (!chain.length) {
    chain = await aiConfigService.getFallbackChain();
  }
  if (!chain.length) {
    const env = (await aiConfigService.list({ includeSecrets: true })).filter((c) => c.enabled);
    chain = env;
  }

  const errors = [];
  for (const config of chain) {
    try {
      const result = await providerRegistry.complete(config, {
        system: system || SOC_SYSTEM,
        user,
        jsonMode,
        maxTokens: maxTokens || config.options?.maxTokens || 2048,
        temperature: temperature ?? config.options?.temperature ?? 0.3,
      });
      return { ...result, configId: config.id, configName: config.name };
    } catch (err) {
      errors.push(`${config.provider}: ${err.message}`);
    }
  }

  throw new Error(errors.length ? errors.join('; ') : 'No AI provider configured');
}

async function* streamWithFallback(opts) {
  const config = opts.providerId
    ? (await aiConfigService.list({ includeSecrets: true })).find((c) => c.id === opts.providerId)
    : await aiConfigService.getDefault();

  if (!config) throw new Error('No AI provider configured');

  const fullConfig = config.toJSON ? config.toJSON() : config;
  for await (const chunk of providerRegistry.stream(fullConfig, {
    system: opts.system || SOC_SYSTEM,
    user: opts.user,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  })) {
    yield { chunk, provider: fullConfig.provider, model: fullConfig.model };
  }
}

async function testProvider(config) {
  return providerRegistry.testConnection(config);
}

async function getStatus() {
  const configs = await aiConfigService.list();
  const settings = aiConfigService.getGlobalSettings();
  const defaultProvider = await aiConfigService.getDefault();
  return {
    configured: configs.some((c) => c.hasApiKey || c.provider === 'ollama'),
    defaultProvider: defaultProvider ? {
      id: defaultProvider.id,
      name: defaultProvider.name,
      provider: defaultProvider.provider,
      model: defaultProvider.model,
    } : null,
    providers: configs,
    settings,
    available: providerRegistry.listProviders(),
  };
}

module.exports = {
  completeWithFallback,
  streamWithFallback,
  testProvider,
  getStatus,
  SOC_SYSTEM,
};
