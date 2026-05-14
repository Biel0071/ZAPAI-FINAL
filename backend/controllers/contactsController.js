/**
 * Contacts Controller
 * Handles all /api/contacts endpoints.
 * Returns standardized envelope: { ok, data, total }
 * Never returns 500 on empty table — returns { ok: true, data: [], total: 0 }
 */

const conversationRepository = require('../repositories/conversationRepository');
const contactsService = require('../services/contactsService');
const { query } = require('../config/database');
const { backendLog, errorLog } = require('../services/logger');

function getStore(req) {
  return req.app.locals.store;
}

function hasDatabaseEnabled(req) {
  return Boolean(getStore(req)?.databaseEnabled);
}

/**
 * GET /api/contacts
 * List contacts — returns { ok: true, data: [...], total: N }
 */
async function listContacts(req, res) {
  try {
    let contacts = [];

    if (hasDatabaseEnabled(req)) {
      try {
        const companyId = req.query?.companyId || req.auth?.tenantId || process.env.DEFAULT_COMPANY_ID || 'default';
        const limit = Math.min(Number(req.query?.limit) || 500, 2000);
        const conversations = await conversationRepository.listConversations(companyId, limit);
        contacts = contactsService.listContactsFromConversations(conversations);

        // Apply optional filters from query params
        const { region, state, ddd, search } = req.query;
        if (region) contacts = contacts.filter(c => c.region === region);
        if (state) contacts = contacts.filter(c => c.state === state);
        if (ddd) contacts = contacts.filter(c => c.ddd === ddd);
        if (search) {
          const s = search.toLowerCase();
          contacts = contacts.filter(c =>
            (c.name || '').toLowerCase().includes(s) ||
            (c.phone || '').includes(s)
          );
        }
      } catch (dbError) {
        // DB query failed — return empty state, never 500
        backendLog('warn', 'contacts:list:db_error', { error: dbError?.message });
        contacts = [];
      }
    } else {
      // No DB — use in-memory conversations
      const store = getStore(req);
      const conversations = Array.isArray(store?.conversations) ? store.conversations : [];
      contacts = contactsService.listContactsFromConversations(conversations);
    }

    return res.status(200).json({
      ok: true,
      data: contacts,
      total: contacts.length,
    });
  } catch (error) {
    errorLog(error, { scope: 'contacts', action: 'list' });
    return res.status(200).json({ ok: true, data: [], total: 0 });
  }
}

/**
 * POST /api/contacts
 * Create a new contact
 */
async function createContact(req, res) {
  try {
    const { name, phone, email, region, state, ddd, notes } = req.body || {};

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_PHONE', message: 'Campo obrigatório: phone' },
      });
    }

    if (hasDatabaseEnabled(req)) {
      try {
        const result = await query(
          `INSERT INTO contacts (name, phone, email, region, state, ddd, notes, company_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
           RETURNING *`,
          [name || null, phone, email || null, region || null, state || null, ddd || null, notes || null,
           req.auth?.tenantId || process.env.DEFAULT_COMPANY_ID || 'default']
        );
        return res.status(201).json({ ok: true, data: result.rows[0] });
      } catch (dbError) {
        // Table might not exist yet — return graceful error
        backendLog('warn', 'contacts:create:db_error', { error: dbError?.message });
        return res.status(200).json({
          ok: false,
          error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados indisponível. Contato não salvo.' },
        });
      }
    }

    // No DB — store not available for creates
    return res.status(200).json({
      ok: false,
      error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados não configurado.' },
    });
  } catch (error) {
    errorLog(error, { scope: 'contacts', action: 'create' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao criar contato.' },
    });
  }
}

/**
 * PATCH /api/contacts/:id
 * Update an existing contact
 */
async function updateContact(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_ID', message: 'ID do contato é obrigatório.' },
      });
    }

    if (hasDatabaseEnabled(req)) {
      try {
        const updates = req.body || {};
        const fields = [];
        const values = [];
        let idx = 1;

        for (const [key, val] of Object.entries(updates)) {
          if (['name', 'phone', 'email', 'region', 'state', 'ddd', 'notes'].includes(key)) {
            fields.push(`${key} = $${idx++}`);
            values.push(val);
          }
        }

        if (fields.length === 0) {
          return res.status(400).json({
            ok: false,
            error: { code: 'NO_FIELDS', message: 'Nenhum campo válido para atualizar.' },
          });
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await query(
          `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
          values
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Contato não encontrado.' },
          });
        }

        return res.status(200).json({ ok: true, data: result.rows[0] });
      } catch (dbError) {
        backendLog('warn', 'contacts:update:db_error', { error: dbError?.message });
        return res.status(200).json({
          ok: false,
          error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados indisponível.' },
        });
      }
    }

    return res.status(200).json({
      ok: false,
      error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados não configurado.' },
    });
  } catch (error) {
    errorLog(error, { scope: 'contacts', action: 'update' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao atualizar contato.' },
    });
  }
}

/**
 * DELETE /api/contacts/:id
 * Delete a contact
 */
async function deleteContact(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_ID', message: 'ID do contato é obrigatório.' },
      });
    }

    if (hasDatabaseEnabled(req)) {
      try {
        const result = await query(
          `DELETE FROM contacts WHERE id = $1 RETURNING id`,
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Contato não encontrado.' },
          });
        }

        return res.status(200).json({ ok: true, data: { id: result.rows[0].id } });
      } catch (dbError) {
        backendLog('warn', 'contacts:delete:db_error', { error: dbError?.message });
        return res.status(200).json({
          ok: false,
          error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados indisponível.' },
        });
      }
    }

    return res.status(200).json({
      ok: false,
      error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados não configurado.' },
    });
  } catch (error) {
    errorLog(error, { scope: 'contacts', action: 'delete' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao excluir contato.' },
    });
  }
}

/**
 * POST /api/contacts/import
 * Bulk import contacts (CSV/JSON)
 */
async function importContacts(req, res) {
  try {
    const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];

    if (contacts.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_IMPORT', message: 'Nenhum contato para importar.' },
      });
    }

    // Return safe placeholder — full import implementation depends on DB schema
    return res.status(200).json({
      ok: true,
      data: { imported: 0, skipped: contacts.length, errors: [] },
      message: 'Importação em massa requer configuração de banco de dados.',
    });
  } catch (error) {
    errorLog(error, { scope: 'contacts', action: 'import' });
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno na importação.' },
    });
  }
}

/**
 * GET /api/contacts/export
 * Export contacts as JSON
 */
async function exportContacts(req, res) {
  try {
    // Re-use listContacts logic
    const mockReq = { ...req, query: { ...req.query } };
    const contacts = [];

    if (hasDatabaseEnabled(req)) {
      try {
        const companyId = req.auth?.tenantId || process.env.DEFAULT_COMPANY_ID || 'default';
        const conversations = await conversationRepository.listConversations(companyId, 10000);
        const all = contactsService.listContactsFromConversations(conversations);
        contacts.push(...all);
      } catch { /* empty */ }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts-export.json"');
    return res.status(200).json({ ok: true, data: contacts, total: contacts.length });
  } catch (error) {
    errorLog(error, { scope: 'contacts', action: 'export' });
    return res.status(200).json({ ok: true, data: [], total: 0 });
  }
}

module.exports = {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  exportContacts,
};
