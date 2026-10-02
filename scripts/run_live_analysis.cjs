const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });

async function run() {
  console.log('========================================================================');
  console.log('         ANÁLISE DETALHADA: DISPAROS, CONVERSAS E ATENDIMENTO IA        ');
  console.log('========================================================================\n');

  // 1. Status Geral da Campanha
  const campRes = await pool.query(
    "SELECT id, name, status, queue, started_at, completed_at, updated_at FROM campaigns WHERE id = 'cmp-recuperacao-02102026'"
  );
  const camp = campRes.rows[0];
  console.log('1. STATUS DA CAMPANHA:');
  console.log(`- ID: ${camp.id}`);
  console.log(`- Nome: ${camp.name}`);
  console.log(`- Status: ${camp.status.toUpperCase()}`);
  console.log(`- Iniciado em: ${camp.started_at}`);
  console.log(`- Finalizado em: ${camp.completed_at || 'Em andamento'}`);
  console.log(`- Progresso na Fila: ${camp.queue?.sent || 0} enviados / ${camp.queue?.total || 61} total (Falhas: ${camp.queue?.failed || 0})`);

  // 2. Disparos da campanha no banco
  const sentMsgs = await pool.query(`
    SELECT m.id, m.conversation_id, m.status, m.created_at, l.name, l.phone, m.remote_jid,
           SUBSTRING(m.text, 1, 60) as preview
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE m.sender = 'campaign'
    ORDER BY m.id ASC
  `);
  console.log(`\n2. DISPAROS REGISTRADOS NO BANCO: ${sentMsgs.rows.length} mensagens`);

  // Calcule intervalos
  const intervals = [];
  let lastTime = null;
  for (let i = 0; i < sentMsgs.rows.length; i++) {
    const m = sentMsgs.rows[i];
    const t = new Date(m.created_at).getTime();
    if (lastTime) {
      intervals.push(Math.round((t - lastTime) / 1000));
    }
    lastTime = t;
  }
  if (intervals.length > 0) {
    const avg = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    console.log(`- Cadência: Média = ${avg}s (~${(avg / 60).toFixed(1)} min) entre envios`);
    console.log(`- Primeiro envio: ${new Date(sentMsgs.rows[0].created_at).toLocaleTimeString('pt-BR')}`);
    console.log(`- Último envio: ${new Date(sentMsgs.rows[sentMsgs.rows.length - 1].created_at).toLocaleTimeString('pt-BR')}`);
  }

  // 3. Verificação de Respostas de Clientes (Inbox Inbound Hoje)
  const todayInbound = await pool.query(`
    SELECT m.id, m.conversation_id, m.sender, m.text, m.created_at, l.name, l.phone, m.remote_jid,
           c.tags, c.funnel_stage
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE m.direction = 'incoming'
      AND m.created_at >= '2026-10-02 00:00:00'
    ORDER BY m.id DESC
  `);
  console.log(`\n3. MENSAGENS RECEBIDAS DE CLIENTES HOJE: ${todayInbound.rows.length}`);
  if (todayInbound.rows.length > 0) {
    for (const r of todayInbound.rows) {
      const timeStr = new Date(r.created_at).toLocaleTimeString('pt-BR');
      console.log(`- [${timeStr}] ${r.name || 'Cliente'} (${r.phone || r.remote_jid}): "${r.text}"`);
    }
  } else {
    console.log('  (Nenhum cliente respondeu ao disparo até o momento neste número)');
  }

  // 4. Atendimento IA (Camila) Hoje
  const aiMsgs = await pool.query(`
    SELECT m.id, m.conversation_id, m.sender, m.text, m.created_at, l.name, l.phone, m.remote_jid
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE m.sender IN ('ai', 'bot', 'assistant')
      AND m.created_at >= '2026-10-02 00:00:00'
    ORDER BY m.id DESC
  `);
  console.log(`\n4. RESPOSTAS GERADAS PELA IA (CAMILA) HOJE: ${aiMsgs.rows.length}`);
  if (aiMsgs.rows.length > 0) {
    for (const a of aiMsgs.rows) {
      const timeStr = new Date(a.created_at).toLocaleTimeString('pt-BR');
      console.log(`- [${timeStr}] Para: ${a.name || 'Cliente'} (${a.phone || a.remote_jid}): "${a.text.slice(0, 100)}..."`);
    }
  } else {
    console.log('  (A IA está em standby aguardando as primeiras respostas dos leads ou novas chamadas orgânicas)');
  }

  // 5. Intervenção de Atendentes Humanos Hoje
  const humanMsgs = await pool.query(`
    SELECT m.id, m.conversation_id, m.sender, m.text, m.created_at, l.name, l.phone
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE m.sender IN ('agent', 'human', 'user')
      AND m.from_me = true
      AND m.created_at >= '2026-10-02 00:00:00'
    ORDER BY m.id DESC
  `);
  console.log(`\n5. MENSAGENS DE ATENDENTE HUMANO HOJE: ${humanMsgs.rows.length}`);
  if (humanMsgs.rows.length > 0) {
    for (const h of humanMsgs.rows) {
      const timeStr = new Date(h.created_at).toLocaleTimeString('pt-BR');
      console.log(`- [${timeStr}] Para: ${h.name || 'Cliente'} (${h.phone}): "${h.text.slice(0, 80)}"`);
    }
  }

  // 6. Configuração e Prontidão da IA Camila
  const settingsRes = await pool.query(
    "SELECT key, value FROM system_settings WHERE key = 'ai_agents_config_v2:default'"
  );
  if (settingsRes.rows.length > 0) {
    const raw = typeof settingsRes.rows[0].value === 'string' ? JSON.parse(settingsRes.rows[0].value) : settingsRes.rows[0].value;
    const camila = Array.isArray(raw) ? raw[0] : raw;
    console.log(`\n6. PRONTIDÃO DA ATENDENTE IA (CAMILA):`);
    console.log(`- Nome: ${camila.name}`);
    console.log(`- Temperatura (Variação de Resposta): ${camila.temperature}`);
    console.log(`- Delay de Análise / Leitura Humano: ${camila.delayProfile?.minMs / 1000}s a ${camila.delayProfile?.maxMs / 1000}s`);
    console.log(`- Delay de Digitação Humana (WhatsApp "digitando..."): ${camila.typingDelayProfile?.minMs / 1000}s a ${camila.typingDelayProfile?.maxMs / 1000}s`);
    console.log(`- Anti-Repetição / Humanização: ${camila.personality.includes('Anti-Repetição') ? 'Ativo e Carregado' : 'Padrão'}`);
    console.log(`- Conexões Vinculadas: ${JSON.stringify(camila.sessionIds || ['main'])}`);
  }

  // 7. Qualidade dos Dados dos Contatos da Campanha (Telefone vs LID)
  const totalCampLeads = campRes.rows[0]?.queue?.total || 61;
  const resolvedWithPhone = sentMsgs.rows.filter(m => m.phone && !m.phone.includes('@lid')).length;
  const rawLidOnly = sentMsgs.rows.filter(m => !m.phone || m.phone.includes('@lid')).length;
  console.log(`\n7. RESOLUÇÃO DE IDENTIFICADORES (WHATSAPP WEB COMPANION SYNC):`);
  console.log(`- Enviados até agora: ${sentMsgs.rows.length} / ${totalCampLeads}`);
  console.log(`- Enviados diretamente para Telefone Real (@s.whatsapp.net): ${resolvedWithPhone} (${((resolvedWithPhone/sentMsgs.rows.length)*100).toFixed(0)}%)`);
  console.log(`- Enviados para LID nativo de anúncio (@lid): ${rawLidOnly} (${((rawLidOnly/sentMsgs.rows.length)*100).toFixed(0)}%)`);

  await pool.end();
}

run().catch(console.error);
