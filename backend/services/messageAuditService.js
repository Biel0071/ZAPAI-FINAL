class MessageAuditService {
  static log(event, payload) {
    console.log('[MESSAGE AUDIT]', {
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = MessageAuditService;