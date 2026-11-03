'use strict';

/**
 * ZaiCommerceTools — ZAPFLOW AI Agent Commerce Tools
 * Conjunto de ferramentas de comércio conectadas ao catálogo real e ao motor de orçamentos.
 * Permite que a IA atenda o cliente, consulte produtos reais, monte orçamentos estruturados
 * e envie ao WhatsApp para aprovação sem jamais inventar produtos ou valores fictícios.
 */

const productRepository = require('../../src/data/repositories/productRepository');
const commerceQuoteEngine = require('./CommerceQuoteEngine');
const { query: dbQuery } = require('../../src/infrastructure/config/database');

const COMMERCE_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_catalog',
      description: 'Busca produtos reais disponíveis no catálogo do WhatsApp do depósito por palavra-chave ou categoria.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca (ex: "bloco", "argamassa", "areia")' },
          category: { type: 'string', description: 'Categoria opcional (ex: "Tijolos & Blocos", "Cimento & Argamassa")' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Obtém detalhes completos de um produto específico (preço, código, fotos, disponibilidade).',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'ID ou código do produto no catálogo' },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_quote',
      description: 'Cria um novo orçamento estruturado no sistema com base na solicitação de compra do cliente.',
      parameters: {
        type: 'object',
        properties: {
          clientPhone: { type: 'string', description: 'Telefone do cliente com DDD (ex: "31999999999")' },
          items: {
            type: 'array',
            description: 'Lista de itens selecionados do catálogo',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'ID do produto no catálogo' },
                quantity: { type: 'number', description: 'Quantidade desejada' },
              },
              required: ['productId', 'quantity'],
            },
          },
          shippingAmount: { type: 'number', description: 'Valor calculado do frete em reais' },
          discountValue: { type: 'number', description: 'Valor de desconto concedido' },
          notes: { type: 'string', description: 'Observações de entrega, endereço ou prazo' },
        },
        required: ['clientPhone', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_shipping',
      description: 'Calcula estimativa de frete com base no bairro, CEP ou município de entrega na Grande BH.',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'Bairro, endereço ou CEP de entrega' },
          hasHeavyCargo: { type: 'boolean', description: 'Se a carga envolve caminhão de areia, brita ou grande peso' },
        },
        required: ['destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_quote',
      description: 'Dispara a mensagem oficial do orçamento formatado para o WhatsApp do cliente.',
      parameters: {
        type: 'object',
        properties: {
          quoteId: { type: 'string', description: 'ID do orçamento retornado em create_quote' },
        },
        required: ['quoteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Consulta o status de um pedido ou orçamento de um cliente.',
      parameters: {
        type: 'object',
        properties: {
          clientPhone: { type: 'string', description: 'Telefone do cliente' },
          orderOrQuoteId: { type: 'string', description: 'ID ou código do pedido/orçamento opcional' },
        },
        required: ['clientPhone'],
      },
    },
  },
];

class ZaiCommerceTools {
  getToolDefinitions() {
    return COMMERCE_TOOL_DEFINITIONS;
  }

  async executeTool(name, args = {}, context = {}) {
    const companyId = context.companyId || 'default';
    const conversationId = context.conversationId || null;
    const clientPhone = args.clientPhone || context.phone || null;

    console.log(`[ZAI-COMMERCE-TOOLS] Executando ferramenta "${name}" com args:`, JSON.stringify(args));

    switch (name) {
      case 'search_catalog': {
        const queryStr = String(args.query || '').trim().toLowerCase();
        const allProducts = await productRepository.listProducts({ companyId });

        const filtered = allProducts.filter((p) => {
          const matchName = String(p.name || '').toLowerCase().includes(queryStr);
          const matchDesc = String(p.description || '').toLowerCase().includes(queryStr);
          const matchCat = args.category ? String(p.category || '').toLowerCase().includes(args.category.toLowerCase()) : true;
          return (matchName || matchDesc) && matchCat;
        });

        return {
          count: filtered.length,
          products: filtered.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            price: Number(p.price) || 0,
            category: p.category,
            shipping: p.shipping,
            whatsapp_url: p.whatsapp_url,
          })),
        };
      }

      case 'get_product_details': {
        const p = await productRepository.findById(args.productId, companyId);
        if (!p) {
          return { found: false, error: 'Produto não encontrado no catálogo.' };
        }
        return {
          found: true,
          product: {
            id: p.id,
            code: p.code,
            name: p.name,
            description: p.description,
            price: Number(p.price) || 0,
            category: p.category,
            images: p.images,
            shipping: p.shipping,
            whatsapp_url: p.whatsapp_url,
          },
        };
      }

      case 'calculate_shipping': {
        const dest = String(args.destination || '').toLowerCase();
        const isHeavy = Boolean(args.hasHeavyCargo);

        // Regra operacional de frete do Depósito Material para Grande BH
        let estimatedCost = 40.0;
        if (dest.includes('contagem') || dest.includes('eldorado') || dest.includes('industrial')) {
          estimatedCost = 35.0;
        } else if (dest.includes('betim') || dest.includes('ibirite') || dest.includes('santa luzia') || dest.includes('sabara')) {
          estimatedCost = 65.0;
        } else if (dest.includes('centro') || dest.includes('savassi') || dest.includes('pampulha')) {
          estimatedCost = 50.0;
        }

        if (isHeavy) {
          estimatedCost = Math.max(estimatedCost, 120.0);
        }

        return {
          destination: args.destination,
          estimatedShippingCost: estimatedCost,
          currency: 'BRL',
          estimatedDeliveryTime: 'Mesmo dia ou até 24h úteis',
        };
      }

      case 'create_quote': {
        const itemsToResolve = Array.isArray(args.items) ? args.items : [];
        const resolvedItems = [];

        for (const item of itemsToResolve) {
          const prod = await productRepository.findById(item.productId, companyId);
          if (prod) {
            resolvedItems.push({
              productId: prod.id,
              code: prod.code,
              name: prod.name,
              unitPrice: Number(prod.price) || 0,
              quantity: item.quantity || 1,
              images: prod.images,
            });
          }
        }

        if (resolvedItems.length === 0) {
          return { error: 'Nenhum dos produtos informados foi localizado no catálogo oficial.' };
        }

        const quote = await commerceQuoteEngine.createQuote({
          companyId,
          conversationId,
          clientPhone,
          items: resolvedItems,
          shippingAmount: args.shippingAmount || 0,
          discountValue: args.discountValue || 0,
          notes: args.notes || '',
        });

        return {
          success: true,
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          subtotal: quote.subtotal,
          shippingAmount: quote.shipping_amount,
          discountAmount: quote.discount_amount,
          totalAmount: quote.total_amount,
          itemCount: resolvedItems.length,
          previewText: commerceQuoteEngine.formatQuoteMessage(quote),
        };
      }

      case 'send_quote': {
        const sendRes = await commerceQuoteEngine.sendQuote(args.quoteId, { companyId });
        return sendRes;
      }

      case 'get_order_status': {
        const phone = String(args.clientPhone || clientPhone).replace(/\D/g, '');
        const quotes = await commerceQuoteEngine.listQuotes({ companyId, clientPhone: phone, limit: 5 });
        const ordersRes = await dbQuery(
          `SELECT id, order_id, total_amount, status, created_at FROM customer_orders WHERE company_id = $1 AND phone = $2 ORDER BY created_at DESC LIMIT 5`,
          [companyId, phone]
        );

        return {
          clientPhone: phone,
          recentQuotes: quotes.map((q) => ({
            id: q.id,
            quoteNumber: q.quote_number,
            status: q.status,
            totalAmount: q.total_amount,
            createdAt: q.created_at,
          })),
          recentOrders: ordersRes.rows,
        };
      }

      default:
        throw new Error(`Ferramenta desconhecida: "${name}"`);
    }
  }
}

module.exports = new ZaiCommerceTools();
