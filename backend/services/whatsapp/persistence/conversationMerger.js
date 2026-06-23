const fs = require('fs/promises');
const path = require('path');
const { existsSync } = require('fs');
const { query } = require('../../../config/database');
const conversationRepository = require('../../../repositories/conversationRepository');

let isConsolidating = false;

async function consolidateLidConversations(companyId = 'default') {
  if (isConsolidating) {
    return;
  }
  isConsolidating = true;

  try {
    const pairsRes = await query(`
      SELECT DISTINCT
        l_lid.id as duplicate_lead_id,
        l_lid.phone as duplicate_phone,
        l_phone.id as keeper_lead_id,
        l_phone.phone as keeper_phone
      FROM whatsapp_lid_mappings m
      JOIN leads l_lid ON (l_lid.phone = m.lid OR l_lid.phone = m.lid || '@lid')
      JOIN leads l_phone ON (l_phone.phone = m.phone OR l_phone.phone = m.phone || '@s.whatsapp.net')
      WHERE l_lid.id <> l_phone.id AND l_lid.company_id = $1 AND l_phone.company_id = $1
    `, [companyId]);

    if (pairsRes.rows.length === 0) {
      isConsolidating = false;
      return;
    }

    console.log(`[CONSOLIDATION] Found ${pairsRes.rows.length} duplicate pairs to merge`);

    // Ensure backups directory exists
    const backupsDir = path.resolve(__dirname, '..', '..', '..', '..', 'backups');
    await fs.mkdir(backupsDir, { recursive: true });

    // Initialize backup tables in Postgres
    await query(`CREATE TABLE IF NOT EXISTS leads_backup_merge AS SELECT * FROM leads WHERE false`);
    await query(`CREATE TABLE IF NOT EXISTS conversations_backup_merge AS SELECT * FROM conversations WHERE false`);
    await query(`CREATE TABLE IF NOT EXISTS messages_backup_merge AS SELECT * FROM messages WHERE false`);
    await query(`CREATE TABLE IF NOT EXISTS contacts_backup_merge AS SELECT * FROM contacts WHERE false`);

    for (const pair of pairsRes.rows) {
      const { duplicate_lead_id, keeper_lead_id, duplicate_phone, keeper_phone } = pair;
      console.log(`[CONSOLIDATION] Merging duplicate lead ${duplicate_phone} (id=${duplicate_lead_id}) into keeper ${keeper_phone} (id=${keeper_lead_id})`);

      // 1. Gather backup data
      const leadBackup = await query(`SELECT * FROM leads WHERE id IN ($1, $2)`, [duplicate_lead_id, keeper_lead_id]);
      const convBackup = await query(`SELECT * FROM conversations WHERE lead_id IN ($1, $2)`, [duplicate_lead_id, keeper_lead_id]);
      const convIds = convBackup.rows.map(c => c.id);
      
      let msgBackup = { rows: [] };
      if (convIds.length > 0) {
        msgBackup = await query(`SELECT * FROM messages WHERE conversation_id = ANY($1::int[])`, [convIds]);
      }

      const contactBackup = await query(`
        SELECT * FROM contacts 
        WHERE (phone = $1 OR phone = $2 OR phone = $3 OR phone = $4) AND company_id = $5
      `, [duplicate_phone, keeper_phone, `${duplicate_phone}@lid`, `${keeper_phone}@s.whatsapp.net`, companyId]);

      // 2. Export backup data to JSON file
      const backupFilename = `merge_${Date.now()}_lead_${duplicate_lead_id}_to_${keeper_lead_id}.json`;
      const backupFilePath = path.join(backupsDir, backupFilename);
      await fs.writeFile(backupFilePath, JSON.stringify({
        timestamp: new Date().toISOString(),
        pair,
        leads: leadBackup.rows,
        conversations: convBackup.rows,
        messages: msgBackup.rows,
        contacts: contactBackup.rows,
      }, null, 2));
      console.log(`[CONSOLIDATION] Exported JSON backup to backups/${backupFilename}`);

      // 3. Write backup data to Postgres backup tables
      if (leadBackup.rows.length > 0) {
        await query(`INSERT INTO leads_backup_merge SELECT * FROM leads WHERE id IN ($1, $2)`, [duplicate_lead_id, keeper_lead_id]);
      }
      if (convBackup.rows.length > 0) {
        await query(`INSERT INTO conversations_backup_merge SELECT * FROM conversations WHERE lead_id IN ($1, $2)`, [duplicate_lead_id, keeper_lead_id]);
      }
      if (msgBackup.rows.length > 0) {
        await query(`INSERT INTO messages_backup_merge SELECT * FROM messages WHERE conversation_id = ANY($1::int[])`, [convIds]);
      }
      if (contactBackup.rows.length > 0) {
        const contactIds = contactBackup.rows.map(c => c.id);
        await query(`INSERT INTO contacts_backup_merge SELECT * FROM contacts WHERE id = ANY($1::int[])`, [contactIds]);
      }

      // 4. Begin merge transaction
      await query('BEGIN');
      try {
        // Query duplicate conversations
        const dupConvs = await query(`SELECT id, session_id FROM conversations WHERE lead_id = $1`, [duplicate_lead_id]);
        
        for (const dupConv of dupConvs.rows) {
          // Check if keeper has a conversation in the same session
          const keeperConvRes = await query(`
            SELECT id FROM conversations 
            WHERE lead_id = $1 AND session_id = $2 AND company_id = $3
          `, [keeper_lead_id, dupConv.session_id, companyId]);

          if (keeperConvRes.rows.length > 0) {
            const keeperConvId = keeperConvRes.rows[0].id;
            console.log(`[CONSOLIDATION] Merging duplicate conversation ${dupConv.id} into keeper conversation ${keeperConvId}`);

            // Move messages to keeper conversation
            await query(`UPDATE messages SET conversation_id = $1 WHERE conversation_id = $2`, [keeperConvId, dupConv.id]);
            
            // Move flow executions
            await query(`UPDATE flow_executions SET conversation_id = $1 WHERE conversation_id = $2`, [keeperConvId, dupConv.id]);

            // Move runtime states
            await query(`
              DELETE FROM conversation_runtime_states 
              WHERE conversation_id = $1 AND EXISTS (
                SELECT 1 FROM conversation_runtime_states WHERE conversation_id = $2
              )
            `, [dupConv.id, keeperConvId]);
            await query(`UPDATE conversation_runtime_states SET conversation_id = $1 WHERE conversation_id = $2`, [keeperConvId, dupConv.id]);

            // Move AI logs
            await query(`UPDATE ai_logs SET conversation_id = $1::text WHERE conversation_id = $2::text`, [keeperConvId, dupConv.id]);

            // Delete duplicate conversation
            await query(`DELETE FROM conversations WHERE id = $1`, [dupConv.id]);
          } else {
            // Just transfer the conversation to keeper lead
            console.log(`[CONSOLIDATION] Transferring conversation ${dupConv.id} to keeper lead ${keeper_lead_id}`);
            await query(`UPDATE conversations SET lead_id = $1 WHERE id = $2`, [keeper_lead_id, dupConv.id]);
          }
        }

        // Delete duplicate contacts
        if (contactBackup.rows.length > 1) {
          const duplicateContacts = contactBackup.rows.filter(c => c.phone.includes('@lid') || c.phone === duplicate_phone);
          const keeperContact = contactBackup.rows.find(c => !c.phone.includes('@lid') && c.phone === keeper_phone);
          
          if (keeperContact) {
            for (const dupContact of duplicateContacts) {
              if (dupContact.id !== keeperContact.id) {
                await query(`DELETE FROM contacts WHERE id = $1`, [dupContact.id]);
              }
            }
          }
        }

        // Delete duplicate lead
        await query(`DELETE FROM leads WHERE id = $1`, [duplicate_lead_id]);

        await query('COMMIT');
        console.log(`[CONSOLIDATION] Consolidation transaction committed for lead ${duplicate_phone}`);
      } catch (txErr) {
        await query('ROLLBACK');
        console.error(`[CONSOLIDATION] Transaction failed, rolled back for lead ${duplicate_phone}:`, txErr);
        throw txErr;
      }
    }

    // Invalidate caches
    conversationRepository.invalidateConversationCache(companyId);
    console.log('[CONSOLIDATION] Invalidated conversation cache');

    // Notify clients
    if (global.io) {
      global.io.emit('conversation:revalidated', { companyId });
    }
  } catch (err) {
    console.error('[CONSOLIDATION] Background consolidation routine error:', err);
  } finally {
    isConsolidating = false;
  }
}

module.exports = {
  consolidateLidConversations,
};
