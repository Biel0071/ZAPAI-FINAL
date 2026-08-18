const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.production.local') });
dotenv.config({ path: path.join(__dirname, '.env.production') });

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapadmin123@localhost:5432/zapai_crm';
  const pool = new Pool({ connectionString });
  
  const report = {};
  
  try {
    // 1. Total Conversas e Interferência Humana
    const convTotal = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN human_override = true THEN 1 ELSE 0 END) as human_interfered,
        SUM(CASE WHEN status = 'abandoned' OR status = 'archived' OR archived = true THEN 1 ELSE 0 END) as abandoned,
        SUM(CASE WHEN ai_enabled = true THEN 1 ELSE 0 END) as ai_handled
      FROM conversations
    `);
    report.conversations = convTotal.rows[0];

    // 2. Funnel Stages
    const funnels = await pool.query(`
      SELECT funnel_stage, COUNT(*) as count 
      FROM conversations 
      GROUP BY funnel_stage 
      ORDER BY count DESC
    `);
    report.funnel_stages = funnels.rows;

    // 3. Etiquetas (Tags) e Intents
    const tags = await pool.query(`
      SELECT unnest(tags) as tag, COUNT(*) as count
      FROM conversations
      WHERE tags IS NOT NULL
      GROUP BY tag
      ORDER BY count DESC
    `);
    report.tags = tags.rows;

    const intents = await pool.query(`
      SELECT lead_intent, COUNT(*) as count
      FROM conversations
      GROUP BY lead_intent
      ORDER BY count DESC
    `);
    report.intents = intents.rows;

    // 4. Taxa de Respostas
    const msgStats = await pool.query(`
      SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN from_me = true THEN 1 ELSE 0 END) as sent_by_bot,
        SUM(CASE WHEN from_me = false THEN 1 ELSE 0 END) as received_from_lead
      FROM messages
    `);
    report.messages = msgStats.rows[0];

    // 5. Reativações (Follow-ups)
    const followups = await pool.query(`
      SELECT COUNT(*) as count
      FROM conversations
      WHERE ai_last_followup_at IS NOT NULL
    `);
    report.followups = followups.rows[0].count;

    // 6. Bugs / Erros
    const auditLogs = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM message_audit_logs
      GROUP BY status
    `);
    report.audit_logs = auditLogs.rows;
    
    const errors = await pool.query(`
      SELECT error_message, COUNT(*) as count
      FROM message_audit_logs
      WHERE status = 'error' OR status = 'failed'
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 10
    `);
    report.top_errors = errors.rows;

    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
