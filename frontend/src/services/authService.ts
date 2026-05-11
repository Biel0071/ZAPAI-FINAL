/**
 * ============================================================================
 * ZAPAI AUTH SERVICE
 * Centraliza toda a lógica de autenticação (JWT nativo do backend)
 * ============================================================================
 */

const TOKEN_KEY = "zapai_token";
const USER_KEY = "zapai_user";
const TENANT_ID = "default";

function getApiBase(): string {
  // Always use current origin — nginx proxies /api to backend
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

interface LoginCredentials {
  username: string;
  password: string;
  tenantId?: string;
}

interface LoginResponse {
  token: string;
  user: {
    id?: string | number;
    username: string;
    role?: string;
  };
  tenantId?: string;
  expiresAt?: number;
}

interface ApiError {
  error: string;
  message?: string;
}

function saveSession(data: LoginResponse) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.replace("/login");
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): LoginResponse["user"] | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken() && !isTokenExpired();
}

export function isTokenExpired(): boolean {
  const token = getToken();
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (typeof payload.exp === "number") {
      return Date.now() / 1000 >= payload.exp;
    }
    return false;
  } catch {
    return true;
  }
}

export function isAdmin(): boolean {
  const user = getUser();
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  return role === "master_admin" || role === "admin";
}

export async function login(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const base = getApiBase();

  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: credentials.username.trim(),
      password: credentials.password,
      tenantId: credentials.tenantId || TENANT_ID,
    }),
  });

  if (!res.ok) {
    let err: ApiError;
    try {
      err = await res.json();
    } catch {
      err = { error: "Erro desconhecido no servidor." };
    }
    throw new Error(err.error || `Erro ${res.status}`);
  }

  const data: LoginResponse = await res.json();
  if (!data.token) {
    throw new Error("Resposta do servidor sem token de autenticação.");
  }

  saveSession(data);
  return data;
}

export async function forgotPassword(email: string): Promise<void> {
  const base = getApiBase();

  const res = await fetch(`${base}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  });

  if (!res.ok) {
    let err: ApiError;
    try {
      err = await res.json();
    } catch {
      err = { error: "Erro desconhecido." };
    }
    throw new Error(err.error || `Erro ${res.status}`);
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
