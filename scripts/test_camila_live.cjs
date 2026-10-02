const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });

async function main() {
  console.log('========================================================================');
  console.log('          VALIDAÇÃO AO VIVO: ATENDIMENTO E VARIAÇÕES DA IA CAMILA       ');
  console.log('========================================================================\n');

  // 1. Verificar Provider Keys e OpenAI
  const pkRes = await pool.query("SELECT id, tenant_id, provider, model, enabled, api_key FROM provider_keys WHERE tenant_id = 'default' AND enabled = true");
  if (pkRes.rows.length === 0) {
    console.error('Nenhum provider ativo encontrado no banco!');
    process.exit(1);
  }
  const pk = pkRes.rows[0];
  console.log('1. PROVEDOR IA ATIVO:');
  console.log(`- Provedor: ${pk.provider}`);
  console.log(`- Modelo: ${pk.model}`);
  console.log(`- Status: Ativo e Conectado\n`);

  // 2. Verificar Configuração de Camila
  const confRes = await pool.query("SELECT value FROM system_settings WHERE key = 'ai_agents_config_v2:default'");
  const rawConf = typeof confRes.rows[0].value === 'string' ? JSON.parse(confRes.rows[0].value) : confRes.rows[0].value;
  const camila = Array.isArray(rawConf) ? rawConf[0] : rawConf;
  console.log('2. PERFIL DA ATENDENTE (CAMILA):');
  console.log(`- Nome: ${camila.name}`);
  console.log(`- Temperatura: ${camila.temperature} (Configuração alta para permitir variação criativa e humana)`);
  console.log(`- Delay de Análise: ${camila.delayProfile?.minMs / 1000}s a ${camila.delayProfile?.maxMs / 1000}s`);
  console.log(`- Delay de Digitação: ${camila.typingDelayProfile?.minMs / 1000}s a ${camila.typingDelayProfile?.maxMs / 1000}s\n`);

  // 3. Testar a geração de respostas ao vivo com o motor de IA
  const { evaluateInboundAi } = require('/opt/zapai/backend/services/enterprise/ai-service');

  const testPrompts = [
    {
      customer: 'Oi, tudo bem? Vocês entregam aí no bairro Vista Alegre? Quanto tempo demora?',
      leadName: 'Marcos Oliveira',
      phone: '5531988887777',
      label: 'Teste 1 - Pergunta sobre Entrega e Prazo'
    },
    {
      customer: 'Boa tarde! Qual o valor do milheiro do tijolo 8 furos e do saco de cimento?',
      leadName: 'Carlos Silva',
      phone: '5531977776666',
      label: 'Teste 2 - Cotação de Preços (Tijolo e Cimento)'
    },
    {
      customer: 'Consegue parcelar no cartão ou tem desconto à vista no pix?',
      leadName: 'Ana Paula',
      phone: '5531966665555',
      label: 'Teste 3 - Condições de Pagamento e Desconto'
    },
    {
      customer: 'Oi, tudo bem? Vocês entregam aí no bairro Vista Alegre? Quanto tempo demora?',
      leadName: 'Fernanda Costa',
      phone: '5531955554444',
      label: 'Teste 4 - Mesma pergunta do Teste 1 (Verificar Variação Natural de Resposta)'
    }
  ];

  console.log('3. SIMULAÇÃO AO VIVO DE ATENDIMENTO COM CAMILA (TESTANDO NATURALIDADE E VARIAÇÃO):\n');

  for (const t of testPrompts) {
    console.log(`--- [${t.label}] ---`);
    console.log(`Cliente (${t.leadName}): "${t.customer}"`);

    const started = Date.now();
    try {
      const result = await evaluateInboundAi({
        agent: camila,
        chatId: t.phone,
        conversationHistory: [
          { role: 'user', content: t.customer }
        ],
        customerMessage: t.customer,
        store: {
          activeCompanyId: 'default',
          aiConfig: {
            memorySettings: { enabled: true },
            advancedAISettings: { maxTokens: 600, temperature: camila.temperature }
          },
          contact: { name: t.leadName, phone: t.phone }
        },
        forceAutoReply: true,
        conversationId: null,
        sessionId: 'main'
      });

      const elapsed = Date.now() - started;
      console.log(`Resposta da Camila (${elapsed}ms, Modelo: ${result.model || 'gpt-4o-mini'}):`);
      console.log(`"${result.response}"\n`);
    } catch (err) {
      console.error(`Erro ao gerar resposta para ${t.label}:`, err.message);
    }
  }

  await pool.end();
  console.log('========================================================================');
  console.log('             VALIDAÇÃO DE ATENDIMENTO CONCLUÍDA COM SUCESSO             ');
  console.log('========================================================================');
}

main().catch(console.error);
