const path = require('path');
const axios = require('axios');

async function testSpam() {
  console.log('Iniciando teste de stress de envio (10 mensagens)...');
  
  const phone = '31993807167';
  // O endpoint de envio depende da sessão e company, usando default/default ou pegando o token do banco.
  // Como estamos testando, podemos ir direto no banco e instanciar o serviço se não tivermos token.
  const whatsappService = require('../backend/services/whatsappService');
  const sessionStateService = require('../backend/services/sessionStateService');
  
  // Assegura que o env tá carregado
  require('dotenv').config({ path: path.join(__dirname, '../.env.production') });
  
  console.log('1. Enviando 5 mensagens RÁPIDAS (delay 10s entre elas)');
  for (let i = 1; i <= 5; i++) {
    const text = `Teste rápido via script - Msg ${i} de 5 (Enviada às ${new Date().toLocaleTimeString()})`;
    try {
      // Inserir direto na fila do Baileys ou mandar via controller (simulando front)
      await whatsappService.sendMessage(whatsappService.DEFAULT_SESSION, phone, text);
      console.log(`[OK] Enviada rápida ${i}`);
    } catch (e) {
      console.error(`[ERRO] Falha na mensagem rápida ${i}:`, e.message);
    }
    
    if (i < 5) {
      console.log('Aguardando 10 segundos...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log('2. Aguardando 1 minuto para enviar as próximas 5...');
  await new Promise(r => setTimeout(r, 60000));

  console.log('3. Enviando 5 mensagens ESPAÇADAS (delay 2 min)');
  for (let i = 1; i <= 5; i++) {
    const text = `Teste espaçado via script - Msg ${i + 5} de 10 (Enviada às ${new Date().toLocaleTimeString()})`;
    try {
      await whatsappService.sendMessage(whatsappService.DEFAULT_SESSION, phone, text);
      console.log(`[OK] Enviada espaçada ${i}`);
    } catch (e) {
      console.error(`[ERRO] Falha na mensagem espaçada ${i}:`, e.message);
    }
    
    if (i < 5) {
      console.log('Aguardando 2 minutos...');
      await new Promise(r => setTimeout(r, 120000));
    }
  }
  
  console.log('Teste concluído!');
  process.exit(0);
}

testSpam();
