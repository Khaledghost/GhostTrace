/**
 * Built-in Plugin: User-Agent Anomaly Detector
 * Flags suspicious or headless browser user agents.
 */

module.exports = {
  name: 'ua-anomaly',
  version: '1.0.0',
  description: 'Detects suspicious or headless browser user agents',

  detect(activity, profile) {
    const ua = (activity.userAgent || '').toLowerCase();
    if (!ua) return [];

    const signals = [];

    // Headless browsers
    if (/headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver/i.test(ua)) {
      signals.push({
        type: 'headless_browser',
        severity: 'high',
        description: `Headless or automated browser detected: ${ua.slice(0, 80)}`,
        metadata: { userAgent: ua },
        anomalyScore: 0.92,
      });
    }

    // Known scanner user agents
    if (/sqlmap|nikto|nmap|masscan|nuclei|dirbuster|burpsuite|nessus|openvas|acunetix/i.test(ua)) {
      signals.push({
        type: 'security_scanner',
        severity: 'critical',
        description: `Known security scanner user agent: ${ua.slice(0, 80)}`,
        metadata: { userAgent: ua },
        anomalyScore: 1.0,
      });
    }

    // Empty or very short user agents
    if (ua.length < 10) {
      signals.push({
        type: 'missing_ua',
        severity: 'medium',
        description: 'Missing or minimal user agent string suggests automated tool',
        metadata: { userAgent: ua },
        anomalyScore: 0.65,
      });
    }

    return signals;
  }
};
