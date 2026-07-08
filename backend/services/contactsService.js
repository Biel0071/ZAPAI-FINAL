function toContact(row = {}) {
  let resolvedPhone = row.phone || '';
  let rawLid = row.lid || null;

  if (resolvedPhone) {
    const cleanPhone = String(resolvedPhone).replace(/\D/g, '');
    if (resolvedPhone.includes('@lid') || cleanPhone.length === 15) {
      rawLid = cleanPhone;
      if (global.lidToPhoneMap && global.lidToPhoneMap.has(cleanLid)) {
        resolvedPhone = global.lidToPhoneMap.get(cleanLid);
      }
    }
  }

  return {
    id: String(row.id || resolvedPhone || '').trim(),
    name: String(row.contactName || row.name || resolvedPhone || 'Contato').trim(),
    phone: String(resolvedPhone || '').trim(),
    lid: rawLid ? String(rawLid).trim() : null,
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
