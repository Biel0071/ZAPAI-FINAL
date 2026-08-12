const { query } = require('../src/infrastructure/config/database');
const { isBusinessOpen, businessHours } = require('../src/infrastructure/config/businessHours');
const outboundQueueService = require('./outboundQueueService');

// In-memory fallback queue if database is temporarily unavailable
const inMemoryReactivationQueue = new Map();

async function initReactivationTable() {
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
    `);
  } catch (err) {
    console.warn('[REACTIVATION_SERVICE] Table init warning:', err.message);
  }
}

// Initialize table on module load
initReactivationTable().catch(() => {});

/**
 * Enqueues a contact who messaged outside business hours
 */
async function enqueueOutofHoursContact({ phone, text, companyId = 'default', sessionId = 'default' }) {
  if (!phone) return;
  const normalizedPhone = String(phone).replace(/\D/g, '');

  console.log(`[REACTIVATION_SERVICE] Enqueueing out-of-hours contact ${normalizedPhone}`);

  try {
    // 1. Persist to DB or Memory
    await query(
      `INSERT INTO business_hours_reactivation_queue (phone, company_id, session_id, last_message, status, updated_at)
       VALUES ($1, $2, $3, $4, 'pending_opening', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [normalizedPhone, companyId, sessionId, text || '']
    ).catch(async () => {
      // Fallback insert
      inMemoryReactivationQueue.set(normalizedPhone, {
        phone: normalizedPhone,
        companyId,
        sessionId,
        lastMessage: text,
        status: 'pending_opening',
        createdAt: new Date(),
      });
    });
  } catch (err) {
    console.error('[REACTIVATION_SERVICE] Failed to enqueue to DB:', err.message);
    inMemoryReactivationQueue.set(normalizedPhone, {
      phone: normalizedPhone,
      companyId,
      sessionId,
      lastMessage: text,
      status: 'pending_opening',
      createdAt: new Date(),
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
      `SELECT * FROM business_hours_reactivation_queue WHERE status = 'pending_opening' LIMIT 50`
    ).catch(() => ({ rows: [] }));

    const pendingList = [...rows];

    // Append in-memory fallback pending contacts
    for (const [phone, item] of inMemoryReactivationQueue.entries()) {
      if (item.status === 'pending_opening') {
        pendingList.push({
          id: `mem-${phone}`,
          phone: item.phone,
          company_id: item.companyId,
          session_id: item.sessionId,
          last_message: item.lastMessage,
        });
      }
    }

    if (pendingList.length === 0) return;

    console.log(`[REACTIVATION_SERVICE] Store is OPEN! Processing ${pendingList.length} contacts for commercial follow-up.`);

    const { processAI } = require('./ai.service');

    for (const contact of pendingList) {
      try {
        // Generate warm opening follow-up via AI
        const prompt = `Você é o atendente virtual da loja. A loja ACABOU DE ABRIR no horário comercial (${businessHours.open}).
O cliente enviou a mensagem "${contact.last_message || 'Olá'}" enquanto a loja estava fechada.
Crie uma mensagem amigável de bom dia/saudação informando que a loja abriu agora e pergunte como pode ajudá-lo com o pedido dele.
Seja natural, simpático e curto (máximo 2 a 3 frases no WhatsApp). Use emojis adequados.`;

        const aiRes = await processAI({
          contact: { name: 'Cliente', phone: contact.phone },
          history: [],
          message: prompt,
          agentName: 'Atendente',
        });

        const replyMessage = aiRes?.reply || `Oi! Bom dia! 😊 Abrimos a loja agora. Vi que você nos mandou mensagem fora do horário. Como posso te ajudar hoje?`;

        // Enqueue outbound message via WhatsApp
        await outboundQueueService.enqueue({
          companyId: contact.company_id || 'default',
          phone: contact.phone,
          sessionId: contact.session_id || 'default',
          text: replyMessage,
          metadata: { systemTag: 'reactivation_followup' },
        });

        // Mark as completed in DB & memory
        if (String(contact.id).startsWith('mem-')) {
          inMemoryReactivationQueue.delete(contact.phone);
        } else {
          await query(
            `UPDATE business_hours_reactivation_queue SET status = 'completed', updated_at = NOW() WHERE id = $1`,
            [contact.id]
          ).catch(() => {});
        }

        console.log(`[REACTIVATION_SERVICE] Successfully reactivated contact ${contact.phone}`);
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

