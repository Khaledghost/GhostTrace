const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { jsonType, enumType } = require('./dbTypes');

const ThreatEvent = sequelize.define('ThreatEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  accountId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  eventType: {
    type: enumType([
      'suspicious_login',
      'unusual_location',
      'device_mismatch',
      'behavior_anomaly',
      'resource_abuse',
      'access_anomaly',
    ]),
    allowNull: false
  },
  severity: {
    type: enumType(['low', 'medium', 'high', 'critical']),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  detectedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    index: true
  },
  metadata: {
    type: jsonType(),
    defaultValue: {}
  },
  status: {
    type: enumType(['pending', 'investigating', 'resolved', 'false_positive']),
    defaultValue: 'pending',
    index: true
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolutionNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'threat_events',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    { fields: ['userId', 'detectedAt'] },
    { fields: ['status', 'severity'] }
  ]
});

module.exports = ThreatEvent;
