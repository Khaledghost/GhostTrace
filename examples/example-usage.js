/**
 * Example usage of the Behavioral DNA Threat Detection System
 * 
 * This file demonstrates how to integrate and use the threat detection API
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Example 1: Track a user login activity
async function trackLogin(userId, accountId) {
  try {
    const loginData = {
      accountId: accountId,
      userId: userId,
      activityType: 'login',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      deviceInfo: {
        deviceId: 'device-001',
        deviceType: 'desktop',
        browser: 'Chrome',
        os: 'Windows 10'
      },
      location: {
        country: 'US',
        city: 'New York',
        coordinates: {
          lat: 40.7128,
          lon: -74.0060
        }
      },
      endpoint: '/api/dashboard',
      status: 'success',
      resourceUsage: {
        cpu: 12.5,
        memory: 512,
        networkBytes: 256
      }
    };

    const response = await axios.post(`${BASE_URL}/behavior/track`, loginData);
    console.log('Login tracked:', response.data);
  } catch (error) {
    console.error('Error tracking login:', error.message);
  }
}

// Example 2: Analyze activity for threats
async function analyzeActivity(userId, accountId) {
  try {
    const activityData = {
      accountId: accountId,
      userId: userId,
      activityType: 'login',
      ipAddress: '203.0.113.45', // Different IP - might be suspicious
      userAgent: 'Mozilla/5.0 (Linux; Android 10) Mobile',
      deviceInfo: {
        deviceId: 'device-999', // New device
        deviceType: 'mobile',
        browser: 'Chrome Mobile',
        os: 'Android 10'
      },
      location: {
        country: 'CN',
        city: 'Beijing',
        coordinates: {
          lat: 39.9042,
          lon: 116.4074
        }
      },
      endpoint: '/api/sensitive-data',
      resourceUsage: {
        cpu: 85.0,
        memory: 2048,
        networkBytes: 10240
      }
    };

    const response = await axios.post(`${BASE_URL}/threats/analyze`, activityData);
    
    if (response.data.data.isThreat) {
      console.log('THREAT DETECTED!');
      console.log('Risk Score:', response.data.data.riskScore);
      console.log('Threat Level:', response.data.data.threatLevel);
      console.log('Anomalies:', response.data.data.anomalies);
    } else {
      console.log('No threats detected. Risk Score:', response.data.data.riskScore);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error analyzing activity:', error.message);
  }
}

// Example 3: Get threat events for a user
async function getThreatEvents(userId) {
  try {
    const response = await axios.get(`${BASE_URL}/threats/events/${userId}?status=pending&limit=10`);
    console.log('Threat Events:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting threat events:', error.message);
  }
}

// Example 4: Get risk score
async function getRiskScore(userId, accountId) {
  try {
    const response = await axios.get(`${BASE_URL}/threats/risk/${userId}?accountId=${accountId}`);
    console.log('Risk Score:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting risk score:', error.message);
  }
}

// Example 5: Get behavioral profile
async function getBehavioralProfile(userId, accountId) {
  try {
    const response = await axios.get(`${BASE_URL}/threats/profile/${userId}?accountId=${accountId}`);
    console.log('Behavioral Profile:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting behavioral profile:', error.message);
  }
}

// Example 6: Update threat event status
async function updateThreatStatus(eventId) {
  try {
    const updateData = {
      status: 'resolved',
      resolutionNotes: 'Verified as legitimate user on business trip'
    };
    
    const response = await axios.patch(`${BASE_URL}/threats/events/${eventId}`, updateData);
    console.log('Threat status updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating threat status:', error.message);
  }
}

// Example 7: Get activity history
async function getActivityHistory(userId, accountId) {
  try {
    const response = await axios.get(
      `${BASE_URL}/behavior/history/${userId}?accountId=${accountId}&limit=20`
    );
    console.log('Activity History:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting activity history:', error.message);
  }
}

// Example 8: Complete workflow - tracking suspicious activity
async function detectSuspiciousActivity() {
  const userId = 'user-001';
  const accountId = 'acc-001';
  
  console.log('\n=== Suspicious Activity Detection Workflow ===\n');
  
  // First, track some normal activities to build profile
  console.log('1. Building behavioral profile with normal activities...');
  await trackLogin(userId, accountId);
  await trackLogin(userId, accountId);
  await trackLogin(userId, accountId);
  
  // Wait a moment for profile to be processed
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Now try to login from a different location with new device
  console.log('\n2. Attempting login from suspicious location...');
  await analyzeActivity(userId, accountId);
  
  // Get the threat events
  console.log('\n3. Checking for threat events...');
  await getThreatEvents(userId);
  
  // Get current risk score
  console.log('\n4. Getting current risk score...');
  await getRiskScore(userId, accountId);
}

// Run the example
if (require.main === module) {
  detectSuspiciousActivity().catch(console.error);
}

module.exports = {
  trackLogin,
  analyzeActivity,
  getThreatEvents,
  getRiskScore,
  getBehavioralProfile,
  updateThreatStatus,
  getActivityHistory,
  detectSuspiciousActivity
};


