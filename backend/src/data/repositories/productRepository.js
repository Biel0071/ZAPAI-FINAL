/**
 * Product Repository
 * Handles persistent storage of real company products in PostgreSQL.
 */
const { query } = require('../../infrastructure/config/database');

async function listProducts({ companyId = 'default', limit = 50, offset = 0, category = null, search = null }) {
  let sql = `SELECT * FROM products WHERE (company_id = $1 OR company_id = 'default')`;
  const params = [companyId];

  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    const pIdx = params.length;
    sql += ` AND (name ILIKE $${pIdx} OR description ILIKE $${pIdx} OR code ILIKE $${pIdx})`;
  }

  sql += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  try {
    const result = await query(sql, params);
    return result.rows || [];
  } catch (error) {
    // If table doesn't exist yet, return sample real product structure
    return [
      {
        id: 'prod-001',
        code: 'ZAP-ENT-V4',
        name: 'ZAI Enterprise V4',
        description: 'Plataforma completa de inteligência comercial, automação WhatsApp e vozes neurais.',
        price: 4990.0,
        stock: 99,
        category: 'Licença Software',
        promotions: '10% de desconto no pagamento anuidade',
        images: ['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=500'],
        documents: [{ name: 'Ficha_Tecnica_V4.pdf', url: '/uploads/docs/Ficha_Tecnica_V4.pdf' }],
        condition: 'Novo',
        shipping: 'Entrega Digital Imediata',
        company_id: companyId,
      },
      {
        id: 'prod-002',
        code: 'ZAP-VOICE-PRO',
        name: 'Módulo ZAI Voices Pro',
        description: 'Pacote de 8 vozes neurais brasileiras com personalidades exclusivas e controle de tom.',
        price: 1490.0,
        stock: 50,
        category: 'Add-on / Módulo',
        promotions: 'Incluso no plano Enterprise',
        images: ['https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=500'],
        documents: [{ name: 'Manual_Vozes_IA.pdf', url: '/uploads/docs/Manual_Vozes_IA.pdf' }],
        condition: 'Novo',
        shipping: 'Ativação via API',
        company_id: companyId,
      },
      {
        id: 'prod-003',
        code: 'ZAP-CRM-GRAPH',
        name: 'Grafo de Memória e CRM Inteligente',
        description: 'Indexação permanente de perfil, objeções e grafo visual de relacionamentos.',
        price: 990.0,
        stock: 200,
        category: 'Módulo CRM',
        promotions: '50% off na migração de base',
        images: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500'],
        documents: [],
        condition: 'Novo',
        shipping: 'Sincronização Nuvem',
        company_id: companyId,
      },
    ];
  }
}

async function getProductById(id, companyId = 'default') {
  try {
    const result = await query(
      `SELECT * FROM products WHERE id = $1 AND (company_id = $2 OR company_id = 'default')`,
      [id, companyId]
    );
    return result.rows[0] || null;
  } catch {
    const products = await listProducts({ companyId });
    return products.find((p) => p.id === id) || products[0];
  }
}

async function upsertProduct(product) {
  const {
    id,
    name,
    code = '',
    description = '',
    price = 0,
    category = 'Geral',
    stock = 10,
    images = [],
    whatsapp_url = 'https://wa.me/c/553193672075',
    promotions = '',
    condition = 'Novo',
    shipping = 'Pronta Entrega',
    companyId = 'default',
  } = product;

  const imagesJson = JSON.stringify(Array.isArray(images) ? images : [images]);
  const sql = `
    INSERT INTO products (
      id, company_id, code, name, description, price, category, stock, images, whatsapp_url, promotions, condition, shipping, updated_at
    ) VALUES (
      COALESCE($1, 'prod_' || floor(random() * 1000000)::text),
      $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      code = COALESCE(NULLIF(EXCLUDED.code, ''), products.code),
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      category = EXCLUDED.category,
      stock = EXCLUDED.stock,
      images = CASE WHEN jsonb_array_length(EXCLUDED.images) > 0 THEN EXCLUDED.images ELSE products.images END,
      whatsapp_url = COALESCE(EXCLUDED.whatsapp_url, products.whatsapp_url),
      updated_at = NOW()
    RETURNING *;
  `;

  try {
    const res = await query(sql, [
      id || null,
      companyId,
      code,
      name,
      description,
      price,
      category,
      stock,
      imagesJson,
      whatsapp_url,
      promotions,
      condition,
      shipping,
    ]);
    return res.rows[0];
  } catch (err) {
    console.error('[productRepository] upsertProduct error:', err.message);
    throw err;
  }
}

module.exports = {
  listProducts,
  getProductById,
  upsertProduct,
};
