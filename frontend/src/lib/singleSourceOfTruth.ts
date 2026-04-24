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
    console.error('=== END VIOLATION ===');

    // Em produção, bloquear a aplicação
    if (config.environment === 'production') {
      this.blockApplication();
    }
  }

  private blockApplication(): void {
    // Mostrar alerta de violação
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #000;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: monospace;
      text-align: center;
      padding: 20px;
    `;
    alertDiv.innerHTML = `
      <div>
        <h1 style="color: #ef4444; margin-bottom: 20px;">⚠️ SINGLE SOURCE OF TRUTH VIOLATION</h1>
        <p>Multiple environments detected. Application blocked.</p>
        <p style="color: #94a3b8; margin-top: 20px;">Please clear your cache and reload.</p>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
          Reload
        </button>
      </div>
    `;
    document.body.appendChild(alertDiv);

    // Parar execução
    throw new Error('Single Source of Truth Violation: Application blocked');
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
