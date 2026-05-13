import pool from "../backend/config/database.js";

export async function createSession({ companyId, sessionName, status = "disconnected", phoneNumber = null }) {
  const { rows } = await pool.query(
    `
      INSERT INTO sessions (company_id, session_name, status, phone_number)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (company_id, session_name)
      DO UPDATE SET status = EXCLUDED.status, phone_number = EXCLUDED.phone_number
      RETURNING id, company_id, session_name, status, phone_number, created_at
    `,
    [companyId, sessionName, status, phoneNumber],
  );

  return rows[0];
}

export async function listSessions({ companyId }) {
  const { rows } = await pool.query(
    `
      SELECT id, company_id, session_name, status, phone_number, created_at
      FROM sessions
      WHERE company_id = $1
      ORDER BY created_at DESC
    `,
    [companyId],
  );

  return rows;
}

export async function deleteSession({ companyId, sessionId }) {
  const { rowCount } = await pool.query(
    `
      DELETE FROM sessions
      WHERE company_id = $1 AND id = $2
    `,
    [companyId, sessionId],
  );

  return rowCount > 0;
}
