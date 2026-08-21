const { query } = require('../../infrastructure/config/database');
const { getPhoneAliases, normalizePhone } = require('../../../services/whatsapp/shared/identifiers');

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
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const phoneAliases = getPhoneAliases(normalizedPhone);

  const result = await query(
    `
      SELECT id, company_id, name, phone, created_at
      FROM leads
      WHERE phone = ANY($1::text[]) AND company_id = $2
      ORDER BY id ASC, created_at DESC
      LIMIT 1
    `,
    [phoneAliases, getCompanyId(companyId)]
  );

  return mapContact(result.rows[0]);
}

async function createContact({ companyId, name, phone }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error('phone is required.');
  }

  const result = await query(
    `
      INSERT INTO leads (company_id, name, phone)
      VALUES ($1, $2, $3)
      ON CONFLICT (company_id, phone)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, leads.name)
      RETURNING id, company_id, name, phone, created_at
    `,
    [getCompanyId(companyId), name || 'Unknown', normalizedPhone]
  );

  return mapContact(result.rows[0]);
}

async function updateContactName(phone, name, companyId) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const result = await query(
    `
      UPDATE leads
      SET name = $1
      WHERE phone = $2 AND company_id = $3
      RETURNING id, company_id, name, phone, created_at
    `,
    [name || 'Unknown', normalizedPhone, getCompanyId(companyId)]
  );

  return mapContact(result.rows[0]);
}

async function isLeadBlocked(phone, companyId) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return false;

  const result = await query(
    `SELECT is_blocked
     FROM leads
     WHERE phone = ANY($1::text[]) AND company_id = $2
     LIMIT 1`,
    [getPhoneAliases(normalizedPhone), getCompanyId(companyId)],
  );

  return Boolean(result.rows[0]?.is_blocked);
}

module.exports = {
  createContact,
  findContactByPhone,
  isLeadBlocked,
  updateContactName,
};
