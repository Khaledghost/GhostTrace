const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Incident = sequelize.define('Incident', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: { type: DataTypes.STRING(512), allowNull: false },
  summary: { type: DataTypes.TEXT, allowNull: true },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
  },
  status: {
    type: DataTypes.ENUM('open', 'investigating', 'contained', 'resolved', 'closed'),
    defaultValue: 'open',
    index: true,
  },
  priority: { type: DataTypes.INTEGER, defaultValue: 3 },
  assignedTo: { type: DataTypes.STRING(128), allowNull: true },
  mitreTactics: { type: DataTypes.JSONB, defaultValue: [] },
  tags: { type: DataTypes.JSONB, defaultValue: [] },
  timeline: { type: DataTypes.JSONB, defaultValue: [] },
  alertCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  closedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'incidents',
});

module.exports = Incident;
