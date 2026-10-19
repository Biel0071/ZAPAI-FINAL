import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  ClipboardCopy,
  Send,
  CheckCircle2,
  Share2,
  FileSpreadsheet,
  Settings,
  Truck,
  CreditCard,
  MapPin,
  User,
  Package,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { formatPhoneNumber } from "../utils";

interface OrderSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: any;
  conversationId: string;
  customerName?: string;
  customerPhone?: string;
  onInsertInComposer?: (text: string) => void;
  onFinalized?: () => void;
}

export function OrderSheetModal({
  isOpen,
  onClose,
  sheet,
  conversationId,
  customerName = "Cliente",
  customerPhone = "",
  onInsertInComposer,
  onFinalized,
}: OrderSheetModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [syncingErp, setSyncingErp] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Webhook & API Key configuration stored in local storage
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem("zai_erp_webhook_url") || "";
  });
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem("zai_erp_api_key") || "";
  });

  const handleSaveConfig = () => {
    localStorage.setItem("zai_erp_webhook_url", webhookUrl);
    localStorage.setItem("zai_erp_api_key", apiKey);
    setShowConfig(false);
    toast({
      title: "Configurações Salvas",
      description: "Webhook e chave de API do ERP atualizados!",
    });
  };

  const sheetDetails = sheet?.sheet_data || sheet || {};
  const items = sheetDetails.items || [];
  const summaryText = sheet?.summary_text || "";

  const formatBRL = (val: number | string = 0) => {
    const num = Number(val) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const productTotal = Number(sheetDetails.productTotal ?? sheet?.total_price ?? 0);
  const freight = Number(sheetDetails.freight ?? 65.12);
  const orderTotal = Number(sheetDetails.orderTotal ?? (productTotal + freight));
  const deliveryTime = sheetDetails.deliveryTime || "3 a 5 dias úteis";
  const pixTotal = Number(sheetDetails.pixTotal ?? (productTotal * 0.95 + freight));
  const installment10x = Number(sheetDetails.installment10x ?? (orderTotal > 0 ? orderTotal / 10 : 0));

  const cleanPhoneDisplay = useMemo(() => {
    const raw = String(sheetDetails.phone || customerPhone || "").trim();
    if (!raw) return "Não informado";
    if (raw.includes("@lid")) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13 && digits.startsWith("55")) {
        return formatPhoneNumber(digits);
      }
      return "WhatsApp Oficial";
    }
    return formatPhoneNumber(raw);
  }, [sheetDetails.phone, customerPhone]);

  const cleanNameDisplay = useMemo(() => {
    const raw = String(sheetDetails.customerName || customerName || "").trim();
    if (!raw || raw.startsWith("Cliente WhatsApp #") || raw.includes("@")) {
      return "Cliente";
    }
    return raw;
  }, [sheetDetails.customerName, customerName]);

  const cleanAddressDisplay = useMemo(() => {
    const raw = String(sheetDetails.deliveryAddress || "").trim();
    if (!raw || /^(?:gr[aá]tis|frete|a combinar)/i.test(raw)) {
      return "A combinar com o atendente";
    }
    return raw;
  }, [sheetDetails.deliveryAddress]);

  const cleanNeighborhoodDisplay = useMemo(() => {
    const b = String(sheetDetails.deliveryNeighborhood || "").trim();
    if (!b || /^(?:gr[aá]tis|frete)/i.test(b)) {
      return null;
    }
    return b;
  }, [sheetDetails.deliveryNeighborhood]);

  const cleanCityDisplay = useMemo(() => {
    const c = String(sheetDetails.deliveryCity || "").trim();
    if (!c || /^(?:gr[aá]tis|frete)/i.test(c)) {
      return null;
    }
    return c;
  }, [sheetDetails.deliveryCity]);

  const handleCopy = async () => {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      toast({
        title: "Ficha Copiada!",
        description: "Texto oficial pronto para colar onde precisar.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o texto automaticamente.",
        variant: "destructive",
      });
    }
  };

  const handleSendToChat = () => {
    if (summaryText && onInsertInComposer) {
      onInsertInComposer(summaryText);
      toast({
        title: "Ficha no Chat!",
        description: "Texto inserido no campo de mensagem para revisão.",
      });
      onClose();
    }
  };

  const handleSyncErp = async () => {
    setSyncingErp(true);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/sheet/erp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: sheet?.id,
          webhookUrl: webhookUrl || undefined,
          apiKey: apiKey || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Falha na sincronização com ERP");
      }

      toast({
        title: "Disparo ERP Efetuado!",
        description: data.delivered
          ? "Dados enviados com sucesso para o Webhook ERP/DANFE!"
          : "Ficha registrada na fila de eventos do sistema.",
      });
    } catch (err: any) {
      toast({
        title: "Erro na Integração ERP",
        description: err?.message || "Não foi possível disparar o webhook.",
        variant: "destructive",
      });
    } finally {
      setSyncingErp(false);
    }
  };

  const handleFinalizeAttendance = async () => {
    setFinalizing(true);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/confirm-sheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: sheet?.id,
          autoSend: false,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao finalizar atendimento");
      }

      toast({
        title: "Atendimento Finalizado!",
        description: "Status alterado para 'Aguarda PIX' e IA pausada para o operador humano.",
      });

      if (onFinalized) onFinalized();
      onClose();
    } catch (err: any) {
      toast({
        title: "Erro ao finalizar",
        description: err?.message || "Não foi possível comutar para Aguarda PIX.",
        variant: "destructive",
      });
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border/80 p-0 shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950/60 via-card to-card p-5 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Ficha de Pedido & Orçamento
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                  ZAI Comercial
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Revise os dados apurados pela IA antes do fechamento ou envio para ERP
              </DialogDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title="Configurar Integração Webhook / ERP"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Webhooks & API</span>
          </Button>
        </div>

        {/* Webhook / ERP Config Accordion */}
        {showConfig && (
          <div className="p-4 bg-muted/30 border-b border-border/60 animate-in fade-in duration-150 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5 text-primary" />
                Integração Direta: Webhook & Chave API (ERP / DANFE)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">URL do Webhook (POST)</label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.meuerp.com.br/pedidos/webhook"
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Chave de API / Bearer Token</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowConfig(false)} className="h-7 text-xs">
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSaveConfig} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
                Salvar Configurações
              </Button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* 1. Cliente & Entrega */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cliente */}
            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground pb-1 border-b border-border/40">
                <User className="h-3.5 w-3.5 text-emerald-400" />
                Dados do Cliente
              </div>
              <div>
                <span className="text-muted-foreground">Nome: </span>
                <span className="font-semibold text-foreground">{cleanNameDisplay}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Telefone: </span>
                <span className="font-medium text-foreground">{cleanPhoneDisplay}</span>
              </div>
              {sheetDetails.cpf && (
                <div>
                  <span className="text-muted-foreground">CPF: </span>
                  <span className="font-medium text-foreground">{sheetDetails.cpf}</span>
                </div>
              )}
              {sheetDetails.email && (
                <div>
                  <span className="text-muted-foreground">E-mail: </span>
                  <span className="font-medium text-foreground">{sheetDetails.email}</span>
                </div>
              )}
            </div>

            {/* Entrega */}
            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground pb-1 border-b border-border/40">
                <MapPin className="h-3.5 w-3.5 text-blue-400" />
                Dados de Entrega
              </div>
              <div>
                <span className="text-muted-foreground">Endereço: </span>
                <span className="font-medium text-foreground">{cleanAddressDisplay}</span>
              </div>
              {cleanNeighborhoodDisplay && (
                <div>
                  <span className="text-muted-foreground">Bairro: </span>
                  <span className="font-medium text-foreground">{cleanNeighborhoodDisplay}</span>
                </div>
              )}
              {(cleanCityDisplay || sheetDetails.deliveryState) && (
                <div>
                  <span className="text-muted-foreground">Cidade/UF: </span>
                  <span className="font-medium text-foreground">
                    {[cleanCityDisplay, sheetDetails.deliveryState].filter(Boolean).join(" - ")}
                  </span>
                </div>
              )}
              {sheetDetails.deliveryCep && (
                <div>
                  <span className="text-muted-foreground">CEP: </span>
                  <span className="font-medium text-foreground">{sheetDetails.deliveryCep}</span>
                </div>
              )}
              {sheetDetails.reference && (
                <div>
                  <span className="text-muted-foreground">Referência: </span>
                  <span className="font-medium text-foreground">{sheetDetails.reference}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Itens do Pedido */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center justify-between font-semibold text-foreground pb-1 border-b border-border/40">
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-amber-400" />
                Itens do Pedido ({items.length})
              </span>
              <span className="text-muted-foreground text-[11px]">Qtd × Valor Unitário</span>
            </div>

            {items.length === 0 ? (
              <p className="text-muted-foreground italic py-2 text-center">Nenhum item detectado automaticamente.</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1 px-2 rounded-lg bg-card/60 border border-border/40">
                    <div>
                      <span className="font-semibold text-foreground">{it.item}</span>
                      {it.specification && (
                        <span className="text-[11px] text-muted-foreground ml-1.5">({it.specification})</span>
                      )}
                    </div>
                    <div className="font-mono text-emerald-400 font-semibold shrink-0">
                      {it.quantity}x · {formatBRL(it.totalPrice || it.unitPrice || 0)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Resumo Financeiro & Condições de Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Financeiro */}
            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground pb-1 border-b border-border/40">
                <Truck className="h-3.5 w-3.5 text-emerald-400" />
                Resumo Financeiro & Logística
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor dos Produtos:</span>
                <span className="font-medium text-foreground">{formatBRL(productTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete:</span>
                <span className="font-medium text-foreground">{formatBRL(freight)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border/30 font-semibold">
                <span className="text-foreground">Total do Pedido:</span>
                <span className="text-emerald-400 font-mono text-sm">{formatBRL(orderTotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                <span>Prazo de Entrega:</span>
                <span className="font-medium text-foreground">{deliveryTime}</span>
              </div>
            </div>

            {/* Pagamento */}
            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground pb-1 border-b border-border/40">
                <CreditCard className="h-3.5 w-3.5 text-purple-400" />
                Condições de Pagamento
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex justify-between font-bold text-emerald-400">
                  <span>PIX à Vista (5% OFF):</span>
                  <span>{formatBRL(pixTotal)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Desconto aplicado sobre o valor dos produtos</p>
              </div>
              <div className="flex justify-between text-muted-foreground pt-1">
                <span>Cartão de Crédito:</span>
                <span className="font-semibold text-foreground">10x de {formatBRL(installment10x)} sem juros</span>
              </div>
            </div>
          </div>

          {/* Observações se houver */}
          {sheetDetails.observations && (
            <div className="p-2.5 rounded-lg bg-muted/10 border border-border/40 text-muted-foreground text-[11px]">
              <span className="font-semibold text-foreground">Observações: </span>
              {sheetDetails.observations}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/20 border-t border-border/70 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 gap-1.5 text-xs border-border/80 hover:bg-muted"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              {copied ? "Copiado!" : "Copiar Ficha"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSyncErp}
              disabled={syncingErp}
              className="h-8 gap-1.5 text-xs text-blue-400 border-blue-500/40 hover:bg-blue-500/10"
              title="Disparar Webhook para ERP / DANFE / Orçamento"
            >
              <Share2 className="h-3.5 w-3.5" />
              {syncingErp ? "Disparando..." : "Enviar p/ ERP (Webhook)"}
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onInsertInComposer && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSendToChat}
                className="h-8 gap-1.5 text-xs"
              >
                <Send className="h-3.5 w-3.5" />
                Colocar no Chat
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleFinalizeAttendance}
              disabled={finalizing}
              className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)] font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {finalizing ? "Finalizando..." : "Finalizar (Aguarda PIX)"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
