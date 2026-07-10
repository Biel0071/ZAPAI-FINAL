const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');
const outboundQueueController = require('../controllers/outboundQueueController');

router.get('/messages', messagesController.listMessages);
router.get('/chats', messagesController.getChats);
router.get('/stickers', messagesController.listStickers);
router.get('/chats/:chatId/messages', messagesController.getMessagesByChatId);
router.get('/messages/by-phone/:phone', messagesController.getMessagesByPhone);
router.get('/messages/:chatId', messagesController.getMessagesByChatId);
router.get('/conversations/:conversationId/messages', messagesController.getMessagesByConversationId);
router.post('/messages', messagesController.createMessage);
router.delete('/messages/:messageId', messagesController.deleteMessage);
router.post('/messages/:messageId/forward', messagesController.forwardMessage);
router.post('/send-message', messagesController.sendMessage);
router.post('/send-media', messagesController.sendMedia);
router.post('/receive-message', messagesController.receiveMessage);
router.post('/outbound-queue/enqueue', outboundQueueController.enqueue);
router.get('/outbound-queue/pending', outboundQueueController.listPending);
router.get('/outbound-queue/dlq', outboundQueueController.listDeadLetter);
router.post('/outbound-queue/dlq/:id/reprocess', outboundQueueController.reprocessDeadLetter);
router.get('/test-lid-send', async (req, res) => {
  try {
    const { activeSessions } = require('../services/whatsapp/state/registry');
    const session = activeSessions.material;
    const sock = session?.sock;
    if (!sock) {
      return res.status(400).json({ error: 'Socket offline', activeKeys: Object.keys(activeSessions) });
    }

    const r1 = await sock.sendMessage('553193807167@s.whatsapp.net', { text: 'Teste 8 digitos s.whatsapp.net' }).catch(err => ({ error: err.message }));
    const r2 = await sock.sendMessage('5531993807167@s.whatsapp.net', { text: 'Teste 9 digitos s.whatsapp.net' }).catch(err => ({ error: err.message }));
    const r3 = await sock.sendMessage('153343318048786@lid', { text: 'Teste LID' }).catch(err => ({ error: err.message }));

    return res.json({ r1, r2, r3 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
