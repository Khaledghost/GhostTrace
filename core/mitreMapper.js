/**
 * Maps detection signals to MITRE ATT&CK tactics & techniques.
 * @see https://attack.mitre.org/
 */

const ANOMALY_MAP = {
  sql_injection:      { tactics: ['TA0001'], techniques: ['T1190'] },
  sql_timebased:      { tactics: ['TA0001'], techniques: ['T1190'] },
  sql_ddl:            { tactics: ['TA0040'], techniques: ['T1485'] },
  sql_comment:        { tactics: ['TA0001'], techniques: ['T1190'] },
  xss_attempt:        { tactics: ['TA0001'], techniques: ['T1189', 'T1059'] },
  path_traversal:     { tactics: ['TA0001'], techniques: ['T1190'] },
  lfi_attempt:        { tactics: ['TA0001'], techniques: ['T1190'] },
  code_exec:          { tactics: ['TA0002'], techniques: ['T1059'] },
  template_injection: { tactics: ['TA0001'], techniques: ['T1190'] },
  ssrf_hint:          { tactics: ['TA0001'], techniques: ['T1190'] },
  brute_force:        { tactics: ['TA0006'], techniques: ['T1110'] },
  velocity_burst:     { tactics: ['TA0040'], techniques: ['T1499'] },
  off_hours:          { tactics: ['TA0003'], techniques: ['T1078'] },
  new_ip:             { tactics: ['TA0003'], techniques: ['T1078'] },
  new_location:       { tactics: ['TA0003'], techniques: ['T1078'] },
  new_device:         { tactics: ['TA0003'], techniques: ['T1078'] },
  new_endpoint:       { tactics: ['TA0007'], techniques: ['T1083'] },
  sensitive_endpoint: { tactics: ['TA0007'], techniques: ['T1083'] },
  ua_anomaly:         { tactics: ['TA0005'], techniques: ['T1036'] },
  behavior_anomaly:   { tactics: ['TA0003'], techniques: ['T1078'] },
  access_anomaly:     { tactics: ['TA0007'], techniques: ['T1083'] },
};

const TACTIC_LABELS = {
  TA0001: 'Initial Access',
  TA0002: 'Execution',
  TA0003: 'Persistence',
  TA0004: 'Privilege Escalation',
  TA0005: 'Defense Evasion',
  TA0006: 'Credential Access',
  TA0007: 'Discovery',
  TA0008: 'Lateral Movement',
  TA0009: 'Collection',
  TA0010: 'Exfiltration',
  TA0011: 'Command and Control',
  TA0040: 'Impact',
};

function mapAnomalies(anomalies = []) {
  const tactics = new Set();
  const techniques = new Set();
  const labels = [];

  for (const a of anomalies) {
    const type = a.type || a.label || a;
    const map = ANOMALY_MAP[type] || { tactics: ['TA0003'], techniques: ['T1078'] };
    map.tactics.forEach((t) => tactics.add(t));
    map.techniques.forEach((t) => techniques.add(t));
    labels.push(type);
  }

  return {
    tactics: [...tactics],
    techniques: [...techniques],
    tacticLabels: [...tactics].map((t) => TACTIC_LABELS[t] || t),
    primaryTactic: [...tactics][0] || 'TA0003',
    anomalyTypes: labels,
  };
}

function coverageMatrix(alerts = []) {
  const matrix = {};
  for (const t of Object.keys(TACTIC_LABELS)) {
    matrix[t] = { label: TACTIC_LABELS[t], count: 0, techniques: {} };
  }
  for (const alert of alerts) {
    const tactics = alert.mitreTactics || [];
    const techniques = alert.mitreTechniques || [];
    for (const tactic of tactics) {
      if (!matrix[tactic]) matrix[tactic] = { label: TACTIC_LABELS[tactic] || tactic, count: 0, techniques: {} };
      matrix[tactic].count++;
      for (const tech of techniques) {
        matrix[tactic].techniques[tech] = (matrix[tactic].techniques[tech] || 0) + 1;
      }
    }
  }
  return matrix;
}

module.exports = { mapAnomalies, coverageMatrix, TACTIC_LABELS, ANOMALY_MAP };
