const express = require('express');
const router = express.Router();
const socService = require('../services/socService');
const threatDetectionService = require('../services/threatDetectionService');

router.get('/command-center', async (req, res, next) => {
  try {
    const data = await socService.getCommandCenter();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/feed', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = async () => {
    const [command, detection] = await Promise.all([
      socService.getCommandCenter(),
      Promise.resolve(threatDetectionService.getAllStats()),
    ]);
    res.write(`data: ${JSON.stringify({ command, detection })}\n\n`);
  };

  send();
  const interval = setInterval(send, 3000);
  req.on('close', () => clearInterval(interval));
});

module.exports = router;
