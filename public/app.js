const API_BASE = 'http://localhost:3000/api';

let currentSection = 'dashboard';

// Show section
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    currentSection = sectionId;
    
    // Load section-specific data
    if (sectionId === 'logs') {
        refreshLogs();
    } else if (sectionId === 'dashboard') {
        loadDashboard();
    }
}

// Load dashboard stats
async function loadDashboard() {
    try {
        // Since we don't have actual user data, show placeholder stats
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
    resultBox.innerHTML = '<p class="loading">Tracking activity...</p>';
    
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
                <div style="color: #28a745;">
                    <h4>✓ Activity Tracked Successfully</h4>
                    <pre style="margin-top: 0.5rem; white-space: pre-wrap;">${JSON.stringify(data.data, null, 2)}</pre>
                </div>
            `;
            
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
                        <div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                            <h4>⚠️ Threat Detected!</h4>
                            <p><strong>Risk Score:</strong> ${analyzeData.data.riskScore}</p>
                            <p><strong>Threat Level:</strong> ${analyzeData.data.threatLevel}</p>
                            <p><strong>Anomalies:</strong> ${analyzeData.data.anomalies.length}</p>
                        </div>
                    `;
                } else {
                    resultBox.innerHTML += `
                        <div style="margin-top: 1rem; padding: 1rem; background: #d4edda; border-radius: 8px; border-left: 4px solid #28a745;">
                            <p><strong>No threats detected</strong></p>
                            <p>Risk Score: ${analyzeData.data.riskScore}</p>
                        </div>
                    `;
                }
            } catch (err) {
                console.error('Error analyzing threats:', err);
            }
        } else {
            resultBox.innerHTML = `<div style="color: #dc3545;">Error: ${data.error || 'Unknown error'}</div>`;
        }
    } catch (error) {
        resultBox.innerHTML = `<div style="color: #dc3545;">Error: ${error.message}</div>`;
    }
});

// Refresh logs
async function refreshLogs() {
    const container = document.getElementById('logsContainer');
    container.innerHTML = '<p class="loading">Loading logs...</p>';
    
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
                    <div class="empty-state-icon">📝</div>
                    <p>No logs available</p>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `<div style="color: #dc3545;">Error loading logs: ${error.message}</div>`;
    }
}

// Clear logs
async function clearLogs() {
    if (!confirm('Are you sure you want to clear all logs?')) {
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

// Initial load
window.onload = () => {
    loadDashboard();
};

