import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Package,
  Receipt,
  User,
  Phone,
  RefreshCw,
  X,
  Send,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { apiService } from "@/core/services/apiService";
import { getSharedSocket } from "@/core/runtime/socket/socketManager";

interface CustomerOrder {
  id: string;
  order_id: string;
  conversation_id?: string;
  phone: string;
  order_title?: string;
  item_count: number;
  total_amount: number | string;
  currency: string;
  status: "pending" | "confirmed" | "rejected" | string;
  items?: Array<{
    id?: string;
    name?: string;
    title?: string;
    price?: number | string;
    quantity?: number;
    currency?: string;
    imageUrl?: string;
  }>;
  customer_notes?: string;
  created_at: string;
  updated_at?: string;
}

interface CustomerOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  customerPhone?: string;
  customerName?: string;
  onOrderConfirmed?: (order: CustomerOrder) => void;
}

export function CustomerOrdersDrawer({
  isOpen,
  onClose,
  conversationId,
  customerPhone,
  customerName,
  onOrderConfirmed,
}: CustomerOrdersDrawerProps) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await apiService.getCommerceOrders({
        conversationId,
        phone: customerPhone,
      });
      if (res?.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
        if (res.orders.length > 0 && !selectedOrder) {
          setSelectedOrder(res.orders[0]);
        }
      }
    } catch (err: any) {
      console.warn("[CustomerOrdersDrawer] Failed to load orders:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen, conversationId, customerPhone]);

  // Realtime updates
  useEffect(() => {
    const socket = getSharedSocket();
    if (!socket || typeof socket.on !== "function") return;

    const handleOrderEvent = (order: any) => {
      if (!order) return;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === order.id || o.order_id === order.order_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...order };
          return updated;
        }
        return [order, ...prev];
      });
      if (selectedOrder && (selectedOrder.id === order.id || selectedOrder.order_id === order.order_id)) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...order } : order));
      }
    };

    socket.on("commerce:order_received", handleOrderEvent);
    socket.on("commerce:order_updated", handleOrderEvent);

    return () => {
      socket.off("commerce:order_received", handleOrderEvent);
      socket.off("commerce:order_updated", handleOrderEvent);
    };
  }, [selectedOrder]);

  const handleConfirm = async (order: CustomerOrder) => {
    try {
      setProcessingId(order.id);
      const res = await apiService.confirmCommerceOrder(order.id, confirmNotes);
      if (res?.success) {
        toast({
          title: "Pedido Confirmado!",
          description: `Pedido #${order.order_id || order.id} foi confirmado e a notificação foi enviada no WhatsApp.`,
        });
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: "confirmed" } : o))
        );
        setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, status: "confirmed" } : prev));
        if (onOrderConfirmed) onOrderConfirmed({ ...order, status: "confirmed" });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao confirmar",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setProcessingId(null);
      setConfirmNotes("");
    }
  };

  const handleReject = async (order: CustomerOrder) => {
    try {
      setProcessingId(order.id);
      const res = await apiService.rejectCommerceOrder(order.id, rejectReason);
      if (res?.success) {
        toast({
          title: "Pedido Recusado",
          description: `Status do pedido #${order.order_id || order.id} atualizado.`,
        });
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: "rejected" } : o))
        );
        setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, status: "rejected" } : prev));
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao recusar",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setProcessingId(null);
      setIsRejecting(false);
      setRejectReason("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-[#0c1317] border-l border-emerald-500/20 text-neutral-100 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#111b21]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              Pedidos WhatsApp Commerce
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 text-xs">
                Nativo Meta
              </Badge>
            </h2>
            <p className="text-xs text-neutral-400">
              {customerName ? `${customerName} (${customerPhone || ""})` : "Pedidos recebidos pelo carrinho do WhatsApp"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
            onClick={loadOrders}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-400 space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-neutral-500">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-neutral-200">Nenhum pedido recebido ainda</h3>
              <p className="text-xs max-w-xs text-neutral-400">
                Quando o cliente adicionar produtos ao carrinho no WhatsApp e enviar, o pedido aparecerá aqui automaticamente.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Orders List Accordion/Cards */}
            {orders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;
              const isPending = order.status === "pending";
              const isConfirmed = order.status === "confirmed";
              const isRejected = order.status === "rejected";

              const items = Array.isArray(order.items) ? order.items : [];
              const totalVal = Number(order.total_amount) || 0;
              const formattedTotal = totalVal.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              });

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border transition-all ${
                    isSelected
                      ? "border-emerald-500/50 bg-[#162229]"
                      : "border-white/10 bg-[#111b21] hover:border-white/20"
                  } p-4 space-y-3 cursor-pointer`}
                  onClick={() => setSelectedOrder(order)}
                >
                  {/* Order Top Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-emerald-400">
                        #{order.order_id || order.id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-neutral-400">
                        • {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div>
                      {isPending && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 flex items-center gap-1 text-[11px]">
                          <Clock className="h-3 w-3" /> Pendente
                        </Badge>
                      )}
                      {isConfirmed && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" /> Confirmado
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30 flex items-center gap-1 text-[11px]">
                          <XCircle className="h-3 w-3" /> Recusado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="rounded-lg bg-[#0c1317]/80 p-3 space-y-2 border border-white/5">
                    <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                      <Package className="h-3.5 w-3.5 text-emerald-400" />
                      Itens do Pedido ({order.item_count || items.length})
                    </div>
                    {items.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="h-5 w-5 rounded bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                                {it.quantity || 1}x
                              </span>
                              <span className="font-medium text-neutral-200">{it.name || it.title || "Produto"}</span>
                            </div>
                            <span className="text-neutral-300 font-mono">
                              R$ {(Number(it.price || 0) * Number(it.quantity || 1)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-300">{order.order_title || "Itens do catálogo WhatsApp"}</p>
                    )}

                    {order.customer_notes && (
                      <div className="pt-2 border-t border-white/5 text-xs text-neutral-300 flex items-start gap-1.5">
                        <span className="text-emerald-400 font-semibold">Obs:</span>
                        <span>{order.customer_notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Total & Action Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-xs text-neutral-400">Total do Pedido:</span>
                      <div className="text-base font-bold text-emerald-400 font-mono">{formattedTotal}</div>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                            setIsRejecting(true);
                          }}
                          disabled={processingId === order.id}
                        >
                          Recusar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-8 text-xs gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirm(order);
                          }}
                          disabled={processingId === order.id}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirmar Pedido
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Reject reason input prompt */}
                  {isRejecting && selectedOrder?.id === order.id && (
                    <div className="pt-2 border-t border-white/10 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        placeholder="Motivo da recusa (ex: fora de estoque)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="h-8 bg-[#0c1317] border-white/10 text-xs text-white"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-neutral-400"
                          onClick={() => setIsRejecting(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-red-600 hover:bg-red-500 text-white"
                          onClick={() => handleReject(order)}
                          disabled={processingId === order.id}
                        >
                          Confirmar Recusa
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
