/**
 * ============================================================================
 * SINGLE SOURCE OF TRUTH - RUNTIME CONFIGURATION
 * ============================================================================
 * 
 * ÚNICA FONTE DE VERDADE PARA CONFIGURAÇÃO DE RUNTIME.
 * 
 * PROIBIDO:
 * - Usar window.location.origin + /api
 * - Usar fallback antigo
 * - Criar múltiplas configs
 * - Mockar endpoints
 * 
 * TODOS os requests (axios/fetch/socket) devem usar este arquivo.
 * ============================================================================
 */

// Build ID injetado pelo Vite
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;
declare const __RELEASE_LOCK_ENABLED__: boolean;
declare const __STABLE_BUILD_ID__: string;
declare const __APP_VERSION__: string;

/**
 * URL base da API - ÚNICA FONTE DE VERDADE
 * Usa window.location.origin — nginx reverse proxy cuida do roteamento
 */
export const API_BASE_URL = (() => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Retorna sempre a origem atual para que o nginx capture as rotas /api e /socket.io
    return window.location.origin;
  }
  return '';
})();

/**
 * Release lock flags
 */
export const RELEASE_LOCK_ENABLED = (() => {
  try {
    return typeof __RELEASE_LOCK_ENABLED__ !== 'undefined' ? Boolean(__RELEASE_LOCK_ENABLED__) : false;
  } catch {
    return false;
  }
})();

export const STABLE_BUILD_ID = (() => {
  try {
    return typeof __STABLE_BUILD_ID__ !== 'undefined' ? String(__STABLE_BUILD_ID__ || '') : '';
  } catch {
    return '';
  }
})();

/**
 * URL base do WebSocket - ÚNICA FONTE DE VERDADE
 */
export const WS_BASE_URL = (() => {
  const apiUrl = API_BASE_URL;
  return apiUrl.replace(/^http/, 'ws');
})();

/**
 * ID do Build - ÚNICA FONTE DE VERDADE
 */
export const BUILD_ID = (() => {
  try {
    return typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev-local';
  } catch {
    return 'dev-local';
  }
})();

export const APP_VERSION = (() => {
  try {
    if (typeof __APP_VERSION__ !== 'undefined' && String(__APP_VERSION__ || '').trim()) {
      return String(__APP_VERSION__).trim();
    }
  } catch {
    // no-op
  }

  if (STABLE_BUILD_ID) {
    return STABLE_BUILD_ID;
  }

  return BUILD_ID;
})();

/**
 * Timestamp do Build
 */
export const BUILD_TIME = (() => {
  try {
    return typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
})();

/**
 * Nome do Environment - ÚNICA FONTE DE VERDADE
 */
export const ENV_NAME = import.meta.env.MODE || 'development';

/**
 * Tenant ID - FIXO
 */
export const TENANT_ID = 'default';

/**
 * Headers padrão - ÚNICA FONTE DE VERDADE
 */
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'x-tenant-id': TENANT_ID,
};

/**
 * Endpoints da API - ÚNICA FONTE DE VERDADE
 */
export const API_ENDPOINTS = {
  // Health
  HEALTH: '/api/health',
  
  // Dashboard
  DASHBOARD: '/api/dashboard',
  
  // Conversations
  CONVERSATIONS: '/api/conversations',
  CONVERSATION: (id: string) => `/api/conversations/${id}`,
  
  // Contacts
  CONTACTS: '/api/contacts',
  CONTACT: (id: string) => `/api/contacts/${id}`,
  
  // Messages
  MESSAGES: (conversationId: string) => `/api/conversations/${conversationId}/messages`,
  MESSAGE: (conversationId: string, messageId: string) => `/api/conversations/${conversationId}/messages/${messageId}`,
  
  // Sessions
  SESSIONS: '/api/sessions',
  SESSION: (id: string) => `/api/sessions/${id}`,
  SESSION_STATUS: '/api/session-status',
  
  // System
  SYSTEM_RUNTIME_STATUS: '/api/system/runtime/status',
  SYSTEM_ERROR_LOG: '/api/system/error-log',
  
  // Metrics
  METRICS: '/metrics',
  
  // Quick Replies
  QUICK_REPLIES: '/api/quick-replies',
  QUICK_REPLY: (id: string) => `/api/quick-replies/${id}`,
} as const;

/**
 * Constrói URL completa da API
 */
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

/**
 * Constrói headers com auth
 */
export const buildHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

/**
 * Valida configuração de runtime
 */
export const validateRuntimeConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!API_BASE_URL) {
    errors.push('API_BASE_URL is empty');
  }
  
  if (!WS_BASE_URL) {
    errors.push('WS_BASE_URL is empty');
  }
  
  if (!BUILD_ID) {
    errors.push('BUILD_ID is empty');
  }

  if (!APP_VERSION) {
    errors.push('APP_VERSION is empty');
  }
  
  if (!ENV_NAME) {
    errors.push('ENV_NAME is empty');
  }
  
  if (ENV_NAME === 'production' && API_BASE_URL.includes('localhost')) {
    errors.push('Production mode cannot use localhost');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Informações de runtime para debug
 */
export const getRuntimeInfo = () => ({
  apiBaseURL: API_BASE_URL,
  wsBaseURL: WS_BASE_URL,
  buildId: BUILD_ID,
  appVersion: APP_VERSION,
  buildTime: BUILD_TIME,
  envName: ENV_NAME,
  tenantId: TENANT_ID,
  validation: validateRuntimeConfig(),
});
