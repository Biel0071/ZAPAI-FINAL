export interface Contact {
  id: string;
  phone: string;
  name?: string;
  email?: string;
}

export interface SessionStatus {
  sessionId: string;
  sessionName: string;
  status: string;
  phone?: string;
  connected?: boolean;
}

export interface QuickReply {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
}

export interface Conversation {
  id: string;
  phone: string;
  name?: string;
  contactName?: string;
  lastMessage?: string;
  status?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  phone: string;
  text: string;
  direction: 'inbound' | 'outbound';
  sender: 'customer' | 'agent' | 'bot';
  type: string;
  status: string;
  createdAt: string;
}
