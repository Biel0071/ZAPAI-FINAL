'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zapai_crm',
});

const realProducts = [
  {
    id: 'prod_bloco_10_100un',
    code: 'BLOC-10-100',
    name: 'BLOCO 10 - 100 UN',
    description: 'Bloco de concreto estrutural 10x19x39 cm - lote com 100 unidades.',
    price: 134.99,
    category: 'Tijolos & Blocos',
    stock: 50,
    images: [
      '/assets/catalog/real/bloco_10_100un.png',
      '/assets/catalog/real/bloco_10_100un_2.png',
      '/assets/catalog/real/bloco_10_100un_3.png'
    ],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Lote com 100 unidades',
    condition: 'Novo',
    shipping: 'Pronta entrega',
    company_id: 'default',
  },
  {
    id: 'prod_argamassa_ac3',
    code: 'ARG-AC3-20',
    name: 'ARGAMASSA - AC3',
    description: 'Argamassa colante DVG Precon AC-III 20kg de alta aderência e flexibilidade para porcelanatos e fachadas.',
    price: 19.90,
    category: 'Cimento & Argamassa',
    stock: 100,
    images: ['/assets/catalog/real/argamassa_ac3.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Saco 20kg',
    condition: 'Novo',
    shipping: 'Pronta entrega',
    company_id: 'default',
  },
  {
    id: 'prod_argamassa_ac2',
    code: 'ARG-AC2-20',
    name: 'ARGAMASSA - AC2',
    description: 'Argamassa colante DVG Precon AC-II 20kg para áreas internas e externas.',
    price: 16.90,
    category: 'Cimento & Argamassa',
    stock: 100,
    images: ['/assets/catalog/real/argamassa_ac2.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Saco 20kg',
    condition: 'Novo',
    shipping: 'Pronta entrega',
    company_id: 'default',
  },
  {
    id: 'prod_argamassa_ac1',
    code: 'ARG-AC1-20',
    name: 'ARGAMASSA - AC1',
    description: 'Argamassa colante DVG Precon AC-I 20kg para pisos e azulejos em áreas internas.',
    price: 14.80,
    category: 'Cimento & Argamassa',
    stock: 100,
    images: ['/assets/catalog/real/argamassa_ac1.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Saco 20kg',
    condition: 'Novo',
    shipping: 'Pronta entrega',
    company_id: 'default',
  },
  {
    id: 'prod_caminhao_areia_9m3',
    code: 'CAM-AREIA-9M3',
    name: 'CAMINHÃO DE AREIA - 9M³',
    description: 'Caminhão de areia lavada fechado (9 metros cúbicos) para grandes obras.',
    price: 700.00,
    category: 'Agregados & Areia',
    stock: 20,
    images: ['/assets/catalog/real/caminhao_areia.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Carga completa 9m³',
    condition: 'Novo',
    shipping: 'Entrega basculante em BH e região',
    company_id: 'default',
  },
  {
    id: 'prod_areia_m3',
    code: 'AREIA-M3',
    name: 'AREIA - M³',
    description: 'Areia média lavada por metro cúbico (m³) para reboco e concreto.',
    price: 100.00,
    category: 'Agregados & Areia',
    stock: 100,
    images: ['/assets/catalog/real/areia_m3.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Valor por m³',
    condition: 'Novo',
    shipping: 'Pronta entrega',
    company_id: 'default',
  },
];

async function run() {
  await pool.query('DELETE FROM products WHERE company_id = $1', ['default']);
  console.log('Cleared old dummy products from products table.');

  for (const p of realProducts) {
    const sql = `
      INSERT INTO products (
        id, company_id, code, name, description, price, category, stock,
        images, whatsapp_url, promotions, condition, shipping, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, NOW(), NOW())
    `;
    await pool.query(sql, [
      p.id,
      p.company_id,
      p.code,
      p.name,
      p.description,
      p.price,
      p.category,
      p.stock,
      JSON.stringify(p.images),
      p.whatsapp_url,
      p.promotions,
      p.condition,
      p.shipping,
    ]);
  }
  console.log(`Successfully inserted ${realProducts.length} verified real products into database!`);
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
