import type { SessionItem } from "@/stores/appStore";

export function getSessionId(input: any): string {
  return String(
    input?.id ??
    input?.sessionId ??
    input?.session_id ??
    input?.name ??
    input?.session ??
    ""
  );
}

export function normalizeSessionStatus(input: any): SessionItem["status"] {
  const raw = String(
    input?.status ??
    input?.state ??
    input?.connectionStatus ??
    input?.sessionStatus ??
    ""
  ).toLowerCase();

  if (["connected", "open", "online", "ready"].includes(raw)) return "connected";
  if (["connecting", "initializing", "starting"].includes(raw)) return "connecting";
  if (["qr", "qrcode", "qr_ready", "pending_qr"].includes(raw)) return "qr";
  if (["disconnected", "close", "closed", "offline"].includes(raw)) return "disconnected";
  if (["error", "failed"].includes(raw)) return "error";

  return "unknown";
}

export function normalizeSession(input: any): SessionItem {
  return {
    id: getSessionId(input),
    name: String(input?.name ?? input?.sessionName ?? input?.session ?? input?.id ?? ""),
    phone: input?.phone ?? input?.wid ?? input?.number ?? null,
    profilePicture: input?.profilePicture ?? input?.profilePictureUrl ?? input?.profile_picture_url ?? input?.avatar ?? null,
    pushName: input?.pushName ?? input?.displayName ?? input?.contactName ?? null,
    status: normalizeSessionStatus(input),
    updatedAt: input?.updatedAt ?? input?.lastUpdate ?? null,
    raw: input,
  };
}
