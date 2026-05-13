import { useEffect } from "react";
import { connectInboxSocket } from "@/services/socketService";
import type { ChatMessage, Conversation } from "@/services/apiService";

type RealtimeMessage = ChatMessage & {
  conversationId?: string;
  contactId?: string;
  sessionId?: string;
  phone?: string;
  messageType?: "text" | "image" | "video" | "audio" | "file";
};

type UseSocketMessagesParams = {
  socketUrl: string | null;
  onNewMessage: (payload: RealtimeMessage) => void;
  onConversationUpdated: (conversation: Conversation) => void;
  onError: (message: string) => void;
  onSessionConnected?: (payload: { sessionId?: string; phone?: string; status?: string }) => void;
  onSessionDisconnected?: (payload: { sessionId?: string; status?: string; reason?: string }) => void;
  onSessionDeleted?: (payload: { sessionId?: string; status?: string }) => void;
  onSessionStatus?: (payload: { sessionId?: string; status?: string }) => void;
  onQrGenerated?: (payload: { sessionId?: string; qr?: string }) => void;
};

export function useSocketMessages(params: UseSocketMessagesParams) {
  const {
    socketUrl,
    onNewMessage,
    onConversationUpdated,
    onError,
    onSessionConnected,
    onSessionDisconnected,
    onSessionDeleted,
    onSessionStatus,
    onQrGenerated,
  } = params;

  useEffect(() => {
    if (!socketUrl) return;

    const disconnect = connectInboxSocket({
      socketUrl,
      onNewMessage,
      onConversationUpdated,
      onError,
      onSessionConnected,
      onSessionDisconnected,
      onSessionDeleted,
      onSessionStatus,
      onQrGenerated,
    });

    return () => disconnect();
  }, [
    socketUrl,
    onNewMessage,
    onConversationUpdated,
    onError,
    onSessionConnected,
    onSessionDisconnected,
    onSessionDeleted,
    onSessionStatus,
    onQrGenerated,
  ]);
}
