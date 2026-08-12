const fs = require('fs/promises');
const path = require('path');
const { query } = require('../src/infrastructure/config/database');

const logsFilePath = path.join(__dirname, '..', 'data', 'ai_logs.json');

async function ensureLogsFile() {
  try {
    await fs.access(logsFilePath);
  } catch {
    await fs.mkdir(path.dirname(logsFilePath), { recursive: true }).catch(() => {});
    await fs.writeFile(logsFilePath, '[]', 'utf8');
  }
}

async function saveLogEntry(entry, store) {
  const logEntry = {
    id: entry.id || Date.now() + Math.random().toString(36).substr(2, 5),
    timestamp: entry.timestamp || new Date().toISOString(),
    conversationId: entry.conversationId || '',
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
  if (store?.databaseEnabled !== false) {
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

async function getLogs(store, sessionId) {
  // If DB is enabled, load from DB
  if (store?.databaseEnabled !== false) {
    try {
      let q = `SELECT id, timestamp, conversation_id as "conversationId", contact_name as "contactName",
                message_sent as "messageSent", message_received as "messageReceived",
                provider, model, prompt_tokens as "promptTokens", completion_tokens as "completionTokens",
                total_tokens as "totalTokens"
         FROM ai_logs`;
      const params = [];
      if (sessionId && sessionId !== 'all') {
        q += ` WHERE session_id = $1`;
        params.push(sessionId);
      }
      q += ` ORDER BY timestamp DESC LIMIT 100`;

      const res = await query(q, params);
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
    let logs = Array.isArray(parsed) ? parsed : [];
    if (sessionId && sessionId !== 'all') {
      logs = logs.filter(log => log.sessionId === sessionId);
    }
    return logs.slice(0, 100);
  } catch {
    let logs = store?.aiLogs || [];
    if (sessionId && sessionId !== 'all') {
      logs = logs.filter(log => log.sessionId === sessionId);
    }
    return logs;
  }
}

async function getMetrics(store, sessionId) {
  let tokensToday = 0;
  let promptTokensToday = 0;
  let completionTokensToday = 0;
  let messagesToday = 0;
  let tokensPerConversation = {};

  if (store?.databaseEnabled !== false) {
    try {
      // 1. Get tokens consumed today
      let todayQuery = `SELECT COALESCE(SUM(total_tokens), 0) as total,
                COALESCE(SUM(prompt_tokens), 0) as prompt,
                COALESCE(SUM(completion_tokens), 0) as completion,
                COUNT(*) as count
         FROM ai_logs
         WHERE timestamp >= CURRENT_DATE`;
      const todayParams = [];
      if (sessionId && sessionId !== 'all') {
        todayQuery += ` AND session_id = $1`;
        todayParams.push(sessionId);
      }

      const todayRes = await query(todayQuery, todayParams);
      if (todayRes.rows.length > 0) {
        const row = todayRes.rows[0];
        tokensToday = Number(row.total);
        promptTokensToday = Number(row.prompt);
        completionTokensToday = Number(row.completion);
        messagesToday = Number(row.count);
      }

      // 2. Get tokens per conversation (last 30 days)
      let convQuery = `SELECT conversation_id, COALESCE(SUM(total_tokens), 0) as total
         FROM ai_logs
         WHERE timestamp >= NOW() - INTERVAL '30 days'`;
      const convParams = [];
      if (sessionId && sessionId !== 'all') {
        convQuery += ` AND session_id = $1`;
        convParams.push(sessionId);
      }
      convQuery += ` GROUP BY conversation_id`;

      const convRes = await query(convQuery, convParams);
      convRes.rows.forEach((row) => {
        tokensPerConversation[row.conversation_id] = Number(row.total);
      });

      let memoryFacts = 0;
      try {
        const memRes = await query(`SELECT COUNT(*)::int as count FROM lead_memories`).catch(() => ({ rows: [{ count: 0 }] }));
        memoryFacts = Number(memRes.rows?.[0]?.count || 0);
      } catch {}

      const estimatedCostToday = (promptTokensToday / 1000000 * 0.15) + (completionTokensToday / 1000000 * 0.60);

      return {
        tokensToday,
        promptTokensToday,
        completionTokensToday,
        messagesToday,
        aiResponsesToday: messagesToday,
        estimatedCostToday,
        memoryFacts,
        avgLatencyMs: 420,
        socketLatencyMs: 26,
        model: "gpt-4o-mini",
        provider: "openai",
        tokensPerConversation,
      };
    } catch (err) {
      console.warn('[aiLogService] Failed to query database metrics, falling back to JSON:', err.message);
    }
  }

  // Fallback to reading JSON logs and scanning
  try {
    await ensureLogsFile();
    const content = await fs.readFile(logsFilePath, 'utf8');
    const logs = JSON.parse(content || '[]');
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
      if (log.conversationId) {
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
  };
}

module.exports = {
  saveLogEntry,
  getLogs,
  getMetrics,
};
