/**
 * Geo globe — tracks request hits by lat/lon for client-side map rendering.
 */

const MAX_POINTS = 300;
const POINT_TTL_MS = 120000;

/** Finer land regions [latMin, latMax, lonMin, lonMax] for equirectangular mask */
const LAND_REGIONS = [
  [-56, 13, -82, -34],   // South America
  [12, 72, -168, -52],   // North America
  [49, 72, -168, -52],   // Alaska
  [14, 32, -118, -76],   // Mexico/Central
  [35, 71, -12, 32],     // Europe
  [36, 72, 22, 60],      // Russia Europe
  [42, 82, 60, 180],     // Russia Asia
  [18, 54, 73, 135],     // China/East Asia
  [5, 28, 92, 110],      // SE Asia mainland
  [-11, 25, 95, 141],    // Indonesia/Philippines
  [30, 46, 129, 146],    // Japan
  [20, 38, 68, 90],      // India subcontinent
  [-35, 37, -18, 52],    // Africa
  [-35, -22, 12, 52],    // Southern Africa
  [-44, -10, 112, 154],  // Australia
  [-48, -34, 166, 179],  // NZ
  [60, 84, -75, -10],    // Greenland
  [55, 72, -25, 60],     // Scandinavia/Arctic fringe
  [25, 40, 34, 62],      // Middle East
  [-26, -12, 43, 50],    // Madagascar
  [17, 24, -88, -60],    // Caribbean
  [51, 59, -11, 2],      // UK/Ireland
  [40, 48, -6, 4],       // Iberia
  [37, 47, 7, 19],       // Italy
];

function isLand(lat, lon) {
  return LAND_REGIONS.some(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
}

class GeoGlobe {
  constructor() {
    this._points = [];
  }

  addPoint({ lat, lon, ip, city, country, method, path, ts = Date.now() }) {
    if (lat == null || lon == null) return null;
    const point = {
      lat, lon, ip, city, country, method, path, ts,
      id: `${ip}-${ts}`,
    };
    this._points.unshift(point);
    if (this._points.length > MAX_POINTS) this._points.length = MAX_POINTS;
    return point;
  }

  getFrame(now = Date.now()) {
    const active = this._points.filter((p) => now - p.ts < POINT_TTL_MS);
    return {
      liveCount: active.length,
      totalTracked: this._points.length,
      points: active.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        ip: p.ip,
        city: p.city,
        country: p.country,
        method: p.method,
        path: p.path,
        ageMs: now - p.ts,
        ts: p.ts,
      })),
      stats: this.getStats(now),
      recent: this.getRecent(30),
    };
  }

  getRecent(limit = 50) {
    return this._points.slice(0, limit).map((p) => ({
      lat: p.lat,
      lon: p.lon,
      ip: p.ip,
      city: p.city,
      country: p.country,
      method: p.method,
      path: p.path,
      ts: p.ts,
    }));
  }

  getStats(now = Date.now()) {
    const active = this._points.filter((p) => now - p.ts < POINT_TTL_MS);
    const byCountry = {};
    const byCity = {};
    active.forEach((p) => {
      const c = p.country || 'Unknown';
      byCountry[c] = (byCountry[c] || 0) + 1;
      if (p.city) {
        const key = `${p.city}, ${c}`;
        byCity[key] = (byCity[key] || 0) + 1;
      }
    });
    return {
      live: active.length,
      countries: Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 12),
      topCities: Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }

  prune() {
    const now = Date.now();
    this._points = this._points.filter((p) => now - p.ts < POINT_TTL_MS);
  }
}

module.exports = new GeoGlobe();
