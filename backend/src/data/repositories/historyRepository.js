// History bypasses the realtime pipeline deliberately: no unread/AI/campaign side effects.
const draftRevision = candidate => require('crypto').createHash('sha256').update(JSON.stringify(candidate)).digest('hex');

class HistoryRepository {
  constructor(pool) { this.pool = pool; }

  async owner(sessionId) {
    const { rows } = await this.pool.query('SELECT company_id FROM sessions WHERE session_id = $1', [sessionId]);
    if (!rows[0]?.company_id) throw new Error('Sessão sem empresa autenticada.');
    return rows[0].company_id;
  }

  async ensure(companyId, sessionId) {
    if (!companyId || !sessionId || await this.owner(sessionId) !== companyId) throw new Error('Sessão não pertence à empresa.');
    await this.pool.query(`INSERT INTO whatsapp_history_sync(company_id, session_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [companyId, sessionId]);
  }

  async enqueue(companyId, sessionId, items) {
    await this.ensure(companyId, sessionId);
    // Bounded INSERTs, without truncating the supplied history event.
    for (let start = 0; start < items.length; start += 100) {
      await this.pool.query(`INSERT INTO whatsapp_history_items
        (company_id, session_id, chat_jid, message_key, raw_message, from_me, occurred_at, chat_name, archived, origin)
        SELECT $1,$2,x.jid,x.key,x.raw,x.sent,x.at,x.name,x.archived,x.origin
        FROM jsonb_to_recordset($3::jsonb) AS x(jid TEXT,key TEXT,raw TEXT,sent BOOLEAN,at TIMESTAMPTZ,name TEXT,archived BOOLEAN,origin TEXT)
        ON CONFLICT (company_id,session_id,chat_jid,message_key) DO NOTHING`,
      [companyId, sessionId, JSON.stringify(items.slice(start, start + 100))]);
    }
    await this.pool.query(`UPDATE whatsapp_history_sync SET last_received_at=NOW(),last_error=NULL WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId]);
  }

  async enqueueChats(companyId, sessionId, chats) {
    await this.ensure(companyId, sessionId);
    for (let start = 0; start < chats.length; start += 100) {
      await this.pool.query(`INSERT INTO whatsapp_history_chats(company_id,session_id,chat_jid,name,archived)
        SELECT $1,$2,x.id,x.name,x.archived FROM jsonb_to_recordset($3::jsonb) AS x(id TEXT,name TEXT,archived BOOLEAN)
        ON CONFLICT(company_id,session_id,chat_jid) DO UPDATE SET name=COALESCE(EXCLUDED.name,whatsapp_history_chats.name)`, [companyId, sessionId, JSON.stringify(chats.slice(start, start + 100))]);
    }
  }

  async ensureConversation(client, item) {
    // Keep unresolved LIDs distinct from phone numbers instead of inventing a phone mapping.
    const phone = item.chat_jid.endsWith('@lid') ? item.chat_jid : item.chat_jid.split('@')[0];
    const lead = await client.query(`INSERT INTO leads(company_id,phone,name) VALUES($1,$2,$3)
      ON CONFLICT(company_id,phone) DO UPDATE SET name=COALESCE(leads.name,EXCLUDED.name) RETURNING id`, [item.company_id, phone, item.chat_name || item.name || phone]);
    let conversation = (await client.query(`SELECT id FROM conversations WHERE company_id=$1 AND session_id=$2 AND remote_jid=$3 LIMIT 1`, [item.company_id, item.session_id, item.chat_jid])).rows[0];
    if (!conversation) {
      conversation = (await client.query(`INSERT INTO conversations(company_id,session_id,lead_id,remote_jid,ai_enabled,unread_count,status,created_at,updated_at)
        VALUES($1,$2,$3,$4,FALSE,0,$5,$6,$6)
        ON CONFLICT(company_id,session_id,remote_jid) DO UPDATE SET remote_jid=EXCLUDED.remote_jid RETURNING id`,
      [item.company_id, item.session_id, lead.rows[0].id, item.chat_jid, item.archived ? 'archived' : 'open', item.occurred_at || new Date(0)])).rows[0];
    }
    return { conversation, phone };
  }

  async importChats(companyId, sessionId) {
    const chats = (await this.pool.query(`SELECT * FROM whatsapp_history_chats WHERE company_id=$1 AND session_id=$2 AND NOT imported LIMIT 50`, [companyId, sessionId])).rows;
    for (const chat of chats) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [JSON.stringify([companyId, sessionId, chat.chat_jid])]);
        await this.ensureConversation(client, chat);
        await client.query(`UPDATE whatsapp_history_chats SET imported=TRUE WHERE company_id=$1 AND session_id=$2 AND chat_jid=$3`, [companyId, sessionId, chat.chat_jid]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
  }

  async pending(companyId, sessionId, media = false) {
    const condition = media ? `import_state='done' AND media_attempts < 3 AND (media_state='pending' OR
      (media_state='downloaded' AND EXISTS(SELECT 1 FROM whatsapp_history_sync s WHERE s.company_id=whatsapp_history_items.company_id AND s.session_id=whatsapp_history_items.session_id AND s.learning_enabled)))` : "import_state='pending' AND import_attempts < 3";
    return (await this.pool.query(`SELECT * FROM whatsapp_history_items WHERE company_id=$1 AND session_id=$2 AND ${condition} ORDER BY id LIMIT $3`, [companyId, sessionId, media ? 3 : 50])).rows;
  }

  async persist(item, payload) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serializes only a tenant/session conversation, also across worker restarts.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [JSON.stringify([item.company_id, item.session_id, item.chat_jid])]);
      const locked = await client.query(`SELECT import_state FROM whatsapp_history_items WHERE id=$1 AND company_id=$2 AND session_id=$3 FOR UPDATE`, [item.id, item.company_id, item.session_id]);
      if (!locked.rows[0] || locked.rows[0].import_state === 'done') { await client.query('COMMIT'); return; }
      // A live observation must never create a second incoming message while realtime persistence is in flight.
      if (item.origin === 'live_unknown') {
        const live = (await client.query(`SELECT id FROM messages WHERE company_id=$1 AND session_id=$2 AND whatsapp_message_id=$3 AND remote_jid=$4 LIMIT 1`, [item.company_id, item.session_id, item.message_key, item.chat_jid])).rows[0];
        if (!live) {
          await client.query(`UPDATE whatsapp_history_items SET import_state=CASE WHEN created_at<NOW()-INTERVAL '10 minutes' THEN 'failed' ELSE 'pending' END,
            last_error='live_message_not_persisted' WHERE id=$1 AND company_id=$2 AND session_id=$3`, [item.id, item.company_id, item.session_id]);
          await client.query('COMMIT'); return;
        }
      }
      const { conversation, phone } = await this.ensureConversation(client, item);
      let message = (await client.query(`SELECT id,sender,media_path,message_origin FROM messages WHERE company_id=$1 AND session_id=$2 AND whatsapp_message_id=$3
        AND (remote_jid=$4 OR (remote_jid IS NULL AND conversation_id=$5)) LIMIT 1`, [item.company_id, item.session_id, item.message_key, item.chat_jid, conversation.id])).rows[0];
      if (!message) {
        message = (await client.query(`INSERT INTO messages(company_id,session_id,conversation_id,phone,text,content,media_type,type,from_me,sender,direction,status,timestamp,created_at,whatsapp_message_id,remote_jid,history_item_id)
          VALUES($1,$2,$3,$4,$5,$5,$6,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14) RETURNING id`,
        [item.company_id, item.session_id, conversation.id, phone, payload.text || '', payload.mediaType || 'text', item.from_me,
          item.from_me ? 'agent' : 'client', item.from_me ? 'outgoing' : 'incoming', item.from_me ? 'sent' : 'received', item.occurred_at || new Date(), item.message_key, item.chat_jid, item.id])).rows[0];
      }
      const origin = message.message_origin && message.message_origin !== 'unknown' ? message.message_origin : message.sender === 'ai' || message.sender === 'bot' ? 'ai' : item.origin;
      // Only refresh preview if this really is the newest stored message. Preserve status and unread count.
      await client.query(`UPDATE conversations c SET last_message=$4,last_message_type=$5,updated_at=$6
        WHERE c.id=$1 AND c.company_id=$2 AND c.session_id=$3 AND c.updated_at <= $6
        AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.company_id=$2 AND m.session_id=$3 AND m.conversation_id=c.id AND m.timestamp > $6)`,
      [conversation.id, item.company_id, item.session_id, payload.text || `[${payload.mediaType || 'text'}]`, payload.mediaType || 'text', item.occurred_at || new Date()]);
      await client.query(`UPDATE whatsapp_history_items SET import_state='done',message_id=$4,text=$5,media_type=$6,
        media_state=$7,media_path=$8,origin=$9,last_error=NULL,updated_at=NOW() WHERE id=$1 AND company_id=$2 AND session_id=$3`,
      [item.id, item.company_id, item.session_id, message.id, payload.text || '', payload.mediaType || 'text', payload.mediaType ? 'pending' : 'none', message.media_path || null, origin]);
      await client.query('COMMIT');
      if (global.io) {
        global.io.emit('conversation:update', { id: conversation.id, sessionId: item.session_id });
        global.io.emit('conversation_updated', { id: conversation.id, sessionId: item.session_id });
      }
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async fail(item, media, code) {
    const attempts = media ? 'media_attempts' : 'import_attempts';
    const state = media ? 'media_state' : 'import_state';
    await this.pool.query(`UPDATE whatsapp_history_items SET ${attempts}=${attempts}+1,
      ${state}=CASE WHEN ${attempts}+1>=3 THEN 'failed' ELSE 'pending' END,last_error=$4,updated_at=NOW()
      WHERE id=$1 AND company_id=$2 AND session_id=$3`, [item.id, item.company_id, item.session_id, code]);
  }

  async saveMedia(item, path, text, state = 'done') {
    await this.pool.query(`UPDATE whatsapp_history_items SET media_path=$4,media_text=$5,media_state=$6,last_error=NULL,updated_at=NOW()
      WHERE id=$1 AND company_id=$2 AND session_id=$3`, [item.id, item.company_id, item.session_id, path, text, state]);
    if (path) await this.pool.query(`UPDATE messages SET media_path=$4,media_url=$4 WHERE id=$1 AND company_id=$2 AND session_id=$3`, [item.message_id, item.company_id, item.session_id, path]);
  }

  async status(companyId, sessionId) {
    await this.ensure(companyId, sessionId);
    const sync = (await this.pool.query('SELECT * FROM whatsapp_history_sync WHERE company_id=$1 AND session_id=$2', [companyId, sessionId])).rows[0];
    const counts = (await this.pool.query(`SELECT COUNT(*)::int AS total,COUNT(DISTINCT chat_jid)::int AS conversations,
      COUNT(*) FILTER(WHERE import_state='done')::int AS imported,COUNT(*) FILTER(WHERE import_state='pending')::int AS pending,
      COUNT(*) FILTER(WHERE import_state='failed')::int AS failed,
      COUNT(*) FILTER(WHERE import_state='done' AND media_type IS NOT NULL AND media_type NOT IN ('text','none'))::int AS media_identified,
      COUNT(*) FILTER(WHERE import_state='done' AND media_type IS NOT NULL AND media_type NOT IN ('text','none') AND media_state='pending')::int AS media_pending,
      COUNT(*) FILTER(WHERE import_state='done' AND media_type IS NOT NULL AND media_type NOT IN ('text','none') AND media_state='failed')::int AS media_failed,
      COUNT(*) FILTER(WHERE import_state='done' AND media_type IS NOT NULL AND media_type NOT IN ('text','none') AND media_state='done')::int AS media_done,
      COUNT(*) FILTER(WHERE import_state='done' AND media_type IS NOT NULL AND media_type NOT IN ('text','none') AND media_state='unsupported')::int AS media_unsupported,
      COUNT(*) FILTER(WHERE import_state='done' AND media_type IS NOT NULL AND media_type NOT IN ('text','none') AND media_state='downloaded')::int AS media_downloaded,
      MIN(occurred_at) AS first_message_at,MAX(occurred_at) AS last_message_at,MAX(updated_at) AS source_updated_at,COALESCE(MAX(id),0)::text AS watermark
      FROM whatsapp_history_items WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId])).rows[0];
    const drafts = (await this.pool.query(`SELECT id,status,target_agent_key,candidate,cursor_id,watermark,last_error,created_at,published_agent_key
      FROM ai_history_drafts WHERE company_id=$1 AND session_id=$2 ORDER BY id DESC LIMIT 10`, [companyId, sessionId])).rows;
    const chatCounts = (await this.pool.query(`SELECT COUNT(*)::int AS chats,COUNT(*) FILTER(WHERE NOT imported)::int AS pending_chats FROM whatsapp_history_chats WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId])).rows[0];
    return { ...sync, ...counts, conversations: Math.max(counts.conversations, chatCounts.chats), pending_chats: chatCounts.pending_chats,
      drafts: drafts.map(d => ({ ...d, revision: draftRevision(d.candidate) })), coverage: 'Somente o histórico disponibilizado pelo WhatsApp; mensagens e mídias antigas podem estar ausentes.' };
  }

  async resume(companyId, sessionId) {
    await this.ensure(companyId, sessionId);
    await this.pool.query(`UPDATE whatsapp_history_sync SET last_error=NULL WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId]);
    await this.pool.query(`UPDATE whatsapp_history_items SET import_state=CASE WHEN import_state='failed' THEN 'pending' ELSE import_state END,
      media_state=CASE WHEN media_state='failed' THEN 'pending' ELSE media_state END,import_attempts=0,media_attempts=0,last_error=NULL
      WHERE company_id=$1 AND session_id=$2 AND (import_state='failed' OR media_state='failed')`, [companyId, sessionId]);
  }
}
module.exports = { HistoryRepository, draftRevision };
