const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: { type: DataTypes.STRING(512), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  severity: {
    type: DataTypes.ENUM('info', 'low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'medium',
  },
  status: {
    type: DataTypes.ENUM('new', 'acknowledged', 'investigating', 'escalated', 'resolved', 'false_positive'),
    defaultValue: 'new',
    index: true,
  },
  source: {
    type: DataTypes.ENUM('behavioral_dna', 'external_monitor', 'manual', 'api', 'webhook'),
    defaultValue: 'behavioral_dna',
  },
  profileKey: { type: DataTypes.STRING(256), allowNull: true, index: true },
  ipAddress: { type: DataTypes.STRING(64), allowNull: true, index: true },
  userId: { type: DataTypes.STRING(128), allowNull: true },
  accountId: { type: DataTypes.STRING(128), allowNull: true },
  anomalyTypes: { type: DataTypes.JSONB, defaultValue: [] },
  mitreTactics: { type: DataTypes.JSONB, defaultValue: [] },
  mitreTechniques: { type: DataTypes.JSONB, defaultValue: [] },
  riskScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  rawActivity: { type: DataTypes.JSONB, defaultValue: {} },
  aiExplanation: { type: DataTypes.TEXT, allowNull: true },
  tags: { type: DataTypes.JSONB, defaultValue: [] },
  assignedTo: { type: DataTypes.STRING(128), allowNull: true },
  incidentId: { type: DataTypes.UUID, allowNull: true, index: true },
  detectedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, index: true },
  acknowledgedAt: { type: DataTypes.DATE, allowNull: true },
  resolvedAt: { type: DataTypes.DATE, allowNull: true },
  resolutionNotes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'alerts',
  indexes: [
    { fields: ['status', 'severity'] },
    { fields: ['detectedAt'] },
    { fields: ['incidentId'] },
  ],
});

module.exports = Alert;
