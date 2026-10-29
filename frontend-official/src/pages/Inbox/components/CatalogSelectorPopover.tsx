import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
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
} from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiService } from "@/core/services/apiService";
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
    id: "prod_tijolo_8f_mil",
    code: "TIJ-8F-MIL",
    name: "Tijolo Cerâmico 8 Furos 9x19x19cm (Milheiro)",
    description: "Tijolo cerâmico 8 furos padrão 9x19x19cm. Isolamento térmico e acústico, alta resistência e queima uniforme. Venda por milheiro (1.000 unidades) paletizado.",
    price: 980.0,
    category: "Tijolos & Blocos",
    stock: 45,
    images: ["/assets/catalog/tijolo_8f.jpg"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "5% de desconto no PIX/Dinheiro ou até 10x sem juros no cartão",
    condition: "Novo",
    shipping: "Entrega com caminhão próprio com descarga rápida",
  },
  {
    id: "prod_tijolo_macico_mil",
    code: "TIJ-MAC-MIL",
    name: "Tijolo Maciço Comum 5x10x20cm (Milheiro)",
    description: "Tijolo de barro cozido maciço para alvenaria aparente, fornos a lenha, fogões e churrasqueiras rústicas. Alta durabilidade e acabamento colonial.",
    price: 650.0,
    category: "Tijolos & Blocos",
    stock: 30,
    images: ["/assets/catalog/tijolo_macico.jpg"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Desconto especial para cargas fechadas",
    condition: "Novo",
    shipping: "Entrega imediata na Grande BH e região",
  },
  {
    id: "prod_cimento_cp2_50kg",
    code: "CIM-CPII-50",
    name: "Cimento CP-II E-32 50kg Nacional",
    description: "Cimento Portland Composto com escória granulada. Indicado para concreto armado, lajes, vigas, pilares, contrapisos e assentamento.",
    price: 34.9,
    category: "Cimento & Argamassas",
    stock: 250,
    images: ["/assets/catalog/cimento_cp2.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Preço promocional para compras acima de 50 sacos",
    condition: "Novo",
    shipping: "Descarga no térreo inclusa na entrega",
  },
  {
    id: "prod_cimento_cp3_50kg",
    code: "CIM-CPIII-50",
    name: "Cimento CP-III 40 RS Resistente a Sulfatos (50kg)",
    description: "Cimento Portland de alto-forno com elevado teor de escória. Máxima impermeabilidade em fundações, subsolos e locais com umidade.",
    price: 37.5,
    category: "Cimento & Argamassas",
    stock: 120,
    images: ["/assets/catalog/cimento_cp2.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Condição facilitada no cartão de crédito",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_areia_media_m3",
    code: "AGR-AREIA-M3",
    name: "Areia Média Lavada (m³)",
    description: "Areia média pura, limpa e lavada, sem terra ou matéria orgânica. Granulometria perfeita para concreto e argamassa de reboco.",
    price: 110.0,
    category: "Areia & Brita",
    stock: 80,
    images: ["/assets/catalog/blocos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Preço por metro cúbico (m³). Consulte frete para sua rua",
    condition: "Novo",
    shipping: "Entrega em caminhão basculante",
  },
  {
    id: "prod_brita_1_m3",
    code: "AGR-BRITA-1-M3",
    name: "Brita 1 Granítica (m³)",
    description: "Pedra britada nº 1 (malha 19mm) de rocha sã granítica. Alta aderência para lajes maciças, sapatas e blocos de fundação.",
    price: 125.0,
    category: "Areia & Brita",
    stock: 60,
    images: ["/assets/catalog/blocos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Desconto no combo Areia + Brita",
    condition: "Novo",
    shipping: "Entrega expressa basculante",
  },
  {
    id: "prod_churrasqueira_65cm",
    code: "CHUR-65-COMP",
    name: "Churrasqueira Pré-Moldada Tijolinho 65cm Completa",
    description: "Churrasqueira pré-moldada estilo tijolinho vermelho cerâmico com revestimento refratário. Kit completo com grelha em inox, porta-espetos e gaveta cinzeiro.",
    price: 890.0,
    category: "Churrasqueiras",
    stock: 18,
    images: ["/assets/catalog/churras_65.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Kit inox incluso (grelha + porta-espetos inox)",
    condition: "Novo",
    shipping: "Entrega programada para todo o vetor leste e BH",
  },
  {
    id: "prod_churrasqueira_75cm_prem",
    code: "CHUR-75-PREM",
    name: "Churrasqueira Predial Refratária 75cm Premium",
    description: "Churrasqueira pré-moldada grande 75cm para áreas gourmet amplas. Coifa prolongada, refratários duplos de alta retenção térmica.",
    price: 1290.0,
    category: "Churrasqueiras",
    stock: 9,
    images: ["/assets/catalog/churras_75.jpg"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Parcelamento em até 10x sem juros",
    condition: "Novo",
    shipping: "Montagem rápida por encaixe modulado",
  },
  {
    id: "prod_telha_fibro_244",
    code: "TEL-FIB-244",
    name: "Telha Fibrocimento 2,44 x 1,10m 6mm Brasilit/Eternit",
    description: "Telha ondulada sem amianto (tecnologia CRFS). Dimensões 2,44m x 1,10m x 6mm de espessura. Alta durabilidade e proteção contra intempéries.",
    price: 58.0,
    category: "Coberturas & Telhas",
    stock: 200,
    images: ["/assets/catalog/telha_fibro.jpg"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Desconto para quantidade de obra fechada",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_caixa_dagua_1000l",
    code: "CXA-1000L-FTL",
    name: "Caixa d'Água 1000L Polietileno com Tampa Fortlev",
    description: "Reservatório de água potável 1.000 Litros em polietileno virgem atóxico com proteção antibacteriana e anti-UV. Tampa de 1/4 de volta com trava segura.",
    price: 380.0,
    category: "Caixas d'Água",
    stock: 28,
    images: ["/assets/catalog/caixa_dagua.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Garantia oficial de 5 anos pelo fabricante",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_caixa_dagua_5000l",
    code: "CXA-5000L-FTL",
    name: "Caixa d'Água 5.000 Litros Fortlev Polietileno",
    description: "Caixa d'água de grande capacidade (5.000L) com tripla camada de polietileno estrutural. Indicada para condomínios, comércio e sítios.",
    price: 2490.0,
    category: "Caixas d'Água",
    stock: 12,
    images: ["/assets/catalog/caixa_dagua.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Até 10x sem juros no cartão ou 5% à vista",
    condition: "Novo",
    shipping: "Entrega com veículo apropriado",
  },
  {
    id: "prod_betoneira_400l_2cv",
    code: "BET-400L-2CV",
    name: "Betoneira 400L 2CV Monofásica Reforçada",
    description: "Betoneira profissional capacidade de mistura 400 Litros, motor monofásico de 2CV blindado WEG, engrenagens em ferro fundido nodular e rodas maciças.",
    price: 3850.0,
    category: "Máquinas & Equipamentos",
    stock: 6,
    images: ["/assets/catalog/betoneira.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Nota fiscal e garantia de 1 ano de fábrica",
    condition: "Novo",
    shipping: "Frete sob consulta para Minas Gerais",
  },
  {
    id: "prod_tinta_acrilica_18l",
    code: "TNT-ACR-18L",
    name: "Tinta Acrílica Fosca Premium 18L Branco Neve",
    description: "Tinta acrílica lavável premium para paredes internas e externas. Rendimento de até 500m² por demão, secagem ultra rápida e acabamento sem odor.",
    price: 289.9,
    category: "Tintas & Acabamentos",
    stock: 42,
    images: ["/assets/catalog/tinta.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Leve 2 latas com frete grátis na região",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_argamassa_ac3_20kg",
    code: "ARG-AC3-20",
    name: "Argamassa AC-III 20kg Cinza Alta Aderência",
    description: "Argamassa flexível tipo AC-III para assentamento de porcelanatos, placas grandes, piscinas e sobreposição piso sobre piso.",
    price: 32.9,
    category: "Cimento & Argamassas",
    stock: 180,
    images: ["/assets/catalog/cimento_cp2.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Desconto progressivo por palete fechado",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_bloco_estrutural_14",
    code: "BLC-EST-14",
    name: "Bloco de Concreto Estrutural 14x19x39cm",
    description: "Bloco vazado de concreto vibroprensado para alvenaria estrutural e de vedação. Face perfeitamente alinhada e alta resistência à compressão (>= 4.5 MPa).",
    price: 4.8,
    category: "Tijolos & Blocos",
    stock: 700,
    images: ["/assets/catalog/blocos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Venda unitária ou por palete com 108 unidades",
    condition: "Novo",
    shipping: "Entrega rápida na obra",
  },
];

export function formatProductMessage(product: CatalogProduct, customNote?: string): string {
  const priceVal = typeof product.price === "number" ? product.price : parseFloat(product.price) || 0;
  const formattedPrice = priceVal.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const lines: (string | null)[] = [
    `📦 *[CATÁLOGO WHATSAPP]*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `*${product.name.trim()}*`,
    product.code ? `🏷️ *Código:* ${product.code}` : null,
    `💰 *Valor:* ${formattedPrice}`,
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
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Fetch real products from backend repository on mount / open
  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      try {
        setLoading(true);
        const res = await apiService.getProducts();
        if (mounted && res?.success && Array.isArray(res.data) && res.data.length > 0) {
          // Merge images and fallback fields safely
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

    if (open) {
      loadCatalog();
    }

    return () => {
      mounted = false;
    };
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

  const handleSend = async (product: CatalogProduct) => {
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-10 w-10 min-h-10 min-w-10 rounded-full flex items-center justify-center shrink-0 relative transition-all duration-200",
            open
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20"
              : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10",
            className
          )}
          aria-label="Abrir catálogo WhatsApp"
          data-catalog-trigger
          title="📦 Catálogo WhatsApp (Depósito Vista Alegre)"
        >
          <ShoppingBag className="h-5 w-5" weight={open ? "fill" : "regular"} />
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        data-catalog-popover
        className="w-[430px] max-w-[calc(100vw-24px)] p-0 rounded-2xl border border-emerald-500/25 bg-background/95 backdrop-blur-md shadow-2xl shadow-emerald-950/40 overflow-hidden flex flex-col z-50 text-foreground"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/40 via-background to-background border-b border-border/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShoppingBag className="h-4 w-4" weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-foreground truncate">
                  Catálogo WhatsApp
                </span>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 font-medium"
                >
                  Oficial
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Depósito Vista Alegre • (31) 9367-2075
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <a
              href={OFFICIAL_STORE_CATALOG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors border border-emerald-500/20"
              title="Abrir catálogo original no WhatsApp"
            >
              <WhatsappLogo className="h-3.5 w-3.5" weight="fill" />
              <span>Ver Link</span>
              <ArrowSquareOut className="h-3 w-3" />
            </a>

            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              aria-label="Fechar catálogo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="p-3 pb-2 border-b border-border/40 space-y-2">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar tijolos, cimento, telha, churrasqueira..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-muted/40 border-border/60 rounded-xl focus-visible:ring-1 focus-visible:ring-emerald-500"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {categories.map((cat) => {
              const active = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg shrink-0 transition-all font-medium border",
                    active
                      ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                      : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product list */}
        <ScrollArea className="h-[360px] p-3">
          {loading && products.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <Package className="h-8 w-8 animate-pulse text-emerald-400" />
              <p className="text-xs">Carregando catálogo do WhatsApp...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
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
            <div className="space-y-2.5">
              {filteredProducts.map((item) => {
                const isSending = sendingId === item.id;
                const priceNum = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
                const formattedPrice = priceNum.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                });

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-emerald-500/30 transition-all duration-150 flex flex-col gap-2 relative group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {item.images && item.images.length > 0 && item.images[0] && (
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted/40 border border-border/50 shrink-0 relative flex items-center justify-center">
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-foreground group-hover:text-emerald-400 transition-colors">
                            {item.name}
                          </span>
                          {item.code && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                              {item.code}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Price badge */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-emerald-400">
                          {formattedPrice}
                        </div>
                        {item.stock !== undefined && (
                          <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {item.stock} em estoque
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/30 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-emerald-400/90">
                        <Tag className="h-3 w-3" />
                        {item.category}
                      </span>
                      {item.shipping && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                          <Truck className="h-3 w-3" />
                          {item.shipping}
                        </span>
                      )}
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {onInsertInComposer && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInsertText(item)}
                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          title="Inserir texto do produto no campo de mensagem"
                        >
                          <TextT className="h-3.5 w-3.5 mr-1" />
                          Copiar p/ campo
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        disabled={disabled || isSending || !canSendToChat}
                        title={!canSendToChat ? "Selecione uma conversa ativa para disparar o produto" : "Enviar no chat"}
                        onClick={() => handleSend(item)}
                        className="h-7 px-3 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs hover:shadow-emerald-950/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSending ? (
                          <>
                            <span className="animate-spin text-xs">🌀</span>
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <PaperPlaneTilt className="h-3.5 w-3.5" weight="fill" />
                            <span>Enviar no Chat</span>
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

        {/* Footer info */}
        <div className="px-4 py-2 bg-muted/40 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{filteredProducts.length} itens disponíveis</span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <Sparkle className="h-3 w-3" weight="fill" />
            Sincronizado com WhatsApp Business
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
