type EventCallback = (payload: any) => void;

export type RealtimeEventType = 
  | 'FLOW_STARTED'
  | 'FLOW_STEP'
  | 'FLOW_FINISHED'
  | 'FLOW_CANCELLED'
  | 'FLOW_PAUSED'
  | 'MESSAGE_SENT'
  | 'MESSAGE_ACK'
  | 'MESSAGE_READ'
  | 'CHAT_UPDATED'
  | 'SYNC_STARTED'
  | 'SYNC_FINISHED'
  | 'CONNECTION_LOST'
  | 'CONNECTION_RESTORED'
  | 'NOTIFICATION'
  | 'PRESENCE_UPDATE';

class EventBus {
  private listeners: Map<string, Set<EventCallback>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Dispatches an event to all registered listeners.
   */
  public emit(event: RealtimeEventType, payload?: any): void {
    if (!this.listeners.has(event)) {
      return;
    }
    
    // We use setTimeout to ensure event handlers don't block the caller
    // and run asynchronously, similar to setImmediate in Node.
    setTimeout(() => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach((callback) => {
          try {
            callback(payload);
          } catch (error) {
            console.error(`[EventBus] Error in listener for ${event}:`, error);
          }
        });
      }
    }, 0);
  }

  /**
   * Subscribes a listener to an event.
   * Returns an unsubscribe function.
   */
  public on(event: RealtimeEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return the unsubscribe function for easy cleanup in useEffect
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribes a listener from an event.
   */
  public off(event: RealtimeEventType, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
}

// Export a singleton instance for global use across the frontend
export const eventBus = new EventBus();
