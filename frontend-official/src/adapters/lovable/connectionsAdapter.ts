import type { SessionInfo } from "@/services/apiService";

export type ConnectionsLovableViewModel = {
  connected: number;
  connecting: number;
  disconnected: number;
  activeSessionName: string | null;
};

export function createConnectionsLovableViewModel(sessions: Array<SessionInfo & { status?: string }>): ConnectionsLovableViewModel {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const connected = safeSessions.filter((session) => session && (session.connected || (session.status ?? "").toLowerCase() === "connected")).length;
  const connecting = safeSessions.filter((session) => session && ["connecting", "qr", "qr_ready", "awaiting_qr"].includes((session.status ?? "").toLowerCase())).length;
  const disconnected = Math.max(0, safeSessions.length - connected - connecting);
  const activeSessionName = safeSessions.find((session) => session && (session.connected || (session.status ?? "").toLowerCase() === "connected"))?.name ?? null;
  return { connected, connecting, disconnected, activeSessionName };
}
