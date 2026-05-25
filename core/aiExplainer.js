/**
 * AIExplainer — Threat explanations via pluggable AI providers.
 */

const aiService = require('../services/aiService');

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

async function explainThreat(context) {
  const { anomalies = [], riskScore = 0, threatLevel = 'low', profile, activity } = context;

  if (anomalies.length === 0) {
    return buildFallbackExplanation(context);
  }

  const anomalyList = anomalies.map((a) =>
    `• [${a.severity.toUpperCase()}] ${a.type}: ${a.description}`
  ).join('\n');

  const profileSummary = profile ? `
- Request count: ${profile.requestCount}
- Known IPs: ${profile.knownIps?.size || 0}
- Failed logins: ${profile.failedAttempts || 0}` : 'No prior profile';

  const prompt = `Analyze this threat detection for a SOC analyst.

Risk: ${riskScore}/100 (${threatLevel})
Endpoint: ${activity?.endpoint || 'unknown'}
IP: ${activity?.ipAddress || 'unknown'}

ANOMALIES:
${anomalyList}

PROFILE: ${profileSummary}

Respond in JSON only:
{"explanation":"...","actions":["step1","step2","step3"]}`;

  try {
    const result = await aiService.completeWithFallback({ user: prompt, jsonMode: true, maxTokens: 1024 });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        explanation: parsed.explanation || '',
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        aiPowered: true,
        provider: result.provider,
        model: result.model,
      };
    }
    return {
      explanation: result.text,
      actions: [],
      aiPowered: true,
      provider: result.provider,
      model: result.model,
    };
  } catch (err) {
    console.warn('[AIExplainer] Fallback to rules:', err.message);
    return buildFallbackExplanation(context);
  }
}

function buildFallbackExplanation({ anomalies = [], riskScore = 0, threatLevel = 'low', activity }) {
  const types = anomalies.map((a) => a.type);
  const severest = anomalies.sort((a, b) =>
    (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
  )[0];

  let explanation = '';
  let actions = [];

  if (types.includes('sql_injection') || types.includes('sql_timebased')) {
    explanation = `SQL injection attempt on ${activity?.endpoint || 'an endpoint'}.`;
    actions = ['Block source IP', 'Review WAF rules', 'Audit DB query logs', 'Notify SOC lead'];
  } else if (types.includes('brute_force')) {
    explanation = `Brute-force pattern from ${activity?.ipAddress || 'unknown IP'}.`;
    actions = ['Rate-limit IP', 'Force MFA', 'Reset credentials if compromised'];
  } else if (severest) {
    explanation = `${severest.description}. Risk ${riskScore}/100 (${threatLevel}).`;
    actions = ['Investigate in Alert Queue', 'Correlate with hunt queries', 'Document in incident'];
  } else {
    explanation = `Behavioral anomaly detected. Risk score ${riskScore}.`;
    actions = ['Review alert details', 'Monitor entity profile'];
  }

  return { explanation, actions, aiPowered: false, provider: 'rules' };
}

module.exports = { explainThreat, buildFallbackExplanation };
