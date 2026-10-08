const { Client } = require('/opt/zapai/backend/node_modules/pg');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zapai_crm'
  });
  await c.connect();

  console.log('=== DETAILED FILTERING OF AD LEADS WITHOUT RESPONSE ===');

  const query = `
    WITH ad_convs AS (
      SELECT DISTINCT conversation_id
      FROM messages
      WHERE from_me = false
        AND (
          content ILIKE '%(Anúncio:%'
          OR content ILIKE '%anúncio%'
          OR content ILIKE '%anuncio%'
          OR content ILIKE '%churras%'
        )
    ),
    conv_data AS (
      SELECT 
        c.id as conversation_id,
        c.remote_jid,
        c.lead_id,
        c.status as conv_status,
        c.lead_temperature,
        c.funnel_stage,
        c.last_message,
        c.last_message_at,
        c.created_at as conv_created_at,
        l.phone as lead_phone,
        l.name as lead_name,
        (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id) as total_msgs,
        (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id AND m.from_me = true) as out_msgs,
        (SELECT m_first.content FROM messages m_first WHERE m_first.conversation_id = c.id ORDER BY m_first.created_at ASC LIMIT 1) as first_msg,
        (SELECT m_last.from_me FROM messages m_last WHERE m_last.conversation_id = c.id ORDER BY m_last.created_at DESC LIMIT 1) as last_from_me,
        (SELECT m_last.content FROM messages m_last WHERE m_last.conversation_id = c.id ORDER BY m_last.created_at DESC LIMIT 1) as last_msg_content,
        (SELECT m_last.created_at FROM messages m_last WHERE m_last.conversation_id = c.id ORDER BY m_last.created_at DESC LIMIT 1) as last_msg_time
      FROM conversations c
      JOIN ad_convs ac ON ac.conversation_id = c.id
      LEFT JOIN leads l ON l.id = c.lead_id
      WHERE c.remote_jid NOT LIKE '%@g.us'
        AND c.remote_jid NOT LIKE '%@broadcast'
    )
    SELECT * FROM conv_data
    ORDER BY last_message_at DESC NULLS LAST;
  `;

  const { rows } = await c.query(query);
  console.log(`Total candidate conversations: ${rows.length}`);

  const myPhones = ['553193672075', '3193672075'];
  const lostRegex = /(comprei em outro|ja comprei|j[aá] comprei|fechei com outro|extornado|estornado|cancelar|n[aã]o quero mais|n[aã]o precisa)/i;

  const validLeads = [];
  let skippedOperator = 0;
  let skippedLost = 0;
  let skippedAnsweredAndClosed = 0;

  for (const r of rows) {
    const rawTarget = String(r.lead_phone || r.remote_jid || '');
    if (myPhones.some(p => rawTarget.includes(p))) {
      skippedOperator++;
      continue;
    }

    const lastText = (r.last_msg_content || r.last_message || '').trim();
    if (lostRegex.test(lastText)) {
      skippedLost++;
      continue;
    }

    // Must be WITHOUT RESPONSE:
    // Either out_msgs === 0 (we never replied) OR last_from_me === false (last message was from client and unreplied)
    const isUnanswered = (parseInt(r.out_msgs, 10) === 0) || (r.last_from_me === false);
    if (!isUnanswered) {
      skippedAnsweredAndClosed++;
      continue;
    }

    // Clean name
    let cleanName = r.lead_name || '';
    if (!cleanName || cleanName.includes('@lid') || cleanName.includes('@s.whatsapp.net')) {
      cleanName = 'Cliente';
    }

    validLeads.push({
      conversationId: r.conversation_id,
      leadId: r.lead_id,
      name: cleanName,
      phone: r.lead_phone || r.remote_jid,
      remoteJid: r.remote_jid,
      outMsgs: parseInt(r.out_msgs, 10),
      totalMsgs: parseInt(r.total_msgs, 10),
      lastFromMe: r.last_from_me,
      lastMsg: lastText.slice(0, 60),
      lastMsgTime: r.last_msg_time,
      temperature: r.lead_temperature || 'warm',
      funnelStage: r.funnel_stage || 'lead'
    });
  }

  console.log(`Skipped operator phones: ${skippedOperator}`);
  console.log(`Skipped lost leads: ${skippedLost}`);
  console.log(`Skipped answered & resolved leads: ${skippedAnsweredAndClosed}`);
  console.log(`\n>>> QUALIFIED UNANSWERED AD LEADS: ${validLeads.length} <<<`);

  console.log('\nBreakdown of Qualified Leads:');
  const zeroOut = validLeads.filter(l => l.outMsgs === 0);
  const droppedOff = validLeads.filter(l => l.outMsgs > 0 && l.lastFromMe === false);
  console.log(`- 100% Zero Outbound (Nunca receberam resposta): ${zeroOut.length}`);
  console.log(`- Última mensagem do cliente sem retorno (Aguardando resposta): ${droppedOff.length}`);

  console.log('\nSample 10 Qualified Leads:');
  console.log(JSON.stringify(validLeads.slice(0, 10), null, 2));

  await c.end();
}

main().catch(console.error);
