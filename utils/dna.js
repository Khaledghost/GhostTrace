const crypto = require('crypto');

function normalize(str) {
  return (str || '').toString().trim().toLowerCase();
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    ''
  );
}

// Extract higher-level patterns/features from request headers
function extractPatterns(req) {
  const ua = (req.headers['user-agent'] || '').toString();
  const secChUa = (req.headers['sec-ch-ua'] || '').toString();
  const platformHdr = (req.headers['sec-ch-ua-platform'] || '').toString();
  const lang = normalize(req.headers['accept-language'] || '').split(',')[0];
  const ip = normalize(getClientIp(req));
  const screen = (req.headers['x-client-screen'] || '').toString(); // WIDTHxHEIGHT@DPR
  const tz = (req.headers['x-client-tz'] || '').toString(); // e.g., UTC+2

  // UA family
  const browser = /chrome|chromium|crios/i.test(ua) || /chrom/i.test(secChUa) ? 'chrome'
    : /safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua) ? 'safari'
    : /firefox|fxios/i.test(ua) ? 'firefox'
    : /edg/i.test(ua) ? 'edge'
    : /opera|opr/i.test(ua) ? 'opera'
    : 'other';

  // OS
  const os = /windows/i.test(ua) || /"Windows"/i.test(platformHdr) ? 'windows'
    : /mac os|macos|darwin/i.test(ua) || /"macos"/i.test(platformHdr) ? 'macos'
    : /linux/i.test(ua) || /"linux"/i.test(platformHdr) ? 'linux'
    : /android/i.test(ua) ? 'android'
    : /iphone|ipad|ios/i.test(ua) ? 'ios'
    : 'other';

  // Device class
  const deviceClass = /mobile/i.test(ua) || /\?1";v=/.test(req.headers['sec-ch-ua-mobile'] || '') ? 'mobile'
    : /tablet|ipad/i.test(ua) ? 'tablet'
    : 'desktop';

  // Screen buckets
  let screenBucket = 'unknown';
  if (screen) {
    const m = screen.match(/(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?/i);
    if (m) {
      const w = parseInt(m[1], 10);
      screenBucket = w >= 1800 ? 'xl' : w >= 1400 ? 'lg' : w >= 1000 ? 'md' : 'sm';
    }
  }

  // Timezone bucket
  let tzBucket = 'unknown';
  if (/^utc[+-]?\d+/i.test(tz)) {
    const off = parseInt(tz.replace(/utc/i, ''), 10) || 0;
    tzBucket = off >= 6 ? 'east' : off <= -6 ? 'west' : 'central';
  }

  // IP class (very rough)
  const ipClass = ip.startsWith('127.') || ip.startsWith('::1') ? 'loopback'
    : ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.') ? 'private'
    : ip ? 'public' : 'unknown';

  // Request timing bucket (hour of day)
  const hour = new Date().getUTCHours();
  const hourBucket = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  // Path shape (replace numbers and GUID-like tokens)
  const path = (req.originalUrl || '/').split('?')[0];
  const pathShape = path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':uuid')
    .replace(/\b\d+\b/g, ':num')
    .toLowerCase();

  return { browser, os, deviceClass, lang, screenBucket, tzBucket, ipClass, hourBucket, pathShape };
}

// Build a stable fingerprint payload from request properties + extracted patterns
function buildFingerprintPayload(req) {
  const patterns = extractPatterns(req);
  return JSON.stringify({
    ua: normalize(req.headers['user-agent']),
    accept: normalize(req.headers['accept']),
    lang: normalize(req.headers['accept-language']),
    enc: normalize(req.headers['accept-encoding']),
    dnt: normalize(req.headers['dnt']),
    secChUa: normalize(req.headers['sec-ch-ua']),
    secChUaMobile: normalize(req.headers['sec-ch-ua-mobile']),
    secChUaPlat: normalize(req.headers['sec-ch-ua-platform']),
    ip: normalize(getClientIp(req)),
    screen: normalize(req.headers['x-client-screen'] || ''),
    tz: normalize(req.headers['x-client-tz'] || ''),
    patterns
  });
}

function hashSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Generate a deterministic DNA for a client request without DB
function generateClientDNA(req) {
  const explicit = normalize(req.headers['x-client-dna']);
  if (explicit) return explicit;
  const payload = buildFingerprintPayload(req);
  return hashSha256(payload);
}

// Build a full DNA object with features + id
function generateClientDNAObject(req) {
  const id = generateClientDNA(req);
  const features = extractPatterns(req);
  return { id, features };
}

module.exports = {
  generateClientDNA,
  generateClientDNAObject,
  buildFingerprintPayload,
  extractPatterns
};


