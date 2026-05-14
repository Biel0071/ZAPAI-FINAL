/**
 * Logs Router
 * Provides /api/logs endpoints — public read access for system logs.
 * Returns paginated logs from runtime log buffer or DB.
 */

const express = require('express');
const os = require('os');
const router = express.Router();

// Internal log buffer (rings-based in-memory if no DB)
let _inMemoryLogs = [];
const MAX_MEMORY_LOGS = 500;

function appendLog(level, message, meta = {}) {
  _inMemoryLogs.push({
    id: Date.now() + Math.random(),
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
    source: 'backend',
  });
  if (_inMemoryLogs.length > MAX_MEMORY_LOGS) {
    _inMemoryLogs = _inMemoryLogs.slice(-MAX_MEMORY_LOGS);
  }
}

/**
 * GET /api/logs
 * Returns paginated system logs
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query?.limit) || 100, 500);
    const offset = Math.max(Number(req.query?.offset) || 0, 0);
    const level = req.query?.level || null; // filter by level: info|warn|error
    const source = req.query?.source || null;

    const store = req.app.locals.store;
    const dbEnabled = Boolean(store?.databaseEnabled);

    let logs = [];
    let total = 0;

    if (dbEnabled) {
      try {
        const { query } = require('../config/database');

        // Try to read from audit_logs or system_logs table
        const whereClauses = [];
        const params = [];
        let idx = 1;

        if (level) { whereClauses.push(`level = $${idx++}`); params.push(level); }
        if (source) { whereClauses.push(`source = $${idx++}`); params.push(source); }

        const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countResult = await query(`SELECT COUNT(*)::int AS total FROM system_logs ${where}`, params);
        total = Number(countResult.rows?.[0]?.total || 0);

        const dataParams = [...params, limit, offset];
        const dataResult = await query(
          `SELECT id, level, message, source, meta, created_at AS timestamp
           FROM system_logs ${where}
           ORDER BY created_at DESC
           LIMIT $${idx++} OFFSET $${idx++}`,
          dataParams
        );
        logs = dataResult.rows || [];
      } catch {
        // Table doesn't exist — fall through to in-memory
        logs = _inMemoryLogs;
        total = _inMemoryLogs.length;
      }
    } else {
      logs = [..._inMemoryLogs].reverse(); // newest first
      total = logs.length;
    }

    // Apply level filter on in-memory logs
    if (level && Array.isArray(logs)) {
      logs = logs.filter(l => l.level === level);
      total = logs.length;
    }

    const paged = logs.slice(offset, offset + limit);

    return res.status(200).json({
      ok: true,
      data: paged,
      total,
      limit,
      offset,
    });
  } catch (error) {
    // Never 500 — return empty state
    return res.status(200).json({ ok: true, data: [], total: 0, limit: 100, offset: 0 });
  }
});

/**
 * POST /api/logs/export
 * Export logs as JSON download
 */
router.post('/logs/export', async (req, res) => {
  try {
    const logs = [..._inMemoryLogs].reverse();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="zapflow-logs-${Date.now()}.json"`);
    return res.status(200).json({ ok: true, data: logs, total: logs.length, exportedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao exportar logs.' } });
  }
});

/**
 * DELETE /api/logs
 * Clear in-memory log buffer (master_admin only)
 */
router.delete('/logs', (req, res) => {
  try {
    const role = String(req.auth?.role || '').trim().toLowerCase();
    if (role !== 'master_admin') {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'master_admin role required.' } });
    }
    _inMemoryLogs = [];
    return res.status(200).json({ ok: true, data: { cleared: true, message: 'Log buffer cleared.' } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao limpar logs.' } });
  }
});

module.exports = router;
module.exports.appendLog = appendLog;
