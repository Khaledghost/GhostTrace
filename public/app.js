(() => {
'use strict';
const API = '/api';

// ── State ─────────────────────────────────────────────────────────────────
let currentPage = 'dashboard';
let threatFeedItems = [];
let timelineData = { labels: [], critical: [], high: [], medium: [] };
let timelineChart = null;
let anomalyChart = null;
let sseSource = null;

// ── GhostTrace theme (dark / light) ───────────────────────────────────────
function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyThemePreset(preset) {
  const theme = preset === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme_preset', theme);
  updateThemeToggleUi(theme);
  window.Globe?.redraw?.();
}

function updateThemeToggleUi(theme) {
  const iconClass = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  const title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  const topbarIcon = document.getElementById('topbarThemeIcon');
  if (topbarIcon) topbarIcon.className = iconClass;
  const topbar = document.getElementById('topbarThemeBtn');
  if (topbar) topbar.title = title;
}

function toggleTheme() {
  applyThemePreset(getTheme() === 'light' ? 'dark' : 'light');
}

let themeControlsBound = false;

function initTheme() {
  const saved = localStorage.getItem('theme_preset') || 'dark';
  applyThemePreset(saved);
  if (themeControlsBound) return;
  themeControlsBound = true;

  document.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-theme-pick]');
    if (pick) {
      e.preventDefault();
      e.stopPropagation();
      applyThemePreset(pick.dataset.themePick);
      return;
    }
    const toggle = e.target.closest('#topbarThemeBtn');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme();
    }
  });

}

window.setThemePreset = applyThemePreset;
window.toggleTheme = toggleTheme;

// ── Navigation ────────────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.getElementById(`nav-${page}`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  
  const titles = window.SOC?.titles || {
    dashboard:'Overview', threats:'Reports', profiles:'Profiles',
    analyze:'AI Triage', logs:'Request Logs', routes:'Route Monitor', sources:'Data Sources', policies:'Security Policies',
    alerts:'Alert Queue', incidents:'Incidents', hunt:'Threat Hunt', mitre:'MITRE ATT&CK',
    integrations:'Integrations', audit:'Audit Trail', users:'Team', globe:'Global Traffic',
  };
  document.getElementById('topbarTitle').textContent = titles[page] || page;
  
  currentPage = page;
  if (page === 'dashboard') loadDashboard();
  else if (page === 'threats') loadThreats();
  else if (page === 'profiles') loadProfiles();
  else if (page === 'logs') loadLogs();
  else if (page === 'sources' && window._loadSources) window._loadSources();
  else if (page === 'policies' && window.loadPolicies) window.loadPolicies();
  else if (page === 'alerts' && window.SOC?.loadAlerts) window.SOC.loadAlerts();
  else if (page === 'incidents' && window.SOC?.loadIncidents) window.SOC.loadIncidents();
  else if (page === 'mitre' && window.SOC?.loadMitre) window.SOC.loadMitre();
  else if (page === 'ai-settings' && window.AI?.loadAiSettingsPage) window.AI.loadAiSettingsPage();
  else if (page === 'users') loadUsers();
  else if (page === 'globe') {
    window.Globe?.activate?.();
  }
}

function bindStaticControls() {
  document.querySelectorAll('.nav-item[data-section]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); navigate(el.dataset.section); });
  });
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    if (currentPage === 'dashboard') loadDashboard();
    else if (currentPage === 'threats') loadThreats();
    else if (currentPage === 'profiles') loadProfiles();
    else if (currentPage === 'logs') loadLogs();
    else if (currentPage === 'policies' && window.loadPolicies) window.loadPolicies();
    else if (currentPage === 'sources' && window._loadSources) window._loadSources();
  });
}

// ── SSE Feed ──────────────────────────────────────────────────────────────
function startSSE() {
  if (sseSource) sseSource.close();
  sseSource = new EventSource(`${API}/threats/feed`);
  sseSource.onmessage = e => {
    try {
      const data = JSON.parse(e.data);
      updateKPIs(data);
      updateTimeline(data);
      updateSidebarStatus(true);
    } catch (_) {}
  };
  sseSource.onerror = () => updateSidebarStatus(false);
}

// ── KPIs ──────────────────────────────────────────────────────────────────
function updateKPIs(data) {
  setText('kpiProfiles', fmt(data.totalProfiles));
  setText('kpiThreats', fmt(data.globalStats?.totalThreats));
  setText('kpiCritical', fmt(data.criticalProfiles));
  setText('kpiRequests', fmt(data.globalStats?.totalRequests));
  setText('threatBadge', data.globalStats?.totalThreats || 0);
}

function updateTimeline(data) {
  const timeline = data.globalStats?.threatTimeline || [];
  const counts = { critical: 0, high: 0, medium: 0 };
  timeline.forEach(t => {
    if (counts[t.severity] !== undefined) counts[t.severity]++;
  });
  const label = new Date().toLocaleTimeString();
  timelineData.labels.push(label);
  timelineData.critical.push(counts.critical);
  timelineData.high.push(counts.high);
  timelineData.medium.push(counts.medium);
  if (timelineData.labels.length > 15) {
    ['labels','critical','high','medium'].forEach(k => timelineData[k].shift());
  }
  if (timelineChart) timelineChart.update('none');

  // Anomaly breakdown
  if (anomalyChart && data.globalStats?.anomalyBreakdown) {
    const bd = data.globalStats.anomalyBreakdown;
    anomalyChart.data.labels = Object.keys(bd).map(k => k.replace(/_/g,' '));
    anomalyChart.data.datasets[0].data = Object.values(bd);
    anomalyChart.update('none');
  }
}

// ── Dashboard / Command Center ────────────────────────────────────────────
async function loadClientTelemetry() {
  const dnaEl = document.getElementById('dnaDisplay');
  if (dnaEl && !dnaEl.dataset.loaded) {
    dnaEl.innerHTML = '<div class="empty-state" style="padding:20px"><i class="fas fa-spinner fa-spin"></i><p>Computing client DNA fingerprint...</p></div>';
  }
  await loadDNA();
  if (dnaEl) dnaEl.dataset.loaded = '1';
}

async function loadDashboard() {
  loadClientTelemetry();
  await loadCommandCenter();
}

async function loadCommandCenter() {
  const dash = document.getElementById('page-dashboard');
  if (dash) {
    const loading = dash.querySelector('#recentThreats');
    if (loading) loading.innerHTML = '<div class="empty-state" style="padding:10px"><i class="fas fa-spinner fa-spin"></i> Loading command center...</div>';
  }

  try {
    const fetcher = window.apiFetch || defaultApiFetch;
    const res = await fetcher('/api/soc/command-center');
    const data = res.data;
    if (!data) return;

    const k = data.kpis || {};
    const det = data.detectionStats || {};

    setText('kpiProfiles', fmt(k.activeProfiles ?? det.totalProfiles));
    setText('kpiThreats', fmt(k.totalThreats ?? det.globalStats?.totalThreats));
    setText('kpiCritical', fmt(k.criticalProfiles ?? det.criticalProfiles));
    setText('kpiRequests', fmt(k.requestsAnalyzed ?? det.globalStats?.totalRequests));

    const badge = document.getElementById('alertBadge');
    if (badge) badge.textContent = k.openAlerts ?? 0;

    renderDashboardAlerts(data.recentAlerts || []);

    if (det.totalProfiles !== undefined) {
      updateKPIs(det);
      updateTimeline(det);
    }

    if (data.anomalyBreakdown && anomalyChart) {
      const bd = data.anomalyBreakdown;
      anomalyChart.data.labels = Object.keys(bd).map((key) => key.replace(/_/g, ' '));
      anomalyChart.data.datasets[0].data = Object.values(bd);
      anomalyChart.update('none');
    }

    updateSidebarStatus(true);
  } catch (e) {
    console.error('Command center load failed:', e);
    renderDashboardAlerts([]);
    await loadRecentThreatsFallback();
    updateSidebarStatus(false);
  }
}

function defaultApiFetch(path, options = {}) {
  if (window.apiFetch) return window.apiFetch(path, options);
  return fetch(path, { credentials: 'include', ...options }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      err.status = res.status;
      if (!options.silent && window.GT?.handleApiError) {
        window.GT.handleApiError(err, options.context);
      }
      throw err;
    }
    return data;
  });
}

function renderDashboardAlerts(alerts) {
  const el = document.getElementById('recentThreats');
  if (!el) return;
  if (!alerts.length) {
    el.innerHTML = '<div class="empty-state" style="padding:10px"><p>No alerts yet — use AI Triage or wait for detections</p></div>';
    return;
  }
  el.innerHTML = alerts.slice(0, 8).map((a) => {
    const id = a.id || '';
    const sev = a.severity || 'medium';
    const title = (a.title || 'Alert').replace(/'/g, "\\'");
    return `<div class="threat-item" style="padding:8px;cursor:pointer;border:1px solid var(--border);margin-bottom:4px" data-alert-id="${id}">
      <span class="badge">${sev.toUpperCase()}</span>
      <span style="font-size:12px;margin-left:8px">${(a.title || 'Alert').replace(/</g, '&lt;')}</span>
    </div>`;
  }).join('');
}

async function loadRecentThreatsFallback() {
  try {
    const fetcher = window.apiFetch || defaultApiFetch;
    const d = await fetcher('/api/threats/events?limit=10&source=alerts');
    renderDashboardAlerts(d.data || []);
  } catch (_) {
    const el = document.getElementById('recentThreats');
    if (el) el.innerHTML = '<div class="empty-state" style="padding:10px"><p>Could not load alerts</p></div>';
  }
}

async function loadDNA() {
  const dnaEl = document.getElementById('dnaDisplay');
  const fetcher = window.apiFetch || defaultApiFetch;
  try {
    const [dna, risk] = await Promise.all([
      fetcher('/api/dna').catch(() => fetch(`${API}/dna`, { credentials: 'include' }).then((r) => r.json())),
      fetcher('/api/threats/risk').catch(() => ({ success: false })),
    ]);

    if (dnaEl) {
      if (dna?.success && dna.dnaObj) {
        const f = dna.dnaObj.features || {};
        dnaEl.innerHTML = `
          <div class="dna-row"><span class="dna-key">browser</span><span class="dna-val">${f.browser || '?'}</span></div>
          <div class="dna-row"><span class="dna-key">os</span><span class="dna-val">${f.os || '?'}</span></div>
          <div class="dna-row"><span class="dna-key">device</span><span class="dna-val">${f.deviceClass || '?'}</span></div>
          <div class="dna-row"><span class="dna-key">lang</span><span class="dna-val">${f.lang || '?'}</span></div>
          <div class="dna-row"><span class="dna-key">timezone</span><span class="dna-val">${f.tzBucket || '?'}</span></div>
          <div class="dna-row"><span class="dna-key">ip class</span><span class="dna-val">${f.ipClass || '?'}</span></div>
          <div class="dna-id">${dna.dnaObj.id || dna.dna || ''}</div>`;
      } else {
        dnaEl.innerHTML = '<div class="empty-state" style="padding:16px"><p>DNA fingerprint unavailable</p></div>';
      }
    }

    if (risk?.success) {
      const score = risk.data?.riskScore ?? 0;
      const level = risk.data?.threatLevel || 'low';
      setText('riskScoreVal', `${score}/100`);
      const fill = document.getElementById('riskFill');
      if (fill) {
        fill.style.width = `${score}%`;
        fill.style.background = score >= 80 ? 'var(--red)' : score >= 60 ? 'var(--orange)' : score >= 30 ? 'var(--yellow)' : 'var(--green)';
      }
      const badge = document.getElementById('riskLevelBadge');
      if (badge) {
        badge.textContent = level.toUpperCase();
        badge.className = `risk-level-badge level-${level}`;
      }
    }
  } catch (e) {
    console.error('DNA load error', e);
    if (dnaEl) {
      dnaEl.innerHTML = '<div class="empty-state" style="padding:16px;color:var(--red)"><p>Failed to load client telemetry</p></div>';
    }
  }
}

async function loadRecentThreats() {
  await loadRecentThreatsFallback();
}

// ── Threat Feed Page ───────────────────────────────────────────────────────
async function loadThreats() {
  const el = document.getElementById('threatFeed');
  try {
    const r = await fetch(`${API}/threats/events?limit=50&source=alerts`, { credentials: 'include' });
    const d = await r.json();
    if (d.success && d.data?.length) {
      el.innerHTML = '';
      d.data.forEach(ev => el.appendChild(buildFeedItem(normalizeAlert(ev))));
    } else {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-shield-halved"></i><p>Monitoring for threats...</p><small style="font-size:11px">Events will appear here in real-time</small></div>`;
    }
  } catch(e) { el.innerHTML = '<div style="color:var(--red);padding:16px">Failed to load threat feed</div>'; }
}

function normalizeAlert(a) {
  return {
    id: a.id,
    severity: a.severity,
    riskScore: a.riskScore,
    timestamp: a.detectedAt || a.timestamp,
    ipAddress: a.ipAddress,
    anomalies: a.anomalyTypes || a.anomalies,
    title: a.title,
  };
}

function buildFeedItem(ev) {
  const sev = ev.severity || (ev.riskScore>=80?'critical':ev.riskScore>=60?'high':ev.riskScore>=30?'medium':'low');
  const div = document.createElement('div');
  div.className = 'pb-table-row cols-threats';
  div.onclick = () => { if (window.openThreatDrawer) window.openThreatDrawer(ev); };
  div.innerHTML = `
    <span class="mono">${new Date(ev.timestamp).toLocaleString()}</span>
    <span><span class="badge ${sev === 'critical' ? 'badge-red' : sev === 'high' ? 'badge-orange' : sev === 'medium' ? 'badge-yellow' : 'badge-green'}">${sev.toUpperCase()}</span></span>
    <span style="font-weight:600; font-family:var(--mono);">${(ev.anomalies||[ev.eventType||'unknown']).join(', ')}</span>
    <span class="mono" style="font-weight:700; color:${scoreColor(ev.riskScore)}">${ev.riskScore||0}</span>
    <span class="mono">${ev.ipAddress||'—'}</span>`;
  return div;
}

// ── Profiles Page ─────────────────────────────────────────────────────────
async function loadProfiles() {
  const el = document.getElementById('profilesGrid');
  try {
    const r = await fetch(`${API}/threats/profiles`);
    const d = await r.json();
    if (d.success && d.data?.length) {
      el.innerHTML = d.data.map((p) => {
        const key = esc(p.key);
        const level = ['critical', 'high', 'medium', 'green'].includes(p.threatLevel) ? p.threatLevel : 'green';
        const label = esc(level);
        return `
        <div class="pb-table-row cols-profiles" onclick="window.openProfileDrawer(${JSON.stringify(p).replace(/"/g, '&quot;')})">
          <span style="font-weight: 600; font-family: var(--mono); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${key}</span>
          <span><span class="badge ${level === 'high' ? 'badge-orange' : level === 'critical' ? 'badge-red' : level === 'medium' ? 'badge-yellow' : 'badge-green'}">${label}</span></span>
          <span class="mono">${p.requestCount || 0}</span>
          <span class="mono" style="font-weight: 700; color: ${scoreColor(p.riskScore)}">${p.riskScore || 0}</span>
          <span class="mono">${p.knownIpCount || 0}</span>
          <span class="mono">${p.knownDeviceCount || 0}</span>
        </div>`;
      }).join('');
    } else {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-fingerprint"></i><p>No profiles yet</p></div>';
    }
  } catch(e) { el.innerHTML = '<div style="color:var(--red);padding:16px">Failed to load profiles</div>'; }
}

document.getElementById('profileSearch')?.addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('#profilesGrid .pb-table-row').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

document.getElementById('threatSearch')?.addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('#threatFeed .pb-table-row').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

// ── Analyze Page ──────────────────────────────────────────────────────────
document.getElementById('analyzeForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('analyzeBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
  btn.disabled = true;

  const locRaw = document.getElementById('af-location').value || '';
  const [city, country] = locRaw.split(',').map(s => s.trim());
  let body = null;
  try { body = JSON.parse(document.getElementById('af-body').value || 'null'); } catch(_) {}

  const payload = {
    userId: document.getElementById('af-userId').value || undefined,
    accountId: document.getElementById('af-accountId').value || undefined,
    activityType: document.getElementById('af-activityType').value,
    endpoint: document.getElementById('af-endpoint').value || undefined,
    ipAddress: document.getElementById('af-ip').value || undefined,
    userAgent: document.getElementById('af-ua').value || navigator.userAgent,
    location: locRaw ? { city, country } : undefined,
    deviceInfo: document.getElementById('af-device').value ? { deviceType: document.getElementById('af-device').value } : undefined,
    body,
  };

  try {
    const r = await fetch(`${API}/threats/analyze`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
    });
    const d = await r.json();
    renderAnalyzeResult(d.data, payload);
  } catch(err) {
    document.getElementById('analyzeResult').innerHTML = `<div style="color:var(--red);padding:16px">${err.message}</div>`;
  }

  btn.innerHTML = '<i class="fas fa-microscope"></i> Analyze Activity';
  btn.disabled = false;
});

function renderAnalyzeResult(data, activity) {
  if (!data) return;
  const el = document.getElementById('analyzeResult');
  const sev = data.threatLevel || 'low';
  const color = scoreColor(data.riskScore);
  const anomalyTags = (data.anomalies||[]).map(a =>
    `<span class="anomaly-tag sev-badge-${a.severity}">${a.type.replace(/_/g,' ')}</span>`).join('');

  let aiHtml = '';
  if (data.explanation) {
    const ex = data.explanation;
    const actions = (ex.actions||[]).map(a => `<div class="ai-action-item">${a}</div>`).join('');
    aiHtml = `<div class="ai-explanation">
      <div class="ai-label"><i class="fas fa-robot"></i> AI Analysis ${ex.aiPowered?`<span style="font-size:9px;background:var(--purple-glow);color:var(--purple);padding:1px 6px;border-radius:4px">${ex.provider||'AI'}</span>`:''}</div>
      <div class="ai-text">${ex.explanation||'No explanation available.'}</div>
      ${actions?`<div class="ai-actions">${actions}</div>`:''}
    </div>`;
  }

  el.className = 'analyze-result';
  el.innerHTML = `
    <div class="result-score-ring">
      <div class="score-circle" style="border-color:${color}">
        <div class="score-num" style="color:${color}">${data.riskScore||0}</div>
        <div class="score-lbl">Risk Score</div>
      </div>
      <span class="risk-level-badge level-${sev}">${sev.toUpperCase()}</span>
    </div>
    ${anomalyTags?`<div class="anomaly-tags">${anomalyTags}</div>`:''}
    ${aiHtml}
      <div style="font-size:11px;color:var(--text3)">Profile key: ${esc(data.profileKey||'?')} · Requests: ${data.requestCount||0}</div>`;
}

// ── Logs Page ─────────────────────────────────────────────────────────────
async function loadLogs() {
  const el = document.getElementById('logsTable');
  try {
    const method = document.getElementById('logMethodFilter').value;
    const r = await fetch(`${API}/logger/logs${method?`?method=${method}`:''}`);
    const d = await r.json();
    if (d.success && d.data?.length) {
      el.innerHTML = d.data.map((log) => {
        const method = String(log.method || 'GET').toUpperCase();
        const methodClass = method.replace(/[^A-Z]/g, '') || 'GET';
        const path = esc(log.path);
        const ip = esc(log.ip || '?');
        const geo = log.geo?.country ? ` · ${esc(log.geo.city || '')} ${esc(log.geo.country)}` : '';
        return `
        <div class="pb-table-row cols-logs" onclick="window.openLogDrawer(${JSON.stringify(log).replace(/"/g, '&quot;')})">
          <span><span class="log-method method-${methodClass}">${esc(method)}</span></span>
          <span style="font-family: var(--mono); font-weight: 500; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${path}</span>
          <span><span class="log-status status-${Math.floor((log.statusCode||200)/100)}">${log.statusCode||'?'}</span></span>
          <span class="mono">${log.responseTime||'?'}ms · ${ip}${geo}</span>
          <span class="mono">${timeAgo(log.timestamp)}</span>
        </div>`;
      }).join('');
    } else {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-terminal"></i><p>No logs available</p></div>';
    }
  } catch(e) { el.innerHTML = '<div style="color:var(--red);padding:16px">Failed to load logs</div>'; }
}

document.getElementById('refreshLogsBtn')?.addEventListener('click', loadLogs);
document.getElementById('clearLogsBtn')?.addEventListener('click', async () => {
  if (!confirm('Clear all request logs?')) return;
  await fetch(`${API}/logger/logs`, { method:'DELETE' });
  loadLogs();
});
document.getElementById('logMethodFilter')?.addEventListener('change', loadLogs);

// ── Plugins Page ──────────────────────────────────────────────────────────
async function loadPlugins() {
  const el = document.getElementById('pluginsList');
  try {
    const r = await fetch(`${API}/threats/plugins`);
    const d = await r.json();
    if (d.success && d.data?.length) {
      el.innerHTML = d.data.map(p => `
        <div class="plugin-card">
          <div class="plugin-header">
            <div class="plugin-icon"><i class="fas fa-puzzle-piece"></i></div>
            <div><div class="plugin-name">${p.name}</div><div class="plugin-ver">v${p.version}</div></div>
          </div>
          <div class="plugin-desc">${p.description||'No description'}</div>
        </div>`).join('');
    } else {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-puzzle-piece"></i><p>No plugins registered</p></div>';
    }
  } catch(e) { el.innerHTML = '<div style="color:var(--red);padding:16px">Failed to load plugins</div>'; }
}

document.querySelectorAll('.code-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.code-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.code-pane').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`code-${tab.dataset.lang}`)?.classList.add('active');
  });
});

// ── Suspicious IP (optional UI) ───────────────────────────────────────────
document.getElementById('markSuspiciousBtn')?.addEventListener('click', async () => {
  const level = document.getElementById('suspiciousLevel')?.value;
  await fetch(`${API}/threats/suspicious`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level }) });
  loadDNA();
});
document.getElementById('clearSuspiciousBtn')?.addEventListener('click', async () => {
  await fetch(`${API}/threats/suspicious`, { method: 'DELETE', credentials: 'include' });
  loadDNA();
});

// ── Charts ────────────────────────────────────────────────────────────────
function initCharts() {
  const tlCtx = document.getElementById('timelineChart').getContext('2d');
  timelineChart = new Chart(tlCtx, {
    type:'line',
    data: {
      labels: timelineData.labels,
      datasets: [
        { label:'Critical', data:timelineData.critical, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,.1)', tension:.4, fill:true, pointRadius:3 },
        { label:'High',     data:timelineData.high,     borderColor:'#f97316', backgroundColor:'rgba(249,115,22,.08)', tension:.4, fill:true, pointRadius:3 },
        { label:'Medium',   data:timelineData.medium,   borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,.06)', tension:.4, fill:true, pointRadius:3 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{ legend:{ display:false } },
      scales: {
        x:{ grid:{ color:'rgba(255,255,255,.04)' }, ticks:{ color:'#64748b', font:{ size:10 }, maxTicksLimit:8 } },
        y:{ grid:{ color:'rgba(255,255,255,.04)' }, ticks:{ color:'#64748b', font:{ size:10 }, precision:0 }, beginAtZero:true }
      }
    }
  });

  const acCtx = document.getElementById('anomalyChart').getContext('2d');
  anomalyChart = new Chart(acCtx, {
    type:'doughnut',
    data: { labels:[], datasets:[{ data:[], backgroundColor:['#ef4444','#f97316','#f59e0b','#3b82f6','#8b5cf6','#10b981','#06b6d4'], borderWidth:0, hoverOffset:6 }] },
    options: {
      responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{ legend:{ position:'right', labels:{ color:'#94a3b8', font:{ size:11 }, padding:10, boxWidth:12 } } },
      cutout:'65%',
    }
  });
}

// ── Sidebar status ─────────────────────────────────────────────────────────
function updateSidebarStatus(ok) {
  const dot = document.getElementById('sidebarDot');
  const txt = document.getElementById('sidebarStatus');
  if (dot) dot.className = 'status-dot ' + (ok ? 'green' : 'red');
  if (txt) txt.textContent = ok ? 'Live' : 'Disconnected';
}

async function checkAIStatus() {
  if (window.AI?.updateAiStatusBadge) return window.AI.updateAiStatusBadge();
  try {
    const r = await fetch('/api/ai/status', { credentials: 'include' });
    const d = await r.json();
    const el = document.getElementById('aiStatus');
    if (d.data?.configured) {
      el.textContent = `${d.data.defaultProvider?.provider || 'AI'} ready`;
    } else el.textContent = 'Rules only';
  } catch (_) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────
function setText(id, v) { const el=document.getElementById(id); if(el) el.textContent = v??'—'; }
function fmt(n) { if (n==null||n===undefined) return '—'; return Number(n).toLocaleString(); }
function timeAgo(ts) {
  if (!ts) return '?';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}
window.timeAgo = timeAgo;
function scoreColor(score) {
  if (score>=80) return 'var(--red)';
  if (score>=60) return 'var(--orange)';
  if (score>=30) return 'var(--yellow)';
  return 'var(--green)';
}

// ── Team / user management (admin) ─────────────────────────────────────────
let userMgmtBound = false;

function bindUserManagement() {
  if (userMgmtBound) return;
  userMgmtBound = true;
  document.getElementById('addUserBtn')?.addEventListener('click', () => openUserModal());
  document.getElementById('userModalCancel')?.addEventListener('click', closeUserModal);
  document.getElementById('userModalBackdrop')?.addEventListener('click', closeUserModal);
  document.getElementById('userForm')?.addEventListener('submit', saveUser);
}

function openUserModal(user) {
  const modal = document.getElementById('userModal');
  const backdrop = document.getElementById('userModalBackdrop');
  if (!modal) return;
  document.getElementById('userModalTitle').textContent = user ? 'Edit User' : 'Add User';
  document.getElementById('uf-id').value = user?.id || '';
  document.getElementById('uf-name').value = user?.name || '';
  document.getElementById('uf-email').value = user?.email || '';
  document.getElementById('uf-email').disabled = !!user;
  document.getElementById('uf-role').value = user?.role || 'analyst';
  document.getElementById('uf-password').value = '';
  document.getElementById('uf-password').required = !user;
  document.getElementById('uf-password-label').textContent = user ? 'New password (optional)' : 'Password';
  const activeGroup = document.getElementById('uf-active-group');
  if (activeGroup) {
    activeGroup.style.display = user ? 'block' : 'none';
    document.getElementById('uf-active').checked = user?.active !== false;
  }
  modal.style.display = 'flex';
  backdrop.style.display = 'block';
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  const backdrop = document.getElementById('userModalBackdrop');
  if (modal) modal.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
}

async function loadUsers() {
  const grid = document.getElementById('usersGrid');
  if (!grid) return;
  try {
    const data = await apiFetch('/api/auth/users');
    const users = data.users || [];
    if (!users.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No team members yet</p></div>';
      return;
    }
    grid.innerHTML = users.map((u) => {
      const last = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—';
      const self = window._currentUser?.id === u.id;
      return `<div class="pb-table-row" style="grid-template-columns:2fr 1fr 1fr 1fr 120px;display:grid;gap:16px;padding:12px 16px;align-items:center">
        <div>
          <div style="font-weight:600">${esc(u.name)}</div>
          <div style="font-size:11px;color:var(--text-dim);font-family:var(--mono)">${esc(u.email)}</div>
        </div>
        <span class="badge">${esc(u.role)}</span>
        <span class="badge" style="color:${u.active ? 'var(--green)' : 'var(--red)'}">${u.active ? 'Active' : 'Disabled'}</span>
        <span style="font-size:11px;color:var(--text2)">${last}</span>
        <div style="display:flex;gap:6px">
          <button class="btn-xs" data-edit-user="${u.id}">Edit</button>
          ${self ? '' : `<button class="btn-xs" data-del-user="${u.id}" style="color:var(--red)">Del</button>`}
        </div>
      </div>`;
    }).join('');

    users.forEach((u) => {
      grid.querySelector(`[data-edit-user="${u.id}"]`)?.addEventListener('click', () => openUserModal(u));
      grid.querySelector(`[data-del-user="${u.id}"]`)?.addEventListener('click', () => deleteUser(u.id));
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><p>${esc(err.message)}</p></div>`;
  }
}

async function saveUser(e) {
  e.preventDefault();
  const id = document.getElementById('uf-id').value;
  const body = {
    name: document.getElementById('uf-name').value.trim(),
    role: document.getElementById('uf-role').value,
  };
  const pw = document.getElementById('uf-password').value;
  if (pw) body.password = pw;
  if (id) {
    body.active = document.getElementById('uf-active').checked;
    await apiFetch(`/api/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  } else {
    body.email = document.getElementById('uf-email').value.trim();
    if (!pw || pw.length < 8) { alert('Password must be at least 8 characters'); return; }
    body.password = pw;
    await apiFetch('/api/auth/users', { method: 'POST', body: JSON.stringify(body) });
  }
  closeUserModal();
  await loadUsers();
}

async function deleteUser(id) {
  if (!confirm('Remove this user?')) return;
  await apiFetch(`/api/auth/users/${id}`, { method: 'DELETE' });
  await loadUsers();
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────
async function bootApp() {
  initTheme();
  bindStaticControls();

  loadClientTelemetry();

  try {
    const setupRes = await fetch('/api/auth/setup-status');
    const setupData = await setupRes.json();
    if (setupData.needsSetup) {
      window.location.href = '/setup.html';
      return;
    }

    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const auth = await res.json();
    if (!auth.authenticated) {
      window.location.href = '/login.html';
      return;
    }
    const name = auth.name || auth.user || 'Analyst';
    window._currentUser = auth;
    const userName = document.getElementById('userName');
    const userInitial = document.getElementById('userInitial');
    if (userName) userName.textContent = name;
    if (userInitial) userInitial.textContent = (name[0] || 'A').toUpperCase();
    if (auth.role === 'admin') {
      const navUsers = document.getElementById('nav-users');
      if (navUsers) navUsers.style.display = '';
      bindUserManagement();
    }
  } catch (e) {
    if (window.GT) window.GT.toast('Could not verify session', 'error');
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login.html';
  });

  try { initCharts(); } catch (e) { console.warn('Charts init:', e.message); }
  startSSE();
  checkAIStatus();
  await loadDashboard();

  window.loadThreats = loadThreats;
  window.loadProfiles = loadProfiles;
  window.loadLogs = loadLogs;
  window.loadDashboard = loadDashboard;
  window.loadClientTelemetry = loadClientTelemetry;
  window.loadCommandCenter = loadCommandCenter;
  window.renderDashboardAlerts = renderDashboardAlerts;
  window.navigate = navigate;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
})();

// ═══════════════════════════════════════════════════════════════════
// DATA SOURCES MODULE
// ═══════════════════════════════════════════════════════════════════
(function() {
  let _activeScanSourceId = null;
  let _sourceSSE = null;
  let _sourcesUiReady = false;

  const srcApi = (path, opts) => (window.apiFetch ? window.apiFetch(path, opts) : fetch(path, { credentials: 'include', ...opts }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || r.statusText);
    return d;
  }));

  window._loadSources = loadSources;

  async function loadSources() {
    initPlatformDbUi();
    toggleSourceFormMode();
    await Promise.all([loadSourcesList(), loadAllJobs()]);
  }

  async function loadSourceDefaults(force) {
    try {
      const { data } = await srcApi('/api/sources/defaults');
      const type = document.getElementById('sf-type')?.value || 'postgres';
      const defs = data[type];
      if (!defs) return;
      const hostEl = document.getElementById('sf-host');
      if (force || !hostEl?.value) hostEl.value = defs.host || '';
      const portEl = document.getElementById('sf-port');
      if (force || !portEl?.value) portEl.value = defs.port || '';
      const dbEl = document.getElementById('sf-database');
      if (force || !dbEl?.value) dbEl.value = defs.database || '';
      const userEl = document.getElementById('sf-username');
      if (force || !userEl?.value) userEl.value = defs.username || '';
    } catch (e) {
      const ports = { postgres: 5432, mysql: 3306, mongodb: 27017, redis: 6379 };
      const type = document.getElementById('sf-type')?.value || 'postgres';
      const portEl = document.getElementById('sf-port');
      if (portEl && !portEl.value) portEl.value = ports[type] || 5432;
    }
  }

  function showFormError(msg) {
    const el = document.getElementById('connTestResult');
    if (el) el.innerHTML = `<span style="color:var(--red)"><i class="fas fa-times"></i> ${msg}</span>`;
  }

  function toggleSourceFormMode() {
    const mode = document.getElementById('sf-mode')?.value || 'fields';
    const isUri = mode === 'uri';
    document.querySelectorAll('.sf-fields-only').forEach((el) => {
      el.style.display = isUri ? 'none' : '';
    });
    const uriEl = document.querySelector('.sf-uri-only');
    if (uriEl) uriEl.style.display = isUri ? 'block' : 'none';
    const schemaGrp = document.getElementById('sf-schema-group');
    if (schemaGrp) schemaGrp.style.display = (isUri || document.getElementById('sf-type')?.value !== 'postgres') ? 'none' : '';
  }

  function validateSourcePayload(payload) {
    if (!payload.id) return 'Unique ID is required';
    if (payload.connectionMode === 'uri') {
      if (!payload.connectionString) return 'Connection URI is required';
      return null;
    }
    if (!payload.host) return 'Host is required';
    if (!payload.database && payload.type !== 'redis') return 'Database name is required';
    return null;
  }

  async function loadSourcesList() {
    const el = document.getElementById('sourcesList');
    if (!el) return;
    try {
      const d = await srcApi('/api/sources');
      const sources = d.data || [];

      const badge = document.getElementById('sourcesBadge');
      if (badge) {
        if (sources.length > 0) {
          badge.textContent = sources.length;
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      }

      if (!sources.length) {
        el.innerHTML = `<div class="empty-state" style="padding:32px"><i class="fas fa-database fa-2x"></i><p>No data sources connected</p><small>Click "+ Add Source" to connect</small></div>`;
        return;
      }

      const ICONS = { postgres:'🐘', mysql:'🐬', mongodb:'🍃', redis:'⚡' };
      el.innerHTML = sources.map(s => `
        <div class="source-item" data-id="${s.id}" onclick="window._selectSource('${s.id}')">
          <div class="source-top">
            <div class="source-icon src-${s.type}">${ICONS[s.type]||'🗄️'}</div>
            <div class="source-name">${s.label||s.id}</div>
            <div class="source-status src-${s.status}"></div>
          </div>
          <div class="source-meta">${s.type.toUpperCase()} · ${s.config?.connectionMode === 'uri' ? 'URI' : `${s.config?.host||'?'}:${s.config?.port||'?'}`} / ${s.config?.database||'?'}</div>
          <div class="source-actions">
            <button class="btn-xs" onclick="event.stopPropagation();scanSource('${s.id}')"><i class="fas fa-radar"></i> Scan</button>
            <button class="btn-xs" onclick="event.stopPropagation();monitorSource('${s.id}')"><i class="fas fa-play"></i> Monitor</button>
            <button class="btn-xs" style="color:var(--red)" onclick="event.stopPropagation();deleteSource('${s.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`).join('');
    } catch(e) {
      el.innerHTML = `<div style="color:var(--red);font-size:12px;padding:8px">${e.message}</div>`;
    }
  }

  async function loadAllJobs() {
    const el = document.getElementById('jobsList');
    if (!el) return;
    try {
      const d = await srcApi('/api/sources/jobs/all');
      const jobs = d.data || [];
      if (!jobs.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px">No active jobs</div>'; return; }
      el.innerHTML = jobs.map(j => `
        <div class="job-item">
          <div class="job-header">
            <span class="job-table">${j.table}</span>
            <div class="job-controls">
              <button class="btn-xs" onclick="pauseJob('${encodeURIComponent(j.jobId)}','${j.paused?'resume':'pause'}')">
                <i class="fas fa-${j.paused?'play':'pause'}"></i>
              </button>
              <button class="btn-xs" style="color:var(--red)" onclick="stopJob('${encodeURIComponent(j.jobId)}')"><i class="fas fa-stop"></i></button>
            </div>
          </div>
          <div class="job-stats">
            <span>Processed: <span class="job-stat-val">${j.processed||0}</span></span>
            <span>Threats: <span class="job-stat-val" style="color:var(--red)">${j.threats||0}</span></span>
            <span>Errors: <span class="job-stat-val">${j.errors||0}</span></span>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">Last poll: ${j.lastPoll?window.timeAgo(j.lastPoll):'never'} ${j.paused?'· <span style="color:var(--yellow)">PAUSED</span>':''}</div>
        </div>`).join('');
    } catch(_) { el.innerHTML = ''; }
  }

  function initSourcesUi() {
    if (_sourcesUiReady) return;
    _sourcesUiReady = true;

    document.getElementById('addSourceBtn')?.addEventListener('click', () => {
      const card = document.getElementById('sourceFormCard');
      if (!card) return;
      const show = card.style.display === 'none' || !card.style.display;
      card.style.display = show ? 'block' : 'none';
      if (show) loadSourceDefaults(true);
    });

    document.getElementById('sf-mode')?.addEventListener('change', toggleSourceFormMode);
    document.getElementById('sf-type')?.addEventListener('change', function() {
      const ports = { postgres: 5432, mysql: 3306, mongodb: 27017, redis: 6379 };
      const portEl = document.getElementById('sf-port');
      if (portEl) portEl.value = ports[this.value] || '';
      toggleSourceFormMode();
      loadSourceDefaults(true);
    });

    document.getElementById('testConnBtn')?.addEventListener('click', async () => {
      const resultEl = document.getElementById('connTestResult');
      if (resultEl) resultEl.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> Testing...</span>';
      const payload = getFormPayload();
      const err = validateSourcePayload(payload);
      if (err) { showFormError(err); return; }
      try {
        await srcApi('/api/sources/test', { method: 'POST', body: JSON.stringify(payload) });
        if (resultEl) resultEl.innerHTML = '<span><i class="fas fa-check"></i> Connection successful</span>';
      } catch (e) {
        showFormError(e.message);
      }
    });

    document.getElementById('sourceForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = e.submitter || form.querySelector('button[type="submit"]');
      if (!btn) return;
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
      btn.disabled = true;
      try {
        const payload = getFormPayload();
        const validationErr = validateSourcePayload(payload);
        if (validationErr) throw new Error(validationErr);
        const d = await srcApi('/api/sources', { method: 'POST', body: JSON.stringify(payload) });
        const card = document.getElementById('sourceFormCard');
        if (card) card.style.display = 'none';
        form.reset();
        await loadSourcesList();
        const sourceId = d.data?.id || payload.id;
        try { await scanSource(sourceId); } catch (scanErr) { showFormError('Connected but scan failed: ' + scanErr.message); }
        showSourceToast('Connected: ' + sourceId);
      } catch (err) {
        showFormError(err.message);
      }
      btn.innerHTML = orig;
      btn.disabled = false;
    });

    document.getElementById('startMonitorBtn')?.addEventListener('click', async () => {
      if (!_activeScanSourceId) return;
      await monitorSource(_activeScanSourceId);
    });
  }

  function getFormPayload() {
    const mode = document.getElementById('sf-mode')?.value || 'fields';
    const base = {
      id: document.getElementById('sf-id').value.trim(),
      label: document.getElementById('sf-label').value.trim(),
      type: document.getElementById('sf-type').value,
      connectionMode: mode,
      ssl: document.getElementById('sf-ssl').checked,
      poolMax: parseInt(document.getElementById('sf-pool')?.value, 10) || 5,
      connectTimeoutMs: parseInt(document.getElementById('sf-timeout')?.value, 10) || 5000,
      rejectUnauthorized: document.getElementById('sf-reject-unauth')?.checked !== false,
    };
    if (mode === 'uri') {
      base.connectionString = document.getElementById('sf-uri')?.value.trim();
      return base;
    }
    return {
      ...base,
      host: document.getElementById('sf-host').value.trim(),
      port: parseInt(document.getElementById('sf-port').value, 10) || 5432,
      database: document.getElementById('sf-database').value.trim(),
      username: document.getElementById('sf-username').value.trim(),
      password: document.getElementById('sf-password').value,
      schema: document.getElementById('sf-schema')?.value.trim() || undefined,
    };
  }

  async function loadPlatformDbForm() {
    try {
      const { data } = await srcApi('/api/sources/platform');
      const mode = data.connectionMode || 'fields';
      document.getElementById('pf-mode').value = mode;
      document.getElementById('pf-host').value = data.host || '';
      document.getElementById('pf-port').value = data.port || '';
      document.getElementById('pf-database').value = data.database || '';
      document.getElementById('pf-username').value = data.username || '';
      togglePlatformFormMode();
      const st = document.getElementById('platformDbStatus');
      if (st) st.textContent = data.connected ? '● Connected' : '○ Not connected — check settings';
    } catch (_) {}
  }

  function togglePlatformFormMode() {
    const isUri = document.getElementById('pf-mode')?.value === 'uri';
    document.querySelectorAll('.pf-fields').forEach((el) => { el.style.display = isUri ? 'none' : ''; });
    const uri = document.querySelector('.pf-uri');
    if (uri) uri.style.display = isUri ? 'block' : 'none';
  }

  let _platformUiReady = false;
  function initPlatformDbUi() {
    if (_platformUiReady) { loadPlatformDbForm(); return; }
    _platformUiReady = true;
    document.getElementById('pf-mode')?.addEventListener('change', togglePlatformFormMode);
    document.getElementById('pf-testBtn')?.addEventListener('click', async () => {
      const st = document.getElementById('platformDbStatus');
      try {
        const body = getPlatformPayload();
        await srcApi('/api/sources/platform/test', { method: 'POST', body: JSON.stringify(body) });
        if (st) st.textContent = '✓ Connection test passed';
      } catch (e) {
        if (st) st.textContent = '✗ ' + e.message;
      }
    });
    document.getElementById('platformDbForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const st = document.getElementById('platformDbStatus');
      try {
        const d = await srcApi('/api/sources/platform', { method: 'PUT', body: JSON.stringify(getPlatformPayload()) });
        if (st) st.textContent = d.message || 'Saved';
      } catch (err) {
        if (st) st.textContent = err.message;
      }
    });
    loadPlatformDbForm();
  }

  function getPlatformPayload() {
    const mode = document.getElementById('pf-mode')?.value || 'fields';
    if (mode === 'uri') {
      return { connectionMode: 'uri', connectionString: document.getElementById('pf-uri')?.value.trim() };
    }
    return {
      connectionMode: 'fields',
      host: document.getElementById('pf-host')?.value.trim(),
      port: parseInt(document.getElementById('pf-port')?.value, 10) || 5432,
      database: document.getElementById('pf-database')?.value.trim(),
      username: document.getElementById('pf-username')?.value.trim(),
      password: document.getElementById('pf-password')?.value,
    };
  }

  function showSourceToast(msg) {
    const el = document.getElementById('connTestResult');
    if (el) {
      el.innerHTML = `<span><i class="fas fa-check"></i> ${msg}</span>`;
      setTimeout(() => { el.innerHTML = ''; }, 4000);
    }
  }

  // ── Scan ───────────────────────────────────────────────────────────
  window.scanSource = async function(sourceId) {
    _activeScanSourceId = sourceId;
    const card = document.getElementById('scanResultsCard');
    if (!card) return;
    card.style.display = 'block';
    document.getElementById('scanResultsTitle').textContent = `Scanning ${sourceId}...`;
    document.getElementById('scanSummary').innerHTML = '<div class="loading-shimmer" style="height:60px"></div>';
    document.getElementById('scanTables').innerHTML = '<div class="loading-shimmer tall"></div>';

    try {
      const d = await srcApi(`/api/sources/${encodeURIComponent(sourceId)}/scan`, { method: 'POST' });
      renderScanResult(sourceId, d.data);
    } catch(e) {
      document.getElementById('scanResultsTitle').textContent = 'Scan failed';
      document.getElementById('scanSummary').innerHTML = `<div style="color:var(--red)">${e.message}</div>`;
    }
  };

  function renderScanResult(sourceId, result) {
    document.getElementById('scanResultsTitle').textContent = `Schema — ${sourceId}`;
    const s = result.summary;

    document.getElementById('scanSummary').innerHTML = `
      <div class="scan-stat"><div class="scan-stat-val">${s.total}</div><div class="scan-stat-lbl">Tables Found</div></div>
      <div class="scan-stat"><div class="scan-stat-val" style="color:var(--green)">${s.activityTables}</div><div class="scan-stat-lbl">Activity Tables</div></div>
      <div class="scan-stat"><div class="scan-stat-val" style="color:var(--blue2)">${s.userTables}</div><div class="scan-stat-lbl">User Tables</div></div>`;

    document.getElementById('scanTables').innerHTML = result.tables.map(t => {
      const mappingTags = Object.entries(t.mapping||{}).map(([k,v]) =>
        `<span class="mapping-tag"><span class="mapping-key">${k}</span>→<span class="mapping-val">${v}</span></span>`
      ).join('');

      const keyPatterns = t.keyPatterns ? t.keyPatterns.slice(0,5).map(kp =>
        `<span class="mapping-tag" style="font-size:9px">${kp.pattern} (${kp.count})</span>`
      ).join('') : '';

      return `
        <div class="scan-table-row">
          <div class="scan-table-top">
            <span class="scan-table-name">${t.table}</span>
            <span class="relevance-badge rel-${t.relevance}">${t.relevance}</span>
            <label class="enable-toggle" onclick="event.stopPropagation()">
              <div class="toggle-switch ${t.relevance!=='weak'&&t.relevance!=='none'?'on':''}" id="toggle-${t.table}" onclick="this.classList.toggle('on')"></div>
              Monitor
            </label>
          </div>
          <div class="scan-table-meta">
            <span><i class="fas fa-rows"></i> ~${(t.rowCount||0).toLocaleString()} rows</span>
            ${t.latestTs?`<span>Latest: ${window.timeAgo(t.latestTs)}</span>`:''}
            ${t.sizeBytes>0?`<span>${(t.sizeBytes/1024/1024).toFixed(1)} MB</span>`:''}
          </div>
          ${mappingTags?`<div class="mapping-grid">${mappingTags}</div>`:''}
          ${keyPatterns?`<div class="mapping-grid" style="margin-top:4px">${keyPatterns}</div>`:''}
        </div>`;
    }).join('');
  }

  window._selectSource = function(sourceId) {
    document.querySelectorAll('.source-item').forEach((el) => {
      el.classList.toggle('selected', el.dataset.id === sourceId);
    });
    _activeScanSourceId = sourceId;
    const card = document.getElementById('scanResultsCard');
    if (card) card.style.display = '';
    scanSource(sourceId);
  };

  window.monitorSource = async function(sourceId) {
    // Collect enabled tables from toggles
    const enabledTables = [];
    document.querySelectorAll('.toggle-switch.on').forEach(el => {
      const table = el.id.replace('toggle-', '');
      if (table) enabledTables.push({ table, enabled: true });
    });

    try {
      const d = await srcApi(`/api/sources/${encodeURIComponent(sourceId)}/monitor`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start', tables: enabledTables.length ? enabledTables : undefined }),
      });
      startSourceStream();
      await loadAllJobs();
      showSourceToast(`Monitoring started (${d.data?.count || 0} jobs)`);
    } catch (e) { alert(e.message); }
  };

  // ── Delete source ──────────────────────────────────────────────────
  window.deleteSource = async function(sourceId) {
    if (!confirm(`Remove source "${sourceId}"?`)) return;
    try {
      await srcApi(`/api/sources/${encodeURIComponent(sourceId)}`, { method: 'DELETE' });
      await loadSourcesList();
      await loadAllJobs();
    } catch (e) { alert(e.message); }
  };

  // ── Job controls ───────────────────────────────────────────────────
  window.pauseJob = async function(jobId, action) {
    try {
      await srcApi(`/api/sources/jobs/${jobId}/${action}`, { method: 'POST' });
      await loadAllJobs();
    } catch (e) { alert(e.message); }
  };
  window.stopJob = async function(jobId) {
    try {
      await srcApi(`/api/sources/jobs/${jobId}`, { method: 'DELETE' });
      await loadAllJobs();
    } catch (e) { alert(e.message); }
  };

  // ── SSE stream from sources ────────────────────────────────────────
  function startSourceStream() {
    if (_sourceSSE) _sourceSSE.close();
    _sourceSSE = new EventSource('/api/sources/events/stream');

    _sourceSSE.addEventListener('activity', e => {
      try { appendSourceActivity(JSON.parse(e.data), false); } catch(_) {}
    });
    _sourceSSE.addEventListener('threat', e => {
      try { appendSourceActivity(JSON.parse(e.data), true); } catch(_) {}
    });
    _sourceSSE.addEventListener('heartbeat', e => {
      try {
        const d = JSON.parse(e.data);
        // Update job stats silently
        if (document.getElementById('page-sources').classList.contains('active')) {
          loadAllJobs();
        }
      } catch(_) {}
    });
  }

  function appendSourceActivity({ activity, analysis, jobId }, isThreat) {
    const feed = document.getElementById('sourceActivityFeed');
    // Remove empty state
    const es = feed.querySelector('.empty-state');
    if (es) es.remove();

    const div = document.createElement('div');
    div.className = `feed-item sev-${isThreat ? (analysis?.threatLevel||'medium') : 'low'}`;
    div.style.cssText = 'padding:10px;margin-bottom:6px';

    const user = activity?.userId || 'unknown';
    const endpoint = activity?.endpoint || '?';
    const ip = activity?.ipAddress || '';
    const score = analysis?.riskScore || 0;

    div.innerHTML = `
      <div class="feed-header" style="margin-bottom:4px">
        <div class="feed-badges">
          ${isThreat?`<span class="threat-sev sev-badge-${analysis?.threatLevel||'medium'}">${(analysis?.threatLevel||'THREAT').toUpperCase()}</span>`:'<span class="threat-sev sev-badge-low">OK</span>'}
          <span style="font-size:11px;font-family:var(--mono);color:var(--text2)">${user}</span>
        </div>
        <span class="feed-time">${window.timeAgo(activity?.timestamp||Date.now())}</span>
      </div>
      <div class="feed-meta" style="gap:12px">
        <span><i class="fas fa-route"></i> ${endpoint}</span>
        ${ip?`<span><i class="fas fa-globe"></i> ${ip}</span>`:''}
        <span><i class="fas fa-gauge"></i> ${score}</span>
      </div>
      ${isThreat && analysis?.anomalies?.length?`<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${analysis.anomalies.slice(0,3).map(a=>`<span class="anomaly-tag sev-badge-${a.severity}" style="font-size:10px">${a.type.replace(/_/g,' ')}</span>`).join('')}</div>`:''}`;

    feed.insertBefore(div, feed.firstChild);

    // Cap at 50 items
    while (feed.children.length > 50) feed.removeChild(feed.lastChild);
  }

  // ── Expose loadSources globally for navigation ─────────────────────
  window._loadSources = loadSources;

  setInterval(() => {
    if (document.getElementById('page-sources')?.classList.contains('active')) {
      loadAllJobs();
    }
  }, 8000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSourcesUi);
  } else {
    initSourcesUi();
  }

  // ── PocketBase Drawer Controls ───────────────────────────────────────────
  function openDrawer(title, contentHtml, footerHtml = '') {
    document.getElementById('pbDrawerTitle').innerHTML = title;
    document.getElementById('pbDrawerContent').innerHTML = contentHtml;
    const footer = document.getElementById('pbDrawerFooter') || document.querySelector('.pb-drawer-footer');
    if (footer) {
      footer.innerHTML = footerHtml || `
        <button class="btn btn-sm" onclick="closeDrawer()">Close</button>
      `;
    }
    document.getElementById('pbDrawer').classList.add('open');
    document.getElementById('pbDrawerBackdrop').classList.add('open');
  }
  window.openDrawer = openDrawer;

  function closeDrawer() {
    document.getElementById('pbDrawer').classList.remove('open');
    document.getElementById('pbDrawerBackdrop').classList.remove('open');
  }
  window.closeDrawer = closeDrawer;

  document.getElementById('pbDrawerClose')?.addEventListener('click', closeDrawer);
  document.getElementById('pbDrawerBackdrop')?.addEventListener('click', closeDrawer);

  window.openProfileDrawer = function(p) {
    const level = ['critical', 'high', 'medium', 'green'].includes(p.threatLevel) ? p.threatLevel : 'green';
    const title = `<i class="fas fa-fingerprint" style="color:var(--primary)"></i> Profile: ${esc(p.key)}`;
    const html = `
      <div class="field-box">
        <div class="field-label">Record Key ID</div>
        <div class="field-value mono">${esc(p.key)}</div>
      </div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px">
        <div class="field-box">
          <div class="field-label">Threat Level</div>
          <div class="field-value">
            <span class="badge ${level === 'critical' ? 'badge-red' : level === 'high' ? 'badge-orange' : level === 'medium' ? 'badge-yellow' : 'badge-green'}">${esc(level.toUpperCase())}</span>
          </div>
        </div>
        <div class="field-box">
          <div class="field-label">Risk Index</div>
          <div class="field-value mono" style="font-weight:700; color:${scoreColor(p.riskScore)}">${p.riskScore}/100</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px">
        <div class="field-box">
          <div class="field-label">Total Requests</div>
          <div class="field-value mono">${p.requestCount||0}</div>
        </div>
        <div class="field-box">
          <div class="field-label">Failed Logins</div>
          <div class="field-value mono">${p.failedLoginCount||0}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px">
        <div class="field-box">
          <div class="field-label">Known IP Addresses</div>
          <div class="field-value mono">${p.knownIpCount||0}</div>
        </div>
        <div class="field-box">
          <div class="field-label">Known Devices</div>
          <div class="field-value mono">${p.knownDeviceCount||0}</div>
        </div>
      </div>

      <div class="field-box" style="margin-top:10px">
        <div class="field-label">Last Seen Time</div>
        <div class="field-value mono">${new Date(p.lastSeen).toLocaleString()}</div>
      </div>
    `;
    openDrawer(title, html);
  };

  window.openThreatDrawer = function(ev) {
    const title = `<i class="fas fa-shield-halved" style="color:var(--red)"></i> Threat Event Detail`;
    
    const sev = ev.severity || (ev.riskScore>=80?'critical':ev.riskScore>=60?'high':ev.riskScore>=30?'medium':'low');
    const anomaliesList = ev.anomalies && ev.anomalies.length
      ? ev.anomalies.map(a => `<span class="badge ${a.severity==='critical'?'badge-red':a.severity==='high'?'badge-orange':a.severity==='medium'?'badge-yellow':'badge-green'}" style="margin:2px">${a.type.replace(/_/g,' ')}</span>`).join('')
      : `<span class="badge badge-blue">${ev.eventType||'Anomalous activity'}</span>`;

    let explanationHtml = '';
    if (ev.explanation) {
      const provider = ev.explanation.aiPowered ? `<span class="badge badge-blue" style="font-size:9px; padding:1px 6px">${ev.explanation.provider || 'AI'}</span>` : '';
      explanationHtml = `
        <div class="ai-explanation">
          <div class="ai-label"><i class="fas fa-robot"></i> AI Engine Analysis ${provider}</div>
          <div class="ai-text">${ev.explanation.explanation || 'No textual explanation provided.'}</div>
          ${ev.explanation.actions && ev.explanation.actions.length ? `
            <div class="ai-actions">
              ${ev.explanation.actions.map(a => `<div class="ai-action-item">${a}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    const html = `
      <div style="display:grid; grid-template-columns:1fr 1.5fr; gap:12px">
        <div class="field-box">
          <div class="field-label">Severity Level</div>
          <div class="field-value"><span class="badge ${sev==='critical'?'badge-red':sev==='high'?'badge-orange':sev==='medium'?'badge-yellow':'badge-green'}">${sev.toUpperCase()}</span></div>
        </div>
        <div class="field-box">
          <div class="field-label">Risk score</div>
          <div class="field-value mono" style="font-weight:700; color:${scoreColor(ev.riskScore)}">${ev.riskScore}/100</div>
        </div>
      </div>

      <div class="field-box" style="margin-top:10px">
        <div class="field-label">Triggered Anomalies</div>
        <div style="margin-top:4px">${anomaliesList}</div>
      </div>

      <div class="field-box" style="margin-top:10px">
        <div class="field-label">Associated User ID</div>
        <div class="field-value mono">${ev.userId || 'Guest / anonymous'}</div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px">
        <div class="field-box">
          <div class="field-label">Origin IP</div>
          <div class="field-value mono">${ev.ipAddress || '—'}</div>
        </div>
        <div class="field-box">
          <div class="field-label">Detected At</div>
          <div class="field-value mono">${new Date(ev.timestamp).toLocaleString()}</div>
        </div>
      </div>

      ${ev.deviceInfo ? `
        <div class="field-box" style="margin-top:10px">
          <div class="field-label">Device Fingerprint</div>
          <div class="field-value mono" style="font-size:11px">Device: ${ev.deviceInfo.deviceType || '—'} · Browser: ${ev.deviceInfo.browser || '—'} · OS: ${ev.deviceInfo.os || '—'}</div>
        </div>
      ` : ''}

      ${explanationHtml}
    `;

    const footer = `
      <button class="btn btn-sm" onclick="closeDrawer()">Dismiss</button>
      ${ev.id ? `<button class="btn-sm btn-danger" onclick="resolveThreatEvent('${ev.id}')"><i class="fas fa-check-circle"></i> Resolve Incident</button>` : ''}
    `;

    openDrawer(title, html, footer);
  };

  window.resolveThreatEvent = async function(id) {
    if (!confirm('Mark this threat event as resolved?')) return;
    try {
      const r = await fetch(`${API}/threats/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolutionNotes: 'Resolved via PocketBase Admin Dashboard' })
      });
      const d = await r.json();
      if (d.success) {
        closeDrawer();
        loadThreats();
      } else {
        alert('Failed to resolve: ' + d.error);
      }
    } catch(e) { alert(e.message); }
  };

  window.openLogDrawer = function(log) {
    const title = `<i class="fas fa-terminal" style="color:var(--primary)"></i> Log Transaction Entry`;
    const method = String(log.method || 'GET').toUpperCase();
    const methodClass = method.replace(/[^A-Z]/g, '') || 'GET';
    const statusColor = log.statusCode >= 500 ? 'badge-red' : log.statusCode >= 400 ? 'badge-orange' : log.statusCode >= 300 ? 'badge-yellow' : 'badge-green';

    const html = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
        <div class="field-box">
          <div class="field-label">HTTP Method</div>
          <div class="field-value"><span class="log-method method-${methodClass}">${esc(method)}</span></div>
        </div>
        <div class="field-box">
          <div class="field-label">Response Status</div>
          <div class="field-value"><span class="badge ${statusColor}">${log.statusCode || '?'}</span></div>
        </div>
      </div>

      <div class="field-box" style="margin-top:10px">
        <div class="field-label">URI Route Path</div>
        <div class="field-value mono">${esc(log.path)}</div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px">
        <div class="field-box">
          <div class="field-label">Origin IP</div>
          <div class="field-value mono">${esc(log.ip || '—')}</div>
        </div>
        <div class="field-box">
          <div class="field-label">Response Latency</div>
          <div class="field-value mono">${log.responseTime || '?'} ms</div>
        </div>
      </div>

      <div class="field-box" style="margin-top:10px">
        <div class="field-label">Time Occurred</div>
        <div class="field-value mono">${new Date(log.timestamp).toLocaleString()}</div>
      </div>

      <div class="field-box" style="margin-top:10px">
        <div class="field-label">User Agent Details</div>
        <div class="field-value mono" style="font-size:11px">${esc(log.userAgent || '—')}</div>
      </div>
    `;
    openDrawer(title, html);
  };

  // ── SQL Console playground controls ──────────────────────────────────────
  window.setPlaygroundQuery = function(query) {
    const input = document.getElementById('queryInput');
    if (input) {
      input.value = query;
      document.getElementById('runQueryBtn')?.click();
    }
  };

  document.getElementById('runQueryBtn')?.addEventListener('click', async () => {
    const rawQuery = document.getElementById('queryInput').value.trim();
    const container = document.getElementById('queryResultContainer');
    
    if (!rawQuery) {
      container.innerHTML = '<div style="padding:16px; color:var(--red);">Error: Query input is empty.</div>';
      return;
    }
    
    container.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Executing query...</div>';
    
    const selectMatch = rawQuery.match(/select\s+\*\s+from\s+(\w+)(?:\s+where\s+(\w+)\s*([>=<]+|contains|startsWith)\s*["']?([^"']+)["']?)?/i);
    
    if (!selectMatch) {
      container.innerHTML = '<div style="padding:16px; color:var(--red); font-family:var(--mono); line-height:1.4;">Parser Error: Only SELECT queries are supported in playground terminal mode.<br>Syntax: SELECT * FROM &lt;table&gt; [WHERE &lt;column&gt; = &lt;value&gt;]</div>';
      return;
    }
    
    const table = selectMatch[1].toLowerCase();
    const filterCol = selectMatch[2];
    const filterOp = selectMatch[3];
    const filterVal = selectMatch[4];
    
    let data = [];
    let apiPath = '';
    
    if (table === 'profiles') {
      apiPath = `${API}/threats/profiles`;
    } else if (table === 'threats' || table === 'threat_events') {
      apiPath = `${API}/threats/events?limit=50`;
    } else if (table === 'logs') {
      apiPath = `${API}/logger/logs`;
    } else if (table === 'data_sources') {
      data = [
        { id: 'main-postgres', type: 'PostgreSQL', host: 'localhost', database: 'graduation_db', status: 'connected' },
        { id: 'payment-mysql', type: 'MySQL', host: '192.168.1.52', database: 'billing', status: 'connected' }
      ];
    } else {
      container.innerHTML = `<div style="padding:16px; color:var(--red); font-family:var(--mono);">Table "${table}" not found in current schema. Available: profiles, threats, logs, data_sources</div>`;
      return;
    }
    
    try {
      if (apiPath) {
        const res = await fetch(apiPath);
        const json = await res.json();
        data = json.data || [];
      }
      
      if (filterCol) {
        data = data.filter(item => {
          const val = item[filterCol];
          if (val === undefined) return false;
          const target = filterVal;
          if (filterOp === '>') return parseFloat(val) > parseFloat(target);
          if (filterOp === '<') return parseFloat(val) < parseFloat(target);
          if (filterOp === '>=') return parseFloat(val) >= parseFloat(target);
          if (filterOp === '<=') return parseFloat(val) <= parseFloat(target);
          if (filterOp === '=' || filterOp === '==') return String(val).toLowerCase() === String(target).toLowerCase();
          if (filterOp.toLowerCase() === 'contains') return String(val).toLowerCase().includes(String(target).toLowerCase());
          if (filterOp.toLowerCase() === 'startswith') return String(val).toLowerCase().startsWith(String(target).toLowerCase());
          return false;
        });
      }
      
      if (!data.length) {
        container.innerHTML = '<div class="empty-state" style="padding:20px;"><p>Empty set. No matching records found.</p></div>';
        return;
      }
      
      const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object' && k !== 'id');
      
      let headersHtml = keys.map(k => `<th>${k}</th>`).join('');
      let rowsHtml = data.map(item => {
        let colsHtml = keys.map(k => {
          let val = item[k];
          if (k === 'riskScore') return `<td style="font-weight:bold; color:${scoreColor(val)}">${val}</td>`;
          if (k === 'threatLevel') return `<td><span class="badge ${val==='critical'?'badge-red':val==='high'?'badge-orange':val==='medium'?'badge-yellow':'badge-green'}">${val}</span></td>`;
          return `<td>${val === null ? '—' : val}</td>`;
        }).join('');
        return `<tr>${colsHtml}</tr>`;
      }).join('');
      
      container.innerHTML = `
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:12px;" class="pb-playground-table">
          <thead>
            <tr style="background:var(--surface-sub); border-bottom:1px solid var(--border); color:var(--text-dim); text-transform:uppercase; font-size:10px;">
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
      
      if (!document.getElementById('pbPlaygroundStyle')) {
        const style = document.createElement('style');
        style.id = 'pbPlaygroundStyle';
        style.innerHTML = `
          .pb-playground-table th, .pb-playground-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
          .pb-playground-table tbody tr:hover { background: var(--surface-sub); }
          .pb-playground-table tbody tr:last-child td { border-bottom: none; }
        `;
        document.head.appendChild(style);
      }
      
    } catch(err) {
      container.innerHTML = `<div style="padding:16px; color:var(--red);">Query Execution Error: ${err.message}</div>`;
    }
  });

  // ── Dynamic Security Policies Management ──────────────────────────────────
  let systemPolicies = JSON.parse(localStorage.getItem('pb_security_policies')) || [
    { id: 'pol-001', name: 'Critical Risk Score Blocking Filter', trigger: 'riskScore', threshold: '>= 80', action: 'BLOCK', enabled: true },
    { id: 'pol-002', name: 'Anomalous Crawler Browser Blocker', trigger: 'userAgent contains "curl|wget|python"', threshold: 'N/A', action: 'CHALLENGE', enabled: true },
    { id: 'pol-003', name: 'Admin Database Endpoint Proxy Check', trigger: 'path startsWith "/api/sensitive-vault"', threshold: 'N/A', action: 'FLAG', enabled: true },
    { id: 'pol-004', name: 'Rapid API Endpoint Flood Control', trigger: 'requestCount', threshold: '>= 120', action: 'BLOCK', enabled: false }
  ];

  function savePolicies() {
    localStorage.setItem('pb_security_policies', JSON.stringify(systemPolicies));
  }

  function loadPolicies() {
    const el = document.getElementById('policiesGrid');
    if (!el) return;
    
    if (!systemPolicies.length) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-user-shield"></i><p>No security policies defined</p></div>';
      return;
    }
    
    el.innerHTML = systemPolicies.map(pol => `
      <div class="pb-table-row" style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr; display: grid; gap: 16px; padding: 12px 16px; align-items: center;" onclick="openPolicyDrawer('${pol.id}')">
        <span style="font-weight:600; color:var(--text);">${pol.name}</span>
        <span class="mono" style="color:var(--text-muted);">${pol.trigger}</span>
        <span class="mono" style="font-weight:600; color:var(--accent);">${pol.threshold}</span>
        <span><span class="badge ${pol.action==='BLOCK'?'badge-red':pol.action==='CHALLENGE'?'badge-orange':'badge-blue'}">${pol.action}</span></span>
        <span onclick="event.stopPropagation();">
          <div class="toggle-switch ${pol.enabled?'on':''}" onclick="togglePolicy('${pol.id}')"></div>
        </span>
      </div>
    `).join('');
  }
  window.loadPolicies = loadPolicies;

  function togglePolicy(id) {
    const pol = systemPolicies.find(p => p.id === id);
    if (pol) {
      pol.enabled = !pol.enabled;
      savePolicies();
      loadPolicies();
    }
  }
  window.togglePolicy = togglePolicy;

  document.getElementById('policySearch')?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#policiesGrid .pb-table-row').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  function openPolicyDrawer(policyId) {
    const pol = systemPolicies.find(p => p.id === policyId);
    const title = pol ? `<i class="fas fa-user-shield" style="color:var(--primary)"></i> Edit Security Policy` : `<i class="fas fa-plus" style="color:var(--accent)"></i> Create Security Policy`;
    
    const html = `
      <div class="form-group">
        <label>Policy Rule Name</label>
        <input type="text" id="pol-name" value="${pol ? pol.name : ''}" placeholder="e.g. Critical risk score block">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px">
        <div class="form-group">
          <label>Match Attribute</label>
          <input type="text" id="pol-trigger" value="${pol ? pol.trigger : ''}" placeholder="e.g. riskScore, userAgent">
        </div>
        <div class="form-group">
          <label>Match Threshold</label>
          <input type="text" id="pol-threshold" value="${pol ? pol.threshold : ''}" placeholder="e.g. >= 80, N/A">
        </div>
      </div>
      <div class="form-group" style="margin-top:10px">
        <label>Mitigation Action</label>
        <select id="pol-action" style="height:38px;">
          <option value="BLOCK" ${pol?.action==='BLOCK'?'selected':''}>BLOCK (403 Forbidden)</option>
          <option value="CHALLENGE" ${pol?.action==='CHALLENGE'?'selected':''}>CHALLENGE (Captcha challenge)</option>
          <option value="FLAG" ${pol?.action==='FLAG'?'selected':''}>FLAG (Allow and flag only)</option>
        </select>
      </div>
    `;

    const footer = `
      <button class="btn btn-sm" onclick="closeDrawer()">Cancel</button>
      <button class="btn-sm btn-primary" onclick="savePolicyDetails('${policyId}')">Save Changes</button>
    `;

    openDrawer(title, html, footer);
  }
  window.openPolicyDrawer = openPolicyDrawer;

  function savePolicyDetails(policyId) {
    const name = document.getElementById('pol-name').value.trim();
    const trigger = document.getElementById('pol-trigger').value.trim();
    const threshold = document.getElementById('pol-threshold').value.trim();
    const action = document.getElementById('pol-action').value;
    
    if (!name || !trigger) {
      alert('Policy Name and Match Attribute are required.');
      return;
    }

    if (policyId === 'new') {
      const newPol = {
        id: 'pol-' + Math.random().toString(36).substr(2, 9),
        name, trigger, threshold, action, enabled: true
      };
      systemPolicies.push(newPol);
    } else {
      const pol = systemPolicies.find(p => p.id === policyId);
      if (pol) {
        pol.name = name;
        pol.trigger = trigger;
        pol.threshold = threshold;
        pol.action = action;
      }
    }
    
    savePolicies();
    closeDrawer();
    loadPolicies();
  }
  window.savePolicyDetails = savePolicyDetails;

  document.getElementById('addPolicyBtn')?.addEventListener('click', () => {
    openPolicyDrawer('new');
  });
})();

