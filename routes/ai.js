const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const aiConfigService = require('../services/aiConfigService');
const providerRegistry = require('../core/ai/providerRegistry');

router.get('/status', async (req, res, next) => {
  try {
    const status = await aiService.getStatus();
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
});

router.get('/providers', (req, res) => {
  res.json({ success: true, data: providerRegistry.listProviders() });
});

router.get('/configs', async (req, res, next) => {
  try {
    const configs = await aiConfigService.list();
    res.json({ success: true, data: configs });
  } catch (err) { next(err); }
});

router.post('/configs', async (req, res, next) => {
  try {
    const config = await aiConfigService.upsert(req.body);
    res.status(201).json({ success: true, data: config });
  } catch (err) { next(err); }
});

router.put('/configs/:id', async (req, res, next) => {
  try {
    const config = await aiConfigService.upsert({ ...req.body, id: req.params.id });
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

router.delete('/configs/:id', async (req, res, next) => {
  try {
    await aiConfigService.remove(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/configs/:id/test', async (req, res, next) => {
  try {
    let config = req.body;
    if (req.params.id && req.params.id !== 'new') {
      const { AiProviderConfig } = require('../models');
      const { isDbReady } = require('../config/database');
      if (isDbReady()) {
        const row = await AiProviderConfig.findByPk(req.params.id);
        if (row) config = { ...row.toJSON(), ...req.body };
      } else {
        const all = await aiConfigService.list({ includeSecrets: true });
        config = all.find((c) => c.id === req.params.id) || config;
      }
    }

    const result = await aiService.testProvider(config);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/settings', (req, res) => {
  res.json({ success: true, data: aiConfigService.getGlobalSettings() });
});

router.patch('/settings', (req, res) => {
  const settings = aiConfigService.updateGlobalSettings(req.body);
  res.json({ success: true, data: settings });
});

router.post('/complete', async (req, res, next) => {
  try {
    const { prompt, system, providerId, jsonMode, maxTokens } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt required' });

    const result = await aiService.completeWithFallback({
      user: prompt,
      system,
      providerId,
      jsonMode,
      maxTokens,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/stream', async (req, res, next) => {
  try {
    const { prompt, system, providerId } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders?.();

    for await (const { chunk, provider, model } of aiService.streamWithFallback({
      user: prompt,
      system,
      providerId,
    })) {
      res.write(`data: ${JSON.stringify({ chunk, provider, model })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
