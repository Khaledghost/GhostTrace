const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const dialect = sequelize?.getDialect?.() || 'postgres';

function jsonType() {
  return dialect === 'sqlite' ? DataTypes.JSON : DataTypes.JSONB;
}

function enumType(values) {
  if (dialect === 'sqlite') {
    return DataTypes.STRING;
  }
  return DataTypes.ENUM(...values);
}

module.exports = { jsonType, enumType, dialect };
