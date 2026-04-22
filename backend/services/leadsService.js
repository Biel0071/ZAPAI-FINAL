const db = require('../config/database');

const memoryFallbackRecords = [];
let nextId = 1;

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

async function listLeads(companyId) {
  const targetCompanyId = getCompanyId(companyId);

  try {
    const result = await db.query(
      `
        SELECT id, company_id, name, phone, created_at
        FROM leads
        WHERE company_id = $1
        ORDER BY created_at DESC
      `,
      [targetCompanyId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name || 'Lead sem nome',
      phone: row.phone || null,
      companyId: row.company_id,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.warn('[LEADS] Failed to read from PostgreSQL, using memory fallback:', error.message || error);
    return memoryFallbackRecords;
  }
}

async function getLeadsById(id, companyId) {
  const targetCompanyId = getCompanyId(companyId);

  try {
    const result = await db.query(
      `
        SELECT id, company_id, name, phone, created_at
        FROM leads
        WHERE id = $1 AND company_id = $2
        LIMIT 1
      `,
      [Number(id), targetCompanyId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name || 'Lead sem nome',
      phone: row.phone || null,
      companyId: row.company_id,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.warn('[LEADS] Failed to read lead by id from PostgreSQL:', error.message || error);
    return memoryFallbackRecords.find((item) => item.id === Number(id)) || null;
  }
}

async function createLeads(payload = {}) {
  const targetCompanyId = getCompanyId(payload.companyId);
  const name = String(payload.name || '').trim() || `Lead #${nextId}`;
  const phone = String(payload.phone || '').trim() || null;

  try {
    const result = await db.query(
      `
        INSERT INTO leads (company_id, name, phone, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id, company_id, name, phone, created_at
      `,
      [targetCompanyId, name, phone]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      companyId: row.company_id,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.warn('[LEADS] Failed to create lead in PostgreSQL, using memory fallback:', error.message || error);
  }

  const entity = {
    id: nextId++,
    companyId: targetCompanyId,
    name,
    phone,
    createdAt: new Date().toISOString(),
  };

  memoryFallbackRecords.push(entity);
  return entity;
}

async function updateLeads(id, payload = {}) {
  const targetCompanyId = getCompanyId(payload.companyId);
  const safeName = String(payload.name || '').trim();
  const safePhone = typeof payload.phone === 'undefined' ? undefined : String(payload.phone || '').trim() || null;

  try {
    const existing = await getLeadsById(id, targetCompanyId);
    if (!existing) {
      return null;
    }

    const result = await db.query(
      `
        UPDATE leads
        SET name = $1,
            phone = $2
        WHERE id = $3 AND company_id = $4
        RETURNING id, company_id, name, phone, created_at
      `,
      [safeName || existing.name, typeof safePhone === 'undefined' ? existing.phone : safePhone, Number(id), targetCompanyId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      companyId: row.company_id,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.warn('[LEADS] Failed to update lead in PostgreSQL:', error.message || error);
    const target = memoryFallbackRecords.find((item) => item.id === Number(id));
    if (!target) return null;

    target.name = safeName || target.name;
    if (typeof safePhone !== 'undefined') {
      target.phone = safePhone;
    }

    return target;
  }
}

async function removeLeads(id, companyId) {
  const targetCompanyId = getCompanyId(companyId);

  try {
    const result = await db.query('DELETE FROM leads WHERE id = $1 AND company_id = $2', [Number(id), targetCompanyId]);
    return result.rowCount > 0;
  } catch (error) {
    console.warn('[LEADS] Failed to remove lead in PostgreSQL:', error.message || error);
    const index = memoryFallbackRecords.findIndex((item) => item.id === Number(id));
    if (index < 0) return false;

    memoryFallbackRecords.splice(index, 1);
    return true;
  }
}

module.exports = {
  createLeads,
  getLeadsById,
  listLeads,
  removeLeads,
  updateLeads,
};
