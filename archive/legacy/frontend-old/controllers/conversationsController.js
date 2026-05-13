import { createConversation, getConversations, updateConversationAI, updateConversationSummary } from "../repositories/conversationRepository.js";
import { createContact, findContactByPhone } from "../repositories/contactRepository.js";

export async function listConversationsController(req, res) {
  try {
    const companyId = String(req.query.companyId || "default");
    const limit = Number.parseInt(String(req.query.limit ?? "20"), 10);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 20;
    const conversations = await getConversations({ companyId, limit: safeLimit });
    return res.status(200).json(conversations);
  } catch (error) {
    console.error("Erro ao listar conversas:", error);
    return res.status(500).json({ error: "Falha ao listar conversas" });
  }
}

export async function createConversationController(req, res) {
  try {
    const {
      companyId = "default",
      contactName,
      phone,
      sessionId,
      status,
      leadTemperature,
    } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "phone é obrigatório" });
    }

    let contact = await findContactByPhone({ companyId, phone });
    if (!contact) {
      contact = await createContact({
        companyId,
        name: contactName || phone,
        phone,
      });
    }

    const conversation = await createConversation({
      companyId,
      contactId: contact.id,
      sessionId: sessionId || null,
      status: status || "open",
      leadTemperature: leadTemperature || "warm",
    });

    return res.status(201).json(conversation);
  } catch (error) {
    console.error("Erro ao criar conversa:", error);
    return res.status(500).json({ error: "Falha ao criar conversa" });
  }
}

export async function toggleConversationAIController(req, res) {
  try {
    const { conversationId } = req.params;
    const { aiEnabled } = req.body;

    if (typeof aiEnabled !== "boolean") {
      return res.status(400).json({ error: "aiEnabled deve ser boolean" });
    }

    const updated = await updateConversationAI({ conversationId, aiEnabled });
    if (!updated) return res.status(404).json({ error: "Conversa não encontrada" });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Erro ao atualizar AI da conversa:", error);
    return res.status(500).json({ error: "Falha ao atualizar AI da conversa" });
  }
}

export async function updateConversationSummaryController(req, res) {
  try {
    const { conversationId } = req.params;
    const { summary } = req.body;

    const updated = await updateConversationSummary({
      conversationId,
      summary: summary || null,
    });

    if (!updated) return res.status(404).json({ error: "Conversa não encontrada" });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Erro ao atualizar resumo:", error);
    return res.status(500).json({ error: "Falha ao atualizar resumo" });
  }
}
