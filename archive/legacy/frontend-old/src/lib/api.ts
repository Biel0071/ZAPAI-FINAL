const DEFAULT_TENANT_ID = "default";

type JsonPayload = Record<string, unknown> | unknown[] | string | number | boolean | null;

function buildRequestOptions(options: RequestInit = {}, payload?: JsonPayload): RequestInit {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("x-tenant-id") && !headers.has("x-company-id")) {
    headers.set("x-tenant-id", DEFAULT_TENANT_ID);
  }

  if (payload !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return {
    ...options,
    headers,
    body: payload === undefined ? options.body : JSON.stringify(payload),
  };
}

async function apiRequest(url: string, options: RequestInit = {}, payload?: JsonPayload): Promise<Response> {
  return fetch(url, buildRequestOptions(options, payload));
}

export const api = {
  get: (url: string, options?: RequestInit) => apiRequest(url, { ...options, method: "GET" }),
  post: (url: string, data?: JsonPayload, options?: RequestInit) => apiRequest(url, { ...options, method: "POST" }, data),
  put: (url: string, data?: JsonPayload, options?: RequestInit) => apiRequest(url, { ...options, method: "PUT" }, data),
  patch: (url: string, data?: JsonPayload, options?: RequestInit) => apiRequest(url, { ...options, method: "PATCH" }, data),
  delete: (url: string, options?: RequestInit) => apiRequest(url, { ...options, method: "DELETE" }),
};

export async function fetchWithTenant(url: string, options?: RequestInit): Promise<Response> {
  return apiRequest(url, options);
}
