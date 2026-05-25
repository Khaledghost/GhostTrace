const { Op } = require('sequelize');
const { Incident, Alert } = require('../models');
const { isDbReady } = require('../config/database');
const auditService = require('./auditService');

const memoryIncidents = new Map();

function appendTimeline(incident, event) {
  const timeline = [...(incident.timeline || [])];
  timeline.push({ ...event, at: new Date().toISOString() });
  return timeline.slice(-100);
}

async function create({ title, summary, severity = 'medium', priority = 3, alertIds = [], assignedTo, tags = [], actor = 'analyst' }) {
  const payload = {
    title,
    summary,
    severity,
    priority,
    status: 'open',
    assignedTo,
    tags,
    alertCount: alertIds.length,
    timeline: [{ type: 'created', message: 'Incident opened', actor }],
  };

  if (isDbReady()) {
    const incident = await Incident.create(payload);
    if (alertIds.length) {
      await Alert.update(
        { incidentId: incident.id, status: 'escalated' },
        { where: { id: { [Op.in]: alertIds } } }
      );
    }
    await auditService.log({
      action: 'incident.created',
      actor,
      resourceType: 'incident',
      resourceId: incident.id,
    });
    return (await getById(incident.id));
  }

  const id = `inc-${Date.now()}`;
  const mem = { id, ...payload, createdAt: new Date().toISOString() };
  memoryIncidents.set(id, mem);
  return mem;
}

async function list({ status, limit = 50, offset = 0 } = {}) {
  if (isDbReady()) {
    const where = {};
    if (status) where.status = status;
    const { rows, count } = await Incident.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [{ model: Alert, as: 'alerts', attributes: ['id', 'title', 'severity', 'status'] }],
    });
    return { items: rows.map((r) => r.toJSON()), total: count };
  }

  let items = [...memoryIncidents.values()];
  if (status) items = items.filter((i) => i.status === status);
  return { items: items.slice(offset, offset + limit), total: items.length };
}

async function getById(id) {
  if (isDbReady()) {
    const incident = await Incident.findByPk(id, {
      include: [{ model: Alert, as: 'alerts' }],
    });
    return incident ? incident.toJSON() : null;
  }
  return memoryIncidents.get(id) || null;
}

async function update(id, { status, assignedTo, summary, actor = 'analyst' }) {
  const updates = {};
  if (status) updates.status = status;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;
  if (summary) updates.summary = summary;
  if (status === 'closed' || status === 'resolved') updates.closedAt = new Date();

  if (isDbReady()) {
    const incident = await Incident.findByPk(id);
    if (!incident) return null;
    updates.timeline = appendTimeline(incident.toJSON(), {
      type: 'status_change',
      message: `Status → ${status || incident.status}`,
      actor,
    });
    await incident.update(updates);
    await auditService.log({
      action: `incident.${status || 'updated'}`,
      actor,
      resourceType: 'incident',
      resourceId: id,
    });
    return getById(id);
  }

  const mem = memoryIncidents.get(id);
  if (!mem) return null;
  Object.assign(mem, updates);
  mem.timeline = appendTimeline(mem, { type: 'status_change', message: `Status → ${status}`, actor });
  return mem;
}

async function addAlert(incidentId, alertId, actor = 'analyst') {
  if (isDbReady()) {
    const incident = await Incident.findByPk(incidentId);
    if (!incident) return null;
    await Alert.update({ incidentId, status: 'escalated' }, { where: { id: alertId } });
    const count = await Alert.count({ where: { incidentId } });
    await incident.update({
      alertCount: count,
      timeline: appendTimeline(incident.toJSON(), { type: 'alert_linked', message: `Alert ${alertId} linked`, actor }),
    });
    return getById(incidentId);
  }
  return null;
}

async function getStats() {
  if (isDbReady()) {
    const [byStatus, total] = await Promise.all([
      Incident.findAll({
        attributes: ['status', [Incident.sequelize.fn('COUNT', '*'), 'count']],
        group: ['status'],
        raw: true,
      }),
      Incident.count(),
    ]);
    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, parseInt(r.count, 10)])),
    };
  }
  const items = [...memoryIncidents.values()];
  return {
    total: items.length,
    byStatus: items.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {}),
  };
}

module.exports = { create, list, getById, update, addAlert, getStats };
