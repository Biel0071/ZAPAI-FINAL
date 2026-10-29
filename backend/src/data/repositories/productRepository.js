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
    // If table doesn't exist yet, return official store products
    return [
      {
        id: 'prod_betoneira_csm_400l',
        code: 'BET-CSM-400L',
        name: 'BETONEIRA - CSM - 400L',
        description: 'Betoneira 400L CSM com motor profissional de alto torque. Estrutura reforçada, descarga rápida e máxima durabilidade para obras pesadas.',
        price: 3499.00,
        category: 'Máquinas & Equipamentos',
        stock: 8,
        images: ['/assets/catalog/betoneira_csm_400l.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        promotions: 'Frete especial na Grande BH ou parcelamento facilitado no cartão',
        condition: 'Novo',
        shipping: 'Entrega rápida com caminhão próprio',
        company_id: companyId,
      },
      {
        id: 'prod_tijolo_12_furos',
        code: 'TIJ-12F',
        name: 'TIJOLO 12 FUROS',
        description: 'Tijolo cerâmico 12 furos de primeira linha. Alto isolamento térmico e acústico, perfeito para paredes externas e divisórias de precisão.',
        price: 900.00,
        category: 'Tijolos & Blocos',
        stock: 35,
        images: ['/assets/catalog/tijolo_12_furos.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        promotions: 'Preço por milheiro (1.000 unidades) paletizado',
        condition: 'Novo',
        shipping: 'Descarga rápida no canteiro de obras',
        company_id: companyId,
      },
      {
        id: 'prod_tijolo_9_furos',
        code: 'TIJ-9F',
        name: 'TIJOLO 9 FUROS',
        description: 'Tijolo cerâmico 9 furos padrão estrutural e vedação. Queima perfeita, economia de argamassa e grande resistência mecânica.',
        price: 850.00,
        category: 'Tijolos & Blocos',
        stock: 40,
        images: ['/assets/catalog/tijolo_9_furos.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        promotions: 'Desconto progressivo para cargas completas',
        condition: 'Novo',
        shipping: 'Pronta entrega',
        company_id: companyId,
      },
      {
        id: 'prod_tijolo_8f_mil',
        code: 'TIJ-8F',
        name: 'TIJOLO 8 FUROS',
        description: 'Tijolo cerâmico 8 furos padrão comercial 9x19x19cm (Milheiro). Venda paletizada com garantia de qualidade e resistência uniforme.',
        price: 780.00,
        category: 'Tijolos & Blocos',
        stock: 50,
        images: ['/assets/catalog/tijolo_8_furos.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        promotions: 'Valor por milheiro. 5% de desconto no PIX',
        condition: 'Novo',
        shipping: 'Entrega imediata na Grande BH e região',
        company_id: companyId,
      },
      {
        id: 'prod_telhas_ceramica',
        code: 'TEL-CER',
        name: 'TELHAS CERÂMICA',
        description: 'Telhas cerâmicas coloniais esmaltadas e naturais de alta resistência. Encaixe perfeito, proteção térmica superior e acabamento nobre.',
        price: 3.20,
        category: 'Coberturas & Telhas',
        stock: 5000,
        images: ['/assets/catalog/telhas_ceramica.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        promotions: 'Venda por unidade ou milheiro fechado',
        condition: 'Novo',
        shipping: 'Entrega paletizada com proteção contra quebra',
        company_id: companyId,
      },
      {
        id: 'prod_caixa_dagua_10000l',
        code: 'CXA-10000L',
        name: "CAIXA D'ÁGUA 10.000L",
        description: "Reservatório de grande capacidade 10.000 Litros em polietileno virgem estrutural. Alta resistência contra intempéries e raios UV.",
        price: 4290.00,
        category: "Caixas d'Água",
        stock: 5,
        images: ['/assets/catalog/caixa_dagua.png'],
        whatsapp_url: 'https://wa.me/c/553193672075',
        promotions: 'Até 10x sem juros no cartão ou preço à vista negociável',
        condition: 'Novo',
        shipping: 'Frete especial com guincho/descarga apropriada',
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
  upsertProduct,
  deleteProductsByCompany,
};
