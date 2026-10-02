const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/infrastructure/config/database');

async function main() {
  const query = `
    SELECT 
      c.id as conversation_id,
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
  `;

  const { rows } = await pool.query(query);
  const myPhone = '553193672075';

  const lostPatterns = [
    /comprei em outro/i,
    /ja comprei/i,
    /já comprei/i,
    /fechei com outro/i,
    /extornado/i,
    /estornado/i,
    /cancelar/i,
    /nao quero mais/i,
    /não quero mais/i,
    /nao precisa/i,
    /não precisa/i
  ];

  const readyForRecovery = [];
  const excludedLost = [];
  const selfOrInvalid = [];

  for (const row of rows) {
    const rawPhone = (row.phone || row.remote_jid || '').replace(/\D/g, '');
    if (rawPhone === myPhone || (row.remote_jid && row.remote_jid.includes(myPhone))) {
      selfOrInvalid.push(row);
      continue;
    }

    const lastMsg = (row.last_message || '').trim();
    const isLost = lostPatterns.some(p => p.test(lastMsg));

    if (isLost) {
      excludedLost.push({ ...row, reason: 'cliente_desistiu_ou_comprou_fora' });
    } else {
      readyForRecovery.push(row);
    }
  }

  console.log('=== CLASSIFICAÇÃO DOS LEADS DE HOJE ===');
  console.log(`Total Geral: ${rows.length}`);
  console.log(`Elegíveis para Recuperação / Venda: ${readyForRecovery.length}`);
  console.log(`Desistência / Compra fora detectada: ${excludedLost.length}`);
  console.log(`Número próprio / Inválido: ${selfOrInvalid.length}`);

  console.log('\n--- Casos de Desistência/Excluídos da Campanha ---');
  for (const l of excludedLost) {
    console.log(`- Conv ${l.conversation_id} (${l.contact_name || l.phone}): "${l.last_message}"`);
  }

  console.log('\n--- Amostra de Leads Elegíveis (Top 20) ---');
  for (const l of readyForRecovery.slice(0, 20)) {
    const name = l.contact_name && !l.contact_name.includes('@lid') ? l.contact_name : 'Sem nome';
    console.log(`- Conv ${l.conversation_id} | ${name} | ${l.phone || l.remote_jid} | Msg: "${l.last_message.replace(/\n/g, ' ').slice(0, 50)}"`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
