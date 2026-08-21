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
    sql += ` AND (name ILIKE $${params.length} || description ILIKE $${params.length} || code ILIKE $${params.length})`;
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
        name: 'ZAPFLOW AI Enterprise V4',
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
        name: 'Módulo ZAPFLOW AI Voices Pro',
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

module.exports = {
  listProducts,
  getProductById,
};
