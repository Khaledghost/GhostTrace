/**
 * DbScanner — Inspects a connected data source and discovers:
 *
 *   - Tables / collections that contain user/session/activity data
 *   - Column/field names for: userId, email, IP, timestamp, endpoint, status
 *   - Sample row count and freshness
 *
 * The scanner produces a `ScanResult` which the AutoMonitor uses to
 * continuously pull new events and feed them into the anomaly engine.
 */

const dbConnector = require('./dbConnector');

// ── Column name heuristics ────────────────────────────────────────────────────

const HEURISTICS = {
  userId:    ['user_id','userid','user','uid','account_id','accountid','member_id'],
  email:     ['email','email_address','user_email','mail'],
  ip:        ['ip','ip_address','remote_addr','client_ip','ipaddr','remote_ip'],
  userAgent: ['user_agent','useragent','ua','browser'],
  timestamp: ['created_at','timestamp','time','logged_at','event_time','date','occurred_at','ts'],
  endpoint:  ['endpoint','url','path','request_path','request_url','route','uri'],
  method:    ['method','http_method','request_method'],
  status:    ['status','status_code','http_status','response_code','result'],
  action:    ['action','activity','event_type','activity_type','type','event','operation'],
  location:  ['location','country','city','geo','region'],
  device:    ['device','device_type','platform','os'],
};

const USER_TABLE_KEYWORDS   = ['user','account','member','customer','profile','auth','identity','person'];
const SESSION_TABLE_KEYWORDS = ['session','token','login','auth_log','access_log','request_log','activity','audit','event','log'];

class DbScanner {

  /**
   * Full scan of a data source.
   * @param {string} sourceId
   * @returns {Promise<ScanResult>}
   */
  async scan(sourceId) {
    const source = dbConnector.getSourceObj(sourceId);
    if (!source || source.status !== 'connected') {
      throw new Error(`Source ${sourceId} is not connected`);
    }

    let result;
    switch (source.type) {
      case 'postgres': result = await this._scanPg(source);    break;
      case 'mysql':    result = await this._scanMysql(source);  break;
      case 'mongodb':  result = await this._scanMongo(source);  break;
      case 'redis':    result = await this._scanRedis(source);  break;
      default: throw new Error(`Unsupported type: ${source.type}`);
    }

    // Store scan result on the source object
    source.scanResult = result;
    return result;
  }

  // ── PostgreSQL ────────────────────────────────────────────────────────────

  async _scanPg(source) {
    const pool = source.conn;
    const tables = [];

    // List all tables in the public schema
    const { rows: tableRows } = await pool.query(`
      SELECT table_name, pg_relation_size(quote_ident(table_name)) AS size_bytes
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY size_bytes DESC NULLS LAST
      LIMIT 100
    `);

    for (const { table_name, size_bytes } of tableRows) {
      const { rows: colRows } = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table_name]);

      const columns = colRows.map(r => ({ name: r.column_name, type: r.data_type }));
      const mapping = this._mapColumns(columns.map(c => c.name));
      const relevance = this._scoreTable(table_name, mapping);

      if (relevance === 'none') continue;

      // Row count (fast estimate from pg_class)
      let rowCount = 0;
      try {
        const { rows: cr } = await pool.query(`SELECT reltuples::bigint AS n FROM pg_class WHERE relname = $1`, [table_name]);
        rowCount = cr[0]?.n || 0;
      } catch (_) {}

      // Latest row timestamp
      let latestTs = null;
      if (mapping.timestamp) {
        try {
          const { rows: tr } = await pool.query(
            `SELECT MAX(${this._quote(mapping.timestamp)}) AS ts FROM ${this._quote(table_name)} LIMIT 1`
          );
          latestTs = tr[0]?.ts || null;
        } catch (_) {}
      }

      tables.push({ table: table_name, columns, mapping, relevance, rowCount: Number(rowCount), latestTs, sizeBytes: Number(size_bytes || 0) });
    }

    return this._buildScanResult('postgres', tables);
  }

  // ── MySQL ─────────────────────────────────────────────────────────────────

  async _scanMysql(source) {
    const pool = source.conn;
    const tables = [];

    const [tableRows] = await pool.query(`
      SELECT TABLE_NAME AS table_name, DATA_LENGTH + INDEX_LENGTH AS size_bytes, TABLE_ROWS AS row_estimate
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY size_bytes DESC
      LIMIT 100
    `);

    for (const row of tableRows) {
      const [colRows] = await pool.query(`
        SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [row.table_name]);

      const columns = colRows.map(r => ({ name: r.column_name, type: r.data_type }));
      const mapping = this._mapColumns(columns.map(c => c.name));
      const relevance = this._scoreTable(row.table_name, mapping);
      if (relevance === 'none') continue;

      let latestTs = null;
      if (mapping.timestamp) {
        try {
          const [[tr]] = await pool.query(`SELECT MAX(\`${mapping.timestamp}\`) AS ts FROM \`${row.table_name}\``);
          latestTs = tr?.ts || null;
        } catch (_) {}
      }

      tables.push({ table: row.table_name, columns, mapping, relevance, rowCount: Number(row.row_estimate || 0), latestTs, sizeBytes: Number(row.size_bytes || 0) });
    }

    return this._buildScanResult('mysql', tables);
  }

  // ── MongoDB ────────────────────────────────────────────────────────────────

  async _scanMongo(source) {
    const conn = source.conn;
    const collections = [];

    const collNames = await conn.db.listCollections().toArray();

    for (const { name } of collNames) {
      const coll = conn.collection(name);

      // Sample documents to infer schema
      const docs = await coll.find({}).limit(20).toArray();
      if (!docs.length) continue;

      const fields = new Set();
      docs.forEach(d => Object.keys(d).forEach(k => fields.add(k)));
      const columns = [...fields].map(f => ({ name: f, type: 'mixed' }));

      const mapping = this._mapColumns([...fields]);
      const relevance = this._scoreTable(name, mapping);
      if (relevance === 'none') continue;

      const rowCount = await coll.estimatedDocumentCount();

      let latestTs = null;
      if (mapping.timestamp) {
        try {
          const latest = await coll.find({}).sort({ [mapping.timestamp]: -1 }).limit(1).toArray();
          latestTs = latest[0]?.[mapping.timestamp] || null;
        } catch (_) {}
      }

      collections.push({ table: name, columns, mapping, relevance, rowCount, latestTs, sizeBytes: 0 });
    }

    return this._buildScanResult('mongodb', collections);
  }

  // ── Redis ──────────────────────────────────────────────────────────────────

  async _scanRedis(source) {
    const client = source.conn;

    // Sample keys to understand the key space
    const allKeys = await client.keys('*');
    const sample = allKeys.slice(0, 500);

    const patterns = {};
    for (const key of sample) {
      // Normalize key to a pattern: sess:abc123 → sess:*
      const pattern = key.replace(/:[a-zA-Z0-9_\-\.]+$/g, ':*').replace(/[a-zA-Z0-9]{8,}/g, '*');
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    }

    const keyTypes = {};
    for (const key of sample.slice(0, 50)) {
      try { keyTypes[key] = await client.type(key); } catch (_) {}
    }

    // Detect session-like keys
    const sessionPatterns = sample
      .filter(k => /sess|session|token|auth|jwt|user/i.test(k))
      .slice(0, 10);

    let sessionFieldSample = null;
    for (const k of sessionPatterns) {
      if (keyTypes[k] === 'hash') {
        sessionFieldSample = await client.hgetall(k);
        break;
      } else if (keyTypes[k] === 'string') {
        try {
          sessionFieldSample = JSON.parse(await client.get(k));
        } catch (_) {}
        break;
      }
    }

    const dbSize = await client.dbsize();

    const tables = [{
      table: 'redis_keyspace',
      columns: sessionFieldSample
        ? Object.keys(sessionFieldSample).map(f => ({ name: f, type: 'string' }))
        : [],
      mapping: sessionFieldSample ? this._mapColumns(Object.keys(sessionFieldSample)) : {},
      relevance: 'session',
      rowCount: dbSize,
      latestTs: null,
      keyPatterns: Object.entries(patterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([pattern, count]) => ({ pattern, count })),
      sessionPatterns,
      sizeBytes: 0,
    }];

    return this._buildScanResult('redis', tables);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _mapColumns(colNames) {
    const lower = colNames.map(c => c.toLowerCase());
    const mapping = {};

    for (const [field, candidates] of Object.entries(HEURISTICS)) {
      const match = lower.find(c => candidates.some(cand => c === cand || c.includes(cand)));
      if (match) {
        mapping[field] = colNames[lower.indexOf(match)];
      }
    }

    return mapping;
  }

  _scoreTable(tableName, mapping) {
    const name = tableName.toLowerCase();
    const isUserTable    = USER_TABLE_KEYWORDS.some(kw => name.includes(kw));
    const isSessionTable = SESSION_TABLE_KEYWORDS.some(kw => name.includes(kw));
    const hasUserId    = !!(mapping.userId || mapping.email);
    const hasTimestamp = !!mapping.timestamp;
    const hasActivity  = !!(mapping.action || mapping.endpoint || mapping.status);

    if (isSessionTable && hasTimestamp && (hasUserId || hasActivity)) return 'activity';
    if (isUserTable && hasUserId) return 'users';
    if (hasTimestamp && hasActivity && hasUserId) return 'activity';
    if (hasTimestamp && hasActivity) return 'partial';
    if (isUserTable || isSessionTable) return 'weak';
    return 'none';
  }

  _buildScanResult(type, tables) {
    const activityTables = tables.filter(t => ['activity','partial'].includes(t.relevance));
    const userTables     = tables.filter(t => t.relevance === 'users');

    return {
      type,
      scannedAt: new Date().toISOString(),
      tables,
      summary: {
        total: tables.length,
        activityTables: activityTables.length,
        userTables: userTables.length,
        recommended: activityTables[0]?.table || userTables[0]?.table || null,
        autoConfigured: activityTables.length > 0,
      },
      monitorConfig: activityTables.map(t => ({
        table: t.table,
        mapping: t.mapping,
        relevance: t.relevance,
        rowCount: t.rowCount,
        enabled: true,
      })),
    };
  }

  _quote(name) { return `"${name.replace(/"/g,'""')}"` }
}

module.exports = new DbScanner();
