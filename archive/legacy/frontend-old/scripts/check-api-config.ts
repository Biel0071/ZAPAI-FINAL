/**
 * ============================================================================
 * SCRIPT DE VERIFICAÇÃO PRÉ-PUBLICAÇÃO
 * ============================================================================
 * 
 * Este script verifica se as configurações de API estão corretas antes de publicar.
 * Executar antes de cada deploy.
 * 
 * Uso: npx tsx scripts/check-api-config.ts
 * 
 * Se falhar: BLOQUEAR publish.
 * ============================================================================
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function checkFile(filePath: string, content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verificar CONFIG FIXA comment
  if (!content.includes('CONFIG FIXA DE API')) {
    errors.push(`Arquivo ${filePath} não contém comentário CONFIG FIXA`);
  }

  // Verificar tenant-id default
  if (content.includes("x-tenant-id") && !content.includes("x-tenant-id: 'default'") && !content.includes('x-tenant-id": "default"')) {
    errors.push(`Arquivo ${filePath} tem x-tenant-id diferente de "default"`);
  }

  // Verificar mock data
  const mockPatterns = [
    'mock data',
    'MOCK_DATA',
    'fakeData',
    'FAKE_DATA',
    'const mock',
    'const fake',
  ];
  
  for (const pattern of mockPatterns) {
    if (content.includes(pattern)) {
      errors.push(`Arquivo ${filePath} contém ${pattern} - PROIBIDO`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function checkRuntimeConfig(filePath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(filePath)) {
    errors.push(`Arquivo ${filePath} não existe`);
    return { valid: false, errors, warnings };
  }

  const content = readFileSync(filePath, 'utf-8');

  // Verificar API_BASE_URL
  if (!content.includes('API_BASE_URL')) {
    errors.push('API_BASE_URL não definido em runtime.ts');
  }

  // Verificar TENANT_ID
  if (!content.includes("TENANT_ID: 'default'") && !content.includes('TENANT_ID: "default"')) {
    errors.push('TENANT_ID não é "default" em runtime.ts');
  }

  // Verificar HEADERS
  if (!content.includes("x-tenant-id")) {
    errors.push('Header x-tenant-id não definido em runtime.ts');
  }

  // Verificar ENDPOINTS
  const requiredEndpoints = [
    'HEALTH',
    'DASHBOARD',
    'CONVERSATIONS',
    'CONTACTS',
    'SESSIONS',
  ];

  for (const endpoint of requiredEndpoints) {
    if (!content.includes(endpoint)) {
      errors.push(`Endpoint ${endpoint} não definido em runtime.ts`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function checkEnvExample(filePath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(filePath)) {
    errors.push(`Arquivo ${filePath} não existe`);
    return { valid: false, errors, warnings };
  }

  const content = readFileSync(filePath, 'utf-8');

  // Verificar VITE_API_URL
  if (!content.includes('VITE_API_URL')) {
    errors.push('VITE_API_URL não definido em .env.example');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function checkViteConfig(filePath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(filePath)) {
    errors.push(`Arquivo ${filePath} não existe`);
    return { valid: false, errors, warnings };
  }

  const content = readFileSync(filePath, 'utf-8');

  // Verificar proxy /api
  if (!content.includes('"/api"')) {
    errors.push('Proxy /api não configurado em vite.config.ts');
  }

  // Verificar changeOrigin
  if (!content.includes('changeOrigin: true')) {
    errors.push('changeOrigin não está true em vite.config.ts');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function main() {
  console.log('🔍 Verificando configuração de API...\n');

  const frontendDir = join(__dirname, '..');
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Verificar runtime.ts
  console.log('📋 Verificando runtime.ts...');
  const apiConfigResult = checkRuntimeConfig(join(frontendDir, 'src/config/runtime.ts'));
  allErrors.push(...apiConfigResult.errors);
  allWarnings.push(...apiConfigResult.warnings);

  // Verificar .env.example
  console.log('📋 Verificando .env.example...');
  const envResult = checkEnvExample(join(frontendDir, '.env.example'));
  allErrors.push(...envResult.errors);
  allWarnings.push(...envResult.warnings);

  // Verificar vite.config.ts
  console.log('📋 Verificando vite.config.ts...');
  const viteResult = checkViteConfig(join(frontendDir, 'vite.config.ts'));
  allErrors.push(...viteResult.errors);
  allWarnings.push(...viteResult.warnings);

  // Verificar apiService.ts
  console.log('📋 Verificando apiService.ts...');
  if (existsSync(join(frontendDir, 'src/services/apiService.ts'))) {
    const apiServiceContent = readFileSync(join(frontendDir, 'src/services/apiService.ts'), 'utf-8');
    const apiServiceResult = checkFile('src/services/apiService.ts', apiServiceContent);
    allErrors.push(...apiServiceResult.errors);
    allWarnings.push(...apiServiceResult.warnings);
  }

  // Verificar systemControlService.ts
  console.log('📋 Verificando systemControlService.ts...');
  if (existsSync(join(frontendDir, 'src/services/systemControlService.ts'))) {
    const systemServiceContent = readFileSync(join(frontendDir, 'src/services/systemControlService.ts'), 'utf-8');
    const systemServiceResult = checkFile('src/services/systemControlService.ts', systemServiceContent);
    allErrors.push(...systemServiceResult.errors);
    allWarnings.push(...systemServiceResult.warnings);
  }

  // Mostrar resultados
  console.log('\n' + '='.repeat(60));
  
  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log('✅ Todas as verificações passaram!');
    console.log('✅ Configuração de API está correta');
    console.log('✅ Pode prosseguir com o deploy');
    process.exit(0);
  }

  if (allWarnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    allWarnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (allErrors.length > 0) {
    console.log('\n❌ ERROS:');
    allErrors.forEach(error => console.log(`  - ${error}`));
    console.log('\n❌ CONFIGURAÇÃO DE API INVÁLIDA');
    console.log('❌ BLOQUEAR PUBLISH');
    console.log('❌ Corrija os erros acima antes de publicar');
    process.exit(1);
  }

  console.log('\n⚠️  Verificações concluídas com warnings');
  console.log('⚠️  Revise os warnings antes de publicar');
  process.exit(0);
}

main();
