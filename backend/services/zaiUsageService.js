'use strict';

/**
 * zaiUsageService — Gestor de Quota Diária e Saldo do Provedor ZAI
 *
 * Regras de Negócio:
 * 1. Administradores (admin, master):
 *    - Uso 100% ILIMITADO e liberado.
 *    - Não consome cotas diárias, não pede recarga de saldo.
 * 2. Usuários comuns (user, operator):
 *    - Cota gratuita diária: 50 mensagens/respostas por dia.
 *    - Ao atingir o limite diário gratuito, exige saldo/recarga para continuar.
 *    - Resiliente: grava no PostgreSQL com fallback transparente para memória.
 */

const inMemoryStore = new Map();
let tableInitialized = false;

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureTable() {
  if (tableInitialized) return;
  try {
    const { query } = require('../src/infrastructure/config/database');
    await query(`
      CREATE TABLE IF NOT EXISTS zai_daily_usage (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100) NOT NULL DEFAULT 'default',
        usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
        count INT NOT NULL DEFAULT 0,
        credits_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_zai_tenant_user_date UNIQUE (tenant_id, user_id, usage_date)
      );
      CREATE INDEX IF NOT EXISTS idx_zai_usage_tenant_date ON zai_daily_usage(tenant_id, usage_date);
    `);
    tableInitialized = true;
  } catch (err) {
    console.warn('[ZAI USAGE] Tabela zai_daily_usage em modo memória fallback:', err.message);
  }
}

function isAdminRole(role) {
  const norm = String(role || '').toLowerCase().trim();
  return norm === 'admin' || norm === 'master' || norm === 'superadmin';
}

async function getUsage({ companyId = 'default', userId = 'default', role = 'user' }) {
  const isAdmin = isAdminRole(role);
  if (isAdmin) {
    return {
      isAdmin: true,
      isUnlimited: true,
      countToday: 0,
      limitToday: 'unlimited',
      remainingToday: 'unlimited',
      balanceCredits: 999999,
      canUse: true,
      message: 'Conta Administrador: Uso Ilimitado Liberado no Provedor ZAI',
    };
  }

  const freeLimit = Number(process.env.ZAI_FREE_DAILY_LIMIT || 50);
  const today = getTodayString();
  const cacheKey = `${companyId}:${userId}:${today}`;

  await ensureTable();

  let countToday = 0;
  let balanceCredits = 0;

  try {
    const { query } = require('../src/infrastructure/config/database');
    const { rows } = await query(
      `SELECT count, credits_balance FROM zai_daily_usage 
       WHERE tenant_id = $1 AND user_id = $2 AND usage_date = $3 LIMIT 1`,
      [companyId, userId, today]
    );

    if (rows && rows.length > 0) {
      countToday = Number(rows[0].count || 0);
      balanceCredits = Number(rows[0].credits_balance || 0);
    } else {
      // Procurar saldo recente acumulado de recargas
      const balanceRows = await query(
        `SELECT credits_balance FROM zai_daily_usage 
         WHERE tenant_id = $1 AND user_id = $2 AND credits_balance > 0 
         ORDER BY id DESC LIMIT 1`,
        [companyId, userId]
      );
      if (balanceRows && balanceRows.rows.length > 0) {
        balanceCredits = Number(balanceRows.rows[0].credits_balance || 0);
      }
    }
  } catch (_) {
    const mem = inMemoryStore.get(cacheKey) || { count: 0, credits: 0 };
    countToday = mem.count;
    balanceCredits = mem.credits;
  }

  const remainingToday = Math.max(0, freeLimit - countToday);
  const canUse = countToday < freeLimit || balanceCredits > 0;

  return {
    isAdmin: false,
    isUnlimited: false,
    countToday,
    limitToday: freeLimit,
    remainingToday,
    balanceCredits,
    canUse,
    message: canUse
      ? `Plano Gratuito: ${countToday}/${freeLimit} mensagens hoje (${remainingToday} restantes)`
      : `Limite diário gratuito de ${freeLimit} mensagens atingido. Adicione saldo para continuar.`,
  };
}

async function consumeUsage({ companyId = 'default', userId = 'default', role = 'user' }) {
  const isAdmin = isAdminRole(role);
  if (isAdmin) {
    return { ok: true, isUnlimited: true, source: 'admin_bypass' };
  }

  const freeLimit = Number(process.env.ZAI_FREE_DAILY_LIMIT || 50);
  const today = getTodayString();
  const cacheKey = `${companyId}:${userId}:${today}`;

  const currentUsage = await getUsage({ companyId, userId, role });
  if (!currentUsage.canUse) {
    return {
      ok: false,
      quotaExceeded: true,
      error: `Limite diário gratuito do Provedor ZAI atingido (${freeLimit}/${freeLimit} mensagens). Adicione saldo à sua conta para continuar hoje ou contate o administrador.`,
      currentUsage,
    };
  }

  const isFree = currentUsage.countToday < freeLimit;
  const newCount = isFree ? currentUsage.countToday + 1 : currentUsage.countToday;
  const newCredits = isFree ? currentUsage.balanceCredits : Math.max(0, currentUsage.balanceCredits - 1);

  try {
    const { query } = require('../src/infrastructure/config/database');
    await query(
      `INSERT INTO zai_daily_usage (tenant_id, user_id, usage_date, count, credits_balance, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, user_id, usage_date)
       DO UPDATE SET 
         count = $4,
         credits_balance = $5,
         updated_at = NOW()`,
      [companyId, userId, today, newCount, newCredits]
    );
  } catch (err) {
    inMemoryStore.set(cacheKey, { count: newCount, credits: newCredits, date: today });
  }

  return {
    ok: true,
    isUnlimited: false,
    source: isFree ? 'free_daily_quota' : 'credits_balance',
    countToday: newCount,
    limitToday: freeLimit,
    remainingToday: Math.max(0, freeLimit - newCount),
    balanceCredits: newCredits,
  };
}

async function rechargeBalance({ companyId = 'default', userId = 'default', amount = 10 }) {
  const numAmount = Math.max(1, Number(amount) || 10);
  const today = getTodayString();
  const cacheKey = `${companyId}:${userId}:${today}`;

  await ensureTable();

  let newCredits = numAmount;
  try {
    const { query } = require('../src/infrastructure/config/database');
    const existing = await query(
      `SELECT credits_balance FROM zai_daily_usage 
       WHERE tenant_id = $1 AND user_id = $2 AND usage_date = $3 LIMIT 1`,
      [companyId, userId, today]
    );
    if (existing && existing.rows.length > 0) {
      newCredits = Number(existing.rows[0].credits_balance || 0) + numAmount;
    }
    await query(
      `INSERT INTO zai_daily_usage (tenant_id, user_id, usage_date, count, credits_balance, updated_at)
       VALUES ($1, $2, $3, 0, $4, NOW())
       ON CONFLICT (tenant_id, user_id, usage_date)
       DO UPDATE SET credits_balance = zai_daily_usage.credits_balance + $5, updated_at = NOW()`,
      [companyId, userId, today, newCredits, numAmount]
    );
  } catch (_) {
    const mem = inMemoryStore.get(cacheKey) || { count: 0, credits: 0 };
    newCredits = mem.credits + numAmount;
    inMemoryStore.set(cacheKey, { count: mem.count, credits: newCredits, date: today });
  }

  return getUsage({ companyId, userId, role: 'user' });
}

module.exports = {
  getUsage,
  consumeUsage,
  rechargeBalance,
  isAdminRole,
};
