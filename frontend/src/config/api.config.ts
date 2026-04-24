/**
 * ============================================================================
 * API CONFIG - DEPRECATED - USE runtime.ts
 * ============================================================================
 * 
 * Este arquivo está DEPRECATED.
 * Use src/config/runtime.ts como única fonte de verdade.
 * 
 * Mantido apenas para compatibilidade. Será removido em breve.
 * ============================================================================
 */

// Re-export from runtime.ts
export {
  API_BASE_URL,
  WS_BASE_URL,
  BUILD_ID,
  BUILD_TIME,
  ENV_NAME,
  TENANT_ID,
  DEFAULT_HEADERS as API_HEADERS,
  API_ENDPOINTS,
  buildApiUrl,
  buildHeaders,
  validateRuntimeConfig as validateApiConfig,
  getRuntimeInfo,
} from './runtime';
