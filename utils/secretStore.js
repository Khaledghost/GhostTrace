const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PREFIX = 'enc:v1:';
let warnedMissingKey = false;
const REQUIRE_ENCRYPTION = process.env.GHOST_REQUIRE_ENCRYPTION === 'true';
const KEY_PATH = process.env.GHOST_ENCRYPTION_KEY_PATH
  || path.join(process.env.GHOST_DATA_DIR || './data', 'ghosttrace.key');

function ensureKeyPath() {
  const dir = path.dirname(KEY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadKeyFromFile() {
  if (!fs.existsSync(KEY_PATH)) return null;
  try {
    const raw = fs.readFileSync(KEY_PATH, 'utf8').trim();
    return raw || null;
  } catch (err) {
    console.warn(`Failed to read encryption key file: ${err.message}`);
    return null;
  }
}

function writeKeyToFile(key) {
  try {
    ensureKeyPath();
    fs.writeFileSync(KEY_PATH, key, { mode: 0o600 });
    return true;
  } catch (err) {
    console.warn(`Failed to persist encryption key: ${err.message}`);
    return false;
  }
}

function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

function getKey({ allowGenerate = true } = {}) {
  const raw = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (raw) {
    return crypto.createHash('sha256').update(String(raw)).digest();
  }

  const fileKey = loadKeyFromFile();
  if (fileKey) {
    return crypto.createHash('sha256').update(String(fileKey)).digest();
  }

  if (!allowGenerate) return null;

  const newKey = generateKey();
  if (writeKeyToFile(newKey)) {
    console.log(`  ✓ Generated encryption key at ${KEY_PATH}`);
  }
  return crypto.createHash('sha256').update(String(newKey)).digest();
}

function encryptSecret(value) {
  if (value === undefined || value === null || value === '') return value;
  if (String(value).startsWith(PREFIX)) return value;
  const key = getKey({ allowGenerate: true });
  if (!key) {
    if (REQUIRE_ENCRYPTION) {
      throw new Error('DATA_ENCRYPTION_KEY or JWT_SECRET is required to encrypt secrets');
    }
    if (!warnedMissingKey) {
      console.warn('Missing DATA_ENCRYPTION_KEY/JWT_SECRET; storing secret in plaintext.');
      warnedMissingKey = true;
    }
    return value;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value) {
  if (!value || typeof value !== 'string') return value;
  if (!value.startsWith(PREFIX)) return value;
  const key = getKey({ allowGenerate: false });
  if (!key) {
    console.warn('Missing DATA_ENCRYPTION_KEY/JWT_SECRET; cannot decrypt stored secret.');
    return null;
  }
  const payload = value.slice(PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  try {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('Failed to decrypt stored secret:', err.message);
    return null;
  }
}

module.exports = {
  encryptSecret,
  decryptSecret,
  PREFIX,
  getKey,
};
