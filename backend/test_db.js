const { Pool } = require('pg');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const IV_LENGTH = 16;

function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY || '';
  return crypto.createHash('sha256').update(rawKey).digest();
}

function decrypt(text) {
  if (!text) return '';
  if (!text.includes(':')) {
    return text;
  }
  const currentKey = getEncryptionKey();
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', currentKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    try {
      const legacyKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'ZAPFLOW_SECURE_SALT_KEY_2026').digest();
      const parts = text.split(':');
      const iv = Buffer.from(parts.shift(), 'hex');
      const encryptedText = Buffer.from(parts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      console.warn('[CRYPTO] Decrypted using legacy fallback key.');
      return decrypted.toString();
    } catch (legacyErr) {
      console.error('[CRYPTO-DECRYPT-FATAL] Decryption failed for both keys! Error:', legacyErr.message);
      throw new Error('DECRYPTION_FAILED');
    }
  }
}

async function main() {
  try {
    const providers = await pool.query('SELECT provider, api_key, model FROM provider_keys LIMIT 1');
    if (providers.rows.length === 0) {
      console.log('No providers found.');
      return;
    }
    const row = providers.rows[0];
    console.log('Encrypted API Key:', row.api_key);
    try {
      const decrypted = decrypt(row.api_key);
      console.log('Decrypted API Key successfully!', decrypted ? (decrypted.substring(0, 10) + '...') : 'empty');
    } catch (err) {
      console.error('Decryption failed! Error:', err.message);
    }
  } catch (err) {
    console.error('Database Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
