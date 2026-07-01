import { create } from "zustand";
import type { Conversation, MetricsSummary, ChatMessage } from "@/services/apiService";

function isSessionItemValid(item: any): boolean {
  return item && typeof item === "object" && typeof item.id === "string";
}

function isConversationValid(item: any): boolean {
  return item && typeof item === "object" && typeof item.id === "string";
}

function isMessageValid(item: any): boolean {
  return item && typeof item === "object" && typeof item.id === "string";
}

function normalizeIdentityPart(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeConversationAddress(value: unknown): string {
  const raw = normalizeIdentityPart(value);
  if (!raw) return "";
  if (raw.includes("@g.us")) return raw;
  if (raw.includes("@s.whatsapp.net") || raw.includes("@c.us") || raw.includes("@lid")) {
    return raw.replace(/@(s\.whatsapp\.net|c\.us|lid)$/i, "").replace(/\D/g, "");
  }
  if (!/^[+\d\s().-]+$/.test(raw)) return "";
  return raw.replace(/\D/g, "");
}

export function isPhoneMatch(p1?: string | null, p2?: string | null): boolean {
  if (!p1 || !p2) return false;
  const raw1 = normalizeIdentityPart(p1);
  const raw2 = normalizeIdentityPart(p2);
  const isGroup1 = raw1.includes("@g.us");
  const isGroup2 = raw2.includes("@g.us");
  if (isGroup1 || isGroup2) return isGroup1 && isGroup2 && raw1 === raw2;

  const clean1 = normalizeConversationAddress(raw1);
  const clean2 = normalizeConversationAddress(raw2);
  if (!clean1 || !clean2) return false;
  if (clean1 === clean2) return true;
  
  const s1 = clean1.startsWith("55") && clean1.length > 10 ? clean1.slice(2) : clean1;
  const s2 = clean2.startsWith("55") && clean2.length > 10 ? clean2.slice(2) : clean2;
  if (s1 === s2) return true;
  
  if (s1.length >= 8 && s2.length >= 8) {
    return s1.slice(-8) === s2.slice(-8);
  }
  return false;
}

function getConversationIdentityScope(conversation: Partial<Conversation> & { remoteJid?: unknown; jid?: unknown; conversationId?: unknown }): string {
  const session = normalizeIdentityPart(conversation.sessionId) || "main";
  const address =
    normalizeConversationAddress(conversation.phone) ||
    normalizeConversationAddress(conversation.chatId) ||
    normalizeConversationAddress(conversation.remoteJid) ||
    normalizeConversationAddress(conversation.jid) ||
    normalizeConversationAddress(conversation.conversationId) ||
    normalizeConversationAddress(conversation.id);
  return address ? `${session}:${address}` : "";
}

function shouldMergeConversations(existing: Conversation, candidate: Partial<Conversation> & { id: string }): boolean {
  const existingScope = getConversationIdentityScope(existing);
  const candidateScope = getConversationIdentityScope(candidate);
  if (existingScope && candidateScope && existingScope === candidateScope) return true;

  const existingSession = normalizeIdentityPart(existing.sessionId) || "main";
  const candidateSession = normalizeIdentityPart(candidate.sessionId) || "main";
  if (existingSession !== candidateSession) return false;

  if (candidate.phone && (isPhoneMatch(existing.phone, candidate.phone) || isPhoneMatch(existing.chatId, candidate.phone))) return true;
  if (candidate.chatId && (isPhoneMatch(existing.phone, candidate.chatId) || isPhoneMatch(existing.chatId, candidate.chatId))) return true;

  const existingContactId = normalizeIdentityPart(existing.contactId);
  const candidateContactId = normalizeIdentityPart(candidate.contactId);
  return Boolean(candidateContactId && existingContactId === candidateContactId);
}

function getTime(value?: string | null): number {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeConversationRecord(existing: Conversation, incoming: Conversation): Conversation {
  const incomingIsNewer = getTime(incoming.updatedAt) >= getTime(existing.updatedAt);
  const preferred = incomingIsNewer ? incoming : existing;
  const fallback = incomingIsNewer ? existing : incoming;

  return {
    ...fallback,
    ...preferred,
    id: existing.id,
    phone: preferred.phone || fallback.phone,
    chatId: preferred.chatId || fallback.chatId,
    contactId: preferred.contactId || fallback.contactId,
    sessionId: preferred.sessionId || fallback.sessionId,
    contactName: preferred.contactName || fallback.contactName,
    unread: Math.max(existing.unread ?? 0, incoming.unread ?? 0),
    tags: preferred.tags?.length ? preferred.tags : fallback.tags ?? [],
  };
}

function mergeMessageLists(base: ChatMessage[] = [], incoming: ChatMessage[] = [], conversationId: string): ChatMessage[] {
  const merged = [...base];
  for (const message of incoming) {
    if (!isMessageValid(message)) continue;
    if (!merged.some((existing) => existing.id === message.id)) {
      merged.push({ ...message, conversationId });
    }
  }
  merged.sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt));
  return merged;
}

function dedupeConversationState(
  conversations: Conversation[],
  messagesByConversationId: Record<string, ChatMessage[]>,
): {
  conversations: Conversation[];
  messagesByConversationId: Record<string, ChatMessage[]>;
  aliasToCanonical: Record<string, string>;
} {
  const nextConversations: Conversation[] = [];
  const aliasToCanonical: Record<string, string> = {};
  let nextMessages = { ...messagesByConversationId };

  for (const conversation of conversations) {
    const existingIndex = nextConversations.findIndex((existing) => shouldMergeConversations(existing, conversation));
    if (existingIndex === -1) {
      nextConversations.push(conversation);
      aliasToCanonical[conversation.id] = conversation.id;
      continue;
    }

    const canonical = nextConversations[existingIndex];
    nextConversations[existingIndex] = mergeConversationRecord(canonical, conversation);
    aliasToCanonical[conversation.id] = canonical.id;
    aliasToCanonical[canonical.id] = canonical.id;

    if (conversation.id !== canonical.id && nextMessages[conversation.id]) {
      nextMessages[canonical.id] = mergeMessageLists(nextMessages[canonical.id], nextMessages[conversation.id], canonical.id);
      delete nextMessages[conversation.id];
    }
  }

  nextMessages = migrateTemporaryMessageKeys(nextConversations, nextMessages);
  return { conversations: nextConversations, messagesByConversationId: nextMessages, aliasToCanonical };
}

function findConversationIndex(
  conversations: Conversation[],
  candidate: Partial<Conversation> & { id: string },
): number {
  const byId = conversations.findIndex((conversation) => conversation.id === candidate.id);
  if (byId >= 0) return byId;

  const candidateSession = normalizeIdentityPart(candidate.sessionId) || "main";

  return conversations.findIndex((conversation) => {
    const conversationSession = normalizeIdentityPart(conversation.sessionId) || "main";
    if (conversationSession !== candidateSession) return false;

    return shouldMergeConversations(conversation, candidate);

  });
}

export function resolveStoreConversationId(conversations: Conversation[], targetId: string | number): string {
  if (!targetId) return String(targetId);

  const targetStr = String(targetId);
  const found = conversations.find(
    (c) =>
      String(c.id) === targetStr ||
      String(c.chatId) === targetStr ||
      isPhoneMatch(c.phone, targetStr) ||
      isPhoneMatch(c.chatId, targetStr)
  );

  return found ? String(found.id) : targetStr;
}

function migrateTemporaryMessageKeys(
  conversations: Conversation[],
  messagesByConversationId: Record<string, ChatMessage[]>
): Record<string, ChatMessage[]> {
  const nextMessages = { ...messagesByConversationId };
  let changed = false;

  for (const [key, messages] of Object.entries(nextMessages)) {
    if (!messages || messages.length === 0) continue;
    
    // If key is a JID or looks like a phone number (i.e. contains @ or is just digits)
    if (key.includes("@") || /^\d+$/.test(key.replace(/\D/g, ""))) {
      const resolvedId = resolveStoreConversationId(conversations, key);
      if (resolvedId !== key) {
        console.log(`[INBOX REALTIME] Migrating messages from temp key "${key}" to resolved conversation ID "${resolvedId}"`);
        const existingMessages = nextMessages[resolvedId] ?? [];
        const combined = [...existingMessages];
        
        for (const msg of messages) {
          if (!combined.some((m) => m.id === msg.id)) {
            combined.push({ ...msg, conversationId: resolvedId });
          }
        }
        combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        nextMessages[resolvedId] = combined;
        delete nextMessages[key];
        changed = true;
      }
    }
  }

  return changed ? nextMessages : messagesByConversationId;
}

export type RuntimeStatus =
  | "offline"
  | "connecting"
  | "online"
  | "reconnecting"
  | "degraded";

export type SessionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "qr"
  | "error"
  | "unknown";

export type SessionItem = {
  id: string;
  name: string;
  phone?: string | null;
  profilePicture?: string | null;
  pushName?: string | null;
  status: SessionStatus;
  updatedAt?: string | null;
  raw?: any;
};

type AppState = {
  conversations: Conversation[];
  metrics: MetricsSummary | null;
  sessions: SessionItem[];
  lastQr: Record<string, string | null>;
  lastSyncAt: number | null;

  runtimeStatus: RuntimeStatus;
  websocketHealth: "online" | "offline" | "reconnecting";
  apiHealth: "ONLINE" | "RECONNECTING" | "OFFLINE";
  apiLatency: number | null;
  activeConversationId: string | null;
  messagesByConversationId: Record<string, ChatMessage[]>;
  unreadCounters: Record<string, number>;
  reconnectState: { attempts: number; lastAttemptAt: number | null };
  typingUsers: Record<string, boolean | "composing" | "recording">;
  activeSessionId: string | null;

  setConversations: (listOrUpdater: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  upsertConversation: (conv: Conversation) => void;
  setMetrics: (metrics: MetricsSummary | null) => void;

  setSessions: (sessionsOrUpdater: SessionItem[] | ((prev: SessionItem[]) => SessionItem[])) => void;
  upsertSession: (session: SessionItem) => void;
  removeSession: (sessionId: string) => void;

  setLastQr: (sessionId: string, qr: string | null) => void;
  clearLastQr: (sessionId: string) => void;
  clearAllQrs: () => void;
  reset: () => void;

  updateRuntimeStatus: (status: RuntimeStatus) => void;
  updateWebsocketHealth: (health: "online" | "offline" | "reconnecting") => void;
  updateApiHealth: (health: "ONLINE" | "RECONNECTING" | "OFFLINE", latency?: number | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setActiveSessionId: (id: string | null) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: ChatMessage["status"]) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  updateConversationRealtime: (conv: Partial<Conversation> & { id: string }) => void;
  updateReconnectState: (updater: (prev: AppState["reconnectState"]) => AppState["reconnectState"]) => void;
  updateTypingStatus: (conversationId: string, isTyping: boolean | "composing" | "recording") => void;
};

export const useAppStore = create<AppState>((set) => ({
  conversations: [],
  metrics: null,
  sessions: [],
  lastQr: {},
  lastSyncAt: null,

  runtimeStatus: "offline",
  websocketHealth: "offline",
  apiHealth: "ONLINE",
  apiLatency: null,
  activeConversationId: null,
  messagesByConversationId: {},
  unreadCounters: {},
  reconnectState: { attempts: 0, lastAttemptAt: null },
  typingUsers: {},
  activeSessionId: (() => {
    try {
      return localStorage.getItem("zapai_inbox_active_session") || null;
    } catch {
      return null;
    }
  })(),

  setActiveSessionId: (id) =>
    set(() => {
      try {
        if (id) {
          localStorage.setItem("zapai_inbox_active_session", id);
        } else {
          localStorage.removeItem("zapai_inbox_active_session");
        }
      } catch {
        // ignore
      }
      return { activeSessionId: id };
    }),

  setConversations: (listOrUpdater) =>
    set((state) => {
      const resolved =
        typeof listOrUpdater === "function"
          ? listOrUpdater(state.conversations)
          : listOrUpdater;
      if (!Array.isArray(resolved)) {
        console.warn("[Zustand Store] Invalid conversations payload (not an array):", resolved);
        return {};
      }
      const valid = resolved.filter(isConversationValid).map((c) => ({
        ...c,
        assignedAgentName: c.assignedAgentName ?? c.agent_name ?? c.assigned_to ?? null,
        agent_name: c.agent_name ?? c.assignedAgentName ?? c.assigned_to ?? null,
      }));
      const deduped = dedupeConversationState(valid, state.messagesByConversationId);
      return { 
        conversations: deduped.conversations, 
        messagesByConversationId: deduped.messagesByConversationId,
        activeConversationId: state.activeConversationId ? deduped.aliasToCanonical[state.activeConversationId] ?? state.activeConversationId : null,
        lastSyncAt: Date.now() 
      };
    }),

  upsertConversation: (conv) =>
    set((state) => {
      if (!isConversationValid(conv)) {
        console.warn("[Zustand Store] Invalid conversation ignored in upsertConversation:", conv);
        return {};
      }
      const mappedConv = {
        ...conv,
        assignedAgentName: conv.assignedAgentName ?? conv.agent_name ?? conv.assigned_to ?? null,
        agent_name: conv.agent_name ?? conv.assignedAgentName ?? conv.assigned_to ?? null,
      };
      const idx = findConversationIndex(state.conversations, mappedConv);
      let next;
      if (idx === -1) {
        next = [mappedConv, ...state.conversations];
      } else {
        next = state.conversations.slice();
        const existing = next[idx];
        next[idx] = mergeConversationRecord(existing, mappedConv);
      }
      const deduped = dedupeConversationState(next, state.messagesByConversationId);
      return { 
        conversations: deduped.conversations,
        messagesByConversationId: deduped.messagesByConversationId,
        activeConversationId: state.activeConversationId ? deduped.aliasToCanonical[state.activeConversationId] ?? state.activeConversationId : null,
      };
    }),

  setMetrics: (metrics) =>
    set(() => {
      if (metrics !== null && (typeof metrics !== "object" || Array.isArray(metrics))) {
        console.warn("[Zustand Store] Invalid metrics payload (not an object/null):", metrics);
        return {};
      }
      return { metrics, lastSyncAt: Date.now() };
    }),

  setSessions: (sessionsOrUpdater) =>
    set((state) => {
      const resolved =
        typeof sessionsOrUpdater === "function"
          ? sessionsOrUpdater(state.sessions)
          : sessionsOrUpdater;
      if (!Array.isArray(resolved)) {
        console.warn("[Zustand Store] Invalid sessions payload (not an array):", resolved);
        return {};
      }
      const valid = resolved.filter(isSessionItemValid);
      return { sessions: valid, lastSyncAt: Date.now() };
    }),

  upsertSession: (session) =>
    set((state) => {
      if (!isSessionItemValid(session)) {
        console.warn("[Zustand Store] Invalid session item ignored in upsertSession:", session);
        return {};
      }
      const index = state.sessions.findIndex((s) => s.id === session.id);
      if (index === -1) {
        return { sessions: [session, ...state.sessions], lastSyncAt: Date.now() };
      }

      const next = [...state.sessions];
      next[index] = { ...next[index], ...session };
      return { sessions: next, lastSyncAt: Date.now() };
    }),

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      lastQr: Object.fromEntries(
        Object.entries(state.lastQr).filter(([key]) => key !== sessionId)
      ),
      lastSyncAt: Date.now(),
    })),

  setLastQr: (sessionId, qr) =>
    set((state) => ({
      lastQr: { ...state.lastQr, [sessionId]: qr },
    })),

  clearLastQr: (sessionId) =>
    set((state) => {
      const next = { ...state.lastQr };
      delete next[sessionId];
      return { lastQr: next };
    }),

  clearAllQrs: () => set(() => ({ lastQr: {} })),

  reset: () =>
    set({
      conversations: [],
      metrics: null,
      sessions: [],
      lastQr: {},
      lastSyncAt: null,
      runtimeStatus: "offline",
      websocketHealth: "offline",
      activeConversationId: null,
      messagesByConversationId: {},
      unreadCounters: {},
      reconnectState: { attempts: 0, lastAttemptAt: null },
      typingUsers: {},
    }),

  updateRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),

  updateWebsocketHealth: (websocketHealth) => set({ websocketHealth }),

  updateApiHealth: (apiHealth, apiLatency = null) => set({ apiHealth, apiLatency }),

  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),

  setMessages: (conversationId, messages) =>
    set((state) => {
      if (!Array.isArray(messages)) {
        console.warn(`[Zustand Store] Invalid messages payload for ${conversationId} ignored (not an array):`, messages);
        return {};
      }
      const resolvedId = resolveStoreConversationId(state.conversations, conversationId);
      const valid = messages.filter(isMessageValid).map((message) => ({ ...message, conversationId: resolvedId }));
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [resolvedId]: valid,
        },
      };
    }),

  addMessage: (conversationId, message) =>
    set((state) => {
      if (!isMessageValid(message)) {
        console.warn(`[Zustand Store] Invalid message ignored in addMessage for ${conversationId}:`, message);
        return {};
      }
      const resolvedId = resolveStoreConversationId(state.conversations, conversationId);
      const current = state.messagesByConversationId[resolvedId] ?? [];
      
      // If we already have this message by ID, do nothing
      if (current.some((m) => m.id === message.id)) {
        return {};
      }

      let next = current.slice();
      
      // Optimização: Se for uma mensagem real que enviamos e o ID não for temporário,
      // podemos substituir o correspondente temporário ("temp-") mais antigo para este chat.
      if (message.fromMe && !message.id.startsWith("temp-")) {
        const tempIdx = next.findIndex((m) => m.id.startsWith("temp-"));
        if (tempIdx !== -1) {
          next[tempIdx] = { ...message, conversationId: resolvedId };
          return {
            messagesByConversationId: {
              ...state.messagesByConversationId,
              [resolvedId]: next,
            },
          };
        }
      }

      next.push({ ...message, conversationId: resolvedId });
      // Ordena de forma ascendente por data
      next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [resolvedId]: next,
        },
      };
    }),

  updateMessageStatus: (conversationId, messageId, status) =>
    set((state) => {
      const resolvedId = resolveStoreConversationId(state.conversations, conversationId);
      const current = state.messagesByConversationId[resolvedId] ?? [];
      const updated = current.map((m) =>
        m.id === messageId ? { ...m, status } : m
      );
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [resolvedId]: updated,
        },
      };
    }),

  deleteMessage: (conversationId, messageId) =>
    set((state) => {
      const resolvedId = resolveStoreConversationId(state.conversations, conversationId);
      const current = state.messagesByConversationId[resolvedId] ?? [];
      const filtered = current.filter((m) => m.id !== messageId);
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [resolvedId]: filtered,
        },
      };
    }),

  updateConversationRealtime: (conv) =>
    set((state) => {
      if (!conv || typeof conv !== "object" || typeof conv.id !== "string") {
        console.warn("[Zustand Store] Invalid conversation ignored in updateConversationRealtime:", conv);
        return {};
      }
      const resolvedId = resolveStoreConversationId(state.conversations, conv.id);
      const mappedConv = {
        ...conv,
        id: resolvedId,
        assignedAgentName: conv.assignedAgentName ?? conv.agent_name ?? conv.assigned_to ?? undefined,
        agent_name: conv.agent_name ?? conv.assignedAgentName ?? conv.assigned_to ?? undefined,
      };
      if (mappedConv.assignedAgentName === undefined) delete mappedConv.assignedAgentName;
      if (mappedConv.agent_name === undefined) delete mappedConv.agent_name;

      const idx = findConversationIndex(state.conversations, mappedConv);
      let next;
      if (idx === -1) {
        // Se a conversa não existir na lista, adicionamos como nova (cast parcial para Conversation)
        if (!isConversationValid(mappedConv)) {
          console.warn("[Zustand Store] Invalid conversation shape in updateConversationRealtime add ignored:", mappedConv);
          return {};
        }
        next = [mappedConv as Conversation, ...state.conversations];
      } else {
        next = state.conversations.slice();
        const existing = next[idx];
        next[idx] = mergeConversationRecord(existing, mappedConv as Conversation);
      }
      const deduped = dedupeConversationState(next, state.messagesByConversationId);
      return { 
        conversations: deduped.conversations,
        messagesByConversationId: deduped.messagesByConversationId,
        activeConversationId: state.activeConversationId ? deduped.aliasToCanonical[state.activeConversationId] ?? state.activeConversationId : null,
      };
    }),

  updateReconnectState: (updater) =>
    set((state) => ({
      reconnectState: updater(state.reconnectState),
    })),

  updateTypingStatus: (conversationId, isTyping) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: isTyping,
      },
    })),
}));
