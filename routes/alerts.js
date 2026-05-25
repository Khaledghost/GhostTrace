const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');

router.get('/', async (req, res, next) => {
  try {
    const result = await alertService.list(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await alertService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const push = async () => {
    const items = await alertService.recentForFeed(25);
    const stats = await alertService.getStats();
    res.write(`data: ${JSON.stringify({ alerts: items, stats })}\n\n`);
  };

  push();
  const interval = setInterval(push, 4000);
  req.on('close', () => clearInterval(interval));
});

router.get('/:id', async (req, res, next) => {
  try {
    const alert = await alertService.getById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { status, resolutionNotes, assignedTo } = req.body;
    const alert = await alertService.updateStatus(req.params.id, {
      status,
      resolutionNotes,
      assignedTo,
      actor: req.user?.username || 'analyst',
    });
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const alert = await alertService.updateStatus(req.params.id, {
      status: 'acknowledged',
      actor: req.user?.username || 'analyst',
    });
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

router.post('/:id/resolve', async (req, res, next) => {
  try {
    const alert = await alertService.updateStatus(req.params.id, {
      status: req.body.falsePositive ? 'false_positive' : 'resolved',
      resolutionNotes: req.body.notes,
      actor: req.user?.username || 'analyst',
    });
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

module.exports = router;
