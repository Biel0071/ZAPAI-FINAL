/**
 * API CONFIG SHIM
 * 
 * Fonte oficial: src/config/runtime.ts
 * Este arquivo existe apenas para evitar imports quebrados durante transição.
 */

export {
  API_BASE_URL,
  WS_BASE_URL,
  BUILD_ID,
  BUILD_TIME,
  APP_VERSION,
  RELEASE_LOCK_ENABLED,
  STABLE_BUILD_ID,
  ENV_NAME,
  TENANT_ID,
  DEFAULT_HEADERS as API_HEADERS,
  API_ENDPOINTS,
  buildApiUrl,
  buildHeaders,
  validateRuntimeConfig as validateApiConfig,
  getRuntimeInfo,
} from './runtime';
