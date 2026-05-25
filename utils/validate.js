const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_RE.test(normalized) || normalized.length > 255) {
    throw new Error('A valid email address is required');
  }
  return normalized;
}

function assertPassword(password, { min = 8, label = 'Password' } = {}) {
  const p = String(password || '');
  if (p.length < min) {
    throw new Error(`${label} must be at least ${min} characters`);
  }
  if (p.length > 128) {
    throw new Error(`${label} is too long`);
  }
  return p;
}

function assertUuid(id, label = 'ID') {
  const s = String(id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    throw new Error(`Invalid ${label}`);
  }
  return s;
}

function assertUrl(url, label = 'URL') {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch (_) {
    throw new Error(`Invalid ${label}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use http or https`);
  }
  return parsed.toString();
}

function clampInt(value, { min = 1, max = 500, fallback = 50 } = {}) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

module.exports = {
  assertEmail,
  assertPassword,
  assertUuid,
  assertUrl,
  normalizeEmail,
  clampInt,
};
