/**
 * AI Engine console — multi-provider config, live log AI, playground
 */
(() => {
'use strict';
const API = '/api';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

let logsLiveSSE = null;
let providerMeta = [];
let selectedLogId = null;

// ── Provider form ───────────────────────────────────────────────────────────
async function loadProviderMeta() {
  const { data } = await api('/ai/providers');
  providerMeta = data;
  const sel = document.getElementById('aic-provider');
  if (!sel) return;
  sel.innerHTML = data.map((p) =>
    `<option value="${p.id}">${esc(p.name)}</option>`
  ).join('');
  sel.onchange = () => {
    const p = providerMeta.find((x) => x.id === sel.value);
    if (p) {
      document.getElementById('aic-model').placeholder = p.defaultModel || '';
      document.getElementById('aic-base').placeholder = p.defaultBaseUrl || '';
    }
  };
  sel.dispatchEvent(new Event('change'));
}

async function loadAiConfigs() {
  const box = document.getElementById('aiConfigsList');
  if (!box) return;
  try {
    const { data } = await api('/ai/configs');
    box.innerHTML = data.length ? data.map((c) => `
      <div class="ai-provider-card">
        <div>
          <strong>${esc(c.name)}</strong>
          ${c.isDefault ? '<span class="badge" style="margin-left:6px">default</span>' : ''}
          <br><small style="color:var(--text-dim)">${esc(c.provider)} · ${esc(c.model || 'auto')} · ${c.hasApiKey ? 'key set' : 'no key'}</small>
        </div>
        <div>
          <button class="btn-xs" onclick="editAiConfig('${c.id}')">Edit</button>
          ${!String(c.id).startsWith('env-') ? `<button class="btn-xs btn-danger" onclick="deleteAiConfig('${c.id}')">Del</button>` : ''}
        </div>
      </div>
    `).join('') : '<p style="padding:12px;color:var(--text-dim)">No providers — add one or set env vars (OPENAI_API_KEY, etc.)</p>';
  } catch (e) {
    box.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
}

window.editAiConfig = async (id) => {
  const { data } = await api('/ai/configs');
  const c = data.find((x) => x.id === id);
  if (!c) return;
  document.getElementById('aic-name').value = c.name;
  document.getElementById('aic-provider').value = c.provider;
  document.getElementById('aic-model').value = c.model || '';
  document.getElementById('aic-base').value = c.baseUrl || '';
  document.getElementById('aic-default').checked = c.isDefault;
  document.getElementById('aic-enabled').checked = c.enabled;
  document.getElementById('aiConfigForm').dataset.editId = id;
};

window.deleteAiConfig = async (id) => {
  if (!confirm('Delete this AI provider?')) return;
  await api(`/ai/configs/${id}`, { method: 'DELETE' });
  loadAiConfigs();
};

document.getElementById('aiConfigForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = e.target.dataset.editId;
  const body = {
    id: editId,
    name: document.getElementById('aic-name').value,
    provider: document.getElementById('aic-provider').value,
    apiKey: document.getElementById('aic-key').value,
    baseUrl: document.getElementById('aic-base').value,
    model: document.getElementById('aic-model').value,
    isDefault: document.getElementById('aic-default').checked,
    enabled: document.getElementById('aic-enabled').checked,
    priority: 0,
  };
  if (editId) await api(`/ai/configs/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
  else await api('/ai/configs', { method: 'POST', body: JSON.stringify(body) });
  delete e.target.dataset.editId;
  document.getElementById('aic-key').value = '';
  loadAiConfigs();
  updateAiStatusBadge();
});

document.getElementById('aic-testBtn')?.addEventListener('click', async () => {
  const box = document.getElementById('aic-testResult');
  box.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
  try {
    const body = {
      provider: document.getElementById('aic-provider').value,
      apiKey: document.getElementById('aic-key').value,
      baseUrl: document.getElementById('aic-base').value,
      model: document.getElementById('aic-model').value,
    };
    const editId = document.getElementById('aiConfigForm').dataset.editId;
    const { data } = await api(`/ai/configs/${editId || 'new'}/test`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    box.innerHTML = data.ok
      ? `<span style="color:var(--green)">✓ Connected (${data.latencyMs}ms) — ${esc(data.sample)}</span>`
      : `<span style="color:var(--red)">✗ ${esc(data.error)}</span>`;
  } catch (e) {
    box.innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
  }
});

document.getElementById('aic-liveLogs')?.addEventListener('change', async (e) => {
  await api('/ai/settings', { method: 'PATCH', body: JSON.stringify({ liveLogAnalysis: e.target.checked }) });
});

document.getElementById('aic-slowMs')?.addEventListener('change', async (e) => {
  await api('/ai/settings', { method: 'PATCH', body: JSON.stringify({ analyzeSlowMs: parseInt(e.target.value, 10) }) });
});

document.getElementById('aic-playBtn')?.addEventListener('click', async () => {
  const prompt = document.getElementById('aic-playground').value;
  const out = document.getElementById('aic-playOut');
  out.textContent = 'Thinking...';
  try {
    const { data } = await api('/ai/complete', { method: 'POST', body: JSON.stringify({ prompt }) });
    out.textContent = `[${data.provider}/${data.model}]\n\n${data.text}`;
  } catch (e) {
    out.textContent = `Error: ${e.message}`;
  }
});

async function loadAiSettings() {
  try {
    const { data } = await api('/ai/settings');
    const live = document.getElementById('aic-liveLogs');
    if (live) live.checked = data.liveLogAnalysis !== false;
    const slow = document.getElementById('aic-slowMs');
    if (slow && data.analyzeSlowMs) slow.value = data.analyzeSlowMs;
  } catch (_) {}
}

// ── Live logs UI (override/enhance app loadLogs) ────────────────────────────
function renderLogRow(log) {
  const risk = log.aiAnalysis?.riskLevel || (log.aiStatus === 'queued' ? '…' : '—');
  const riskCls = log.aiAnalysis?.riskLevel || '';
  return `
    <div class="pb-table-row cols-logs-ai" data-log-id="${log.id}" style="cursor:pointer">
      <span class="mono">${esc(log.method)}</span>
      <span class="mono" style="overflow:hidden;text-overflow:ellipsis">${esc(log.path)}</span>
      <span class="mono" style="color:${log.statusCode>=400?'var(--red)':'var(--green)'}">${log.statusCode}</span>
      <span class="ai-log-risk ${riskCls}">${esc(risk)}</span>
      <span class="mono" style="font-size:10px">${new Date(log.timestamp).toLocaleTimeString()}</span>
    </div>
  `;
}

function showLogAiPanel(log) {
  const box = document.getElementById('logAiContent');
  if (!box) return;
  selectedLogId = log.id;

  if (log.aiStatus === 'queued') {
    box.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> AI analysis queued...</p>';
    return;
  }

  if (!log.aiAnalysis) {
    box.innerHTML = `
      <p style="font-size:12px;color:var(--text-dim)">No AI analysis yet.</p>
      <button class="btn-sm btn-accent" style="margin-top:10px" onclick="analyzeLogNow('${log.id}')">
        <i class="fas fa-robot"></i> Analyze now
      </button>
      <button class="btn-sm" style="margin-top:6px" onclick="streamLogAi('${log.id}')">
        <i class="fas fa-stream"></i> Stream live
      </button>`;
    return;
  }

  const a = log.aiAnalysis;
  box.innerHTML = `
    <div class="ai-insight-box">
      <span class="badge">${esc(a.provider || 'ai')}</span>
      <span class="ai-log-risk ${a.riskLevel}">${esc(a.riskLevel)} risk</span>
      <p style="margin-top:10px">${esc(a.summary || a.explanation || '')}</p>
      ${(a.threatTypes || []).length ? `<p><strong>Threats:</strong> ${a.threatTypes.join(', ')}</p>` : ''}
      ${(a.mitreTechniques || []).length ? `<p class="mono" style="font-size:11px">MITRE: ${a.mitreTechniques.join(', ')}</p>` : ''}
      ${(a.recommendedActions || []).length ? `<ul>${a.recommendedActions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </div>`;
}

window.analyzeLogNow = async (id) => {
  const box = document.getElementById('logAiContent');
  box.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Analyzing...</p>';
  try {
    const { data } = await api(`/logger/logs/${id}/analyze`, { method: 'POST', body: '{}' });
    const log = { id, aiAnalysis: data, aiStatus: 'complete' };
    showLogAiPanel(log);
    if (window.loadLogsEnhanced) window.loadLogsEnhanced();
  } catch (e) {
    box.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
};

window.streamLogAi = async (id) => {
  const box = document.getElementById('logAiContent');
  box.textContent = '';
  const es = new EventSource(`${API}/logger/logs/${id}/analyze?stream=true`);
  // Stream uses POST in our API - use fetch stream instead
  box.textContent = 'Starting stream...\n';
  try {
    const res = await fetch(`${API}/logger/logs/${id}/analyze?stream=true`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.chunk) box.textContent += d.chunk;
        } catch (_) {}
      }
    }
  } catch (e) {
    box.textContent = `Error: ${e.message}. Use "Analyze now" instead.`;
  }
};

window.loadLogsEnhanced = async function() {
  const el = document.getElementById('logsTable');
  if (!el) return;
  const method = document.getElementById('logMethodFilter')?.value;
  const aiOnly = document.getElementById('logAiFilter')?.value === 'aiOnly';
  const params = new URLSearchParams({ limit: 80 });
  if (method) params.set('method', method);
  if (aiOnly) params.set('aiOnly', 'true');

  try {
    const { data } = await api(`/logger/logs?${params}`);
    if (!data.length) {
      el.innerHTML = '<div class="empty-state"><p>No logs yet — make requests to the app</p></div>';
      return;
    }
    el.innerHTML = data.map(renderLogRow).join('');
    el.querySelectorAll('[data-log-id]').forEach((row) => {
      row.addEventListener('click', () => {
        const log = data.find((l) => l.id === row.dataset.logId);
        if (log) showLogAiPanel(log);
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
};

function startLogsLiveSSE() {
  if (logsLiveSSE) logsLiveSSE.close();
  logsLiveSSE = new EventSource(`${API}/logger/logs/live`);

  logsLiveSSE.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'log' || msg.type === 'ai') {
        if (window.currentPage === 'logs' || (typeof currentPage !== 'undefined' && currentPage === 'logs')) {
          window.loadLogsEnhanced?.();
        }
        if (msg.type === 'ai' && msg.log?.id === selectedLogId) {
          showLogAiPanel(msg.log);
        }
      }
    } catch (_) {}
  };

  logsLiveSSE.onerror = () => {
    const badge = document.getElementById('liveAiBadge');
    if (badge) badge.innerHTML = '<i class="fas fa-circle" style="color:var(--orange)"></i> Reconnecting';
  };
}

document.getElementById('analyzeBatchBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('analyzeBatchBtn');
  btn.disabled = true;
  try {
    await api('/logger/logs/analyze-batch', { method: 'POST', body: JSON.stringify({ limit: 15 }) });
    window.loadLogsEnhanced?.();
  } catch (e) { alert(e.message); }
  btn.disabled = false;
});

async function updateAiStatusBadge() {
  try {
    const { data } = await api('/ai/status');
    const el = document.getElementById('aiStatus');
    if (el) {
      el.textContent = data.configured
        ? `${data.defaultProvider?.provider || 'AI'} ready`
        : 'Rules only';
      el.style.color = data.configured ? 'var(--accent)' : 'var(--text-dim)';
    }
    const sidebarDot = document.getElementById('sidebarDot');
    if (sidebarDot && data.configured) sidebarDot.classList.add('green');
  } catch (_) {}
}

async function loadAiSettingsPage() {
  await loadProviderMeta();
  await loadAiConfigs();
  await loadAiSettings();
  updateAiStatusBadge();
}

function patchNavigateAi() {
  const orig = window.navigate;
  if (!orig || orig._aiPatched) return;
  window.navigate = function(page) {
    orig(page);
    if (page === 'ai-settings') loadAiSettingsPage();
    if (page === 'logs') {
      window.loadLogsEnhanced?.();
      startLogsLiveSSE();
    }
  };
  window.navigate._aiPatched = true;
}

// Override global loadLogs from app.js
window.loadLogs = window.loadLogsEnhanced;

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    patchNavigateAi();
    updateAiStatusBadge();
    startLogsLiveSSE();
  }, 700);
});

window.AI = { loadAiSettingsPage, loadLogsEnhanced, updateAiStatusBadge };
})();
