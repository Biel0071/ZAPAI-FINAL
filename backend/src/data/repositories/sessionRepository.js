const { query } = require('../../infrastructure/config/database');

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
    whatsappName: row.whatsapp_name || null,
    status: row.status,
  };
}

async function createSession({ companyId, phoneNumber = null, sessionId, sessionName, status = 'connecting', whatsappName = null }) {
  const normalizedSessionId = sessionId || sessionName;
  const displayName = sessionName || normalizedSessionId;
  const result = await query(
    `
      INSERT INTO sessions (company_id, session_id, session_name, status, phone_number, whatsapp_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (session_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        phone_number = COALESCE(EXCLUDED.phone_number, sessions.phone_number),
        whatsapp_name = COALESCE(EXCLUDED.whatsapp_name, sessions.whatsapp_name)
      WHERE sessions.company_id = EXCLUDED.company_id
      RETURNING id, company_id, session_id, session_name, status, phone_number, whatsapp_name, created_at
    `,
    [getCompanyId(companyId), normalizedSessionId, displayName, status, phoneNumber, whatsappName]
  );

  if (!result.rows[0]) throw new Error('Session belongs to another company.');
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
      SELECT id, company_id, session_id, session_name, status, phone_number, whatsapp_name, created_at
      FROM sessions
      WHERE company_id = $1
      ${whereStatusClause}
      ORDER BY created_at DESC
    `,
    params
  );

  return result.rows.map(mapSession);
}

async function updateSessionStatus(sessionId, status, phoneNumber = null, companyId, sessionName = null, whatsappName = null) {
  const result = await query(
    `
      UPDATE sessions
      SET status = $1,
          session_id = COALESCE(session_id, $3),
          session_name = COALESCE(session_name, $5, $3),
          phone_number = COALESCE($2, phone_number),
          whatsapp_name = COALESCE($6, whatsapp_name)
      WHERE (session_id = $3 OR session_name = $3) AND company_id = $4
      RETURNING id, company_id, session_id, session_name, status, phone_number, whatsapp_name, created_at
    `,
    [status, phoneNumber, sessionId, getCompanyId(companyId), sessionName, whatsappName]
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
    whatsappName,
  });
}

module.exports = {
  createSession,
  getSessions,
  updateSessionStatus,
};
