const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityPolicy = sequelize.define('SecurityPolicy', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING(256), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  blockOnThreat: { type: DataTypes.BOOLEAN, defaultValue: true },
  riskBlockThreshold: { type: DataTypes.INTEGER, defaultValue: 70 },
  rateLimitPerWindow: { type: DataTypes.INTEGER, defaultValue: 120 },
  autoEscalateCritical: { type: DataTypes.BOOLEAN, defaultValue: true },
  rules: { type: DataTypes.JSONB, defaultValue: [] },
}, {
  tableName: 'security_policies',
});

module.exports = SecurityPolicy;
