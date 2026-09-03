import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const testDir = path.join(process.cwd(), 'test_media');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
    
  const files = {
    image: path.join(testDir, 'test.txt'),
    audio: path.join(testDir, 'test2.txt'),
    pdf: path.join(testDir, 'test3.txt')
  };

  fs.writeFileSync(files.image, "imagem de teste fake");
  fs.writeFileSync(files.audio, "audio de teste fake");
  fs.writeFileSync(files.pdf, "pdf de teste fake");

  console.log('Arquivos prontos.');

  console.log('\n========================================================');
  console.log(' INICIANDO NAVEGADOR...');
  console.log('========================================================');

  // Lança o Chromium em modo visual
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Tenta acessar o frontend local
  try {
    await page.goto('http://localhost:8080');
  } catch (err) {
    console.log('\n⚠️ Servidor local (localhost:8080) não está rodando.');
  }

  console.log('\nNavegador aberto! Siga as instruções:');
  console.log(' 1. Digite a URL do seu sistema (ex: https://seu-vps.com) na barra de endereços do Chrome aberto.');
  console.log(' 2. Faça login na plataforma (se necessário).');
  console.log(' 3. Vá até o Inbox e selecione a conversa do número: 31993807167');
  console.log(' 4. Quando a conversa estiver aberta e pronta para envio...');
  console.log('    >> DIGITE "INICIAR" AQUI NO TERMINAL E APERTE ENTER <<\n');

  // Aguarda a confirmação do usuário
  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', data => {
      if (data.trim().toUpperCase() === 'INICIAR') {
        process.stdin.pause();
        resolve();
      }
    });
  });

  console.log('\n🚀 INICIANDO TESTE DE RAJADA (3 mensagens)...');
  
  // Como os seletores podem variar, usamos seletores genéricos robustos
  const textArea = page.locator('textarea').last();
  const sendButton = page.locator('button', { hasText: 'Enviar' }).or(page.locator('button[aria-label="Enviar mensagem"]')).last();
  const attachButton = page.locator('button[aria-label*="Anexar"]').or(page.locator('button').filter({ has: page.locator('svg') })).first();

  for (let i = 1; i <= 3; i++) {
    await textArea.fill(`Teste de Rajada Automática ${i}/3`);
    // Pode apertar Enter ou clicar no botão
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }
  
  console.log('✅ Rajada concluída. Verifique se os 3 checks apareceram (ou erro se o cel estiver offline).');
  await page.waitForTimeout(3000);

  console.log('\n📂 ENVIANDO MÍDIAS...');
  // Apenas enviaremos pelo input file se encontrarmos
  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count() > 0) {
    console.log('Enviando Imagem...');
    await fileInput.setInputFiles(files.image);
    await page.waitForTimeout(4000); // Aguarda upload e preview

    console.log('Enviando Documento PDF...');
    await fileInput.setInputFiles(files.pdf);
    await page.waitForTimeout(4000);

    console.log('Enviando Áudio...');
    await fileInput.setInputFiles(files.audio);
    await page.waitForTimeout(4000);
  } else {
    console.log('⚠️ Não consegui localizar o input de arquivos, pulei o teste de mídia automatizado.');
  }

  console.log('\n⏳ INICIANDO TESTE DE LONGA DURAÇÃO (1 mensagem por minuto, por 15 minutos)...');
  console.log('Você pode minimizar ou acompanhar. O script terminará sozinho.');

  for (let i = 1; i <= 15; i++) {
    console.log(`[${i}/15] Enviando mensagem de longo prazo...`);
    await textArea.fill(`Teste Liveness ${i}/15 - ${new Date().toLocaleTimeString()}`);
    await page.keyboard.press('Enter');
    
    // Aguarda 1 minuto
    await page.waitForTimeout(60 * 1000);
  }

  console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
  console.log('O navegador fechará em 10 segundos...');
  await page.waitForTimeout(10000);
  await browser.close();
  process.exit(0);

})();
