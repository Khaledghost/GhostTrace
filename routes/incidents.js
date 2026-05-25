const express = require('express');
const router = express.Router();
const incidentService = require('../services/incidentService');

router.get('/', async (req, res, next) => {
  try {
    const result = await incidentService.list(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await incidentService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, summary, severity, priority, alertIds, assignedTo, tags } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'title required' });
    const incident = await incidentService.create({
      title, summary, severity, priority, alertIds, assignedTo, tags,
      actor: req.user?.username || 'analyst',
    });
    res.status(201).json({ success: true, data: incident });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const incident = await incidentService.getById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const incident = await incidentService.update(req.params.id, {
      ...req.body,
      actor: req.user?.username || 'analyst',
    });
    if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

router.post('/:id/alerts', async (req, res, next) => {
  try {
    const incident = await incidentService.addAlert(
      req.params.id,
      req.body.alertId,
      req.user?.username || 'analyst'
    );
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

module.exports = router;
