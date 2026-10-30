import React, { useState, useEffect, useMemo } from "react";
import {
  Storefront,
  ShoppingBag,
  WhatsappLogo,
  MagnifyingGlass,
  Check,
  PaperPlaneTilt,
  ArrowSquareOut,
  Tag,
  Package,
  Sparkle,
  X,
  Truck,
  TextT,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiService } from "@/core/services/apiService";
import { getSharedSocket } from "@/core/runtime/socket/socketManager";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";

export interface CatalogProduct {
  id: string;
  code?: string;
  name: string;
  description: string;
  price: number | string;
  category: string;
  stock?: number;
  images?: string[];
  whatsapp_url?: string;
  promotions?: string;
  condition?: string;
  shipping?: string;
  company_id?: string;
}

export const OFFICIAL_STORE_CATALOG_URL = "https://wa.me/c/553193672075";

export const FALLBACK_STORE_PRODUCTS: CatalogProduct[] = [
  {
    id: "prod_betoneira_csm_400l",
    code: "BET-CSM-400L",
    name: "BETONEIRA - CSM - 400L",
    description: "Betoneira 400L CSM com motor profissional de alto torque. Estrutura reforçada, descarga rápida e máxima durabilidade para obras pesadas.",
    price: 3499.0,
    category: "Máquinas & Equipamentos",
    stock: 8,
    images: ["/assets/catalog/betoneira_csm_400l.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Frete especial na Grande BH ou parcelamento facilitado no cartão",
    condition: "Novo",
    shipping: "Entrega rápida com caminhão próprio",
  },
  {
    id: "prod_tijolo_12_furos",
    code: "TIJ-12F",
    name: "TIJOLO 12 FUROS",
    description: "Tijolo cerâmico 12 furos de primeira linha. Alto isolamento térmico e acústico, perfeito para paredes externas e divisórias de precisão.",
    price: 900.0,
    category: "Tijolos & Blocos",
    stock: 35,
    images: ["/assets/catalog/tijolo_12_furos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Preço por milheiro (1.000 unidades) paletizado",
    condition: "Novo",
    shipping: "Descarga rápida no canteiro de obras",
  },
  {
    id: "prod_tijolo_9_furos",
    code: "TIJ-9F",
    name: "TIJOLO 9 FUROS",
    description: "Tijolo cerâmico 9 furos padrão estrutural e vedação. Queima perfeita, economia de argamassa e grande resistência mecânica.",
    price: 850.0,
    category: "Tijolos & Blocos",
    stock: 40,
    images: ["/assets/catalog/tijolo_9_furos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Desconto progressivo para cargas completas",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_tijolo_8f_mil",
    code: "TIJ-8F",
    name: "TIJOLO 8 FUROS",
    description: "Tijolo cerâmico 8 furos padrão comercial 9x19x19cm (Milheiro). Venda paletizada com garantia de qualidade e resistência uniforme.",
    price: 780.0,
    category: "Tijolos & Blocos",
    stock: 50,
    images: ["/assets/catalog/tijolo_8_furos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Valor por milheiro. 5% de desconto no PIX",
    condition: "Novo",
    shipping: "Entrega imediata na Grande BH e região",
  },
  {
    id: "prod_telhas_ceramica",
    code: "TEL-CER",
    name: "TELHAS CERÂMICA",
    description: "Telhas cerâmicas coloniais esmaltadas e naturais de alta resistência. Encaixe perfeito, proteção térmica superior e acabamento nobre.",
    price: 3.2,
    category: "Coberturas & Telhas",
    stock: 5000,
    images: ["/assets/catalog/telhas_ceramica.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Venda por unidade ou milheiro fechado",
    condition: "Novo",
    shipping: "Entrega paletizada com proteção contra quebra",
  },
  {
    id: "prod_caixa_dagua_10000l",
    code: "CXA-10000L",
    name: "CAIXA D'ÁGUA 10.000L",
    description: "Reservatório de grande capacidade 10.000 Litros em polietileno virgem estrutural. Alta resistência contra intempéries e raios UV.",
    price: 4290.0,
    category: "Caixas d'Água",
    stock: 5,
    images: ["/assets/catalog/caixa_dagua.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Até 10x sem juros no cartão ou preço à vista negociável",
    condition: "Novo",
    shipping: "Frete especial com guincho/descarga apropriada",
  },
  {
    id: "prod_caixa_5000l",
    code: "CXA-5000L",
    name: "CAIXA - 5000L",
    description: "Caixa d'água Fortlev 5.000 Litros em polietileno reforçado com tampa de encaixe rápido. Fechamento seguro anti-insetos e proteção UV total.",
    price: 1699.85,
    category: "Caixas d'Água",
    stock: 12,
    images: ["/assets/catalog/caixa_5000l.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Parcelamento em até 10x ou desconto especial no PIX",
    condition: "Novo",
    shipping: "Entrega rápida com caminhão do depósito",
  },
  {
    id: "prod_caixa_2000l",
    code: "CXA-2000L",
    name: "CAIXA - 2000L",
    description: "Caixa d'água Fortlev 2.000 Litros azul resistente. Ideal para residências médias e comércios. Superfície interna lisa de fácil higienização.",
    price: 499.87,
    category: "Caixas d'Água",
    stock: 18,
    images: ["/assets/catalog/caixa_2000l.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Entrega imediata em toda a Grande BH",
    condition: "Novo",
    shipping: "Frete facilitado",
  },
  {
    id: "prod_caixa_1000l",
    code: "CXA-1000L",
    name: "CAIXA - 1000L",
    description: "Caixa d'água Fortlev 1.000 Litros padrão residencial. Campeã de vendas, super reforçada, instalação prática e vedação 100% segura.",
    price: 250.0,
    category: "Caixas d'Água",
    stock: 25,
    images: ["/assets/catalog/caixa_1000l.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Preço promocional à vista",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_cimento_liz_cp4",
    code: "CIM-LIZ-CP4",
    name: "CIMENTO LIZ - CP4",
    description: "Cimento Liz CP IV-32 RS de secagem rápida (Saco 50kg). Máxima resistência a sulfatos e agentes agressivos, acabamento perfeito para lajes e fundações.",
    price: 21.9,
    category: "Cimento & Argamassa",
    stock: 400,
    images: ["/assets/catalog/cimento_liz.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Desconto especial para cargas fechadas e paletes",
    condition: "Novo",
    shipping: "Entrega paletizada rápida no canteiro",
  },
  {
    id: "prod_churrasqueira_premoldada",
    code: "CHU-PRE-65",
    name: "CHURRASQUEIRA - PRÉ-MOLDADA",
    description: "Churrasqueira pré-moldada em concreto refratário e acabamento tijolinho. Acompanha coifa, gaveta cinzeiro e suporte para espetos.",
    price: 990.0,
    category: "Churrasqueiras & Lazer",
    stock: 7,
    images: ["/assets/catalog/churrasqueira_premoldada.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Montagem facilitada em módulos encaixáveis",
    condition: "Novo",
    shipping: "Entrega segura no local",
  },
  {
    id: "prod_caminhao_brita",
    code: "CAM-BRI-8M3",
    name: "CAMINHÃO BRITA - 8M³",
    description: "Carga fechada de brita graduada limpa (8 metros cúbicos) em caminhão basculante próprio. Ideal para concreto estrutural, calçadas e drenagem.",
    price: 850.0,
    category: "Agregados & Areia",
    stock: 20,
    images: ["/assets/catalog/caminhao_brita.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Preço fechado da carga com entrega na região",
    condition: "Novo",
    shipping: "Descarga direta basculante",
  },
];

export function formatProductMessage(product: CatalogProduct, customNote?: string): string {
  const priceVal = typeof product.price === "number" ? product.price : parseFloat(product.price) || 0;
  const formattedPrice = priceVal > 0 ? priceVal.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  }) : "";

  const lines: (string | null)[] = [
    `📦 *[CATÁLOGO WHATSAPP]*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `*${product.name.trim()}*`,
    product.code ? `🏷️ *Código:* ${product.code}` : null,
    formattedPrice ? `💰 *Valor:* ${formattedPrice}` : null,
    product.shipping ? `🚚 *Entrega:* ${product.shipping}` : null,
    product.promotions ? `🎁 *Condição:* ${product.promotions}` : null,
    product.stock !== undefined ? `📊 *Disponibilidade:* ${product.stock} un. em estoque` : null,
    ``,
    `📝 *Descrição:* ${product.description.trim()}`,
    ``,
    `🔗 *Ver Catálogo Completo:* ${product.whatsapp_url || OFFICIAL_STORE_CATALOG_URL}`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (customNote?.trim()) {
    lines.push(`💬 *Observação:* ${customNote.trim()}`);
  }

  return lines.filter((line) => line !== null).join("\n");
}

export function formatMultiProductMessage(products: CatalogProduct[], customNote?: string): string {
  if (products.length === 1) {
    return formatProductMessage(products[0], customNote);
  }

  const lines: (string | null)[] = [
    `📦 *[CATÁLOGO WHATSAPP]*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `*Depósito Vista Alegre — Produtos Selecionados:*`,
    ``,
  ];

  products.forEach((p, idx) => {
    const priceVal = typeof p.price === "number" ? p.price : parseFloat(p.price) || 0;
    const formattedPrice = priceVal > 0 ? priceVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
    lines.push(
      `*${idx + 1}. ${p.name.trim()}*`,
      p.code ? `🏷️ Código: ${p.code}` : null,
      formattedPrice ? `💰 Valor: ${formattedPrice}` : null,
      p.shipping ? `🚚 Entrega: ${p.shipping}` : null,
      `────────────────────`
    );
  });

  lines.push(
    ``,
    `🔗 *Ver Catálogo Completo no WhatsApp:* ${OFFICIAL_STORE_CATALOG_URL}`,
    `━━━━━━━━━━━━━━━━━━━━`
  );

  if (customNote?.trim()) {
    lines.push(`💬 *Observação:* ${customNote.trim()}`);
  }

  return lines.filter((line) => line !== null).join("\n");
}

interface CatalogSelectorPopoverProps {
  disabled?: boolean;
  canSendToChat?: boolean;
  onSendProduct: (product: CatalogProduct, formattedMessage: string) => Promise<void> | void;
  onInsertInComposer?: (text: string) => void;
  className?: string;
}

export function CatalogSelectorPopover({
  disabled = false,
  canSendToChat = true,
  onSendProduct,
  onInsertInComposer,
  className,
}: CatalogSelectorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<CatalogProduct[]>(FALLBACK_STORE_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch real products from backend repository on mount, on open, and whenever WhatsApp connects/syncs
  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      try {
        setLoading(true);
        const res = await apiService.getProducts();
        if (mounted && res?.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: CatalogProduct[] = res.data.map((item: any) => ({
            id: item.id || `prod_${Math.random()}`,
            code: item.code || "",
            name: item.name || "Produto Sem Nome",
            description: item.description || "",
            price: Number(item.price) || 0,
            category: item.category || "Geral",
            stock: item.stock ?? 10,
            images: Array.isArray(item.images) ? item.images : item.images ? [item.images] : [],
            whatsapp_url: item.whatsapp_url || OFFICIAL_STORE_CATALOG_URL,
            promotions: item.promotions || "",
            condition: item.condition || "Novo",
            shipping: item.shipping || "Pronta Entrega",
          }));
          setProducts(mapped);
        }
      } catch (err) {
        console.warn("[CatalogPopover] Failed to fetch backend products, using cached store items", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    // Prefetch immediately so catalog is instant when opening
    loadCatalog();

    // Listen to realtime WhatsApp login / sync events to update items automatically
    const handleSyncEvent = () => {
      if (mounted) {
        loadCatalog();
      }
    };

    const socket = getSharedSocket();
    if (socket && typeof socket.on === "function") {
      socket.on("catalog:synced", handleSyncEvent);
      socket.on("session_connected", handleSyncEvent);
      socket.on("whatsapp_connection", handleSyncEvent);
      socket.on("session.connected", handleSyncEvent);
      socket.on("session_switched", handleSyncEvent);
      socket.on("inbox:refresh", handleSyncEvent);
    }

    return () => {
      mounted = false;
      if (socket && typeof socket.off === "function") {
        socket.off("catalog:synced", handleSyncEvent);
        socket.off("session_connected", handleSyncEvent);
        socket.off("whatsapp_connection", handleSyncEvent);
        socket.off("session.connected", handleSyncEvent);
        socket.off("session_switched", handleSyncEvent);
        socket.off("inbox:refresh", handleSyncEvent);
      }
    };
  }, []);

  // Also refresh when popover is explicitly opened
  useEffect(() => {
    if (open) {
      apiService.getProducts().then((res) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: CatalogProduct[] = res.data.map((item: any) => ({
            id: item.id || `prod_${Math.random()}`,
            code: item.code || "",
            name: item.name || "Produto Sem Nome",
            description: item.description || "",
            price: Number(item.price) || 0,
            category: item.category || "Geral",
            stock: item.stock ?? 10,
            images: Array.isArray(item.images) ? item.images : item.images ? [item.images] : [],
            whatsapp_url: item.whatsapp_url || OFFICIAL_STORE_CATALOG_URL,
            promotions: item.promotions || "",
            condition: item.condition || "Novo",
            shipping: item.shipping || "Pronta Entrega",
          }));
          setProducts(mapped);
        }
      }).catch(() => {});
    }
  }, [open]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["TODOS", ...Array.from(set)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((item) => {
      const matchCategory =
        selectedCategory === "TODOS" ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchCategory) return false;

      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, selectedCategory]);

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendSingle = async (product: CatalogProduct) => {
    if (disabled || sendingId || !canSendToChat) {
      if (!canSendToChat) {
        toast.warning("Selecione uma conversa ativa para disparar o produto.");
      }
      return;
    }
    try {
      setSendingId(product.id);
      const formatted = formatProductMessage(product);
      await onSendProduct(product, formatted);
      toast.success(`"${product.name}" enviado no chat!`, {
        description: "Mensagem do catálogo WhatsApp disparada com sucesso.",
      });
      setOpen(false);
    } catch (err: any) {
      toast.error("Falha ao enviar produto", {
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleSendSelected = async () => {
    if (disabled || selectedIds.size === 0 || !canSendToChat) {
      if (!canSendToChat) toast.warning("Selecione uma conversa ativa.");
      return;
    }
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));
    if (selectedProducts.length === 0) return;

    try {
      setSendingId("selected_batch");
      if (selectedProducts.length === 1) {
        const p = selectedProducts[0];
        await onSendProduct(p, formatProductMessage(p));
        toast.success(`"${p.name}" enviado no chat!`);
      } else {
        for (let i = 0; i < selectedProducts.length; i++) {
          const p = selectedProducts[i];
          await onSendProduct(p, formatProductMessage(p));
          if (i < selectedProducts.length - 1) {
            await new Promise((r) => setTimeout(r, 350));
          }
        }
        toast.success(`${selectedProducts.length} produtos enviados no chat!`);
      }
      setSelectedIds(new Set());
      setOpen(false);
    } catch (err: any) {
      toast.error("Falha ao enviar produtos", { description: err?.message });
    } finally {
      setSendingId(null);
    }
  };

  const handleSendCatalogLink = async () => {
    if (disabled || !canSendToChat) {
      if (!canSendToChat) {
        toast.warning("Selecione uma conversa ativa para disparar o catálogo.");
      }
      return;
    }
    const catalogMsg = [
      `🏪 *[CATÁLOGO WHATSAPP]*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*Catálogo Oficial — Depósito Vista Alegre*`,
      `Acesse nossa loja completa no WhatsApp, veja todos os produtos e faça seu pedido direto:`,
      `👉 ${OFFICIAL_STORE_CATALOG_URL}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📱 Atendimento e entregas: (31) 9367-2075`,
    ].join("\n");

    try {
      setSendingId("catalog_root");
      await onSendProduct(
        {
          id: "catalog_root",
          name: "Catálogo Completo - Depósito Vista Alegre",
          description: "Catálogo oficial no WhatsApp",
          price: 0,
          category: "Catálogo",
          whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
        },
        catalogMsg
      );
      toast.success("Catálogo oficial do WhatsApp enviado no chat!");
      setOpen(false);
    } catch (err: any) {
      toast.error("Falha ao enviar catálogo", { description: err?.message });
    } finally {
      setSendingId(null);
    }
  };

  const handleSyncWhatsApp = async () => {
    try {
      setSyncing(true);
      const res = await apiService.syncWhatsAppCatalog();
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: CatalogProduct[] = res.data.map((item: any) => ({
          id: item.id || `prod_${Math.random()}`,
          code: item.code || "",
          name: item.name || "Produto Sem Nome",
          description: item.description || "",
          price: Number(item.price) || 0,
          category: item.category || "Geral",
          stock: item.stock ?? 10,
          images: Array.isArray(item.images) ? item.images : item.images ? [item.images] : [],
          whatsapp_url: item.whatsapp_url || OFFICIAL_STORE_CATALOG_URL,
          promotions: item.promotions || "",
          condition: item.condition || "Novo",
          shipping: item.shipping || "Pronta Entrega",
        }));
        setProducts(mapped);
        toast.success("Catálogo sincronizado com o WhatsApp!", {
          description: res.message || `${mapped.length} produtos disponíveis.`,
        });
      } else {
        toast.info("Catálogo atualizado", {
          description: `${products.length} produtos disponíveis.`,
        });
      }
    } catch (err: any) {
      toast.error("Erro ao sincronizar catálogo do WhatsApp", {
        description: err?.message || "Verifique a conexão da sessão.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleInsertText = (product: CatalogProduct) => {
    if (!onInsertInComposer) return;
    const formatted = formatProductMessage(product);
    onInsertInComposer(formatted);
    toast.info("Texto do produto colado no campo de mensagem.");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Authentic WhatsApp style Catálogo button beside emojis (compact icon-only) */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-muted-foreground hover:text-emerald-400 hover:bg-muted/50 transition-colors select-none",
            open && "ring-1 ring-emerald-500 bg-muted/60 text-emerald-400",
            className
          )}
          aria-label="Abrir catálogo WhatsApp"
          data-catalog-trigger
          title="🏪 Catálogo de Produtos WhatsApp (Depósito Vista Alegre)"
        >
          <Storefront className="h-5 w-5 text-emerald-400 shrink-0" weight="fill" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        data-catalog-popover
        className="w-[360px] max-w-[calc(100vw-24px)] p-0 rounded-2xl border border-emerald-500/30 bg-[#111b21] backdrop-blur-md shadow-2xl shadow-emerald-950/50 overflow-hidden flex flex-col z-50 text-[#e9edef]"
      >
        {/* Header - Identical to WhatsApp Web 'Enviar produtos' */}
        <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              aria-label="Fechar catálogo"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <span className="font-semibold text-sm text-[#e9edef] truncate block">
                Enviar produtos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSyncWhatsApp}
              disabled={syncing}
              className="h-7 px-2 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors border border-emerald-500/20 rounded-md"
              title="Sincronizar produtos criados no WhatsApp"
            >
              <ArrowsClockwise className={cn("h-3.5 w-3.5 mr-1", syncing && "animate-spin")} />
              <span>{syncing ? "Sincronizando..." : "Sincronizar"}</span>
            </Button>

            <a
              href={OFFICIAL_STORE_CATALOG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[#8696a0] hover:text-emerald-400 hover:bg-[#2a3942] transition-colors"
              title="Abrir catálogo original no WhatsApp"
            >
              <ArrowSquareOut className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Top Action Row: 'Enviar catálogo' - Exact duplicate of WhatsApp Web */}
        <div
          onClick={handleSendCatalogLink}
          data-send-catalog-trigger
          className="px-4 py-3 bg-[#111b21] hover:bg-[#202c33] border-b border-[#2a3942]/60 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-[#202c33] border border-[#2a3942] group-hover:border-emerald-500/50 flex items-center justify-center text-[#8696a0] group-hover:text-emerald-400 transition-colors shrink-0">
              <Storefront className="h-5 w-5" weight="regular" />
            </div>
            <div className="min-w-0">
              <span className="font-medium text-sm text-[#e9edef] group-hover:text-emerald-400 transition-colors block">
                Enviar catálogo
              </span>
            </div>
          </div>

          <button
            type="button"
            data-send-catalog-trigger
            onClick={(e) => {
              e.stopPropagation();
              handleSendCatalogLink();
            }}
            disabled={disabled || !canSendToChat || sendingId === "catalog_root"}
            className="text-[11px] font-medium text-emerald-400 hover:underline px-1 py-0.5"
          >
            {sendingId === "catalog_root" ? "Enviando..." : ""}
          </button>
        </div>

        {/* Search input & Category chips */}
        <div className="p-3 pb-2 border-b border-[#2a3942]/60 space-y-2 bg-[#111b21]">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8696a0]" />
            <Input
              type="text"
              placeholder="Buscar produtos cadastrados no WhatsApp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-[#202c33] border-[#2a3942] text-[#e9edef] rounded-xl focus-visible:ring-1 focus-visible:ring-emerald-500 placeholder:text-[#8696a0]"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#e9edef]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          </div>

        {/* Product list with checkboxes */}
        <ScrollArea className="h-[340px] p-2 bg-[#111b21]">
          {loading && products.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#8696a0] space-y-2">
              <Package className="h-8 w-8 animate-pulse text-emerald-400" />
              <p className="text-xs">Carregando catálogo do WhatsApp...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-[#8696a0] space-y-2">
              <Package className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-xs">Nenhum produto encontrado para &quot;{search}&quot;</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-emerald-400"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("TODOS");
                }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredProducts.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isSending = sendingId === item.id;
                const priceNum = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
                const isTelha = item.id === "prod_telhas_ceramica" || item.name.toUpperCase().includes("TELHAS");
                const formattedPrice = priceNum > 0 && !isTelha ? priceNum.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }) : "";

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={cn(
                      "p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer group select-none",
                      isSelected
                        ? "bg-[#202c33] border-emerald-500/50 shadow-xs"
                        : "bg-[#111b21] hover:bg-[#202c33]/70 border-[#2a3942]/50 hover:border-[#2a3942]"
                    )}
                  >
                    {/* Left: Checkbox */}
                    <div
                      onClick={(e) => toggleSelect(item.id, e)}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 cursor-pointer",
                        isSelected
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-[#8696a0] hover:border-[#e9edef] bg-transparent"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" weight="bold" />}
                    </div>

                    {/* Thumbnail Image */}
                    {item.images && item.images.length > 0 && item.images[0] ? (
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#202c33] border border-[#2a3942] shrink-0 relative flex items-center justify-center">
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-[#202c33] border border-[#2a3942] flex items-center justify-center text-muted-foreground shrink-0">
                        <Package className="h-6 w-6 opacity-40" />
                      </div>
                    )}

                    {/* Middle: Name & Price */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-[#e9edef] group-hover:text-emerald-400 transition-colors">
                          {item.name}
                        </span>
                      </div>

                      {formattedPrice && (
                        <div className="text-xs font-normal text-[#8696a0] mt-0.5">
                          {formattedPrice}
                        </div>
                      )}
                    </div>

                    {/* Right: Quick send actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onInsertInComposer && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleInsertText(item)}
                          className="h-7 w-7 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
                          title="Copiar texto para o campo de mensagem"
                        >
                          <TextT className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        disabled={disabled || isSending || !canSendToChat}
                        title={!canSendToChat ? "Selecione uma conversa ativa" : "Enviar no chat"}
                        onClick={() => handleSendSingle(item)}
                        className="h-7 px-2.5 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1"
                      >
                        {isSending ? (
                          <span className="animate-spin text-xs">🌀</span>
                        ) : (
                          <>
                            <PaperPlaneTilt className="h-3 w-3" weight="fill" />
                            <span className="hidden sm:inline">Enviar no Chat</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Sticky bottom bar when products are checked OR footer info */}
        {selectedIds.size > 0 ? (
          <div className="px-4 py-2.5 bg-[#202c33] border-t border-[#2a3942] flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#e9edef] font-medium">
                {selectedIds.size} {selectedIds.size === 1 ? "produto selecionado" : "produtos selecionados"}
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-[#8696a0] hover:text-[#e9edef] underline"
              >
                Limpar
              </button>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={disabled || sendingId !== null || !canSendToChat}
              onClick={handleSendSelected}
              className="h-8 px-4 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-[#111b21] rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              {sendingId === "selected_batch" ? (
                <span>Enviando...</span>
              ) : (
                <>
                  <PaperPlaneTilt className="h-3.5 w-3.5" weight="fill" />
                  <span>Enviar produtos ({selectedIds.size})</span>
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="px-4 py-2 bg-[#202c33] border-t border-[#2a3942] flex items-center justify-between text-[11px] text-[#8696a0]">
            <span>{filteredProducts.length} itens disponíveis</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Sparkle className="h-3 w-3" weight="fill" />
              Catálogo Oficial Depósito Vista Alegre
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
