import React, { useState } from "react";
import {
  ArrowLeft,
  ShoppingCart,
  ShareNetwork,
  Plus,
  Minus,
  Trash,
  PaperPlaneTilt,
  Check,
  Storefront,
  X,
  Truck,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";
import type { CatalogProduct } from "./CatalogSelectorPopover";

export interface CartItem {
  product: CatalogProduct;
  quantity: number;
}

interface ProductDetailDrawerProps {
  product: CatalogProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSendProductToChat: (product: CatalogProduct) => void;
  onSendCartOrderToChat: (items: CartItem[], total: number) => void;
  cartItems: CartItem[];
  onAddToCart: (product: CatalogProduct) => void;
  onUpdateCartQuantity: (productId: string, delta: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
}

export function ProductDetailDrawer({
  product,
  isOpen,
  onClose,
  onSendProductToChat,
  onSendCartOrderToChat,
  cartItems,
  onAddToCart,
  onUpdateCartQuantity,
  onRemoveFromCart,
  onClearCart,
}: ProductDetailDrawerProps) {
  const [view, setView] = useState<"details" | "cart">("details");

  if (!isOpen) return null;

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartValue = cartItems.reduce((acc, item) => {
    const p = typeof item.product.price === "number" ? item.product.price : parseFloat(String(item.product.price)) || 0;
    return acc + p * item.quantity;
  }, 0);

  const formattedCartTotal = totalCartValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const priceNum = product
    ? typeof product.price === "number"
      ? product.price
      : parseFloat(String(product.price)) || 0
    : 0;

  const isTelha = product?.id === "prod_telhas_ceramica" || product?.name.toUpperCase().includes("TELHAS");
  const formattedProductPrice = priceNum > 0 && !isTelha
    ? priceNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "";

  const handleCopyLink = () => {
    const url = product?.whatsapp_url || "https://wa.me/c/553193672075";
    navigator.clipboard?.writeText(url);
    toast.success("Link do produto copiado!", {
      description: url,
    });
  };

  const handleFinalizeCart = () => {
    if (cartItems.length === 0) return;
    onSendCartOrderToChat(cartItems, totalCartValue);
    onClearCart();
    onClose();
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] max-w-full bg-[#111b21] border-l border-[#2a3942] text-[#e9edef] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      data-testid="product-detail-drawer"
    >
      {/* Top Header matching WhatsApp Web */}
      <div className="h-16 px-4 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (view === "cart") {
                setView("details");
              } else {
                onClose();
              }
            }}
            className="h-9 w-9 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold text-base text-[#e9edef] truncate">
            {view === "cart" ? "Carrinho de Compras" : "Detalhes do Produto"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {view === "details" && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="h-9 w-9 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              title="Copiar link do produto"
              aria-label="Copiar link"
            >
              <ShareNetwork className="h-5 w-5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setView((prev) => (prev === "cart" ? "details" : "cart"))}
            className="relative h-9 w-9 rounded-full flex items-center justify-center text-[#8696a0] hover:text-emerald-400 hover:bg-[#2a3942] transition-colors"
            title="Ver carrinho"
            aria-label="Ver carrinho"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-emerald-500 text-[#111b21] text-[11px] font-bold flex items-center justify-center">
                {totalCartCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors ml-1"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {view === "details" && product ? (
        <ScrollArea className="flex-1 p-4 space-y-4">
          {/* Main Product Image */}
          <div className="w-full aspect-square max-h-[380px] rounded-2xl overflow-hidden bg-[#202c33] border border-[#2a3942] flex items-center justify-center relative shadow-lg">
            {product.images && product.images.length > 0 && product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <Storefront className="h-16 w-16 mx-auto opacity-30 text-emerald-400" />
                <p className="text-xs mt-2">Sem foto disponível</p>
              </div>
            )}
          </div>

          {/* Product Meta Header */}
          <div className="mt-4 p-4 rounded-2xl bg-[#202c33]/60 border border-[#2a3942]/60 space-y-2">
            <h2 className="text-lg font-bold text-[#e9edef] leading-tight">
              {product.name}
            </h2>

            {formattedProductPrice && (
              <div className="text-xl font-extrabold text-emerald-400">
                {formattedProductPrice}
              </div>
            )}

            {product.code && (
              <div className="inline-block text-[11px] font-mono text-[#8696a0] bg-[#111b21] px-2 py-0.5 rounded border border-[#2a3942]">
                Código: {product.code}
              </div>
            )}
          </div>

          {/* Details & Description */}
          {product.description && (
            <div className="p-4 rounded-2xl bg-[#202c33]/40 border border-[#2a3942]/40 space-y-1.5">
              <h3 className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
                Descrição do Produto
              </h3>
              <p className="text-sm text-[#e9edef] leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          )}

          {/* Logistics & Delivery */}
          {(product.shipping || product.promotions) && (
            <div className="p-4 rounded-2xl bg-[#202c33]/40 border border-[#2a3942]/40 space-y-2 text-xs">
              {product.shipping && (
                <div className="flex items-center gap-2 text-[#8696a0]">
                  <Truck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-[#e9edef]">{product.shipping}</span>
                </div>
              )}
              {product.promotions && (
                <div className="text-emerald-400 font-medium">
                  {product.promotions}
                </div>
              )}
            </div>
          )}

          <div className="h-20" />
        </ScrollArea>
      ) : view === "cart" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4 space-y-3">
            {cartItems.length === 0 ? (
              <div className="py-20 text-center text-[#8696a0] space-y-3">
                <ShoppingCart className="h-12 w-12 mx-auto opacity-30 text-emerald-400" />
                <p className="text-sm font-medium">Seu carrinho está vazio</p>
                <p className="text-xs text-[#8696a0]">
                  Adicione produtos do catálogo oficial para criar pedidos rápidos.
                </p>
                {product && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setView("details")}
                    className="mt-2 text-xs border-emerald-500/40 text-emerald-400"
                  >
                    Voltar aos detalhes
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map(({ product: itemProd, quantity }) => {
                  const pNum = typeof itemProd.price === "number" ? itemProd.price : parseFloat(String(itemProd.price)) || 0;
                  const itemSubtotal = (pNum * quantity).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  });

                  return (
                    <div
                      key={itemProd.id}
                      className="p-3 rounded-2xl bg-[#202c33] border border-[#2a3942] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#111b21] border border-[#2a3942] shrink-0 overflow-hidden flex items-center justify-center">
                        {itemProd.images && itemProd.images[0] ? (
                          <img
                            src={itemProd.images[0]}
                            alt={itemProd.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Storefront className="h-5 w-5 text-muted-foreground opacity-50" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-[#e9edef] truncate">
                          {itemProd.name}
                        </h4>
                        <div className="text-xs text-emerald-400 font-bold mt-0.5">
                          {itemSubtotal}
                        </div>
                      </div>

                      {/* Stepper Quantity */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-[#111b21] p-1 rounded-xl border border-[#2a3942]">
                        <button
                          type="button"
                          onClick={() => onUpdateCartQuantity(itemProd.id, -1)}
                          className="h-6 w-6 rounded-lg flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]"
                          title="Diminuir"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-[#e9edef]">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateCartQuantity(itemProd.id, 1)}
                          className="h-6 w-6 rounded-lg flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]"
                          title="Aumentar"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveFromCart(itemProd.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-[#8696a0] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remover produto"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Cart Footer with Total and Order CTA */}
          {cartItems.length > 0 && (
            <div className="p-4 bg-[#202c33] border-t border-[#2a3942] space-y-3 shrink-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8696a0] font-medium">Total do Pedido:</span>
                <span className="text-lg font-extrabold text-emerald-400">
                  {formattedCartTotal}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClearCart}
                  className="h-10 text-xs border-[#2a3942] text-[#8696a0] hover:text-red-400 hover:bg-red-500/10"
                >
                  Limpar
                </Button>

                <Button
                  type="button"
                  onClick={handleFinalizeCart}
                  className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <PaperPlaneTilt className="h-4 w-4" weight="fill" />
                  <span>Enviar Pedido no Chat ({totalCartCount})</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Sticky Bottom Actions in Details View */}
      {view === "details" && product && (
        <div className="p-4 bg-[#202c33] border-t border-[#2a3942] flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onAddToCart(product);
              toast.success(`"${product.name}" adicionado ao carrinho!`, {
                action: {
                  label: "Ver carrinho",
                  onClick: () => setView("cart"),
                },
              });
            }}
            className="flex-1 h-11 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-xl font-semibold text-xs flex items-center justify-center gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Adicionar ao carrinho</span>
          </Button>

          <Button
            type="button"
            onClick={() => {
              onSendProductToChat(product);
              toast.success(`"${product.name}" enviado no chat!`);
            }}
            className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <PaperPlaneTilt className="h-4 w-4" weight="fill" />
            <span>Enviar no Chat</span>
          </Button>
        </div>
      )}
    </div>
  );
}
