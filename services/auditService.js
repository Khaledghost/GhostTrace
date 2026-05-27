const { AuditLog } = require('../models');
const { isDbReady } = require('../config/database');

const memoryLog = [];
const MAX_MEMORY = 5000;

async function log({ action, actor = 'system', resourceType, resourceId, metadata = {}, ipAddress }) {
  const entry = {
    action,
    actor,
    resourceType,
    resourceId,
    metadata,
    ipAddress,
    createdAt: new Date().toISOString(),
  };

  if (isDbReady()) {
    try {
      await AuditLog.create(entry);
      return entry;
    } catch (err) {
      console.warn('[AuditService] DB log fallback:', err.message);
    }
  }

  memoryLog.unshift(entry);
  if (memoryLog.length > MAX_MEMORY) memoryLog.pop();
  return entry;
}

async function list({ limit = 100, offset = 0, action, actor } = {}) {
  if (isDbReady()) {
    try {
      const where = {};
      if (action) where.action = action;
      if (actor) where.actor = actor;
      const { rows, count } = await AuditLog.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
      return { items: rows.map((r) => r.toJSON()), total: count };
    } catch (err) {
      console.warn('[AuditService] DB list fallback:', err.message);
    }
  }
  let items = [...memoryLog];
  if (action) items = items.filter((i) => i.action === action);
  if (actor) items = items.filter((i) => i.actor === actor);
  return { items: items.slice(offset, offset + limit), total: items.length };
}

module.exports = { log, list };
