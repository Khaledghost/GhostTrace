const { SecurityPolicy } = require('../models');
const { isDbReady } = require('../config/database');
const auditService = require('./auditService');

const DEFAULT_POLICIES = [
  {
    name: 'Default Block Policy',
    description: 'Block high-risk behavioral threats at the edge',
    enabled: true,
    blockOnThreat: true,
    riskBlockThreshold: 70,
    rateLimitPerWindow: 120,
    autoEscalateCritical: true,
    rules: [{ type: 'block_threshold', value: 70 }],
  },
  {
    name: 'Observe Only',
    description: 'Detect and alert without blocking traffic',
    enabled: false,
    blockOnThreat: false,
    riskBlockThreshold: 100,
    rateLimitPerWindow: 500,
    autoEscalateCritical: true,
    rules: [{ type: 'passthrough', value: true }],
  },
];

let memoryPolicies = [...DEFAULT_POLICIES.map((p, i) => ({ ...p, id: `default-${i}` }))];

async function seedDefaults() {
  if (!isDbReady()) return;
  const count = await SecurityPolicy.count();
  if (count === 0) {
    await SecurityPolicy.bulkCreate(DEFAULT_POLICIES);
  }
}

function getActivePolicy() {
  const policies = memoryPolicies.filter((p) => p.enabled);
  return policies[0] || DEFAULT_POLICIES[0];
}

async function list() {
  if (isDbReady()) {
    const rows = await SecurityPolicy.findAll({ order: [['name', 'ASC']] });
    return rows.map((r) => r.toJSON());
  }
  return memoryPolicies;
}

async function upsert(data, actor = 'admin') {
  if (isDbReady()) {
    let policy;
    if (data.id) {
      policy = await SecurityPolicy.findByPk(data.id);
      if (policy) await policy.update(data);
      else policy = await SecurityPolicy.create(data);
    } else {
      policy = await SecurityPolicy.create(data);
    }
    await auditService.log({ action: 'policy.updated', actor, resourceType: 'policy', resourceId: policy.id });
    return policy.toJSON();
  }

  if (data.id) {
    const idx = memoryPolicies.findIndex((p) => p.id === data.id);
    if (idx >= 0) memoryPolicies[idx] = { ...memoryPolicies[idx], ...data };
    return memoryPolicies[idx];
  }
  const mem = { id: `pol-${Date.now()}`, ...data };
  memoryPolicies.push(mem);
  return mem;
}

async function getActive() {
  if (isDbReady()) {
    const policy = await SecurityPolicy.findOne({ where: { enabled: true }, order: [['updatedAt', 'DESC']] });
    return policy ? policy.toJSON() : DEFAULT_POLICIES[0];
  }
  return getActivePolicy();
}

async function refreshMemoryFromDb() {
  if (isDbReady()) memoryPolicies = await list();
}

module.exports = { seedDefaults, list, upsert, getActive, refreshMemoryFromDb, DEFAULT_POLICIES };
