const { query } = require('../config/database');

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function parseJson(value, fallback) {
  if (value == null) {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapCampaign(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    selectedContacts: parseJson(row.selected_contacts, []),
    messages: parseJson(row.messages, []),
    settings: parseJson(row.settings, {
      intervalSeconds: 10,
      pauseEvery: 10,
      pauseSeconds: 60,
      typingDelaySeconds: 3,
      startAt: null,
    }),
    queue: parseJson(row.queue, {
      total: 0,
      processed: 0,
      sent: 0,
      failed: 0,
      paused: false,
    }),
    tags: Array.isArray(row.tags) ? row.tags : [],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listCampaigns(companyId) {
  const result = await query(
    `
      SELECT *
      FROM campaigns
      WHERE company_id = $1
      ORDER BY created_at DESC
    `,
    [getCompanyId(companyId)]
  );

  return result.rows.map(mapCampaign);
}

async function getCampaignById(id, companyId) {
  const result = await query(
    `
      SELECT *
      FROM campaigns
      WHERE id = $1
        AND company_id = $2
      LIMIT 1
    `,
    [id, getCompanyId(companyId)]
  );

  return mapCampaign(result.rows[0]);
}

async function createCampaign(payload, companyId) {
  const result = await query(
    `
      INSERT INTO campaigns (
        id,
        company_id,
        name,
        status,
        selected_contacts,
        messages,
        settings,
        queue,
        tags,
        started_at,
        completed_at,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.id,
      getCompanyId(companyId),
      payload.name,
      payload.status,
      JSON.stringify(payload.selectedContacts || []),
      JSON.stringify(payload.messages || []),
      JSON.stringify(payload.settings || {}),
      JSON.stringify(payload.queue || {}),
      payload.tags || [],
      payload.startedAt || null,
      payload.completedAt || null,
    ]
  );

  return mapCampaign(result.rows[0]);
}

async function updateCampaign(id, payload, companyId) {
  const existing = await getCampaignById(id, companyId);

  if (!existing) {
    return null;
  }

  const next = {
    ...existing,
    ...payload,
    id,
  };

  const result = await query(
    `
      UPDATE campaigns
      SET
        name = $3,
        status = $4,
        selected_contacts = $5::jsonb,
        messages = $6::jsonb,
        settings = $7::jsonb,
        queue = $8::jsonb,
        tags = $9,
        started_at = $10,
        completed_at = $11,
        updated_at = NOW()
      WHERE id = $1
        AND company_id = $2
      RETURNING *
    `,
    [
      id,
      getCompanyId(companyId),
      next.name,
      next.status,
      JSON.stringify(next.selectedContacts || []),
      JSON.stringify(next.messages || []),
      JSON.stringify(next.settings || {}),
      JSON.stringify(next.queue || {}),
      next.tags || [],
      next.startedAt || null,
      next.completedAt || null,
    ]
  );

  return mapCampaign(result.rows[0]);
}

async function deleteCampaign(id, companyId) {
  const result = await query(
    `
      DELETE FROM campaigns
      WHERE id = $1
        AND company_id = $2
    `,
    [id, getCompanyId(companyId)]
  );

  return result.rowCount > 0;
}

module.exports = {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  listCampaigns,
  updateCampaign,
};
