/**
 * BehavioralDNA SOC Console — MDR operations UI
 */
(() => {
'use strict';

const API = '/api';
let socSSE = null;

const SEV_CLASS = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low', info: 'badge-low' };

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

function fmtTime(d) {
  return d ? new Date(d).toLocaleString() : '—';
}

// ── Extend navigation from app.js ─────────────────────────────────────────
const SOC_PAGES = {
  alerts: 'Alert Queue',
  incidents: 'Incidents',
  hunt: 'Threat Hunt',
  mitre: 'MITRE ATT&CK',
  integrations: 'Integrations',
  audit: 'Audit Trail',
  'ai-settings': 'AI Engine',
};

function socNavigate(page) {
  if (page === 'alerts') loadAlerts();
  if (page === 'incidents') loadIncidents();
  if (page === 'hunt') loadHuntIocs();
  if (page === 'mitre') loadMitre();
  if (page === 'integrations') loadIntegrations();
  if (page === 'audit') loadAudit();
  if (page === 'dashboard') {
    if (window.loadDashboard) window.loadDashboard();
    else loadCommandCenter();
  }
}

function patchNavigate() {
  const orig = window.navigate;
  if (!orig || orig._socPatched) return;
  window.navigate = function(page) {
    orig(page);
    socNavigate(page);
  };
  window.navigate._socPatched = true;
}

// ── Command Center enhancements ───────────────────────────────────────────
async function loadCommandCenter() {
  const main = window.loadCommandCenter;
  if (main && main !== loadCommandCenter) return main();
  try {
    const fetcher = window.apiFetch || api;
    const { data } = await fetcher('/api/soc/command-center');
    const k = data.kpis || {};
    const det = data.detectionStats || {};
    setSocKpi('kpiProfiles', k.activeProfiles ?? det.totalProfiles);
    setSocKpi('kpiThreats', k.totalThreats ?? det.globalStats?.totalThreats);
    setSocKpi('kpiCritical', k.criticalProfiles ?? det.criticalProfiles);
    setSocKpi('kpiRequests', k.requestsAnalyzed ?? det.globalStats?.totalRequests);
    if (document.getElementById('alertBadge')) {
      document.getElementById('alertBadge').textContent = k.openAlerts || 0;
    }
    if (window.renderDashboardAlerts) {
      window.renderDashboardAlerts(data.recentAlerts || []);
    } else {
      renderRecentSocAlerts(data.recentAlerts || []);
    }
  } catch (e) {
    console.warn('Command center:', e.message);
  }
}

function setSocKpi(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? 0;
}

function renderRecentSocAlerts(alerts) {
  const box = document.getElementById('recentThreats');
  if (!box) return;
  if (!alerts.length) {
    box.innerHTML = '<div class="empty-state" style="padding:10px"><p>No alerts yet — trigger a test in AI Triage</p></div>';
    return;
  }
  box.innerHTML = alerts.slice(0, 6).map((a) => `
    <div class="threat-row" style="cursor:pointer" onclick="openAlertDrawer('${a.id}')">
      <span class="badge ${SEV_CLASS[a.severity] || ''}">${esc(a.severity)}</span>
      <span style="flex:1;font-size:12px">${esc(a.title)}</span>
      <span class="mono" style="font-size:10px;color:var(--text-dim)">${fmtTime(a.detectedAt)}</span>
    </div>
  `).join('');
}

// ── Alerts ──────────────────────────────────────────────────────────────────
async function loadAlerts() {
  const status = document.getElementById('alertStatusFilter')?.value;
  const severity = document.getElementById('alertSeverityFilter')?.value;
  const q = document.getElementById('alertSearch')?.value;
  const params = new URLSearchParams({ limit: 100 });
  if (status) params.set('status', status);
  if (severity) params.set('severity', severity);
  if (q) params.set('q', q);

  const table = document.getElementById('alertsTable');
  if (!table) return;
  table.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';

  try {
    const { items } = await api(`/alerts?${params}`);
    if (!items.length) {
      table.innerHTML = '<div class="empty-state"><p>No alerts match filters</p></div>';
      return;
    }
    table.innerHTML = items.map((a) => `
      <div class="pb-table-row cols-alerts" onclick="openAlertDrawer('${a.id}')">
        <span class="mono">${fmtTime(a.detectedAt)}</span>
        <span><span class="badge ${SEV_CLASS[a.severity]}">${esc(a.severity)}</span></span>
        <span><strong>${esc(a.title)}</strong><br><small style="color:var(--text-dim)">${esc(a.ipAddress || a.profileKey || '')}</small></span>
        <span class="mono" style="font-size:10px">${(a.mitreTechniques || []).slice(0,2).join(', ')}</span>
        <span>${esc(a.status)}</span>
        <span class="alert-actions" onclick="event.stopPropagation()">
          ${a.status === 'new' ? `<button class="btn-xs" onclick="ackAlert('${a.id}')">Ack</button>` : ''}
          <button class="btn-xs btn-danger" onclick="resolveAlert('${a.id}')">Resolve</button>
        </span>
      </div>
    `).join('');
    document.getElementById('alertBadge').textContent = items.filter((i) => ['new','acknowledged','investigating'].includes(i.status)).length;
  } catch (e) {
    table.innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p></div>`;
  }
}

window.ackAlert = async (id) => {
  await api(`/alerts/${id}/acknowledge`, { method: 'POST' });
  loadAlerts();
};

window.resolveAlert = async (id) => {
  const notes = prompt('Resolution notes (optional):') || '';
  await api(`/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes }) });
  loadAlerts();
};

window.openAlertDrawer = async (id) => {
  try {
    const { data: a } = await api(`/alerts/${id}`);
    const drawer = document.getElementById('pbDrawer');
    const backdrop = document.getElementById('pbDrawerBackdrop');
    document.getElementById('pbDrawerTitle').innerHTML = `<i class="fas fa-bell"></i> Alert ${esc(a.id?.slice(0,8))}`;
    document.getElementById('pbDrawerContent').innerHTML = `
      <div class="field-box"><div class="field-label">Title</div><div class="field-value">${esc(a.title)}</div></div>
      <div class="field-box"><div class="field-label">Severity / Status</div>
        <span class="badge ${SEV_CLASS[a.severity]}">${esc(a.severity)}</span>
        <span class="badge">${esc(a.status)}</span></div>
      <div class="field-box"><div class="field-label">MITRE</div>
        <div class="field-value mono">${(a.mitreTactics||[]).join(', ')} → ${(a.mitreTechniques||[]).join(', ')}</div></div>
      <div class="field-box"><div class="field-label">Risk Score</div><div class="field-value">${a.riskScore}/100</div></div>
      <div class="field-box"><div class="field-label">Anomalies</div><div class="field-value">${(a.anomalyTypes||[]).join(', ')}</div></div>
      ${a.aiExplanation ? `<div class="field-box"><div class="field-label">AI Triage</div><div class="field-value" style="font-size:12px">${esc(a.aiExplanation)}</div></div>` : ''}
      <div class="field-box"><div class="field-label">Raw Activity</div>
        <pre class="mono" style="font-size:10px;max-height:120px;overflow:auto">${esc(JSON.stringify(a.rawActivity,null,2))}</pre></div>
      <button class="btn-primary" style="margin-top:12px" onclick="createIncidentFromAlert('${a.id}')">Escalate to Incident</button>
    `;
    drawer?.classList.add('open');
    backdrop?.classList.add('open');
  } catch (e) { alert(e.message); }
};

window.createIncidentFromAlert = async (alertId) => {
  const title = prompt('Incident title:', 'Security incident from alert');
  if (!title) return;
  await api('/incidents', { method: 'POST', body: JSON.stringify({ title, alertIds: [alertId], severity: 'high' }) });
  navigate('incidents');
};

// ── Incidents ───────────────────────────────────────────────────────────────
async function loadIncidents() {
  const grid = document.getElementById('incidentsGrid');
  if (!grid) return;
  const status = document.getElementById('incidentStatusFilter')?.value;
  const params = status ? `?status=${status}` : '';
  try {
    const { items } = await api(`/incidents${params}`);
    grid.innerHTML = items.length ? items.map((i) => `
      <div class="incident-card" onclick="openIncidentDrawer('${i.id}')">
        <div style="display:flex;justify-content:space-between">
          <span class="badge ${SEV_CLASS[i.severity]}">${esc(i.severity)}</span>
          <span style="font-size:11px;color:var(--text-dim)">P${i.priority}</span>
        </div>
        <h3>${esc(i.title)}</h3>
        <p style="font-size:12px;color:var(--text-dim)">${esc(i.summary || 'No summary')}</p>
        <div style="margin-top:10px;font-size:11px">
          <span class="badge">${esc(i.status)}</span>
          <span style="margin-left:8px">${i.alertCount || 0} alerts</span>
        </div>
      </div>
    `).join('') : '<div class="empty-state"><p>No incidents — escalate from Alert Queue</p></div>';
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

window.openIncidentDrawer = async (id) => {
  const { data: i } = await api(`/incidents/${id}`);
  document.getElementById('pbDrawerTitle').innerHTML = `<i class="fas fa-file-medical"></i> ${esc(i.title)}`;
  document.getElementById('pbDrawerContent').innerHTML = `
    <div class="field-box"><div class="field-label">Status</div>
      <select id="incStatus" onchange="updateIncident('${i.id}', this.value)">
        ${['open','investigating','contained','resolved','closed'].map((s) =>
          `<option value="${s}" ${i.status===s?'selected':''}>${s}</option>`).join('')}
      </select></div>
    <div class="field-box"><div class="field-label">Timeline</div>
      ${(i.timeline||[]).slice(-8).reverse().map((t) =>
        `<div style="font-size:11px;margin-bottom:4px"><span class="mono">${fmtTime(t.at)}</span> ${esc(t.message)}</div>`).join('') || '<p>No events</p>'}
    </div>
    <div class="field-box"><div class="field-label">Linked Alerts (${(i.alerts||[]).length})</div>
      ${(i.alerts||[]).map((a) => `<div style="font-size:11px">• ${esc(a.title)} (${esc(a.severity)})</div>`).join('') || 'None'}
    </div>
  `;
  document.getElementById('pbDrawer')?.classList.add('open');
  document.getElementById('pbDrawerBackdrop')?.classList.add('open');
};

window.updateIncident = async (id, status) => {
  await api(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  loadIncidents();
};

document.getElementById('newIncidentBtn')?.addEventListener('click', async () => {
  const title = prompt('Incident title:');
  if (!title) return;
  await api('/incidents', { method: 'POST', body: JSON.stringify({ title, severity: 'medium' }) });
  loadIncidents();
});

// ── Hunt ────────────────────────────────────────────────────────────────────
document.getElementById('huntRunBtn')?.addEventListener('click', async () => {
  const body = {
    q: document.getElementById('huntQ')?.value,
    ip: document.getElementById('huntIp')?.value,
    mitreTechnique: document.getElementById('huntMitre')?.value,
    severity: document.getElementById('huntSeverity')?.value,
  };
  const box = document.getElementById('huntResults');
  box.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
  try {
    const { data } = await api('/hunt/query', { method: 'POST', body: JSON.stringify(body) });
    const alerts = data.alerts || [];
    box.innerHTML = alerts.length ? alerts.map((a) => `
      <div class="pb-table-row" style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer" onclick="openAlertDrawer('${a.id}')">
        <span class="badge ${SEV_CLASS[a.severity]}">${esc(a.severity)}</span>
        <strong style="margin-left:8px">${esc(a.title)}</strong>
        <span style="float:right;font-size:11px;color:var(--text-dim)">${fmtTime(a.detectedAt)}</span>
      </div>
    `).join('') : '<div class="empty-state"><p>No hunt results</p></div>';
  } catch (e) {
    box.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
});

async function loadHuntIocs() {
  const box = document.getElementById('huntIocs');
  if (!box) return;
  try {
    const { data } = await api('/hunt/iocs');
    const ips = (data.topIps || []).map(([ip, c]) => `<span class="ioc-chip">${esc(ip)} (${c})</span>`).join('');
    const techs = (data.topTechniques || []).map(([t, c]) => `<span class="ioc-chip">${esc(t)} (${c})</span>`).join('');
    box.innerHTML = `<div><strong>IPs</strong><br>${ips || '—'}</div><div style="margin-top:10px"><strong>MITRE Techniques</strong><br>${techs || '—'}</div>`;
  } catch (_) {}
}

// ── MITRE ───────────────────────────────────────────────────────────────────
async function loadMitre() {
  const box = document.getElementById('mitreMatrix');
  if (!box) return;
  try {
    const { data } = await api('/soc/command-center');
    const matrix = data.mitreCoverage || {};
    box.innerHTML = Object.entries(matrix).map(([id, m]) => `
      <div class="mitre-tactic">
        <h4>${esc(m.label || id)}</h4>
        <div class="count">${m.count || 0}</div>
        <small style="color:var(--text-dim)">${Object.keys(m.techniques || {}).length} techniques</small>
      </div>
    `).join('') || '<div class="empty-state"><p>Run detections to populate MITRE coverage</p></div>';
  } catch (e) {
    box.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

// ── Policies (backend) ────────────────────────────────────────────────────────
window.loadPolicies = async function loadPoliciesBackend() {
  const grid = document.getElementById('policiesGrid');
  if (!grid) return;
  try {
    const { data } = await api('/policies');
    grid.innerHTML = data.map((p) => `
      <div class="pb-table-row" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr;display:grid;gap:16px;padding:12px 16px">
        <span><strong>${esc(p.name)}</strong><br><small>${esc(p.description || '')}</small></span>
        <span>risk ≥ ${p.riskBlockThreshold}</span>
        <span>${p.rateLimitPerWindow}/min</span>
        <span>${p.blockOnThreat ? 'Block' : 'Observe'}</span>
        <span><span class="badge ${p.enabled ? 'badge-low' : ''}">${p.enabled ? 'Active' : 'Disabled'}</span></span>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
};

// ── Integrations & Audit ──────────────────────────────────────────────────────
async function loadIntegrations() {
  const box = document.getElementById('webhooksList');
  if (!box) return;
  try {
    const { data } = await api('/integrations/webhooks');
    box.innerHTML = data.length ? data.map((w) => `
      <div class="card" style="padding:12px;margin-bottom:8px"><strong>${esc(w.name)}</strong><br>
      <code class="mono" style="font-size:11px">${esc(w.url)}</code></div>
    `).join('') : '<p style="color:var(--text-dim);padding:12px">No webhooks registered</p>';
  } catch (_) {}
}

document.getElementById('registerWhBtn')?.addEventListener('click', async () => {
  const url = document.getElementById('whUrl')?.value;
  if (!url) return;
  await api('/integrations/webhooks', { method: 'POST', body: JSON.stringify({ name: 'SIEM Webhook', url }) });
  loadIntegrations();
});

async function loadAudit() {
  const table = document.getElementById('auditTable');
  if (!table) return;
  try {
    const { items } = await api('/audit?limit=100');
    table.innerHTML = items.length ? items.map((l) => `
      <div class="pb-table-row cols-audit">
        <span class="mono">${fmtTime(l.createdAt)}</span>
        <span>${esc(l.actor)}</span>
        <span>${esc(l.action)}</span>
        <span class="mono">${esc(l.resourceType)} ${esc(l.resourceId || '')}</span>
      </div>
    `).join('') : '<div class="empty-state"><p>No audit entries</p></div>';
  } catch (e) {
    table.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

// ── Fix legacy threat resolve → alerts API ────────────────────────────────────
window.resolveThreatEvent = async function(id) {
  try {
    await api(`/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes: 'Resolved from telemetry view' }) });
    if (window.loadThreats) window.loadThreats();
    loadAlerts();
  } catch (e) { alert(e.message); }
};

// ── SOC SSE (command center + alerts) ─────────────────────────────────────────
function startSocSSE() {
  if (socSSE) socSSE.close();
  socSSE = new EventSource(`${API}/soc/feed`);
  socSSE.onmessage = (e) => {
    try {
      const { command } = JSON.parse(e.data);
      if (command?.kpis && document.getElementById('alertBadge')) {
        document.getElementById('alertBadge').textContent = command.kpis.openAlerts || 0;
      }
      if (currentPage === 'dashboard') renderRecentSocAlerts(command?.recentAlerts || []);
      if (currentPage === 'mitre') loadMitre();
    } catch (_) {}
  };
}

// ── Event bindings ────────────────────────────────────────────────────────────
document.getElementById('refreshAlertsBtn')?.addEventListener('click', loadAlerts);
document.getElementById('alertStatusFilter')?.addEventListener('change', loadAlerts);
document.getElementById('alertSeverityFilter')?.addEventListener('change', loadAlerts);
document.getElementById('incidentStatusFilter')?.addEventListener('change', loadIncidents);

// Patch app.js titles
const titles = {
  dashboard: 'Overview', threats: 'Live Telemetry', profiles: 'Behavioral Profiles',
  analyze: 'AI Triage', logs: 'Request Logs', sources: 'Data Sources', policies: 'Policies',
  alerts: 'Alert Queue', incidents: 'Incidents', hunt: 'Threat Hunt', mitre: 'MITRE ATT&CK',
  integrations: 'Integrations', audit: 'Audit Trail',
};

document.addEventListener('DOMContentLoaded', () => {
  patchNavigate();
  startSocSSE();
});

// Expose for app.js integration
window.SOC = { loadAlerts, loadIncidents, loadCommandCenter, loadMitre, titles };
})();
