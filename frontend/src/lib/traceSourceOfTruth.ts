/**
 * ============================================================================
 * TRACE SOURCE OF TRUTH
 * ============================================================================
 * 
 * Mapeia todas as fontes de verdade do sistema.
 * Garante single source of truth.
 * ============================================================================
 */

// Build ID injetado pelo Vite
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;

export interface TraceInfo {
  buildId: string;
  buildTime: string;
  frontendSource: string;
  jsBundle: string;
  cssBundle: string;
  apiOrigin: string;
  websocketOrigin: string;
  storageValues: Record<string, any>;
  serviceWorker: {
    registered: boolean;
    active: boolean;
    controlled: boolean;
    state: string;
  };
  cacheKeys: string[];
  environment: string;
}

export class SourceOfTruthTrace {
  private static instance: SourceOfTruthTrace;
  private traceInfo: TraceInfo | null = null;

  private constructor() {}

  static getInstance(): SourceOfTruthTrace {
    if (!SourceOfTruthTrace.instance) {
      SourceOfTruthTrace.instance = new SourceOfTruthTrace();
    }
    return SourceOfTruthTrace.instance;
  }

  async traceAll(): Promise<TraceInfo> {
    const traceInfo: TraceInfo = {
      buildId: this.getBuildId(),
      buildTime: this.getBuildTime(),
      frontendSource: this.getFrontendSource(),
      jsBundle: this.getJSBundle(),
      cssBundle: this.getCSSBundle(),
      apiOrigin: this.getAPIOrigin(),
      websocketOrigin: this.getWebsocketOrigin(),
      storageValues: this.getStorageValues(),
      serviceWorker: await this.getServiceWorkerStatus(),
      cacheKeys: await this.getCacheKeys(),
      environment: this.getEnvironment(),
    };

    this.traceInfo = traceInfo;
    return traceInfo;
  }

  private getBuildId(): string {
    try {
      return typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getBuildTime(): string {
    try {
      return typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getFrontendSource(): string {
    try {
      // URL atual
      return window.location.origin + window.location.pathname;
    } catch {
      return 'unknown';
    }
  }

  private getJSBundle(): string {
    try {
      // Primeiro script carregado
      const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
      const mainScript = scripts.find(s => s.src.includes('index')) || scripts[0];
      return mainScript?.src || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getCSSBundle(): string {
    try {
      // Primeiro link CSS carregado
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
      const mainLink = links.find(l => l.href.includes('index')) || links[0];
      return mainLink?.href || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getAPIOrigin(): string {
    try {
      return typeof window !== 'undefined' ? window.location.origin : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getWebsocketOrigin(): string {
    try {
      if (typeof window !== 'undefined') {
        return window.location.origin.replace(/^http/, 'ws');
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getStorageValues(): Record<string, any> {
    const values: Record<string, any> = {};

    try {
      // LocalStorage
      values.localStorage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          values.localStorage[key] = localStorage.getItem(key);
        }
      }
    } catch (e) {
      values.localStorage = 'access denied';
    }

    try {
      // SessionStorage
      values.sessionStorage = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          values.sessionStorage[key] = sessionStorage.getItem(key);
        }
      }
    } catch (e) {
      values.sessionStorage = 'access denied';
    }

    try {
      // Cookies
      values.cookies = document.cookie;
    } catch (e) {
      values.cookies = 'access denied';
    }

    return values;
  }

  private async getServiceWorkerStatus(): Promise<TraceInfo['serviceWorker']> {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          return {
            registered: true,
            active: !!registration.active,
            controlled: !!navigator.serviceWorker.controller,
            state: registration.active?.state || 'unknown',
          };
        }
      }
      return {
        registered: false,
        active: false,
        controlled: false,
        state: 'not registered',
      };
    } catch (e) {
      return {
        registered: false,
        active: false,
        controlled: false,
        state: 'error',
      };
    }
  }

  private async getCacheKeys(): Promise<string[]> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        return cacheNames;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  private getEnvironment(): string {
    try {
      return import.meta.env.MODE || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  getTraceInfo(): TraceInfo | null {
    return this.traceInfo;
  }

  validateSingleSourceOfTruth(): boolean {
    if (!this.traceInfo) {
      return false;
    }

    // Validar se API origin é consistente
    const apiOrigin = this.traceInfo.apiOrigin;
    const wsOrigin = this.traceInfo.websocketOrigin.replace('ws', 'http').replace('wss', 'https');
    
    if (apiOrigin !== wsOrigin) {
      console.error('Single Source of Truth Violation: API and WebSocket origins differ');
      return false;
    }

    // Validar se build ID está presente
    if (this.traceInfo.buildId === 'unknown') {
      console.error('Single Source of Truth Violation: Build ID unknown');
      return false;
    }

    return true;
  }

  exportTrace(): string {
    if (!this.traceInfo) {
      return JSON.stringify({ error: 'No trace info available' }, null, 2);
    }

    return JSON.stringify(this.traceInfo, null, 2);
  }

  printTrace(): void {
    console.log('=== SOURCE OF TRUTH TRACE ===');
    console.log(JSON.stringify(this.traceInfo, null, 2));
    console.log('=== END TRACE ===');
  }
}

// Singleton instance
export const sourceOfTruthTrace = SourceOfTruthTrace.getInstance();
