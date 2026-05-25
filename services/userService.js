const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { isDbReady } = require('../config/database');
const auditService = require('./auditService');
const { assertEmail, assertPassword, assertUuid } = require('../utils/validate');

const SALT_ROUNDS = 10;
const ROLES = ['admin', 'analyst', 'viewer'];

function publicUser(row) {
  const u = row.toJSON ? row.toJSON() : row;
  delete u.passwordHash;
  return u;
}

async function countUsers() {
  if (!isDbReady()) return 0;
  return User.count();
}

async function needsSetup() {
  return (await countUsers()) === 0;
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function createAdmin({ email, password, name }) {
  if (!isDbReady()) throw new Error('Database unavailable');
  if (!(await needsSetup())) throw new Error('Setup already completed');

  const normalizedEmail = assertEmail(email);
  assertPassword(password);

  const user = await User.create({
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    name: (name || 'Administrator').trim(),
    role: 'admin',
    active: true,
  });

  await auditService.log({
    action: 'user.setup',
    actor: normalizedEmail,
    resourceType: 'user',
    resourceId: user.id,
    metadata: { role: 'admin' },
  });

  return publicUser(user);
}

async function authenticate(email, password) {
  if (!isDbReady()) throw new Error('Database unavailable');

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.scope('withSecret').findOne({ where: { email: normalizedEmail } });
  if (!user || !user.active) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  user.lastLoginAt = new Date();
  await user.save();

  return publicUser(user);
}

async function listUsers() {
  if (!isDbReady()) return [];
  const rows = await User.findAll({ order: [['createdAt', 'ASC']] });
  return rows.map(publicUser);
}

async function createUser({ email, password, name, role }, actorEmail) {
  if (!isDbReady()) throw new Error('Database unavailable');

  const normalizedEmail = assertEmail(email);
  const userRole = ROLES.includes(role) ? role : 'analyst';
  assertPassword(password);

  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) throw new Error('Email already registered');

  const user = await User.create({
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    name: (name || normalizedEmail.split('@')[0]).trim(),
    role: userRole,
    active: true,
  });

  await auditService.log({
    action: 'user.create',
    actor: actorEmail || 'admin',
    resourceType: 'user',
    resourceId: user.id,
    metadata: { email: normalizedEmail, role: userRole },
  });

  return publicUser(user);
}

async function updateUser(id, updates, actorEmail) {
  if (!isDbReady()) throw new Error('Database unavailable');
  assertUuid(id, 'user id');

  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');

  const patch = {};
  if (updates.name !== undefined) patch.name = String(updates.name).trim();
  if (updates.role !== undefined && ROLES.includes(updates.role)) patch.role = updates.role;
  if (updates.active !== undefined) patch.active = !!updates.active;
  if (updates.password) {
    assertPassword(updates.password);
    patch.passwordHash = await hashPassword(updates.password);
  }

  await user.update(patch);

  await auditService.log({
    action: 'user.update',
    actor: actorEmail || 'admin',
    resourceType: 'user',
    resourceId: user.id,
    metadata: { fields: Object.keys(patch).filter((k) => k !== 'passwordHash') },
  });

  return publicUser(user);
}

async function deleteUser(id, actorId, actorEmail) {
  if (!isDbReady()) throw new Error('Database unavailable');
  assertUuid(id, 'user id');
  if (id === actorId) throw new Error('Cannot delete your own account');

  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');

  if (user.role === 'admin') {
    const adminCount = await User.count({ where: { role: 'admin', active: true } });
    if (adminCount <= 1) throw new Error('Cannot delete the last active admin');
  }

  await user.destroy();

  await auditService.log({
    action: 'user.delete',
    actor: actorEmail || 'admin',
    resourceType: 'user',
    resourceId: id,
    metadata: { email: user.email },
  });

  return { deleted: true };
}

module.exports = {
  ROLES,
  needsSetup,
  createAdmin,
  authenticate,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  publicUser,
};
