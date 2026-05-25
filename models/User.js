const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false,
    defaultValue: '',
  },
  role: {
    type: DataTypes.ENUM('admin', 'analyst', 'viewer'),
    allowNull: false,
    defaultValue: 'analyst',
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  indexes: [{ unique: true, fields: ['email'] }],
  defaultScope: {
    attributes: { exclude: ['passwordHash'] },
  },
  scopes: {
    withSecret: { attributes: { include: ['passwordHash'] } },
  },
});

module.exports = User;
