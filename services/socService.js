const alertService = require('./alertService');
const incidentService = require('./incidentService');
const threatDetectionService = require('./threatDetectionService');
const { coverageMatrix } = require('../core/mitreMapper');
const { isDbReady } = require('../config/database');
const { Alert } = require('../models');

async function getCommandCenter() {
  let alertStats = { total: 0, byStatus: {}, bySeverity: {} };
  let incidentStats = { total: 0, byStatus: {} };
  let recentAlerts = [];

  try {
    [alertStats, incidentStats, recentAlerts] = await Promise.all([
      alertService.getStats(),
      incidentService.getStats(),
      alertService.recentForFeed(15),
    ]);
  } catch (err) {
    console.warn('[SOC] Alert/incident stats:', err.message);
  }

  const detectionStats = threatDetectionService.getAllStats();

  let mitreCoverage = {};
  try {
    if (isDbReady()) {
      const alerts = await Alert.findAll({
        attributes: ['mitreTactics', 'mitreTechniques', 'severity'],
        order: [['detectedAt', 'DESC']],
        limit: 500,
      });
      mitreCoverage = coverageMatrix(alerts.map((a) => a.toJSON()));
    } else {
      mitreCoverage = coverageMatrix(recentAlerts);
    }
  } catch (err) {
    console.warn('[SOC] MITRE coverage:', err.message);
    mitreCoverage = coverageMatrix(recentAlerts);
  }

  const openAlerts = (alertStats.byStatus?.new || 0) +
    (alertStats.byStatus?.acknowledged || 0) +
    (alertStats.byStatus?.investigating || 0);

  return {
    platform: 'GhostTrace SOC',
    version: require('../package.json').version,
    persistence: isDbReady() ? 'postgresql' : 'memory',
    kpis: {
      openAlerts,
      totalAlerts: alertStats.total,
      openIncidents: (incidentStats.byStatus?.open || 0) + (incidentStats.byStatus?.investigating || 0),
      totalIncidents: incidentStats.total,
      activeProfiles: detectionStats.totalProfiles,
      criticalProfiles: detectionStats.criticalProfiles,
      totalThreats: detectionStats.globalStats?.totalThreats || 0,
      requestsAnalyzed: detectionStats.globalStats?.totalRequests || 0,
      mttdMinutes: estimateMttd(recentAlerts),
    },
    alertStats,
    incidentStats,
    detectionStats,
    recentAlerts,
    mitreCoverage,
    anomalyBreakdown: detectionStats.globalStats?.anomalyBreakdown || {},
  };
}

function estimateMttd(alerts) {
  if (!alerts?.length) return 0;
  const acknowledged = alerts.filter((a) => a.acknowledgedAt);
  if (!acknowledged.length) return null;
  const avg = acknowledged.reduce((sum, a) => {
    const d = new Date(a.acknowledgedAt) - new Date(a.detectedAt);
    return sum + d;
  }, 0) / acknowledged.length;
  return Math.round(avg / 60000);
}

module.exports = { getCommandCenter };
