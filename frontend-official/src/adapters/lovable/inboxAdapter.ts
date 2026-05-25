import type { Conversation, ChatMessage } from "@/services/apiService";

export type InboxLovableViewModel = {
  conversationCount: number;
  selectedConversationId: string | null;
  selectedMessageCount: number;
};

export function createInboxLovableViewModel(params: {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: ChatMessage[];
}): InboxLovableViewModel {
  const { conversations, selectedConversation, messages } = params;
  return {
    conversationCount: conversations.length,
    selectedConversationId: selectedConversation?.id ?? null,
    selectedMessageCount: messages.length,
  };
}
