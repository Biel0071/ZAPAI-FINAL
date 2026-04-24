/**
 * ============================================================================
 * VALIDADOR DE ENDPOINTS REAIS
 * ============================================================================
 * 
 * Este módulo valida se os endpoints estão respondendo corretamente.
 * Usado para verificar disponibilidade da API em tempo de execução.
 * 
 * PROIBIDO:
 * - Adicionar mock data ou fallback fake
 * - Inventar respostas quando API falha
 * 
 * Se API falhar: mostrar "Backend offline" ou "Endpoint indisponível".
 * ============================================================================
 */

import { API_CONFIG, ERROR_MESSAGES } from '@/config/api.config';

export interface EndpointValidation {
  endpoint: string;
  status: 'success' | 'error';
  statusCode?: number;
  error?: string;
}

export interface ApiValidationResult {
  valid: boolean;
  endpoints: EndpointValidation[];
  overallStatus: 'online' | 'partial' | 'offline';
}

const CRITICAL_ENDPOINTS = [
  API_CONFIG.ENDPOINTS.HEALTH,
  API_CONFIG.ENDPOINTS.DASHBOARD,
  API_CONFIG.ENDPOINTS.CONVERSATIONS,
];

async function validateEndpoint(endpoint: string): Promise<EndpointValidation> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_CONFIG.BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': API_CONFIG.TENANT_ID,
      },
      signal: AbortSignal.timeout(5000), // 5 segundos timeout
    });

    return {
      endpoint,
      status: response.ok ? 'success' : 'error',
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      endpoint,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function validateCriticalEndpoints(): Promise<ApiValidationResult> {
  const results = await Promise.all(
    CRITICAL_ENDPOINTS.map(endpoint => validateEndpoint(endpoint))
  );

  const successCount = results.filter(r => r.status === 'success').length;
  const totalCount = results.length;

  let overallStatus: 'online' | 'partial' | 'offline';

  if (successCount === totalCount) {
    overallStatus = 'online';
  } else if (successCount > 0) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'offline';
  }

  return {
    valid: overallStatus !== 'offline',
    endpoints: results,
    overallStatus,
  };
}

export async function validateSingleEndpoint(endpoint: string): Promise<EndpointValidation> {
  return validateEndpoint(endpoint);
}

export function getErrorMessageForStatus(status: 'online' | 'partial' | 'offline'): string {
  switch (status) {
    case 'online':
      return 'API online';
    case 'partial':
      return 'API parcialmente indisponível';
    case 'offline':
      return ERROR_MESSAGES.BACKEND_OFFLINE;
  }
}

export function shouldBlockPublish(validation: ApiValidationResult): boolean {
  return validation.overallStatus === 'offline';
}

export function getValidationSummary(validation: ApiValidationResult): string {
  const successCount = validation.endpoints.filter(e => e.status === 'success').length;
  const totalCount = validation.endpoints.length;

  return `${successCount}/${totalCount} endpoints respondendo`;
}
