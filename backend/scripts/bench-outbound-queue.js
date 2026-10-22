/* Load benchmark of the REAL outboundQueueService (only I/O edges are stubbed).
 * Usage: node backend/scripts/bench-outbound-queue.js [terminalBacklog=5000] [burst=500]
 */
const path = require('path');
const stub = (rel, exports) => { const id = require.resolve(path.join(__dirname, rel)); require.cache[id] = { id, filename: id, loaded: true, exports }; };

let bytesWritten = 0; let writes = 0; let persisted = { items: [], version: 1 };
const fsStub = { mkdir: async () => {}, access: async () => {}, readFile: async () => JSON.stringify(persisted), writeFile: async (_p, text) => { bytesWritten += text.length; writes++; await new Promise(r => setImmediate(r)); }, rename: async () => {} };
require.cache[require.resolve('fs/promises')] = { id: 'fs/promises', filename: 'fs/promises', loaded: true, exports: fsStub };
stub('../src/data/store/messageStore', { addMessage: () => ({ id: 'm' }) });
let sent = 0;
stub('../services/sessionManager', { DEFAULT_SESSION: 'main', normalizeSessionName: v => v, isRuntimeActive: () => true, getSession: () => ({ sessionId: 's', companyId: 't', status: 'connected', sock: {} }) });
stub('../services/whatsappService', { normalizePhone: v => String(v).split('@')[0], sendMessage: async () => { sent++; return { key: { id: 'wa' + sent, remoteJid: 'x@s.whatsapp.net' } }; } });
stub('../src/api/controllers/messagesController', { registerOutgoingMessage: async () => ({ message: { id: 'm' } }) });
stub('../services/aiReplyGuard', { getAutomatedReplyPermission: async () => ({ allowed: true }) });
stub('../services/correlationTracker', { generateMessageTraceId: () => Math.random().toString(), traceLog() {} });
stub('../services/messageAckPipeline', { ACK_STATES: { PENDING: 'pending' }, transitionAck() {}, registerDbMapping() {}, getAckState: () => null, emitAckUpdate() {} });
stub('../src/infrastructure/config/database', { query: async () => ({ rows: [{ session_id: 's' }] }) });
stub('../services/enterprise/media-service', { normalizeMediaReference: v => v, canAccessMedia: async () => true, findMediaFile: async () => '/f' });

const backlog = Number(process.argv[2] || 5000);
const burst = Number(process.argv[3] || 500);

(async () => {
  const old = new Date(Date.now() - 3600e3).toISOString();
  persisted.items = Array.from({ length: backlog }, (_, i) => ({
    id: `oq_old_${i}`, companyId: 't', sessionId: 's', phone: `55119${String(i).padStart(8, '0')}`, text: 'x'.repeat(120),
    state: i % 10 === 0 ? 'dead_letter' : i % 7 === 0 ? 'cancelled' : 'sent', correlationId: `old-${i}`,
    createdAt: old, updatedAt: old, sentAt: old, nextAttemptAt: null, metadata: { conversationId: `c${i % 300}` }, failureHistory: [],
  }));
  const queue = require('../services/outboundQueueService');
  await queue.initializeOutboundQueue({ store: { databaseEnabled: false } });
  await queue.shutdownOutboundQueue();
  bytesWritten = 0; writes = 0;

  // event loop lag monitor
  let maxLag = 0; let last = process.hrtime.bigint();
  const mon = setInterval(() => { const now = process.hrtime.bigint(); const lag = Number(now - last) / 1e6 - 5; if (lag > maxLag) maxLag = lag; last = now; }, 5);

  const future = new Date(Date.now() + 3600e3).toISOString(); // not processed: isolates enqueue + persistence cost
  const t0 = process.hrtime.bigint();
  await Promise.all(Array.from({ length: burst }, (_, i) => queue.enqueue({
    phone: `5511888${String(i).padStart(6, '0')}`, text: `msg ${i}`, companyId: 't', sessionId: 's', correlationId: `new-${i}`,
    nextAttemptAt: future, metadata: { conversationId: `n${i}`, source: 'human', isManual: true },
  })));
  const enqueueMs = Number(process.hrtime.bigint() - t0) / 1e6;

  const tickRuns = 200; const t1 = process.hrtime.bigint();
  for (let i = 0; i < tickRuns; i++) await queue.processOneItem(); // nothing due: measures pickNext cost per tick
  const tickMs = Number(process.hrtime.bigint() - t1) / 1e6 / tickRuns;
  clearInterval(mon);

  console.log(JSON.stringify({
    backlog, burst, enqueueTotalMs: +enqueueMs.toFixed(1), enqueuePerSecond: Math.round(burst / (enqueueMs / 1000)),
    idleTickMsAvg: +tickMs.toFixed(3), maxEventLoopLagMs: +maxLag.toFixed(1), diskWrites: writes, mbWritten: +(bytesWritten / 1e6).toFixed(2),
    queueItemsAfter: JSON.parse((await (async () => { return JSON.stringify({ n: queue.listPending(100000).length + queue.listDeadLetter(500).length }); })())).n,
  }, null, 1));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
