import type { SessionInfo } from "@/services/apiService";

export type ConnectionsLovableViewModel = {
  connected: number;
  connecting: number;
  disconnected: number;
  activeSessionName: string | null;
};

export function createConnectionsLovableViewModel(sessions: Array<SessionInfo & { status?: string }>): ConnectionsLovableViewModel {
  const connected = sessions.filter((session) => session.connected || (session.status ?? "").toLowerCase() === "connected").length;
  const connecting = sessions.filter((session) => ["connecting", "qr", "qr_ready", "awaiting_qr"].includes((session.status ?? "").toLowerCase())).length;
  const disconnected = sessions.length - connected - connecting;
  const activeSessionName = sessions.find((session) => session.connected || (session.status ?? "").toLowerCase() === "connected")?.name ?? null;
  return { connected, connecting, disconnected, activeSessionName };
}
