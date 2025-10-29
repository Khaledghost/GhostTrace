const express = require('express');
const router = express.Router();
const threatDetectionService = require('../services/threatDetectionService');
const ThreatEvent = require('../models/ThreatEvent');
const BehavioralProfile = require('../models/BehavioralProfile');

// Analyze activity for threats
router.post('/analyze', async (req, res, next) => {
  try {
    const {
      accountId,
      userId,
      activityType,
      timestamp,
      ipAddress,
      userAgent,
      deviceInfo,
      location,
      endpoint,
      resourceUsage,
      metadata
    } = req.body;
    
    if (!accountId || !userId || !activityType) {
      return res.status(400).json({
        error: 'Missing required fields: accountId, userId, activityType'
      });
    }
    
    const activityData = {
      accountId,
      userId,
      activityType,
      timestamp: timestamp || new Date(),
      ipAddress,
      userAgent,
      deviceInfo,
      location,
      endpoint,
      resourceUsage,
      metadata
    };
    
    const analysis = await threatDetectionService.analyzeActivity(activityData);
    
    res.status(200).json({
      success: true,
      data: analysis
    });
    
  } catch (error) {
    next(error);
  }
});

// Get threat events for a user
router.get('/events/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const filters = {
      status: req.query.status,
      severity: req.query.severity,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 50
    };
    
    const threats = await threatDetectionService.getThreats(userId, filters);
    
    res.status(200).json({
      success: true,
      count: threats.length,
      data: threats
    });
    
  } catch (error) {
    next(error);
  }
});

// Get risk score for a user/account
router.get('/risk/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        error: 'accountId query parameter is required'
      });
    }
    
    const riskData = await threatDetectionService.getRiskScore(userId, accountId);
    
    res.status(200).json({
      success: true,
      data: riskData
    });
    
  } catch (error) {
    next(error);
  }
});

// Get behavioral profile for a user/account
router.get('/profile/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        error: 'accountId query parameter is required'
      });
    }
    
    const profile = await BehavioralProfile.findOne({ 
      where: { userId, accountId } 
    });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Behavioral profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: profile
    });
    
  } catch (error) {
    next(error);
  }
});

// Update threat event status
router.patch('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { status, resolutionNotes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        error: 'status is required'
      });
    }
    
    const event = await ThreatEvent.findByPk(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Threat event not found'
      });
    }
    
    event.status = status;
    event.resolutionNotes = resolutionNotes;
    event.resolvedAt = new Date();
    await event.save();
    
    res.status(200).json({
      success: true,
      data: event
    });
    
  } catch (error) {
    next(error);
  }
});

// Get threat statistics
router.get('/stats/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const { Op } = require('sequelize');
    
    const totalThreats = await ThreatEvent.count({ where: { userId } });
    const pendingThreats = await ThreatEvent.count({ where: { userId, status: 'pending' } });
    const criticalThreats = await ThreatEvent.count({ 
      where: { 
        userId, 
        severity: 'critical',
        status: { [Op.ne]: 'resolved' }
      }
    });
    
    const severityBreakdown = await ThreatEvent.findAll({
      where: { userId },
      attributes: [
        'severity',
        [ThreatEvent.sequelize.fn('COUNT', ThreatEvent.sequelize.col('severity')), 'count']
      ],
      group: ['severity'],
      raw: true
    });
    
    const recentThreats = await ThreatEvent.findAll({
      where: { userId },
      order: [['detectedAt', 'DESC']],
      limit: 10
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalThreats,
        pendingThreats,
        criticalThreats,
        severityBreakdown,
        recentThreats
      }
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;


