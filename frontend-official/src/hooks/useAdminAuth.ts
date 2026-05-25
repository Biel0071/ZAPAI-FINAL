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
import { getCurrentTenantId } from "@/lib/apiGuard";

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 8;
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

type ParsedAuthPayload = {
  ok: boolean;
  role: AdminSessionRole;
  token: string | null;
  refreshToken: string | null;
  username: string | null;
  tenantId: string | null;
  companyId: string | null;
  expiresAt: number | null;
};

function normalizeRole(value: unknown): AdminSessionRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["master", "master_admin", "owner", "superadmin"].includes(normalized)) return "master";
  if (["admin", "administrator", "manager"].includes(normalized)) return "admin";
  return "user";
}

function decodeJwtExpiry(token: string | null): number | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded)) as { exp?: number };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= 0) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function normalizeExpiryTimestamp(value: unknown): number | null {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
}

function buildSession(
  username: string,
  role: AdminSessionRole,
  remember: boolean,
  token: string,
  tenantId?: string | null,
  companyId?: string | null,
  expiresAt?: number | null,
): AdminAuthSession {
  const issuedAt = Date.now();
  const normalizedTenantId = String(tenantId ?? "").trim();
  const normalizedCompanyId = String(companyId ?? normalizedTenantId).trim();
  const resolvedExpiresAt =
    typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt > issuedAt
      ? expiresAt
      : decodeJwtExpiry(token) ?? issuedAt + DEFAULT_SESSION_TTL_MS;

  return {
    token,
    username,
    role,
    ...(normalizedTenantId ? { tenantId: normalizedTenantId } : {}),
    ...(normalizedCompanyId ? { companyId: normalizedCompanyId } : {}),
    issuedAt,
    expiresAt: resolvedExpiresAt,
    remember,
  };
}

function normalizeToken(value: unknown): string | null {
  const token = typeof value === "string" ? value.trim() : "";
  return token.length > 0 ? token : null;
}

function parseAuthPayload(raw: unknown): ParsedAuthPayload {
  const envelope = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const data = (envelope.data && typeof envelope.data === "object" ? envelope.data : envelope) as Record<string, unknown>;

  const token =
    normalizeToken(data.token) ??
    normalizeToken(data.accessToken) ??
    normalizeToken(data.access_token) ??
    normalizeToken(data.jwt);
  const refreshToken = normalizeToken(data.refreshToken) ?? normalizeToken(data.refresh_token);

  const userObj = data.user && typeof data.user === "object" ? (data.user as Record<string, unknown>) : null;
  const rawRole = data.role ?? userObj?.role;
  const username = normalizeToken(data.username) ?? normalizeToken(userObj?.username);

  const tenantId = normalizeToken(data.tenantId) ?? normalizeToken(data.companyId) ?? normalizeToken(userObj?.tenantId) ?? normalizeToken(userObj?.companyId);
  const companyId = normalizeToken(data.companyId) ?? normalizeToken(data.tenantId) ?? normalizeToken(userObj?.companyId) ?? normalizeToken(userObj?.tenantId);
  const expiresAt =
    normalizeExpiryTimestamp(data.expiresAt) ??
    normalizeExpiryTimestamp(data.expires_at) ??
    (() => {
      const expiresIn = Number(data.expiresIn ?? data.expires_in ?? 0);
      return Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : null;
    })() ??
    normalizeExpiryTimestamp((data as { exp?: unknown }).exp) ??
    normalizeExpiryTimestamp(userObj?.expiresAt);

  const explicitOk = typeof envelope.success === "boolean" ? envelope.success : (typeof data.ok === "boolean" ? data.ok : null);
  const hasAuthTokens = Boolean(token);
  const unauthorized = data.error === "Credenciais inválidas." || data.message === "Credenciais inválidas.";
  const ok = explicitOk ?? (hasAuthTokens && !unauthorized);

  return {
    ok,
    role: normalizeRole(rawRole),
    token,
    refreshToken,
    username,
    tenantId,
    companyId,
    expiresAt,
  };
}

async function verifyCredentials(
  username: string,
  password: string,
): Promise<ParsedAuthPayload> {
  const apiLoginCandidates = ["/api/auth/login", "/api/login", "/auth/login", "/login"];
  const tenantId = getCurrentTenantId();
  const requestBody = { username, password, tenantId, companyId: tenantId };
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
            "x-tenant-id": tenantId,
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
    const current = loadAdminAuthSession();

    if (isAdminAuthSessionValid(current)) {
      setSession(current);
      setIsLoading(false);
      return;
    }

    clearAdminAuthSession();
    setSession(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const onAuthChanged = () => {
      const current = loadAdminAuthSession();
      if (isAdminAuthSessionValid(current)) {
        setSession(current);
        return;
      }

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
      ...buildSession(
        check.username ?? safeUsername,
        check.role,
        remember,
        check.token,
        check.tenantId,
        check.companyId,
        check.expiresAt,
      ),
      ...(check.refreshToken ? { refreshToken: check.refreshToken } : {}),
    };
    persistAdminAuthSession(next);
    setSession(next);
    return { ok: true, session: next };
  }, []);

  const logout = useCallback(() => {
    clearAdminAuthSession();
    setSession(null);
  }, []);

  const refresh = useCallback(() => {
    const current = loadAdminAuthSession();
    if (isAdminAuthSessionValid(current)) {
      setSession(current);
      return;
    }

    clearAdminAuthSession();
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