/**
 * Load messages for a given chat, with DB-first and in-memory fallback.
 * Extracted from controllers/messagesController.js (Phase 2a).
 *
 * Module-pure: no module-scoped mutable state; reads from DB / in-memory
 * store through `store` and `messageRepository`.
 */

const whatsappService = require('../../../services/whatsappService');
const messageRepository = require('../../../repositories/messageRepository');
const { normalizeMessagesForApi } = require('./collectionOps');

async function loadMessagesForChat({ chatId, companyId, sessionId, store }) {
  const normalizedPhone = whatsappService.normalizePhone(chatId || '');

  if (!normalizedPhone) {
    return [];
  }

  let sourceMessages = [];

  if (store?.databaseEnabled) {
    try {
      sourceMessages = await messageRepository.getMessagesByPhone(
        normalizedPhone,
        companyId,
        sessionId
      );
    } catch (error) {
      console.error(
        '[API] Failed to load chat messages from DB:',
        error?.message || error
      );
    }
  }

  if (!Array.isArray(sourceMessages) || sourceMessages.length === 0) {
    sourceMessages = (Array.isArray(store?.messages) ? store.messages : []).filter((item) => {
      const itemPhone = whatsappService.normalizePhone(item?.phone || '');
      return itemPhone && itemPhone === normalizedPhone;
    });
  }

  return normalizeMessagesForApi(sourceMessages);
}

module.exports = {
  loadMessagesForChat,
};
