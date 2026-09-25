module.exports = {
  version: '038_store_attendant_customization',
  description: 'Add store theme color, address, and customizable attendant profile fields to ai_stores',
  async up(client) {
    await client.query(`
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS theme_color TEXT NOT NULL DEFAULT '#10b981';
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS attendant_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS attendant_role TEXT NOT NULL DEFAULT 'Assistente de Vendas';
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS attendant_config JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);

    // Ensure default store exists for existing companies if empty
    const checkStores = await client.query('SELECT COUNT(*)::int AS count FROM ai_stores');
    if (checkStores.rows[0].count === 0) {
      await client.query(`
        INSERT INTO ai_stores (
          company_id, id, name, segment, address, phone, website, business_hours,
          policies, catalog_summary, knowledge, theme_color, attendant_name, attendant_role, attendant_config
        ) VALUES (
          'default',
          'store-default-01',
          'Depósito Vista Alegre',
          'Materiais de Construção & Reforma',
          'Av. Comercial Vista Alegre, 1200 - Centro',
          '(31) 99380-7167',
          'www.depositovistaalegre.com.br',
          'Seg a Sex: 07:30 às 18:00 | Sábado: 07:30 às 13:00',
          'Garantia de 90 dias em ferramentas. Frete grátis em compras acima de R$ 200,00 na região. Desconto de 5% no PIX ou até 6x sem juros.',
          'Cimento CP-II e CP-III (50kg), Churrasqueiras pré-moldadas completas, Tijolos 8 furos e maciços, Tintas acrílicas Coral e Suvinil 18L, Telhas de fibrocimento, Areia e brita por metro.',
          'Atendimento ágil pelo WhatsApp. Entregas expressas em até 4 horas para pedidos confirmados pela manhã. Emissão de nota fiscal para CNPJ e CPF.',
          '#10b981',
          'Camila',
          'Especialista em Vendas & Orçamentos',
          '{"hairColor": "#4a2c11", "clothingColor": "#10b981", "clothingStyle": "uniforme_loja", "accessories": ["headset", "cracha"], "scene": "escritorio_zai", "gender": "female"}'::jsonb
        ) ON CONFLICT (company_id, id) DO NOTHING
      `);
    }
  },
  async down(client) {
    await client.query(`
      ALTER TABLE ai_stores DROP COLUMN IF EXISTS theme_color;
      ALTER TABLE ai_stores DROP COLUMN IF EXISTS address;
      ALTER TABLE ai_stores DROP COLUMN IF EXISTS attendant_name;
      ALTER TABLE ai_stores DROP COLUMN IF EXISTS attendant_role;
      ALTER TABLE ai_stores DROP COLUMN IF EXISTS attendant_config;
      ALTER TABLE ai_stores DROP COLUMN IF EXISTS settings;
    `);
  }
};
