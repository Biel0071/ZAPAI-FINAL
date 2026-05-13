import { createMessage, getConversationMessages } from "../repositories/messageRepository.js";
import { touchConversationAfterMessage } from "../repositories/conversationRepository.js";

export async function getMessagesByConversation(req, res) {
  try {
    const { conversationId } = req.params;
    const limit = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
    const before = typeof req.query.before === "string" && req.query.before.trim() ? req.query.before : null;

    const messages = await getConversationMessages({
      conversationId,
      limit: safeLimit,
      before,
    });
    return res.status(200).json(messages);
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    return res.status(500).json({ error: "Falha ao buscar mensagens" });
  }
}

export async function createMessageController(req, res) {
  try {
    const {
      conversationId,
      sender,
      type,
      content,
      mediaUrl,
      mediaPath,
      emoji,
      status,
      fromMe,
    } = req.body;

    if (!conversationId || !sender) {
      return res.status(400).json({ error: "conversationId e sender são obrigatórios" });
    }

    const message = await createMessage({
      conversationId,
      sender,
      type,
      content,
      mediaUrl,
      mediaPath,
      emoji,
      status,
    });

    await touchConversationAfterMessage({
      conversationId,
      lastMessage: content || (type && type !== "text" ? `[${type}]` : ""),
      incrementUnread: fromMe ? 0 : 1,
    });

    return res.status(201).json(message);
  } catch (error) {
    console.error("Erro ao criar mensagem:", error);
    return res.status(500).json({ error: "Falha ao criar mensagem" });
  }
}
