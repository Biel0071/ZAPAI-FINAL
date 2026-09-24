const db = require('../src/infrastructure/config/database');
const memoryService = require('./aiConversationMemoryService');

function requireScope(companyId, sessionId) {
  if (typeof companyId !== 'string' || !companyId.trim() || typeof sessionId !== 'string' || !sessionId.trim()) throw new Error('Empresa e conexão são obrigatórias para memória.');
}
async function assertSession(companyId, sessionId, client = db) {
  requireScope(companyId, sessionId);
  const row = (await client.query('SELECT session_id FROM sessions WHERE company_id=$1 AND session_id=$2', [companyId,sessionId])).rows[0];
  if (!row) throw new Error('Conexão não encontrada.');
}
async function loadEntry(companyId, sessionId, contactId, client = db) {
  requireScope(companyId, sessionId);
  return (await client.query('SELECT * FROM ai_conversation_memory WHERE company_id=$1 AND session_id=$2 AND contact_id=$3', [companyId,sessionId,String(contactId)])).rows[0] || null;
}
async function persistMemoryEntry(entry, companyId = entry?.company_id, client = db) {
  requireScope(companyId,entry?.session_id);
  await client.query(`INSERT INTO ai_conversation_memory
    (company_id,session_id,contact_id,phone,name,intent,sentiment,tags,summary,metrics,messages,last_updated)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)
    ON CONFLICT(company_id,session_id,contact_id) DO UPDATE SET phone=EXCLUDED.phone,name=EXCLUDED.name,
    intent=EXCLUDED.intent,sentiment=EXCLUDED.sentiment,tags=EXCLUDED.tags,summary=EXCLUDED.summary,
    metrics=EXCLUDED.metrics,messages=EXCLUDED.messages,last_updated=EXCLUDED.last_updated,updated_at=NOW()`,
    [companyId,entry.session_id,entry.contact_id,entry.phone,entry.name,entry.intent,entry.sentiment,entry.tags,
      entry.summary,JSON.stringify(entry.metrics),JSON.stringify(entry.messages),entry.last_updated]);
  return true;
}
// The message table is the durable queue. Receipt + projection + acknowledgement commit together.
async function projectPending(companyId, sessionId, limit = 100, contactPhone = null) {
  if (companyId || sessionId) requireScope(companyId,sessionId);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (companyId) await assertSession(companyId,sessionId,client);
    const messages = (await client.query(`SELECT m.* FROM messages m
      JOIN sessions s ON s.company_id=m.company_id AND s.session_id=m.session_id
      WHERE m.memory_projected=FALSE AND ($1::text IS NULL OR m.company_id=$1)
      AND ($2::text IS NULL OR m.session_id=$2) AND ($4::text IS NULL OR m.phone=$4 OR m.remote_jid=$4) ORDER BY m.timestamp ASC,m.id ASC LIMIT $3 FOR UPDATE OF m SKIP LOCKED`, [companyId || null,sessionId || null,limit,contactPhone])).rows;
    messages.sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp) || Number(a.id)-Number(b.id));
    for (const m of messages) {
      const contactId = String(m.remote_jid || m.phone || '').trim();
      if (contactId) {
        const scope = [m.company_id,m.session_id];
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[JSON.stringify([...scope,contactId])]);
        const receipt = await client.query(`INSERT INTO ai_memory_receipts(company_id,session_id,event_key) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_key`, [...scope,String(m.whatsapp_message_id || m.id)]);
        if (receipt.rows.length) {
          const previous = await loadEntry(...scope,contactId,client);
          const state = { conversationMemory: previous ? [previous] : [] };
          const text = String(m.content || m.text || '').split('\n[META]')[0];
          const { memory } = memoryService.updateConversationMemory(state,{ companyId:m.company_id,sessionId:m.session_id,
            contactId,phone:m.phone,conversationId:m.conversation_id,messageId:String(m.whatsapp_message_id || m.id),
            direction:m.from_me ? 'outgoing':'incoming',text,mediaType:m.media_type,timestamp:new Date(m.timestamp || m.created_at).toISOString() });
          const engine = require('./conversationMemoryEngine');
          const structured = { facts:memory.metrics.facts || {},commercial:memory.metrics.commercial || {} };
          if (!m.from_me && (!memory.metrics.lastFactAt || new Date(m.timestamp)>=new Date(memory.metrics.lastFactAt))) {
            engine.extractFactsFromContext(text,{},structured);memory.metrics.lastFactAt=m.timestamp;
          }
          memory.metrics = {...memory.metrics,facts:structured.facts,commercial:structured.commercial};
          await persistMemoryEntry(memory,m.company_id,client);
        }
      }
      await client.query('UPDATE messages SET memory_projected=TRUE WHERE id=$1 AND company_id=$2 AND session_id=$3',[m.id,m.company_id,m.session_id]);
      await client.query(`INSERT INTO session_ai_profiles(company_id,session_id,last_processed_at) VALUES($1,$2,NOW())
        ON CONFLICT(company_id,session_id) DO UPDATE SET last_processed_at=NOW(),last_error=NULL`,[m.company_id,m.session_id]);
    }
    await client.query('COMMIT');
    return messages.length;
  } catch(error) {
    await client.query('ROLLBACK');
    if (companyId && sessionId) await db.query(`INSERT INTO session_ai_profiles(company_id,session_id,last_error) VALUES($1,$2,'Falha ao persistir memória; processamento pendente.') ON CONFLICT(company_id,session_id) DO UPDATE SET last_error=EXCLUDED.last_error`,[companyId,sessionId]).catch(()=>{});
    throw error;
  } finally { client.release(); }
}
async function flushPending() {
  const sessions=(await db.query(`SELECT s.company_id,s.session_id FROM sessions s
    LEFT JOIN session_ai_profiles p ON p.company_id=s.company_id AND p.session_id=s.session_id
    WHERE EXISTS(SELECT 1 FROM messages m WHERE m.company_id=s.company_id AND m.session_id=s.session_id AND NOT m.memory_projected)
    ORDER BY p.last_processed_at NULLS FIRST LIMIT 25`)).rows;
  let total=0, failed=false;
  for(const s of sessions) {
    try{total+=await projectPending(s.company_id,s.session_id);}catch(_){failed=true;}
  }
  if(failed) throw new Error('Uma ou mais conexões têm memória pendente; nova tentativa automática.');
  return total;
}
async function searchPersisted(companyId,sessionId,q='') {
  await assertSession(companyId,sessionId);
  return (await db.query(`SELECT * FROM ai_conversation_memory WHERE company_id=$1 AND session_id=$2
    AND (name ILIKE $3 OR phone ILIKE $3 OR summary ILIKE $3) ORDER BY last_updated DESC LIMIT 100`,[companyId,sessionId,'%'+String(q).slice(0,200)+'%'])).rows;
}
async function status(companyId,sessionId) {
  await assertSession(companyId,sessionId);
  const result = (await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE NOT memory_projected)::int AS pending FROM messages WHERE company_id=$1 AND session_id=$2`,[companyId,sessionId])).rows[0];
  const profile = (await db.query('SELECT * FROM session_ai_profiles WHERE company_id=$1 AND session_id=$2',[companyId,sessionId])).rows[0];
  return {...result,...profile,persistence:result.pending ? 'pending':'saved'};
}
async function loadMemoryFromPostgres(store,companyId,sessionId) {
  if (!companyId || !sessionId) return 0;
  const rows=await searchPersisted(companyId,sessionId);
  store.conversationMemory=rows;
  return rows.length;
}
// Schema changes are exclusively managed by migration 035.
async function ensureMemoryTable() { await db.query('SELECT session_id FROM ai_conversation_memory LIMIT 0'); }
function searchMemory(store,q='',scope={}) {
  return (store?.conversationMemory || []).filter(e=>scope.companyId && scope.sessionId && e.company_id===scope.companyId && e.session_id===scope.sessionId && JSON.stringify(e).toLowerCase().includes(String(q).toLowerCase()));
}
function getMemoryAnalytics(store) {
  const entries = Array.isArray(store?.conversationMemory) ? store.conversationMemory : [];

  const sentiments = { positive: 0, negative: 0, neutral: 0 };
  const intents = {};
  const tagCounts = {};
  let totalMessages = 0;
  let totalAudioRequests = 0;

  for (const entry of entries) {
    sentiments[entry.sentiment || 'neutral'] = (sentiments[entry.sentiment || 'neutral'] || 0) + 1;
    intents[entry.intent || 'information'] = (intents[entry.intent || 'information'] || 0) + 1;
    totalMessages += entry.metrics?.totalMessages || 0;
    totalAudioRequests += entry.metrics?.audioRequests || 0;

    for (const tag of entry.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return {
    totalContacts: entries.length,
    totalMessages,
    totalAudioRequests,
    sentiments,
    intents,
    topTags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count })),
  };
}


module.exports={requireScope,assertSession,loadEntry,persistMemoryEntry,projectPending,searchPersisted,status,
 ensureMemoryTable,loadMemoryFromPostgres,searchMemory,getMemoryAnalytics,
 flushMemoryToPostgres:flushPending,forceFlushMemoryToPostgres:flushPending,
 ...memoryService};
