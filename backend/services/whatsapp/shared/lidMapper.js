const { query } = require('../../../config/database');

async function init() {
  global.lidToPhoneMap = new Map();
  global.phoneToLidMap = new Map();

  try {
    const result = await query(`
      SELECT lid, phone FROM whatsapp_lid_mappings
    `);
    for (const row of result.rows) {
      global.lidToPhoneMap.set(row.lid, row.phone);
      global.phoneToLidMap.set(row.phone, row.lid);
    }
    console.log(`[LID-MAPPER] Loaded ${result.rows.length} mappings from database`);

    // Reconcile any remaining pending messages to their JID if no phone mapping exists
    const pendingResult = await query(`
      SELECT id, lid, company_id, session_id, payload
      FROM pending_lid_messages
    `);
    if (pendingResult.rows.length > 0) {
      console.log(`[LID-MAPPER] Found ${pendingResult.rows.length} unmapped pending messages. Persisting...`);
      const messageService = require('../../../services/messageService');
      for (const row of pendingResult.rows) {
        try {
          const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
          const mappedPhone = global.lidToPhoneMap.get(row.lid);
          payload.phone = mappedPhone ? mappedPhone : `${row.lid}@lid`;
          payload.companyId = row.company_id;
          payload.sessionId = row.session_id;
          
          await messageService.persistIncomingMessage(payload);
          console.log(`[LID-MAPPER] Auto-reconciled pending message id=${row.id} to phone=${payload.phone}`);
        } catch (err) {
          console.error(`[LID-MAPPER] Failed to auto-reconcile pending message id=${row.id}:`, err);
        }
      }
      await query(`DELETE FROM pending_lid_messages`);
      console.log(`[LID-MAPPER] Flushed and cleared pending_lid_messages queue.`);
    }
  } catch (err) {
    console.error('[LID-MAPPER] Failed to initialize mappings from database:', err);
  }
}

async function saveMapping(lid, phone) {
  if (!lid || !phone) return;

  const cleanLid = String(lid).split('@')[0];
  const cleanPhone = String(phone).split('@')[0];

  if (global.lidToPhoneMap && global.lidToPhoneMap.get(cleanLid) === cleanPhone) {
    return; // Already mapped correctly
  }

  if (global.lidToPhoneMap) {
    global.lidToPhoneMap.set(cleanLid, cleanPhone);
  }
  if (global.phoneToLidMap) {
    global.phoneToLidMap.set(cleanPhone, cleanLid);
  }

  try {
    await query(`
      INSERT INTO whatsapp_lid_mappings (lid, phone, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (lid)
      DO UPDATE SET phone = EXCLUDED.phone, updated_at = NOW()
    `, [cleanLid, cleanPhone]);
    console.log(`[LID-MAPPER] Saved mapping: ${cleanLid} <-> ${cleanPhone}`);

    // Reconcile any pending messages for this LID
    await processPendingLidMessages(cleanLid, cleanPhone);

    // Trigger run-time thread consolidation when a new mapping is discovered
    const { consolidateLidConversations } = require('../persistence/conversationMerger');
    consolidateLidConversations(process.env.DEFAULT_COMPANY_ID || 'default').catch(err => {
      console.error('[CONSOLIDATION] Failed to consolidate conversations on new mapping:', err);
    });
  } catch (err) {
    console.error(`[LID-MAPPER] Failed to save mapping ${cleanLid} <-> ${cleanPhone} to database:`, err);
  }
}

async function savePendingMessage(lid, companyId, sessionId, payload) {
  const cleanLid = String(lid).split('@')[0];
  try {
    await query(`
      INSERT INTO pending_lid_messages (lid, company_id, session_id, payload)
      VALUES ($1, $2, $3, $4)
    `, [cleanLid, companyId || 'default', sessionId || 'main', JSON.stringify(payload)]);
    console.log(`[LID-MAPPER] Queued pending message for unresolved LID: ${cleanLid}`);
  } catch (err) {
    console.error(`[LID-MAPPER] Failed to queue pending message for LID ${cleanLid}:`, err);
  }
}

async function processPendingLidMessages(lid, phone) {
  const messageService = require('../../../services/messageService');
  const cleanLid = String(lid).split('@')[0];
  const cleanPhone = String(phone).split('@')[0];

  try {
    const result = await query(`
      SELECT id, company_id, session_id, payload
      FROM pending_lid_messages
      WHERE lid = $1 OR lid = $2
    `, [cleanLid, `${cleanLid}@lid`]);

    if (result.rows.length === 0) {
      return;
    }

    console.log(`[LID-MAPPER] Found ${result.rows.length} pending messages for LID ${cleanLid}. Reconciling to phone ${cleanPhone}...`);

    for (const row of result.rows) {
      const { company_id, session_id, payload } = row;
      payload.phone = cleanPhone;
      payload.companyId = company_id;
      payload.sessionId = session_id;

      try {
        await messageService.persistIncomingMessage(payload);
        console.log(`[LID-MAPPER] Persisted pending message id=${row.id} to phone=${cleanPhone}`);
      } catch (err) {
        console.error(`[LID-MAPPER] Failed to persist pending message id=${row.id}:`, err);
      }
    }

    await query(`
      DELETE FROM pending_lid_messages
      WHERE lid = $1 OR lid = $2
    `, [cleanLid, `${cleanLid}@lid`]);
    console.log(`[LID-MAPPER] Cleaned up pending messages for LID ${cleanLid}`);
  } catch (err) {
    console.error(`[LID-MAPPER] Error processing pending messages for LID ${cleanLid}:`, err);
  }
}

module.exports = {
  init,
  saveMapping,
  savePendingMessage,
  processPendingLidMessages,
};

