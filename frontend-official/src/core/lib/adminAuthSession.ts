export type AdminSessionRole = "user" | "admin" | "master";

export type AdminAuthSession = {
  token: string;
  refreshToken?: string;
  username: string;
  role: AdminSessionRole;
  tenantId?: string;
  companyId?: string;
  issuedAt: number;
  expiresAt: number;
  remember: boolean;
};

const SESSION_KEY = "zapai_admin_auth_session";
export const ADMIN_AUTH_CHANGED_EVENT = "zapai-admin-auth-changed";

function emitAdminAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_AUTH_CHANGED_EVENT));
}

function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readStorage(storage: Storage | undefined): AdminAuthSession | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) {
      const fallbackToken = String(
        storage.getItem("auth_token") ||
        storage.getItem("token") ||
        storage.getItem("zapflow_token") ||
        ""
      ).trim();
      if (!fallbackToken) return null;
      const claims = parseJwtPayload(fallbackToken);
      const username = String(claims?.username || claims?.sub || "admin").trim();
      const tenantId = String(claims?.tenantId || claims?.companyId || "default").trim();
      const issuedAt = Number(claims?.iat ? claims.iat * 1000 : Date.now());
      const expiresAt = Number(claims?.exp ? claims.exp * 1000 : Date.now() + 86400 * 7 * 1000);
      const role = String(claims?.role || "admin").trim().toLowerCase() as AdminSessionRole;
      return {
        token: fallbackToken,
        username,
        role: role === "master" || role === "admin" ? role : "user",
        tenantId,
        companyId: tenantId,
        issuedAt,
        expiresAt,
        remember: true,
      };
    }
    const parsed = JSON.parse(raw) as Partial<AdminAuthSession>;
    if (!parsed || typeof parsed !== "object") return null;

    const token = String(parsed.token ?? "").trim();
    const refreshToken = String(parsed.refreshToken ?? "").trim();
    const username = String(parsed.username ?? "").trim();
    const role = String(parsed.role ?? "user").trim().toLowerCase() as AdminSessionRole;
    const tenantId = String(parsed.tenantId ?? "").trim();
    const companyId = String(parsed.companyId ?? "").trim();
    const issuedAt = Number(parsed.issuedAt ?? 0);
    const expiresAt = Number(parsed.expiresAt ?? 0);
    const remember = Boolean(parsed.remember);

    if (!token || !username || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
    return {
      token,
      ...(refreshToken ? { refreshToken } : {}),
      username,
      role: role === "master" || role === "admin" ? role : "user",
      ...(tenantId ? { tenantId } : {}),
      ...(companyId ? { companyId } : {}),
      issuedAt,
      expiresAt,
      remember,
    };
  } catch {
    return null;
  }
}

export function loadAdminAuthSession(): AdminAuthSession | null {
  if (typeof window === "undefined") return null;

  const fromLocal = readStorage(window.localStorage);
  if (fromLocal) return fromLocal;
  return readStorage(window.sessionStorage);
}

export function isAdminAuthSessionValid(session: AdminAuthSession | null): boolean {
  if (!session) return false;
  return session.expiresAt > Date.now();
}

export function getAdminAuthTenantId(session: AdminAuthSession | null | undefined): string | null {
  const tenantId = String(session?.tenantId ?? session?.companyId ?? "").trim();
  return tenantId || null;
}

export function persistAdminAuthSession(session: AdminAuthSession) {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(session);
  if (session.remember) {
    window.localStorage.setItem(SESSION_KEY, serialized);
    window.sessionStorage.removeItem(SESSION_KEY);
    emitAdminAuthChanged();
    return;
  }

  window.sessionStorage.setItem(SESSION_KEY, serialized);
  window.localStorage.removeItem(SESSION_KEY);
  emitAdminAuthChanged();
}

export function clearAdminAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  emitAdminAuthChanged();
}