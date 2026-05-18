import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_AUTH_CHANGED_EVENT,
  clearAdminAuthSession,
  isAdminAuthSessionValid,
  loadAdminAuthSession,
  persistAdminAuthSession,
  type AdminAuthSession,
  type AdminSessionRole,
} from "@/lib/adminAuthSession";
import { API_ORIGIN } from "@/lib/backendConfig";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const LOGIN_TIMEOUT_MS = 12_000;

type LoginInput = {
  username: string;
  password: string;
  remember: boolean;
};

type LoginResult = {
  ok: true;
  session: AdminAuthSession;
};

let memorySession: AdminAuthSession | null = null;

function normalizeRole(value: unknown): AdminSessionRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["master", "master_admin", "owner", "superadmin"].includes(normalized)) return "master";
  if (["admin", "administrator", "manager"].includes(normalized)) return "admin";
  return "user";
}

function buildSession(
  username: string,
  role: AdminSessionRole,
  remember: boolean,
  token: string,
  tenantId?: string | null,
  companyId?: string | null,
): AdminAuthSession {
  const issuedAt = Date.now();
  const normalizedTenantId = String(tenantId ?? "").trim();
  const normalizedCompanyId = String(companyId ?? normalizedTenantId).trim();

  return {
    token,
    username,
    role,
    ...(normalizedTenantId ? { tenantId: normalizedTenantId } : {}),
    ...(normalizedCompanyId ? { companyId: normalizedCompanyId } : {}),
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_MS,
    remember,
  };
}

function normalizeToken(value: unknown): string | null {
  const token = typeof value === "string" ? value.trim() : "";
  return token.length > 0 ? token : null;
}

function parseAuthPayload(raw: unknown): {
  ok: boolean;
  role: AdminSessionRole;
  token: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  companyId: string | null;
} {
  const envelope = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const data = (envelope.data && typeof envelope.data === "object" ? envelope.data : envelope) as Record<string, unknown>;

  const token =
    normalizeToken(data.token) ??
    normalizeToken(data.accessToken) ??
    normalizeToken(data.access_token) ??
    normalizeToken(data.jwt);
  const refreshToken = normalizeToken(data.refreshToken) ?? normalizeToken(data.refresh_token);

  // The backend returns role inside a nested "user" object:
  // { success: true, token: "...", user: { username: "...", role: "master_admin" } }
  const userObj = data.user && typeof data.user === "object" ? (data.user as Record<string, unknown>) : null;
  const rawRole = data.role ?? userObj?.role;
  const tenantId = normalizeToken(data.tenantId) ?? normalizeToken(data.companyId) ?? normalizeToken(userObj?.tenantId) ?? normalizeToken(userObj?.companyId);
  const companyId = normalizeToken(data.companyId) ?? normalizeToken(data.tenantId) ?? normalizeToken(userObj?.companyId) ?? normalizeToken(userObj?.tenantId);

  const explicitOk = typeof envelope.success === "boolean" ? envelope.success : (typeof data.ok === "boolean" ? data.ok : null);
  const hasAuthTokens = Boolean(token);
  const unauthorized = data.error === "Credenciais inválidas." || data.message === "Credenciais inválidas.";
  const ok = explicitOk ?? (hasAuthTokens && !unauthorized);

  return {
    ok,
    role: normalizeRole(rawRole),
    token,
    refreshToken,
    tenantId,
    companyId,
  };
}

async function verifyCredentials(
  username: string,
  password: string,
): Promise<{
  ok: boolean;
  role: AdminSessionRole;
  token: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  companyId: string | null;
}> {
  const apiLoginCandidates = ["/api/auth/login", "/api/login", "/auth/login", "/login"];
  const requestBody = { username, password };
  const origin = API_ORIGIN?.trim();

  const tryBackendLogin = async () => {
    if (!origin) {
      throw new Error("api_origin_unavailable");
    }

    for (const endpoint of apiLoginCandidates) {
      const target = `${origin}${endpoint}`;
      try {
        const response = await fetch(target, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-tenant-id": "default",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify(requestBody),
        });

        const rawText = await response.text();
        const rawPayload = rawText
          ? (() => {
              try {
                return JSON.parse(rawText) as unknown;
              } catch {
                return { message: rawText };
              }
            })()
          : {};

        const payload = parseAuthPayload(rawPayload);
        if (response.ok && payload.ok) {
          return payload;
        }

        if (response.status === 401 || response.status === 403) {
          return { ...payload, ok: false };
        }
      } catch (err) {
        // tenta próximo endpoint
        console.warn(`[Login] Attempt failed for ${target}:`, err);
      }
    }

    throw new Error("backend_login_unavailable");
  };

  const invoke = async () => {
    throw new Error("Backend de autenticação indisponível no ambiente atual.");
  };

  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("timeout_login")), LOGIN_TIMEOUT_MS);
  });

  return Promise.race([
    (async () => {
      try {
        return await tryBackendLogin();
      } catch (error) {
        console.warn("[Login] Backend auth failed:", error);
        return invoke();
      }
    })(),
    timeout,
  ]);
}

export function useAdminAuth() {
  const [session, setSession] = useState<AdminAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const current = loadAdminAuthSession() ?? memorySession;

    if (isAdminAuthSessionValid(current)) {
      setSession(current);
      memorySession = current;
      setIsLoading(false);
      return;
    }

    clearAdminAuthSession();
    memorySession = null;
    setSession(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const onAuthChanged = () => {
      const current = loadAdminAuthSession() ?? memorySession;
      if (isAdminAuthSessionValid(current)) {
        setSession(current);
        memorySession = current;
        return;
      }

      memorySession = null;
      setSession(null);
    };

    window.addEventListener(ADMIN_AUTH_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(ADMIN_AUTH_CHANGED_EVENT, onAuthChanged);
  }, []);

  const login = useCallback(async ({ username, password, remember }: LoginInput): Promise<LoginResult> => {
    const safeUsername = username.trim();
    const safePassword = password;

    if (!safeUsername || !safePassword) {
      throw new Error("Preencha usuário e senha.");
    }

    const check = await verifyCredentials(safeUsername, safePassword);
    if (!check.ok) {
      throw new Error("Usuário ou senha inválidos.");
    }

    if (!check.token) {
      throw new Error("Resposta do servidor sem token");
    }

    const next = {
      ...buildSession(safeUsername, check.role, remember, check.token, check.tenantId, check.companyId),
      ...(check.refreshToken ? { refreshToken: check.refreshToken } : {}),
    };
    persistAdminAuthSession(next);
    memorySession = next;
    setSession(next);
    return { ok: true, session: next };
  }, []);

  const logout = useCallback(() => {
    clearAdminAuthSession();
    memorySession = null;
    setSession(null);
  }, []);

  const refresh = useCallback(() => {
    const current = loadAdminAuthSession() ?? memorySession;
    if (isAdminAuthSessionValid(current)) {
      setSession(current);
      memorySession = current;
      return;
    }

    clearAdminAuthSession();
    memorySession = null;
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      role: session?.role ?? "user",
      username: session?.username ?? null,
      isAuthenticated: Boolean(session && isAdminAuthSessionValid(session)),
      isLoading,
      login,
      logout,
      refresh,
    }),
    [session, isLoading, login, logout, refresh],
  );

  return value;
}