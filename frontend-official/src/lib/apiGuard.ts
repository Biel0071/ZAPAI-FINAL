import { getAdminAuthTenantId, isAdminAuthSessionValid, loadAdminAuthSession } from "@/lib/adminAuthSession";

export const DEFAULT_TENANT_ID = "default";

export const REQUIRED_API_ENDPOINTS = [
  "/api/health",
  "/api/conversations",
  "/api/contacts",
  "/api/session-status",
  "/api/metrics",
] as const;

export const PUBLISH_BLOCKER_ENDPOINTS = ["/api/health", "/api/conversations"] as const;

export function getCurrentTenantId(): string {
  const session = loadAdminAuthSession();
  return getAdminAuthTenantId(session) ?? DEFAULT_TENANT_ID;
}

async function readAccessToken(): Promise<string | null> {
  // Always prefer the admin auth session (backend JWT) over Supabase
  const adminSession = loadAdminAuthSession();
  if (isAdminAuthSessionValid(adminSession) && adminSession?.token) {
    return adminSession.token;
  }

  // Fallback: try Supabase session (only in environments where Supabase is configured)
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function buildApiHeaders(): Promise<Record<string, string>> {
  const token = await readAccessToken();

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-tenant-id": getCurrentTenantId(),
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
