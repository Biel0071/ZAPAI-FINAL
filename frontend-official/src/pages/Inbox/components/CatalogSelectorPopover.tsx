import React, { useState, useEffect, useMemo, useRef } from "react";
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
  PencilSimple,
  Plus,
} from "@phosphor-icons/react";
import { ProductFormModal, type EditableProduct } from "@/components/products/ProductFormModal";
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

export const CANONICAL_CATALOG_ORDER: Record<string, number> = {
  prod_bloco_10_100un: 1,
  prod_argamassa_ac3: 2,
  prod_argamassa_ac2: 3,
  prod_argamassa_ac1: 4,
  prod_caminhao_areia_9m3: 5,
  prod_areia_m3: 6,
  prod_caminhao_brita_8m3: 7,
  prod_tijolo_12_furos: 8,
  prod_tijolo_9_furos: 9,
  prod_tijolo_8_furos: 10,
  prod_telha_fibrocimento_244: 11,
  prod_telhas_ceramica: 12,
  prod_caixa_10000l: 13,
  prod_caixa_5000l: 14,
  prod_caixa_2000l: 15,
  prod_caixa_1000l: 16,
  prod_caixa_500l: 17,
  prod_cimento_liz_cp4: 18,
  prod_churrasqueira_premoldada: 19,
};

export function sortCatalogProducts(items: CatalogProduct[]): CatalogProduct[] {
  return [...items].sort((a, b) => {
    const rankA = CANONICAL_CATALOG_ORDER[a.id] ?? 999;
    const rankB = CANONICAL_CATALOG_ORDER[b.id] ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
}

export const FALLBACK_STORE_PRODUCTS: CatalogProduct[] = [
  {
    id: "prod_bloco_10_100un",
    code: "BLOC-10-100",
    name: "BLOCO 10 - 100 UN",
    description: "Bloco de concreto estrutural 10 (fardo com 100 unidades). Alta resistência à compressão.",
    price: 134.99,
    category: "Tijolos & Blocos",
    stock: 150,
    images: ["/assets/catalog/bloco_10_100un.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Lote com 100 unidades",
    condition: "Novo",
    shipping: "Pronta entrega com caminhão próprio",
  },
  {
    id: "prod_argamassa_ac3",
    code: "ARG-AC3-20",
    name: "ARGAMASSA - AC3",
    description: "Argamassa colante DVG Precon AC-III 20kg para porcelanatos e fachadas.",
    price: 19.90,
    category: "Cimento & Argamassa",
    stock: 250,
    images: ["/assets/catalog/argamassa_ac3.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Saco 20kg",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_argamassa_ac2",
    code: "ARG-AC2-20",
    name: "ARGAMASSA - AC2",
    description: "Argamassa colante DVG Precon AC-II 20kg para áreas internas e externas.",
    price: 16.90,
    category: "Cimento & Argamassa",
    stock: 200,
    images: ["/assets/catalog/argamassa_ac2.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Saco 20kg",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_argamassa_ac1",
    code: "ARG-AC1-20",
    name: "ARGAMASSA - AC1",
    description: "Argamassa colante DVG Precon AC-I 20kg para ambientes internos.",
    price: 14.80,
    category: "Cimento & Argamassa",
    stock: 200,
    images: ["/assets/catalog/argamassa_ac1.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Saco 20kg",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_caminhao_areia_9m3",
    code: "CAM-AREIA-9M3",
    name: "CAMINHÃO DE AREIA - 9M³",
    description: "Carga fechada de caminhão basculante com 9 metros cúbicos de areia média lavada.",
    price: 700.00,
    category: "Agregados & Areia",
    stock: 30,
    images: ["/assets/catalog/caminhao_areia.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Carga completa 9m³",
    condition: "Novo",
    shipping: "Entrega basculante programada",
  },
  {
    id: "prod_areia_m3",
    code: "AREIA-M3",
    name: "AREIA - M³",
    description: "Metro cúbico (m³) de areia média lavada limpa para concreto e reboco.",
    price: 100.00,
    category: "Agregados & Areia",
    stock: 90,
    images: ["/assets/catalog/areia_m3.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Valor por m³",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_caminhao_brita_8m3",
    code: "CAM-BRI-8M3",
    name: "CAMINHÃO BRITA - 8M³",
    description: "Carga fechada de brita nº 1 granítica (8 metros cúbicos) em basculante.",
    price: 850.00,
    category: "Agregados & Areia",
    stock: 25,
    images: ["/assets/catalog/caminhao_brita.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Carga completa 8m³",
    condition: "Novo",
    shipping: "Descarga direta basculante",
  },
  {
    id: "prod_tijolo_12_furos",
    code: "TIJ-12F",
    name: "TIJOLO 12 FUROS",
    description: "Milheiro de tijolo cerâmico 12 furos estrutural e vedação de primeira linha.",
    price: 900.00,
    category: "Tijolos & Blocos",
    stock: 3500,
    images: ["/assets/catalog/tijolo_12_furos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Milheiro paletizado",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_tijolo_9_furos",
    code: "TIJ-9F",
    name: "TIJOLO 9 FUROS",
    description: "Milheiro de tijolo cerâmico 9 furos paletizado de primeira queima.",
    price: 850.00,
    category: "Tijolos & Blocos",
    stock: 25,
    images: ["/assets/catalog/tijolo_9_furos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Milheiro fechado",
    condition: "Novo",
    shipping: "Descarga no canteiro de obras",
  },
  {
    id: "prod_tijolo_8_furos",
    code: "TIJ-8F",
    name: "TIJOLO 8 FUROS",
    description: "Milheiro de tijolo cerâmico 8 furos tradicional para fechamento e alvenaria.",
    price: 780.00,
    category: "Tijolos & Blocos",
    stock: 4000,
    images: ["/assets/catalog/tijolo_8_furos.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Milheiro fechado",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_telha_fibrocimento_244",
    code: "TEL-FIB-244",
    name: "TELHA FIBROCIMENTO 2,44 x 1,10m",
    description: "Telha ondulada 6mm sem amianto, alta durabilidade e proteção térmica.",
    price: 58.00,
    category: "Coberturas & Telhas",
    stock: 180,
    images: ["/assets/catalog/telha_fibro.jpg"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Pronta entrega",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_telhas_ceramica",
    code: "TEL-CER",
    name: "TELHAS CERÂMICA",
    description: "Telha cerâmica colonial/romana esmaltada de alto encaixe e acabamento impecável.",
    price: 3.20,
    category: "Coberturas & Telhas",
    stock: 2500,
    images: ["/assets/catalog/telhas_ceramica.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Preço unitário",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_caixa_10000l",
    code: "CX-10000",
    name: "CAIXA - 10.000L",
    description: "Reservatório de 10.000 Litros em polietileno virgem de alta resistência.",
    price: 2999.77,
    category: "Caixas d'Água",
    stock: 5,
    images: ["/assets/catalog/caixa_10000l.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Super capacidade",
    condition: "Novo",
    shipping: "Entrega com caminhão próprio",
  },
  {
    id: "prod_caixa_5000l",
    code: "CX-5000",
    name: "CAIXA - 5000L",
    description: "Caixa d'água Fortlev 5.000 Litros em polietileno virgem estrutural.",
    price: 1699.85,
    category: "Caixas d'Água",
    stock: 12,
    images: ["/assets/catalog/caixa_5000l.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Entrega rápida com caminhão próprio",
    condition: "Novo",
    shipping: "Entrega rápida com caminhão próprio",
  },
  {
    id: "prod_caixa_2000l",
    code: "CX-2000",
    name: "CAIXA - 2000L",
    description: "Caixa d'água Fortlev 2.000 Litros polietileno virgem com proteção UV.",
    price: 499.87,
    category: "Caixas d'Água",
    stock: 18,
    images: ["/assets/catalog/caixa_2000l.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Pronta entrega",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_caixa_1000l",
    code: "CX-1000",
    name: "CAIXA - 1000L",
    description: "Caixa d'água Fortlev 1.000 Litros residencial super reforçada.",
    price: 250.00,
    category: "Caixas d'Água",
    stock: 25,
    images: ["/assets/catalog/caixa_1000l.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Pronta entrega",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_caixa_500l",
    code: "CX-500",
    name: "CAIXA D'ÁGUA FORTLEV 500L",
    description: "Caixa d'Água 500 Litros Fortlev atóxica com tampa rosqueável.",
    price: 199.00,
    category: "Caixas d'Água",
    stock: 35,
    images: ["/assets/catalog/caixa_dagua.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Super compacta",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_cimento_liz_cp4",
    code: "CIM-LIZ-CP4",
    name: "CIMENTO LIZ - CP4",
    description: "Cimento Liz CP IV-32 RS secagem rápida (Saco 50kg) resistente a sulfatos.",
    price: 21.90,
    category: "Cimento & Argamassa",
    stock: 400,
    images: ["/assets/catalog/cimento_liz.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Saco 50kg",
    condition: "Novo",
    shipping: "Pronta entrega",
  },
  {
    id: "prod_churrasqueira_premoldada",
    code: "CHURR-PRE",
    name: "CHURRASQUEIRA - PRÉ-MOLDADA",
    description: "Churrasqueira pré-moldada em concreto refratário c/ coifa e suporte de espetos.",
    price: 990.00,
    category: "Churrasqueiras & Lazer",
    stock: 12,
    images: ["/assets/catalog/churrasqueira_premoldada.png"],
    whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    promotions: "Entrega programada",
    condition: "Novo",
    shipping: "Entrega programada",
  },
];

export const getCatalogImageUrl = (raw?: string) => {
  if (!raw) return "";
  const base = raw.replace("/assets/catalog/real/", "/assets/catalog/");
  return base.includes("?") ? base : `${base}?v=real_v4`;
};

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
  onSendMultipleProducts?: (products: CatalogProduct[]) => Promise<void> | void;
  onInsertInComposer?: (text: string) => void;
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function CatalogSelectorPopover({
  disabled = false,
  canSendToChat = true,
  onSendProduct,
  onSendMultipleProducts,
  onInsertInComposer,
  className,
  isOpen: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: CatalogSelectorPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (!isControlled) {
      setInternalOpen(val);
    }
    onOpenChange?.(val);
  };
  const [products, setProducts] = useState<CatalogProduct[]>(() => sortCatalogProducts(FALLBACK_STORE_PRODUCTS));
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<EditableProduct | null>(null);
  const isMountedRef = useRef(true);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
    };
  }, []);

  const loadCatalog = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiService.getProducts();
      if (isMountedRef.current && res?.success && Array.isArray(res.data) && res.data.length > 0) {
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
        setProducts(sortCatalogProducts(mapped));
      }
    } catch (err) {
      console.warn("[CatalogPopover] Failed to fetch backend products, using cached store items", err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  // Fetch real products from backend repository on mount, on open, and whenever WhatsApp connects/syncs
  useEffect(() => {
    // Prefetch immediately so catalog is instant when opening
    loadCatalog();

    // Listen to realtime WhatsApp login / sync events to update items automatically
    const handleSyncEvent = () => {
      if (isMountedRef.current) {
        loadCatalog();
      }
    };

    const socket = getSharedSocket();
    if (socket && typeof socket.on === "function") {
      socket.on("catalog:synced", handleSyncEvent);
      socket.on("catalog:updated", handleSyncEvent);
      socket.on("session_connected", handleSyncEvent);
      socket.on("whatsapp_connection", handleSyncEvent);
      socket.on("session.connected", handleSyncEvent);
      socket.on("session_switched", handleSyncEvent);
      socket.on("inbox:refresh", handleSyncEvent);
    }

    return () => {
      if (socket && typeof socket.off === "function") {
        socket.off("catalog:synced", handleSyncEvent);
        socket.off("catalog:updated", handleSyncEvent);
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
      let openMounted = true;
      apiService.getProducts().then((res) => {
        if (openMounted && isMountedRef.current && res?.success && Array.isArray(res.data) && res.data.length > 0) {
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
          setProducts(sortCatalogProducts(mapped));
        }
      }).catch(() => {});
      return () => {
        openMounted = false;
      };
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
      if (isMountedRef.current && typeof window !== "undefined") {
        setSendingId(product.id);
      }
      const formatted = formatProductMessage(product);
      await onSendProduct(product, formatted);
      if (isMountedRef.current) {
        setOpen(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        toast.error("Falha ao enviar produto", {
          description: err?.message || "Tente novamente.",
        });
      }
    } finally {
      if (isMountedRef.current && typeof window !== "undefined") {
        setSendingId(null);
      }
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
      if (isMountedRef.current && typeof window !== "undefined") {
        setSendingId("selected_batch");
      }
      if (onSendMultipleProducts) {
        await onSendMultipleProducts(selectedProducts);
      } else if (selectedProducts.length === 1) {
        const p = selectedProducts[0];
        const formatted = formatProductMessage(p);
        await onSendProduct(p, formatted);
        if (isMountedRef.current) {
          toast.success(`"${p.name}" enviado no chat!`);
        }
      } else {
        for (let i = 0; i < selectedProducts.length; i++) {
          if (!isMountedRef.current) break;
          const p = selectedProducts[i];
          const formatted = formatProductMessage(p);
          await onSendProduct(p, formatted);
          if (!isMountedRef.current) break;
          if (i < selectedProducts.length - 1) {
            await new Promise<void>((resolve) => {
              batchTimeoutRef.current = setTimeout(() => {
                batchTimeoutRef.current = null;
                resolve();
              }, 400);
            });
          }
        }
        if (isMountedRef.current) {
          toast.success(`${selectedProducts.length} produtos enviados no chat!`);
        }
      }
      if (isMountedRef.current) {
        setSelectedIds(new Set());
        setOpen(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        toast.error("Falha ao enviar produtos", { description: err?.message });
      }
    } finally {
      if (isMountedRef.current && typeof window !== "undefined") {
        setSendingId(null);
      }
    }
  };

  const handleSendCatalogLink = async () => {
    if (disabled || !canSendToChat) {
      if (!canSendToChat) {
        toast.warning("Selecione uma conversa ativa para disparar o catálogo.");
      }
      return;
    }

    try {
      if (isMountedRef.current && typeof window !== "undefined") {
        setSendingId("catalog_root");
      }
      const formattedCatalog = `📦 *[CATÁLOGO WHATSAPP]*\n${OFFICIAL_STORE_CATALOG_URL}`;
      await onSendProduct(
        {
          id: "catalog_root",
          name: "Catálogo Completo",
          description: "Catálogo de Produtos",
          price: 0,
          category: "Catálogo",
          whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
        },
        formattedCatalog
      );
      if (isMountedRef.current) {
        toast.success("Catálogo enviado no chat!");
        setOpen(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        toast.error("Falha ao enviar catálogo", { description: err?.message });
      }
    } finally {
      if (isMountedRef.current && typeof window !== "undefined") {
        setSendingId(null);
      }
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
        {hideTrigger ? (
          <span className="hidden" data-catalog-trigger aria-label="Abrir catálogo WhatsApp" />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] transition-colors select-none",
              open && "text-[#e9edef] bg-[#202c33]",
              className
            )}
            aria-label="Abrir catálogo WhatsApp"
            data-catalog-trigger
            title="Catálogo de Produtos WhatsApp"
          >
            <Storefront className="h-5 w-5" />
          </Button>
        )}
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

        {/* Top Action Row: 'Adicionar novo item' - Identical to WhatsApp Web Catalog creation */}
        <div
          onClick={() => {
            setModalProduct(null);
            setIsModalOpen(true);
          }}
          data-add-product-trigger
          className="px-4 py-2.5 bg-[#111b21] hover:bg-[#202c33] border-b border-[#2a3942]/60 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 group-hover:border-emerald-500 flex items-center justify-center text-emerald-400 transition-colors shrink-0">
              <Plus className="h-4 w-4" weight="bold" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-[#e9edef] group-hover:text-emerald-400 transition-colors block">
                Adicionar novo item
              </span>
              <span className="text-[11px] text-[#8696a0] block truncate">
                Criar produto com foto e preço oficial
              </span>
            </div>
          </div>
          <span className="text-[11px] font-medium text-emerald-400 group-hover:underline">
            + Novo
          </span>
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
                    data-catalog-product-row={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={cn(
                      "p-2.5 rounded-xl border transition-all duration-150 flex items-center gap-3 cursor-pointer group select-none",
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
                    {item.images && item.images.length > 0 && item.images[0] && !failedImages.has(item.id) ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#202c33] border border-[#2a3942] shrink-0 relative flex items-center justify-center">
                        <img
                          src={getCatalogImageUrl(item.images[0])}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setFailedImages((prev) => new Set(prev).add(item.id));
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#202c33] border border-[#2a3942] flex items-center justify-center text-muted-foreground shrink-0">
                        <Package className="h-5 w-5 opacity-40 text-[#8696a0]" />
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

                    {/* Action buttons: Edit & Enviar no Chat */}
                    <div className="shrink-0 flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalProduct({
                            id: item.id,
                            name: item.name,
                            code: item.code,
                            price: item.price,
                            description: item.description,
                            category: item.category,
                            stock: item.stock,
                            images: item.images,
                            shipping: item.shipping,
                            condition: item.condition,
                            whatsapp_url: item.whatsapp_url,
                          });
                          setIsModalOpen(true);
                        }}
                        className="h-7 w-7 rounded-lg text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] transition-colors"
                        title="Editar produto"
                        aria-label={`Editar ${item.name}`}
                      >
                        <PencilSimple className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendSingle(item);
                        }}
                        className="h-7 px-2 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors rounded-md flex items-center gap-1"
                        title="Enviar no Chat"
                      >
                        <PaperPlaneTilt className="h-3.5 w-3.5" />
                        <span>Enviar no Chat</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Sticky bottom bar when products are checked OR footer info - Identical to WhatsApp Web (Image 7) */}
        {selectedIds.size > 0 ? (
          <div className="px-4 py-3 bg-[#202c33] border-t border-[#2a3942] flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="min-w-0 flex-1">
              <span className="text-xs text-[#e9edef] font-bold tracking-wide uppercase truncate block">
                {selectedIds.size === 1
                  ? products.find((p) => selectedIds.has(p.id))?.name || "1 PRODUTO SELECIONADO"
                  : `${selectedIds.size} PRODUTOS SELECIONADOS`}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-[#8696a0] hover:text-emerald-400 underline mt-0.5 inline-block"
              >
                Desmarcar todos
              </button>
            </div>

            <Button
              type="button"
              disabled={disabled || sendingId !== null || !canSendToChat}
              onClick={handleSendSelected}
              className="h-9 px-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0 disabled:opacity-50"
              title={`Enviar produtos (${selectedIds.size})`}
              aria-label={`Enviar produtos (${selectedIds.size})`}
              data-testid="batch-send-catalog-btn"
            >
              {sendingId === "selected_batch" ? (
                <span className="animate-spin text-sm">🌀</span>
              ) : (
                <PaperPlaneTilt className="h-4 w-4" weight="fill" />
              )}
              <span>Enviar produtos ({selectedIds.size})</span>
            </Button>
          </div>
        ) : (
          <div className="px-4 py-2 bg-[#202c33] border-t border-[#2a3942] flex items-center justify-between text-[11px] text-[#8696a0]">
            <span>{filteredProducts.length} itens disponíveis</span>
          </div>
        )}
        {/* Product Form Modal for creating & editing catalog items */}
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          product={modalProduct}
          onSaved={() => {
            loadCatalog();
          }}
          onDeleted={() => {
            loadCatalog();
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
