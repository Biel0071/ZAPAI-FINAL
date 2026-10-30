import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Minus,
  Trash,
  ShoppingBag,
  PaperPlaneTilt,
  MagnifyingGlass,
  Receipt,
  Truck,
  Tag,
  Note,
  User,
  Phone,
  CheckCircle,
  Package,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiService } from "@/core/services/apiService";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";
import type { CatalogProduct } from "./CatalogSelectorPopover";
import { FALLBACK_STORE_PRODUCTS } from "./CatalogSelectorPopover";

export interface CreateOrderItem {
  product: CatalogProduct;
  quantity: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  customerPhone?: string;
  customerName?: string;
  sessionId?: string;
  onOrderCreated?: (order: any) => void;
}

export function CreateOrderModal({
  isOpen,
  onClose,
  conversationId,
  customerPhone = "",
  customerName = "Cliente",
  sessionId = "main",
  onOrderCreated,
}: CreateOrderModalProps) {
  const [products, setProducts] = useState<CatalogProduct[]>(FALLBACK_STORE_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [orderItems, setOrderItems] = useState<CreateOrderItem[]>([]);
  const [freight, setFreight] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Load catalog products on mount / open
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiService
        .getProducts()
        .then((res) => {
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
              whatsapp_url: item.whatsapp_url || "https://wa.me/c/553193672075",
              promotions: item.promotions || "",
              condition: item.condition || "Novo",
              shipping: item.shipping || "Pronta Entrega",
            }));
            setProducts(mapped);
          }
        })
        .catch((err) => console.warn("[CreateOrderModal] Failed to load catalog products:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Filtered catalog products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleAddProduct = (prod: CatalogProduct) => {
    setOrderItems((prev) => {
      const existing = prev.find((it) => it.product.id === prod.id);
      if (existing) {
        return prev.map((it) =>
          it.product.id === prod.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    toast.info(`"${prod.name}" adicionado ao pedido.`);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((it) => {
          if (it.product.id === productId) {
            const newQty = it.quantity + delta;
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CreateOrderItem[]
    );
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems((prev) => prev.filter((it) => it.product.id !== productId));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return orderItems.reduce((acc, it) => {
      const price = typeof it.product.price === "number" ? it.product.price : parseFloat(String(it.product.price)) || 0;
      return acc + price * it.quantity;
    }, 0);
  }, [orderItems]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal + Number(freight || 0) - Number(discount || 0));
  }, [subtotal, freight, discount]);

  const formatBRL = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const handleSubmitOrder = async () => {
    if (orderItems.length === 0) {
      toast.warning("Adicione pelo menos 1 produto do catálogo ao pedido.");
      return;
    }
    if (!customerPhone) {
      toast.error("Número do cliente não disponível nesta conversa.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        conversationId,
        phone: customerPhone,
        customerName,
        sessionId,
        items: orderItems.map((it) => ({
          productId: it.product.id,
          id: it.product.id,
          name: it.product.name,
          title: it.product.name,
          price: typeof it.product.price === "number" ? it.product.price : parseFloat(String(it.product.price)) || 0,
          quantity: it.quantity,
          image: it.product.images?.[0] || undefined,
        })),
        freight: Number(freight || 0),
        discount: Number(discount || 0),
        notes: notes.trim(),
      };

      const res = await apiService.createCommerceOrder(payload);

      if (res?.success) {
        toast.success(`Pedido #${res.order?.order_id || 'OK'} criado e enviado no WhatsApp!`, {
          description: `Total de ${formatBRL(totalAmount)} enviado para ${customerName}.`,
        });
        if (onOrderCreated) onOrderCreated(res.order);
        setOrderItems([]);
        setFreight(0);
        setDiscount(0);
        setNotes("");
        onClose();
      } else {
        throw new Error(res?.error || "Falha ao registrar pedido");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar pedido", {
        description: err?.message || "Verifique a conexão do WhatsApp e tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="create-order-modal"
        className="max-w-4xl w-[95vw] h-[90vh] max-h-[820px] p-0 rounded-2xl bg-[#111b21] border border-[#2a3942] text-[#e9edef] flex flex-col overflow-hidden shadow-2xl z-50"
      >
        {/* Header matching WhatsApp Web Cobrar / Criar Pedido */}
        <div className="px-5 py-3.5 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Receipt className="h-5 w-5" weight="bold" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-[#e9edef] truncate">
                Criar Pedido do Catálogo (WhatsApp Commerce)
              </DialogTitle>
              <DialogDescription className="text-xs text-[#8696a0] truncate flex items-center gap-2 mt-0.5">
                <span>Cliente: <strong className="text-[#e9edef]">{customerName}</strong></span>
                {customerPhone && <span>• {customerPhone}</span>}
              </DialogDescription>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2-Column Layout: Left = Catalog Explorer, Right = Order Sheet */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x divide-[#2a3942]">
          {/* LEFT: Catálogo de Produtos (7 cols) */}
          <div className="md:col-span-7 flex flex-col min-h-0 bg-[#111b21]">
            <div className="p-3 border-b border-[#2a3942]/60 bg-[#182229]">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8696a0]" />
                <Input
                  type="text"
                  placeholder="Pesquisar tijolos, cimento, telhas, caixas d'água..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 h-9 text-xs bg-[#202c33] border-[#2a3942] text-[#e9edef] rounded-xl focus-visible:ring-1 focus-visible:ring-sky-500 placeholder:text-[#8696a0]"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#8696a0] mt-2 px-1">
                <span>{filteredProducts.length} produtos disponíveis na loja oficial</span>
                <span className="text-emerald-400 font-medium">Depósito Vista Alegre</span>
              </div>
            </div>

            <ScrollArea className="flex-1 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredProducts.map((p) => {
                  const pNum = typeof p.price === "number" ? p.price : parseFloat(String(p.price)) || 0;
                  const isAdded = orderItems.some((it) => it.product.id === p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddProduct(p)}
                      className={cn(
                        "p-2.5 rounded-xl border bg-[#182229] hover:bg-[#202c33] cursor-pointer transition-all duration-150 flex flex-col justify-between gap-2 group select-none",
                        isAdded ? "border-sky-500/50 ring-1 ring-sky-500/30" : "border-[#2a3942]/60 hover:border-[#2a3942]"
                      )}
                    >
                      <div className="flex gap-2.5 items-start">
                        {p.images && p.images[0] ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#202c33] border border-[#2a3942] shrink-0">
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[#202c33] border border-[#2a3942] flex items-center justify-center text-muted-foreground shrink-0">
                            <Package className="h-5 w-5 opacity-40" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-xs text-[#e9edef] group-hover:text-sky-400 transition-colors line-clamp-1 block">
                            {p.name}
                          </span>
                          <span className="text-xs font-bold text-emerald-400 block mt-0.5">
                            {formatBRL(pNum)}
                          </span>
                          <span className="text-[10px] text-[#8696a0] line-clamp-1 mt-0.5">
                            {p.category}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddProduct(p);
                        }}
                        className="h-7 w-full text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Adicionar ao Pedido</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT: Montagem do Pedido / Carrinho (5 cols) */}
          <div className="md:col-span-5 flex flex-col min-h-0 bg-[#182229]">
            <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#e9edef]">
                  Itens Selecionados ({orderItems.length})
                </span>
              </div>
              {orderItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOrderItems([])}
                  className="text-[11px] text-red-400 hover:underline"
                >
                  Limpar todos
                </button>
              )}
            </div>

            <ScrollArea className="flex-1 p-3">
              {orderItems.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center text-[#8696a0] px-4 space-y-2">
                  <ShoppingBag className="h-10 w-10 text-sky-400/40" />
                  <p className="text-xs font-medium text-[#e9edef]">Nenhum produto adicionado ainda</p>
                  <p className="text-[11px]">Clique em &quot;Adicionar ao Pedido&quot; na lista de produtos ao lado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((it) => {
                    const price = typeof it.product.price === "number" ? it.product.price : parseFloat(String(it.product.price)) || 0;
                    const itemTotal = price * it.quantity;

                    return (
                      <div
                        key={it.product.id}
                        className="p-2.5 rounded-xl bg-[#111b21] border border-[#2a3942] flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-[#e9edef] block truncate">
                            {it.product.name}
                          </span>
                          <span className="text-[11px] text-[#8696a0] block">
                            {it.quantity} × {formatBRL(price)} = <strong className="text-emerald-400">{formatBRL(itemTotal)}</strong>
                          </span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(it.product.id, -1)}
                            className="h-6 w-6 rounded-md bg-[#202c33] border border-[#2a3942] flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold w-5 text-center text-[#e9edef]">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(it.product.id, 1)}
                            className="h-6 w-6 rounded-md bg-[#202c33] border border-[#2a3942] flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.product.id)}
                            className="h-6 w-6 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 ml-1"
                            title="Remover do pedido"
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Calculations & Summary */}
            <div className="p-3.5 bg-[#202c33] border-t border-[#2a3942] space-y-2.5 shrink-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-[#8696a0] flex items-center gap-1 mb-1">
                    <Truck className="h-3 w-3 text-sky-400" />
                    Frete / Entrega (R$)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    value={freight}
                    onChange={(e) => setFreight(Number(e.target.value) || 0)}
                    placeholder="0,00"
                    className="h-7 text-xs bg-[#111b21] border-[#2a3942] text-[#e9edef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8696a0] flex items-center gap-1 mb-1">
                    <Tag className="h-3 w-3 text-amber-400" />
                    Desconto (R$)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    placeholder="0,00"
                    className="h-7 text-xs bg-[#111b21] border-[#2a3942] text-[#e9edef] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#8696a0] flex items-center gap-1 mb-1">
                  <Note className="h-3 w-3 text-[#8696a0]" />
                  Observações do Pedido
                </label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Entregar com descarga rápida no canteiro"
                  className="h-7 text-xs bg-[#111b21] border-[#2a3942] text-[#e9edef] rounded-lg"
                />
              </div>

              {/* Totals Summary */}
              <div className="pt-2 border-t border-[#2a3942]/60 space-y-1 text-xs">
                <div className="flex justify-between text-[#8696a0]">
                  <span>Subtotal ({orderItems.length} produtos):</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>
                {freight > 0 && (
                  <div className="flex justify-between text-[#8696a0]">
                    <span>Frete:</span>
                    <span>+{formatBRL(freight)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Desconto:</span>
                    <span>-{formatBRL(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-[#e9edef] pt-1 border-t border-[#2a3942]">
                  <span>Total do Pedido:</span>
                  <span className="text-emerald-400 text-base">{formatBRL(totalAmount)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1 h-9 text-xs text-[#8696a0] hover:text-[#e9edef] hover:bg-[#111b21] rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={submitting || orderItems.length === 0}
                  onClick={handleSubmitOrder}
                  className="flex-[2] h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span>Enviando Pedido...</span>
                  ) : (
                    <>
                      <PaperPlaneTilt className="h-4 w-4" weight="fill" />
                      <span>Enviar Pedido no WhatsApp</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
