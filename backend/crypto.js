const crypto = require('crypto');

let key;

function ensureKey() {
  if (key) return key;

  const rawKey = process.env.USER_WALLET_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error(
      'USER_WALLET_ENCRYPTION_KEY is not set; cannot encrypt or decrypt user wallet keys'
    );
  }

  key = crypto.createHash('sha256').update(rawKey).digest();
  return key;
}

function encryptSecret(secret) {
  const key = ensureKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decryptSecret(payload) {
  const key = ensureKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = {
  encryptSecret,
  decryptSecret,
};
