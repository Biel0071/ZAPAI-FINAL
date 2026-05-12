import { useEffect, useRef } from "react";
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

  // Impede Infinite Reconnect Loops encapsulando referências mutáveis
  const callbacksRef = useRef({
    onNewMessage,
    onConversationUpdated,
    onError,
    onSessionConnected,
    onSessionDisconnected,
    onSessionDeleted,
    onSessionStatus,
    onQrGenerated,
  });

  useEffect(() => {
    callbacksRef.current = {
      onNewMessage,
      onConversationUpdated,
      onError,
      onSessionConnected,
      onSessionDisconnected,
      onSessionDeleted,
      onSessionStatus,
      onQrGenerated,
    };
  });

  useEffect(() => {
    if (!socketUrl) return;

    const disconnect = connectInboxSocket({
      socketUrl,
      onNewMessage: (payload) => callbacksRef.current.onNewMessage(payload),
      onConversationUpdated: (conversation) => callbacksRef.current.onConversationUpdated(conversation),
      onError: (message) => callbacksRef.current.onError(message),
      onSessionConnected: (payload) => callbacksRef.current.onSessionConnected?.(payload),
      onSessionDisconnected: (payload) => callbacksRef.current.onSessionDisconnected?.(payload),
      onSessionDeleted: (payload) => callbacksRef.current.onSessionDeleted?.(payload),
      onSessionStatus: (payload) => callbacksRef.current.onSessionStatus?.(payload),
      onQrGenerated: (payload) => callbacksRef.current.onQrGenerated?.(payload),
    });

    return () => disconnect();
  }, [socketUrl]);
}
