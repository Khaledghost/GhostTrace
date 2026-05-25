/**
 * Data Sources Route — Manage external DB/Redis connections, run scans,
 * configure monitoring jobs, platform database settings.
 */

const express = require('express');
const router = express.Router();
const dbConnector = require('../core/dbConnector');
const dbScanner = require('../core/dbScanner');
const autoMonitor = require('../core/autoMonitor');
const platformDb = require('../config/platformDb');
const { savePlatformConfig, isDbReady } = require('../config/database');
const { mergeConfig } = require('../utils/connectionParser');

router.get('/jobs/all', (req, res) => {
  res.json({ success: true, data: autoMonitor.getAllJobStatuses() });
});

router.get('/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  const send = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onActivity = (d) => send('activity', d);
  const onThreat = (d) => send('threat', d);
  const onError = (d) => send('error', d);

  autoMonitor.on('activity', onActivity);
  autoMonitor.on('threat', onThreat);
  autoMonitor.on('poll:error', onError);

  const heartbeat = setInterval(() => {
    send('heartbeat', { jobs: autoMonitor.getAllJobStatuses(), ts: Date.now() });
  }, 5000);

  req.on('close', () => {
    autoMonitor.off('activity', onActivity);
    autoMonitor.off('threat', onThreat);
    autoMonitor.off('poll:error', onError);
    clearInterval(heartbeat);
  });
});

router.post('/jobs/:jobId/pause', (req, res) => {
  autoMonitor.pauseJob(decodeURIComponent(req.params.jobId));
  res.json({ success: true });
});

router.post('/jobs/:jobId/resume', (req, res) => {
  autoMonitor.resumeJob(decodeURIComponent(req.params.jobId));
  res.json({ success: true });
});

router.delete('/jobs/:jobId', (req, res) => {
  autoMonitor.stopJob(decodeURIComponent(req.params.jobId));
  res.json({ success: true });
});

router.get('/defaults', (req, res) => {
  const env = platformDb.getConfig();
  res.json({
    success: true,
    data: {
      postgres: {
        host: env.host,
        port: env.port,
        database: env.database,
        username: env.username,
        connectionMode: 'fields',
      },
      mysql: { host: 'localhost', port: 3306, database: 'mysql', connectionMode: 'fields' },
      mongodb: { host: 'localhost', port: 27017, database: 'test', connectionMode: 'uri',
        connectionString: 'mongodb://localhost:27017/test' },
      redis: { host: 'localhost', port: 6379, database: '0', connectionMode: 'fields' },
      mariadb: { host: 'localhost', port: 3306, database: 'mysql', connectionMode: 'fields' },
    },
  });
});

// ── Platform database (GhostTrace persistence) ────────────────────────────────

router.get('/platform', (req, res) => {
  res.json({
    success: true,
    data: {
      ...platformDb.sanitizePublic(platformDb.getConfig()),
      connected: isDbReady(),
    },
  });
});

router.post('/platform/test', async (req, res) => {
  try {
    const cfg = mergeConfig({ ...req.body, type: 'postgres', id: '__platform_test__' });
    await dbConnector.testConnection(cfg);
    res.json({ success: true, message: 'Platform database connection successful' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/platform', async (req, res) => {
  try {
    const result = await savePlatformConfig(req.body);
    res.json({
      success: true,
      data: result,
      message: result.tested
        ? 'Platform database settings saved. Restart the server to apply.'
        : 'Settings saved but connection test failed — fix credentials and retry',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── External data sources ─────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.json({ success: true, data: dbConnector.getAll() });
});

router.post('/test', async (req, res) => {
  try {
    const body = mergeConfig(normalizeSourceBody(req.body));
    await dbConnector.testConnection(body);
    res.json({ success: true, message: 'Connection successful' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = mergeConfig(normalizeSourceBody(req.body));
    if (!body.id || !body.type) {
      return res.status(400).json({ success: false, error: 'id and type are required' });
    }
    const source = await dbConnector.addSource(body);
    res.status(201).json({ success: true, data: source });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const source = await dbConnector.updateSource(req.params.id, normalizeSourceBody(req.body));
    res.json({ success: true, data: source });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id/jobs', (req, res) => {
  const jobs = autoMonitor.getAllJobStatuses()
    .filter((j) => j.sourceId === req.params.id);
  res.json({ success: true, data: jobs });
});

router.delete('/:id', async (req, res) => {
  try {
    autoMonitor.stopAllForSource(req.params.id);
    await dbConnector.removeSource(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const source = dbConnector.getSource(req.params.id);
  if (!source) return res.status(404).json({ success: false, error: 'Source not found' });
  res.json({ success: true, data: source });
});

router.post('/:id/scan', async (req, res) => {
  try {
    const result = await dbScanner.scan(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/monitor', async (req, res) => {
  try {
    const { action = 'start', tables, pollIntervalMs, batchSize } = req.body;
    const sourceId = req.params.id;

    if (action === 'stop') {
      autoMonitor.stopAllForSource(sourceId);
      return res.json({ success: true, message: 'Monitoring stopped' });
    }

    const source = dbConnector.getSource(sourceId);
    if (!source) return res.status(404).json({ success: false, error: 'Source not found' });

    const sourceObj = dbConnector.getSourceObj(sourceId);
    const scanConfigs = sourceObj?.scanResult?.monitorConfig || [];

    let configsToRun = tables?.length ? resolveMonitorTables(tables, scanConfigs) : scanConfigs;

    if (!configsToRun.length) {
      return res.status(400).json({
        success: false,
        error: 'No tables to monitor. Run a schema scan first and enable tables.',
      });
    }

    const jobIds = [];
    for (const cfg of configsToRun) {
      if (cfg.enabled === false) continue;
      const jobIdsInner = autoMonitor.startJob(sourceId, cfg, { pollIntervalMs, batchSize });
      jobIds.push(jobIdsInner);
    }

    res.json({ success: true, data: { jobIds, count: jobIds.length } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/mapping', async (req, res) => {
  const { table, mapping } = req.body;
  if (!table || !mapping) {
    return res.status(400).json({ success: false, error: 'table and mapping are required' });
  }

  const jobId = `${req.params.id}::${table}`;
  const job = autoMonitor._jobs?.get(jobId);
  if (job) {
    job.mapping = { ...job.mapping, ...mapping };
    return res.json({ success: true, message: 'Mapping updated on running job', mapping: job.mapping });
  }

  const sourceObj = dbConnector.getSourceObj(req.params.id);
  if (sourceObj?.scanResult) {
    const mc = sourceObj.scanResult.monitorConfig.find((m) => m.table === table);
    if (mc) mc.mapping = { ...mc.mapping, ...mapping };
  }

  res.json({ success: true, message: 'Mapping stored', mapping });
});

function normalizeSourceBody(body) {
  return {
    id: String(body.id || '').trim(),
    label: body.label,
    type: body.type,
    connectionMode: body.connectionMode,
    host: body.host,
    port: body.port,
    database: body.database,
    username: body.username,
    password: body.password,
    ssl: body.ssl,
    schema: body.schema,
    connectionString: body.connectionString || body.uri,
    poolMax: body.poolMax,
    connectTimeoutMs: body.connectTimeoutMs,
    rejectUnauthorized: body.rejectUnauthorized,
  };
}

function resolveMonitorTables(tables, scanConfigs) {
  return tables.map((t) => {
    const tableName = typeof t === 'string' ? t : t.table;
    const fromScan = scanConfigs.find((m) => m.table === tableName);
    if (fromScan) {
      return { ...fromScan, enabled: t.enabled !== false };
    }
    return {
      table: tableName,
      mapping: t.mapping || {},
      enabled: t.enabled !== false,
    };
  }).filter((c) => c.table);
}

module.exports = router;
