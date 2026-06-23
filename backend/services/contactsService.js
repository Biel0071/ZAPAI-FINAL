function toContact(row = {}) {
  return {
    id: String(row.id || row.phone || '').trim(),
    name: String(row.contactName || row.name || row.phone || 'Contato').trim(),
    phone: String(row.phone || '').trim(),
    status: String(row.status || '').trim(),
  };
}

function listContactsFromConversations(conversations = []) {
  const byPhone = new Map();

  for (const conversation of Array.isArray(conversations) ? conversations : []) {
    const phone = String(conversation.phone || '').trim();
    if (!phone) continue;

    if (!byPhone.has(phone)) {
      byPhone.set(phone, toContact(conversation));
      continue;
    }

    const current = byPhone.get(phone);
    if (!current.name || current.name === current.phone) {
      byPhone.set(phone, toContact(conversation));
    }
  }

  return [...byPhone.values()];
}

module.exports = {
  listContactsFromConversations,
};
