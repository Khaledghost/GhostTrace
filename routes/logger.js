const express = require('express');
const router = express.Router();
const RequestLogger = require('../middleware/requestLogger');

// Get request logs
router.get('/logs', (req, res) => {
  try {
    const { limit = 50, method, path, statusCode } = req.query;
    
    let logs;
    if (method || path || statusCode) {
      logs = RequestLogger.getFilteredLogs({ method, path, statusCode });
    } else {
      logs = RequestLogger.getLogs(parseInt(limit));
    }
    
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear logs
router.delete('/logs', (req, res) => {
  try {
    RequestLogger.clearLogs();
    res.status(200).json({
      success: true,
      message: 'Logs cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get log statistics
router.get('/logs/stats', (req, res) => {
  try {
    const logs = RequestLogger.getLogs(1000);
    
    const stats = {
      total: logs.length,
      byMethod: {},
      byPath: {},
      byStatusCode: {},
      averageResponseTime: 0,
      totalResponseTime: 0
    };
    
    logs.forEach(log => {
      // Method breakdown
      stats.byMethod[log.method] = (stats.byMethod[log.method] || 0) + 1;
      
      // Path breakdown (simplified)
      const pathSegments = log.path.split('/').filter(s => s);
      const mainPath = pathSegments.length > 0 ? `/${pathSegments[0]}` : log.path;
      stats.byPath[mainPath] = (stats.byPath[mainPath] || 0) + 1;
      
      // Status code breakdown
      const statusGroup = Math.floor(log.statusCode / 100) * 100;
      stats.byStatusCode[statusGroup] = (stats.byStatusCode[statusGroup] || 0) + 1;
      
      // Response time
      stats.totalResponseTime += log.responseTime;
    });
    
    stats.averageResponseTime = logs.length > 0 
      ? Math.round(stats.totalResponseTime / logs.length)
      : 0;
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

