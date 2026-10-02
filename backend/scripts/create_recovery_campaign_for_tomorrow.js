const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/infrastructure/config/database');

async function main() {
  console.log('====================================================');
  console.log('📦 CRIANDO CAMPANHA DE RECUPERAÇÃO DE LEADS (02/10)');
  console.log('====================================================\n');

  // 1. Obter os 61 leads elegíveis de hoje
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

  const selectedContacts = [];

  for (const row of rows) {
    const rawPhone = (row.phone || row.remote_jid || '').replace(/\D/g, '');
    if (rawPhone === myPhone || (row.remote_jid && row.remote_jid.includes(myPhone))) {
      continue;
    }

    const lastMsg = (row.last_message || '').trim();
    if (lostPatterns.some(p => p.test(lastMsg))) {
      continue;
    }

    const cleanName = row.contact_name && !row.contact_name.includes('@lid') ? row.contact_name : 'Cliente';
    const targetPhone = row.phone || row.remote_jid;

    selectedContacts.push({
      id: String(row.lead_id || row.conversation_id),
      conversationId: row.conversation_id,
      name: cleanName,
      phone: targetPhone,
      remoteJid: row.remote_jid,
      temperature: row.lead_temperature || 'warm',
      funnelStage: row.funnel_stage || 'lead'
    });
  }

  console.log(`Leads selecionados para a campanha: ${selectedContacts.length}`);

  // 2. Definir parâmetros da campanha
  const campaignId = 'cmp-recuperacao-02102026';
  const campaignName = 'Recuperação de Vendas — Leads de 01/10';
  
  // Agendada para 02/10/2026 às 08:30 da manhã (Horário de Brasília) = 11:30 UTC
  const scheduledTime = '2026-10-02T11:30:00.000Z';

  const campaignMessage = {
    type: 'text',
    content: 'Oi! Tudo bem? É a Camila aqui do Depósito Vista Alegre. Vi que você falou com a gente hoje sobre materiais. Conseguiu ver seu pedido certinho ou quer que eu revise algum item e as condições pra gente fechar e agendar sua entrega?'
  };

  const settings = {
    startAt: scheduledTime,
    scheduledAt: scheduledTime,
    intervalSeconds: 115,
    randomDelayMin: 85000,
    randomDelayMax: 140000,
    typingDelaySeconds: 9,
    typingDelayMinSeconds: 6,
    typingDelayMaxSeconds: 12,
    pauseEvery: 7,
    pauseEveryMin: 6,
    pauseEveryMax: 8,
    pauseSeconds: 180,
    pauseMinSeconds: 150,
    pauseMaxSeconds: 240,
    sessionId: 'main',
    enableAIPostDispatch: true,
    aiSetup: {
      autoFunnel: true,
      autoTagging: true
    }
  };

  const queue = {
    total: selectedContacts.length,
    sent: 0,
    failed: 0,
    pending: selectedContacts.length
  };

  const tags = ['recuperacao_leads', 'contatos_01_10', 'followup_vendas'];

  // 3. Salvar no banco (UPSERT)
  const upsertQuery = `
    INSERT INTO campaigns (
      id, company_id, name, status, selected_contacts, messages, settings, queue, tags, created_at, updated_at
    ) VALUES (
      $1, 'default', $2, 'scheduled', $3, $4, $5, $6, $7, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      status = 'scheduled',
      selected_contacts = EXCLUDED.selected_contacts,
      messages = EXCLUDED.messages,
      settings = EXCLUDED.settings,
      queue = EXCLUDED.queue,
      tags = EXCLUDED.tags,
      updated_at = NOW()
    RETURNING id, name, status;
  `;

  const res = await pool.query(upsertQuery, [
    campaignId,
    campaignName,
    JSON.stringify(selectedContacts),
    JSON.stringify([campaignMessage]),
    JSON.stringify(settings),
    JSON.stringify(queue),
    tags
  ]);

  console.log('\n✅ Campanha criada/atualizada com sucesso!');
  console.log(`- ID: ${res.rows[0].id}`);
  console.log(`- Nome: ${res.rows[0].name}`);
  console.log(`- Status: ${res.rows[0].status}`);
  console.log(`- Destinatários: ${selectedContacts.length} contatos qualificados`);
  console.log(`- Horário Agendado: 08:30 (Brasília) / ${scheduledTime}`);
  console.log(`- Mensagem Humanizada da Camila configurada`);
  console.log(`- Ativação Automática Pós-Disparo: HABILITADA (Camila responde no ato assim que o cliente responder)`);

  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao criar campanha:', err);
  process.exit(1);
});
