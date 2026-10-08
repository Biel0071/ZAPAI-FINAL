const path = require('path');
const { Client } = require('/opt/zapai/backend/node_modules/pg');

async function main() {
  console.log('================================================================');
  console.log('🚀 CRIANDO E AGENDANDO CAMPANHA: REATIVAÇÃO ANÚNCIOS CHURRASQUEIRA');
  console.log('================================================================\n');

  const c = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zapai_crm'
  });
  await c.connect();

  // 1. QUERY QUALIFIED AD LEADS WITHOUT RESPONSE
  const query = `
    WITH ad_convs AS (
      SELECT DISTINCT conversation_id
      FROM messages
      WHERE from_me = false
        AND (
          content ILIKE '%(Anúncio:%'
          OR content ILIKE '%anúncio%'
          OR content ILIKE '%anuncio%'
          OR content ILIKE '%churras%'
        )
    ),
    conv_data AS (
      SELECT 
        c.id as conversation_id,
        c.remote_jid,
        c.lead_id,
        c.status as conv_status,
        c.lead_temperature,
        c.funnel_stage,
        c.last_message,
        c.last_message_at,
        c.created_at as conv_created_at,
        l.phone as lead_phone,
        l.name as lead_name,
        (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id) as total_msgs,
        (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id AND m.from_me = true) as out_msgs,
        (SELECT m_first.content FROM messages m_first WHERE m_first.conversation_id = c.id ORDER BY m_first.created_at ASC LIMIT 1) as first_msg,
        (SELECT m_last.from_me FROM messages m_last WHERE m_last.conversation_id = c.id ORDER BY m_last.created_at DESC LIMIT 1) as last_from_me,
        (SELECT m_last.content FROM messages m_last WHERE m_last.conversation_id = c.id ORDER BY m_last.created_at DESC LIMIT 1) as last_msg_content,
        (SELECT m_last.created_at FROM messages m_last WHERE m_last.conversation_id = c.id ORDER BY m_last.created_at DESC LIMIT 1) as last_msg_time
      FROM conversations c
      JOIN ad_convs ac ON ac.conversation_id = c.id
      LEFT JOIN leads l ON l.id = c.lead_id
      WHERE c.remote_jid NOT LIKE '%@g.us'
        AND c.remote_jid NOT LIKE '%@broadcast'
    )
    SELECT * FROM conv_data
    ORDER BY last_message_at DESC NULLS LAST;
  `;

  const { rows } = await c.query(query);
  const myPhones = ['553193672075', '3193672075'];
  const lostRegex = /(comprei em outro|ja comprei|j[aá] comprei|fechei com outro|extornado|estornado|cancelar|n[aã]o quero mais|n[aã]o precisa)/i;

  const selectedContacts = [];
  const seenTargets = new Set();

  for (const r of rows) {
    const rawTarget = String(r.lead_phone || r.remote_jid || '');
    if (myPhones.some(p => rawTarget.includes(p))) {
      continue;
    }

    const lastText = (r.last_msg_content || r.last_message || '').trim();
    if (lostRegex.test(lastText)) {
      continue;
    }

    // Must be WITHOUT RESPONSE:
    // out_msgs === 0 (never answered) OR last_from_me === false (left waiting)
    const isUnanswered = (parseInt(r.out_msgs, 10) === 0) || (r.last_from_me === false);
    if (!isUnanswered) {
      continue;
    }

    const targetKey = r.remote_jid || r.lead_phone;
    if (seenTargets.has(targetKey)) {
      continue;
    }
    seenTargets.add(targetKey);

    let cleanName = r.lead_name || '';
    if (!cleanName || cleanName.includes('@lid') || cleanName.includes('@s.whatsapp.net')) {
      cleanName = 'Cliente';
    }

    selectedContacts.push({
      id: String(r.lead_id || r.conversation_id),
      conversationId: r.conversation_id,
      leadId: r.lead_id,
      name: cleanName,
      phone: r.lead_phone || r.remote_jid,
      remoteJid: r.remote_jid,
      temperature: r.lead_temperature || 'warm',
      funnelStage: r.funnel_stage || 'lead_anuncio',
      firstInbound: (r.first_msg || '').slice(0, 60),
      lastMsg: lastText.slice(0, 60)
    });
  }

  console.log(`✅ Total de leads qualificados selecionados: ${selectedContacts.length}`);

  // 2. CAMPAIGN IDENTIFIERS AND SCHEDULE
  const campaignId = 'cmp-anuncio-churras-09102026';
  const campaignName = 'Reativação de Anúncios — Churrasqueira Trio (09/10)';
  
  // Agendada para amanhã 09/10/2026 às 08:00 (Horário de Brasília) = 11:00 UTC
  const scheduledTimeIso = '2026-10-09T11:00:00.000Z';

  // 3. MESSAGE PAYLOAD (CHURRAS QUICK REPLY COM FOTO FLYER + TEXTO PERSUASIVO)
  const campaignMessage = {
    type: 'image',
    mediaPath: '/uploads/quick_replies/churras_2.png',
    fileName: 'churras_2.png',
    filename: 'churras_2.png',
    content: 'Olá! Tudo bem? Vi que você se interessou na promoção da nossa churrasqueira trio pré-moldada aqui no Depósito! 🥩🔥\n\nConseguimos 5% à vista no PIX ou até 10x sem juros! O valor dela na promoção está R$ 990,00.\n\nQuer que eu te envie mais fotos de modelos reais de clientes e calcule as condições de entrega para sua região?',
    caption: 'Olá! Tudo bem? Vi que você se interessou na promoção da nossa churrasqueira trio pré-moldada aqui no Depósito! 🥩🔥\n\nConseguimos 5% à vista no PIX ou até 10x sem juros! O valor dela na promoção está R$ 990,00.\n\nQuer que eu te envie mais fotos de modelos reais de clientes e calcule as condições de entrega para sua região?'
  };

  // 4. HUMAN CADENCE SETTINGS
  const settings = {
    startAt: scheduledTimeIso,
    scheduledAt: scheduledTimeIso,
    sessionId: 'main',
    flowId: '196b2abf-3d1d-4841-95cb-4ccc65097708', // ID oficial do template CHURRAS
    cadenceMode: 'human_safe',
    intervalSeconds: 110,
    randomDelayMin: 85000,   // 85s
    randomDelayMax: 140000,  // 140s
    typingDelaySeconds: 8,
    typingDelayMinSeconds: 6,
    typingDelayMaxSeconds: 12,
    pauseEvery: 7,
    pauseEveryMin: 6,
    pauseEveryMax: 8,
    pauseSeconds: 180,       // 3 min
    pauseMinSeconds: 150,
    pauseMaxSeconds: 240,
    enableAIPostDispatch: true,
    aiSetup: {
      autoFunnel: true,
      autoTagging: true,
      agentName: 'Camila',
      targetFunnelStage: 'Lead_Quente',
      tagsToAdd: ['robo_ativo', 'recuperacao', 'campanha_churrasqueira', 'lead_anuncio']
    }
  };

  const queue = {
    total: selectedContacts.length,
    processed: 0,
    sent: 0,
    failed: 0,
    pending: selectedContacts.length,
    paused: false
  };

  const tags = [
    'anuncio_facebook',
    'churrasqueira_trio',
    'sem_resposta',
    'reativacao_0910',
    'funil_ia'
  ];

  // 5. UPSERT INTO CAMPAIGNS TABLE
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
    RETURNING id, name, status, created_at;
  `;

  const res = await c.query(upsertQuery, [
    campaignId,
    campaignName,
    JSON.stringify(selectedContacts),
    JSON.stringify([campaignMessage]),
    JSON.stringify(settings),
    JSON.stringify(queue),
    tags
  ]);

  console.log('\n================================================================');
  console.log('🎉 CAMPANHA AGENDADA COM SUCESSO NO BANCO DE PRODUÇÃO!');
  console.log('================================================================');
  console.log(`- ID: ${res.rows[0].id}`);
  console.log(`- Nome: ${res.rows[0].name}`);
  console.log(`- Status: ${res.rows[0].status}`);
  console.log(`- Contatos Selecionados: ${selectedContacts.length} leads de anúncio sem resposta`);
  console.log(`- Horário de Disparo: 09/10/2026 às 08:00 (Brasília) [${scheduledTimeIso}]`);
  console.log(`- Cadência Humana: ~110s entre envios (85s a 140s) com 8s de digitação`);
  console.log(`- Pausa Humanizada: a cada 6-8 envios, pausa de 2.5 a 4 minutos`);
  console.log(`- Mídia Anexada: Flyer /uploads/quick_replies/churras_2.png`);
  console.log(`- Template Vinculado: Resposta Rápida CHURRAS (ID: 196b2abf-3d1d-4841-95cb-4ccc65097708)`);
  console.log(`- Ativação de IA: Camila (Atendimento e Fechamento Automático assim que o cliente responder)`);

  await c.end();
}

main().catch(console.error);
