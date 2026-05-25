const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');
const auditService = require('../services/auditService');

const webhooks = new Map();

router.get('/webhooks', (req, res) => {
  res.json({
    success: true,
    data: [...webhooks.entries()].map(([id, w]) => ({ id, ...w, secret: undefined })),
  });
});

router.post('/webhooks', (req, res) => {
  const { name, url, events = ['alert.created'] } = req.body;
  if (!name || !url) return res.status(400).json({ success: false, error: 'name and url required' });
  const id = `wh-${Date.now()}`;
  webhooks.set(id, { name, url, events, enabled: true, createdAt: new Date().toISOString() });
  res.status(201).json({ success: true, data: { id, name, url, events } });
});

router.post('/ingest', async (req, res, next) => {
  try {
    const { title, severity, description, ip, metadata } = req.body;
    const alert = await alertService.createFromDetection({
      activity: { ipAddress: ip, metadata, activityType: 'external_ingest' },
      anomalies: [{ type: 'external_alert', severity: severity || 'medium' }],
      riskScore: severity === 'critical' ? 90 : 50,
      profileKey: ip || 'external',
      explanation: description,
    });
    await auditService.log({ action: 'integration.ingest', actor: 'webhook', resourceType: 'alert', resourceId: alert?.id });
    res.status(201).json({ success: true, data: alert });
  } catch (err) { next(err); }
});

module.exports = router;
