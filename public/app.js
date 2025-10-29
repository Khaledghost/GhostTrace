const API_BASE = '/api';

let currentSection = 'dashboard';

// Show section
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    
    // Find and highlight the clicked button
    document.querySelectorAll(`.nav-link[data-section="${sectionId}"]`).forEach(btn => {
        btn.classList.add('active');
    });
    
    currentSection = sectionId;
    
    // Load section-specific data
    if (sectionId === 'logs') {
        refreshLogs();
    } else if (sectionId === 'dashboard') {
        loadDashboard();
    }
}

async function loadDashboard() {
    try {
        document.getElementById('totalProfiles').textContent = '0';
        document.getElementById('pendingThreats').textContent = '0';
        document.getElementById('criticalThreats').textContent = '0';
        document.getElementById('totalActivities').textContent = '0';
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Track activity form
document.getElementById('trackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const resultBox = document.getElementById('trackResult');
    resultBox.innerHTML = '<p class="loading">TRACKING...</p>';
    
    const activityData = {
        accountId: document.getElementById('accountId').value,
        userId: document.getElementById('userId').value,
        activityType: document.getElementById('activityType').value,
        ipAddress: document.getElementById('ipAddress').value || '192.168.1.100',
        location: {
            country: 'US',
            city: document.getElementById('location').value || 'Unknown',
            coordinates: { lat: 40.7128, lon: -74.0060 }
        },
        deviceInfo: {
            deviceId: 'dev-' + Math.random().toString(36).substr(2, 9),
            deviceType: document.getElementById('deviceInfo').value || 'desktop',
            browser: 'Chrome',
            os: 'Windows'
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}/behavior/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(activityData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultBox.innerHTML = `
                <div style="color: #00ff00;">
                    <p style="text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">
                        <span style="color: #00ff00;">●</span> ACTIVITY TRACKED
                    </p>
                    <pre>${JSON.stringify(data.data, null, 2)}</pre>
                </div>
            `;
            
            // Update dashboard indicators
            const dot = document.querySelector('.nav-brand .status-dot');
            if (dot) {
                dot.classList.remove('green', 'red');
                dot.classList.add('green', 'pulse');
                setTimeout(() => dot.classList.remove('pulse'), 2000);
            }
            
            // Now analyze for threats
            try {
                const analyzeResponse = await fetch(`${API_BASE}/threats/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(activityData)
                });
                
                const analyzeData = await analyzeResponse.json();
                
                if (analyzeData.data.isThreat) {
                    resultBox.innerHTML += `
                        <div style="margin-top: 1rem; padding: 1rem; background: #1a0000; border: 1px solid #ff0000;">
                            <p style="text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; color: #ff0000;">
                                <span style="color: #ff0000;">●</span> THREAT DETECTED
                            </p>
                            <p style="color: #fff; margin: 0.25rem 0;"><strong>RISK:</strong> ${analyzeData.data.riskScore}</p>
                            <p style="color: #fff; margin: 0.25rem 0;"><strong>LEVEL:</strong> ${analyzeData.data.threatLevel}</p>
                            <p style="color: #fff; margin: 0.25rem 0;"><strong>ANOMALIES:</strong> ${analyzeData.data.anomalies.length}</p>
                        </div>
                    `;
                    
                    // Update dashboard indicators
                    const dot = document.querySelector('.nav-brand .status-dot');
                    if (dot) {
                        dot.classList.remove('green', 'yellow', 'pulse');
                        dot.classList.add('red', 'pulse');
                        setTimeout(() => dot.classList.remove('pulse'), 2000);
                    }
                } else {
                    resultBox.innerHTML += `
                        <div style="margin-top: 1rem; padding: 1rem; background: #001a00; border: 1px solid #00ff00;">
                            <p style="text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; color: #00ff00;">
                                <span style="color: #00ff00;">●</span> NO THREATS
                            </p>
                            <p style="color: #fff;"><strong>RISK:</strong> ${analyzeData.data.riskScore}</p>
                        </div>
                    `;
                }
            } catch (err) {
                console.error('Error analyzing threats:', err);
            }
        } else {
            resultBox.innerHTML = `<div style="color: #ff0000;">ERROR: ${data.error || 'UNKNOWN'}</div>`;
        }
    } catch (error) {
        resultBox.innerHTML = `<div style="color: #ff0000;">ERROR: ${error.message}</div>`;
        
        // Update dashboard indicators
        const dot = document.querySelector('.nav-brand .status-dot');
        if (dot) {
            dot.classList.remove('green', 'pulse');
            dot.classList.add('red', 'pulse');
            setTimeout(() => dot.classList.remove('pulse'), 2000);
        }
    }
});

// Refresh logs
async function refreshLogs() {
    const container = document.getElementById('logsContainer');
    container.innerHTML = '<p class="loading">LOADING...</p>';
    
    try {
        const filter = document.getElementById('logFilter').value;
        const url = `${API_BASE}/logger/logs${filter ? `?method=${filter}` : ''}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            container.innerHTML = data.data.map(log => `
                <div class="log-entry">
                    <div class="log-header">
                        <div>
                            <span class="log-method method-${log.method}">${log.method}</span>
                            <span class="log-path">${log.path}</span>
                        </div>
                        <div>
                            <span class="log-status status-${Math.floor(log.statusCode / 100)}">${log.statusCode}</span>
                        </div>
                    </div>
                    <div class="log-details">
                        <div><strong>Time:</strong> ${new Date(log.timestamp).toLocaleString()}</div>
                        <div><strong>Response:</strong> ${log.responseTime}ms</div>
                        <div><strong>IP:</strong> ${log.ip}</div>
                        ${log.responseSize ? `<div><strong>Size:</strong> ${log.responseSize} bytes</div>` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <p>NO LOGS AVAILABLE</p>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `<div style="color: #ff0000;">ERROR: ${error.message}</div>`;
    }
}

// Clear logs
async function clearLogs() {
    if (!confirm('Clear all logs?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/logger/logs`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            refreshLogs();
        }
    } catch (error) {
        console.error('Error clearing logs:', error);
    }
}

// Add event listeners
function initializeEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });
    
    // Dashboard action buttons
    document.querySelectorAll('.btn[data-section]').forEach(btn => {
        btn.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });
    
    // Log controls
    document.getElementById('refreshLogsBtn')?.addEventListener('click', refreshLogs);
    document.getElementById('clearLogsBtn')?.addEventListener('click', clearLogs);
    
    // Log filter
    document.getElementById('logFilter')?.addEventListener('change', refreshLogs);
}

// Initial load
window.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadDashboard();
});
