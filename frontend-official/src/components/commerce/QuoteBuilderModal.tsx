import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Plus,
  Trash,
  ShoppingBag,
  Truck,
  Tag,
  CurrencyDollar,
  X,
  PaperPlaneTilt,
  CheckCircle,
  Spinner,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { cn } from "@/core/lib/utils";

interface QuoteItem {
  productId: string;
  code: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
}

interface QuoteBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientPhone: string;
  clientName?: string;
  conversationId?: string;
  sessionId?: string;
  onQuoteSent?: (quote: any) => void;
}

export const QuoteBuilderModal: React.FC<QuoteBuilderModalProps> = ({
  isOpen,
  onClose,
  clientPhone,
  clientName = "",
  conversationId,
  sessionId = "main",
  onQuoteSent,
}) => {
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<QuoteItem[]>([]);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [shippingAmount, setShippingAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carrega produtos do catálogo real
  useEffect(() => {
    if (!isOpen) return;
    async function loadCatalog() {
      try {
        setLoadingCatalog(true);
        const res = await apiService.getProducts();
        if (res?.success && Array.isArray(res.data)) {
          setCatalogProducts(res.data);
        }
      } catch (_) {} finally {
        setLoadingCatalog(false);
      }
    }
    void loadCatalog();
  }, [isOpen]);

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalogProducts;
    const q = searchQuery.toLowerCase();
    return catalogProducts.filter(
      (p) =>
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q) ||
        String(p.code || "").toLowerCase().includes(q)
    );
  }, [catalogProducts, searchQuery]);

  const handleAddItem = (prod: any) => {
    const existingIndex = selectedItems.findIndex((it) => it.productId === prod.id);
    const unitPrice = Number(prod.price || 0);

    if (existingIndex >= 0) {
      const updated = [...selectedItems];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].subtotal = Math.round(unitPrice * updated[existingIndex].quantity * 100) / 100;
      setSelectedItems(updated);
    } else {
      const primaryImg = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : prod.image;
      setSelectedItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          code: prod.code || "",
          name: prod.name,
          unitPrice,
          quantity: 1,
          subtotal: unitPrice,
          imageUrl: primaryImg,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((it) => {
          if (it.productId !== productId) return it;
          const newQty = Math.max(1, it.quantity + delta);
          return {
            ...it,
            quantity: newQty,
            subtotal: Math.round(it.unitPrice * newQty * 100) / 100,
          };
        })
        .filter((it) => it.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  // Cálculos financeiros
  const subtotal = useMemo(() => {
    return selectedItems.reduce((acc, it) => acc + it.subtotal, 0);
  }, [selectedItems]);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return Math.round(subtotal * ((Number(discountValue) || 0) / 100) * 100) / 100;
    }
    return Math.min(subtotal, Math.max(0, Number(discountValue) || 0));
  }, [subtotal, discountType, discountValue]);

  const totalAmount = useMemo(() => {
    const shipping = Math.max(0, Number(shippingAmount) || 0);
    return Math.max(0, Math.round((subtotal - discountAmount + shipping) * 100) / 100);
  }, [subtotal, discountAmount, shippingAmount]);

  const handleGenerateAndSend = async () => {
    if (selectedItems.length === 0) {
      notify.warning("Adicione pelo menos um produto ao orçamento.");
      return;
    }

    try {
      setIsSubmitting(true);
      // 1. Cria o orçamento no banco de dados
      const createRes = await apiService.createQuote({
        clientPhone,
        clientName,
        conversationId,
        items: selectedItems,
        discountType,
        discountValue,
        shippingAmount,
        notes,
      });

      if (!createRes?.success || !createRes.quote) {
        throw new Error(createRes?.error || "Erro ao registrar orçamento.");
      }

      const quote = createRes.quote;

      // 2. Dispara a mensagem no WhatsApp para o cliente
      const sendRes = await apiService.sendQuote(quote.id, sessionId);
      if (!sendRes?.success) {
        throw new Error(sendRes?.error || "Erro ao disparar mensagem para o WhatsApp.");
      }

      notify.success(`Orçamento ${quote.quote_number} enviado com sucesso!`);
      onQuoteSent?.(quote);
      onClose();
    } catch (err: any) {
      notify.error("Falha ao gerar orçamento: " + (err?.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="p-4 bg-muted/40 border-b border-border/60 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Novo Orçamento Comercial
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Selecione itens do catálogo oficial, aplique frete/desconto e envie ao WhatsApp do cliente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Coluna Esquerda: Catálogo Real */}
          <div className="space-y-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-emerald-400" />
                Catálogo Real ({catalogProducts.length} itens)
              </Label>
            </div>

            <div className="relative">
              <MagnifyingGlass className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-background/60"
              />
            </div>

            <div className="flex-1 border border-border/60 rounded-xl overflow-y-auto max-h-[340px] p-2 space-y-1.5 bg-background/30 divide-y divide-border/20">
              {loadingCatalog ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Spinner className="h-4 w-4 animate-spin text-emerald-400" />
                  <span>Carregando produtos reais...</span>
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Nenhum produto encontrado.
                </div>
              ) : (
                filteredCatalog.map((prod) => {
                  const img = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : prod.image;
                  const priceFmt = Number(prod.price || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  });
                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleAddItem(prod)}
                      className="p-2 rounded-lg hover:bg-accent/40 cursor-pointer flex items-center justify-between gap-2.5 transition-colors group select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {img ? (
                          <img
                            src={img}
                            alt={prod.name}
                            className="h-10 w-10 rounded-lg object-cover border border-border shrink-0 bg-background"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <ShoppingBag className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-emerald-400 transition-colors">
                            {prod.name}
                          </p>
                          <p className="text-[11px] font-bold text-emerald-400">{priceFmt}</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 rounded-lg text-muted-foreground group-hover:text-emerald-400 group-hover:bg-emerald-500/10 shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna Direita: Itens Selecionados e Totais */}
          <div className="space-y-3 flex flex-col min-h-0 bg-background/40 p-4 rounded-xl border border-border/60">
            <Label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Itens Selecionados ({selectedItems.length})</span>
              <span className="text-emerald-400 font-bold">
                {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </Label>

            {/* Lista de Itens */}
            <div className="flex-1 overflow-y-auto max-h-[160px] space-y-1.5 border border-border/40 rounded-lg p-1.5 bg-background/50">
              {selectedItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Clique nos produtos ao lado para adicionar.
                </div>
              ) : (
                selectedItems.map((item) => (
                  <div
                    key={item.productId}
                    className="p-1.5 rounded-md bg-card/60 border border-border/40 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.quantity}x de{" "}
                        {item.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center border border-border rounded-lg bg-background">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, -1)}
                          className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground text-xs"
                        >
                          -
                        </button>
                        <span className="px-1.5 text-xs font-bold text-foreground">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, 1)}
                          className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground text-xs"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="h-6 w-6 rounded-md flex items-center justify-center text-destructive hover:bg-destructive/10"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Frete & Desconto */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Frete (R$)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  value={shippingAmount || ""}
                  onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Desconto ({discountType === "percent" ? "%" : "R$"})
                </Label>
                <div className="flex gap-1 mt-1">
                  <Input
                    type="number"
                    min="0"
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="h-8 text-xs rounded-lg flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDiscountType((t) => (t === "fixed" ? "percent" : "fixed"))}
                    className="h-8 px-2 text-[10px] rounded-lg border-border"
                  >
                    {discountType === "percent" ? "%" : "R$"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">Observações do Pedido</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Entregar na obra até quinta-feira..."
                className="h-8 text-xs rounded-lg mt-1"
              />
            </div>

            {/* Total Final */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Valor Total do Orçamento
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Subtotal: {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  {discountAmount > 0 && ` | -${discountAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                  {shippingAmount > 0 && ` | Frete: +${shippingAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                </span>
              </div>
              <span className="text-lg font-extrabold text-emerald-400">
                {totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/40 border-t border-border/60 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} className="rounded-xl text-xs">
            Cancelar
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleGenerateAndSend}
            disabled={isSubmitting || selectedItems.length === 0}
            className="rounded-xl text-xs px-4 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40"
          >
            {isSubmitting ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <PaperPlaneTilt className="h-4 w-4" />
            )}
            <span>Gerar e Enviar Orçamento ao Cliente</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
