const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { jsonType } = require('./dbTypes');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  action: { type: DataTypes.STRING(128), allowNull: false, index: true },
  actor: { type: DataTypes.STRING(128), allowNull: false },
  resourceType: { type: DataTypes.STRING(64), allowNull: true },
  resourceId: { type: DataTypes.STRING(128), allowNull: true },
  metadata: { type: jsonType(), defaultValue: {} },
  ipAddress: { type: DataTypes.STRING(64), allowNull: true },
}, {
  tableName: 'audit_logs',
  updatedAt: false,
  indexes: [{ fields: ['createdAt'] }],
});

module.exports = AuditLog;
