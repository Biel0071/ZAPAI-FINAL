const { HistoryRepository } = require('../../src/data/repositories/historyRepository');
const { HistoryLearning } = require('../../src/ai/evolutionary/historyLearning');
const { extractIncomingMessage, downloadMedia } = require('./inbound/pipeline');
const { unwrapMessageContent, getMediaDescriptor } = require('./inbound/parser');
const { pool } = require('../../src/infrastructure/config/database');
const ai = require('../ai.service');
const agents = require('../../src/ai/agents/services/aiAgentService');
const { activeSessions } = require('./state/registry');

function isSyncableJid(jid) { return /@(s\.whatsapp\.net|lid|g\.us)$/.test(String(jid)); }
function individual(jid) { return /@(s\.whatsapp\.net|lid)$/.test(String(jid)); }

function encodeItems(messages, chats, proto, origin = 'unknown', { includeGroups = true } = {}) {
  const chatMap = new Map(chats.map(c => [c.id, c]));
  const filterFn = includeGroups ? isSyncableJid : individual;
  return messages.filter(m => m?.key?.id && filterFn(m.key.remoteJid) && m.message && !unwrapMessageContent(m.message).protocolMessage).map(m => {
    const seconds = Number(m.messageTimestamp || 0);
    const date = new Date(seconds * 1000);
    const chat = chatMap.get(m.key.remoteJid);
    return { jid: m.key.remoteJid, key: m.key.id, raw: Buffer.from(proto.WebMessageInfo.encode(m).finish()).toString('base64'),
      sent: Boolean(m.key.fromMe), at: seconds > 0 && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      name: chat?.name || chat?.subject || (!m.key.fromMe ? m.pushName : null) || null,
      archived: Boolean(chat?.archived || chat?.archive), origin };
  });
}

class HistorySync {
  constructor({ repository = new HistoryRepository(pool), learning = new HistoryLearning({ pool, analyze: ai.analyzeHistoryText, agents }), decode,
    extract = extractIncomingMessage, media = downloadMedia, transcribe = ai.transcribeAudio, describe = ai.describeImage } = {}) {
    this.repository = repository; this.learning = learning; this.decode = decode;
    this.extract = extract; this.media = media; this.transcribe = transcribe; this.describe = describe;
  }

  async receive(sessionId, messages = [], chats = [], origin = 'unknown') {
    const companyId = await this.repository.owner(sessionId);
    const { proto } = await import('@whiskeysockets/baileys');
    await this.repository.enqueueChats(companyId, sessionId, chats.filter(c => isSyncableJid(c?.id)).map(c => ({ id: c.id, name: c.name || c.subject || null, archived: Boolean(c.archived || c.archive) })));
    await this.repository.enqueue(companyId, sessionId, encodeItems(messages, chats, proto, origin, { includeGroups: true }));
  }

  async decodeItem(item) {
    if (this.decode) return this.decode(item.raw_message);
    const { proto } = await import('@whiskeysockets/baileys');
    return proto.WebMessageInfo.decode(Buffer.from(item.raw_message, 'base64'));
  }

  async seedStoredMessages(companyId, sessionId) {
    const db = this.repository.pool;
    const rows = (await db.query(`SELECT m.id, m.company_id, m.session_id, m.remote_jid, m.phone, m.text, m.content, m.type, m.media_type, m.media_url, m.media_path, m.whatsapp_message_id, m.from_me, m.timestamp, m.created_at, m.message_origin, m.sender,
      l.name AS contact_name,
      COALESCE(m.remote_jid, CASE WHEN m.phone LIKE '%@%' THEN m.phone ELSE m.phone || '@s.whatsapp.net' END) AS jid
      FROM messages m 
      LEFT JOIN conversations c ON c.id=m.conversation_id AND c.company_id=m.company_id AND c.session_id=m.session_id
      LEFT JOIN leads l ON l.id=c.lead_id AND l.company_id=m.company_id
      WHERE m.company_id=$1 AND m.session_id=$2 AND m.history_item_id IS NULL
        AND (m.remote_jid ~ '@(s\\.whatsapp\\.net|lid|g\\.us)$' OR (m.remote_jid IS NULL AND m.phone ~ '^[0-9]{7,20}(@(s\\.whatsapp\\.net|lid|g\\.us))?$'))
      ORDER BY m.id LIMIT 100`, [companyId, sessionId])).rows;
    if (!rows.length) return 0;
    const { proto } = await import('@whiskeysockets/baileys');
    for (const row of rows) {
      const type = row.media_type || row.type || 'text';
      const key = row.whatsapp_message_id || `stored:${row.id}`;
      const text = String(row.text || row.content || '').split('\n[META]')[0];
      const message = ['audio', 'image', 'video', 'document', 'sticker'].includes(type)
        ? { [`${type}Message`]: { caption: text } } : { conversation: text };
      const seconds = Math.max(0, Math.floor(new Date(row.timestamp || row.created_at || 0).getTime() / 1000)) || 0;
      const raw = Buffer.from(proto.WebMessageInfo.encode({ key: { remoteJid: row.jid, id: key, fromMe: row.from_me }, message, messageTimestamp: seconds }).finish()).toString('base64');
      const origin = row.message_origin !== 'unknown' ? row.message_origin : row.sender === 'ai' ? 'ai' : 'unknown';
      const inserted = (await db.query(`INSERT INTO whatsapp_history_items(company_id,session_id,chat_jid,message_key,raw_message,from_me,occurred_at,chat_name,
        import_state,message_id,text,media_type,media_path,media_state,origin)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'done',$9,$10,$11,$12,$13,$14)
        ON CONFLICT(company_id,session_id,chat_jid,message_key)
        DO UPDATE SET message_id = COALESCE(whatsapp_history_items.message_id, EXCLUDED.message_id)
        RETURNING id`,
      [companyId, sessionId, row.jid, key, raw, Boolean(row.from_me), row.timestamp || row.created_at, row.contact_name,
        row.id, text, type, row.media_path || row.media_url, type === 'text' ? 'none' : 'pending', origin || 'unknown'])).rows[0];
      const itemId = inserted?.id;
      if (itemId) {
        await db.query(`UPDATE messages SET history_item_id=$1 WHERE id=$2 AND company_id=$3 AND session_id=$4`, [itemId, row.id, companyId, sessionId]);
      }
    }
    return rows.length;
  }

  async process(companyId, sessionId) {
    await this.repository.importChats(companyId, sessionId);

    // Process pending history items first (in batches of 50, up to 10 batches = 500 items per call)
    let processedAny = false;
    let batchCount = 0;
    while (batchCount < 10) {
      const items = await this.repository.pending(companyId, sessionId);
      if (!items.length) break;
      for (const item of items) {
        try {
          const payload = await this.extract(await this.decodeItem(item), { skipMediaDownload: true, companyId });
          if (!payload) throw new Error('Formato indisponível');
          await this.repository.persist(item, payload);
          processedAny = true;
        } catch (error) { await this.repository.fail(item, false, `import_failed: ${String(error?.message || error).slice(0, 400)}`); }
      }
      batchCount++;
      if (items.length < 50) break;
    }

    if (!processedAny) {
      if (await this.seedStoredMessages(companyId, sessionId)) return;
    }

    const config = (await this.repository.pool.query(`SELECT learning_enabled,last_received_at,created_at FROM whatsapp_history_sync WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId])).rows[0];
    const mediaItems = await this.repository.pending(companyId, sessionId, true);
    if (mediaItems.length) {
      const item = mediaItems[0];
      try {
        const raw = await this.decodeItem(item);
        const { mediaMessage, mediaType } = getMediaDescriptor(unwrapMessageContent(raw.message));
        let url = item.media_path;
        if (!url) {
          const file = await this.media(mediaMessage, mediaType, companyId);
          if (!file?.url) throw new Error('Mídia indisponível');
          url = file.url;
          // Checkpoint the download, so provider failures do not download the same media again.
          await this.repository.saveMedia(item, url, null, 'pending');
        }
        if (!['image', 'audio', 'document'].includes(mediaType)) {
          await this.repository.saveMedia(item, url, null, 'unsupported');
        } else if (!config?.learning_enabled) {
          await this.repository.saveMedia(item, url, null, 'downloaded');
        } else if (mediaType === 'document') {
          const docName = mediaMessage?.fileName || mediaMessage?.title || 'Documento';
          const caption = mediaMessage?.caption ? ` - ${mediaMessage.caption}` : '';
          const docText = `[Documento/Anexo: ${docName}${caption}]`;
          await this.repository.saveMedia(item, url, docText, 'done');
        } else {
          const local = ai.resolveHistoryMediaPath(url, companyId);
          const text = mediaType === 'audio' ? await this.transcribe({ mediaUrl: local, companyId }) : await this.describe({ mediaUrl: local, companyId });
          if (!text?.trim()) throw new Error('Sem conteúdo interpretável');
          await this.repository.saveMedia(item, url, text);
        }
      } catch (error) { await this.repository.fail(item, true, `media_failed: ${String(error?.message || error).slice(0, 400)}`); }
      return;
    }
    if (config?.learning_enabled) {
      // Wait for the initial event burst; live traffic later produces bounded incremental versions.
      const latest = (await this.repository.pool.query(`SELECT created_at FROM ai_history_drafts WHERE company_id=$1 AND session_id=$2 ORDER BY id DESC LIMIT 1`, [companyId, sessionId])).rows[0];
      const quiet = !config.last_received_at || Date.now() - new Date(config.last_received_at).getTime() > 60000;
      const initialWaitElapsed = Date.now() - new Date(config.created_at).getTime() > 300000;
      if ((!latest && (quiet || initialWaitElapsed)) || (latest && Date.now() - new Date(latest.created_at).getTime() > 600000)) await this.learning.start(companyId, sessionId);
      await this.learning.step(companyId, sessionId);
    }
  }

  async requestOlder(companyId, sessionId) {
    const session = activeSessions[sessionId];
    if (session?.status !== 'connected' || !session.sock?.fetchMessageHistory) return;
    const client = this.repository.pool;

    // Rate-limit check: at most one request every 30 seconds
    const syncRow = (await client.query(
      `SELECT last_request_at FROM whatsapp_history_sync WHERE company_id=$1 AND session_id=$2`,
      [companyId, sessionId]
    )).rows[0];

    if (syncRow?.last_request_at && (Date.now() - new Date(syncRow.last_request_at).getTime()) < 30000) {
      return;
    }

    let row = (await client.query(`
      SELECT h.chat_jid, h.message_key, h.from_me, h.occurred_at
      FROM whatsapp_history_items h
      LEFT JOIN whatsapp_history_requests r
        ON r.company_id=h.company_id AND r.session_id=h.session_id AND r.chat_jid=h.chat_jid
      WHERE h.company_id=$1 AND h.session_id=$2 AND h.occurred_at IS NOT NULL
        AND h.message_key NOT LIKE 'stored:%'
        AND (r.oldest_key IS NULL OR r.oldest_key<>h.message_key)
      ORDER BY h.occurred_at ASC
      LIMIT 1
    `, [companyId, sessionId])).rows[0];

    // Fallback: If no candidate in whatsapp_history_items, check messages table
    if (!row) {
      row = (await client.query(`
        SELECT m.whatsapp_message_id AS message_key,
               COALESCE(m.remote_jid, m.phone) AS chat_jid,
               m.from_me,
               m.created_at AS occurred_at
        FROM messages m
        LEFT JOIN whatsapp_history_requests r
          ON r.company_id = m.company_id AND r.session_id = m.session_id AND r.chat_jid = COALESCE(m.remote_jid, m.phone)
        WHERE m.company_id = $1 AND m.session_id = $2
          AND m.whatsapp_message_id IS NOT NULL
          AND m.whatsapp_message_id NOT LIKE 'stored:%'
          AND (r.oldest_key IS NULL OR r.oldest_key <> m.whatsapp_message_id)
        ORDER BY m.created_at ASC
        LIMIT 1
      `, [companyId, sessionId])).rows[0];
    }

    if (!row) return;
    await client.query(`INSERT INTO whatsapp_history_requests(company_id,session_id,chat_jid,oldest_key) VALUES($1,$2,$3,$4)
      ON CONFLICT(company_id,session_id,chat_jid) DO UPDATE SET oldest_key=EXCLUDED.oldest_key,requested_at=NOW(),status='waiting'`, [companyId, sessionId, row.chat_jid, row.message_key]);
    await client.query(`UPDATE whatsapp_history_sync SET last_request_at=NOW() WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId]);
    try {
      await session.sock.fetchMessageHistory(50, { remoteJid: row.chat_jid, id: row.message_key, fromMe: Boolean(row.from_me) }, Math.floor(new Date(row.occurred_at).getTime() / 1000));
    } catch (_) {
      await client.query(`UPDATE whatsapp_history_requests SET status='unavailable' WHERE company_id=$1 AND session_id=$2 AND chat_jid=$3`, [companyId, sessionId, row.chat_jid]);
    }
  }

  async requestOlderForChat(companyId, sessionId, chatJid) {
    const session = activeSessions[sessionId];
    if (session?.status !== 'connected' || !session.sock?.fetchMessageHistory) {
      return { success: false, reason: 'Sessão WhatsApp desconectada ou indisponível.' };
    }
    const client = this.repository.pool;

    let row = (await client.query(`
      SELECT chat_jid, message_key, from_me, occurred_at
      FROM whatsapp_history_items
      WHERE company_id = $1 AND session_id = $2 AND chat_jid = $3
        AND message_key NOT LIKE 'stored:%'
        AND occurred_at IS NOT NULL
      ORDER BY occurred_at ASC
      LIMIT 1
    `, [companyId, sessionId, chatJid])).rows[0];

    if (!row) {
      const msgRow = (await client.query(`
        SELECT COALESCE(m.remote_jid, m.phone) AS chat_jid,
               m.whatsapp_message_id AS message_key,
               m.from_me,
               m.created_at AS occurred_at
        FROM messages m
        WHERE m.company_id = $1 AND m.session_id = $2
          AND (m.remote_jid = $3 OR m.phone = $3)
          AND m.whatsapp_message_id IS NOT NULL
          AND m.whatsapp_message_id NOT LIKE 'stored:%'
        ORDER BY m.created_at ASC
        LIMIT 1
      `, [companyId, sessionId, chatJid])).rows[0];
      if (msgRow) row = msgRow;
    }

    if (!row) {
      return { success: false, reason: 'Nenhuma mensagem WhatsApp com chave válida encontrada para buscar histórico anterior.' };
    }

    const timestampSec = Math.floor(new Date(row.occurred_at).getTime() / 1000);
    const key = { remoteJid: row.chat_jid, id: row.message_key, fromMe: Boolean(row.from_me) };

    await client.query(`
      INSERT INTO whatsapp_history_requests(company_id, session_id, chat_jid, oldest_key)
      VALUES($1, $2, $3, $4)
      ON CONFLICT(company_id, session_id, chat_jid)
      DO UPDATE SET oldest_key = EXCLUDED.oldest_key, requested_at = NOW(), status = 'waiting'
    `, [companyId, sessionId, row.chat_jid, row.message_key]);

    await client.query(`
      UPDATE whatsapp_history_sync SET last_request_at = NOW() WHERE company_id = $1 AND session_id = $2
    `, [companyId, sessionId]);

    try {
      await session.sock.fetchMessageHistory(50, key, timestampSec);
      return { success: true, chatJid: row.chat_jid, requestedKey: row.message_key };
    } catch (err) {
      await client.query(`
        UPDATE whatsapp_history_requests SET status = 'unavailable' WHERE company_id = $1 AND session_id = $2 AND chat_jid = $3
      `, [companyId, sessionId, row.chat_jid]);
      return { success: false, reason: err?.message || 'Falha ao buscar histórico no WhatsApp.' };
    }
  }

  async requestOlderBatch(companyId, sessionId, count = 10) {
    const session = activeSessions[sessionId];
    if (session?.status !== 'connected' || !session.sock?.fetchMessageHistory) return;
    const client = this.repository.pool;

    let rows = (await client.query(`
      SELECT DISTINCT ON (h.chat_jid) h.chat_jid, h.message_key, h.from_me, h.occurred_at
      FROM whatsapp_history_items h
      LEFT JOIN whatsapp_history_requests r
        ON r.company_id=h.company_id AND r.session_id=h.session_id AND r.chat_jid=h.chat_jid
      WHERE h.company_id=$1 AND h.session_id=$2 AND h.occurred_at IS NOT NULL
        AND h.message_key NOT LIKE 'stored:%'
        AND (r.oldest_key IS NULL OR r.oldest_key<>h.message_key)
      ORDER BY h.chat_jid, h.occurred_at ASC
      LIMIT $3
    `, [companyId, sessionId, count])).rows;

    // Fallback: If whatsapp_history_items has fewer than count candidates, also search messages table
    if (rows.length < count) {
      const remaining = count - rows.length;
      const existingJids = rows.map(r => r.chat_jid);
      const fallbackRows = (await client.query(`
        SELECT DISTINCT ON (COALESCE(m.remote_jid, m.phone))
               COALESCE(m.remote_jid, m.phone) AS chat_jid,
               m.whatsapp_message_id AS message_key,
               m.from_me,
               m.created_at AS occurred_at
        FROM messages m
        LEFT JOIN whatsapp_history_requests r
          ON r.company_id = m.company_id AND r.session_id = m.session_id AND r.chat_jid = COALESCE(m.remote_jid, m.phone)
        WHERE m.company_id = $1 AND m.session_id = $2
          AND m.whatsapp_message_id IS NOT NULL
          AND m.whatsapp_message_id NOT LIKE 'stored:%'
          ${existingJids.length ? `AND COALESCE(m.remote_jid, m.phone) NOT IN (${existingJids.map((_, i) => `$${i + 4}`).join(',')})` : ''}
          AND (r.oldest_key IS NULL OR r.oldest_key <> m.whatsapp_message_id)
        ORDER BY COALESCE(m.remote_jid, m.phone), m.created_at ASC
        LIMIT $3
      `, [companyId, sessionId, remaining, ...existingJids])).rows;
      rows = rows.concat(fallbackRows);
    }

    for (const row of rows) {
      try {
        await client.query(`
          INSERT INTO whatsapp_history_requests(company_id, session_id, chat_jid, oldest_key)
          VALUES($1, $2, $3, $4)
          ON CONFLICT(company_id, session_id, chat_jid)
          DO UPDATE SET oldest_key=EXCLUDED.oldest_key, requested_at=NOW(), status='waiting'
        `, [companyId, sessionId, row.chat_jid, row.message_key]);
        await session.sock.fetchMessageHistory(50, { remoteJid: row.chat_jid, id: row.message_key, fromMe: Boolean(row.from_me) }, Math.floor(new Date(row.occurred_at).getTime() / 1000));
      } catch (_) {}
    }
  }

  async tick() {
    const db = this.repository.pool;
    const sessions = (await db.query(`SELECT h.company_id,h.session_id FROM whatsapp_history_sync h JOIN sessions s ON s.session_id=h.session_id AND s.company_id=h.company_id`)).rows;
    for (const session of sessions) {
      const { company_id: companyId, session_id: sessionId } = session;
      const client = await db.connect();
      const lock = JSON.stringify(['history', companyId, sessionId]);
      let acquired = false;
      try {
        const result = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', [lock]);
        acquired = Boolean(result.rows[0].acquired);
        if (!acquired) continue;
        await this.process(companyId, sessionId);
        // Older-history requests are expensive and only useful after the received
        // backlog has reached the Inbox. Keep the import worker moving first.
        if (!(await this.repository.pending(companyId, sessionId)).length) {
          await this.requestOlder(companyId, sessionId);
        }
        await db.query(`UPDATE whatsapp_history_sync SET last_error=NULL WHERE company_id=$1 AND session_id=$2 AND last_error IS NOT NULL`, [companyId, sessionId]);
      } catch (error) {
        const detail = String(error?.message || error || 'Erro desconhecido').slice(0, 500);
        console.error(`[HistorySync] tick failed session=${sessionId}: ${detail}`);
        await db.query(`UPDATE whatsapp_history_sync SET last_error=$3 WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId, `Processamento interrompido: ${detail}`]);
      } finally {
        try { if (acquired) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lock]); }
        finally { client.release(); }
      }
    }
  }
}
const historySync = new HistorySync();
module.exports = { historySync, HistorySync, encodeItems, individual, isSyncableJid };
