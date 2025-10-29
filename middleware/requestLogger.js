// In-memory request logger

class RequestLogger {
  static logs = [];
  static maxLogs = 1000; // Keep last 1000 requests in memory

  // Add request to in-memory log
  static async logRequest(req, res, responseData = null, startTime = Date.now()) {
    const logEntry = {
      id: this.logs.length + 1,
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      statusCode: res.statusCode,
      responseTime: Date.now() - startTime,
      requestBody: req.body ? JSON.stringify(req.body).substring(0, 200) : null,
      responseSize: responseData ? JSON.stringify(responseData).length : null
    };

    // Add to in-memory logs
    this.logs.unshift(logEntry);
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return logEntry;
  }

  // Get recent logs
  static getLogs(limit = 50) {
    return this.logs.slice(0, limit);
  }

  // Clear logs
  static clearLogs() {
    this.logs = [];
  }

  // Get logs by filter
  static getFilteredLogs(filter = {}) {
    let filtered = [...this.logs];

    if (filter.method) {
      filtered = filtered.filter(log => log.method === filter.method);
    }

    if (filter.path) {
      filtered = filtered.filter(log => log.path.includes(filter.path));
    }

    if (filter.statusCode) {
      filtered = filtered.filter(log => log.statusCode === parseInt(filter.statusCode));
    }

    return filtered;
  }

  // Middleware function
  static middleware() {
    return async (req, res, next) => {
      const startTime = Date.now();
      
      // Capture original res.json and res.send
      const originalJson = res.json;
      const originalSend = res.send;
      let responseSent = false;

      res.json = function(data) {
        if (!responseSent) {
          RequestLogger.logRequest(req, res, data, startTime);
          responseSent = true;
        }
        return originalJson.call(this, data);
      };

      res.send = function(data) {
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

module.exports = RequestLogger;

