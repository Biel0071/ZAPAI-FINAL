const { HistoryRepository } = require('../../src/data/repositories/historyRepository');
const { HistoryLearning } = require('../../src/ai/evolutionary/historyLearning');
const { extractIncomingMessage, downloadMedia } = require('./inbound/pipeline');
const { unwrapMessageContent, getMediaDescriptor } = require('./inbound/parser');
const { pool } = require('../../src/infrastructure/config/database');
const ai = require('../ai.service');
const agents = require('../../src/ai/agents/services/aiAgentService');
const { activeSessions } = require('./state/registry');

function individual(jid) { return /@(s\.whatsapp\.net|lid)$/.test(String(jid)); }

function encodeItems(messages, chats, proto, origin = 'unknown') {
  const chatMap = new Map(chats.map(c => [c.id, c]));
  return messages.filter(m => m?.key?.id && individual(m.key.remoteJid) && m.message && !unwrapMessageContent(m.message).protocolMessage).map(m => {
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
    await this.repository.enqueueChats(companyId, sessionId, chats.filter(c => individual(c?.id)).map(c => ({ id: c.id, name: c.name || c.subject || null, archived: Boolean(c.archived || c.archive) })));
    await this.repository.enqueue(companyId, sessionId, encodeItems(messages, chats, proto, origin));
  }

  async decodeItem(item) {
    if (this.decode) return this.decode(item.raw_message);
    const { proto } = await import('@whiskeysockets/baileys');
    return proto.WebMessageInfo.decode(Buffer.from(item.raw_message, 'base64'));
  }

  async seedStoredMessages(companyId, sessionId) {
    const db = this.repository.pool;
    const rows = (await db.query(`SELECT m.*,l.name AS contact_name,
      COALESCE(m.remote_jid,CASE WHEN m.phone LIKE '%@%' THEN m.phone ELSE m.phone || '@s.whatsapp.net' END) AS jid
      FROM messages m LEFT JOIN conversations c ON c.id=m.conversation_id AND c.company_id=m.company_id AND c.session_id=m.session_id
      LEFT JOIN leads l ON l.id=c.lead_id AND l.company_id=m.company_id
      WHERE m.company_id=$1 AND m.session_id=$2 AND (m.remote_jid ~ '@(s\\.whatsapp\\.net|lid)$' OR (m.remote_jid IS NULL AND m.phone ~ '^[0-9]{7,20}(@(s\\.whatsapp\\.net|lid))?$'))
      AND NOT EXISTS(SELECT 1 FROM whatsapp_history_items h WHERE h.company_id=$1 AND h.session_id=$2
        AND (h.message_id=m.id OR (h.message_key=COALESCE(m.whatsapp_message_id,'stored:' || m.id::text)
          AND h.chat_jid=COALESCE(m.remote_jid,CASE WHEN m.phone LIKE '%@%' THEN m.phone ELSE m.phone || '@s.whatsapp.net' END))))
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
      await db.query(`INSERT INTO whatsapp_history_items(company_id,session_id,chat_jid,message_key,raw_message,from_me,occurred_at,chat_name,
        import_state,message_id,text,media_type,media_path,media_state,origin)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'done',$9,$10,$11,$12,$13,$14)
        ON CONFLICT(company_id,session_id,chat_jid,message_key) DO NOTHING`,
      [companyId, sessionId, row.jid, key, raw, Boolean(row.from_me), row.timestamp || row.created_at, row.contact_name,
        row.id, text, type, row.media_path || row.media_url, type === 'text' ? 'none' : 'pending', origin || 'unknown']);
    }
    return rows.length;
  }

  async process(companyId, sessionId) {
    await this.repository.importChats(companyId, sessionId);
    if (await this.seedStoredMessages(companyId, sessionId)) return;
    const config = (await this.repository.pool.query(`SELECT learning_enabled,last_received_at,created_at FROM whatsapp_history_sync WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId])).rows[0];
    const items = await this.repository.pending(companyId, sessionId);
    for (const item of items) {
      try {
        const payload = await this.extract(await this.decodeItem(item), { skipMediaDownload: true, companyId });
        if (!payload) throw new Error('Formato indisponível');
        await this.repository.persist(item, payload);
      } catch (error) { await this.repository.fail(item, false, `import_failed: ${String(error?.message || error).slice(0, 400)}`); }
    }
    // Prioritize importing text and preserving history before slow external media calls.
    if (items.length === 50 && (await this.repository.pending(companyId, sessionId)).length) return;
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
    const row = (await client.query(`SELECT h.* FROM whatsapp_history_items h
      LEFT JOIN whatsapp_history_requests r ON r.company_id=h.company_id AND r.session_id=h.session_id AND r.chat_jid=h.chat_jid
      JOIN whatsapp_history_sync s ON s.company_id=h.company_id AND s.session_id=h.session_id
      WHERE h.company_id=$1 AND h.session_id=$2 AND h.occurred_at IS NOT NULL
      AND h.message_key NOT LIKE 'stored:%'
      AND (s.last_request_at IS NULL OR s.last_request_at < NOW()-INTERVAL '60 seconds')
      AND (r.oldest_key IS NULL OR r.oldest_key<>h.message_key)
      AND NOT EXISTS(SELECT 1 FROM whatsapp_history_items earlier WHERE earlier.company_id=h.company_id AND earlier.session_id=h.session_id AND earlier.chat_jid=h.chat_jid
        AND earlier.message_key NOT LIKE 'stored:%' AND (earlier.occurred_at,earlier.id)<(h.occurred_at,h.id))
      ORDER BY h.occurred_at LIMIT 1`, [companyId, sessionId])).rows[0];
    if (!row) return;
    await client.query(`INSERT INTO whatsapp_history_requests(company_id,session_id,chat_jid,oldest_key) VALUES($1,$2,$3,$4)
      ON CONFLICT(company_id,session_id,chat_jid) DO UPDATE SET oldest_key=EXCLUDED.oldest_key,requested_at=NOW(),status='waiting'`, [companyId, sessionId, row.chat_jid, row.message_key]);
    await client.query(`UPDATE whatsapp_history_sync SET last_request_at=NOW() WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId]);
    try {
      await session.sock.fetchMessageHistory(100, { remoteJid: row.chat_jid, id: row.message_key, fromMe: row.from_me }, Math.floor(new Date(row.occurred_at).getTime() / 1000));
    } catch (_) {
      await client.query(`UPDATE whatsapp_history_requests SET status='unavailable' WHERE company_id=$1 AND session_id=$2 AND chat_jid=$3`, [companyId, sessionId, row.chat_jid]);
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
module.exports = { historySync, HistorySync, encodeItems, individual };
