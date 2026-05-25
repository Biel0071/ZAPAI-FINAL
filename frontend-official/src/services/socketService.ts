import { io, type Socket } from "socket.io-client";
import type { ChatMessage, Conversation } from "@/services/apiService";
import { markFrontendHealthy, reportFrontendIssue } from "@/services/frontendHealthService";
import { loadAdminAuthSession } from "@/lib/adminAuthSession";

type RawRealtimeMessage = {
  id?: string;
  conversationId?: string;
  conversation_id?: string;
  chatId?: string;
  chat_id?: string;
  ticketId?: string;
  threadId?: string;
  dialogId?: string;
  contactId?: string;
  contact_id?: string;
  sessionId?: string;
  session_id?: string;
  instanceId?: string;
  instance_id?: string;
  phone?: string;
  phoneNumber?: string;
  to?: string;
  toNumber?: string;
  from?: string;
  fromNumber?: string;
  remoteJid?: string;
  jid?: string;
  author?: string;
  participant?: string;
  sender?: string;
  content?: string;
  text?: string;
  body?: string;
  caption?: string;
  fromMe?: boolean;
  sent?: boolean;
  createdAt?: string;
  created_at?: string;
  timestamp?: string;
  time?: string;
  status?: "sending" | "sent" | "delivered" | "read";
  isAI?: boolean;
  messageType?: "text" | "image" | "video" | "audio" | "file" | "document";
  mediaType?: "image" | "video" | "audio" | "file" | "document";
  type?: "text" | "image" | "video" | "audio" | "file" | "document";
  mimeType?: string;
  mimetype?: string;
  hasMedia?: boolean;
  mediaPath?: string;
  media_path?: string;
  mediaUrl?: string;
  media_url?: string;
  url?: string;
  thumbnail?: string;
  media?: {
    path?: string;
    url?: string;
    type?: "image" | "video" | "audio" | "file" | "document";
    mimeType?: string;
    mimetype?: string;
  };
  message?: {
    id?: string;
    conversationId?: string;
    conversation_id?: string;
    chatId?: string;
    chat_id?: string;
    ticketId?: string;
    threadId?: string;
    dialogId?: string;
    contactId?: string;
    contact_id?: string;
    sessionId?: string;
    session_id?: string;
    phone?: string;
    to?: string;
    from?: string;
    remoteJid?: string;
    jid?: string;
    author?: string;
    content?: string;
    text?: string;
    body?: string;
    caption?: string;
    createdAt?: string;
    created_at?: string;
    timestamp?: string;
    mediaPath?: string;
    media_path?: string;
    mediaUrl?: string;
    media_url?: string;
    url?: string;
    thumbnail?: string;
    mimeType?: string;
    mimetype?: string;
    type?: "text" | "image" | "video" | "audio" | "file" | "document";
    mediaType?: "image" | "video" | "audio" | "file" | "document";
  };
};

type RawBaileysMessage = {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
    participant?: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string; mimetype?: string };
    videoMessage?: { caption?: string; mimetype?: string };
    audioMessage?: { mimetype?: string };
    documentMessage?: { caption?: string; mimetype?: string; fileName?: string };
  };
  messageTimestamp?: number | string;
  pushName?: string;
};

type RawMessageEnvelope = {
  conversationId?: string;
  conversation_id?: string;
  chatId?: string;
  chat_id?: string;
  ticketId?: string;
  sessionId?: string;
  session_id?: string;
  message?: RawRealtimeMessage;
  data?:
    | RawRealtimeMessage
    | {
        message?: RawRealtimeMessage;
        conversationId?: string;
        conversation_id?: string;
        chatId?: string;
        chat_id?: string;
        messages?: RawBaileysMessage[];
        sessionId?: string;
        session_id?: string;
      };
  payload?:
    | RawRealtimeMessage
    | {
        message?: RawRealtimeMessage;
        conversationId?: string;
        conversation_id?: string;
        chatId?: string;
        chat_id?: string;
        messages?: RawBaileysMessage[];
        sessionId?: string;
        session_id?: string;
      };
  new?: RawRealtimeMessage;
  msg?: RawRealtimeMessage;
  messages?: RawBaileysMessage[];
  key?: RawBaileysMessage["key"];
  type?: string;
};

type RawRealtimeConversation = {
  id?: string;
  conversationId?: string;
  conversation_id?: string;
  chatId?: string;
  chat_id?: string;
  jid?: string;
  remoteJid?: string;
  companyId?: string;
  company_id?: string;
  contactId?: string;
  contact_id?: string;
  sessionId?: string;
  session_id?: string;
  contactName?: string;
  name?: string;
  pushName?: string;
  avatar?: string;
  profilePictureUrl?: string;
  profile_picture_url?: string;
  isGroup?: boolean;
  lastMessage?: string;
  last_message?: string;
  updatedAt?: string;
  updated_at?: string;
  timestamp?: string;
  phone?: string;
  phoneNumber?: string;
  unread?: number;
  unreadCount?: number;
  unread_count?: number;
  status?: "online" | "offline" | "typing";
  tags?: string[];
  isAI?: boolean;
  lastMessageType?: "text" | "image" | "video" | "audio" | "file";
  mediaType?: "image" | "video" | "audio" | "file";
};

type RealtimeMessage = ChatMessage & {
  conversationId?: string;
  chatId?: string;
  contactId?: string;
  sessionId?: string;
  phone?: string;
  messageType?: "text" | "image" | "video" | "audio" | "file";
  caption?: string;
  timestamp?: string;
  url?: string;
};

function toCanonicalMediaType(
  value?: string,
): "text" | "image" | "video" | "audio" | "file" {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "image") return "image";
  if (normalized === "video") return "video";
  if (normalized === "audio") return "audio";
  if (normalized === "file" || normalized === "document") return "file";
  return "text";
}

type SocketSubscriber = {
  onNewMessage?: (message: RealtimeMessage) => void;
  onConversationUpdated?: (conversation: Conversation) => void;
  onChatsLoaded?: (payload: unknown) => void;
  onConversationSnapshot?: (payload: unknown) => void;
  onContactsLoaded?: (payload: unknown) => void;
  onAiResponse?: (payload: RealtimeMessage) => void;
  onChatArchived?: (payload: { chatId?: string; conversationId?: string }) => void;
  onChatTagUpdated?: (payload: { chatId?: string; conversationId?: string; tag?: string; action?: "add" | "remove" }) => void;
  onQrGenerated?: (payload: { sessionId?: string; qr?: string }) => void;
  onSessionConnected?: (payload: { sessionId?: string; phone?: string; status?: string }) => void;
  onSessionDisconnected?: (payload: { sessionId?: string; status?: string; reason?: string }) => void;
  onSessionDeleted?: (payload: { sessionId?: string; status?: string }) => void;
  onSessionStatus?: (payload: { sessionId?: string; status?: string }) => void;
  onMessageDeleted?: (payload: { messageId: string; conversationId?: string }) => void;
  onMessageStatus?: (payload: { messageId: string; status: string; conversationId?: string }) => void;
  onTypingStatus?: (payload: { conversationId?: string; phone?: string; isTyping: boolean }) => void;
  onSocketConnected?: () => void;
  onSocketDisconnected?: () => void;
  onError?: (message: string) => void;
};

let sharedSocket: Socket | null = null;
let sharedSocketUrl: string | null = null;
let eventBindingsReady = false;
let lastForcedReconnectAt = 0;
const MIN_FORCE_RECONNECT_INTERVAL_MS = 5000;
const subscribers = new Map<string, SocketSubscriber>();

function toStableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function inferMediaTypeFromMime(mime?: string): "image" | "video" | "audio" | "file" | undefined {
  if (!mime) return undefined;
  const normalized = mime.toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "audio";
  return "file";
}

function extractDigits(value?: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

function extractChatIdentifier(value?: string): string | undefined {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  if (raw.includes("@g.us")) return raw;
  const digits = extractDigits(raw);
  return digits || undefined;
}

function normalizeRealtimeMessage(input: RawRealtimeMessage): RealtimeMessage {
  const nestedMessage = input.message;
  const nestedMime = nestedMessage?.mimeType ?? nestedMessage?.mimetype;
  const canonicalType = toCanonicalMediaType(
    input.messageType ??
    input.mediaType ??
    input.type ??
    nestedMessage?.mediaType ??
    nestedMessage?.type ??
    input.media?.type ??
    inferMediaTypeFromMime(input.mimeType ?? input.mimetype ?? nestedMime ?? input.media?.mimeType ?? input.media?.mimetype) ??
    (input.hasMedia ? "file" : "text"),
  );
  const rawConversationId =
    input.conversationId ??
    input.conversation_id ??
    input.chatId ??
    input.chat_id ??
    input.ticketId ??
    input.threadId ??
    input.dialogId ??
    input.remoteJid ??
    input.jid ??
    nestedMessage?.conversationId ??
    nestedMessage?.conversation_id ??
    nestedMessage?.chatId ??
    nestedMessage?.chat_id ??
    nestedMessage?.ticketId ??
    nestedMessage?.threadId ??
    nestedMessage?.dialogId ??
    nestedMessage?.remoteJid ??
    nestedMessage?.jid;
  const sender = (input.sender ?? "").toLowerCase();
  const resolvedCreatedAt = input.createdAt ?? input.created_at ?? input.timestamp ?? input.time ?? nestedMessage?.createdAt ?? nestedMessage?.created_at ?? nestedMessage?.timestamp ?? new Date().toISOString();
  const resolvedContent = input.content ?? input.text ?? input.body ?? input.caption ?? nestedMessage?.content ?? nestedMessage?.text ?? nestedMessage?.body ?? nestedMessage?.caption ?? "";
  const resolvedMediaPath = input.mediaPath ?? input.media_path ?? nestedMessage?.mediaPath ?? nestedMessage?.media_path ?? input.media?.path;
  const resolvedMediaUrl =
    input.url ??
    input.mediaUrl ??
    input.media_url ??
    nestedMessage?.url ??
    nestedMessage?.mediaUrl ??
    nestedMessage?.media_url ??
    input.media?.url;
  const resolvedPhone =
    extractChatIdentifier(input.phone) ||
    extractChatIdentifier(input.phoneNumber) ||
    extractChatIdentifier(input.to) ||
    extractChatIdentifier(input.toNumber) ||
    extractChatIdentifier(input.from) ||
    extractChatIdentifier(input.fromNumber) ||
    extractChatIdentifier(input.remoteJid) ||
    extractChatIdentifier(input.jid) ||
    extractChatIdentifier(input.author) ||
    extractChatIdentifier(input.participant) ||
    extractChatIdentifier(String(rawConversationId ?? "")) ||
    extractChatIdentifier(nestedMessage?.phone) ||
    extractChatIdentifier(nestedMessage?.to) ||
    extractChatIdentifier(nestedMessage?.from) ||
    extractChatIdentifier(nestedMessage?.remoteJid) ||
    extractChatIdentifier(nestedMessage?.jid) ||
    extractChatIdentifier(nestedMessage?.author) ||
    undefined;
  const stableSeed = [
    rawConversationId ?? "",
    input.sessionId ?? input.session_id ?? "",
    resolvedPhone ?? "",
    resolvedCreatedAt,
    resolvedContent,
    resolvedMediaPath ?? resolvedMediaUrl ?? "",
    String(input.fromMe ?? input.sent ?? sender),
  ].join("|");

  return {
    id: String(input.id ?? `rt-${toStableHash(stableSeed)}`),
    conversationId: rawConversationId !== undefined && rawConversationId !== null ? String(rawConversationId) : undefined,
    chatId: rawConversationId !== undefined && rawConversationId !== null ? String(rawConversationId) : undefined,
    contactId: input.contactId ?? input.contact_id ?? nestedMessage?.contactId ?? nestedMessage?.contact_id,
    sessionId: input.sessionId ?? input.session_id ?? input.instanceId ?? input.instance_id ?? nestedMessage?.sessionId ?? nestedMessage?.session_id,
    content: resolvedContent,
    fromMe: input.fromMe ?? input.sent ?? ["agent", "me", "outbound"].includes(sender),
    createdAt: resolvedCreatedAt,
    timestamp: resolvedCreatedAt,
    status: input.status ?? "sent",
    isAI: input.isAI ?? false,
    phone: resolvedPhone,
    messageType: canonicalType,
    mediaType: canonicalType !== "text" ? canonicalType : undefined,
    mediaPath: resolvedMediaPath,
    mediaUrl: resolvedMediaUrl,
    url: resolvedMediaUrl ?? resolvedMediaPath,
    caption: input.caption ?? nestedMessage?.caption,
  };
}

function normalizeSingleBaileysMessage(
  entry: RawBaileysMessage,
  context?: { sessionId?: string; session_id?: string },
): RealtimeMessage | null {
  if (!entry || typeof entry !== "object") return null;

  const remoteJid = entry.key?.remoteJid ?? "";
  const participant = entry.key?.participant ?? "";
  const phone = extractChatIdentifier(remoteJid) || extractChatIdentifier(participant) || undefined;
  const msg = entry.message;

  const text =
    msg?.conversation ??
    msg?.extendedTextMessage?.text ??
    msg?.imageMessage?.caption ??
    msg?.videoMessage?.caption ??
    msg?.documentMessage?.caption ??
    "";

  const mediaType = msg?.imageMessage
    ? "image"
    : msg?.videoMessage
      ? "video"
      : msg?.audioMessage
        ? "audio"
        : msg?.documentMessage
          ? "document"
          : "text";

  const rawTimestamp = Number(entry.messageTimestamp ?? Date.now());
  const millis = Number.isFinite(rawTimestamp)
    ? rawTimestamp < 1_000_000_000_000
      ? rawTimestamp * 1000
      : rawTimestamp
    : Date.now();

  return normalizeRealtimeMessage({
    id: entry.key?.id,
    conversationId: phone,
    sessionId: context?.sessionId ?? context?.session_id,
    phone,
    remoteJid,
    participant,
    fromMe: Boolean(entry.key?.fromMe),
    sender: entry.key?.fromMe ? "agent" : "customer",
    content: text,
    createdAt: new Date(millis).toISOString(),
    messageType: mediaType,
    mimeType:
      msg?.imageMessage?.mimetype ??
      msg?.videoMessage?.mimetype ??
      msg?.audioMessage?.mimetype ??
      msg?.documentMessage?.mimetype,
  });
}

function normalizeBaileysMessages(envelope: RawMessageEnvelope): RealtimeMessage[] {
  const dataRecord = envelope.data && typeof envelope.data === "object" ? (envelope.data as Record<string, unknown>) : null;
  const payloadRecord = envelope.payload && typeof envelope.payload === "object" ? (envelope.payload as Record<string, unknown>) : null;

  const rawEntries = [
    ...(Array.isArray(envelope.messages) ? envelope.messages : []),
    ...(Array.isArray(dataRecord?.messages) ? (dataRecord.messages as RawBaileysMessage[]) : []),
    ...(Array.isArray(payloadRecord?.messages) ? (payloadRecord.messages as RawBaileysMessage[]) : []),
  ];

  if (rawEntries.length === 0) return [];

  return rawEntries
    .map((entry) =>
      normalizeSingleBaileysMessage(entry, {
        sessionId: envelope.sessionId ?? (typeof dataRecord?.sessionId === "string" ? dataRecord.sessionId : undefined) ?? (typeof payloadRecord?.sessionId === "string" ? payloadRecord.sessionId : undefined),
        session_id:
          envelope.session_id ??
          (typeof dataRecord?.session_id === "string" ? dataRecord.session_id : undefined) ??
          (typeof payloadRecord?.session_id === "string" ? payloadRecord.session_id : undefined),
      }),
    )
    .filter((item): item is RealtimeMessage => Boolean(item?.id));
}

function normalizeRealtimeConversation(input: RawRealtimeConversation): Conversation {
  const normalizedType = input.lastMessageType ?? input.mediaType ?? "text";
  const contactId = input.contactId ?? input.contact_id;
  const sessionId = input.sessionId ?? input.session_id;
  const rawConversationId = input.id ?? input.conversationId ?? input.conversation_id ?? input.chatId ?? input.chat_id;
  const fallbackPhone =
    extractChatIdentifier(input.chatId) ||
    extractChatIdentifier(input.chat_id) ||
    extractChatIdentifier(input.jid) ||
    extractChatIdentifier(input.remoteJid) ||
    extractChatIdentifier(String(rawConversationId ?? ""));
  const resolvedPhone = input.phone ?? input.phoneNumber ?? fallbackPhone;
  const stableFallbackId = [contactId, sessionId, resolvedPhone].filter(Boolean).join("-");

  return {
    id: String((rawConversationId ?? stableFallbackId) || `rt-conversation-${Date.now()}`),
    chatId: String(rawConversationId ?? stableFallbackId ?? ""),
    companyId: input.companyId ?? input.company_id,
    contactId,
    sessionId,
    contactName: input.contactName ?? input.name ?? input.pushName ?? "Contato",
    avatar: input.avatar ?? input.profilePictureUrl ?? input.profile_picture_url,
    isGroup: input.isGroup ?? String(resolvedPhone ?? "").includes("@g.us"),
    lastMessage: input.lastMessage ?? input.last_message ?? "",
    updatedAt: input.updatedAt ?? input.updated_at ?? input.timestamp ?? new Date().toISOString(),
    phone: resolvedPhone ?? "",
    unread: input.unread ?? input.unreadCount ?? input.unread_count ?? 0,
    status: input.status ?? "offline",
    tags: input.tags ?? [],
    isAI: input.isAI ?? false,
    lastMessageType: toCanonicalMediaType(normalizedType),
  };
}

function notifySubscribers(notify: (subscriber: SocketSubscriber) => void) {
  subscribers.forEach((subscriber) => notify(subscriber));
}

function resolveRealtimeMessagePayload(payload: RawRealtimeMessage | RawMessageEnvelope): RealtimeMessage[] {
  const envelope = payload as RawMessageEnvelope;

  const directBaileys = normalizeSingleBaileysMessage(payload as RawBaileysMessage, {
    sessionId: envelope.sessionId,
    session_id: envelope.session_id,
  });
  if (directBaileys) return [directBaileys];

  const fromBaileys = normalizeBaileysMessages(envelope);
  if (fromBaileys.length > 0) return fromBaileys;

  const payloadRecord = envelope.payload && typeof envelope.payload === "object" ? (envelope.payload as Record<string, unknown>) : null;
  const dataRecord = envelope.data && typeof envelope.data === "object" ? (envelope.data as Record<string, unknown>) : null;

  const nestedCandidate =
    envelope.message ??
    (payloadRecord?.message as RawRealtimeMessage | undefined) ??
    (dataRecord?.message as RawRealtimeMessage | undefined) ??
    (envelope.payload as RawRealtimeMessage | undefined) ??
    (envelope.data as RawRealtimeMessage | undefined) ??
    envelope.new ??
    envelope.msg;

  const rawMessage = nestedCandidate ?? (payload as RawRealtimeMessage);
  const normalized = normalizeRealtimeMessage(rawMessage);

  const envelopeConversationId =
    envelope.conversationId ??
    envelope.conversation_id ??
    envelope.chatId ??
    envelope.chat_id ??
    envelope.ticketId ??
    (typeof payloadRecord?.conversationId === "string" ? payloadRecord.conversationId : undefined) ??
    (typeof payloadRecord?.conversation_id === "string" ? payloadRecord.conversation_id : undefined) ??
    (typeof payloadRecord?.chatId === "string" ? payloadRecord.chatId : undefined) ??
    (typeof payloadRecord?.chat_id === "string" ? payloadRecord.chat_id : undefined) ??
    (typeof dataRecord?.conversationId === "string" ? dataRecord.conversationId : undefined) ??
    (typeof dataRecord?.conversation_id === "string" ? dataRecord.conversation_id : undefined) ??
    (typeof dataRecord?.chatId === "string" ? dataRecord.chatId : undefined) ??
    (typeof dataRecord?.chat_id === "string" ? dataRecord.chat_id : undefined);

  if (!normalized.conversationId && envelopeConversationId) {
    return [{ ...normalized, conversationId: String(envelopeConversationId) }];
  }

  return [normalized];
}

function bindSharedSocketEvents() {
  if (!sharedSocket || eventBindingsReady) return;

  sharedSocket.on("connect", () => {
    console.info(`[Socket] connected id=${sharedSocket?.id ?? "??"} subscribers=${subscribers.size}`);
    markFrontendHealthy();
    notifySubscribers((subscriber) => subscriber.onSocketConnected?.());
  });

  sharedSocket.on("disconnect", (reason) => {
    console.warn(`[Socket] disconnected reason=${reason ?? "unknown"} subscribers=${subscribers.size}`);
    reportFrontendIssue({
      type: "socket_disconnection",
      message: `Socket.IO disconnected: ${reason ?? "unknown"}`,
      service: "socket.io",
      level: "warning",
    });
    notifySubscribers((subscriber) => subscriber.onSocketDisconnected?.());
  });

  sharedSocket.on("connect_error", (error: Error) => {
    reportFrontendIssue({
      type: "socket_disconnection",
      message: error.message || "Socket.IO connection error",
      service: "socket.io",
      level: "warning",
    });
    notifySubscribers((subscriber) => subscriber.onSocketDisconnected?.());
    notifySubscribers((subscriber) => subscriber.onError?.(error.message || "Falha na conexão realtime"));
  });

  const handleIncomingMessage = (payload: RawRealtimeMessage | RawMessageEnvelope) => {
    const normalizedMessages = resolveRealtimeMessagePayload(payload);
    normalizedMessages.forEach((normalized) => {
      notifySubscribers((subscriber) => subscriber.onNewMessage?.(normalized));
    });
  };

  const messageEvents = [
    "new_message",
    "new_media",
    "media",
    "audio",
    "media_sent",
    "message:new",
    "message",
    "newMessage",
    "messages.upsert",
    "whatsapp:new_message",
    "inbound_message",
  ];
  messageEvents.forEach((eventName) => {
    sharedSocket?.on(eventName, handleIncomingMessage);
  });

  sharedSocket.on("conversation_updated", (payload: RawRealtimeConversation) => {
    const normalized = normalizeRealtimeConversation(payload);
    notifySubscribers((subscriber) => subscriber.onConversationUpdated?.(normalized));
  });

  sharedSocket.on("chats_loaded", (payload: unknown) => {
    notifySubscribers((subscriber) => subscriber.onChatsLoaded?.(payload));
  });

  sharedSocket.on("conversation_snapshot", (payload: unknown) => {
    notifySubscribers((subscriber) => subscriber.onConversationSnapshot?.(payload));
  });

  sharedSocket.on("contacts_loaded", (payload: unknown) => {
    notifySubscribers((subscriber) => subscriber.onContactsLoaded?.(payload));
  });

  sharedSocket.on("ai_response", (payload: RawRealtimeMessage | RawMessageEnvelope) => {
    const normalizedMessages = resolveRealtimeMessagePayload(payload);
    normalizedMessages.forEach((normalized) => {
      notifySubscribers((subscriber) => subscriber.onAiResponse?.({
        ...normalized,
        fromMe: true,
        isAI: true,
      }));
    });
  });

  sharedSocket.on("chat_archived", (payload: { chatId?: string; conversationId?: string }) => {
    notifySubscribers((subscriber) => subscriber.onChatArchived?.(payload));
  });

  sharedSocket.on("tag_added", (payload: { chatId?: string; conversationId?: string; tag?: string }) => {
    notifySubscribers((subscriber) =>
      subscriber.onChatTagUpdated?.({
        ...payload,
        action: "add",
      }),
    );
  });

  sharedSocket.on("tag_removed", (payload: { chatId?: string; conversationId?: string; tag?: string }) => {
    notifySubscribers((subscriber) =>
      subscriber.onChatTagUpdated?.({
        ...payload,
        action: "remove",
      }),
    );
  });

  const broadcastQr = (payload: { sessionId?: string; qr?: string }) => {
    notifySubscribers((subscriber) => subscriber.onQrGenerated?.(payload));
  };

  sharedSocket.on("qr_generated", broadcastQr);
  sharedSocket.on("session_qr", broadcastQr);

  sharedSocket.on("session_connected", (payload: { sessionId?: string; phone?: string; status?: string }) => {
    notifySubscribers((subscriber) => subscriber.onSessionConnected?.(payload));
  });

  sharedSocket.on("session_disconnected", (payload: { sessionId?: string; status?: string; reason?: string }) => {
    notifySubscribers((subscriber) => subscriber.onSessionDisconnected?.(payload));
  });

  sharedSocket.on("session_deleted", (payload: { sessionId?: string; status?: string }) => {
    notifySubscribers((subscriber) => subscriber.onSessionDeleted?.(payload));
  });

  sharedSocket.on("session_status", (payload: { sessionId?: string; status?: string }) => {
    notifySubscribers((subscriber) => subscriber.onSessionStatus?.(payload));
  });

  // Message lifecycle events
  const messageDeleteEvents = ["message_deleted", "message:deleted", "messages.delete", "whatsapp:message_deleted"];
  messageDeleteEvents.forEach((eventName) => {
    sharedSocket?.on(eventName, (payload: { id?: string; messageId?: string; message_id?: string; conversationId?: string; conversation_id?: string }) => {
      const messageId = payload.id ?? payload.messageId ?? payload.message_id;
      if (messageId) {
        notifySubscribers((subscriber) => subscriber.onMessageDeleted?.({
          messageId,
          conversationId: payload.conversationId ?? payload.conversation_id,
        }));
      }
    });
  });

  const messageStatusEvents = ["message_status", "message:status", "messages.update", "whatsapp:message_status"];
  messageStatusEvents.forEach((eventName) => {
    sharedSocket?.on(eventName, (payload: { id?: string; messageId?: string; message_id?: string; status?: string; conversationId?: string; conversation_id?: string }) => {
      const messageId = payload.id ?? payload.messageId ?? payload.message_id;
      const status = payload.status;
      if (messageId && status) {
        notifySubscribers((subscriber) => subscriber.onMessageStatus?.({
          messageId,
          status,
          conversationId: payload.conversationId ?? payload.conversation_id,
        }));
      }
    });
  });

  const typingEvents = [
    "typing",
    "typing_status",
    "conversation_typing",
    "presence:update",
    "presence_update",
    "whatsapp:typing",
  ];
  typingEvents.forEach((eventName) => {
    sharedSocket?.on(
      eventName,
      (payload: {
        conversationId?: string;
        conversation_id?: string;
        chatId?: string;
        chat_id?: string;
        remoteJid?: string;
        phone?: string;
        isTyping?: boolean;
        typing?: boolean;
        status?: string;
        state?: string;
      }) => {
        const rawState = String(payload.status ?? payload.state ?? "").toLowerCase();
        const isTyping =
          typeof payload.isTyping === "boolean"
            ? payload.isTyping
            : typeof payload.typing === "boolean"
              ? payload.typing
              : rawState === "typing";

        notifySubscribers((subscriber) =>
          subscriber.onTypingStatus?.({
            conversationId:
              payload.conversationId ??
              payload.conversation_id ??
              payload.chatId ??
              payload.chat_id ??
              payload.remoteJid,
            phone: payload.phone,
            isTyping,
          }),
        );
      },
    );
  });

  eventBindingsReady = true;
}

function destroySharedSocket() {
  if (!sharedSocket) return;
  console.info(`[Socket] destroying socket subscribers=${subscribers.size}`);
  sharedSocket.removeAllListeners();
  sharedSocket.disconnect();
  sharedSocket = null;
  sharedSocketUrl = null;
  eventBindingsReady = false;
}

function resolveSocketUrl(socketUrl: string): string {
  const trimmedUrl = socketUrl.trim();
  if (/^(https?:|wss?:)/i.test(trimmedUrl)) return trimmedUrl;
  if (trimmedUrl.startsWith("//")) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
    return `${protocol}${trimmedUrl}`;
  }

  const protocol = typeof window !== "undefined" ? window.location.protocol.replace(":", "") : "https";
  return `${protocol}://${trimmedUrl}`;
}

function ensureSharedSocket(socketUrl: string): Socket {
  const normalizedUrl = resolveSocketUrl(socketUrl);

  if (sharedSocket && sharedSocketUrl === normalizedUrl) {
    return sharedSocket;
  }

  destroySharedSocket();

  // Read the persisted JWT token so the backend Socket.IO auth middleware
  // (server.js L171-193) can validate the connection.
  const session = loadAdminAuthSession();
  const token = session?.token ?? "";

  sharedSocket = io(normalizedUrl, {
    transports: ["websocket", "polling"],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30_000,
    timeout: 10_000,
    auth: { token },
  });
  sharedSocketUrl = normalizedUrl;

  // JWT token auto-refresh on every reconnect attempt.
  // Socket.IO v4: mutating socket.auth before reconnect sends fresh credentials,
  // preventing silent auth failures after JWT expiry.
  sharedSocket.io.on("reconnect_attempt", () => {
    const freshSession = loadAdminAuthSession();
    const freshToken = freshSession?.token ?? "";
    if (sharedSocket) {
      (sharedSocket as Socket & { auth: Record<string, unknown> }).auth = { token: freshToken };
    }
  });

  bindSharedSocketEvents();

  return sharedSocket;
}

export function forceReconnectInboxSocket() {
  const now = Date.now();
  if (now - lastForcedReconnectAt < MIN_FORCE_RECONNECT_INTERVAL_MS) {
    return;
  }
  lastForcedReconnectAt = now;

  const savedUrl = sharedSocketUrl;
  console.info(`[Socket] forceReconnect url=${savedUrl ?? "none"} subscribers=${subscribers.size}`);

  destroySharedSocket();

  if (!savedUrl) return;

  const socket = ensureSharedSocket(savedUrl);
  if (!socket.connected) socket.connect();
}

export function connectInboxSocket(params: {
  socketUrl: string;
  onNewMessage?: (message: RealtimeMessage) => void;
  onConversationUpdated?: (conversation: Conversation) => void;
  onChatsLoaded?: (payload: unknown) => void;
  onConversationSnapshot?: (payload: unknown) => void;
  onContactsLoaded?: (payload: unknown) => void;
  onAiResponse?: (payload: RealtimeMessage) => void;
  onChatArchived?: (payload: { chatId?: string; conversationId?: string }) => void;
  onChatTagUpdated?: (payload: { chatId?: string; conversationId?: string; tag?: string; action?: "add" | "remove" }) => void;
  onQrGenerated?: (payload: { sessionId?: string; qr?: string }) => void;
  onSessionConnected?: (payload: { sessionId?: string; phone?: string; status?: string }) => void;
  onSessionDisconnected?: (payload: { sessionId?: string; status?: string; reason?: string }) => void;
  onSessionDeleted?: (payload: { sessionId?: string; status?: string }) => void;
  onSessionStatus?: (payload: { sessionId?: string; status?: string }) => void;
  onMessageDeleted?: (payload: { messageId: string; conversationId?: string }) => void;
  onMessageStatus?: (payload: { messageId: string; status: string; conversationId?: string }) => void;
  onTypingStatus?: (payload: { conversationId?: string; phone?: string; isTyping: boolean }) => void;
  onSocketConnected?: () => void;
  onSocketDisconnected?: () => void;
  onError?: (message: string) => void;
}): () => void {
  const normalizedUrl = params.socketUrl?.trim();

  if (!normalizedUrl) {
    params.onError?.("Realtime URL indisponível");
    return () => undefined;
  }

  ensureSharedSocket(normalizedUrl);

  const subscriberId = `subscriber-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nextSubscriber: SocketSubscriber = {
    onNewMessage: params.onNewMessage,
    onConversationUpdated: params.onConversationUpdated,
    onChatsLoaded: params.onChatsLoaded,
    onConversationSnapshot: params.onConversationSnapshot,
    onContactsLoaded: params.onContactsLoaded,
    onAiResponse: params.onAiResponse,
    onChatArchived: params.onChatArchived,
    onChatTagUpdated: params.onChatTagUpdated,
    onQrGenerated: params.onQrGenerated,
    onSessionConnected: params.onSessionConnected,
    onSessionDisconnected: params.onSessionDisconnected,
    onSessionDeleted: params.onSessionDeleted,
    onSessionStatus: params.onSessionStatus,
    onMessageDeleted: params.onMessageDeleted,
    onMessageStatus: params.onMessageStatus,
    onTypingStatus: params.onTypingStatus,
    onSocketConnected: params.onSocketConnected,
    onSocketDisconnected: params.onSocketDisconnected,
    onError: params.onError,
  };

  subscribers.set(subscriberId, nextSubscriber);
  console.info(`[Socket] subscriber:added id=${subscriberId} total=${subscribers.size}`);

  if (sharedSocket?.connected) {
    nextSubscriber.onSocketConnected?.();
  }

  return () => {
    subscribers.delete(subscriberId);
    console.info(`[Socket] subscriber:removed id=${subscriberId} remaining=${subscribers.size}`);
    if (subscribers.size === 0) destroySharedSocket();
  };
}

export function emitInboxSocketEvent(event: string, payload?: unknown): boolean {
  if (!sharedSocket) return false;
  if (!sharedSocket.connected) {
    sharedSocket.connect();
  }

  sharedSocket.emit(event, payload);
  return true;
}

