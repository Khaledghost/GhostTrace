const Alert = require('./Alert');
const Incident = require('./Incident');
const ThreatEvent = require('./ThreatEvent');
const BehavioralProfile = require('./BehavioralProfile');
const AccountActivity = require('./AccountActivity');
const SecurityPolicy = require('./SecurityPolicy');
const AuditLog = require('./AuditLog');
const AiProviderConfig = require('./AiProviderConfig');
const User = require('./User');

Incident.hasMany(Alert, { foreignKey: 'incidentId', as: 'alerts' });
Alert.belongsTo(Incident, { foreignKey: 'incidentId', as: 'incident' });

module.exports = {
  Alert,
  Incident,
  ThreatEvent,
  BehavioralProfile,
  AccountActivity,
  SecurityPolicy,
  AuditLog,
  AiProviderConfig,
  User,
};
