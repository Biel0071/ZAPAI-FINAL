const { query } = require('../config/database');

let isRunning = false;

async function processAiReactivation() {
  if (isRunning) return;
  isRunning = true;
  try {
    // 1. Clean up stale countdowns for leads that are paused, deactivated or handled manually
    // NEVER turn ai_enabled = true on them!
    await query(
      `UPDATE conversations
       SET ai_reactivate_at = NULL
       WHERE ai_reactivate_at IS NOT NULL
         AND (
           status IN ('paused', 'closed', 'pending_human', 'intervencao_humana', 'finalizado', 'pago', 'blocked')
           OR COALESCE(funnel_stage, '') IN ('intervencao_humana', 'fechado', 'perdido', 'cancelado', 'aguardando_pix', 'finalizado', 'pago')
           OR 'desativado' = ANY(COALESCE(tags, '{}'))
           OR 'ai_desativado' = ANY(COALESCE(tags, '{}'))
           OR 'pausado' = ANY(COALESCE(tags, '{}'))
           OR 'intervencao' = ANY(COALESCE(tags, '{}'))
           OR 'intervencao_humana' = ANY(COALESCE(tags, '{}'))
           OR 'atendimento_manual' = ANY(COALESCE(tags, '{}'))
           OR 'manual' = ANY(COALESCE(tags, '{}'))
           OR 'nao_reativar' = ANY(COALESCE(tags, '{}'))
           OR 'followup_desativado' = ANY(COALESCE(tags, '{}'))
           OR 'followup_esgotado' = ANY(COALESCE(tags, '{}'))
         )`
    );

    // 2. Only reactivate conversations that were genuinely open with a temporary delay countdown
    const { rows } = await query(
      `UPDATE conversations 
       SET ai_enabled = true, ai_reactivate_at = NULL 
       WHERE ai_reactivate_at IS NOT NULL 
         AND ai_reactivate_at <= NOW()
         AND status = 'open'
         AND COALESCE(funnel_stage, '') NOT IN ('intervencao_humana', 'fechado', 'perdido', 'cancelado', 'aguardando_pix', 'finalizado', 'pago')
         AND NOT ('desativado' = ANY(COALESCE(tags, '{}')))
         AND NOT ('ai_desativado' = ANY(COALESCE(tags, '{}')))
         AND NOT ('pausado' = ANY(COALESCE(tags, '{}')))
         AND NOT ('intervencao' = ANY(COALESCE(tags, '{}')))
         AND NOT ('intervencao_humana' = ANY(COALESCE(tags, '{}')))
         AND NOT ('atendimento_manual' = ANY(COALESCE(tags, '{}')))
         AND NOT ('manual' = ANY(COALESCE(tags, '{}')))
         AND NOT ('nao_reativar' = ANY(COALESCE(tags, '{}')))
         AND NOT ('followup_desativado' = ANY(COALESCE(tags, '{}')))
         AND NOT ('followup_esgotado' = ANY(COALESCE(tags, '{}')))
       RETURNING id, remote_jid as phone, ai_enabled`
    );

    if (rows && rows.length > 0) {
      console.log(`[AI-REACTIVATION-WORKER] Reativado AI para ${rows.length} conversas legítimas.`);
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
