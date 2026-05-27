const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { jsonType, enumType } = require('./dbTypes');

const AccountActivity = sequelize.define('AccountActivity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  accountId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  activityType: {
    type: enumType([
      'login',
      'logout',
      'resource_access',
      'api_call',
      'data_access',
      'configuration_change',
    ]),
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    index: true
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deviceInfo: {
    type: jsonType(),
    allowNull: true
  },
  location: {
    type: jsonType(),
    allowNull: true
  },
  endpoint: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: enumType(['success', 'failed', 'blocked']),
    defaultValue: 'success'
  },
  responseTime: {
    type: DataTypes.INTEGER,
    comment: 'Response time in milliseconds',
    allowNull: true
  },
  resourceUsage: {
    type: jsonType(),
    allowNull: true
  },
  metadata: {
    type: jsonType(),
    allowNull: true
  }
}, {
  tableName: 'account_activities',
  timestamps: false, // Using timestamp field instead
  createdAt: false,
  updatedAt: false,
  indexes: [
    { fields: ['accountId', 'timestamp'] },
    { fields: ['userId', 'timestamp'] }
  ]
});

module.exports = AccountActivity;
