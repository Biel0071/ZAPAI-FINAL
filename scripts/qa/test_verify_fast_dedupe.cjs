const { performance } = require('perf_hooks');

// Mock data
const mockConversations = [
  { id: "uuid-1", phone: "5531999990001", chatId: "5531999990001@s.whatsapp.net", sessionId: "main", contactName: "Alice", lastMessage: "Hello", lastMessageAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z" },
  { id: "uuid-2", phone: "31999990001", chatId: "31999990001@s.whatsapp.net", sessionId: "main", contactName: "Alice Updated", lastMessage: "Hello 2", lastMessageAt: "2026-11-11T10:05:00Z", updatedAt: "2026-11-11T10:05:00Z" }, // should merge with uuid-1
  { id: "uuid-3", phone: "5531888880002", chatId: "5531888880002@s.whatsapp.net", sessionId: "main", contactName: "Bob", lastMessage: "Hey", lastMessageAt: "2026-11-11T09:00:00Z", updatedAt: "2026-11-11T09:00:00Z" },
  { id: "uuid-4", phone: "5531888880002", chatId: "5531888880002@s.whatsapp.net", sessionId: "rh", contactName: "Bob RH", lastMessage: "Hey RH", lastMessageAt: "2026-11-11T09:00:00Z", updatedAt: "2026-11-11T09:00:00Z" }, // different session - should NOT merge!
];

// Add 6733 more items
for (let i = 5; i <= 6737; i++) {
  mockConversations.push({
    id: "uuid-" + i,
    phone: "5531777" + String(i).padStart(6, "0"),
    chatId: "5531777" + String(i).padStart(6, "0") + "@s.whatsapp.net",
    sessionId: i % 2 === 0 ? "main" : "rh",
    contactName: "Client " + i,
    lastMessage: "Msg " + i,
    lastMessageAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z"
  });
}

function cleanDigits(p) {
  return (p || "").replace(/\D/g, "");
}

function normalizeIdentityPart(val) {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  return str.toLowerCase();
}

function getConversationIdentityScope(conv) {
  const session = normalizeIdentityPart(conv.sessionId) || "main";
  const address = (conv.phone || conv.chatId || conv.id || "").replace(/\D/g, "");
  return address ? `${session}:${address}` : "";
}

function mergeConversationRecord(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    contactName: incoming.contactName || existing.contactName,
    lastMessage: incoming.lastMessage || existing.lastMessage,
    lastMessageAt: incoming.lastMessageAt || existing.lastMessageAt,
  };
}

function dedupeConversationStateFast(conversations) {
  const nextConversations = [];
  const aliasToCanonical = {};

  // All maps are session-scoped to guarantee tenant/session isolation
  const idMap = new Map();
  const scopeMap = new Map();
  const phoneMap = new Map();
  const contactMap = new Map();

  function registerIndexes(conv, index) {
    const session = normalizeIdentityPart(conv.sessionId) || "main";
    if (conv.id) idMap.set(`${session}:${conv.id}`, index);

    const scope = getConversationIdentityScope(conv);
    if (scope) scopeMap.set(scope, index);

    const phones = [conv.phone, conv.chatId].filter(Boolean);
    for (const p of phones) {
      const clean = cleanDigits(p);
      if (clean) {
        phoneMap.set(`${session}:${clean}`, index);
        if (clean.startsWith("55") && clean.length > 10) {
          phoneMap.set(`${session}:${clean.slice(2)}`, index);
        }
        if (clean.length >= 8) {
          phoneMap.set(`${session}:last8:${clean.slice(-8)}`, index);
        }
      }
    }

    const contactId = normalizeIdentityPart(conv.contactId);
    if (contactId) {
      contactMap.set(`${session}:${contactId}`, index);
    }
  }

  function findCanonicalIndex(conv) {
    const session = normalizeIdentityPart(conv.sessionId) || "main";

    // 1. Direct ID match within session
    if (conv.id) {
      const idx = idMap.get(`${session}:${conv.id}`);
      if (idx !== undefined) return idx;
    }

    // 2. Exact scope match (already contains session)
    const scope = getConversationIdentityScope(conv);
    if (scope) {
      const idx = scopeMap.get(scope);
      if (idx !== undefined) return idx;
    }

    // 3. Phone / chatId matches within session
    const phones = [conv.phone, conv.chatId].filter(Boolean);
    for (const p of phones) {
      const clean = cleanDigits(p);
      if (clean) {
        const idxExact = phoneMap.get(`${session}:${clean}`);
        if (idxExact !== undefined) return idxExact;

        if (clean.startsWith("55") && clean.length > 10) {
          const idxNo55 = phoneMap.get(`${session}:${clean.slice(2)}`);
          if (idxNo55 !== undefined) return idxNo55;
        }

        if (clean.length >= 8) {
          const idxLast8 = phoneMap.get(`${session}:last8:${clean.slice(-8)}`);
          if (idxLast8 !== undefined) return idxLast8;
        }
      }
    }

    // 4. ContactId match within session
    const contactId = normalizeIdentityPart(conv.contactId);
    if (contactId) {
      const idxContact = contactMap.get(`${session}:${contactId}`);
      if (idxContact !== undefined) return idxContact;
    }

    return -1;
  }

  for (const conversation of conversations) {
    const existingIndex = findCanonicalIndex(conversation);
    if (existingIndex === -1) {
      const newIdx = nextConversations.length;
      nextConversations.push(conversation);
      aliasToCanonical[conversation.id] = conversation.id;
      registerIndexes(conversation, newIdx);
      continue;
    }

    const canonical = nextConversations[existingIndex];
    nextConversations[existingIndex] = mergeConversationRecord(canonical, conversation);
    aliasToCanonical[conversation.id] = canonical.id;
    aliasToCanonical[canonical.id] = canonical.id;
    registerIndexes(conversation, existingIndex);
  }

  return { conversations: nextConversations, aliasToCanonical };
}

const t0 = performance.now();
const res = dedupeConversationStateFast(mockConversations);
const elapsed = performance.now() - t0;

console.log(`Deduplication of ${mockConversations.length} conversations completed in: ${elapsed.toFixed(2)}ms`);
console.log(`Output count: ${res.conversations.length} (expected: 6736 because uuid-2 merged into uuid-1)`);
console.log(`Alice merged properly:`, res.conversations[0].contactName === "Alice Updated" && res.conversations[0].id === "uuid-1");
console.log(`Bob sessions preserved separate:`, res.conversations.some(c => c.sessionId === "main" && c.id === "uuid-3") && res.conversations.some(c => c.sessionId === "rh" && c.id === "uuid-4"));
console.log(`Alias mapping uuid-2 -> uuid-1:`, res.aliasToCanonical["uuid-2"] === "uuid-1");
