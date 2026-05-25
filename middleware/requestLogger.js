const EventEmitter = require('events');
const logAiService = require('../services/logAiService');

const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);

class RequestLogger {
  static logs = [];
  static maxLogs = parseInt(process.env.LOG_MAX_ENTRIES || '2000', 10);
  static _idCounter = 1;

  static async logRequest(req, res, responseData = null, startTime = Date.now()) {
    const logEntry = {
      id: `log-${RequestLogger._idCounter++}`,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path || req.originalUrl?.split('?')[0],
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      statusCode: res.statusCode,
      responseTime: Date.now() - startTime,
      requestBody: req.body ? JSON.stringify(req.body).substring(0, 500) : null,
      responseSize: responseData ? JSON.stringify(responseData).length : null,
      aiAnalysis: null,
      aiStatus: 'pending',
    };

    RequestLogger.logs.unshift(logEntry);
    if (RequestLogger.logs.length > RequestLogger.maxLogs) {
      RequestLogger.logs = RequestLogger.logs.slice(0, RequestLogger.maxLogs);
    }

    logEmitter.emit('log', logEntry);

    if (logAiService.shouldAnalyze(logEntry)) {
      logEntry.aiStatus = 'queued';
      logAiService.enqueue(logEntry);
    } else {
      logEntry.aiStatus = 'skipped';
    }

    return logEntry;
  }

  static getLogs(limit = 50) {
    return RequestLogger.logs.slice(0, limit);
  }

  static getById(id) {
    return RequestLogger.logs.find((l) => l.id === id) || null;
  }

  static clearLogs() {
    RequestLogger.logs = [];
  }

  static getFilteredLogs(filter = {}) {
    let filtered = [...RequestLogger.logs];
    if (filter.method) filtered = filtered.filter((l) => l.method === filter.method);
    if (filter.path) filtered = filtered.filter((l) => l.path?.includes(filter.path));
    if (filter.statusCode) filtered = filtered.filter((l) => l.statusCode === parseInt(filter.statusCode, 10));
    if (filter.aiOnly === 'true') filtered = filtered.filter((l) => l.aiAnalysis);
    if (filter.risk) filtered = filtered.filter((l) => l.aiAnalysis?.riskLevel === filter.risk);
    return filtered;
  }

  static on(event, fn) { logEmitter.on(event, fn); }
  static off(event, fn) { logEmitter.off(event, fn); }
  static emit(event, data) { logEmitter.emit(event, data); }

  static middleware() {
    return async (req, res, next) => {
      const startTime = Date.now();
      const originalJson = res.json;
      const originalSend = res.send;
      let responseSent = false;

      res.json = function (data) {
        if (!responseSent) {
          RequestLogger.logRequest(req, res, data, startTime);
          responseSent = true;
        }
        return originalJson.call(this, data);
      };

      res.send = function (data) {
        if (!responseSent) {
          RequestLogger.logRequest(req, res, data, startTime);
          responseSent = true;
        }
        return originalSend.call(this, data);
      };

      next();
    };
  }
}

logAiService.on('analyzed', ({ logId, analysis }) => {
  const log = RequestLogger.logs.find((l) => l.id === logId);
  if (log) {
    log.aiAnalysis = analysis;
    log.aiStatus = 'complete';
    logEmitter.emit('ai-analyzed', { logId, analysis, log });
  }
});

module.exports = RequestLogger;
