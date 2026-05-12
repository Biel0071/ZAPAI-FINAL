export type AdminSessionRole = "user" | "admin" | "master";

export type AdminAuthSession = {
  token: string;
  refreshToken?: string;
  username: string;
  role: AdminSessionRole;
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

function readStorage(storage: Storage | undefined): AdminAuthSession | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminAuthSession>;
    if (!parsed || typeof parsed !== "object") return null;

    const token = String(parsed.token ?? "").trim();
    const refreshToken = String(parsed.refreshToken ?? "").trim();
    const username = String(parsed.username ?? "").trim();
    const role = String(parsed.role ?? "user").trim().toLowerCase() as AdminSessionRole;
    const issuedAt = Number(parsed.issuedAt ?? 0);
    const expiresAt = Number(parsed.expiresAt ?? 0);
    const remember = Boolean(parsed.remember);

    if (!token || !username || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
    return {
      token,
      ...(refreshToken ? { refreshToken } : {}),
      username,
      role: role === "master" || role === "admin" ? role : "user",
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