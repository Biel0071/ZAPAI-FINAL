const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/infrastructure/config/database');

async function main() {
  console.log('====================================================');
  console.log('📊 AUDITORIA DE LEADS DE HOJE PARA CAMPANHA AMANHÃ');
  console.log('====================================================\n');

  // 1. Total de conversas de hoje desconsiderando grupos (@g.us) e número próprio
  const leadsQuery = await pool.query(`
    SELECT 
      c.id as conversation_id,
      c.session_id,
      c.remote_jid,
      c.ai_enabled,
      c.agent_name,
      c.status,
      c.lead_temperature,
      c.funnel_stage,
      c.last_message,
      c.updated_at,
      l.id as lead_id,
      l.phone,
      l.name as contact_name
    FROM conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE c.company_id = 'default'
      AND c.remote_jid NOT LIKE '%@g.us'
      AND c.remote_jid NOT LIKE '%@broadcast'
      AND (
        c.updated_at >= CURRENT_DATE 
        OR EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.created_at >= CURRENT_DATE
        )
      )
    ORDER BY c.updated_at DESC;
  `);

  console.log(`Total de conversas individuais de hoje: ${leadsQuery.rows.length}`);

  // Filtrar quem é nosso próprio número ou inválido
  const myPhone = '553193672075';
  const targetLeads = [];
  const excluded = [];

  for (const row of leadsQuery.rows) {
    const rawPhone = (row.phone || row.remote_jid || '').replace(/\D/g, '');
    if (rawPhone === myPhone || (row.remote_jid && row.remote_jid.includes(myPhone))) {
      excluded.push({ reason: 'numero_proprio', phone: rawPhone, name: row.contact_name });
      continue;
    }
    targetLeads.push(row);
  }

  console.log(`Leads elegíveis para follow-up/recuperação: ${targetLeads.length}`);
  console.log(`Excluídos (próprio número/sistema): ${excluded.length}\n`);

  console.log('Amostra dos 15 leads mais recentes:');
  for (const lead of targetLeads.slice(0, 15)) {
    const cleanName = lead.contact_name && !lead.contact_name.includes('@lid') ? lead.contact_name : 'Cliente';
    console.log(`- Conv ${lead.conversation_id} | Nome: ${cleanName} | Tel: ${lead.phone || lead.remote_jid} | Última msg: "${(lead.last_message || '').slice(0, 45)}"`);
  }

  // 2. Campanhas existentes
  console.log('\n=== CAMPANHAS EXISTENTES NO BANCO ===');
  const campaignsRes = await pool.query(`
    SELECT id, name, status, created_at, settings
    FROM campaigns
    WHERE company_id = 'default'
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.log(`Total de campanhas encontradas: ${campaignsRes.rows.length}`);
  for (const c of campaignsRes.rows) {
    console.log(`- ID: ${c.id} | Nome: "${c.name}" | Status: ${c.status} | Criada: ${c.created_at}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Erro na auditoria:', err);
  process.exit(1);
});
