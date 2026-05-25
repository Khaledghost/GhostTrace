const express = require('express');
const geoService = require('../services/geoService');
const geoGlobe = require('../core/geoGlobe');

const router = express.Router();

router.get('/globe', (req, res) => {
  res.json({
    success: true,
    data: {
      ...geoService.getGlobe(),
      server: geoService.getServerGeo(),
    },
  });
});

router.get('/recent', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({ success: true, data: geoGlobe.getRecent(limit) });
});

router.get('/stats', (req, res) => {
  res.json({ success: true, data: geoGlobe.getStats() });
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('init', {
    server: geoService.getServerGeo(),
    stats: geoGlobe.getStats(),
  });

  const onVisitor = (visitor) => send('visitor', visitor);
  geoService.on('visitor', onVisitor);

  const heartbeat = setInterval(() => {
    send('ping', { live: geoGlobe.getStats().live, ts: Date.now() });
  }, 10000);

  req.on('close', () => {
    geoService.off('visitor', onVisitor);
    clearInterval(heartbeat);
  });
});

router.get('/lookup/:ip', (req, res) => {
  res.json({ success: true, data: geoService.lookup(req.params.ip) });
});

module.exports = router;
