const { query } = require('../config/database');

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function mapContact(row) {
  if (!row) {
    return null;
  }

  return {
    companyId: row.company_id,
    createdAt: row.created_at,
    id: row.id,
    name: row.name || 'Unknown',
    phone: row.phone,
  };
}

async function findContactByPhone(phone, companyId) {
  const result = await query(
    `
      SELECT id, company_id, name, phone, created_at
      FROM leads
      WHERE phone = $1 AND company_id = $2
      LIMIT 1
    `,
    [phone, getCompanyId(companyId)]
  );

  return mapContact(result.rows[0]);
}

async function createContact({ companyId, name, phone }) {
  const result = await query(
    `
      INSERT INTO leads (company_id, name, phone)
      VALUES ($1, $2, $3)
      ON CONFLICT (company_id, phone)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, leads.name)
      RETURNING id, company_id, name, phone, created_at
    `,
    [getCompanyId(companyId), name || 'Unknown', phone]
  );

  return mapContact(result.rows[0]);
}

async function updateContactName(phone, name, companyId) {
  const result = await query(
    `
      UPDATE leads
      SET name = $1
      WHERE phone = $2 AND company_id = $3
      RETURNING id, company_id, name, phone, created_at
    `,
    [name || 'Unknown', phone, getCompanyId(companyId)]
  );

  return mapContact(result.rows[0]);
}

module.exports = {
  createContact,
  findContactByPhone,
  updateContactName,
};