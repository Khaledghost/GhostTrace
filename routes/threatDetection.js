/**
 * Threat Detection Routes — Enhanced API with AI explanations, profile management,
 * and plugin administration.
 */

const express = require('express');
const router = express.Router();
const threatDetectionService = require('../services/threatDetectionService');
const profileStore = require('../core/profileStore');
const { pluginRegistry } = require('../core/pluginRegistry');
const alertService = require('../services/alertService');

// ─── Analyze ─────────────────────────────────────────────────────────────────

router.post('/analyze', async (req, res, next) => {
  try {
    const {
      accountId, userId, activityType, timestamp,
      ipAddress, userAgent, deviceInfo, location,
      endpoint, resourceUsage, body, query, metadata
    } = req.body;

    if (!activityType) {
      return res.status(400).json({ success: false, error: 'Missing required field: activityType' });
    }

    const analysis = await threatDetectionService.analyzeActivity({
      accountId, userId, activityType,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      ipAddress, userAgent, deviceInfo, location,
      endpoint, resourceUsage, body, query, metadata,
    });

    res.json({ success: true, data: analysis });
  } catch (err) { next(err); }
});

// ─── AI Explanation ───────────────────────────────────────────────────────────

router.post('/explain', async (req, res, next) => {
  try {
    const { key, activity, anomalies } = req.body;
    if (!key && !activity) {
      return res.status(400).json({ success: false, error: 'Provide key or activity' });
    }
    const profileKey = key || req.ip;
    const explanation = await threatDetectionService.getExplanation(profileKey, activity, anomalies);
    res.json({ success: true, data: explanation });
  } catch (err) { next(err); }
});

// ─── Risk ─────────────────────────────────────────────────────────────────────

router.get('/risk', async (req, res, next) => {
  try {
    const key = req.query.key || req.query.userId || req.ip;
    const risk = threatDetectionService.getRiskByKey(key);
    res.json({ success: true, data: risk });
  } catch (err) { next(err); }
});

// ─── Events / Threats ────────────────────────────────────────────────────────

router.get('/events', async (req, res, next) => {
  try {
    if (req.query.source === 'alerts' || !req.query.key) {
      const { items, total } = await alertService.list({
        ...req.query,
        profileKey: req.query.key || req.query.profileKey,
      });
      return res.json({ success: true, count: items.length, total, data: items });
    }
    const key = req.query.key || req.query.userId || req.ip;
    const limit = parseInt(req.query.limit || '50', 10);
    const events = threatDetectionService.getThreatsByKey(key, { limit });
    res.json({ success: true, count: events.length, data: events });
  } catch (err) { next(err); }
});

router.patch('/events/:id', async (req, res, next) => {
  try {
    const alert = await alertService.updateStatus(req.params.id, {
      status: req.body.status || (req.body.falsePositive ? 'false_positive' : 'resolved'),
      resolutionNotes: req.body.resolutionNotes || req.body.notes,
      assignedTo: req.body.assignedTo,
      actor: req.user?.username || 'analyst',
    });
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

// ─── Profile ─────────────────────────────────────────────────────────────────

router.get('/profile', async (req, res, next) => {
  try {
    const key = req.query.key || req.query.userId || req.ip;
    const profile = threatDetectionService.getProfileByKey(key);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

router.get('/profiles', async (req, res, next) => {
  try {
    const profiles = profileStore.all().map(p => p.toJSON());
    res.json({ success: true, count: profiles.length, data: profiles });
  } catch (err) { next(err); }
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res, next) => {
  try {
    const stats = threatDetectionService.getAllStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

// ─── Suspicious IP management ─────────────────────────────────────────────────

router.post('/suspicious', async (req, res) => {
  const key = req.body.key || req.body.ip || req.ip;
  const level = req.body.level || 'high';
  threatDetectionService.setSuspicious(key, level);
  res.json({ success: true, key, level });
});

router.delete('/suspicious', async (req, res) => {
  const key = req.body?.key || req.query.key || req.ip;
  threatDetectionService.clearSuspicious(key);
  res.json({ success: true, key });
});

// ─── Plugins ──────────────────────────────────────────────────────────────────

router.get('/plugins', (req, res) => {
  res.json({ success: true, data: pluginRegistry.list() });
});

// ─── Timeline feed (SSE) ──────────────────────────────────────────────────────

router.get('/feed', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  const sendStats = () => {
    const stats = threatDetectionService.getAllStats();
    res.write(`data: ${JSON.stringify(stats)}\n\n`);
  };

  sendStats();
  const interval = setInterval(sendStats, 3000);
  req.on('close', () => clearInterval(interval));
});

module.exports = router;
