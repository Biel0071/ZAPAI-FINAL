const productRepository = require('../../data/repositories/productRepository');
const sessionManager = require('../../../services/sessionManager');
const { clearFastCache } = require('../middleware/fastCache');

// Authentic store catalog items from Depósito Vista Alegre (+55 31 9367-2075)
const CORE_STORE_PRODUCTS = [
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
  },
];

async function getProducts(req, res) {
  try {
    const companyId = req.companyId || req.user?.companyId || 'default';
    const { category, search, limit, offset } = req.query;

    const products = await productRepository.listProducts({
      companyId,
      category,
      search,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });

    return res.json({
      success: true,
      data: products,
      total: products.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao carregar lista de produtos',
    });
  }
}

async function getProductById(req, res) {
  try {
    const companyId = req.companyId || req.user?.companyId || 'default';
    const { id } = req.params;

    const product = await productRepository.getProductById(id, companyId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function syncWhatsAppCatalogInternal({ companyId = 'default', sessionId = 'main', sock = null } = {}) {
  let syncedCount = 0;
  let waFetched = 0;

  // First ensure baseline core products are always synced in PostgreSQL
  for (const coreProd of CORE_STORE_PRODUCTS) {
    await productRepository.upsertProduct({
      ...coreProd,
      companyId,
    });
  }

  // Attempt live WhatsApp Business sync if an active session exists
  let activeSock = sock;
  try {
    if (!activeSock) {
      const session = sessionManager.getSession(sessionId);
      if (session?.sock) {
        activeSock = session.sock;
      } else {
        const allSessions = sessionManager.listSessions ? sessionManager.listSessions() : [];
        for (const s of allSessions) {
          const loaded = sessionManager.getSession(s.sessionId || s.name);
          if (loaded?.sock) {
            activeSock = loaded.sock;
            break;
          }
        }
      }
    }

    if (activeSock && typeof activeSock.getCatalog === 'function') {
      const catalogResult = await activeSock.getCatalog({ limit: 50 });
      if (catalogResult && Array.isArray(catalogResult.products) && catalogResult.products.length > 0) {
        waFetched = catalogResult.products.length;
        for (const item of catalogResult.products) {
          let priceVal = Number(item.price) || 0;
          if (priceVal > 10000) {
            priceVal = priceVal / 1000;
          }
          await productRepository.upsertProduct({
            id: item.id ? `wa_${item.id}` : undefined,
            name: item.name || 'Produto WhatsApp',
            code: item.retailerId || item.id || '',
            description: item.description || '',
            price: priceVal,
            category: 'WhatsApp Business',
            images: item.imageUrls || (item.image && [item.image]) || [],
            whatsapp_url: item.url || `https://wa.me/c/553193672075`,
            companyId,
          });
          syncedCount++;
        }
      }
    }
  } catch (waErr) {
    console.warn('[ProductsController] WhatsApp getCatalog query returned:', waErr.message);
  }

  // Clear fast cache so fresh products are served immediately
  if (typeof clearFastCache === 'function') {
    clearFastCache();
  }

  const currentProducts = await productRepository.listProducts({ companyId });

  // Broadcast realtime socket event to all clients so they immediately show updated products
  try {
    const io = global.io;
    if (io) {
      io.emit('catalog:synced', {
        sessionId,
        companyId,
        synced: syncedCount,
        waFetched,
        total: currentProducts.length,
        products: currentProducts,
      });
    }
  } catch (ioErr) {
    console.warn('[ProductsController] Socket broadcast error:', ioErr.message);
  }

  return {
    success: true,
    synced: syncedCount,
    waFetched,
    total: currentProducts.length,
    data: currentProducts,
    message: syncedCount > 0
      ? `${syncedCount} produtos importados do WhatsApp Business com sucesso!`
      : `Catálogo de produtos sincronizado com sucesso (${currentProducts.length} itens disponíveis).`,
  };
}

async function syncWhatsAppCatalog(req, res) {
  try {
    const companyId = req.companyId || req.user?.companyId || 'default';
    const sessionId = req.body?.sessionId || req.query?.sessionId || 'main';
    const result = await syncWhatsAppCatalogInternal({ companyId, sessionId });
    return res.json(result);
  } catch (error) {
    console.error('[ProductsController] syncWhatsAppCatalog error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getProducts,
  getProductById,
  syncWhatsAppCatalog,
  syncWhatsAppCatalogInternal,
  CORE_STORE_PRODUCTS,
};
