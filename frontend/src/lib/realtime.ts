import { supabase, subscribeToTable } from './supabase';
import type { ChatMessage, Conversation } from '@/services/apiService';

export type RealtimeEventType = 
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE';

export interface RealtimePayload<T> {
  eventType: RealtimeEventType;
  new: T;
  old: T | null;
  errors: string[];
}

// Realtime Inbox - Subscribe to conversations
export function subscribeToConversations(
  callback: (payload: RealtimePayload<Conversation>) => void
) {
  return subscribeToTable('conversations', {}, (payload) => {
    callback(payload as RealtimePayload<Conversation>);
  });
}

// Realtime Inbox - Subscribe to messages
export function subscribeToMessages(
  conversationId: string,
  callback: (payload: RealtimePayload<ChatMessage>) => void
) {
  return supabase
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload as RealtimePayload<ChatMessage>);
      }
    )
    .subscribe();
}

// Realtime - Subscribe to WhatsApp session status
export function subscribeToSessionStatus(
  sessionId: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel(`session-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_sessions',
        filter: `id=eq.${sessionId}`,
      },
      callback
    )
    .subscribe();
}

// Realtime - Subscribe to all sessions
export function subscribeToAllSessions(
  callback: (payload: any) => void
) {
  return subscribeToTable('whatsapp_sessions', {}, callback);
}

// Broadcast helper (for backend to trigger updates)
export async function broadcastConversationUpdate(conversationId: string) {
  // This would be called from backend/edge function
  // Supabase handles this automatically via Realtime
  console.log(`Broadcasting conversation update: ${conversationId}`);
}

export async function broadcastNewMessage(messageId: string) {
  // This would be called from backend/edge function
  console.log(`Broadcasting new message: ${messageId}`);
}
