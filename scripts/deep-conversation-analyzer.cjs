const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function analyzeConversations() {
  console.log('--- STARTING CONVERSATION ANALYSIS ---');

  // 1. Overview counts
  const totalConvs = await pool.query('SELECT count(*) FROM conversations');
  const totalMsgs = await pool.query('SELECT count(*) FROM messages');
  const totalLeads = await pool.query('SELECT count(*) FROM leads');
  const inboundMsgs = await pool.query("SELECT count(*) FROM messages WHERE from_me = false OR direction = 'inbound'");
  const outboundMsgs = await pool.query("SELECT count(*) FROM messages WHERE from_me = true OR direction = 'outbound'");
  const aiMsgs = await pool.query("SELECT count(*) FROM messages WHERE LOWER(COALESCE(sender, '')) IN ('ai', 'bot', 'assistant') OR (from_me = true AND (sender IS NULL OR sender = 'ai'))");
  
  // Media types
  const mediaTypes = await pool.query(`
    SELECT COALESCE(media_type, type, 'text') as mtype, count(*) 
    FROM messages 
    GROUP BY mtype 
    ORDER BY count(*) DESC
  `);

  // Intent & Sentiment distribution
  const intents = await pool.query(`
    SELECT COALESCE(lead_intent, 'indefinido') as intent, count(*) 
    FROM conversations 
    GROUP BY intent 
    ORDER BY count(*) DESC
  `);

  const temperatures = await pool.query(`
    SELECT COALESCE(lead_temperature, 'cold') as temp, count(*) 
    FROM conversations 
    GROUP BY temp 
    ORDER BY count(*) DESC
  `);

  const stages = await pool.query(`
    SELECT COALESCE(funnel_stage, 'novo') as stage, count(*) 
    FROM conversations 
    GROUP BY stage 
    ORDER BY count(*) DESC
  `);

  // Message volume per conversation
  const convVolumes = await pool.query(`
    SELECT c.id, c.remote_jid, l.name, l.phone, count(m.id) as msg_count,
           SUM(CASE WHEN m.from_me = false THEN 1 ELSE 0 END) as in_count,
           SUM(CASE WHEN m.from_me = true THEN 1 ELSE 0 END) as out_count
    FROM conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    LEFT JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id, c.remote_jid, l.name, l.phone
    ORDER BY msg_count DESC
  `);

  // Sample interactions to analyze response patterns and quality
  const sampleInteractions = await pool.query(`
    SELECT c.id as conv_id, l.name, l.phone, m.from_me, m.sender, m.content, m.timestamp
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE c.id IN (
      SELECT conversation_id FROM messages GROUP BY conversation_id HAVING count(*) >= 5 LIMIT 5
    )
    ORDER BY c.id, m.timestamp ASC
    LIMIT 60
  `);

  console.log(JSON.stringify({
    totalConversations: totalConvs.rows[0].count,
    totalMessages: totalMsgs.rows[0].count,
    totalLeads: totalLeads.rows[0].count,
    inbound: inboundMsgs.rows[0].count,
    outbound: outboundMsgs.rows[0].count,
    aiMessages: aiMsgs.rows[0].count,
    mediaTypes: mediaTypes.rows,
    intents: intents.rows,
    temperatures: temperatures.rows,
    stages: stages.rows,
    topConversations: convVolumes.rows.slice(0, 10),
    sampleCount: sampleInteractions.rows.length
  }, null, 2));

  await pool.end();
}

analyzeConversations().catch(console.error);
