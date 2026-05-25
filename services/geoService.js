const EventEmitter = require('events');
const geoip = require('geoip-lite');
const geoGlobe = require('../core/geoGlobe');

function routeStatusClass(statusCode) {
  const code = parseInt(statusCode, 10);
  if (!code) return 'other';
  if (code >= 200 && code < 300) return '200';
  if (code === 301 || code === 302) return '301';
  if (code === 404) return '404';
  if (code >= 400) return '404';
  return 'other';
}

class GeoService extends EventEmitter {
  constructor() {
    super();
    this._enabled = process.env.GEO_LOOKUP !== 'false';
    this._server = {
      lat: parseFloat(process.env.GEO_SERVER_LAT || '51.5074', 10),
      lon: parseFloat(process.env.GEO_SERVER_LON || '-0.1278', 10),
      label: process.env.GEO_SERVER_LABEL || 'Protected App',
    };
    setInterval(() => geoGlobe.prune(), 30000);
  }

  getServerGeo() {
    return { ...this._server, geo: [this._server.lat, this._server.lon] };
  }

  formatVisitorEvent(hit) {
    return {
      visitor: {
        ip: hit.ip,
        city: hit.city,
        country: hit.country,
        geo: [hit.lat, hit.lon],
      },
      server: this.getServerGeo(),
      status: routeStatusClass(hit.statusCode),
      statusCode: hit.statusCode,
      method: hit.method,
      url: hit.path,
      responseTime: hit.responseTime,
      ts: hit.ts || Date.now(),
    };
  }

  normalizeIp(raw) {
    if (!raw) return null;
    let ip = String(raw).split(',')[0].trim();
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    if (ip === '::1') ip = '127.0.0.1';
    if (ip.startsWith('::')) return null;
    return ip;
  }

  isPrivateIp(ip) {
    if (!ip) return true;
    if (ip === '127.0.0.1' || ip === 'localhost') return true;
    if (/^10\./.test(ip)) return true;
    if (/^192\.168\./.test(ip)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
    if (/^169\.254\./.test(ip)) return true;
    return false;
  }

  lookup(ip) {
    const normalized = this.normalizeIp(ip);
    if (!normalized) {
      return { ip: ip || null, lat: 0, lon: 0, city: 'Local', country: 'LAN', region: '', private: true };
    }

    if (this.isPrivateIp(normalized)) {
      return {
        ip: normalized,
        lat: 51.5,
        lon: -0.12,
        city: 'Local Network',
        country: 'LAN',
        region: 'private',
        private: true,
      };
    }

    if (!this._enabled) {
      return { ip: normalized, lat: null, lon: null, city: null, country: null, private: false };
    }

    const hit = geoip.lookup(normalized);
    if (!hit) {
      return { ip: normalized, lat: null, lon: null, city: 'Unknown', country: '??', private: false };
    }

    return {
      ip: normalized,
      lat: hit.ll[0],
      lon: hit.ll[1],
      city: hit.city || 'Unknown',
      country: hit.country || '??',
      region: hit.region || '',
      timezone: hit.timezone,
      private: false,
    };
  }

  trackRequest(req, meta = {}) {
    const ip = this.normalizeIp(
      req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress
    );
    const geo = this.lookup(ip);
    const event = {
      ...geo,
      method: meta.method || req.method,
      path: meta.path || req.path || req.originalUrl?.split('?')[0],
      statusCode: meta.statusCode,
      responseTime: meta.responseTime,
      ts: Date.now(),
      routeStatus: routeStatusClass(meta.statusCode),
    };

    if (geo.lat != null && geo.lon != null) {
      geoGlobe.addPoint(event);
      this.emit('visitor', this.formatVisitorEvent(event));
    }

    this.emit('hit', event);
    return event;
  }

  getGlobe() {
    return geoGlobe.getFrame();
  }
}

module.exports = new GeoService();
