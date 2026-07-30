/**
 * Domain Events — Message Domain
 */

const MESSAGE_EVENTS = {
  RECEIVED: 'message.received',
  SENT: 'message.sent',
  FAILED: 'message.failed',
  ACK_UPDATED: 'message.ack_updated',
  READ: 'message.read',
};

function createMessagePayload({
  messageId,
  conversationId = null,
  tenantId,
  companyId = tenantId,
  senderPhone,
  receiverPhone = null,
  text = '',
  mediaUrl = null,
  status = 'pending',
  correlationId = null,
}) {
  return {
    eventType: MESSAGE_EVENTS.RECEIVED,
    version: '1.0',
    timestamp: new Date().toISOString(),
    tenantId,
    companyId,
    correlationId,
    payload: {
      messageId,
      conversationId,
      senderPhone,
      receiverPhone,
      text,
      mediaUrl,
      status,
    },
  };
}

module.exports = {
  MESSAGE_EVENTS,
  createMessagePayload,
};
