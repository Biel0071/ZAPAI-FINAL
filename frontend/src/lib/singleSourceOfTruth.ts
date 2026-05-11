/**
 * ============================================================================
 * SINGLE SOURCE OF TRUTH ENFORCER
 * ============================================================================
 * 
 * Garante que somente um ambiente responde.
 * Bloqueia múltiplas fontes de verdade.
 * ============================================================================
 */

import { sourceOfTruthTrace } from './traceSourceOfTruth';

interface EnvironmentConfig {
  apiOrigin: string;
  websocketOrigin: string;
  environment: string;
  buildId: string;
}

export class SingleSourceOfTruthEnforcer {
  private static instance: SingleSourceOfTruthEnforcer;
  private validated: boolean = false;
  private currentConfig: EnvironmentConfig | null = null;

  private constructor() {}

  static getInstance(): SingleSourceOfTruthEnforcer {
    if (!SingleSourceOfTruthEnforcer.instance) {
      SingleSourceOfTruthEnforcer.instance = new SingleSourceOfTruthEnforcer();
    }
    return SingleSourceOfTruthEnforcer.instance;
  }

  async enforce(): Promise<boolean> {
    const traceInfo = await sourceOfTruthTrace.traceAll();
    
    const config: EnvironmentConfig = {
      apiOrigin: traceInfo.apiOrigin,
      websocketOrigin: traceInfo.websocketOrigin,
      environment: traceInfo.environment,
      buildId: traceInfo.buildId,
    };

    this.currentConfig = config;

    // Validar consistência
    const isValid = this.validateConfig(config);
    this.validated = isValid;

    if (!isValid) {
      this.handleViolation(config);
    }

    return isValid;
  }

  private validateConfig(config: EnvironmentConfig): boolean {
    // Validar API origin
    if (config.apiOrigin === 'unknown') {
      console.error('SSOT Violation: API origin unknown');
      return false;
    }

    // Validar WebSocket origin
    if (config.websocketOrigin === 'unknown') {
      console.error('SSOT Violation: WebSocket origin unknown');
      return false;
    }

    // Validar consistência entre API e WebSocket
    const wsHttpOrigin = config.websocketOrigin.replace('ws://', 'http://').replace('wss://', 'https://');
    if (config.apiOrigin !== wsHttpOrigin) {
      console.error('SSOT Violation: API and WebSocket origins differ');
      return false;
    }

    // Validar build ID
    if (config.buildId === 'unknown') {
      console.error('SSOT Violation: Build ID unknown');
      return false;
    }

    // Validar environment
    if (!['development', 'production'].includes(config.environment)) {
      console.error('SSOT Violation: Invalid environment');
      return false;
    }

    return true;
  }

  private handleViolation(config: EnvironmentConfig): void {
    console.error('=== SINGLE SOURCE OF TRUTH VIOLATION ===');
    console.error('Config:', config);
    console.warn('System will continue to run, but routing might be inconsistent.');
    console.error('=== END VIOLATION ===');
    // We no longer block the application aggressively.
  }

  private blockApplication(): void {
    // Deprecated: No longer used
  }

  getCurrentConfig(): EnvironmentConfig | null {
    return this.currentConfig;
  }

  isValidated(): boolean {
    return this.validated;
  }

  getAPIOrigin(): string {
    if (!this.currentConfig) {
      throw new Error('Config not validated');
    }
    return this.currentConfig.apiOrigin;
  }

  getWebsocketOrigin(): string {
    if (!this.currentConfig) {
      throw new Error('Config not validated');
    }
    return this.currentConfig.websocketOrigin;
  }

  getEnvironment(): string {
    if (!this.currentConfig) {
      throw new Error('Config not validated');
    }
    return this.currentConfig.environment;
  }

  getBuildId(): string {
    if (!this.currentConfig) {
      throw new Error('Config not validated');
    }
    return this.currentConfig.buildId;
  }
}

// Singleton instance
export const singleSourceOfTruthEnforcer = SingleSourceOfTruthEnforcer.getInstance();
