import { buildApiHeaders } from "@/lib/apiGuard";
import { WS_CHANNELS } from "@/services/masterNodeService";

type WsChannel = keyof typeof WS_CHANNELS;

type MessageHandler = (payload: unknown) => void;

type Subscription = {
  channel: WsChannel;
  handler: MessageHandler;
};

const subscribers = new Map<WsChannel, Set<MessageHandler>>();
const sockets = new Map<WsChannel, WebSocket>();
const reconnectTimers = new Map<WsChannel, number>();
const reconnectAttempts = new Map<WsChannel, number>();

const BASE_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 20_000;

function resolveWsUrl(path: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

function notifyChannel(channel: WsChannel, payload: unknown) {
  const handlers = subscribers.get(channel);
  if (!handlers) return;
  handlers.forEach((handler) => handler(payload));
}

async function connect(channel: WsChannel) {
  const existing = sockets.get(channel);
  if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;

  const headers = await buildApiHeaders();
  const query = new URLSearchParams({
    tenant: headers["x-tenant-id"] ?? "main",
  });

  const url = `${resolveWsUrl(WS_CHANNELS[channel])}?${query.toString()}`;
  const ws = new WebSocket(url);

  ws.onmessage = (event) => {
    try {
      notifyChannel(channel, JSON.parse(event.data));
    } catch {
      notifyChannel(channel, event.data);
    }
  };

  ws.onclose = () => {
    sockets.delete(channel);

    const channelHandlers = subscribers.get(channel);
    if (!channelHandlers || channelHandlers.size === 0) {
      const timer = reconnectTimers.get(channel);
      if (timer) {
        window.clearTimeout(timer);
        reconnectTimers.delete(channel);
      }
      reconnectAttempts.delete(channel);
      return;
    }

    const previousTimer = reconnectTimers.get(channel);
    if (previousTimer) {
      window.clearTimeout(previousTimer);
      reconnectTimers.delete(channel);
    }

    const attempts = (reconnectAttempts.get(channel) ?? 0) + 1;
    reconnectAttempts.set(channel, attempts);
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (attempts - 1), MAX_RECONNECT_DELAY_MS);

    const timer = window.setTimeout(() => {
      reconnectTimers.delete(channel);
      void connect(channel);
    }, delay);
    reconnectTimers.set(channel, timer);
  };

  ws.onerror = () => {
    ws.close();
  };

  sockets.set(channel, ws);

  ws.onopen = () => {
    reconnectAttempts.delete(channel);
    const timer = reconnectTimers.get(channel);
    if (timer) {
      window.clearTimeout(timer);
      reconnectTimers.delete(channel);
    }
  };
}

export const masterWebsocketService = {
  async subscribe(channel: WsChannel, handler: MessageHandler): Promise<Subscription> {
    const channelHandlers = subscribers.get(channel) ?? new Set<MessageHandler>();
    channelHandlers.add(handler);
    subscribers.set(channel, channelHandlers);
    await connect(channel);
    return { channel, handler };
  },

  unsubscribe(subscription: Subscription) {
    const channelHandlers = subscribers.get(subscription.channel);
    if (!channelHandlers) return;

    channelHandlers.delete(subscription.handler);
    if (channelHandlers.size === 0) {
      subscribers.delete(subscription.channel);
      const socket = sockets.get(subscription.channel);
      if (socket) {
        socket.close();
        sockets.delete(subscription.channel);
      }
      const timer = reconnectTimers.get(subscription.channel);
      if (timer) {
        window.clearTimeout(timer);
        reconnectTimers.delete(subscription.channel);
      }
      reconnectAttempts.delete(subscription.channel);
    }
  },
};
