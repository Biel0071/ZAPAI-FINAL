import { ADMIN_AUTH_CHANGED_EVENT, getAdminAuthTenantId, isAdminAuthSessionValid, loadAdminAuthSession } from "./adminAuthSession";

type CacheRecord<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheRecord<unknown>>();
let authorizationRevision = 0;

export class AuthSessionChangedError extends Error {
  readonly code = "AUTH_SESSION_CHANGED";
  constructor() {
    super("A sessão de acesso mudou. Carregue os dados novamente.");
    this.name = "AuthSessionChangedError";
  }
}

export function getRequestAuthScope(): string {
  const session = loadAdminAuthSession();
  const authenticated = isAdminAuthSessionValid(session);
  // Scope contains identity metadata and an in-memory revision, never a token.
  return JSON.stringify([authenticated ? getAdminAuthTenantId(session) : null, authenticated ? session?.username : null, authenticated ? session?.issuedAt : null, authorizationRevision]);
}

export function assertRequestAuthScope(scope: string): void {
  if (scope !== getRequestAuthScope()) throw new AuthSessionChangedError();
}

function resetAuthorizationCache() {
  authorizationRevision++;
  memoryCache.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener(ADMIN_AUTH_CHANGED_EVENT, resetAuthorizationCache);
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === "zapai_admin_auth_session") resetAuthorizationCache();
  });
}

export function getCache<T>(key: string, authScope = getRequestAuthScope()): T | null {
  assertRequestAuthScope(authScope);
  const scopedKey = `${key}:auth:${authScope}`;
  const record = memoryCache.get(scopedKey);
  if (!record) return null;

  if (Date.now() > record.expiresAt) {
    memoryCache.delete(scopedKey);
    return null;
  }

  return record.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number, authScope = getRequestAuthScope()): void {
  assertRequestAuthScope(authScope);
  memoryCache.set(`${key}:auth:${authScope}`, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCache(key: string): void {
  for (const cachedKey of memoryCache.keys()) {
    if (cachedKey === key || cachedKey.startsWith(`${key}:`)) {
      memoryCache.delete(cachedKey);
    }
  }
}
