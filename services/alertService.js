const { Op } = require('sequelize');
const { Alert, Incident } = require('../models');
const { isDbReady, sequelize } = require('../config/database');
const { mapAnomalies } = require('../core/mitreMapper');
const auditService = require('./auditService');

const memoryAlerts = new Map();

function severityFromRisk(risk, anomalySeverity) {
  if (anomalySeverity === 'critical' || risk >= 85) return 'critical';
  if (anomalySeverity === 'high' || risk >= 70) return 'high';
  if (risk >= 45) return 'medium';
  if (risk >= 25) return 'low';
  return 'info';
}

function buildTitle(anomalies, activity) {
  const types = anomalies.map((a) => (a.type || a.label || 'anomaly').replace(/_/g, ' '));
  const primary = types[0] || 'behavioral anomaly';
  const ep = activity?.endpoint ? ` on ${activity.endpoint}` : '';
  return `${primary}${ep}`;
}

async function createFromDetection({ activity, anomalies, riskScore, profileKey, explanation }) {
  if (!anomalies?.length && riskScore < 30) return null;

  const mitre = mapAnomalies(anomalies);
  const topSeverity = anomalies.reduce((max, a) => {
    const ranks = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return ranks[a.severity] > ranks[max] ? a.severity : max;
  }, 'low');

  const payload = {
    title: buildTitle(anomalies, activity),
    description: `Detected ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'}: ${mitre.anomalyTypes.join(', ')}`,
    severity: severityFromRisk(riskScore, topSeverity),
    status: 'new',
    source: 'behavioral_dna',
    profileKey,
    ipAddress: activity?.ipAddress || null,
    userId: activity?.userId || null,
    accountId: activity?.accountId || null,
    anomalyTypes: mitre.anomalyTypes,
    mitreTactics: mitre.tactics,
    mitreTechniques: mitre.techniques,
    riskScore,
    rawActivity: activity || {},
    aiExplanation: explanation || null,
    tags: mitre.tacticLabels.slice(0, 3),
    detectedAt: new Date(),
  };

  if (isDbReady()) {
    const alert = await Alert.create(payload);
    await auditService.log({
      action: 'alert.created',
      actor: 'system',
      resourceType: 'alert',
      resourceId: alert.id,
      metadata: { severity: alert.severity, profileKey },
    });

    if (alert.severity === 'critical' && process.env.AUTO_ESCALATE_CRITICAL !== 'false') {
      await autoEscalateToIncident(alert);
    }
    return alert.toJSON();
  }

  const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mem = { id, ...payload };
  memoryAlerts.set(id, mem);
  return mem;
}

async function autoEscalateToIncident(alert) {
  const incidentService = require('./incidentService');
  const incident = await incidentService.create({
    title: `[Auto] ${alert.title}`,
    summary: alert.description,
    severity: alert.severity === 'critical' ? 'critical' : 'high',
    alertIds: [alert.id],
    tags: ['auto-escalated'],
  });
  return incident;
}

async function list(filters = {}) {
  const {
    status, severity, limit = 50, offset = 0,
    q, ip, profileKey, incidentId, since, until,
  } = filters;

  if (isDbReady()) {
    try {
      const dialect = sequelize?.getDialect?.() || 'postgres';
      const likeOp = dialect === 'postgres' ? Op.iLike : Op.like;
      const where = {};
      if (status) where.status = status;
      if (severity) where.severity = severity;
      if (ip) where.ipAddress = ip;
      if (profileKey) where.profileKey = profileKey;
      if (incidentId) where.incidentId = incidentId;
      if (since || until) {
        where.detectedAt = {};
        if (since) where.detectedAt[Op.gte] = new Date(since);
        if (until) where.detectedAt[Op.lte] = new Date(until);
      }
      if (q) {
        where[Op.or] = [
          { title: { [likeOp]: `%${q}%` } },
          { description: { [likeOp]: `%${q}%` } },
          { ipAddress: { [likeOp]: `%${q}%` } },
        ];
      }

      const { rows, count } = await Alert.findAndCountAll({
        where,
        order: [['detectedAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        include: [{ model: Incident, as: 'incident', attributes: ['id', 'title', 'status'] }],
      });
      return { items: rows.map((r) => r.toJSON()), total: count };
    } catch (err) {
      console.warn('[AlertService] DB list fallback:', err.message);
    }
  }

  let items = [...memoryAlerts.values()];
  if (status) items = items.filter((a) => a.status === status);
  if (severity) items = items.filter((a) => a.severity === severity);
  if (q) {
    const lq = q.toLowerCase();
    items = items.filter((a) =>
      (a.title || '').toLowerCase().includes(lq) ||
      (a.description || '').toLowerCase().includes(lq)
    );
  }
  items.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
  return { items: items.slice(offset, offset + parseInt(limit, 10)), total: items.length };
}

async function getById(id) {
  if (isDbReady()) {
    const alert = await Alert.findByPk(id, {
      include: [{ model: Incident, as: 'incident' }],
    });
    return alert ? alert.toJSON() : null;
  }
  return memoryAlerts.get(id) || null;
}

async function updateStatus(id, { status, resolutionNotes, assignedTo, actor = 'analyst' }) {
  const updates = { status };
  const now = new Date();
  if (status === 'acknowledged') updates.acknowledgedAt = now;
  if (status === 'resolved' || status === 'false_positive') {
    updates.resolvedAt = now;
    updates.resolutionNotes = resolutionNotes || null;
  }
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;

  if (isDbReady()) {
    const alert = await Alert.findByPk(id);
    if (!alert) return null;
    await alert.update(updates);
    await auditService.log({
      action: `alert.${status}`,
      actor,
      resourceType: 'alert',
      resourceId: id,
      metadata: { resolutionNotes },
    });
    return alert.toJSON();
  }

  const mem = memoryAlerts.get(id);
  if (!mem) return null;
  Object.assign(mem, updates);
  return mem;
}

async function getStats() {
  if (isDbReady()) {
    try {
      const [byStatus, bySeverity, total] = await Promise.all([
        Alert.findAll({
          attributes: ['status', [Alert.sequelize.fn('COUNT', '*'), 'count']],
          group: ['status'],
          raw: true,
        }),
        Alert.findAll({
          attributes: ['severity', [Alert.sequelize.fn('COUNT', '*'), 'count']],
          group: ['severity'],
          raw: true,
        }),
        Alert.count(),
      ]);
      return {
        total,
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, parseInt(r.count, 10)])),
        bySeverity: Object.fromEntries(bySeverity.map((r) => [r.severity, parseInt(r.count, 10)])),
      };
    } catch (err) {
      console.warn('[AlertService] DB stats fallback:', err.message);
    }
  }
  const items = [...memoryAlerts.values()];
  return {
    total: items.length,
    byStatus: items.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {}),
    bySeverity: items.reduce((acc, a) => { acc[a.severity] = (acc[a.severity] || 0) + 1; return acc; }, {}),
  };
}

async function recentForFeed(limit = 20) {
  const { items } = await list({ limit, offset: 0 });
  return items;
}

module.exports = {
  createFromDetection,
  list,
  getById,
  updateStatus,
  getStats,
  recentForFeed,
};
