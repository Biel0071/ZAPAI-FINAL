/**
 * sessionReassociator.js
 * 
 * Reassocia conversas e mensagens órfãs salvas no banco de dados para a sessão ativa oficial ('main').
 * Garante que todo o histórico de mensagens e conversas acumuladas apareça imediatamente no Inbox
 * e possa ser projetado para a memória e evolução da IA.
 */

const { pool } = require('../../../src/infrastructure/config/database');

async function reassociateCompanyConversationsToSession(companyId = 'default', targetSessionId = 'main') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Garantir que a sessão alvo existe na tabela sessions
    await client.query(`
      INSERT INTO sessions (company_id, session_id, session_name, status)
      VALUES ($1, $2, $2, 'connected')
      ON CONFLICT (session_id) DO NOTHING
    `, [companyId, targetSessionId]);

    // 2. Verificar conversas que pertencem a outra sessão ou sessão nula
    const orphanedConversations = await client.query(`
      SELECT id, lead_id, remote_jid, session_id, updated_at
      FROM conversations
      WHERE company_id = $1 AND (session_id <> $2 OR session_id IS NULL)
      ORDER BY updated_at DESC
    `, [companyId, targetSessionId]);

    console.log(`[REASSOCIATOR] Encontradas ${orphanedConversations.rows.length} conversas para reassociar à sessão "${targetSessionId}".`);

    for (const conv of orphanedConversations.rows) {
      // Verificar se já existe uma conversa com o mesmo remote_jid na sessão alvo
      const existing = await client.query(`
        SELECT id FROM conversations
        WHERE company_id = $1 AND session_id = $2 AND remote_jid = $3
        LIMIT 1
      `, [companyId, targetSessionId, conv.remote_jid]);

      if (existing.rows[0]) {
        const targetConvId = existing.rows[0].id;
        // Mover mensagens da conversa antiga para a conversa existente na sessão alvo
        await client.query(`
          UPDATE messages
          SET conversation_id = $1, session_id = $2
          WHERE conversation_id = $3 AND company_id = $4
        `, [targetConvId, targetSessionId, conv.id, companyId]);

        // Remover conversa duplicada
        await client.query(`DELETE FROM conversations WHERE id = $1`, [conv.id]);
      } else {
        // Atualizar a sessão da conversa para a sessão alvo
        await client.query(`
          UPDATE conversations
          SET session_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [targetSessionId, conv.id]);
      }
    }

    // 3. Atualizar mensagens restantes que ainda tenham outro session_id na mesma empresa
    const updatedMessages = await client.query(`
      UPDATE messages
      SET session_id = $1
      WHERE company_id = $2 AND (session_id <> $1 OR session_id IS NULL)
    `, [targetSessionId, companyId]);

    console.log(`[REASSOCIATOR] ${updatedMessages.rowCount} mensagens reassociadas para session_id="${targetSessionId}".`);

    // 4. Atualizar memórias salvas em ai_conversation_memory com session_id nulo ou antigo
    const orphanedMemories = await client.query(`
      SELECT id, contact_id FROM ai_conversation_memory
      WHERE company_id = $1 AND (session_id <> $2 OR session_id IS NULL)
    `, [companyId, targetSessionId]);

    for (const mem of orphanedMemories.rows) {
      const existingMem = await client.query(`
        SELECT id FROM ai_conversation_memory
        WHERE company_id = $1 AND session_id = $2 AND contact_id = $3
        LIMIT 1
      `, [companyId, targetSessionId, mem.contact_id]);

      if (existingMem.rows[0]) {
        await client.query(`DELETE FROM ai_conversation_memory WHERE id = $1`, [mem.id]);
      } else {
        await client.query(`
          UPDATE ai_conversation_memory
          SET session_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [targetSessionId, mem.id]);
      }
    }

    // 5. Limpar erro na tabela whatsapp_history_sync para rearmar o sync contínuo
    await client.query(`
      INSERT INTO whatsapp_history_sync (company_id, session_id, learning_enabled, last_error)
      VALUES ($1, $2, TRUE, NULL)
      ON CONFLICT (company_id, session_id)
      DO UPDATE SET last_error = NULL, learning_enabled = TRUE
    `, [companyId, targetSessionId]);

    await client.query('COMMIT');
    console.log(`[REASSOCIATOR] Reassociação concluída com sucesso para empresa "${companyId}" e sessão "${targetSessionId}".`);
    return { ok: true, reassociatedConversations: orphanedConversations.rows.length, updatedMessages: updatedMessages.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[REASSOCIATOR] Erro ao reassociar conversas:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  reassociateCompanyConversationsToSession,
};
