/**
 * Seed Official Knowledge & Initial Playbooks for ZAPFLOW Evolutionary AI
 *
 * Populates real canonical business data:
 * - Products: Churrasqueira Trio, Tijolo 8 furos, Cimento, Argamassa, etc.
 * - Policies: Desconto PIX, Parcelamento, Horário de Atendimento.
 * - Shipping: Regras de frete por bairro / raio e frete grátis.
 * - Playbooks: Frete, Cotação de Milheiro, Follow-up Comercial.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

const OFFICIAL_KNOWLEDGE_SEEDS = [
  {
    category: 'products',
    key: 'prod_churrasqueira_trio',
    title: 'Churrasqueira Trio Pré-Moldada (Churrasqueira + Fogão a Lenha + Forno)',
    content: {
      sku: 'CHURR-TRIO-01',
      name: 'Churrasqueira Trio Pré-Moldada',
      price: 990.00,
      pix_discount_price: 940.50,
      installments: 'Até 10x sem juros de R$ 99,00',
      description: 'Churrasqueira 3 em 1 completa: grelha para churrasco, forno de ferro fundido e fogão a lenha com chapa. Excelente acabamento refratário.',
      dimensions: 'Comprimento: 2.20m, Altura: 2.20m, Profundidade: 0.60m',
      includes: ['Grelha inox', 'Porta do forno em ferro fundido com termômetro', 'Chapa de 3 bocas para fogão', 'Gravata e gaveta de cinzas'],
      delivery_type: 'Entrega programada em veículo apropriado'
    },
    raw_text: 'Churrasqueira Trio Pré-Moldada completa com fogão a lenha e forno. Preço oficial: R$ 990,00 à vista ou em até 10x sem juros. À vista no PIX com 5% de desconto sai por R$ 940,50. Acompanha grelha inox e portas de ferro.',
    tags: ['churrasqueira', 'trio', 'fogao', 'forno', 'pre-moldada', 'lazer', 'preco']
  },
  {
    category: 'products',
    key: 'prod_tijolo_8_furos',
    title: 'Tijolo Cerâmico 8 Furos (Milheiro)',
    content: {
      sku: 'TIJ-8F-MIL',
      name: 'Tijolo Cerâmico 8 Furos 9x19x19 cm',
      price_per_thousand: 720.00,
      pix_price_per_thousand: 684.00,
      description: 'Tijolo cerâmico estruturado de primeira linha, excelente queima e alta resistência. Rendimento médio: 25 peças por metro quadrado.',
      min_order_delivery: '1 milheiro (1.000 peças)'
    },
    raw_text: 'Tijolo 8 furos primeira linha (9x19x19cm). Valor oficial: R$ 720,00 o milheiro. No PIX com 5% de desconto: R$ 684,00 o milheiro. Rendimento de 25 tijolos por metro quadrado.',
    tags: ['tijolo', '8 furos', 'milheiro', 'alvenaria', 'construcao', 'bloco']
  },
  {
    category: 'products',
    key: 'prod_cimento_cpii',
    title: 'Cimento CP II 50kg (Todas as marcas líderes)',
    content: {
      sku: 'CIM-CPII-50KG',
      name: 'Cimento Portland CP II-F-32 50kg',
      price: 33.90,
      pix_price: 32.20,
      description: 'Cimento de alta versatilidade para fundações, alvenaria, emboço e concreto em geral.',
      weight: '50kg'
    },
    raw_text: 'Cimento CP II 50kg saco por R$ 33,90 a unidade, ou R$ 32,20 no PIX. Para carga fechada ou palete favor consultar frete unificado.',
    tags: ['cimento', 'cp2', 'cpii', '50kg', 'argamassa', 'concreto']
  },
  {
    category: 'shipping',
    key: 'shipping_rules_main',
    title: 'Regras Oficiais de Entrega e Frete',
    content: {
      free_shipping_threshold: 500.00,
      free_shipping_max_distance_km: 15,
      standard_delivery_days: '1 a 3 dias úteis',
      express_delivery: 'Mesmo dia para pedidos aprovados até as 11h (sujeito à rota)',
      unloading_policy: 'Descarregamento incluso no térreo até 10 metros do caminhão. Não subimos escadas/lajes.',
      freight_calc: 'Frete calculado com base no peso total da carga e no bairro de destino.'
    },
    raw_text: 'Política oficial de entrega: Frete grátis para compras acima de R$ 500,00 em um raio de até 15km. O descarregamento é feito no térreo próximo ao caminhão. Prazo de entrega padrão de 1 a 3 dias úteis.',
    tags: ['frete', 'entrega', 'prazo', 'distancia', 'politica de entrega', 'descarregamento']
  },
  {
    category: 'policies',
    key: 'payment_policies_main',
    title: 'Condições Oficiais de Pagamento',
    content: {
      pix_discount_pct: 5,
      credit_card_installments_max: 10,
      credit_card_interest_free: true,
      boleto: 'Faturado apenas para empresas/CNPJ cadastrado e mediante análise de crédito',
      payment_on_delivery: 'Aceitamos cartão ou PIX no ato da entrega (maquininha móvel levada pelo motorista)'
    },
    raw_text: 'Formas de pagamento oficiais: 5% de desconto à vista no PIX ou dinheiro. Cartão de crédito parcelado em até 10x sem juros. Pagamento na entrega disponível via maquininha ou chave PIX confirmada.',
    tags: ['pagamento', 'pix', 'cartao', 'parcelamento', 'desconto', 'condicoes']
  },
  {
    category: 'company_info',
    key: 'business_hours_location',
    title: 'Horário de Funcionamento e Localização',
    content: {
      store_name: 'ZAPFLOW Materiais para Construção',
      business_hours: 'Segunda a Sexta: 07:30 às 17:30 | Sábado: 07:30 às 12:30 | Domingo e Feriados: Fechado',
      pickup_available: true,
      location: 'Atendimento e entrega em toda a região metropolitana'
    },
    raw_text: 'Horário oficial de funcionamento: Segunda a Sexta das 07:30 às 17:30. Sábado das 07:30 às 12:30. Retirada no balcão e entrega em domicílio disponíveis.',
    tags: ['horario', 'aberto', 'fechado', 'endereco', 'loja', 'retirada']
  }
];

const INITIAL_PLAYBOOK_SEEDS = [
  {
    slug: 'qualificacao_frete_localizacao',
    name: 'Qualificação de Frete e Localização',
    trigger_condition: 'solicitacao_frete_ou_entrega',
    goal: 'Obter bairro e quantidade de material antes de informar o frete final para não passar estimativa errada.',
    steps: [
      'Confirmar quais itens o cliente quer receber',
      'Solicitar o bairro ou ponto de referência exato da entrega',
      'Verificar se o valor total atinge a faixa de frete grátis (acima de R$ 500)',
      'Finalizar com CTA claro para confirmar o pedido'
    ],
    recommended_cta: 'Qual o seu bairro e a quantidade que você precisa para calcularmos a entrega com o melhor desconto?',
    confidence: 0.95,
    continuity_boost_pct: 22.4,
    status: 'approved'
  },
  {
    slug: 'cotacao_milheiro_alvenaria',
    name: 'Cotação de Milheiro e Materiais de Alvenaria',
    trigger_condition: 'cotacao_tijolo_milheiro',
    goal: 'Apresentar o preço oficial do milheiro no PIX e a prazo, e oferecer materiais complementares (cimento e argamassa).',
    steps: [
      'Apresentar o valor do milheiro oficial (R$ 720,00 ou R$ 684,00 no PIX)',
      'Perguntar se a obra precisa também de cimento ou argamassa para aproveitar o mesmo frete',
      'Informar sobre facilidade de parcelamento em até 10x sem juros'
    ],
    recommended_cta: 'Quantos milheiros você vai precisar para sua obra? Se quiser, já calculamos o cimento junto no mesmo frete!',
    confidence: 0.92,
    continuity_boost_pct: 18.5,
    status: 'approved'
  },
  {
    slug: 'follow_up_cotacao_aberta',
    name: 'Follow-up de Cotação Aberta ou Pedido Agendado',
    trigger_condition: 'follow_up_orcamento',
    goal: 'Reconectar com o cliente de forma consultiva sem ser insistente, verificando se há dúvidas e confirmando disponibilidade de rota de entrega.',
    steps: [
      'Cumprimentar mencionando o item orçado anteriormente',
      'Avisar sobre o cronograma de saídas da frota para o bairro dele',
      'Oferecer reserva imediata das peças'
    ],
    recommended_cta: 'Oi! Conseguiu dar uma olhada na cotação? Nossa rota para sua região sai amanhã cedo, quer que eu reserve seu pedido?',
    confidence: 0.88,
    continuity_boost_pct: 31.0,
    status: 'approved'
  }
];

async function seed() {
  console.log('[SEED] Starting Official Knowledge & Playbooks seeding...');

  // 1. Seed Official Knowledge
  for (const item of OFFICIAL_KNOWLEDGE_SEEDS) {
    await pool.query(
      `INSERT INTO company_official_knowledge 
        (company_id, category, key, title, content, raw_text, tags, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
       ON CONFLICT (company_id, key) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        raw_text = EXCLUDED.raw_text,
        tags = EXCLUDED.tags,
        is_active = TRUE,
        updated_at = NOW()`,
      [
        'default',
        item.category,
        item.key,
        item.title,
        JSON.stringify(item.content),
        item.raw_text,
        item.tags
      ]
    );
    console.log(`[SEED] Upserted official knowledge: ${item.key} (${item.title})`);
  }

  // 2. Seed Playbooks
  for (const pb of INITIAL_PLAYBOOK_SEEDS) {
    await pool.query(
      `INSERT INTO ai_playbooks
        (company_id, name, slug, trigger_condition, goal, steps, recommended_cta, confidence, continuity_boost_pct, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (company_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        trigger_condition = EXCLUDED.trigger_condition,
        goal = EXCLUDED.goal,
        steps = EXCLUDED.steps,
        recommended_cta = EXCLUDED.recommended_cta,
        confidence = EXCLUDED.confidence,
        continuity_boost_pct = EXCLUDED.continuity_boost_pct,
        status = EXCLUDED.status,
        updated_at = NOW()`,
      [
        'default',
        pb.name,
        pb.slug,
        pb.trigger_condition,
        pb.goal,
        JSON.stringify(pb.steps),
        pb.recommended_cta,
        pb.confidence,
        pb.continuity_boost_pct,
        pb.status
      ]
    );
    console.log(`[SEED] Upserted playbook: ${pb.slug} (${pb.name})`);
  }

  // 3. Populate initial learning suggestions from patterns
  const existingSuggestions = await pool.query('SELECT count(*) FROM ai_learning_suggestions WHERE company_id = $1', ['default']);
  if (parseInt(existingSuggestions.rows[0].count, 10) === 0) {
    await pool.query(
      `INSERT INTO ai_learning_suggestions
        (company_id, pattern_type, situation_summary, suggested_strategy, suggested_cta, suggested_steps, observed_frequency, continuity_impact_pct, status)
       VALUES
        ($1, 'objection_handling', 'Clientes que perguntam se entrega no interior ou em chácara sem asfalto', 'Validar condições de acesso do caminhão antes de confirmar frete', 'O acesso até sua chácara é de fácil entrada para caminhão toco ou precisa de veículo menor?', '["Confirmar estrada de terra ou asfalto", "Verificar limite de peso para o local"]'::jsonb, 14, 15.8, 'pending'),
        ($1, 'sales_strategy', 'Clientes que perguntam sobre churrasqueira trio solicitando medidas e cores', 'Enviar medidas detalhadas e opções de revestimento (tijolinho vermelho ou palha)', 'Temos no acabamento vermelho tradicional e mesclado. Prefere que eu envie fotos reais montadas?', '["Enviar medidas 2.20m x 2.20m", "Enviar fotos dos modelos", "Oferecer montagem especializada"]'::jsonb, 29, 24.5, 'pending')`,
      ['default']
    );
    console.log('[SEED] Inserted initial learning suggestions');
  }

  console.log('[SEED] Seeding completed successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('[SEED] Error during seeding:', err);
  process.exit(1);
});
