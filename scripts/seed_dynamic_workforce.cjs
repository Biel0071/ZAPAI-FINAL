// Native fetch is available in Node 18+

const BACKEND_URL = 'http://127.0.0.1:4025';

async function main() {
  console.log('🚀 Authenticating as zapadmin...');
  const tokenRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'default' },
    body: JSON.stringify({ username: 'zapadmin', password: 'zapadmin123', tenantId: 'default' }),
  });
  const { token } = await tokenRes.json();
  if (!token) throw new Error('Could not get token');
  console.log('✅ Authenticated successfully.');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': 'default',
  };

  // 1. Update Camila (Vendas)
  console.log('✨ Updating Camila (Vendas)...');
  const camilaPayload = {
    name: 'Camila',
    role: 'Especialista em Vendas & Fechamento',
    sector: 'Vendas',
    active: true,
    status: 'active',
    personalityType: 'comercial',
    personalityTags: ['Comercial', 'Empática', 'Objetiva'],
    tone: 'commercial',
    personality: 'Você é Camila, especialista em vendas e consultoria da loja. Seu objetivo é entender com gentileza a necessidade do cliente, esclarecer dúvidas com clareza e conduzir naturalmente para a compra ou orçamento.',
    objective: 'Atender clientes, esclarecer especificações, calcular orçamentos e fechar vendas no WhatsApp.',
    responsibilities: ['Atender clientes', 'Vender', 'Enviar orçamento', 'Fazer follow-up'],
    channels: ['whatsapp', 'inbox'],
    knowledgeSources: ['products', 'prices', 'policies', 'faq'],
    character: {
      gender: 'female',
      skinTone: '#e2b07e',
      hairStyle: 'ponytail',
      hairColor: '#4a2c11',
      clothingStyle: 'uniforme_loja',
      clothingColor: '#10b981',
      accessories: ['headset', 'cracha'],
      scene: 'escritorio_zai',
    },
    appearance: {
      gender: 'female',
      skinTone: '#e2b07e',
      hairStyle: 'ponytail',
      hairColor: '#4a2c11',
      clothingStyle: 'uniforme_loja',
      clothingColor: '#10b981',
      accessories: ['headset', 'cracha'],
      scene: 'escritorio_zai',
    },
    stats: {
      chatsToday: 127,
      activeChats: 18,
      opportunities: 24,
      slaPercent: 96,
      avgResponseTime: '18s',
      satisfactionCsat: 98,
    },
  };
  await fetch(`${BACKEND_URL}/api/config/ai-agents/camila`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(camilaPayload),
  });

  // Activate Camila
  await fetch(`${BACKEND_URL}/api/config/ai-agents/camila/active`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active: true }),
  });
  console.log('✅ Camila updated and set active.');

  // 2. Create Rafael (Suporte Técnico & SAC)
  console.log('✨ Creating/Updating Rafael (Suporte)...');
  const rafaelPayload = {
    key: 'rafael',
    name: 'Rafael',
    role: 'Consultor Técnico & Suporte SAC',
    sector: 'Suporte',
    active: true,
    status: 'active',
    personalityType: 'tecnico',
    personalityTags: ['Técnico', 'Objetivo', 'Educado'],
    tone: 'objective',
    personality: 'Você é Rafael, consultor técnico de suporte ao cliente e SAC. Seu papel é acolher o cliente, diagnosticar dúvidas sobre especificações de materiais e resolver problemas com agilidade.',
    objective: 'Prestar suporte técnico preciso, tirar dúvidas de aplicação e garantir resolução em primeiro contato.',
    responsibilities: ['Atender clientes', 'Suporte técnico', 'Tirar dúvidas'],
    channels: ['whatsapp', 'inbox'],
    knowledgeSources: ['products', 'policies', 'faq'],
    character: {
      gender: 'male',
      skinTone: '#b97a48',
      hairStyle: 'short_fade',
      hairColor: '#1e293b',
      clothingStyle: 'polo_comercial',
      clothingColor: '#06b6d4',
      accessories: ['headset', 'cracha', 'oculos'],
      scene: 'suporte_sac',
    },
    appearance: {
      gender: 'male',
      skinTone: '#b97a48',
      hairStyle: 'short_fade',
      hairColor: '#1e293b',
      clothingStyle: 'polo_comercial',
      clothingColor: '#06b6d4',
      accessories: ['headset', 'cracha', 'oculos'],
      scene: 'suporte_sac',
    },
    stats: {
      chatsToday: 54,
      activeChats: 8,
      opportunities: 5,
      slaPercent: 99,
      avgResponseTime: '12s',
      satisfactionCsat: 96,
    },
  };
  const rafaelRes = await fetch(`${BACKEND_URL}/api/config/ai-agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rafaelPayload),
  });
  if (rafaelRes.status === 409 || rafaelRes.status === 400) {
    await fetch(`${BACKEND_URL}/api/config/ai-agents/rafael`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(rafaelPayload),
    });
  }
  console.log('✅ Rafael provisioned successfully.');

  // 3. Create Julia (Pós-Venda & Relacionamento)
  console.log('✨ Creating/Updating Julia (Pós-Venda)...');
  const juliaPayload = {
    key: 'julia',
    name: 'Julia',
    role: 'Consultora de Pós-Venda & Fidelização',
    sector: 'Pós-Venda',
    active: true,
    status: 'active',
    personalityType: 'amigavel',
    personalityTags: ['Empática', 'Atenciosa', 'Acolhedora'],
    tone: 'warm',
    personality: 'Você é Julia, consultora de pós-venda e satisfação do cliente. Seu objetivo é confirmar a entrega do pedido, avaliar a experiência de compra e manter um relacionamento próximo e confiável.',
    objective: 'Acompanhar satisfação pós-entrega (CSAT), resolver ocorrências de entrega e incentivar recompra.',
    responsibilities: ['Atender clientes', 'Pós-venda', 'Fazer follow-up'],
    channels: ['whatsapp', 'inbox'],
    knowledgeSources: ['policies', 'faq'],
    character: {
      gender: 'female',
      skinTone: '#fcd34d',
      hairStyle: 'wavy_long',
      hairColor: '#d97706',
      clothingStyle: 'social_executivo',
      clothingColor: '#8b5cf6',
      accessories: ['cracha'],
      scene: 'corporate_suite',
    },
    appearance: {
      gender: 'female',
      skinTone: '#fcd34d',
      hairStyle: 'wavy_long',
      hairColor: '#d97706',
      clothingStyle: 'social_executivo',
      clothingColor: '#8b5cf6',
      accessories: ['cracha'],
      scene: 'corporate_suite',
    },
    stats: {
      chatsToday: 38,
      activeChats: 6,
      opportunities: 12,
      slaPercent: 98,
      avgResponseTime: '15s',
      satisfactionCsat: 100,
    },
  };
  const juliaRes = await fetch(`${BACKEND_URL}/api/config/ai-agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify(juliaPayload),
  });
  if (juliaRes.status === 409 || juliaRes.status === 400) {
    await fetch(`${BACKEND_URL}/api/config/ai-agents/julia`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(juliaPayload),
    });
  }
  console.log('✅ Julia provisioned successfully.');

  // List all final agents
  const finalRes = await fetch(`${BACKEND_URL}/api/config/ai-agents`, { headers });
  const finalData = await finalRes.json();
  const finalAgents = finalData.data?.agents || finalData.agents || [];
  console.log('\n🎉 Dynamic Workforce in PostgreSQL:');
  finalAgents.forEach((a) => {
    console.log(` • [${a.key}] ${a.name} (${a.role}) - active: ${a.active}`);
  });
}

main().catch(console.error);
