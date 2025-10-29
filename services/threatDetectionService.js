const { Op } = require('sequelize');
const BehavioralProfile = require('../models/BehavioralProfile');
const ThreatEvent = require('../models/ThreatEvent');
const AccountActivity = require('../models/AccountActivity');

class ThreatDetectionService {
  
  async analyzeActivity(activityData) {
    try {
      const { accountId, userId } = activityData;
      
      // Get or create behavioral profile
      let profile = await BehavioralProfile.findOne({ 
        where: { accountId, userId } 
      });
      
      if (!profile) {
        profile = await this.initializeProfile(accountId, userId);
      }
      
      // Analyze current activity against profile
      const anomalies = await this.detectAnomalies(activityData, profile);
      
      // Update behavioral profile
      await this.updateProfile(profile, activityData);
      
      // Create threat events if anomalies detected
      if (anomalies.length > 0) {
        await this.createThreatEvents(accountId, userId, anomalies);
        return {
          isThreat: true,
          anomalies,
          riskScore: profile.riskScore,
          threatLevel: profile.threatLevel
        };
      }
      
      return {
        isThreat: false,
        riskScore: profile.riskScore,
        threatLevel: profile.threatLevel
      };
      
    } catch (error) {
      console.error('Error analyzing activity:', error);
      throw error;
    }
  }
  
  async initializeProfile(accountId, userId) {
    const profile = await BehavioralProfile.create({
      accountId,
      userId,
      loginPattern: {
        averageLoginTime: [],
        loginFrequency: 0,
        lastLoginTimes: [],
        typicalLoginHours: []
      },
      accessPattern: {
        endpoints: [],
        commonResources: [],
        averageSessionDuration: 0
      },
      resourceUsage: {
        cpuUsage: [],
        memoryUsage: [],
        networkActivity: [],
        typicalRequestSize: 0
      },
      geographicPattern: {
        locations: [],
        primaryLocation: '',
        allowedRegions: []
      },
      devicePattern: {
        devices: [],
        primaryDevice: ''
      },
      behaviorSignature: '',
      riskScore: 0,
      threatLevel: 'low'
    });
    
    return profile;
  }
  
  async detectAnomalies(activityData, profile) {
    const anomalies = [];
    const threshold = 0.7; // 70% deviation threshold
    
    // Check location anomaly
    if (activityData.location) {
      const isLocationAnomalous = this.checkLocationAnomaly(activityData.location, profile);
      if (isLocationAnomalous) {
        anomalies.push({
          type: 'unusual_location',
          severity: 'medium',
          description: `Login from unusual location: ${activityData.location.city}, ${activityData.location.country}`,
          metadata: {
            ...activityData,
            anomalyScore: 0.75
          }
        });
      }
    }
    
    // Check device anomaly
    if (activityData.deviceInfo) {
      const isDeviceAnomalous = this.checkDeviceAnomaly(activityData.deviceInfo, profile);
      if (isDeviceAnomalous) {
        anomalies.push({
          type: 'device_mismatch',
          severity: 'high',
          description: `Access from unrecognized device: ${activityData.deviceInfo.deviceType}`,
          metadata: {
            ...activityData,
            anomalyScore: 0.85
          }
        });
      }
    }
    
    // Check time-based anomaly
    const isTimeAnomalous = this.checkTimeAnomaly(activityData.timestamp, profile);
    if (isTimeAnomalous) {
      anomalies.push({
        type: 'suspicious_login',
        severity: 'low',
        description: `Login at unusual time: ${activityData.timestamp}`,
        metadata: {
          ...activityData,
          anomalyScore: 0.65
        }
      });
    }
    
    // Check access pattern anomaly
    if (activityData.endpoint) {
      const isAccessAnomalous = this.checkAccessPatternAnomaly(activityData.endpoint, profile);
      if (isAccessAnomalous) {
        anomalies.push({
          type: 'access_anomaly',
          severity: 'medium',
          description: `Access to unusual endpoint: ${activityData.endpoint}`,
          metadata: {
            ...activityData,
            anomalyScore: 0.70
          }
        });
      }
    }
    
    // Check resource usage anomaly
    if (activityData.resourceUsage) {
      const isResourceAnomalous = this.checkResourceAnomaly(activityData.resourceUsage, profile);
      if (isResourceAnomalous) {
        anomalies.push({
          type: 'resource_abuse',
          severity: 'high',
          description: 'Unusual resource consumption detected',
          metadata: {
            ...activityData,
            anomalyScore: 0.80
          }
        });
      }
    }
    
    // Calculate overall behavioral deviation
    if (anomalies.length > 2) {
      anomalies.push({
        type: 'behavior_anomaly',
        severity: 'critical',
        description: 'Multiple behavioral anomalies detected',
        metadata: {
          ...activityData,
          behavioralDeviation: 0.90,
          anomalyScore: 0.90
        }
      });
    }
    
    return anomalies;
  }
  
  checkLocationAnomaly(location, profile) {
    if (!profile.geographicPattern.locations || profile.geographicPattern.locations.length === 0) {
      return false;
    }
    
    const knownLocations = profile.geographicPattern.locations.map(loc => 
      `${loc.country}-${loc.city}`
    );
    const currentLocation = `${location.country}-${location.city}`;
    
    return !knownLocations.includes(currentLocation);
  }
  
  checkDeviceAnomaly(deviceInfo, profile) {
    if (!profile.devicePattern.devices || profile.devicePattern.devices.length === 0) {
      return false;
    }
    
    const knownDevices = profile.devicePattern.devices.map(dev => dev.deviceId);
    return !knownDevices.includes(deviceInfo.deviceId);
  }
  
  checkTimeAnomaly(timestamp, profile) {
    if (!profile.loginPattern.typicalLoginHours || profile.loginPattern.typicalLoginHours.length === 0) {
      return false;
    }
    
    const hour = new Date(timestamp).getHours();
    return !profile.loginPattern.typicalLoginHours.includes(hour);
  }
  
  checkAccessPatternAnomaly(endpoint, profile) {
    if (!profile.accessPattern.endpoints || profile.accessPattern.endpoints.length === 0) {
      return false;
    }
    
    const knownEndpoints = profile.accessPattern.endpoints.map(ep => ep.path);
    return !knownEndpoints.includes(endpoint);
  }
  
  checkResourceAnomaly(resourceUsage, profile) {
    if (!profile.resourceUsage.cpuUsage || profile.resourceUsage.cpuUsage.length === 0) {
      return false;
    }
    
    const avgCpu = profile.resourceUsage.cpuUsage.reduce((a, b) => a + b, 0) / profile.resourceUsage.cpuUsage.length;
    const currentCpu = resourceUsage.cpu || 0;
    
    return Math.abs(currentCpu - avgCpu) > avgCpu * 0.5; // 50% deviation
  }
  
  async updateProfile(profile, activityData) {
    const now = new Date();
    
    // Update login pattern
    if (activityData.activityType === 'login') {
      profile.loginPattern.loginFrequency += 1;
      profile.loginPattern.lastLoginTimes.push(now);
      
      const hour = now.getHours();
      if (!profile.loginPattern.typicalLoginHours.includes(hour)) {
        profile.loginPattern.typicalLoginHours.push(hour);
      }
      
      if (profile.loginPattern.lastLoginTimes.length > 10) {
        profile.loginPattern.lastLoginTimes.shift();
      }
    }
    
    // Update access pattern
    if (activityData.endpoint) {
      const existingEndpoint = profile.accessPattern.endpoints.find(
        ep => ep.path === activityData.endpoint
      );
      
      if (existingEndpoint) {
        existingEndpoint.frequency += 1;
        existingEndpoint.lastAccessed = now;
      } else {
        profile.accessPattern.endpoints.push({
          path: activityData.endpoint,
          frequency: 1,
          lastAccessed: now
        });
      }
    }
    
    // Update geographic pattern
    if (activityData.location) {
      const existingLocation = profile.geographicPattern.locations.find(
        loc => loc.country === activityData.location.country && 
               loc.city === activityData.location.city
      );
      
      if (existingLocation) {
        existingLocation.frequency += 1;
      } else {
        profile.geographicPattern.locations.push({
          ip: activityData.ipAddress,
          country: activityData.location.country,
          city: activityData.location.city,
          coordinates: activityData.location.coordinates,
          frequency: 1
        });
      }
    }
    
    // Update device pattern
    if (activityData.deviceInfo) {
      const existingDevice = profile.devicePattern.devices.find(
        dev => dev.deviceId === activityData.deviceInfo.deviceId
      );
      
      if (existingDevice) {
        existingDevice.frequency += 1;
        existingDevice.lastUsed = now;
      } else {
        profile.devicePattern.devices.push({
          deviceId: activityData.deviceInfo.deviceId,
          deviceType: activityData.deviceInfo.deviceType,
          userAgent: activityData.userAgent,
          frequency: 1,
          lastUsed: now
        });
      }
      
      // Set primary device if not set
      if (!profile.devicePattern.primaryDevice) {
        profile.devicePattern.primaryDevice = activityData.deviceInfo.deviceId;
      }
    }
    
    // Update resource usage
    if (activityData.resourceUsage) {
      if (profile.resourceUsage.cpuUsage.length < 50) {
        profile.resourceUsage.cpuUsage.push(activityData.resourceUsage.cpu || 0);
      }
      if (profile.resourceUsage.memoryUsage.length < 50) {
        profile.resourceUsage.memoryUsage.push(activityData.resourceUsage.memory || 0);
      }
    }
    
    // Update risk score and signature
    profile.updateRiskScore();
    profile.generateSignature();
    
    await profile.save();
  }
  
  async createThreatEvents(accountId, userId, anomalies) {
    const threatEvents = anomalies.map(anomaly => ({
      accountId,
      userId,
      eventType: anomaly.type,
      severity: anomaly.severity,
      description: anomaly.description,
      detectedAt: new Date(),
      metadata: anomaly.metadata,
      status: 'pending'
    }));
    
    await ThreatEvent.bulkCreate(threatEvents);
  }
  
  async getThreats(userId, filters = {}) {
    const where = { userId };
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.severity) {
      where.severity = filters.severity;
    }
    
    if (filters.startDate || filters.endDate) {
      where.detectedAt = {};
      if (filters.startDate) where.detectedAt[Op.gte] = new Date(filters.startDate);
      if (filters.endDate) where.detectedAt[Op.lte] = new Date(filters.endDate);
    }
    
    const threats = await ThreatEvent.findAll({
      where,
      order: [['detectedAt', 'DESC']],
      limit: filters.limit || 50
    });
    
    return threats;
  }
  
  async getRiskScore(userId, accountId) {
    const profile = await BehavioralProfile.findOne({ 
      where: { userId, accountId } 
    });
    
    if (!profile) {
      return {
        riskScore: 0,
        threatLevel: 'low',
        profileExists: false
      };
    }
    
    return {
      riskScore: profile.riskScore,
      threatLevel: profile.threatLevel,
      profileExists: true,
      lastUpdated: profile.updatedAt
    };
  }
}

module.exports = new ThreatDetectionService();


