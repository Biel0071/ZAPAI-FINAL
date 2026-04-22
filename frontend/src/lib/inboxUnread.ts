export const INBOX_UNREAD_EVENT = "inbox:unread-total-updated";

export function getInboxUnreadTotal(conversations: Array<{ unread?: number }>): number {
  return conversations.reduce((total, conversation) => total + (conversation.unread ?? 0), 0);
}

export function publishInboxUnreadTotal(total: number): void {
  window.dispatchEvent(new CustomEvent<number>(INBOX_UNREAD_EVENT, { detail: total }));
}
