/**
 * Route Monitor API
 * Provides endpoints for viewing secured routes and their request logs
 */

const express = require('express');
const router = express.Router();
const routeLogger = require('../services/routeLogger');

// Get all registered routes
router.get('/routes', (req, res) => {
  try {
    const routes = routeLogger.getRoutes();
    res.json({
      success: true,
      routes,
      total: routes.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get request logs with filters
router.get('/logs', (req, res) => {
  try {
    const filters = {
      method: req.query.method,
      path: req.query.path,
      ip: req.query.ip,
      blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
      minRiskScore: req.query.minRiskScore ? parseInt(req.query.minRiskScore) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
    };

    const result = routeLogger.getLogs(filters);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get stats
router.get('/stats', (req, res) => {
  try {
    const stats = routeLogger.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Clear logs
router.delete('/logs', (req, res) => {
  try {
    routeLogger.clearLogs();
    res.json({
      success: true,
      message: 'Logs cleared',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get log details by ID
router.get('/logs/:id', (req, res) => {
  try {
    const { logs } = routeLogger.getLogs();
    const log = logs.find(l => l.id === req.params.id);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Log not found',
      });
    }

    res.json({
      success: true,
      log,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
