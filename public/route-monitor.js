(() => {
'use strict';

window.RouteMonitor = {
  currentPage: 0,
  pageSize: 50,
  allLogs: [],
  currentTab: 'logs',

  async init() {
    console.log('[RouteMonitor] Initializing...');
    await this.refresh();
    // Auto-refresh every 10 seconds
    setInterval(() => this.refresh(), 10000);
  },

  async refresh() {
    await this.loadStats();
    if (this.currentTab === 'logs') {
      await this.loadLogs();
    } else {
      await this.loadRoutes();
    }
  },

  async loadStats() {
    try {
      const res = await fetch('/api/routes/stats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await res.json();
      
      if (data.success && data.stats) {
        document.getElementById('routeStatTotal').textContent = data.stats.totalRequests || 0;
        document.getElementById('routeStatBlocked').textContent = data.stats.blockedRequests || 0;
        document.getElementById('routeStatHighRisk').textContent = data.stats.highRiskRequests || 0;
        document.getElementById('routeStatIPs').textContent = data.stats.uniqueIPs || 0;
        document.getElementById('routeStatRegistered').textContent = data.stats.registeredRoutes || 0;
      }
    } catch (error) {
      console.error('[RouteMonitor] Failed to load stats:', error);
    }
  },

  async loadLogs() {
    try {
      const filters = {
        method: document.getElementById('routeFilterMethod')?.value || '',
        path: document.getElementById('routeFilterPath')?.value || '',
        ip: document.getElementById('routeFilterIP')?.value || '',
        blocked: document.getElementById('routeFilterBlocked')?.value || '',
        limit: 1000
      };

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, val);
      });

      const res = await fetch(`/api/routes/logs?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await res.json();
      
      if (data.success) {
        this.allLogs = data.logs || [];
        this.currentPage = 0;
        this.renderLogs();
      }
    } catch (error) {
      console.error('[RouteMonitor] Failed to load logs:', error);
      const tbody = document.getElementById('routeLogsBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load logs</td></tr>';
      }
    }
  },

  renderLogs() {
    const tbody = document.getElementById('routeLogsBody');
    if (!tbody) return;

    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    const pageLogs = this.allLogs.slice(start, end);

    if (pageLogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No requests logged yet</td></tr>';
      document.getElementById('routeLogsPagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = pageLogs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const date = new Date(log.timestamp).toLocaleDateString();
      const methodClass = this.getMethodClass(log.method);
      const riskClass = this.getRiskClass(log.riskScore);
      const statusDisplay = log.blocked 
        ? '<span class="badge badge-danger">BLOCKED</span>' 
        : `<span style="color: var(--success)">${log.statusCode || 200}</span>`;

      return `
        <tr>
          <td><small>${date}<br>${time}</small></td>
          <td><span class="badge ${methodClass}">${log.method}</span></td>
          <td><code style="font-size: 0.875rem;">${this.truncate(log.fullUrl || log.path, 50)}</code></td>
          <td><code style="font-size: 0.875rem;">${log.ip}</code></td>
          <td><span class="badge ${riskClass}">${log.riskScore || 0}</span></td>
          <td>${statusDisplay}</td>
          <td>
            <button class="btn-sm" onclick="window.RouteMonitor.viewLog('${log.id}')">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.renderPagination();
  },

  renderPagination() {
    const totalPages = Math.ceil(this.allLogs.length / this.pageSize);
    const pagination = document.getElementById('routeLogsPagination');
    if (!pagination) return;
    
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    const buttons = [];
    
    buttons.push(`
      <button class="btn-sm" onclick="window.RouteMonitor.changePage(0)" ${this.currentPage === 0 ? 'disabled' : ''}>
        <i class="fas fa-angles-left"></i>
      </button>
    `);
    
    buttons.push(`
      <button class="btn-sm" onclick="window.RouteMonitor.changePage(${this.currentPage - 1})" ${this.currentPage === 0 ? 'disabled' : ''}>
        <i class="fas fa-angle-left"></i>
      </button>
    `);
    
    buttons.push(`<span class="badge" style="padding: 0.5rem 1rem;">Page ${this.currentPage + 1} / ${totalPages}</span>`);
    
    buttons.push(`
      <button class="btn-sm" onclick="window.RouteMonitor.changePage(${this.currentPage + 1})" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>
        <i class="fas fa-angle-right"></i>
      </button>
    `);
    
    buttons.push(`
      <button class="btn-sm" onclick="window.RouteMonitor.changePage(${totalPages - 1})" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>
        <i class="fas fa-angles-right"></i>
      </button>
    `);

    pagination.innerHTML = buttons.join('');
  },

  changePage(page) {
    this.currentPage = page;
    this.renderLogs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async loadRoutes() {
    try {
      const res = await fetch('/api/routes/routes', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await res.json();
      
      const tbody = document.getElementById('routeRoutesBody');
      if (!tbody) return;
      
      if (data.success && data.routes && data.routes.length > 0) {
        tbody.innerHTML = data.routes.map(route => {
          const methodClass = this.getMethodClass(route.method);
          const registered = new Date(route.registeredAt).toLocaleString();
          const lastReq = route.lastRequest ? new Date(route.lastRequest).toLocaleString() : 'Never';
          
          return `
            <tr>
              <td><span class="badge ${methodClass}">${route.method}</span></td>
              <td><code>${route.path}</code></td>
              <td><small>${registered}</small></td>
              <td><span class="badge">${route.requestCount || 0}</span></td>
              <td><small>${lastReq}</small></td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No routes registered yet. Add ghosttrace.secure() to your routes.</td></tr>';
      }
    } catch (error) {
      console.error('[RouteMonitor] Failed to load routes:', error);
      const tbody = document.getElementById('routeRoutesBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load routes</td></tr>';
      }
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update tab content
    document.getElementById('routeTabLogs').classList.toggle('active', tab === 'logs');
    document.getElementById('routeTabRoutes').classList.toggle('active', tab === 'routes');
    
    // Load data for active tab
    if (tab === 'routes') {
      this.loadRoutes();
    } else {
      this.loadLogs();
    }
  },

  applyFilters() {
    this.currentPage = 0;
    this.loadLogs();
  },

  async viewLog(id) {
    try {
      const res = await fetch(`/api/routes/logs/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await res.json();
      
      if (data.success && data.log) {
        const log = data.log;
        const details = `
Request Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Time: ${new Date(log.timestamp).toLocaleString()}
Method: ${log.method}
Path: ${log.fullUrl}
IP: ${log.ip}
User Agent: ${log.userAgent}

Risk Score: ${log.riskScore}
Threat Level: ${log.threatLevel}
Blocked: ${log.blocked ? 'YES' : 'NO'}
Status Code: ${log.statusCode}

Query Params: ${JSON.stringify(log.query, null, 2)}
Route Params: ${JSON.stringify(log.params, null, 2)}
Body: ${JSON.stringify(log.body, null, 2)}

Anomalies: ${log.anomalies?.length || 0}
DNA: ${log.clientDNA}
        `.trim();
        
        alert(details);
      }
    } catch (error) {
      console.error('[RouteMonitor] Failed to load log details:', error);
      alert('Failed to load log details');
    }
  },

  getMethodClass(method) {
    const classes = {
      'GET': 'badge-success',
      'POST': 'badge-primary',
      'PUT': 'badge-warning',
      'DELETE': 'badge-danger',
      'PATCH': 'badge-info',
      'USE': 'badge-info',
    };
    return classes[method] || 'badge';
  },

  getRiskClass(score) {
    if (score >= 90) return 'badge-danger';
    if (score >= 70) return 'badge-warning';
    if (score >= 50) return 'badge-info';
    return 'badge-success';
  },

  truncate(str, len) {
    return str && str.length > len ? str.substring(0, len) + '...' : str;
  }
};

// Auto-initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[RouteMonitor] DOM ready, initializing...');
    window.RouteMonitor.init();
  });
} else {
  console.log('[RouteMonitor] DOM already ready, initializing...');
  window.RouteMonitor.init();
}

})();
