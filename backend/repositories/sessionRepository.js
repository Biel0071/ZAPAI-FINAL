const { query } = require('../config/database');

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function mapSession(row) {
  if (!row) {
    return null;
  }

  return {
    companyId: row.company_id,
    createdAt: row.created_at,
    id: row.id,
    name: row.session_name || row.session_id,
    phone: row.phone_number,
    sessionId: row.session_id || row.session_name,
    sessionName: row.session_name || row.session_id,
    status: row.status,
  };
}

async function createSession({ companyId, phoneNumber = null, sessionId, sessionName, status = 'connecting' }) {
  const normalizedSessionId = sessionId || sessionName;
  const displayName = sessionName || normalizedSessionId;
  const result = await query(
    `
      INSERT INTO sessions (company_id, session_id, session_name, status, phone_number)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (session_id)
      DO UPDATE SET
        company_id = EXCLUDED.company_id,
        session_name = EXCLUDED.session_name,
        status = EXCLUDED.status,
        phone_number = COALESCE(EXCLUDED.phone_number, sessions.phone_number)
      RETURNING id, company_id, session_id, session_name, status, phone_number, created_at
    `,
    [getCompanyId(companyId), normalizedSessionId, displayName, status, phoneNumber]
  );

  return mapSession(result.rows[0]);
}

async function getSessions(companyId, options = {}) {
  const activeOnly = options.activeOnly === true;
  const activeStatuses = ['connected', 'connecting', 'qr', 'qr_ready', 'creating'];
  const statusPlaceholders = activeStatuses.map((_, index) => `$${index + 2}`).join(', ');
  const whereStatusClause = activeOnly ? `AND status IN (${statusPlaceholders})` : '';
  const params = activeOnly
    ? [getCompanyId(companyId), ...activeStatuses]
    : [getCompanyId(companyId)];

  const result = await query(
    `
      SELECT id, company_id, session_id, session_name, status, phone_number, created_at
      FROM sessions
      WHERE company_id = $1
      ${whereStatusClause}
      ORDER BY created_at DESC
    `,
    params
  );

  return result.rows.map(mapSession);
}

async function updateSessionStatus(sessionId, status, phoneNumber = null, companyId, sessionName = null) {
  const result = await query(
    `
      UPDATE sessions
      SET status = $1,
          session_id = COALESCE(session_id, $3),
          session_name = COALESCE($5, session_name, $3),
          phone_number = COALESCE($2, phone_number)
      WHERE (session_id = $3 OR session_name = $3) AND company_id = $4
      RETURNING id, company_id, session_id, session_name, status, phone_number, created_at
    `,
    [status, phoneNumber, sessionId, getCompanyId(companyId), sessionName]
  );

  if (result.rows[0]) {
    return mapSession(result.rows[0]);
  }

  return createSession({
    companyId,
    phoneNumber,
    sessionId,
    sessionName: sessionName || sessionId,
    status,
  });
}

module.exports = {
  createSession,
  getSessions,
  updateSessionStatus,
};