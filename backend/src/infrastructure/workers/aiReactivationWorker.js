const { query } = require('../config/database');

let isRunning = false;

async function processAiReactivation() {
  if (isRunning) return;
  isRunning = true;
  try {
    const { rows } = await query(
      `UPDATE conversations 
       SET ai_enabled = true, ai_reactivate_at = NULL 
       WHERE ai_reactivate_at IS NOT NULL AND ai_reactivate_at <= NOW()
       RETURNING id, remote_jid as phone, ai_enabled`
    );

    if (rows && rows.length > 0) {
      console.log(`[AI-REACTIVATION-WORKER] Reativado AI para ${rows.length} conversas.`);
      const io = global.io;
      if (io) {
        for (const row of rows) {
          io.emit('conversation_updated', {
            id: String(row.id),
            ai_enabled: true,
            ai_reactivate_at: null,
          });
        }
      }
    }
  } catch (error) {
    console.error('[AI-REACTIVATION-WORKER] Error processing reactivation:', error.message);
  } finally {
    isRunning = false;
  }
}

module.exports = {
  processAiReactivation,
};
