import type { ChatMessage } from "@/services/apiService";
import type { LeadIntentResult } from "@/services/leadAnalyzer";
import type { ConversationControl } from "@/services/conversationControlStore";

export type { LeadIntentResult, ConversationControl };

export type ComposerAttachment = {
  id: string;
  file: File;
  mediaType: "image" | "video" | "audio" | "file" | "sticker";
  previewUrl: string;
};

export type PreviewMediaState = {
  url: string;
  type: "image" | "video" | "audio" | "file" | "sticker";
  fileName?: string;
  messageId?: string;
};

export type MessageCacheEntry = {
  messages: ChatMessage[];
  hasMore: boolean;
  oldestCursor: string | null;
  cachedAt: number;
};

export type ConversationDraftState = {
  draftMessage: string;
  draftMedia: ComposerAttachment[];
  draftReply: ChatMessage | null;
  draftMentions: string[];
};

export type AiMemoryRecord = {
  company?: string;
  sentiment?: string;
  intent?: string;
  summary?: string;
  last_updated?: string;
  tags?: string[];
  metrics?: Record<string, number>;
};

export type InboxAiRuntime = {
  globalEnabled: boolean;
  memoryEnabled: boolean;
  provider: string;
  model: string;
  lastResponseAt: string | null;
  lastResponseTimeMs: number | null;
  promptTokens: number;
  completionTokens: number;
  loading: boolean;
  aiOn?: boolean;
};

export interface QuickReplyMediaItem {
  id?: string;
  type: "text" | "image" | "video" | "audio" | "file" | "pdf" | "document" | "sticker";
  value: string;
  filename?: string;
}

export interface QuickReplyItem {
  id: string;
  title: string;
  category: string;
  text: string;
  favorite?: boolean;
  items?: QuickReplyMediaItem[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}
