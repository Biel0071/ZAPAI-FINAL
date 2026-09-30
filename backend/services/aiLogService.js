const fs = require('fs/promises');
const path = require('path');
const { query } = require('../src/infrastructure/config/database');

const logsFilePath = path.join(__dirname, '..', '..', 'data', 'json_db', 'ai_logs.json');

function requireCompany(companyId) {
  const company = String(companyId || '').trim();
  if (!company) throw Object.assign(new Error('Verified company is required for AI logs.'), { status: 401 });
  return company;
}

function scopedLogs(logs, companyId, sessionId) {
  return (Array.isArray(logs) ? logs : []).filter(log =>
    String(log.companyId || '') === companyId &&
    (!sessionId || sessionId === 'all' || String(log.sessionId || '') === String(sessionId))
  );
}

function logScope(companyId, sessionId) {
  const params = [companyId];
  let sql = 'FROM ai_logs a JOIN conversations c ON c.id::text = a.conversation_id AND c.session_id = a.session_id WHERE c.company_id = $1';
  if (sessionId && sessionId !== 'all') { sql += ' AND a.session_id = $2'; params.push(sessionId); }
  return { sql, params };
}

async function ensureLogsFile() {
  try {
    await fs.access(logsFilePath);
  } catch {
    await fs.mkdir(path.dirname(logsFilePath), { recursive: true }).catch(() => {});
    await fs.writeFile(logsFilePath, '[]', 'utf8');
  }
}

async function saveLogEntry(entry, store) {
  const companyId = requireCompany(entry.companyId);
  let canonicalConversation = null;
  if (store?.databaseEnabled !== false && entry.sessionId) {
    try {
      canonicalConversation = (await query(`
        SELECT c.id, c.session_id FROM conversations c
        LEFT JOIN leads l ON l.id = c.lead_id AND l.company_id = c.company_id
        WHERE c.company_id = $1 AND c.session_id = $3
          AND (c.id::text = $2 OR l.phone = $2 OR c.remote_jid = $2)
        ORDER BY c.updated_at DESC LIMIT 1
      `, [companyId, String(entry.conversationId || ''), entry.sessionId])).rows[0] || null;
    } catch (error) {
      console.warn('[aiLogService] Conversation ownership could not be confirmed:', error.message);
    }
  }
  const logEntry = {
    id: entry.id || Date.now() + Math.random().toString(36).substr(2, 5),
    companyId,
    timestamp: entry.timestamp || new Date().toISOString(),
    conversationId: canonicalConversation ? String(canonicalConversation.id) : String(entry.conversationId || ''),
    contactName: entry.contactName || '',
    messageSent: entry.messageSent || '',
    messageReceived: entry.messageReceived || '',
    provider: entry.provider || 'openai',
    model: entry.model || '',
    promptTokens: Number(entry.promptTokens) || 0,
    completionTokens: Number(entry.completionTokens) || 0,
    totalTokens: Number(entry.totalTokens) || 0,
    sessionId: entry.sessionId || null,
  };

  // 1. Save to in-memory store
  if (store) {
    if (!Array.isArray(store.aiLogs)) {
      store.aiLogs = [];
    }
    store.aiLogs.unshift(logEntry);
    if (store.aiLogs.length > 200) {
      store.aiLogs = store.aiLogs.slice(0, 200);
    }
  }

  // 2. Save to data/ai_logs.json
  try {
    await ensureLogsFile();
    let currentLogs = [];
    try {
      const content = await fs.readFile(logsFilePath, 'utf8');
      currentLogs = JSON.parse(content || '[]');
    } catch {
      currentLogs = [];
    }
    currentLogs.unshift(logEntry);
    // Keep last 500 logs in JSON
    if (currentLogs.length > 500) {
      currentLogs = currentLogs.slice(0, 500);
    }
    await fs.writeFile(logsFilePath, JSON.stringify(currentLogs, null, 2), 'utf8');
  } catch (err) {
    console.error('[aiLogService] Failed to save to JSON file:', err.message);
  }

  // 3. Save to database if enabled
  // Schema has no company column: only canonical conversation ids are persisted
  // to SQL. Unowned historical phone-only records are excluded by the read JOIN.
  if (canonicalConversation) {
    try {
      await query(
        `INSERT INTO ai_logs (conversation_id, contact_name, message_sent, message_received, provider, model, prompt_tokens, completion_tokens, total_tokens, timestamp, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          logEntry.conversationId,
          logEntry.contactName,
          logEntry.messageSent,
          logEntry.messageReceived,
          logEntry.provider,
          logEntry.model,
          logEntry.promptTokens,
          logEntry.completionTokens,
          logEntry.totalTokens,
          logEntry.timestamp,
          logEntry.sessionId,
        ]
      );
    } catch (err) {
      console.warn('[aiLogService] Failed to insert into Postgres ai_logs:', err.message);
    }
  }
}

async function getLogs(store, sessionId, verifiedCompanyId) {
  const companyId = requireCompany(verifiedCompanyId);
  // If DB is enabled, load from DB
  if (store?.databaseEnabled !== false) {
    try {
      const scope = logScope(companyId, sessionId);
      const res = await query(`SELECT a.id, a.timestamp, a.conversation_id AS "conversationId", a.contact_name AS "contactName",
        a.message_sent AS "messageSent", a.message_received AS "messageReceived", a.provider, a.model,
        a.prompt_tokens AS "promptTokens", a.completion_tokens AS "completionTokens", a.total_tokens AS "totalTokens"
        ${scope.sql} ORDER BY a.timestamp DESC LIMIT 100`, scope.params);
      return res.rows;
    } catch (err) {
      console.warn('[aiLogService] Failed to query database logs, falling back to JSON:', err.message);
    }
  }

  // Fallback to JSON
  try {
    await ensureLogsFile();
    const content = await fs.readFile(logsFilePath, 'utf8');
    const parsed = JSON.parse(content || '[]');
    let logs = scopedLogs(parsed, companyId, sessionId);
    if (sessionId && sessionId !== 'all') {
      logs = logs.filter(log => log.sessionId === sessionId);
    }
    return logs.slice(0, 100);
  } catch {
    let logs = scopedLogs(store?.aiLogs, companyId, sessionId);
    if (sessionId && sessionId !== 'all') {
      logs = logs.filter(log => log.sessionId === sessionId);
    }
    return logs;
  }
}

async function getMetrics(store, sessionId, verifiedCompanyId) {
  const companyId = requireCompany(verifiedCompanyId);
  let tokensToday = 0;
  let promptTokensToday = 0;
  let completionTokensToday = 0;
  let messagesToday = 0;
  let tokensPerConversation = {};

  if (store?.databaseEnabled !== false) {
    try {
      // 1. Get tokens consumed today
      const scope = logScope(companyId, sessionId);
      const todayRes = await query(`SELECT COALESCE(SUM(a.total_tokens), 0) AS total,
        COALESCE(SUM(a.prompt_tokens), 0) AS prompt, COALESCE(SUM(a.completion_tokens), 0) AS completion,
        COUNT(*) AS count ${scope.sql} AND a.timestamp >= CURRENT_DATE`, scope.params);
      if (todayRes.rows.length > 0) {
        const row = todayRes.rows[0];
        tokensToday = Number(row.total);
        promptTokensToday = Number(row.prompt);
        completionTokensToday = Number(row.completion);
        messagesToday = Number(row.count);
      }

      // 2. Get tokens per conversation (last 30 days)
      const convRes = await query(`SELECT a.conversation_id, COALESCE(SUM(a.total_tokens), 0) AS total
        ${scope.sql} AND a.timestamp >= NOW() - INTERVAL '30 days' GROUP BY a.conversation_id`, scope.params);
      convRes.rows.forEach((row) => {
        tokensPerConversation[row.conversation_id] = Number(row.total);
      });

      return {
        tokensToday,
        promptTokensToday,
        completionTokensToday,
        messagesToday,
        aiResponsesToday: messagesToday,
        estimatedCostToday: null,
        memoryFacts: null,
        avgLatencyMs: null,
        socketLatencyMs: null,
        model: null,
        provider: null,
        tokensPerConversation,
      };
    } catch (err) {
      console.warn('[aiLogService] Failed to query database metrics, falling back to JSON:', err.message);
      tokensToday = 0;
      promptTokensToday = 0;
      completionTokensToday = 0;
      messagesToday = 0;
      tokensPerConversation = {};
    }
  }

  // Fallback to reading JSON logs and scanning
  try {
    await ensureLogsFile();
    const content = await fs.readFile(logsFilePath, 'utf8');
    const logs = scopedLogs(JSON.parse(content || '[]'), companyId, sessionId);
    const todayStr = new Date().toISOString().split('T')[0];

    logs.forEach((log) => {
      if (sessionId && sessionId !== 'all' && log.sessionId !== sessionId) {
        return;
      }
      const logDate = String(log.timestamp || '').split('T')[0];
      if (logDate === todayStr) {
        tokensToday += Number(log.totalTokens) || 0;
        promptTokensToday += Number(log.promptTokens) || 0;
        completionTokensToday += Number(log.completionTokens) || 0;
        messagesToday += 1;
      }
      if (log.conversationId && new Date(log.timestamp).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000) {
        tokensPerConversation[log.conversationId] = (tokensPerConversation[log.conversationId] || 0) + (Number(log.totalTokens) || 0);
      }
    });
  } catch (err) {
    console.error('[aiLogService] Fallback metrics computation failed:', err.message);
  }

  return {
    tokensToday,
    promptTokensToday,
    completionTokensToday,
    messagesToday,
    tokensPerConversation,
    aiResponsesToday: messagesToday,
    estimatedCostToday: null,
    memoryFacts: null,
    avgLatencyMs: null,
    socketLatencyMs: null,
    model: null,
    provider: null,
  };
}

module.exports = {
  saveLogEntry,
  getLogs,
  getMetrics,
};
