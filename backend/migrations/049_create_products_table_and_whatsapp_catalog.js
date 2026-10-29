'use strict';

module.exports = {
  version: '049_create_products_table_and_whatsapp_catalog',
  description: 'Create products table and seed official WhatsApp Business catalog for Deposito Vista Alegre (+55 31 9367-2075)',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL DEFAULT 'default',
        code VARCHAR(64),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        category VARCHAR(100) NOT NULL DEFAULT 'Geral',
        stock INTEGER DEFAULT 0,
        images JSONB DEFAULT '[]'::jsonb,
        whatsapp_url VARCHAR(500) DEFAULT 'https://wa.me/c/553193672075',
        promotions TEXT,
        condition VARCHAR(64) DEFAULT 'Novo',
        shipping VARCHAR(255) DEFAULT 'Pronta Entrega / Frete sob consulta',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_products_company_category
      ON products(company_id, category);

      CREATE INDEX IF NOT EXISTS idx_products_name
      ON products(company_id, name);

      INSERT INTO products (
        id, company_id, code, name, description, price, category, stock, images, whatsapp_url, promotions, condition, shipping
      ) VALUES
        (
          'prod_tijolo_8f_mil',
          'default',
          'TIJ-8F-MIL',
          'Tijolo Cerâmico 8 Furos 9x19x19cm (Milheiro)',
          'Tijolo cerâmico 8 furos padrão comercial 9x19x19cm. Excelente isolamento térmico e acústico, alta resistência e queima uniforme. Venda por milheiro (1.000 unidades) paletizado.',
          980.00,
          'Tijolos & Blocos',
          45,
          '["/uploads/quick_replies/qualidade_tijolo_1.mp4"]'::jsonb,
          'https://wa.me/c/553193672075',
          '5% de desconto no PIX/Dinheiro ou até 10x sem juros no cartão',
          'Novo',
          'Entrega com caminhão próprio com descarga rápida'
        ),
        (
          'prod_tijolo_macico_mil',
          'default',
          'TIJ-MAC-MIL',
          'Tijolo Maciço Comum 5x10x20cm (Milheiro)',
          'Tijolo de barro cozido maciço para alvenaria aparente, fornos a lenha, fogões a lenha e churrasqueiras rústicas. Alta durabilidade e acabamento colonial.',
          650.00,
          'Tijolos & Blocos',
          30,
          '["/uploads/quick_replies/tijolo_promo_1.mp4"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Desconto especial para cargas fechadas',
          'Novo',
          'Entrega imediata na Grande BH e região'
        ),
        (
          'prod_cimento_cp2_50kg',
          'default',
          'CIM-CPII-50',
          'Cimento CP-II E-32 50kg Nacional',
          'Cimento Portland Composto com escória granulada. Indicado para concreto armado, lajes, vigas, pilares, contrapisos e assentamento de alvenaria. Alta resistência inicial e final.',
          34.90,
          'Cimento & Argamassas',
          250,
          '["/uploads/quick_replies/cimento_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Preço promocional para compras acima de 50 sacos',
          'Novo',
          'Descarga no térreo inclusa na entrega'
        ),
        (
          'prod_cimento_cp3_50kg',
          'default',
          'CIM-CPIII-50',
          'Cimento CP-III 40 RS Resistente a Sulfatos (50kg)',
          'Cimento Portland de alto-forno com elevado teor de escória. Máxima impermeabilidade e alta resistência em fundações, subsolos e locais sujeitos à umidade.',
          37.50,
          'Cimento & Argamassas',
          120,
          '["/uploads/quick_replies/cimento_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Condição facilitada no cartão de crédito',
          'Novo',
          'Pronta entrega'
        ),
        (
          'prod_areia_media_m3',
          'default',
          'AGR-AREIA-M3',
          'Areia Média Lavada (m³)',
          'Areia média pura, limpa e lavada, isenta de terra ou matéria orgânica. Granulometria perfeita para preparo de concreto e argamassa de reboco.',
          110.00,
          'Areia & Brita',
          80,
          '["/uploads/quick_replies/blocos_promo_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Preço por metro cúbico (m³). Consulte frete para sua rua',
          'Novo',
          'Entrega em caminhão basculante'
        ),
        (
          'prod_brita_1_m3',
          'default',
          'AGR-BRITA-1-M3',
          'Brita 1 Granítica (m³)',
          'Pedra britada nº 1 (malha 19mm) de rocha sã granítica. Ideal para confecção de lajes maciças, sapatas, blocos de fundação e colunas de sustentação.',
          125.00,
          'Areia & Brita',
          60,
          '["/uploads/quick_replies/blocos_promo_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Desconto no combo Areia + Brita',
          'Novo',
          'Entrega expressa basculante'
        ),
        (
          'prod_churrasqueira_65cm',
          'default',
          'CHUR-65-COMP',
          'Churrasqueira Pré-Moldada Tijolinho 65cm Completa',
          'Churrasqueira pré-moldada estilo tijolinho vermelho cerâmico com revestimento refratário interno. Acompanha kit completo com grelha em inox, porta-espetos, gaveta cinzeiro e coifa.',
          890.00,
          'Churrasqueiras',
          18,
          '["/uploads/quick_replies/churras_2.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Kit inox incluso (grelha + porta-espetos inox)',
          'Novo',
          'Entrega programada para todo o vetor leste e BH'
        ),
        (
          'prod_churrasqueira_75cm_prem',
          'default',
          'CHUR-75-PREM',
          'Churrasqueira Predial Refratária 75cm Premium',
          'Churrasqueira pré-moldada de porte grande 75cm para áreas gourmet amplas. Coifa prolongada, refratários duplos de alta retenção térmica e acabamento liso moderno.',
          1290.00,
          'Churrasqueiras',
          9,
          '["/uploads/quick_replies/churras_11.jpg"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Parcelamento em até 10x sem juros',
          'Novo',
          'Montagem rápida por encaixe modulado'
        ),
        (
          'prod_telha_fibro_244',
          'default',
          'TEL-FIB-244',
          'Telha Fibrocimento 2,44 x 1,10m 6mm Brasilit/Eternit',
          'Telha ondulada sem amianto (tecnologia CRFS de alta resistência). Dimensões 2,44m comprimento x 1,10m largura e 6mm de espessura. Alta durabilidade e proteção contra intempéries.',
          58.00,
          'Coberturas & Telhas',
          200,
          '["/uploads/quick_replies/telha_black_1.mp4"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Desconto para quantidade de obra fechada',
          'Novo',
          'Pronta entrega'
        ),
        (
          'prod_caixa_dagua_1000l',
          'default',
          'CXA-1000L-FTL',
          'Caixa d''Água 1000L Polietileno com Tampa Fortlev',
          'Reservatório de água potável 1.000 Litros em polietileno virgem atóxico com proteção antibacteriana e anti-UV. Tampa de 1/4 de volta com trava segura contra insetos e sujeira.',
          380.00,
          'Caixas d''Água',
          28,
          '["/uploads/quick_replies/cx_promocao_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Garantia oficial de 5 anos pelo fabricante',
          'Novo',
          'Pronta entrega'
        ),
        (
          'prod_caixa_dagua_5000l',
          'default',
          'CXA-5000L-FTL',
          'Caixa d''Água 5.000 Litros Fortlev Polietileno',
          'Caixa d''água de grande capacidade (5.000L) com tripla camada de polietileno estrutural. Indicada para condomínios, estabelecimentos comerciais, fazendas e sítios.',
          2490.00,
          'Caixas d''Água',
          12,
          '["/uploads/quick_replies/cx_promocao_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Até 10x sem juros no cartão ou 5% à vista',
          'Novo',
          'Entrega com veículo apropriado'
        ),
        (
          'prod_betoneira_400l_2cv',
          'default',
          'BET-400L-2CV',
          'Betoneira 400L 2CV Monofásica Reforçada',
          'Betoneira profissional capacidade de mistura 400 Litros, motor monofásico de 2CV blindado WEG, cremalheira e pinhão em ferro fundido nodular e rodas maciças para canteiro.',
          3850.00,
          'Máquinas & Equipamentos',
          6,
          '["/uploads/quick_replies/betoneira_2.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Nota fiscal e garantia de 1 ano de fábrica',
          'Novo',
          'Frete sob consulta para Minas Gerais'
        ),
        (
          'prod_tinta_acrilica_18l',
          'default',
          'TNT-ACR-18L',
          'Tinta Acrílica Fosca Premium 18L Branco Neve',
          'Tinta acrílica lavável premium para paredes internas e externas. Rendimento de até 500m² por demão, secagem ultra rápida ao toque (30 min) e acabamento aveludado sem odor.',
          289.90,
          'Tintas & Acabamentos',
          42,
          '["/uploads/quick_replies/natal_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Leve 2 latas com frete grátis na região',
          'Novo',
          'Pronta entrega'
        ),
        (
          'prod_argamassa_ac3_20kg',
          'default',
          'ARG-AC3-20',
          'Argamassa AC-III 20kg Cinza Alta Aderência',
          'Argamassa flexível tipo AC-III para assentamento de porcelanatos, placas grandes, piscinas e sobreposição piso sobre piso. Secagem uniforme e máxima aderência.',
          32.90,
          'Cimento & Argamassas',
          180,
          '["/uploads/quick_replies/cimento_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Desconto progressivo por palete fechado',
          'Novo',
          'Pronta entrega'
        ),
        (
          'prod_bloco_estrutural_14',
          'default',
          'BLC-EST-14',
          'Bloco de Concreto Estrutural 14x19x39cm',
          'Bloco vazado de concreto vibroprensado para alvenaria estrutural e de vedação. Face perfeitamente alinhada, excelente resistência à compressão (>= 4.5 MPa) e redução no gasto de massa.',
          4.80,
          'Tijolos & Blocos',
          700,
          '["/uploads/quick_replies/blocos_promo_1.png"]'::jsonb,
          'https://wa.me/c/553193672075',
          'Venda unitária ou por palete com 108 unidades',
          'Novo',
          'Entrega rápida na obra'
        )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        category = EXCLUDED.category,
        stock = EXCLUDED.stock,
        images = EXCLUDED.images,
        whatsapp_url = EXCLUDED.whatsapp_url,
        promotions = EXCLUDED.promotions,
        condition = EXCLUDED.condition,
        shipping = EXCLUDED.shipping,
        updated_at = NOW();
    `);
  },
  async down(client) {
    await client.query(`DROP TABLE IF EXISTS products;`);
  }
};
