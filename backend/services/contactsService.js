function toContact(row = {}) {
  let resolvedPhone = row.phone || '';
  let rawLid = row.lid || null;

  if (resolvedPhone) {
    const cleanPhone = String(resolvedPhone).replace(/\D/g, '');
    if (resolvedPhone.includes('@lid') || cleanPhone.length === 15) {
      rawLid = cleanPhone;
      if (global.lidToPhoneMap && global.lidToPhoneMap.has(cleanPhone)) {
        resolvedPhone = global.lidToPhoneMap.get(cleanPhone);
      }
    }
  }

  return {
    id: String(row.contact_id || row.lead_id || row.id || resolvedPhone || '').trim(),
    conversationId: String(row.id || row.conversationId || '').trim(),
    name: String(row.contactName || row.name || resolvedPhone || 'Contato').trim(),
    phone: String(resolvedPhone || '').trim(),
    lid: rawLid ? String(rawLid).trim() : null,
    status: String(row.status || '').trim(),
    isGroup: String(row.remote_jid || row.remoteJid || row.chatId || resolvedPhone).endsWith('@g.us'),
    tags: Array.isArray(row.tags) ? row.tags : [],
    lead_temperature: String(row.lead_temperature || '').trim(),
    funnel_stage: String(row.funnel_stage || '').trim(),
    lastMessage: String(row.lastMessage || '').trim(),
    updatedAt: row.updatedAt || row.lastMessageAt || row.createdAt || null,
    unread: Number(row.unreadCount || row.unread || 0),
    sessionId: String(row.session_id || row.sessionId || '').trim(),
    remoteJid: String(row.remote_jid || row.remoteJid || row.chatId || '').trim(),
  };
}

function listContactsFromConversations(conversations = []) {
  const byConversationContact = new Map();

  for (const conversation of Array.isArray(conversations) ? conversations : []) {
    const contact = toContact(conversation);
    const normalizedPhone = contact.isGroup
      ? contact.phone.toLowerCase()
      : contact.phone.replace(/\D/g, '');
    const key = normalizedPhone || contact.id;
    if (!key || !contact.conversationId) continue;

    if (!byConversationContact.has(key)) {
      byConversationContact.set(key, contact);
      continue;
    }

    const current = byConversationContact.get(key);
    const currentDate = new Date(current.updatedAt || 0).getTime();
    const nextDate = new Date(contact.updatedAt || 0).getTime();
    if (nextDate >= currentDate) {
      byConversationContact.set(key, contact);
    }
  }

  return [...byConversationContact.values()];
}

module.exports = {
  listContactsFromConversations,
};
