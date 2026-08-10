/**
 * Inbound message dedupe — thin facade over the unified dedupe service.
 * Extracted from controllers/messagesController.js (Phase 2a).
 */

const messageDedupeService = require('../../../../../services/messageDedupeService');

function shouldPersistExternalMessageId(messageId = '') {
  return messageDedupeService.markSeen('inbound_persist', messageId);
}

module.exports = {
  shouldPersistExternalMessageId,
};
