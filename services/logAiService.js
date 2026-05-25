const EventEmitter = require('events');
const aiService = require('./aiService');
const aiConfigService = require('./aiConfigService');

class LogAiService extends EventEmitter {
  constructor() {
    super();
    this._queue = [];
    this._processing = false;
    this._analyses = new Map();
  }

  async _hasProvider() {
    try {
      const def = await aiConfigService.getDefault();
      return !!def;
    } catch {
      return false;
    }
  }

  shouldAnalyze(log) {
    const settings = aiConfigService.getGlobalSettings();
    if (!settings.liveLogAnalysis) return false;

    const codes = settings.analyzeStatusCodes || [400, 401, 403, 404, 429, 500];
    const slowMs = settings.analyzeSlowMs || 2000;

    if (codes.includes(log.statusCode)) return true;
    if (log.responseTime >= slowMs) return true;
    if (log.path?.includes('admin') || log.path?.includes('api')) {
      if (log.statusCode >= 400) return true;
    }
    if (log.requestBody && /union|select|script|exec|\.\.\//i.test(log.requestBody)) return true;
    return false;
  }

  enqueue(log) {
    if (!this.shouldAnalyze(log)) return;
    if (this._analyses.has(log.id)) return;

    this._queue.push(log);
    this._drain().catch((err) => {
      console.warn('[LogAI]', err.message);
    });
  }

  async _drain() {
    if (this._processing || !this._queue.length) return;
    this._processing = true;

    while (this._queue.length) {
      const log = this._queue.shift();
      try {
        const analysis = await this.analyzeLog(log);
        this._analyses.set(log.id, analysis);
        log.aiAnalysis = analysis;
        this.emit('analyzed', { logId: log.id, analysis, log });
      } catch (err) {
        log.aiStatus = 'failed';
        log.aiAnalysis = { summary: 'AI unavailable', riskLevel: 'none', error: err.message, aiPowered: false };
        if (this.listenerCount('error') > 0) {
          this.emit('error', { logId: log.id, error: err.message });
        }
      }
    }

    this._processing = false;
  }

  async analyzeLog(log, { providerId, stream = false } = {}) {
    const prompt = `Analyze this HTTP request log entry for a SOC analyst.

METHOD: ${log.method}
PATH: ${log.path}
STATUS: ${log.statusCode}
RESPONSE TIME: ${log.responseTime}ms
IP: ${log.ip}
USER AGENT: ${log.userAgent || 'unknown'}
REQUEST BODY (truncated): ${log.requestBody || 'none'}

Respond in JSON:
{
  "summary": "2-3 sentence assessment",
  "riskLevel": "none|low|medium|high|critical",
  "threatTypes": ["type1"],
  "mitreTechniques": ["Txxxx"],
  "recommendedActions": ["action1"],
  "falsePositiveLikelihood": "low|medium|high"
}`;

    if (stream) {
      return { streaming: true, logId: log.id };
    }

    const result = await aiService.completeWithFallback({
      user: prompt,
      jsonMode: true,
      providerId,
      maxTokens: 1024,
    });

    let parsed = {};
    try {
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch (_) {
      parsed = { summary: result.text, riskLevel: 'medium', recommendedActions: [] };
    }

    return {
      ...parsed,
      aiPowered: true,
      provider: result.provider,
      model: result.model,
      analyzedAt: new Date().toISOString(),
    };
  }

  getAnalysis(logId) {
    return this._analyses.get(logId) || null;
  }

  async analyzeLogStream(log, res, { providerId } = {}) {
    const prompt = `Analyze this HTTP log briefly for SOC triage:
${log.method} ${log.path} → ${log.statusCode} (${log.responseTime}ms) from ${log.ip}
Body: ${(log.requestBody || '').slice(0, 300)}

Give: 1) Risk level 2) What happened 3) Recommended actions`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders?.();

    try {
      for await (const { chunk, provider, model } of aiService.streamWithFallback({
        user: prompt,
        providerId,
        maxTokens: 800,
      })) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', chunk, provider, model })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    }
    res.end();
  }
}

module.exports = new LogAiService();
