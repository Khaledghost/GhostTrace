const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function getKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) return null;
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptSecret(value) {
  if (value === undefined || value === null || value === '') return value;
  if (String(value).startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) throw new Error('DATA_ENCRYPTION_KEY or JWT_SECRET is required to encrypt secrets');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value) {
  if (!value || typeof value !== 'string') return value;
  if (!value.startsWith(PREFIX)) return value;
  const key = getKey();
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
};
