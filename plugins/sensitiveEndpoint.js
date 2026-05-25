/**
 * Built-in Plugin: Sensitive Endpoint Guard
 * Flags access to admin, debug, or sensitive routes.
 */

const SENSITIVE_PATTERNS = [
  { re: /\/(admin|administrator|wp-admin|manage|superuser)/i, label: 'admin_access', severity: 'high' },
  { re: /\/(debug|trace|env|config|settings\.json|\.env)/i,   label: 'debug_access',  severity: 'high' },
  { re: /\/(backup|dump|export|import)\//i,                    label: 'data_export',   severity: 'high' },
  { re: /\/(api\/internal|internal\/api)/i,                    label: 'internal_api',  severity: 'medium' },
  { re: /\/\.git|\/\.ssh|\/\.bash/i,                           label: 'file_probe',    severity: 'critical' },
  { re: /\/(passwd|shadow|hosts)\b/i,                          label: 'system_file',   severity: 'critical' },
];

module.exports = {
  name: 'sensitive-endpoint',
  version: '1.0.0',
  description: 'Flags access to admin, debug, and sensitive system paths',

  detect(activity, profile) {
    const endpoint = (activity.endpoint || activity.rawUrl || '').toLowerCase();
    if (!endpoint) return [];

    const signals = [];
    for (const { re, label, severity } of SENSITIVE_PATTERNS) {
      if (re.test(endpoint)) {
        signals.push({
          type: label,
          severity,
          description: `Access to sensitive endpoint: ${endpoint.slice(0, 100)}`,
          metadata: { endpoint },
          anomalyScore: severity === 'critical' ? 1.0 : 0.8,
        });
      }
    }
    return signals;
  }
};
