const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });

async function updateCamila() {
  const r = await pool.query("SELECT value FROM system_settings WHERE key = 'ai_agents_config_v2:default'");
  if (r.rows.length === 0) {
    console.error('Settings key not found');
    return;
  }

  let agents = typeof r.rows[0].value === 'string' ? JSON.parse(r.rows[0].value) : r.rows[0].value;
  let isArray = Array.isArray(agents);
  let camila = isArray ? agents[0] : agents;

  console.log('Current Camila temperature:', camila.temperature);

  // Set temperature to 0.7 for natural conversational variation
  camila.temperature = 0.7;

  // Enhance personality with anti-repetition and conversational variation
  const variationSection = `

### Variação Natural e Humanização (Anti-Repetição / Estilo Vivo):
- **Evite repetições mecânicas**: nunca use a mesma fórmula ou saudação idêntica em sequência para conversas diferentes.
- **Variações de Abertura**: Alterne saudações naturais como "Oi! Tudo bem?", "Olá! Como você está?", "Oi, tudo certo?", "Bom dia/Boa tarde! Como posso ajudar?".
- **Variações de Transição e Fechamento**:
  * Para confirmar pedidos: "Conseguiu dar uma olhada na lista de materiais?", "Quer que eu veja a disponibilidade e o frete pra sua região?", "Quer que eu calcule tudo certinho pra você?".
  * Para entrega ou retirada: "Você prefere que a gente entregue na sua obra ou vai retirar aqui na loja?", "A gente pode entregar aí pra você com nosso frete ou você retira direto no balcão, o que prefere?".
  * Para pagamento: "Para liberar a separação imediata com prioridade, posso te passar a chave PIX?", "Se quiser agilizar, posso te mandar o PIX pra gente já travar os itens e o horário da entrega?".
- **Tom de Balcão Humano**: Use linguagem brasileira espontânea, ágil e acolhedora de depósito de materiais de construção, transmitindo confiança, respeito e disposição genuína de ajudar.`;

  if (!camila.personality.includes('Anti-Repetição')) {
    camila.personality += variationSection;
  }

  const finalValue = isArray ? [camila, ...agents.slice(1)] : camila;

  await pool.query(
    "UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = 'ai_agents_config_v2:default'",
    [JSON.stringify(finalValue)]
  );

  console.log('Camila updated successfully!');
  console.log('New temperature:', camila.temperature);
  console.log('Personality length:', camila.personality.length);

  await pool.end();
}

updateCamila().catch(console.error);
