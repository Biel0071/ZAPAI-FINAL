import { describe, expect, it } from 'vitest';
import { sortMessagesAsc } from '@/pages/Inbox/utils';
import { useAppStore } from '@/state/stores/appStore';

describe('WhatsApp message ordering', () => {
  it('orders original ISO, Unix seconds and Unix milliseconds consistently', () => {
    const messages = [
      { id: 'seconds', content: 'second', fromMe: false, timestamp: 1791280801, createdAt: '' },
      { id: 'iso', content: 'first', fromMe: false, timestamp: new Date(1791280800000).toISOString(), createdAt: '' },
      { id: 'milliseconds', content: 'third', fromMe: false, timestamp: 1791280802000, createdAt: '' },
    ];
    expect(sortMessagesAsc(messages).map(message => message.id)).toEqual(['iso', 'seconds', 'milliseconds']);
  });
  it('keeps imported and realtime messages in source order after a live update', () => {
    const store = useAppStore.getState();
    store.setMessages('chat-ordering', [
      { id: 'later', conversationId: 'chat-ordering', content: 'later', fromMe: false, timestamp: '2026-10-06T10:00:00Z', createdAt: '2026-10-06T10:00:00Z' },
      { id: 'earlier', conversationId: 'chat-ordering', content: 'earlier', fromMe: false, timestamp: '2026-10-01T10:00:00Z', createdAt: '2026-10-06T11:00:00Z' },
    ]);
    store.addMessage('chat-ordering', { id: 'new', conversationId: 'chat-ordering', content: 'new', fromMe: false, timestamp: '2026-10-06T12:00:00Z', createdAt: '2026-10-06T12:00:00Z' });
    expect(useAppStore.getState().messagesByConversationId['chat-ordering'].map(message => message.id)).toEqual(['earlier', 'later', 'new']);
  });
});
