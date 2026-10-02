const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });

async function main() {
  console.log('=== ATIVANDO IA & EXECUTANDO DETECT DE CONTATO CONTÍNUO ===\n');

  // 1. Garantir que todas as conversas recentes de hoje estão com ai_enabled = true
  console.log('1. Reativando IA para conversas ativas e leads de hoje...');
  const reactivateRes = await pool.query(`
    UPDATE conversations
    SET ai_enabled = true,
        ai_reactivate_at = NULL,
        updated_at = NOW()
    WHERE updated_at >= '2026-10-02 00:00:00'
       OR 'robo_ativo' = ANY(tags)
       OR 'recuperacao' = ANY(tags)
    RETURNING id, remote_jid, funnel_stage, tags;
  `);
  console.log(`✔ Reativadas ${reactivateRes.rows.length} conversas com IA 100% ativa.`);

  // 2. Executar Contact Intelligence Sweep
  console.log('\n2. Executando Contact Intelligence Sweep...');
  const contactIntelligence = require('../services/contactIntelligenceDaemon');
  const result = await contactIntelligence.runDailyContactDetection({
    companyId: 'default',
    hoursBack: 48,
    limit: 500,
  });

  console.log('\n=== RESULTADO DO DETECT DE CONTATO ===');
  console.log('Total Avaliado:', result.totalEvaluated);
  console.log('Total Processado:', result.totalProcessed);
  console.log('Categorias Detectadas:', JSON.stringify(result.categoryCounts, null, 2));

  // 3. Inspecionar conversas que relataram problemas ou agendamentos
  console.log('\n3. Conversas com detecção de suporte, agendamento ou pagamento:');
  const inspected = await pool.query(`
    SELECT c.id, c.remote_jid, l.name, c.funnel_stage, c.lead_temperature, c.tags, c.notes
    FROM conversations c
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE 'suporte_urgente' = ANY(c.tags)
       OR 'pedido_nao_entregue' = ANY(c.tags)
       OR 'agendado' = ANY(c.tags)
       OR 'pedido_agendado' = ANY(c.tags)
       OR 'pago' = ANY(c.tags)
    ORDER BY c.updated_at DESC
    LIMIT 10;
  `);

  for (const row of inspected.rows) {
    console.log(`- Conv #${row.id} [${row.name || row.remote_jid}]:`);
    console.log(`  Funil: ${row.funnel_stage} | Temp: ${row.lead_temperature} | Tags: [${row.tags?.join(', ')}]`);
    console.log(`  Notas: ${row.notes ? row.notes.slice(0, 140) + '...' : '(sem notas)'}`);
  }

  await pool.end();
  console.log('\n✔ Finalizado com sucesso!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
