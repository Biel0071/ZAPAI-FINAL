const { query } = require('../src/infrastructure/config/database');

async function audit() {
  console.log('\n=== 1. SEARCH FOR "NATAL" IN MESSAGES, QUICK REPLIES, MEDIA ===');
  const natalMsgs = await query(`
    SELECT id, conversation_id, sender, text, media_url, media_type, created_at
    FROM messages
    WHERE text ILIKE '%natal%' OR media_url ILIKE '%natal%'
    ORDER BY id DESC LIMIT 20
  `);
  console.log('Natal messages found:', natalMsgs.rows);

  const quickReplies = await query(`
    SELECT *
    FROM quick_replies
    WHERE (content ILIKE '%natal%' OR title ILIKE '%natal%' OR media_url ILIKE '%natal%')
    LIMIT 20
  `).catch(async () => {
    return await query(`SELECT * FROM quick_replies LIMIT 20`);
  });
  console.log('Quick replies:', quickReplies.rows);

  console.log('\n=== 2. SEARCH FOR "ZAI" OR "ZAIBOT" LEAKING IN OUTBOUND MESSAGES (FROM_ME = TRUE) ===');
  const zaiLeaks = await query(`
    SELECT m.id, m.conversation_id, m.sender, m.text, m.created_at, c.agent_name
    FROM messages m
    LEFT JOIN conversations c ON c.id = m.conversation_id
    WHERE m.from_me = true 
      AND (
        m.text ILIKE '%assistente zai%' 
        OR m.text ILIKE '%zaibot%' 
        OR m.text ILIKE '%sou o zai%' 
        OR m.text ILIKE '%sou a zai%' 
        OR m.text ILIKE '%plataforma zai%'
        OR m.text ILIKE '%sou o assistente virtual do zai%'
        OR m.text ILIKE '%assistente do zai%'
        OR m.text ILIKE '%sistema zai%'
      )
    ORDER BY m.id DESC LIMIT 30
  `);
  console.log(`Found ${zaiLeaks.rows.length} outbound messages mentioning ZAI:`);
  for (const m of zaiLeaks.rows) {
    console.log(`[${m.id}] Conv ${m.conversation_id} | Agent: ${m.agent_name} | Sender: ${m.sender} | Date: ${m.created_at}`);
    console.log(`  Text: ${m.text}\n`);
  }

  console.log('\n=== 3. SEARCH RECENT MEDIA SENT (FROM_ME = TRUE, MEDIA_URL IS NOT NULL) ===');
  const sentMedia = await query(`
    SELECT m.id, m.conversation_id, m.media_url, m.media_type, m.media_path, m.created_at, m.text
    FROM messages m
    WHERE m.from_me = true AND (m.media_url IS NOT NULL OR m.media_type IS NOT NULL)
    ORDER BY m.id DESC LIMIT 25
  `);
  console.log(`Found ${sentMedia.rows.length} outbound media messages:`);
  for (const m of sentMedia.rows) {
    console.log(`[${m.id}] Conv ${m.conversation_id} | Type: ${m.media_type} | URL: ${m.media_url} | Path: ${m.media_path} | Text: ${m.text}`);
  }

  console.log('\n=== 4. SEARCH AUDIO MESSAGES (MEDIA_TYPE = AUDIO OR PTT) ===');
  const audioMsgs = await query(`
    SELECT m.id, m.conversation_id, m.from_me, m.sender, m.media_url, m.media_type, m.created_at
    FROM messages m
    WHERE m.media_type IN ('audio', 'ptt', 'voice') OR m.media_url ILIKE '%.mp3' OR m.media_url ILIKE '%.ogg' OR m.media_url ILIKE '%.opus'
    ORDER BY m.id DESC LIMIT 20
  `);
  console.log(`Found ${audioMsgs.rows.length} audio messages:`);
  for (const m of audioMsgs.rows) {
    console.log(`[${m.id}] Conv ${m.conversation_id} | FromMe: ${m.from_me} | Sender: ${m.sender} | URL: ${m.media_url} | Type: ${m.media_type}`);
  }

  console.log('\n=== 5. CHECK CONVERSATION 11129 (Fábio Oliveira - images sent at 09:02) ===');
  const conv11129 = await query(`
    SELECT id, from_me, sender, text, media_url, media_type, media_path, created_at
    FROM messages
    WHERE conversation_id = 11129
    ORDER BY id DESC LIMIT 20
  `);
  console.log(`Conv 11129 latest messages:`);
  for (const m of conv11129.rows) {
    console.log(`[${m.id}] FromMe: ${m.from_me} | Sender: ${m.sender} | Type: ${m.media_type} | URL: ${m.media_url} | Path: ${m.media_path} | Text: ${m.text}`);
  }

  const allQr = await query(`SELECT * FROM quick_replies ORDER BY id ASC LIMIT 50`);
  console.log('All Quick Replies count:', allQr.rows.length);
  for (const qr of allQr.rows) {
    console.log(`[${qr.id}] ${qr.title || qr.name || 'No title'} | Type: ${qr.media_type} | Media: ${qr.media_url} | Category: ${qr.category}`);
  }

  const camps = await query(`SELECT * FROM campaigns ORDER BY id DESC LIMIT 10`);
  console.log('Campaigns count:', camps.rows.length);
  for (const c of camps.rows) {
    console.log(`[${c.id}] ${c.name} | Status: ${c.status} | Created: ${c.created_at || c.created_date} | Msg: ${String(c.message || c.content || '').slice(0, 80)}`);
  }

  console.log('\n=== 8. CHECK RECENT AI AGENT RUNTIME LOGS / ERRORS ===');
  try {
    const logs = await query(`SELECT * FROM ai_interaction_logs ORDER BY id DESC LIMIT 10`);
    console.log('AI interaction logs count:', logs.rows.length);
    for (const l of logs.rows) {
      console.log(`[${l.id}] Conv ${l.conversation_id} | Prompt tokens: ${l.prompt_tokens} | Model: ${l.model_name}`);
    }
  } catch (e) {
    console.log('No ai_interaction_logs table, checking alternative...');
  }

  process.exit(0);
}

audit().catch(e => {
  console.error('Audit failed:', e);
  process.exit(1);
});
