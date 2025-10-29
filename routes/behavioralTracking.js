const express = require('express');
const router = express.Router();
const AccountActivity = require('../models/AccountActivity');
const BehavioralProfile = require('../models/BehavioralProfile');

// Record account activity
router.post('/track', async (req, res, next) => {
  try {
    const {
      accountId,
      userId,
      activityType,
      ipAddress,
      userAgent,
      deviceInfo,
      location,
      endpoint,
      status,
      responseTime,
      resourceUsage,
      metadata
    } = req.body;
    
    if (!accountId || !userId || !activityType) {
      return res.status(400).json({
        error: 'Missing required fields: accountId, userId, activityType'
      });
    }
    
    const activity = await AccountActivity.create({
      accountId,
      userId,
      activityType,
      timestamp: new Date(),
      ipAddress,
      userAgent,
      deviceInfo,
      location,
      endpoint,
      status,
      responseTime,
      resourceUsage,
      metadata
    });
    
    res.status(201).json({
      success: true,
      data: activity
    });
    
  } catch (error) {
    next(error);
  }
});

// Get activity history
router.get('/history/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { accountId, activityType, startDate, endDate, limit = 50 } = req.query;
    
    const query = { userId };
    
    if (accountId) {
      query.accountId = accountId;
    }
    
    if (activityType) {
      query.activityType = activityType;
    }
    
    const { Op } = require('sequelize');
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp[Op.gte] = new Date(startDate);
      if (endDate) query.timestamp[Op.lte] = new Date(endDate);
    }
    
    const activities = await AccountActivity.findAll({
      where: query,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit)
    });
    
    res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
    
  } catch (error) {
    next(error);
  }
});

// Get behavioral profile
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

// Get activity statistics
router.get('/stats/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { accountId, startDate, endDate } = req.query;
    
    const matchQuery = { userId };
    
    if (accountId) {
      matchQuery.accountId = accountId;
    }
    
    const { Op } = require('sequelize');
    
    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp[Op.gte] = new Date(startDate);
      if (endDate) matchQuery.timestamp[Op.lte] = new Date(endDate);
    }
    
    const stats = await AccountActivity.findAll({
      where: matchQuery,
      attributes: [
        'activityType',
        [AccountActivity.sequelize.fn('COUNT', AccountActivity.sequelize.col('activityType')), 'count'],
        [AccountActivity.sequelize.fn('AVG', AccountActivity.sequelize.col('responseTime')), 'avgResponseTime']
      ],
      group: ['activityType'],
      raw: true
    });
    
    const totalActivities = await AccountActivity.count({ where: matchQuery });
    
    res.status(200).json({
      success: true,
      data: {
        totalActivities,
        stats
      }
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;


