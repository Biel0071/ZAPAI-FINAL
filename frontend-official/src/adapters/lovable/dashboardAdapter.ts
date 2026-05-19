import type { Conversation, MetricsSummary, SessionInfo } from "@/services/apiService";

export type DashboardLovableViewModel = {
  activeChats: number;
  newLeads: number;
  activeSessions: number;
  totalSessions: number;
  runtimeStatus: "online" | "offline" | "warning";
  websocketHealthy: boolean;
};

export function createDashboardLovableViewModel(params: {
  conversations: Conversation[];
  metrics: MetricsSummary | null;
  sessions: SessionInfo[];
  runtimeStatus: "online" | "offline" | "reconnecting";
}): DashboardLovableViewModel {
  const { conversations, metrics, sessions, runtimeStatus } = params;
  const activeSessions = sessions.filter((session) => session.connected || (session.status ?? "").toLowerCase() === "connected").length;
  return {
    activeChats: Number(metrics?.activeChats ?? metrics?.chats ?? conversations.length ?? 0),
    newLeads: Number(metrics?.newLeads ?? metrics?.leads ?? 0),
    activeSessions,
    totalSessions: sessions.length,
    runtimeStatus: runtimeStatus === "online" ? "online" : runtimeStatus === "reconnecting" ? "warning" : "offline",
    websocketHealthy: runtimeStatus === "online",
  };
}
