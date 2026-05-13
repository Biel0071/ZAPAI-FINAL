/**
 * ============================================================================
 * HARD RESET CACHE
 * ============================================================================
 * 
 * Limpa todo cache legado no boot da aplicação.
 * Detecta build antigo e força reload.
 * ============================================================================
 */

import { APP_VERSION, ENV_NAME } from '@/config/runtime';

const CACHE_RESET_KEY = `zapai_cache_reset_${APP_VERSION}`;
let cacheResetInitialized = false;
let cacheResetInitPromise: Promise<void> | null = null;

const LEGACY_VERSION_KEYS = [
  'zapai_last_build_id',
  'zapai_build_id',
  'zapai_stable_build_id',
  'zapai_runtime_build_source',
  'zapai_runtime_build_origin',
  'zapai_preview_build',
  'zapai_legacy_source',
  'zapai_version_switch',
  'zapai_auto_rollback',
  'zapai_release_candidate',
];

/**
 * Limpa localStorage legado
 */
export const clearLocalStorage = (): void => {
  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const normalized = key.toLowerCase();
      const isLegacyVersionKey =
        LEGACY_VERSION_KEYS.includes(key) ||
        normalized.includes('build') ||
        normalized.includes('version') ||
        normalized.includes('rollback') ||
        normalized.includes('legacy') ||
        normalized.includes('preview');

      if (isLegacyVersionKey) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[CacheReset] Removed ${keysToRemove.length} localStorage items`);
  } catch (e) {
    console.error('[CacheReset] Error clearing localStorage:', e);
  }
};

/**
 * Limpa sessionStorage legado
 */
export const clearSessionStorage = (): void => {
  try {
    sessionStorage.clear();
    console.log('[CacheReset] Cleared sessionStorage');
  } catch (e) {
    console.error('[CacheReset] Error clearing sessionStorage:', e);
  }
};

/**
 * Unregister service worker
 */
export const unregisterServiceWorkers = async (): Promise<void> => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
        console.log('[CacheReset] Unregistered service worker');
      }
    }
  } catch (e) {
    console.error('[CacheReset] Error unregistering service workers:', e);
  }
};

/**
 * Limpa caches antigos
 */
export const clearCaches = async (): Promise<void> => {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`[CacheReset] Deleted cache: ${cacheName}`);
      }
    }
  } catch (e) {
    console.error('[CacheReset] Error clearing caches:', e);
  }
};

/**
 * Executa hard reset completo
 */
export const executeHardReset = async (): Promise<void> => {
  console.log('[CacheReset] Starting hard reset...');
  console.log(`[CacheReset] App Version: ${APP_VERSION}`);
  console.log(`[CacheReset] Environment: ${ENV_NAME}`);
  
  // Em produção, executar reset completo
  if (ENV_NAME === 'production') {
    await unregisterServiceWorkers();
    await clearCaches();
    clearLocalStorage();
    clearSessionStorage();
    
    // Marcar como resetado
    localStorage.setItem(CACHE_RESET_KEY, Date.now().toString());
  }
  
  console.log('[CacheReset] Hard reset complete');
};

/**
 * Verifica se reset já foi executado
 */
export const wasResetExecuted = (): boolean => {
  try {
    const resetTime = localStorage.getItem(CACHE_RESET_KEY);
    if (!resetTime) return false;
    
    // Reset foi há mais de 24h, executar novamente
    const resetDate = new Date(parseInt(resetTime));
    const now = new Date();
    const hoursSinceReset = (now.getTime() - resetDate.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceReset < 24;
  } catch {
    return false;
  }
};

/**
 * Inicializa reset no boot
 */
export const initializeCacheReset = async (): Promise<void> => {
  if (cacheResetInitialized) {
    return;
  }

  if (cacheResetInitPromise) {
    return cacheResetInitPromise;
  }

  cacheResetInitPromise = (async () => {
    // Em produção, executar limpeza de legado uma vez por versão oficial
    if (ENV_NAME === 'production' && !wasResetExecuted()) {
      await executeHardReset();
    }

    cacheResetInitialized = true;
  })().finally(() => {
    cacheResetInitPromise = null;
  });

  return cacheResetInitPromise;
};
