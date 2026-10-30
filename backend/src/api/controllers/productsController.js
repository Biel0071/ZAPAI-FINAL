const productRepository = require('../../data/repositories/productRepository');
const sessionManager = require('../../../services/sessionManager');
const { clearFastCache } = require('../middleware/fastCache');

// Authentic store catalog items from Depósito Vista Alegre (+55 31 9367-2075)
const CORE_STORE_PRODUCTS = [
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
    name: "CAIXA - 10.000L",
    description: "Reservatório de grande capacidade 10.000 Litros em polietileno virgem estrutural. Alta resistência contra intempéries e raios UV.",
    price: 2999.77,
    category: "Caixas d'Água",
    stock: 5,
    images: ['/assets/catalog/caixa_dagua.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Até 10x sem juros no cartão ou preço à vista negociável',
    condition: 'Novo',
    shipping: 'Frete especial com guincho/descarga apropriada',
  },
  {
    id: 'prod_caixa_5000l',
    code: 'CXA-5000L',
    name: 'CAIXA - 5000L',
    description: "Caixa d'água Fortlev 5.000 Litros em polietileno reforçado com tampa de encaixe rápido. Fechamento seguro anti-insetos e proteção UV total.",
    price: 1699.85,
    category: "Caixas d'Água",
    stock: 12,
    images: ['/assets/catalog/caixa_5000l.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Parcelamento em até 10x ou desconto especial no PIX',
    condition: 'Novo',
    shipping: 'Entrega rápida com caminhão do depósito',
  },
  {
    id: 'prod_caixa_2000l',
    code: 'CXA-2000L',
    name: 'CAIXA - 2000L',
    description: "Caixa d'água Fortlev 2.000 Litros azul resistente. Ideal para residências médias e comércios. Superfície interna lisa de fácil higienização.",
    price: 499.87,
    category: "Caixas d'Água",
    stock: 18,
    images: ['/assets/catalog/caixa_2000l.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Entrega imediata em toda a Grande BH',
    condition: 'Novo',
    shipping: 'Frete facilitado',
  },
  {
    id: 'prod_caixa_1000l',
    code: 'CXA-1000L',
    name: 'CAIXA - 1000L',
    description: "Caixa d'água Fortlev 1.000 Litros padrão residencial. Campeã de vendas, super reforçada, instalação prática e vedação 100% segura.",
    price: 250.00,
    category: "Caixas d'Água",
    stock: 25,
    images: ['/assets/catalog/caixa_1000l.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Preço promocional à vista',
    condition: 'Novo',
    shipping: 'Pronta entrega',
  },
  {
    id: 'prod_cimento_liz_cp4',
    code: 'CIM-LIZ-CP4',
    name: 'CIMENTO LIZ - CP4',
    description: 'Cimento Liz CP IV-32 RS de secagem rápida (Saco 50kg). Máxima resistência a sulfatos e agentes agressivos, acabamento perfeito para lajes e fundações.',
    price: 21.90,
    category: 'Cimento & Argamassa',
    stock: 400,
    images: ['/assets/catalog/cimento_liz.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Desconto especial para cargas fechadas e paletes',
    condition: 'Novo',
    shipping: 'Entrega paletizada rápida no canteiro',
  },
  {
    id: 'prod_churrasqueira_premoldada',
    code: 'CHU-PRE-65',
    name: 'CHURRASQUEIRA - PRÉ-MOLDADA',
    description: 'Churrasqueira pré-moldada em concreto refratário e acabamento tijolinho. Acompanha coifa, gaveta cinzeiro e suporte para espetos.',
    price: 990.00,
    category: 'Churrasqueiras & Lazer',
    stock: 7,
    images: ['/assets/catalog/churrasqueira_premoldada.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Montagem facilitada em módulos encaixáveis',
    condition: 'Novo',
    shipping: 'Entrega segura no local',
  },
  {
    id: 'prod_caminhao_brita',
    code: 'CAM-BRI-8M3',
    name: 'CAMINHÃO BRITA - 8M³',
    description: 'Carga fechada de brita graduada limpa (8 metros cúbicos) em caminhão basculante próprio. Ideal para concreto estrutural, calçadas e drenagem.',
    price: 850.00,
    category: 'Agregados & Areia',
    stock: 20,
    images: ['/assets/catalog/caminhao_brita.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Preço fechado da carga com entrega na região',
    condition: 'Novo',
    shipping: 'Descarga direta basculante',
  },
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
    id: 'prod_tijolo_macico_mil',
    code: 'TIJ-MAC-MIL',
    name: 'TIJOLO MACIÇO COMUM',
    description: 'Tijolo de barro cozido maciço para alvenaria aparente, fornos a lenha, fogões a lenha e churrasqueiras rústicas. Alta durabilidade e acabamento colonial.',
    price: 650.00,
    category: 'Tijolos & Blocos',
    stock: 30,
    images: ['/assets/catalog/tijolo_macico.jpg'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Desconto especial para cargas fechadas',
    condition: 'Novo',
    shipping: 'Entrega imediata na Grande BH e região',
  },
  {
    id: 'prod_telha_fibro_244',
    code: 'TEL-FIB-244',
    name: 'TELHA FIBROCIMENTO 2,44 x 1,10m',
    description: 'Telha ondulada sem amianto (tecnologia CRFS de alta resistência). Dimensões 2,44m comprimento x 1,10m largura e 6mm de espessura. Alta durabilidade.',
    price: 58.00,
    category: 'Coberturas & Telhas',
    stock: 200,
    images: ['/assets/catalog/telha_fibro.jpg'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Desconto para quantidade de obra fechada',
    condition: 'Novo',
    shipping: 'Pronta entrega',
  },
  {
    id: 'prod_cimento_cp2_50kg',
    code: 'CIM-CPII-50',
    name: 'CIMENTO CP-II 50KG',
    description: 'Cimento Portland Composto CP-II E-32 50kg Nacional. Indicado para concreto armado, lajes, vigas, pilares, contrapisos e assentamento de alvenaria.',
    price: 34.90,
    category: 'Cimento & Argamassa',
    stock: 250,
    images: ['/assets/catalog/cimento_cp2.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Preço promocional para compras acima de 50 sacos',
    condition: 'Novo',
    shipping: 'Descarga no térreo inclusa na entrega',
  },
  {
    id: 'prod_cimento_cp3_50kg',
    code: 'CIM-CPIII-50',
    name: 'CIMENTO CP-III 50KG (RS)',
    description: 'Cimento CP-III 40 RS Resistente a Sulfatos (50kg). Máxima impermeabilidade e alta resistência em fundações, subsolos e locais sujeitos à umidade.',
    price: 37.50,
    category: 'Cimento & Argamassa',
    stock: 120,
    images: ['/assets/catalog/cimento_cp2.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Condição facilitada no cartão de crédito',
    condition: 'Novo',
    shipping: 'Pronta entrega',
  },
  {
    id: 'prod_churrasqueira_75cm_prem',
    code: 'CHUR-75-PREM',
    name: 'CHURRASQUEIRA PREDIAL 75CM PREMIUM',
    description: 'Churrasqueira pré-moldada de porte grande 75cm para áreas gourmet amplas. Coifa prolongada, refratários duplos de alta retenção térmica e acabamento liso moderno.',
    price: 1290.00,
    category: 'Churrasqueiras & Lazer',
    stock: 9,
    images: ['/assets/catalog/churras_75.jpg'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Parcelamento em até 10x sem juros',
    condition: 'Novo',
    shipping: 'Montagem rápida por encaixe modulado',
  },
  {
    id: 'prod_areia_media_m3',
    code: 'AGR-AREIA-M3',
    name: 'AREIA MÉDIA LAVADA (M³)',
    description: 'Areia média pura, limpa e lavada, isenta de terra ou matéria orgânica. Granulometria perfeita para preparo de concreto e argamassa de reboco.',
    price: 110.00,
    category: 'Agregados & Areia',
    stock: 80,
    images: ['/assets/catalog/blocos.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Preço por metro cúbico (m³). Consulte frete para sua rua',
    condition: 'Novo',
    shipping: 'Entrega em caminhão basculante',
  },
  {
    id: 'prod_argamassa_ac3_20kg',
    code: 'ARG-AC3-20',
    name: 'ARGAMASSA AC-III 20KG',
    description: 'Argamassa flexível tipo AC-III para assentamento de porcelanatos, placas grandes, piscinas e sobreposição piso sobre piso. Secagem uniforme e máxima aderência.',
    price: 32.90,
    category: 'Cimento & Argamassa',
    stock: 180,
    images: ['/assets/catalog/cimento_cp2.png'],
    whatsapp_url: 'https://wa.me/c/553193672075',
    promotions: 'Desconto progressivo por palete fechado',
    condition: 'Novo',
    shipping: 'Pronta entrega',
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

async function syncWhatsAppCatalogInternal({ companyId = 'default', sessionId = 'main', sock = null, forceClean = false, limit = 50 } = {}) {
  let syncedCount = 0;
  let waFetched = 0;

  if (forceClean) {
    try {
      await productRepository.deleteProductsByCompany(companyId);
    } catch (_) {}
  }

  // Attempt live WhatsApp Business sync if an active session exists
  let activeSock = sock;
  let sessionPhone = '553193672075';
  try {
    if (!activeSock) {
      const { activeSessions } = require('../../../services/whatsapp/state/registry');
      console.log('[ProductsController] Registry activeSessions keys:', Object.keys(activeSessions || {}));
      
      const targetSession = (activeSessions && (activeSessions[sessionId] || activeSessions['main'])) || null;
      if (targetSession?.sock) {
        activeSock = targetSession.sock;
        console.log('[ProductsController] Found activeSock from activeSessions registry');
      } else {
        const session = sessionManager.getSession(sessionId);
        if (session?.sock) {
          activeSock = session.sock;
          console.log('[ProductsController] Found activeSock from sessionManager.getSession');
        } else {
          const allSessions = sessionManager.listSessions ? sessionManager.listSessions() : [];
          for (const s of allSessions) {
            const loaded = sessionManager.getSession(s.sessionId || s.name);
            if (loaded?.sock) {
              activeSock = loaded.sock;
              console.log('[ProductsController] Found activeSock from listSessions:', s.sessionId || s.name);
              break;
            }
          }
        }
      }
    }

    if (activeSock?.user?.id) {
      sessionPhone = String(activeSock.user.id).split(':')[0].split('@')[0];
    }

    const hasGetCatalog = typeof activeSock?.getCatalog === 'function';
    const isReady = Boolean(activeSock && (activeSock.user?.id || activeSock.ws) && hasGetCatalog);
    console.log(`[ProductsController] activeSock check: isReady=${isReady}, hasGetCatalog=${hasGetCatalog}, user=${JSON.stringify(activeSock?.user)}`);

    if (isReady) {
      const bizJid = sessionPhone ? `${sessionPhone}@s.whatsapp.net` : undefined;
      console.log(`[ProductsController] Querying live WhatsApp catalog for bizJid=${bizJid}, user=${JSON.stringify(activeSock?.user)}...`);

      // Attempt live catalog fetch using Baileys getCatalog with proper 35s timeout
      const tryFetchCatalog = async (options) => {
        try {
          console.log('[ProductsController] Calling activeSock.getCatalog with options:', JSON.stringify(options));
          const queryPromise = activeSock.getCatalog(options);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getCatalog timeout after 2.5s')), 2500)
          );
          return await Promise.race([queryPromise, timeoutPromise]);
        } catch (err) {
          console.warn('[ProductsController] getCatalog attempt failed:', err?.message || err);
          return null;
        }
      };

      let catalogResult = null;

      // Strategy 1: getCatalog with explicit target bizJid and limit
      if (bizJid) {
        catalogResult = await tryFetchCatalog({ jid: bizJid, limit });
      }

      // Strategy 2: getCatalog without jid (queries authenticated account directly)
      if (!catalogResult || !Array.isArray(catalogResult.products) || catalogResult.products.length === 0) {
        console.log('[ProductsController] Strategy 2: calling getCatalog without explicit jid...');
        catalogResult = await tryFetchCatalog({ limit });
      }

      // Strategy 3: getCatalog using LID if available
      if ((!catalogResult || !Array.isArray(catalogResult.products) || catalogResult.products.length === 0) && activeSock?.user?.lid) {
        const lidJid = activeSock.user.lid.split(':')[0] + '@lid';
        console.log('[ProductsController] Strategy 3: calling getCatalog with LID jid:', lidJid);
        catalogResult = await tryFetchCatalog({ jid: lidJid, limit });
      }

      // Strategy 4: Raw IQ query if getCatalog wrapper failed
      if (!catalogResult || !Array.isArray(catalogResult.products) || catalogResult.products.length === 0) {
        try {
          console.log('[ProductsController] Strategy 4: sending direct binary IQ query for product_catalog...');
          const { parseCatalogNode } = require('@whiskeysockets/baileys/lib/Utils/business');
          const queryNode = {
            tag: 'iq',
            attrs: {
              to: 's.whatsapp.net',
              type: 'get',
              xmlns: 'w:biz:catalog'
            },
            content: [
              {
                tag: 'product_catalog',
                attrs: {
                  jid: bizJid || activeSock?.user?.id?.split(':')[0] + '@s.whatsapp.net',
                  allow_shop_source: 'true'
                },
                content: [
                  { tag: 'limit', attrs: {}, content: Buffer.from('100') },
                  { tag: 'width', attrs: {}, content: Buffer.from('500') },
                  { tag: 'height', attrs: {}, content: Buffer.from('500') }
                ]
              }
            ]
          };
          const rawRes = await activeSock.query(queryNode, 3000);
          console.log('[ProductsController] Raw IQ response received!');
          if (rawRes) {
            catalogResult = parseCatalogNode(rawRes);
            console.log('[ProductsController] Parsed products from raw IQ:', catalogResult?.products?.length);
          }
        } catch (rawErr) {
          console.warn('[ProductsController] Strategy 4 raw IQ failed:', rawErr?.message || rawErr);
        }
      }

      if (catalogResult && Array.isArray(catalogResult.products) && catalogResult.products.length > 0) {
        waFetched = catalogResult.products.length;
        console.log(`[ProductsController] Successfully retrieved ${waFetched} products from WhatsApp Meta servers.`);
        
        // If we fetched real products from WhatsApp Business, remove any mock/core fallback products
        if (forceClean || waFetched > 0) {
          try {
            await productRepository.deleteProductsByCompany(companyId);
          } catch (_) {}
        }

        for (const item of catalogResult.products) {
          let priceVal = Number(item.price) || 0;
          // WhatsApp Business prices are typically in milliunits (1/1000th) or integer cents
          if (priceVal >= 1000) {
            priceVal = priceVal / 1000;
          }

          const productImages = Array.isArray(item.imageUrls) && item.imageUrls.length > 0
            ? item.imageUrls
            : (item.image ? [item.image] : []);

          await productRepository.upsertProduct({
            id: item.id ? `wa_${item.id}` : undefined,
            name: item.name || item.title || 'Produto WhatsApp',
            code: item.retailerId || item.id || '',
            description: item.description || '',
            price: priceVal,
            category: 'WhatsApp Business',
            images: productImages,
            whatsapp_url: item.url || `https://wa.me/p/${item.id}/${sessionPhone}`,
            companyId,
          });
          syncedCount++;
        }
      }
    }
  } catch (waErr) {
    console.warn('[ProductsController] WhatsApp getCatalog query returned:', waErr.message);
  }

  // Upsert authentic core store catalog products if no live items were fetched from Meta
  if (waFetched === 0) {
    for (const coreProd of CORE_STORE_PRODUCTS) {
      await productRepository.upsertProduct({
        ...coreProd,
        companyId,
      });
      syncedCount++;
    }
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
