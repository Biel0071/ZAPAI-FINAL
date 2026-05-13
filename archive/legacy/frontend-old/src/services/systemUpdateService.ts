import { API_BASE_URL } from '@/config/runtime';

type VersionResponse = {
  version: string;
  env: string;
  uptime: string;
  uptimeSeconds: number;
  lastUpdate?: string | null;
};

type CheckUpdateResponse = {
  currentVersion: string;
  localCommit: string;
  remoteCommit: string;
  updateAvailable: boolean;
};

type UpdateResponse = {
  success: boolean;
  version?: string;
  output?: string;
  errorOutput?: string;
  error?: string;
  detail?: string;
};

function resolveAuthToken(): string {
  if (typeof window === 'undefined') return '';
  const keys = ['auth_token', 'zapai_auth_token', 'jwt_token', 'token'];
  for (const key of keys) {
    const value = String(localStorage.getItem(key) || '').trim();
    if (value) return value;
  }
  return '';
}

async function systemRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = resolveAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || `Request failed (${response.status})`);
  }

  return payload as T;
}

export function getSystemVersion(): Promise<VersionResponse> {
  return systemRequest<VersionResponse>('/api/system/version');
}

export function checkSystemUpdate(): Promise<CheckUpdateResponse> {
  return systemRequest<CheckUpdateResponse>('/api/system/check-update');
}

export function runSystemUpdate(): Promise<UpdateResponse> {
  return systemRequest<UpdateResponse>('/api/system/update', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export type { CheckUpdateResponse, UpdateResponse, VersionResponse };
