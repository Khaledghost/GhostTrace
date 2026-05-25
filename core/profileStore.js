/**
 * ProfileStore — Core behavioral profile store with sliding-window statistics.
 * Keyed by a stable identity (IP, DNA hash, or user+account pair).
 * Each profile maintains rolling statistics suitable for Z-score anomaly detection.
 */

const MAX_WINDOW = parseInt(process.env.PROFILE_WINDOW || '200', 10);
const TTL_MS = parseInt(process.env.PROFILE_TTL_MS || String(7 * 24 * 60 * 60 * 1000), 10); // 7 days default

class RollingStats {
  constructor(maxWindow = MAX_WINDOW) {
    this.maxWindow = maxWindow;
    this.values = [];
    this.sum = 0;
    this.sumSq = 0;
  }

  push(v) {
    if (typeof v !== 'number' || isNaN(v)) return;
    this.values.push(v);
    this.sum += v;
    this.sumSq += v * v;
    if (this.values.length > this.maxWindow) {
      const removed = this.values.shift();
      this.sum -= removed;
      this.sumSq -= removed * removed;
    }
  }

  get count() { return this.values.length; }
  get mean() { return this.count === 0 ? 0 : this.sum / this.count; }
  get variance() {
    if (this.count < 2) return 0;
    return Math.max(0, this.sumSq / this.count - this.mean ** 2);
  }
  get stddev() { return Math.sqrt(this.variance); }

  /** Z-score: how many standard deviations is v from the mean? */
  zscore(v) {
    const sd = this.stddev;
    if (sd === 0 || this.count < 3) return 0;
    return Math.abs(v - this.mean) / sd;
  }

  /** Returns true if value is anomalous at given sigma threshold */
  isAnomaly(v, sigma = 2.5) {
    return this.count >= 5 && this.zscore(v) > sigma;
  }

  toJSON() {
    return {
      count: this.count,
      mean: this.mean,
      stddev: this.stddev,
      last: this.values.slice(-5)
    };
  }
}

class BehavioralProfile {
  constructor(key) {
    this.key = key;
    this.createdAt = Date.now();
    this.lastSeen = Date.now();
    this.requestCount = 0;
    this.riskScore = 0;
    this.threatLevel = 'low';

    // Statistical windows
    this.stats = {
      responseTime:  new RollingStats(),
      requestSize:   new RollingStats(),
      hourOfDay:     new RollingStats(),
      interArrival:  new RollingStats(), // ms between consecutive requests
    };

    this._lastRequestTime = null;

    // Frequency maps (capped sets)
    this.knownIps        = new Set();
    this.knownEndpoints  = new Map(); // path → count
    this.knownMethods    = new Map();
    this.knownLocations  = new Set(); // "country:city"
    this.knownDevices    = new Set(); // device fingerprints
    this.knownHours      = new Set(); // 0-23
    this.failedAttempts  = 0;
    this.blockedAt       = null;

    // Metadata
    this.lastActivity    = null;
    this.threatHistory   = [];       // last N threat events
  }

  observe(activity) {
    const now = Date.now();
    this.lastSeen = now;
    this.requestCount++;

    // Inter-arrival time
    if (this._lastRequestTime !== null) {
      this.stats.interArrival.push(now - this._lastRequestTime);
    }
    this._lastRequestTime = now;

    // Hour of day
    const hour = new Date(activity.timestamp || now).getHours();
    this.stats.hourOfDay.push(hour);
    this.knownHours.add(hour);

    // Response / request sizes
    if (typeof activity.responseTime === 'number') {
      this.stats.responseTime.push(activity.responseTime);
    }
    if (typeof activity.requestSize === 'number') {
      this.stats.requestSize.push(activity.requestSize);
    }

    // Frequency maps
    if (activity.ipAddress) this.knownIps.add(activity.ipAddress);
    if (activity.endpoint) {
      this.knownEndpoints.set(
        activity.endpoint,
        (this.knownEndpoints.get(activity.endpoint) || 0) + 1
      );
    }
    if (activity.method) {
      this.knownMethods.set(
        activity.method,
        (this.knownMethods.get(activity.method) || 0) + 1
      );
    }
    if (activity.location) {
      const key = `${activity.location.country || '?'}:${activity.location.city || '?'}`;
      this.knownLocations.add(key);
    }
    if (activity.deviceInfo?.fingerprint || activity.deviceInfo?.deviceId) {
      this.knownDevices.add(activity.deviceInfo.fingerprint || activity.deviceInfo.deviceId);
    }

    if (activity.activityType === 'failed_login') this.failedAttempts++;

    this.lastActivity = activity;
  }

  recordThreat(event) {
    this.threatHistory.push(event);
    if (this.threatHistory.length > 50) this.threatHistory.shift();
  }

  isExpired() {
    return Date.now() - this.lastSeen > TTL_MS;
  }

  toJSON() {
    return {
      key: this.key,
      requestCount: this.requestCount,
      riskScore: this.riskScore,
      threatLevel: this.threatLevel,
      failedAttempts: this.failedAttempts,
      knownIpCount: this.knownIps.size,
      knownLocationCount: this.knownLocations.size,
      knownDeviceCount: this.knownDevices.size,
      knownEndpointCount: this.knownEndpoints.size,
      knownHours: [...this.knownHours].sort((a, b) => a - b),
      stats: {
        responseTime: this.stats.responseTime.toJSON(),
        interArrival: this.stats.interArrival.toJSON(),
        hourOfDay: this.stats.hourOfDay.toJSON(),
      },
      lastSeen: new Date(this.lastSeen).toISOString(),
      createdAt: new Date(this.createdAt).toISOString(),
      recentThreats: this.threatHistory.slice(-5),
    };
  }
}

class ProfileStore {
  constructor() {
    this._store = new Map();
    this._cleanupInterval = setInterval(() => this._cleanup(), 60 * 60 * 1000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();

    // Global stats counters
    this.globalStats = {
      totalRequests: 0,
      totalThreats: 0,
      totalBlocked: 0,
      anomalyBreakdown: {},
      threatTimeline: [], // last 100 threats with timestamps
    };
  }

  get(key) {
    return this._store.get(key) || null;
  }

  getOrCreate(key) {
    if (!this._store.has(key)) {
      this._store.set(key, new BehavioralProfile(key));
    }
    return this._store.get(key);
  }

  delete(key) {
    this._store.delete(key);
  }

  get size() {
    return this._store.size;
  }

  all() {
    return [...this._store.values()];
  }

  recordGlobalThreat(event) {
    this.globalStats.totalThreats++;
    const type = event.type || 'unknown';
    this.globalStats.anomalyBreakdown[type] = (this.globalStats.anomalyBreakdown[type] || 0) + 1;
    this.globalStats.threatTimeline.push({ ...event, ts: Date.now() });
    if (this.globalStats.threatTimeline.length > 100) {
      this.globalStats.threatTimeline.shift();
    }
  }

  _cleanup() {
    for (const [key, profile] of this._store) {
      if (profile.isExpired()) this._store.delete(key);
    }
  }

  summaryJSON() {
    const profiles = this.all();
    const criticalCount = profiles.filter(p => p.threatLevel === 'critical').length;
    const highCount = profiles.filter(p => p.threatLevel === 'high').length;

    return {
      totalProfiles: this.size,
      criticalProfiles: criticalCount,
      highProfiles: highCount,
      globalStats: {
        ...this.globalStats,
        threatTimeline: this.globalStats.threatTimeline.slice(-20),
      },
    };
  }
}

// Singleton export
module.exports = new ProfileStore();
