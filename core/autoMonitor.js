/**
 * AutoMonitor — Continuously polls connected data sources and feeds new rows
 * into the BehavioralDNA anomaly engine automatically.
 *
 * Each monitored table is polled on an interval. New rows since the last
 * poll are normalized using the column mapping discovered by DbScanner and
 * submitted to ThreatDetectionService.
 *
 * Redis sources subscribe to keyspace notifications (or poll sorted sets).
 */

const EventEmitter = require('events');
const dbConnector = require('./dbConnector');

const POLL_INTERVAL_MS = parseInt(process.env.MONITOR_POLL_MS || '10000', 10);

class AutoMonitor extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, MonitorJob>} */
    this._jobs = new Map(); // jobId → { sourceId, table, timer, state }
    this._threatService = null; // injected lazily to avoid circular dep
    this._stats = new Map(); // jobId → { processed, threats, lastPoll }
  }

  get threatService() {
    if (!this._threatService) {
      this._threatService = require('./services/threatDetectionService');
      // Handle the path from core/ back to services/
      if (!this._threatService) {
        this._threatService = require('../services/threatDetectionService');
      }
    }
    return this._threatService;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start monitoring a table from a connected source using a scan result's monitorConfig.
   * @param {string} sourceId
   * @param {object} monitorConfig - { table, mapping, enabled }
   * @param {object} options - { pollIntervalMs, batchSize, enabled }
   */
  startJob(sourceId, monitorConfig, options = {}) {
    const jobId = `${sourceId}::${monitorConfig.table}`;
    if (this._jobs.has(jobId)) this.stopJob(jobId);

    if (monitorConfig.enabled === false) return jobId;

    const source = dbConnector.getSourceObj(sourceId);
    if (!source || source.status !== 'connected') {
      throw new Error(`Source ${sourceId} is not connected`);
    }

    const pollMs = options.pollIntervalMs || POLL_INTERVAL_MS;
    const batchSize = options.batchSize || 100;

    const job = {
      jobId,
      sourceId,
      table:   monitorConfig.table,
      mapping: monitorConfig.mapping || {},
      type:    source.type,
      pollMs,
      batchSize,
      // State
      lastId:  options.startFromId  || null,
      lastTs:  options.startFromTs  || new Date(Date.now() - 5 * 60 * 1000).toISOString(), // last 5min on start
      timer:   null,
      running: false,
      paused:  false,
    };

    this._stats.set(jobId, { processed: 0, threats: 0, lastPoll: null, errors: 0 });
    job.timer = setInterval(() => this._poll(job), pollMs);
    if (job.timer.unref) job.timer.unref();

    this._jobs.set(jobId, job);
    this.emit('job:started', { jobId, sourceId, table: monitorConfig.table });

    // Immediate first poll
    setImmediate(() => this._poll(job));

    return jobId;
  }

  stopJob(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return;
    clearInterval(job.timer);
    this._jobs.delete(jobId);
    this.emit('job:stopped', { jobId });
  }

  stopAllForSource(sourceId) {
    for (const [jobId, job] of this._jobs) {
      if (job.sourceId === sourceId) this.stopJob(jobId);
    }
  }

  pauseJob(jobId) {
    const job = this._jobs.get(jobId);
    if (job) job.paused = true;
  }

  resumeJob(jobId) {
    const job = this._jobs.get(jobId);
    if (job) { job.paused = false; this._poll(job); }
  }

  getJobStatus(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return null;
    return { ...this._stats.get(jobId) || {}, jobId, sourceId: job.sourceId, table: job.table, paused: job.paused, pollMs: job.pollMs };
  }

  getAllJobStatuses() {
    return [...this._jobs.keys()].map(id => this.getJobStatus(id));
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  async _poll(job) {
    if (job.paused || job.running) return;
    job.running = true;
    const stats = this._stats.get(job.jobId);

    try {
      let rows = [];
      switch (job.type) {
        case 'postgres': rows = await this._pollPg(job);    break;
        case 'mysql':    rows = await this._pollMysql(job);  break;
        case 'mongodb':  rows = await this._pollMongo(job);  break;
        case 'redis':    rows = await this._pollRedis(job);  break;
      }

      if (stats) { stats.lastPoll = new Date().toISOString(); }

      for (const raw of rows) {
        const activity = this._normalizeRow(raw, job.mapping, job.sourceId, job.table);
        try {
          const analysis = await this._getService().analyzeActivity(activity);
          if (stats) stats.processed++;
          if (analysis?.isThreat) {
            if (stats) stats.threats++;
            this.emit('threat', { jobId: job.jobId, activity, analysis });
          }
          this.emit('activity', { jobId: job.jobId, activity, analysis });
        } catch (e) {
          this.emit('error', { jobId: job.jobId, message: e.message });
        }
      }
    } catch (err) {
      if (stats) stats.errors++;
      this.emit('poll:error', { jobId: job.jobId, message: err.message });
    } finally {
      job.running = false;
    }
  }

  // ── DB-specific poll implementations ──────────────────────────────────────

  async _pollPg(job) {
    const pool = dbConnector.getRawConn(job.sourceId);
    const tsCol = job.mapping.timestamp;
    if (!tsCol) return [];

    const q = `SELECT * FROM "${job.table}" WHERE "${tsCol}" > $1 ORDER BY "${tsCol}" ASC LIMIT $2`;
    const { rows } = await pool.query(q, [job.lastTs, job.batchSize]);

    if (rows.length) job.lastTs = rows[rows.length - 1][tsCol];
    return rows;
  }

  async _pollMysql(job) {
    const pool = dbConnector.getRawConn(job.sourceId);
    const tsCol = job.mapping.timestamp;
    if (!tsCol) return [];

    const [rows] = await pool.query(
      `SELECT * FROM \`${job.table}\` WHERE \`${tsCol}\` > ? ORDER BY \`${tsCol}\` ASC LIMIT ?`,
      [job.lastTs, job.batchSize]
    );

    if (rows.length) job.lastTs = rows[rows.length - 1][tsCol];
    return rows;
  }

  async _pollMongo(job) {
    const conn = dbConnector.getRawConn(job.sourceId);
    const coll = conn.collection(job.table);
    const tsCol = job.mapping.timestamp;

    const filter = tsCol ? { [tsCol]: { $gt: new Date(job.lastTs) } } : {};
    const docs = await coll.find(filter).sort(tsCol ? { [tsCol]: 1 } : {}).limit(job.batchSize).toArray();

    if (docs.length && tsCol) job.lastTs = docs[docs.length - 1][tsCol];
    return docs;
  }

  async _pollRedis(job) {
    // For Redis we poll recently-seen keys via SCAN + check TTL changes
    const client = dbConnector.getRawConn(job.sourceId);
    const rows = [];

    // Scan for session/user keys modified recently (heuristic: TTL < original TTL)
    let cursor = '0';
    let scanned = 0;
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'COUNT', 50);
      cursor = nextCursor;
      scanned += keys.length;

      for (const key of keys.slice(0, 20)) {
        try {
          const type = await client.type(key);
          let data = {};
          if (type === 'hash') data = await client.hgetall(key);
          else if (type === 'string') {
            try { data = JSON.parse(await client.get(key)); } catch (_) { continue; }
          }
          if (data && typeof data === 'object') {
            rows.push({ _redisKey: key, ...data });
          }
        } catch (_) {}
      }
    } while (cursor !== '0' && scanned < 200);

    return rows;
  }

  // ── Row normalization ──────────────────────────────────────────────────────

  _normalizeRow(row, mapping, sourceId, table) {
    const get = (field) => {
      const col = mapping[field];
      return col ? row[col] : undefined;
    };

    const userId    = String(get('userId') || get('email') || row._redisKey || 'unknown');
    const ip        = String(get('ip') || '');
    const userAgent = String(get('userAgent') || '');
    const timestamp = get('timestamp') ? new Date(get('timestamp')) : new Date();
    const endpoint  = String(get('endpoint') || get('action') || table);
    const method    = String(get('method') || 'GET');
    const status    = get('status');
    const action    = String(get('action') || 'db_event');

    // Determine activity type
    let activityType = action;
    if (/login|signin|authenticate/i.test(action)) activityType = 'login';
    else if (/logout|signout/i.test(action)) activityType = 'logout';
    else if (/fail|error|denied/i.test(String(status || action))) activityType = 'failed_login';
    else if (/register|signup/i.test(action)) activityType = 'register';

    return {
      userId,
      accountId: sourceId,
      activityType,
      ipAddress: ip,
      userAgent,
      timestamp,
      endpoint,
      method,
      status: String(status || ''),
      responseTime: typeof row.response_time === 'number' ? row.response_time : undefined,
      location: get('location') ? { raw: get('location') } : undefined,
      deviceInfo: get('device') ? { deviceType: get('device') } : undefined,
      metadata: { sourceId, table, rawRow: row },
    };
  }

  _getService() {
    if (!this._threatService) {
      try { this._threatService = require('../services/threatDetectionService'); } catch (_) {}
    }
    return this._threatService;
  }
}

module.exports = new AutoMonitor();
