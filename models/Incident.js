const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { jsonType, enumType } = require('./dbTypes');

const Incident = sequelize.define('Incident', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: { type: DataTypes.STRING(512), allowNull: false },
  summary: { type: DataTypes.TEXT, allowNull: true },
  severity: {
    type: enumType(['low', 'medium', 'high', 'critical']),
    defaultValue: 'medium',
  },
  status: {
    type: enumType(['open', 'investigating', 'contained', 'resolved', 'closed']),
    defaultValue: 'open',
    index: true,
  },
  priority: { type: DataTypes.INTEGER, defaultValue: 3 },
  assignedTo: { type: DataTypes.STRING(128), allowNull: true },
  mitreTactics: { type: jsonType(), defaultValue: [] },
  tags: { type: jsonType(), defaultValue: [] },
  timeline: { type: jsonType(), defaultValue: [] },
  alertCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  closedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'incidents',
});

module.exports = Incident;
