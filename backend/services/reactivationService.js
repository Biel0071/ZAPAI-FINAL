const { query } = require('../src/infrastructure/config/database');
const { isBusinessOpen, businessHours } = require('../src/infrastructure/config/businessHours');
const outboundQueueService = require('./outboundQueueService');

// In-memory fallback queue if database is temporarily unavailable
const inMemoryReactivationQueue = new Map();

let tableInitialized = false;
async function initReactivationTable() {
  if (tableInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS business_hours_reactivation_queue (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(50) NOT NULL,
        company_id VARCHAR(100) DEFAULT 'default',
        session_id VARCHAR(100) DEFAULT 'default',
        last_message TEXT,
        status VARCHAR(30) DEFAULT 'pending_opening',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_bh_reactivation_status ON business_hours_reactivation_queue(status, company_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bh_reactivation_pending_phone ON business_hours_reactivation_queue(phone, company_id) WHERE status = 'pending_opening';
    `);
    tableInitialized = true;
  } catch (err) {
    console.warn('[REACTIVATION_SERVICE] Table init warning:', err.message);
  }
}

// Initialize table on module load
initReactivationTable().catch(() => {});

/**
 * Enqueues a contact who messaged outside business hours with strict deduplication
 */
async function enqueueOutofHoursContact({ phone, text, companyId = 'default', sessionId = 'default' }) {
  if (!phone) return;
  const normalizedPhone = String(phone).replace(/\D/g, '');

  console.log(`[REACTIVATION_SERVICE] Enqueueing out-of-hours contact ${normalizedPhone}`);

  if (!tableInitialized) {
    await initReactivationTable().catch(() => {});
  }

  try {
    // 1. Try to update existing pending row for this contact (upsert semantics)
    const updateResult = await query(
      `UPDATE business_hours_reactivation_queue
       SET last_message = $1, session_id = $2, updated_at = NOW()
       WHERE phone = $3 AND company_id = $4 AND status = 'pending_opening'
       RETURNING id`,
      [text || '', sessionId, normalizedPhone, companyId]
    ).catch(() => null);

    if (!updateResult?.rowCount || updateResult.rowCount === 0) {
      // 2. Insert new row only if none is pending
      await query(
        `INSERT INTO business_hours_reactivation_queue (phone, company_id, session_id, last_message, status, updated_at)
         VALUES ($1, $2, $3, $4, 'pending_opening', NOW())
         ON CONFLICT (phone, company_id) WHERE status = 'pending_opening' DO UPDATE
         SET last_message = EXCLUDED.last_message, session_id = EXCLUDED.session_id, updated_at = NOW()`,
        [normalizedPhone, companyId, sessionId, text || '']
      ).catch(async () => {
        // Fallback for schemas where unique partial index is not yet applied
        await query(
          `INSERT INTO business_hours_reactivation_queue (phone, company_id, session_id, last_message, status, updated_at)
           SELECT $1::varchar, $2::varchar, $3::varchar, $4::text, 'pending_opening', NOW()
           WHERE NOT EXISTS (
             SELECT 1 FROM business_hours_reactivation_queue
             WHERE phone = $1 AND company_id = $2 AND status = 'pending_opening'
           )`,
          [normalizedPhone, companyId, sessionId, text || '']
        ).catch(() => {});
      });
    }

    // Keep memory fallback in sync (Map naturally deduplicates by phone)
    inMemoryReactivationQueue.set(normalizedPhone, {
      phone: normalizedPhone,
      companyId,
      sessionId,
      lastMessage: text,
      status: 'pending_opening',
      createdAt: inMemoryReactivationQueue.get(normalizedPhone)?.createdAt || new Date(),
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error('[REACTIVATION_SERVICE] Failed to enqueue to DB:', err.message);
    inMemoryReactivationQueue.set(normalizedPhone, {
      phone: normalizedPhone,
      companyId,
      sessionId,
      lastMessage: text,
      status: 'pending_opening',
      createdAt: inMemoryReactivationQueue.get(normalizedPhone)?.createdAt || new Date(),
      updatedAt: new Date(),
    });
  }
}

/**
 * Checks if business is now open and dispatches opening follow-up messages to pending contacts
 */
async function checkAndDispatchReactivationQueue() {
  if (!isBusinessOpen()) {
    return; // Store is currently closed, do nothing
  }

  try {
    // Fetch pending contacts from Postgres
    const { rows } = await query(
      `SELECT * FROM business_hours_reactivation_queue WHERE status = 'pending_opening' ORDER BY updated_at DESC LIMIT 50`
    ).catch(() => ({ rows: [] }));

    // Deduplicate contacts by phone so a contact is never processed multiple times in the same cycle
    const uniqueMap = new Map();
    for (const item of rows) {
      if (!uniqueMap.has(item.phone)) {
        uniqueMap.set(item.phone, item);
      }
    }

    // Append in-memory fallback pending contacts (if not already in DB list)
    for (const [phone, item] of inMemoryReactivationQueue.entries()) {
      if (item.status === 'pending_opening' && !uniqueMap.has(phone)) {
        uniqueMap.set(phone, {
          id: `mem-${phone}`,
          phone: item.phone,
          company_id: item.companyId,
          session_id: item.sessionId,
          last_message: item.lastMessage,
        });
      }
    }

    const pendingList = Array.from(uniqueMap.values());
    if (pendingList.length === 0) return;

    console.log(`[REACTIVATION_SERVICE] Store is OPEN! Processing ${pendingList.length} unique contacts for commercial follow-up.`);

    const { processAI } = require('./ai.service');

    for (const contact of pendingList) {
      try {
        // Mark all pending rows for this contact as processing atomically to prevent duplicate loops
        if (!String(contact.id).startsWith('mem-')) {
          await query(
            `UPDATE business_hours_reactivation_queue SET status = 'processing', updated_at = NOW() WHERE phone = $1 AND company_id = $2 AND status = 'pending_opening'`,
            [contact.phone, contact.company_id || 'default']
          ).catch(() => {});
        }

        // Generate warm opening follow-up via AI
        const prompt = `Você é o atendente virtual da loja. A loja ACABOU DE ABRIR no horário comercial (${businessHours.open}).
O cliente enviou a mensagem "${contact.last_message || 'Olá'}" enquanto a loja estava fechada.
Crie uma mensagem amigável de bom dia/saudação informando que a loja abriu agora e pergunte como pode ajudá-lo com o pedido dele.
Seja natural, simpático e curto (máximo 2 a 3 frases no WhatsApp). Use emojis adequados.`;

        const aiRes = await processAI({
          contact: { name: 'Cliente', phone: contact.phone, sessionId: contact.session_id },
          history: [],
          message: prompt,
          agentName: 'Atendente',
          companyId: contact.company_id || 'default',
        });

        const replyMessage = aiRes?.reply || `Oi! Bom dia! 😊 Abrimos a loja agora. Vi que você nos mandou mensagem fora do horário. Como posso te ajudar hoje?`;

        // Enqueue outbound message via WhatsApp with deterministic correlationId
        const dateKey = new Date().toISOString().slice(0, 10);
        const correlationId = `reactivation_${contact.company_id || 'default'}_${contact.phone}_${dateKey}`;

        await outboundQueueService.enqueue({
          companyId: contact.company_id || 'default',
          phone: contact.phone,
          sessionId: contact.session_id || 'default',
          correlationId,
          text: replyMessage,
          metadata: { systemTag: 'reactivation_followup' },
        });

        // Mark all rows for this contact as completed in DB & memory
        if (String(contact.id).startsWith('mem-')) {
          inMemoryReactivationQueue.delete(contact.phone);
        } else {
          await query(
            `UPDATE business_hours_reactivation_queue SET status = 'completed', updated_at = NOW() WHERE phone = $1 AND company_id = $2 AND status IN ('pending_opening', 'processing')`,
            [contact.phone, contact.company_id || 'default']
          ).catch(() => {});
        }

        inMemoryReactivationQueue.delete(contact.phone);
        console.log(`[REACTIVATION_SERVICE] Successfully reactivated contact ${contact.phone} (correlationId=${correlationId})`);
      } catch (contactErr) {
        console.error(`[REACTIVATION_SERVICE] Failed to reactivate contact ${contact.phone}:`, contactErr.message);
      }
    }
  } catch (err) {
    console.error('[REACTIVATION_SERVICE] Error dispatching reactivation queue:', err.message);
  }
}

// Start recurring check every 1 minute
setInterval(() => {
  checkAndDispatchReactivationQueue().catch(() => {});
}, 60000);

async function getQueueStats(companyId = 'default') {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM business_hours_reactivation_queue WHERE company_id = $1 AND status = 'pending_opening'`,
      [companyId]
    ).catch(() => ({ rows: [{ count: 0 }] }));
    const customersWaiting = Number(rows?.[0]?.count || 0) + inMemoryReactivationQueue.size;
    return {
      batchSize: 5,
      delaySeconds: 60,
      reactivationMessage: 'Olá! Ontem você entrou em contato conosco fora do horário. Posso ajudar agora?',
      customersWaiting,
      messagesSentToday: 0
    };
  } catch (err) {
    return {
      batchSize: 5,
      delaySeconds: 60,
      reactivationMessage: 'Olá! Ontem você entrou em contato conosco fora do horário. Posso ajudar agora?',
      customersWaiting: inMemoryReactivationQueue.size,
      messagesSentToday: 0
    };
  }
}

module.exports = {
  enqueueOutofHoursContact,
  checkAndDispatchReactivationQueue,
  getQueueStats,
};

