const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Alert } = require('../models');
const { isDbReady, sequelize } = require('../config/database');
const alertService = require('../services/alertService');
const profileStore = require('../core/profileStore');

router.post('/query', async (req, res, next) => {
  try {
    const {
      q, ip, profileKey, severity, status, mitreTactic, mitreTechnique,
      since, until, limit = 100,
    } = req.body;

    if (isDbReady()) {
      try {
        const dialect = sequelize?.getDialect?.() || 'postgres';
        const likeOp = dialect === 'postgres' ? Op.iLike : Op.like;
        const containsOp = dialect === 'postgres' ? Op.contains : Op.like;
        const where = {};
        if (severity) where.severity = severity;
        if (status) where.status = status;
        if (ip) where.ipAddress = { [likeOp]: `%${ip}%` };
        if (profileKey) where.profileKey = profileKey;
        if (since || until) {
          where.detectedAt = {};
          if (since) where.detectedAt[Op.gte] = new Date(since);
          if (until) where.detectedAt[Op.lte] = new Date(until);
        }
        if (mitreTactic) {
          where.mitreTactics = dialect === 'postgres'
            ? { [containsOp]: [mitreTactic] }
            : { [containsOp]: `%${mitreTactic}%` };
        }
        if (mitreTechnique) {
          where.mitreTechniques = dialect === 'postgres'
            ? { [containsOp]: [mitreTechnique] }
            : { [containsOp]: `%${mitreTechnique}%` };
        }
        if (q) {
          where[Op.or] = [
            { title: { [likeOp]: `%${q}%` } },
            { description: { [likeOp]: `%${q}%` } },
            dialect === 'postgres'
              ? { anomalyTypes: { [containsOp]: [q] } }
              : { anomalyTypes: { [containsOp]: `%${q}%` } },
          ];
        }

        const alerts = await Alert.findAll({
          where,
          order: [['detectedAt', 'DESC']],
          limit: Math.min(parseInt(limit, 10), 500),
        });

        return res.json({
          success: true,
          count: alerts.length,
          data: { alerts: alerts.map((a) => a.toJSON()) },
        });
      } catch (err) {
        console.warn('[Hunt] DB fallback:', err.message);
      }
    }

    const { items } = await alertService.list({ q, ip, profileKey, severity, status, since, until, limit });
    res.json({ success: true, count: items.length, data: { alerts: items } });
  } catch (err) { next(err); }
});

router.get('/profiles', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  let profiles = profileStore.all().map((p) => p.toJSON());
  if (q) {
    profiles = profiles.filter((p) =>
      p.key.toLowerCase().includes(q) ||
      p.threatLevel.includes(q)
    );
  }
  res.json({ success: true, count: profiles.length, data: profiles });
});

router.get('/iocs', async (req, res, next) => {
  try {
    const { items } = await alertService.list({ limit: 200 });
    const ips = {};
    const techniques = {};
    for (const a of items) {
      if (a.ipAddress) ips[a.ipAddress] = (ips[a.ipAddress] || 0) + 1;
      for (const t of a.mitreTechniques || []) {
        techniques[t] = (techniques[t] || 0) + 1;
      }
    }
    res.json({
      success: true,
      data: {
        topIps: Object.entries(ips).sort((a, b) => b[1] - a[1]).slice(0, 20),
        topTechniques: Object.entries(techniques).sort((a, b) => b[1] - a[1]).slice(0, 20),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
