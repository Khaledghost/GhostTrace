/**
 * AnomalyEngine — Multi-signal statistical anomaly detection engine.
 *
 * Uses:
 *   - Z-score analysis on rolling windows (inter-arrival, response time, request size)
 *   - Frequency-based novelty detection (new location, device, endpoint, IP)
 *   - Temporal pattern analysis (hour-of-day deviation)
 *   - Signature-based detection (SQL injection, XSS, path traversal)
 *   - Velocity checks (burst detection)
 *   - Configurable plugin hooks
 *
 * Each detector returns an array of AnomalySignal objects.
 */

const SIGMA_THRESHOLD = parseFloat(process.env.SIGMA_THRESHOLD || '2.5');
const RISK_DECAY_FACTOR = parseFloat(process.env.RISK_DECAY || '0.98'); // per-request decay

// Severity → risk contribution
const SEVERITY_WEIGHTS = {
  info:     2,
  low:      8,
  medium:   18,
  high:     30,
  critical: 50,
};

// Known-bad patterns
const MALICIOUS_PATTERNS = [
  { re: /(\.\.\/)|(\.\.\\)/,          label: 'path_traversal',   severity: 'high'     },
  { re: /<script[\s>]/i,              label: 'xss_attempt',      severity: 'high'     },
  { re: /union\s+(all\s+)?select/i,   label: 'sql_injection',    severity: 'critical' },
  { re: /sleep\s*\(\s*\d+/i,          label: 'sql_timebased',    severity: 'critical' },
  { re: /\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d/i, label: 'sql_injection', severity: 'critical' },
  { re: /drop\s+table/i,              label: 'sql_ddl',          severity: 'critical' },
  { re: /;--\s*$/,                    label: 'sql_comment',      severity: 'high'     },
  { re: /\bexec\s*\(/i,               label: 'code_exec',        severity: 'critical' },
  { re: /\/etc\/passwd/i,             label: 'lfi_attempt',      severity: 'critical' },
  { re: /(\bcurl\b|\bwget\b)/i,       label: 'ssrf_hint',        severity: 'medium'   },
  { re: /\$\{.*\}/,                   label: 'template_injection',severity: 'high'    },
  { re: /\{\{.*\}\}/,                 label: 'template_injection',severity: 'high'    },
];

class AnomalyEngine {
  constructor(plugins = []) {
    this._plugins = plugins; // external detector plugins
  }

  /**
   * Analyze a single activity against a behavioral profile.
   * Returns { anomalies: AnomalySignal[], riskDelta: number }
   */
  analyze(activity, profile) {
    const anomalies = [];

    // 1. Signature-based detection (zero-day patterns)
    anomalies.push(...this._signatureCheck(activity));

    // 2. Statistical anomaly detection
    anomalies.push(...this._statisticalCheck(activity, profile));

    // 3. Novelty detection (new IP / location / device / endpoint)
    anomalies.push(...this._noveltyCheck(activity, profile));

    // 4. Temporal analysis
    anomalies.push(...this._temporalCheck(activity, profile));

    // 5. Velocity / burst detection
    anomalies.push(...this._velocityCheck(activity, profile));

    // 6. Failed login accumulation
    anomalies.push(...this._credentialCheck(activity, profile));

    // 7. Plugin-provided detectors
    for (const plugin of this._plugins) {
      try {
        const signals = plugin.detect(activity, profile);
        if (Array.isArray(signals)) anomalies.push(...signals);
      } catch (_) { /* never crash on plugin failure */ }
    }

    // Deduplicate by label
    const seen = new Set();
    const unique = anomalies.filter(a => {
      if (seen.has(a.type)) return false;
      seen.add(a.type);
      return true;
    });

    // Compound: multiple anomalies increase severity
    if (unique.length >= 3) {
      unique.push(this._signal('compound_anomaly', 'critical',
        `${unique.length} simultaneous anomaly signals detected`, { count: unique.length }, 1.0));
    }

    // Calculate risk delta
    const riskDelta = unique.reduce((sum, a) => sum + (SEVERITY_WEIGHTS[a.severity] || 0), 0);

    return { anomalies: unique, riskDelta };
  }

  // ─── Detectors ─────────────────────────────────────────────────────────────

  _signatureCheck(activity) {
    const signals = [];
    const targets = [
      activity.endpoint || '',
      activity.rawUrl || '',
      JSON.stringify(activity.query || {}),
      typeof activity.body === 'string' ? activity.body : JSON.stringify(activity.body || {}),
    ].join(' ').toLowerCase();

    for (const { re, label, severity } of MALICIOUS_PATTERNS) {
      if (re.test(targets)) {
        signals.push(this._signal(label, severity, `Malicious pattern detected: ${label}`, { pattern: label }, 1.0));
      }
    }
    return signals;
  }

  _statisticalCheck(activity, profile) {
    const signals = [];

    // Response time anomaly
    const rt = activity.responseTime;
    if (typeof rt === 'number') {
      const z = profile.stats.responseTime.zscore(rt);
      if (profile.stats.responseTime.isAnomaly(rt, SIGMA_THRESHOLD)) {
        signals.push(this._signal('response_time_spike', 'medium',
          `Response time ${rt}ms deviates ${z.toFixed(1)}σ from baseline (μ=${profile.stats.responseTime.mean.toFixed(0)}ms)`,
          { value: rt, zscore: z, mean: profile.stats.responseTime.mean }, z / 10));
      }
    }

    // Inter-arrival burst
    if (profile._lastRequestTime !== null) {
      const ia = Date.now() - (profile._lastRequestTime || Date.now());
      const z = profile.stats.interArrival.zscore(ia);
      if (profile.stats.interArrival.isAnomaly(ia, SIGMA_THRESHOLD + 0.5)) {
        signals.push(this._signal('request_burst', 'medium',
          `Unusually rapid requests: ${ia}ms gap (${z.toFixed(1)}σ below baseline)`,
          { interArrivalMs: ia, zscore: z }, Math.min(z / 10, 1)));
      }
    }

    return signals;
  }

  _noveltyCheck(activity, profile) {
    const signals = [];

    // New IP (only flag if profile has established history)
    if (activity.ipAddress && profile.requestCount > 10 && !profile.knownIps.has(activity.ipAddress)) {
      signals.push(this._signal('new_ip', 'medium',
        `Access from previously unseen IP: ${activity.ipAddress}`,
        { ip: activity.ipAddress, knownIps: profile.knownIps.size }, 0.7));
    }

    // New location
    if (activity.location) {
      const locKey = `${activity.location.country || '?'}:${activity.location.city || '?'}`;
      if (profile.requestCount > 5 && !profile.knownLocations.has(locKey)) {
        signals.push(this._signal('new_location', 'medium',
          `Access from new location: ${locKey}`,
          { location: locKey }, 0.75));
      }
    }

    // New device fingerprint
    if (activity.deviceInfo) {
      const devKey = activity.deviceInfo.fingerprint || activity.deviceInfo.deviceId;
      if (devKey && profile.requestCount > 5 && !profile.knownDevices.has(devKey)) {
        signals.push(this._signal('new_device', 'high',
          `Access from unrecognized device: ${activity.deviceInfo.deviceType || devKey}`,
          { device: devKey }, 0.85));
      }
    }

    return signals;
  }

  _temporalCheck(activity, profile) {
    const signals = [];
    const hour = new Date(activity.timestamp || Date.now()).getHours();

    if (profile.knownHours.size >= 5 && !profile.knownHours.has(hour)) {
      const hoursArray = [...profile.knownHours];
      signals.push(this._signal('off_hours_access', 'low',
        `Access at unusual hour: ${hour}:00 (typical: ${hoursArray.slice(0, 5).join(', ')}...)`,
        { hour, knownHours: hoursArray }, 0.5));
    }

    return signals;
  }

  _velocityCheck(activity, profile) {
    const signals = [];

    // If inter-arrival stats exist and current burst is extreme
    const ia = profile.stats.interArrival;
    if (ia.count >= 3 && ia.mean < 500 && ia.stddev < 200) {
      // Very uniform, extremely fast requests → likely automated
      signals.push(this._signal('automated_access', 'high',
        `Highly uniform rapid access pattern suggests automation (avg ${ia.mean.toFixed(0)}ms/req)`,
        { meanInterArrival: ia.mean, stddev: ia.stddev }, 0.9));
    }

    return signals;
  }

  _credentialCheck(activity, profile) {
    const signals = [];
    if (activity.activityType === 'failed_login') {
      const fails = profile.failedAttempts + 1;
      const threshold = parseInt(process.env.MAX_FAILED_ATTEMPTS || '5', 10);
      if (fails >= threshold) {
        signals.push(this._signal('brute_force', 'critical',
          `${fails} failed login attempts detected`,
          { failedAttempts: fails, threshold }, 1.0));
      } else if (fails >= 3) {
        signals.push(this._signal('repeated_failures', 'high',
          `${fails} consecutive failed logins`,
          { failedAttempts: fails }, 0.7));
      }
    }
    return signals;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _signal(type, severity, description, metadata = {}, anomalyScore = 0.5) {
    return {
      type,
      severity,
      description,
      metadata,
      anomalyScore,
      detectedAt: new Date().toISOString(),
    };
  }

  /** Register an external detector plugin at runtime */
  registerPlugin(plugin) {
    if (typeof plugin?.detect !== 'function') {
      throw new Error('Plugin must export a detect(activity, profile) function');
    }
    this._plugins.push(plugin);
  }

  /** Update risk score on profile with decay + new delta */
  applyRisk(profile, delta) {
    // Decay existing score slightly
    profile.riskScore = Math.round(profile.riskScore * RISK_DECAY_FACTOR);
    // Add new signals
    profile.riskScore = Math.min(100, profile.riskScore + delta);
    profile.threatLevel = this._riskToLevel(profile.riskScore);
  }

  _riskToLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }
}

module.exports = AnomalyEngine;
