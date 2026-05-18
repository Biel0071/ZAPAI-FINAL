import { isAdminAuthSessionValid, loadAdminAuthSession } from "@/lib/adminAuthSession";

export const FIXED_TENANT_ID = "default";

export const REQUIRED_API_ENDPOINTS = [
  "/api/health",
  "/api/conversations",
  "/api/contacts",
  "/api/session-status",
  "/api/metrics",
] as const;

export const PUBLISH_BLOCKER_ENDPOINTS = ["/api/health", "/api/conversations"] as const;

async function readAccessToken(): Promise<{ token: string | null; tenantId: string }> {
  const adminSession = loadAdminAuthSession();
  if (isAdminAuthSessionValid(adminSession) && adminSession?.token) {
    const tenantId = String(adminSession.tenantId ?? adminSession.companyId ?? FIXED_TENANT_ID).trim() || FIXED_TENANT_ID;
    return { token: adminSession.token, tenantId };
  }

  return { token: null, tenantId: FIXED_TENANT_ID };
}

export async function buildApiHeaders(): Promise<Record<string, string>> {
  const { token, tenantId } = await readAccessToken();

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-tenant-id": tenantId,
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
