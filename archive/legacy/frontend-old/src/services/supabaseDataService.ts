import { supabase, withCompanyFilter } from '@/lib/supabase';
import type { Conversation, ChatMessage, Contact } from '@/services/apiService';

// Conversations - Supabase Direct
export const supabaseDataService = {
  async getConversations(limit = 50) {
    let query = supabase
      .from('conversations')
      .select(`
        *,
        contact:contacts(*)
      `)
      .order('updated_at', { ascending: false })
      .limit(limit);

    query = withCompanyFilter(query);

    const { data, error } = await query;

    if (error) throw error;

    return data.map((item: any) => ({
      id: item.id,
      contactId: item.contact_id,
      sessionId: item.session_id,
      companyId: item.company_id,
      contactName: item.contact?.name || item.id,
      avatar: item.contact?.avatar_url,
      lastMessage: item.last_message,
      updatedAt: item.updated_at,
      phone: item.id,
      unread: item.unread_count,
      status: item.status,
      tags: item.tags,
      isAI: item.ai_enabled,
      lastMessageType: 'text',
    })) as Conversation[];
  },

  async getConversation(conversationId: string) {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('id', conversationId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      contactId: data.contact_id,
      sessionId: data.session_id,
      contactName: data.contact?.name || data.id,
      avatar: data.contact?.avatar_url,
      lastMessage: data.last_message,
      updatedAt: data.updated_at,
      phone: data.id,
      unread: data.unread_count,
      status: data.status,
      tags: data.tags,
      isAI: data.ai_enabled,
    } as Conversation;
  },

  async getMessages(conversationId: string, limit = 50) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map((item: any) => ({
      id: item.id,
      conversationId: item.conversation_id,
      content: item.content,
      caption: item.caption,
      fromMe: item.from_me,
      createdAt: item.timestamp,
      status: item.status,
      isAI: item.is_ai,
      mediaType: item.media_type,
      mediaUrl: item.media_url,
      url: item.media_url,
    })) as ChatMessage[];
  },

  async getContacts() {
    let query = supabase
      .from('contacts')
      .select('*')
      .order('updated_at', { ascending: false });

    query = withCompanyFilter(query);

    const { data, error } = await query;

    if (error) throw error;

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      phone: item.phone,
      status: 'active',
    })) as Contact[];
  },

  async getContact(phone: string) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      status: 'active',
    } as Contact;
  },

  async createContact(contact: { phone: string; name?: string; tags?: string[] }) {
    const { data, error } = await supabase
      .from('contacts')
      .upsert({
        phone: contact.phone,
        name: contact.name,
        tags: contact.tags || [],
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      status: 'active',
    } as Contact;
  },

  async updateConversation(conversationId: string, updates: Partial<Conversation>) {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        last_message: updates.lastMessage,
        unread_count: updates.unread,
        status: updates.status,
        tags: updates.tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async markConversationAsRead(conversationId: string) {
    const { error } = await supabase
      .from('conversations')
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) throw error;
  },

  // WhatsApp Sessions
  async getSessions() {
    let query = supabase
      .from('whatsapp_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    query = withCompanyFilter(query);

    const { data, error } = await query;

    if (error) throw error;

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      phone: item.phone,
      connected: item.status === 'connected',
      status: item.status,
    }));
  },

  async getSession(sessionId: string) {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      connected: data.status === 'connected',
      status: data.status,
      qrCode: data.qr_code,
    };
  },

  async updateSessionStatus(sessionId: string, status: string, phone?: string) {
    const { error } = await supabase
      .from('whatsapp_sessions')
      .update({
        status,
        phone: phone || undefined,
        qr_code: status === 'qr_ready' ? null : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;
  },
};
