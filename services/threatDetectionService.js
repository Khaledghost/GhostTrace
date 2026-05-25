/**
 * ThreatDetectionService — Orchestrates profile management, anomaly detection,
 * AI explanation, and risk scoring.
 *
 * This service is the single entry-point for all threat analysis.
 * It is backend-agnostic and works with any framework via the protection middleware.
 */

const profileStore    = require('../core/profileStore');
const AnomalyEngine   = require('../core/anomalyEngine');
const { explainThreat } = require('../core/aiExplainer');
const { pluginRegistry } = require('../core/pluginRegistry');
const alertService    = require('./alertService');

const BLOCK_RISK_THRESHOLD = parseInt(process.env.BLOCK_RISK_THRESHOLD || '70', 10);

class ThreatDetectionService {
  constructor() {
    this._engine = new AnomalyEngine(pluginRegistry.getDetectors());
    // Keep engine's plugin list in sync when new plugins are registered
    pluginRegistry.on('register', () => {
      this._engine = new AnomalyEngine(pluginRegistry.getDetectors());
    });
  }

  /**
   * Full threat analysis pipeline:
   *   1. Resolve profile
   *   2. Run anomaly engine
   *   3. Apply risk scoring with decay
   *   4. Generate AI explanation for threats
   *   5. Update global stats
   *   6. Return analysis result
   *
   * @param {object} activity
   * @returns {Promise<AnalysisResult>}
   */
  async analyzeActivity(activity) {
    const key = this._resolveKey(activity);
    const profile = profileStore.getOrCreate(key);

    // Run detection BEFORE observing (so new signals aren't learned yet)
    const { anomalies, riskDelta } = this._engine.analyze(activity, profile);

    // Update profile with this activity
    profile.observe(activity);

    // Apply risk scoring
    this._engine.applyRisk(profile, riskDelta);

    // Global stats
    profileStore.globalStats.totalRequests++;

    const isThreat = anomalies.length > 0 || profile.riskScore >= 30;
    let explanation = null;

    if (isThreat && anomalies.length > 0) {
      profileStore.globalStats.totalThreats++;
      profileStore.recordGlobalThreat({
        type: anomalies[0]?.type,
        severity: anomalies[0]?.severity,
        ip: activity.ipAddress || key,
        key,
      });
      profile.recordThreat({
        anomalies: anomalies.map(a => a.type),
        riskScore: profile.riskScore,
        timestamp: new Date().toISOString(),
      });

      explainThreat({ anomalies, riskScore: profile.riskScore, threatLevel: profile.threatLevel, profile, activity })
        .then(async (exp) => {
          profile._lastExplanation = exp;
          await alertService.createFromDetection({
            activity: { ...activity, ipAddress: activity.ipAddress || key },
            anomalies,
            riskScore: profile.riskScore,
            profileKey: key,
            explanation: typeof exp === 'string' ? exp : exp?.summary || JSON.stringify(exp),
          });
        })
        .catch(async () => {
          await alertService.createFromDetection({
            activity: { ...activity, ipAddress: activity.ipAddress || key },
            anomalies,
            riskScore: profile.riskScore,
            profileKey: key,
          });
        });
    }

    await pluginRegistry.emit('afterAnalyze', { activity, anomalies, profile, isThreat });

    return {
      isThreat,
      anomalies,
      riskScore: profile.riskScore,
      threatLevel: profile.threatLevel,
      profileKey: key,
      requestCount: profile.requestCount,
      explanation: profile._lastExplanation || null,
    };
  }

  /**
   * Get AI explanation synchronously (awaits explainThreat).
   */
  async getExplanation(key, activity, anomalies) {
    const profile = profileStore.get(key);
    return explainThreat({
      anomalies: anomalies || [],
      riskScore: profile?.riskScore || 0,
      threatLevel: profile?.threatLevel || 'low',
      profile,
      activity,
    });
  }

  getRiskByKey(key) {
    const profile = profileStore.get(key);
    if (!profile) return { riskScore: 0, threatLevel: 'low', profileExists: false };
    return {
      riskScore: profile.riskScore,
      threatLevel: profile.threatLevel,
      requestCount: profile.requestCount,
      profileExists: true,
    };
  }

  getThreatsByKey(key, { limit = 50 } = {}) {
    const profile = profileStore.get(key);
    if (!profile) return [];
    return profile.threatHistory.slice(-limit).reverse();
  }

  getProfileByKey(key) {
    const profile = profileStore.get(key);
    return profile ? profile.toJSON() : null;
  }

  setSuspicious(key, level = 'high') {
    const profile = profileStore.getOrCreate(key);
    profile.riskScore = Math.max(profile.riskScore, this._levelToRisk(level));
    profile.threatLevel = this._engine._riskToLevel(profile.riskScore);
    profile.flaggedSuspicious = true;
  }

  clearSuspicious(key) {
    const profile = profileStore.get(key);
    if (profile) {
      profile.flaggedSuspicious = false;
      profile.riskScore = Math.max(0, profile.riskScore - 30);
      profile.threatLevel = this._engine._riskToLevel(profile.riskScore);
    }
  }

  getAllStats() {
    return profileStore.summaryJSON();
  }

  getPlugins() {
    return pluginRegistry.list();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  _resolveKey(activity) {
    // Priority: explicit identity → DNA fingerprint → IP
    if (activity.userId && activity.accountId) {
      return `${activity.accountId}::${activity.userId}`;
    }
    if (activity.deviceInfo?.fingerprint) return activity.deviceInfo.fingerprint;
    if (activity.deviceInfo?.behaviorSignature) return activity.deviceInfo.behaviorSignature;
    return activity.ipAddress || 'unknown';
  }

  _levelToRisk(level) {
    const map = { critical: 85, high: 70, medium: 40, low: 20 };
    return map[level] || 20;
  }
}

module.exports = new ThreatDetectionService();
