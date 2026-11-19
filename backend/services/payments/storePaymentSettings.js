'use strict';

const { query } = require('../../src/infrastructure/config/database');
const { buildPixPayload, normalizePixKey } = require('./pixBrCode');

function sanitizePixSettings(input = {}) {
  const enabled = input.enabled !== false;
  const keyType = String(input.keyType || '').trim();
  const merchantName = String(input.merchantName || '').trim().slice(0, 25);
  const merchantCity = String(input.merchantCity || '').trim().slice(0, 15);
  const key = normalizePixKey(keyType, input.key);
  if (!merchantName) throw new Error('Nome do favorecido é obrigatório.');
  if (!merchantCity) throw new Error('Cidade do favorecido é obrigatória.');
  return { enabled, keyType, key, merchantName, merchantCity, updatedAt: new Date().toISOString() };
}

async function getStorePixSettings(companyId, storeId) {
  const result = await query(
    `SELECT settings->'payment'->'pix' AS pix FROM ai_stores WHERE company_id = $1 AND id = $2`,
    [companyId, storeId]
  );
  if (!result.rows[0]) return undefined;
  return result.rows[0].pix || null;
}

async function saveStorePixSettings(companyId, storeId, input) {
  const pix = sanitizePixSettings(input);
  const result = await query(
    `UPDATE ai_stores
       SET settings = jsonb_set(
         jsonb_set(COALESCE(settings, '{}'::jsonb), '{payment}', COALESCE(settings->'payment', '{}'::jsonb), true),
         '{payment,pix}', $3::jsonb, true)
     WHERE company_id = $1 AND id = $2
     RETURNING settings->'payment'->'pix' AS pix`,
    [companyId, storeId, JSON.stringify(pix)]
  );
  return result.rows[0]?.pix;
}

async function removeStorePixSettings(companyId, storeId) {
  const result = await query(
    `UPDATE ai_stores SET settings = COALESCE(settings, '{}'::jsonb) #- '{payment,pix}'
     WHERE company_id = $1 AND id = $2 RETURNING id`,
    [companyId, storeId]
  );
  return Boolean(result.rows[0]);
}

async function resolveStoreIdForSession(companyId, sessionId) {
  if (!sessionId) return null;
  const result = await query(
    `SELECT store_id FROM session_ai_profiles WHERE company_id = $1 AND session_id = $2 AND store_id IS NOT NULL`,
    [companyId, sessionId]
  );
  return result.rows[0]?.store_id || null;
}

async function resolvePixConfig({ companyId, storeId, sessionId }) {
  const targetStoreId = storeId || (await resolveStoreIdForSession(companyId, sessionId));
  if (!targetStoreId) return { storeId: null, pix: null };
  const pix = await getStorePixSettings(companyId, targetStoreId);
  return { storeId: targetStoreId, pix: pix && pix.enabled !== false ? pix : null };
}

function buildStorePixPayload(pix, { amount, txid, description } = {}) {
  return buildPixPayload({ ...pix, amount, txid, description });
}

module.exports = {
  sanitizePixSettings,
  getStorePixSettings,
  saveStorePixSettings,
  removeStorePixSettings,
  resolveStoreIdForSession,
  resolvePixConfig,
  buildStorePixPayload,
};