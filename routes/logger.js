const express = require('express');
const router = express.Router();
const RequestLogger = require('../middleware/requestLogger');
const logAiService = require('../services/logAiService');

router.get('/logs', (req, res) => {
  try {
    const { limit = 50, method, path, statusCode, aiOnly, risk } = req.query;
    let logs;
    if (method || path || statusCode || aiOnly || risk) {
      logs = RequestLogger.getFilteredLogs({ method, path, statusCode, aiOnly, risk });
    } else {
      logs = RequestLogger.getLogs(parseInt(limit, 10));
    }
    logs = logs.slice(0, parseInt(limit, 10));
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/logs/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: 'init', logs: RequestLogger.getLogs(30) });

  const onLog = (log) => send({ type: 'log', log });
  const onAi = ({ logId, analysis, log }) => send({ type: 'ai', logId, analysis, log });

  RequestLogger.on('log', onLog);
  RequestLogger.on('ai-analyzed', onAi);

  const heartbeat = setInterval(() => send({ type: 'ping', ts: Date.now() }), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    RequestLogger.off('log', onLog);
    RequestLogger.off('ai-analyzed', onAi);
  });
});

router.get('/logs/stats', (req, res) => {
  try {
    const logs = RequestLogger.getLogs(1000);
    const stats = {
      total: logs.length,
      withAi: logs.filter((l) => l.aiAnalysis).length,
      byMethod: {},
      byStatusCode: {},
      byAiRisk: {},
      averageResponseTime: 0,
    };

    let totalRt = 0;
    logs.forEach((log) => {
      stats.byMethod[log.method] = (stats.byMethod[log.method] || 0) + 1;
      const g = `${Math.floor(log.statusCode / 100)}xx`;
      stats.byStatusCode[g] = (stats.byStatusCode[g] || 0) + 1;
      if (log.aiAnalysis?.riskLevel) {
        stats.byAiRisk[log.aiAnalysis.riskLevel] = (stats.byAiRisk[log.aiAnalysis.riskLevel] || 0) + 1;
      }
      totalRt += log.responseTime;
    });
    stats.averageResponseTime = logs.length ? Math.round(totalRt / logs.length) : 0;

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/logs/:id', (req, res) => {
  const log = RequestLogger.getById(req.params.id);
  if (!log) return res.status(404).json({ success: false, error: 'Log not found' });
  res.json({ success: true, data: log });
});

router.post('/logs/:id/analyze', async (req, res, next) => {
  try {
    const log = RequestLogger.getById(req.params.id);
    if (!log) return res.status(404).json({ success: false, error: 'Log not found' });

    if (req.query.stream === 'true') {
      return logAiService.analyzeLogStream(log, res, { providerId: req.body?.providerId });
    }

    const analysis = await logAiService.analyzeLog(log, { providerId: req.body?.providerId });
    log.aiAnalysis = analysis;
    log.aiStatus = 'complete';
    res.json({ success: true, data: analysis });
  } catch (err) { next(err); }
});

router.post('/logs/analyze-batch', async (req, res, next) => {
  try {
    const { limit = 10, providerId } = req.body;
    const logs = RequestLogger.getLogs(limit).filter((l) => !l.aiAnalysis);
    const results = [];
    for (const log of logs) {
      try {
        const analysis = await logAiService.analyzeLog(log, { providerId });
        log.aiAnalysis = analysis;
        log.aiStatus = 'complete';
        results.push({ logId: log.id, analysis });
      } catch (e) {
        results.push({ logId: log.id, error: e.message });
      }
    }
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

router.delete('/logs', (req, res) => {
  RequestLogger.clearLogs();
  res.json({ success: true, message: 'Logs cleared' });
});

module.exports = router;
