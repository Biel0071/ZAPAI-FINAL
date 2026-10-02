const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });

async function main() {
  const campRes = await pool.query(
    "SELECT id, name, status, started_at, queue, updated_at FROM campaigns WHERE id = 'cmp-recuperacao-02102026'"
  );
  
  if (campRes.rows.length === 0) {
    console.log('Campaign not found');
  } else {
    const c = campRes.rows[0];
    console.log('=== CAMPANHA ATIVA ===');
    console.log('ID:', c.id);
    console.log('Nome:', c.name);
    console.log('Status:', c.status);
    console.log('Iniciado em:', c.started_at);
    console.log('Atualizado em:', c.updated_at);
    console.log('Fila / Progresso:', JSON.stringify(c.queue, null, 2));
  }

  const settingsRes = await pool.query(
    "SELECT key, value FROM system_settings WHERE key IN ('ai_agents_config_v2:default', 'ai_enabled', 'ai_enabled_v2:default')"
  );
  console.log('\n=== STATUS IA & CONFIGURAÇÃO ===');
  for (const s of settingsRes.rows) {
    console.log(`- ${s.key}:`, typeof s.value === 'object' ? JSON.stringify(s.value).slice(0, 150) + '...' : s.value);
  }

  const aiRes = await pool.query(
    "SELECT count(*) as total_robo_ativo FROM conversations WHERE 'robo_ativo' = ANY(tags)"
  );
  console.log('Conversas com robo_ativo no CRM:', aiRes.rows[0].total_robo_ativo);

  const activeRes = await pool.query(
    "SELECT count(*) as total_ai_enabled FROM conversations WHERE ai_enabled = true"
  );
  console.log('Conversas com IA ativada (ai_enabled = true):', activeRes.rows[0].total_ai_enabled);

  const recentConvs = await pool.query(
    "SELECT c.id, c.remote_jid, l.name, l.phone, c.funnel_stage, c.tags, c.updated_at FROM conversations c LEFT JOIN leads l ON c.lead_id = l.id WHERE c.updated_at >= '2026-10-02 08:30:00' ORDER BY c.updated_at ASC"
  );
  console.log('\n=== LEADS ATIVADOS PELA CAMPANHA NESTA MANHÃ (' + recentConvs.rows.length + ' leads) ===');
  for (const row of recentConvs.rows) {
    const timeStr = new Date(row.updated_at).toLocaleTimeString('pt-BR');
    console.log(`[${timeStr}] ID ${row.id}: ${row.name || 'Contato'} (${row.phone || row.remote_jid}) | Funil: ${row.funnel_stage} | Tags: ${row.tags}`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
