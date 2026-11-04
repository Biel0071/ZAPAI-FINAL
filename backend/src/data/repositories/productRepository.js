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

  sql += ` ORDER BY 
    CASE id
      WHEN 'prod_caixa_5000l' THEN 1
      WHEN 'prod_caixa_2000l' THEN 2
      WHEN 'prod_caixa_1000l' THEN 3
      WHEN 'prod_cimento_liz_cp4' THEN 4
      WHEN 'prod_churrasqueira_premoldada' THEN 5
      WHEN 'prod_caminhao_brita_8m3' THEN 6
      WHEN 'prod_tijolo_12_furos' THEN 7
      WHEN 'prod_tijolo_9_furos' THEN 8
      WHEN 'prod_tijolo_8_furos' THEN 9
      WHEN 'prod_telhas_ceramica' THEN 10
      WHEN 'prod_caixa_10000l' THEN 11
      WHEN 'prod_bloco_10_100un' THEN 12
      WHEN 'prod_argamassa_ac3' THEN 13
      WHEN 'prod_argamassa_ac2' THEN 14
      WHEN 'prod_argamassa_ac1' THEN 15
      WHEN 'prod_caminhao_areia_9m3' THEN 16
      WHEN 'prod_areia_m3' THEN 17
      WHEN 'prod_telha_fibrocimento_244' THEN 18
      WHEN 'prod_caixa_500l' THEN 19
      ELSE 999
    END ASC, name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  try {
    const result = await query(sql, params);
    if (result.rows && result.rows.length > 0) {
      return result.rows;
    }
  } catch (error) {
    // If table doesn't exist yet or query fails, return official store products
  }
  let fallback = [
      {
        id: 'prod_caixa_5000l',
        code: 'CX-5000',
        name: 'CAIXA - 5000L',
        description: "Caixa d'água Fortlev 5.000 Litros em polietileno virgem estrutural.",
        price: 1699.85,
        category: "Caixas d'Água",
        stock: 12,
        images: ['/assets/catalog/caixa_5000l.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_caixa_2000l',
        code: 'CX-2000',
        name: 'CAIXA - 2000L',
        description: "Caixa d'água Fortlev 2.000 Litros polietileno virgem com proteção UV.",
        price: 499.87,
        category: "Caixas d'Água",
        stock: 18,
        images: ['/assets/catalog/caixa_2000l.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_caixa_1000l',
        code: 'CX-1000',
        name: 'CAIXA - 1000L',
        description: "Caixa d'água Fortlev 1.000 Litros residencial super reforçada.",
        price: 250.00,
        category: "Caixas d'Água",
        stock: 25,
        images: ['/assets/catalog/caixa_1000l.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_cimento_liz_cp4',
        code: 'CIM-LIZ-CP4',
        name: 'CIMENTO LIZ - CP4',
        description: 'Cimento Liz CP IV-32 RS secagem rápida (Saco 50kg) resistente a sulfatos.',
        price: 21.90,
        category: 'Cimento & Argamassa',
        stock: 400,
        images: ['/assets/catalog/real/cimento_liz.png', '/assets/catalog/cimento_cp2.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_churrasqueira_premoldada',
        code: 'CHURR-PRE',
        name: 'CHURRASQUEIRA - PRÉ-MOLDADA',
        description: 'Churrasqueira pré-moldada em concreto refratário c/ coifa e suporte de espetos.',
        price: 990.00,
        category: 'Churrasqueiras & Lazer',
        stock: 12,
        images: ['/assets/catalog/real/churrasqueira_premoldada.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_caminhao_brita_8m3',
        code: 'CAM-BRI-8M3',
        name: 'CAMINHÃO BRITA - 8M³',
        description: 'Carga fechada de brita nº 1 granítica (8 metros cúbicos) em basculante.',
        price: 850.00,
        category: 'Agregados & Areia',
        stock: 25,
        images: ['/assets/catalog/caminhao_brita.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_tijolo_12_furos',
        code: 'TIJ-12F',
        name: 'TIJOLO 12 FUROS',
        description: 'Milheiro de tijolo cerâmico 12 furos estrutural e vedação de primeira linha.',
        price: 900.00,
        category: 'Tijolos & Blocos',
        stock: 3500,
        images: ['/assets/catalog/tijolo_12_furos.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_tijolo_9_furos',
        code: 'TIJ-9F',
        name: 'TIJOLO 9 FUROS',
        description: 'Milheiro de tijolo cerâmico 9 furos paletizado de primeira queima.',
        price: 850.00,
        category: 'Tijolos & Blocos',
        stock: 25,
        images: ['/assets/catalog/tijolo_9_furos.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_tijolo_8_furos',
        code: 'TIJ-8F',
        name: 'TIJOLO 8 FUROS',
        description: 'Milheiro de tijolo cerâmico 8 furos tradicional para fechamento e alvenaria.',
        price: 780.00,
        category: 'Tijolos & Blocos',
        stock: 4000,
        images: ['/assets/catalog/tijolo_8_furos.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_telhas_ceramica',
        code: 'TEL-CER',
        name: 'TELHAS CERÂMICA',
        description: 'Telha cerâmica colonial/romana esmaltada de alto encaixe e acabamento impecável.',
        price: 3.20,
        category: 'Coberturas & Telhas',
        stock: 2500,
        images: ['/assets/catalog/telhas_ceramica.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_caixa_10000l',
        code: 'CX-10000',
        name: 'CAIXA - 10.000L',
        description: 'Reservatório de 10.000 Litros em polietileno virgem de alta resistência.',
        price: 2999.77,
        category: "Caixas d'Água",
        stock: 5,
        images: ['/assets/catalog/caixa_dagua.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_bloco_10_100un',
        code: 'BLOC-10-100',
        name: 'BLOCO 10 - 100 UN',
        description: 'Bloco de concreto estrutural 10 (fardo com 100 unidades). Alta resistência à compressão.',
        price: 134.99,
        category: 'Tijolos & Blocos',
        stock: 150,
        images: ['/assets/catalog/real/bloco_10_100un.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_argamassa_ac3',
        code: 'ARG-AC3-20',
        name: 'ARGAMASSA - AC3',
        description: 'Argamassa colante DVG Precon AC-III 20kg para porcelanatos e fachadas.',
        price: 19.90,
        category: 'Cimento & Argamassa',
        stock: 250,
        images: ['/assets/catalog/real/argamassa_ac3.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_argamassa_ac2',
        code: 'ARG-AC2-20',
        name: 'ARGAMASSA - AC2',
        description: 'Argamassa colante DVG Precon AC-II 20kg para áreas internas e externas.',
        price: 16.90,
        category: 'Cimento & Argamassa',
        stock: 200,
        images: ['/assets/catalog/real/argamassa_ac2.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_argamassa_ac1',
        code: 'ARG-AC1-20',
        name: 'ARGAMASSA - AC1',
        description: 'Argamassa colante DVG Precon AC-I 20kg para ambientes internos.',
        price: 14.80,
        category: 'Cimento & Argamassa',
        stock: 200,
        images: ['/assets/catalog/real/argamassa_ac1.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_caminhao_areia_9m3',
        code: 'CAM-AREIA-9M3',
        name: 'CAMINHÃO DE AREIA - 9M³',
        description: 'Carga fechada de caminhão basculante com 9 metros cúbicos de areia média lavada.',
        price: 700.00,
        category: 'Agregados & Areia',
        stock: 30,
        images: ['/assets/catalog/real/caminhao_areia.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_areia_m3',
        code: 'AREIA-M3',
        name: 'AREIA - M³',
        description: 'Metro cúbico (m³) de areia média lavada limpa para concreto e reboco.',
        price: 100.00,
        category: 'Agregados & Areia',
        stock: 90,
        images: ['/assets/catalog/real/areia_m3.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_telha_fibrocimento_244',
        code: 'TEL-FIB-244',
        name: 'TELHA FIBROCIMENTO 2,44 x 1,10m',
        description: 'Telha ondulada 6mm sem amianto, alta durabilidade e proteção térmica.',
        price: 58.00,
        category: 'Coberturas & Telhas',
        stock: 180,
        images: ['/assets/catalog/telha_fibro.jpg'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
      {
        id: 'prod_caixa_500l',
        code: 'CX-500',
        name: "CAIXA D'ÁGUA FORTLEV 500L",
        description: "Caixa d'Água 500 Litros Fortlev atóxica com tampa rosqueável.",
        price: 199.00,
        category: "Caixas d'Água",
        stock: 35,
        images: ['/assets/catalog/caixa_dagua.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        company_id: companyId,
      },
    ];
    if (category) {
      fallback = fallback.filter((p) => p.category === category);
    }
    if (search) {
      const s = String(search).toLowerCase();
      fallback = fallback.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(s)) ||
          (p.description && p.description.toLowerCase().includes(s)) ||
          (p.code && p.code.toLowerCase().includes(s))
      );
    }
    return fallback.slice(offset, offset + limit);
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

async function deleteProduct(id, companyId = 'default') {
  try {
    await query(`DELETE FROM products WHERE id = $1 AND (company_id = $2 OR company_id = 'default')`, [id, companyId]);
    return true;
  } catch (err) {
    console.error('[productRepository] deleteProduct error:', err.message);
    return false;
  }
}

async function deleteProductsByCompany(companyId = 'default') {
  try {
    await query(`DELETE FROM products WHERE company_id = $1`, [companyId]);
    return true;
  } catch (err) {
    console.error('[productRepository] deleteProductsByCompany error:', err.message);
    return false;
  }
}

module.exports = {
  listProducts,
  getProductById,
  findById: getProductById,
  findByCompanyId: (companyId = 'default', options = {}) => listProducts({ companyId, ...options }),
  upsertProduct,
  deleteProduct,
  deleteProductsByCompany,
};
