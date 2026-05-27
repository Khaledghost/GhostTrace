const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { jsonType, enumType } = require('./dbTypes');

const BehavioralProfile = sequelize.define('BehavioralProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  accountId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  loginPattern: {
    type: jsonType(),
    defaultValue: {
      averageLoginTime: [],
      loginFrequency: 0,
      lastLoginTimes: [],
      typicalLoginHours: []
    }
  },
  accessPattern: {
    type: jsonType(),
    defaultValue: {
      endpoints: [],
      commonResources: [],
      averageSessionDuration: 0
    }
  },
  resourceUsage: {
    type: jsonType(),
    defaultValue: {
      cpuUsage: [],
      memoryUsage: [],
      networkActivity: [],
      typicalRequestSize: 0
    }
  },
  geographicPattern: {
    type: jsonType(),
    defaultValue: {
      locations: [],
      primaryLocation: '',
      allowedRegions: []
    }
  },
  devicePattern: {
    type: jsonType(),
    defaultValue: {
      devices: [],
      primaryDevice: ''
    }
  },
  behaviorSignature: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  riskScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  threatLevel: {
    type: enumType(['low', 'medium', 'high', 'critical']),
    defaultValue: 'low'
  }
}, {
  tableName: 'behavioral_profiles',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Instance method to update risk score
BehavioralProfile.prototype.updateRiskScore = function() {
  let riskScore = 0;
  
  // Analyze login pattern anomalies
  if (this.loginPattern.lastLoginTimes && this.loginPattern.lastLoginTimes.length > 0) {
    const recentLogins = this.loginPattern.lastLoginTimes.slice(-5);
    if (recentLogins.length > 0) {
      const avgLoginTime = recentLogins.reduce((sum, time) => {
        const date = new Date(time);
        return sum + date.getTime();
      }, 0) / recentLogins.length;
      
      const deviations = recentLogins.filter(time => {
        const timeValue = new Date(time).getTime();
        return Math.abs(timeValue - avgLoginTime) > avgLoginTime * 0.3;
      });
      riskScore += deviations.length * 5;
    }
  }
  
  // Location-based risk
  if (this.geographicPattern.locations) {
    const unusualLocations = this.geographicPattern.locations.filter(
      loc => loc.frequency < this.geographicPattern.locations.length * 0.1
    );
    riskScore += unusualLocations.length * 10;
  }
  
  // Device-based risk
  if (this.devicePattern.devices) {
    const primaryDeviceId = this.devicePattern.primaryDevice || '';
    const newDevices = this.devicePattern.devices.filter(
      dev => !primaryDeviceId.includes(dev.deviceId)
    );
    riskScore += newDevices.length * 8;
  }
  
  this.riskScore = Math.min(riskScore, 100);
  
  // Set threat level based on risk score
  if (this.riskScore >= 80) {
    this.threatLevel = 'critical';
  } else if (this.riskScore >= 50) {
    this.threatLevel = 'high';
  } else if (this.riskScore >= 25) {
    this.threatLevel = 'medium';
  } else {
    this.threatLevel = 'low';
  }
  
  return this.riskScore;
};

// Instance method to generate signature
BehavioralProfile.prototype.generateSignature = function() {
  const signatureData = {
    loginPattern: this.loginPattern.averageLoginTime || [],
    accessPattern: this.accessPattern.endpoints ? this.accessPattern.endpoints.length : 0,
    resourceUsage: this.resourceUsage.typicalRequestSize || 0,
    geographicPattern: this.geographicPattern.locations ? this.geographicPattern.locations.length : 0,
    devicePattern: this.devicePattern.devices ? this.devicePattern.devices.length : 0
  };
  
  this.behaviorSignature = JSON.stringify(signatureData);
  return this.behaviorSignature;
};

module.exports = BehavioralProfile;
