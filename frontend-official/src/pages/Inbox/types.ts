import type { ChatMessage } from "@/core/services/apiService";
import type { LeadIntentResult } from "@/core/services/leadAnalyzer";
import type { ConversationControl } from "@/core/services/conversationControlStore";

export type { LeadIntentResult, ConversationControl };

export type ComposerAttachment = {
  id: string;
  file: File;
  mediaType: "image" | "video" | "audio" | "file" | "sticker";
  previewUrl: string;
  caption?: string;
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
  providerReady?: boolean;
};

export interface QuickReplyMediaItem {
  actions?: { addTags?: string[]; archiveContact?: boolean };
  id?: string;
  type: "text" | "image" | "video" | "audio" | "file" | "pdf" | "document" | "sticker";
  value: string;
  filename?: string;
  typingMs?: number;
  typingSeconds?: number;
  delayMs?: number;
  delaySeconds?: number;
  viewOnce?: boolean;
  caption?: string;
}

export interface FlowStep {
  id: string;
  type: "text" | "image" | "video" | "audio" | "file" | "pdf" | "document" | "sticker";
  value: string;
  filename?: string;
  delayMs: number;
  delaySeconds?: number;
  typingMs?: number;
  typingSeconds?: number;
  viewOnce?: boolean;
  caption?: string;
  actions?: {
    addTags?: string[];
    archiveContact?: boolean;
  };
}

export interface QuickReplyItem {
  id: string;
  title: string;
  category: string;
  text: string;
  favorite?: boolean;
  items?: QuickReplyMediaItem[];
  tags?: string[];
  isFlow?: boolean;
  steps?: FlowStep[];
  createdAt?: string;
  updatedAt?: string;
}

export type QuickReplyCategoryAppearance = Record<string, { emoji: string; color: string }>;
