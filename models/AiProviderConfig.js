const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AiProviderConfig = sequelize.define('AiProviderConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING(128), allowNull: false },
  provider: {
    type: DataTypes.ENUM('openai', 'anthropic', 'gemini', 'grok', 'ollama', 'custom'),
    allowNull: false,
  },
  apiKey: { type: DataTypes.TEXT, allowNull: true },
  baseUrl: { type: DataTypes.STRING(512), allowNull: true },
  model: { type: DataTypes.STRING(128), allowNull: true },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  priority: { type: DataTypes.INTEGER, defaultValue: 0 },
  options: {
    type: DataTypes.JSONB,
    defaultValue: {
      temperature: 0.3,
      maxTokens: 2048,
      liveLogAnalysis: true,
      analyzeSlowMs: 2000,
      analyzeStatusCodes: [400, 401, 403, 404, 429, 500, 502, 503],
    },
  },
}, {
  tableName: 'ai_provider_configs',
});

module.exports = AiProviderConfig;
