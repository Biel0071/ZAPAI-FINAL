import pool from "../backend/config/database.js";

export async function createContact({ companyId, name, phone }) {
  const { rows } = await pool.query(
    `
      INSERT INTO contacts (company_id, name, phone)
      VALUES ($1, $2, $3)
      ON CONFLICT (company_id, phone)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id, company_id, name, phone, created_at
    `,
    [companyId, name, phone],
  );

  return rows[0];
}

export async function findContactByPhone({ companyId, phone }) {
  const { rows } = await pool.query(
    `
      SELECT id, company_id, name, phone, created_at
      FROM contacts
      WHERE company_id = $1 AND phone = $2
      LIMIT 1
    `,
    [companyId, phone],
  );

  return rows[0] ?? null;
}

export async function listContacts({ companyId }) {
  const { rows } = await pool.query(
    `
      SELECT id, company_id, name, phone, created_at
      FROM contacts
      WHERE company_id = $1
      ORDER BY created_at DESC
    `,
    [companyId],
  );

  return rows;
}
