/**
 * ============================================================================
 * HARD RESET CACHE
 * ============================================================================
 * 
 * Limpa todo cache legado no boot da aplicação.
 * Detecta build antigo e força reload.
 * ============================================================================
 */

import { BUILD_ID, ENV_NAME } from '@/config/runtime';

const CACHE_RESET_KEY = 'zapai_cache_reset';
const LAST_BUILD_KEY = 'zapai_last_build_id';

/**
 * Limpa localStorage legado
 */
export const clearLocalStorage = (): void => {
  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.startsWith('zapai_')) {
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
 * Detecta mudança de build e força reload
 */
export const detectBuildChange = (): boolean => {
  try {
    const lastBuildId = localStorage.getItem(LAST_BUILD_KEY);
    const currentBuildId = BUILD_ID;
    
    if (lastBuildId && lastBuildId !== currentBuildId) {
      console.log(`[CacheReset] Build changed from ${lastBuildId} to ${currentBuildId}`);
      localStorage.setItem(LAST_BUILD_KEY, currentBuildId);
      return true;
    }
    
    if (!lastBuildId) {
      localStorage.setItem(LAST_BUILD_KEY, currentBuildId);
    }
    
    return false;
  } catch (e) {
    console.error('[CacheReset] Error detecting build change:', e);
    return false;
  }
};

/**
 * Executa hard reset completo
 */
export const executeHardReset = async (): Promise<void> => {
  console.log('[CacheReset] Starting hard reset...');
  console.log(`[CacheReset] Build ID: ${BUILD_ID}`);
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
  
  // Detectar mudança de build
  const buildChanged = detectBuildChange();
  
  if (buildChanged) {
    console.log('[CacheReset] Build changed, forcing reload...');
    window.location.reload();
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
  // Em produção, sempre executar reset no primeiro load
  if (ENV_NAME === 'production' && !wasResetExecuted()) {
    await executeHardReset();
  }
  
  // Detectar mudança de build em qualquer ambiente
  const buildChanged = detectBuildChange();
  if (buildChanged) {
    console.log('[CacheReset] Build changed, reloading...');
    window.location.reload();
  }
};
