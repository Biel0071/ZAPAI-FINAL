// API adapter for backend requests with automatic tenant header injection

const DEFAULT_TENANT_ID = 'default';

interface RequestInitWithHeaders extends RequestInit {
  headers?: HeadersInit;
}

async function apiRequest(
  url: string,
  options: RequestInitWithHeaders = {}
): Promise<Response> {
  // Ensure headers object exists
  const headers = new Headers(options.headers || {});
  
  // Add tenant header if not present
  if (!headers.has('x-tenant-id') && !headers.has('x-company-id')) {
    headers.set('x-tenant-id', DEFAULT_TENANT_ID);
  }
  
  // Ensure content-type for POST/PUT/PATCH with body
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  
  const requestOptions: RequestInit = {
    ...options,
    headers,
  };
  
  return fetch(url, requestOptions);
}

export const api = {
  get: (url: string, options?: RequestInit) => apiRequest(url, { ...options, method: 'GET' }),
  post: (url: string, data?: any, options?: RequestInit) => 
    apiRequest(url, { ...options, method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: (url: string, data?: any, options?: RequestInit) => 
    apiRequest(url, { ...options, method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: (url: string, data?: any, options?: RequestInit) => 
    apiRequest(url, { ...options, method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: (url: string, options?: RequestInit) => apiRequest(url, { ...options, method: 'DELETE' }),
};

// Export the base fetch function with tenant header for backward compatibility
export async function fetchWithTenant(url: string, options?: RequestInit): Promise<Response> {
  return apiRequest(url, options);
}
