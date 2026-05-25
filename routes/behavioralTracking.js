/**
 * Behavioral Tracking Route — in-memory implementation (no DB required).
 * Uses the threat detection service for profile-based tracking.
 */
const express = require('express');
const router = express.Router();
const threatDetectionService = require('../services/threatDetectionService');
const profileStore = require('../core/profileStore');

// Track an activity and run analysis
router.post('/track', async (req, res, next) => {
  try {
    const { accountId, userId, activityType, ipAddress, userAgent,
            deviceInfo, location, endpoint, status, responseTime, resourceUsage, metadata } = req.body;

    if (!activityType) {
      return res.status(400).json({ success: false, error: 'Missing required field: activityType' });
    }

    const activity = {
      accountId, userId, activityType,
      timestamp: new Date(), ipAddress, userAgent,
      deviceInfo, location, endpoint, status, responseTime, resourceUsage, metadata
    };

    const analysis = await threatDetectionService.analyzeActivity(activity);

    res.status(201).json({
      success: true,
      data: { activity, analysis }
    });
  } catch (err) { next(err); }
});

// Get activity history for a profile key
router.get('/history/:userId', async (req, res, next) => {
  try {
    const key = `${req.query.accountId || 'default'}::${req.params.userId}`;
    const profile = profileStore.get(key);
    res.json({ success: true, data: profile ? profile.toJSON() : null });
  } catch (err) { next(err); }
});

// Stats for a profile
router.get('/stats/:userId', async (req, res, next) => {
  try {
    const key = `${req.query.accountId || 'default'}::${req.params.userId}`;
    const profile = profileStore.get(key);
    res.json({ success: true, data: profile ? {
      requestCount: profile.requestCount,
      riskScore: profile.riskScore,
      threatLevel: profile.threatLevel,
      failedAttempts: profile.failedAttempts,
      stats: { responseTime: profile.stats.responseTime.toJSON(), interArrival: profile.stats.interArrival.toJSON() }
    } : null });
  } catch (err) { next(err); }
});

module.exports = router;
