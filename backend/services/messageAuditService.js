const { query } = require('../config/database');

class MessageAuditService {
  static log(event, payload) {
    console.log('[MESSAGE AUDIT]', {
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  static async logStep({ messageId, conversationId, phone, step, status = 'success', errorMessage = null, details = {} }) {
    try {
      console.log(`[MESSAGE AUDIT STEP] step=${step} status=${status} msgId=${messageId || 'n/a'}`);
      await query(
        `INSERT INTO message_audit_logs 
         (message_id, conversation_id, phone, step, status, error_message, details, timestamp) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          messageId ? String(messageId) : null,
          conversationId ? String(conversationId) : null,
          phone ? String(phone) : null,
          String(step),
          String(status),
          errorMessage ? String(errorMessage) : null,
          JSON.stringify(details || {})
        ]
      );
    } catch (err) {
      console.error('[MESSAGE AUDIT ERROR] Failed to save audit log:', err.message);
    }
  }
}

module.exports = MessageAuditService;