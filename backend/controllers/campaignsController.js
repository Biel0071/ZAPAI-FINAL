/**
 * Campaigns Controller
 * Handles /api/campaigns endpoints with safe empty state.
 *
 * IMPORTANT: The `campaigns` table may not exist in the database yet.
 * All DB calls are wrapped in try/catch and return empty arrays on failure.
 * Never returns 500 on missing table — returns { ok: true, data: [], total: 0 }.
 *
 * PENDING: Full campaigns table migration needs to be created separately.
 */

const { backendLog, errorLog } = require('../services/logger');

function getStore(req) {
  return req.app.locals.store;
}

function hasDatabaseEnabled(req) {
  return Boolean(getStore(req)?.databaseEnabled);
}

async function tryQuery(req, sql, params = []) {
  try {
    const { query } = require('../config/database');
    return await query(sql, params);
  } catch (err) {
    backendLog('warn', 'campaigns:db_query_failed', { error: err?.message, sql: sql?.slice(0, 80) });
    return null;
  }
}

/**
 * GET /api/campaigns
 * List campaigns — safe empty state if table doesn't exist
 */
async function listCampaigns(req, res) {
  try {
    if (hasDatabaseEnabled(req)) {
      const companyId = req.auth?.tenantId || process.env.DEFAULT_COMPANY_ID || 'default';
      const limit = Math.min(Number(req.query?.limit) || 100, 500);
      const offset = Math.max(Number(req.query?.offset) || 0, 0);

      const result = await tryQuery(
        req,
        `SELECT * FROM campaigns WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [companyId, limit, offset]
      );

      if (result) {
        const countResult = await tryQuery(req, `SELECT COUNT(*)::int AS total FROM campaigns WHERE company_id = $1`, [companyId]);
        const total = Number(countResult?.rows?.[0]?.total || 0);
        return res.status(200).json({ ok: true, data: result.rows || [], total });
      }
    }

    // DB unavailable or table doesn't exist — safe empty state
    return res.status(200).json({ ok: true, data: [], total: 0 });
  } catch (error) {
    errorLog(error, { scope: 'campaigns', action: 'list' });
    return res.status(200).json({ ok: true, data: [], total: 0 });
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign
 */
async function createCampaign(req, res) {
  try {
    const { name, message, targetAudience, scheduledAt } = req.body || {};

    if (!name || !message) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_FIELDS', message: 'Campos obrigatórios: name, message' },
      });
    }

    if (hasDatabaseEnabled(req)) {
      const companyId = req.auth?.tenantId || process.env.DEFAULT_COMPANY_ID || 'default';
      const result = await tryQuery(
        req,
        `INSERT INTO campaigns (name, message, target_audience, scheduled_at, status, company_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'draft', $5, NOW(), NOW()) RETURNING *`,
        [name, message, targetAudience || null, scheduledAt || null, companyId]
      );

      if (result) {
        return res.status(201).json({ ok: true, data: result.rows[0] });
      }
    }

    return res.status(200).json({
      ok: false,
      error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados não configurado. Campanha não salva.' },
    });
  } catch (error) {
    errorLog(error, { scope: 'campaigns', action: 'create' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao criar campanha.' },
    });
  }
}

/**
 * PATCH /api/campaigns/:id
 * Update a campaign
 */
async function updateCampaign(req, res) {
  try {
    const { id } = req.params;

    if (hasDatabaseEnabled(req)) {
      const updates = req.body || {};
      const fields = [];
      const values = [];
      let idx = 1;

      for (const [key, val] of Object.entries(updates)) {
        if (['name', 'message', 'target_audience', 'scheduled_at', 'status'].includes(key)) {
          fields.push(`${key} = $${idx++}`);
          values.push(val);
        }
      }

      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await tryQuery(
          req,
          `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
          values
        );

        if (result) {
          if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Campanha não encontrada.' } });
          }
          return res.status(200).json({ ok: true, data: result.rows[0] });
        }
      }
    }

    return res.status(200).json({
      ok: false,
      error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados não configurado.' },
    });
  } catch (error) {
    errorLog(error, { scope: 'campaigns', action: 'update' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao atualizar campanha.' },
    });
  }
}

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign
 */
async function deleteCampaign(req, res) {
  try {
    const { id } = req.params;

    if (hasDatabaseEnabled(req)) {
      const result = await tryQuery(req, `DELETE FROM campaigns WHERE id = $1 RETURNING id`, [id]);

      if (result) {
        if (result.rows.length === 0) {
          return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Campanha não encontrada.' } });
        }
        return res.status(200).json({ ok: true, data: { id: result.rows[0].id } });
      }
    }

    return res.status(200).json({
      ok: false,
      error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados não configurado.' },
    });
  } catch (error) {
    errorLog(error, { scope: 'campaigns', action: 'delete' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao excluir campanha.' },
    });
  }
}

/**
 * POST /api/campaigns/:id/launch
 * Launch/start a campaign — delegates to campaignDispatchEngine if available
 */
async function launchCampaign(req, res) {
  try {
    const { id } = req.params;

    // Try to update status in DB
    if (hasDatabaseEnabled(req)) {
      await tryQuery(
        req,
        `UPDATE campaigns SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    // Try to delegate to dispatch engine
    try {
      const campaignDispatchEngine = require('../services/campaignDispatchEngine');
      if (typeof campaignDispatchEngine?.launchCampaign === 'function') {
        await campaignDispatchEngine.launchCampaign(id);
      }
    } catch (engineErr) {
      backendLog('warn', 'campaigns:launch:engine_unavailable', { id, error: engineErr?.message });
    }

    return res.status(200).json({
      ok: true,
      data: { id, status: 'running', launchedAt: new Date().toISOString() },
    });
  } catch (error) {
    errorLog(error, { scope: 'campaigns', action: 'launch' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao iniciar campanha.' },
    });
  }
}

/**
 * POST /api/campaigns/:id/pause
 * Pause a running campaign
 */
async function pauseCampaign(req, res) {
  try {
    const { id } = req.params;

    if (hasDatabaseEnabled(req)) {
      await tryQuery(
        req,
        `UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    try {
      const campaignDispatchEngine = require('../services/campaignDispatchEngine');
      if (typeof campaignDispatchEngine?.pauseCampaign === 'function') {
        await campaignDispatchEngine.pauseCampaign(id);
      }
    } catch { /* engine optional */ }

    return res.status(200).json({
      ok: true,
      data: { id, status: 'paused', pausedAt: new Date().toISOString() },
    });
  } catch (error) {
    errorLog(error, { scope: 'campaigns', action: 'pause' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao pausar campanha.' },
    });
  }
}

module.exports = {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  launchCampaign,
  pauseCampaign,
};
