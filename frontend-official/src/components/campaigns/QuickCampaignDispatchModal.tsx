import React, { useState, useEffect, useMemo } from "react";
import {
  Megaphone,
  Rocket,
  ShieldCheck,
  Lightning,
  Clock,
  Sparkle,
  ArrowRight,
  CheckCircle,
  X,
  ChatCircleText,
  FileText,
  Microphone,
  Image as ImageIcon,
  VideoCamera,
  Paperclip,
  User,
  Phone,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { formatPhoneNumber } from "@/pages/Inbox/utils";
import { useNavigate } from "react-router-dom";
import { cn } from "@/core/lib/utils";

export interface QuickCampaignContact {
  id?: string;
  name: string;
  phone: string;
  sessionId?: string;
  avatarUrl?: string;
}

interface QuickCampaignDispatchModalProps {
  open: boolean;
  onClose: () => void;
  contact: QuickCampaignContact | null;
  onDispatched?: () => void;
}

export function QuickCampaignDispatchModal({
  open,
  onClose,
  contact,
  onDispatched,
}: QuickCampaignDispatchModalProps) {
  const navigate = useNavigate();
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [selectedReplyId, setSelectedReplyId] = useState<string>("custom");
  const [customText, setCustomText] = useState("");
  const [cadence, setCadence] = useState<"human" | "fast">("human");
  const [dispatching, setDispatching] = useState(false);

  // Carregar respostas rápidas e fluxos disponíveis ao abrir
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingReplies(true);
    apiService
      .getQuickReplies?.()
      .then((data: any) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : data?.data || [];
        setQuickReplies(list);
        // Pré-selecionar o primeiro script de fluxo se houver
        const firstFlow = list.find((i: any) => i.isFlow || i.category === "SCRIPTS" || (i.steps && i.steps.length > 0));
        if (firstFlow) {
          setSelectedReplyId(String(firstFlow.id));
        } else if (list.length > 0) {
          setSelectedReplyId(String(list[0].id));
        }
      })
      .catch(() => {
        if (active) notify.error("Não foi possível carregar a lista de fluxos.");
      })
      .finally(() => {
        if (active) setLoadingReplies(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const selectedReply = useMemo(() => {
    if (selectedReplyId === "custom") return null;
    return quickReplies.find((r) => String(r.id) === String(selectedReplyId)) || null;
  }, [selectedReplyId, quickReplies]);

  const resolvedSteps = useMemo(() => {
    if (!selectedReply) {
      return customText.trim()
        ? [{ type: "text", value: customText.trim(), delaySeconds: cadence === "human" ? 8 : 2 }]
        : [];
    }

    if (Array.isArray(selectedReply.steps) && selectedReply.steps.length > 0) {
      return selectedReply.steps.map((st: any, idx: number) => ({
        type: st.type || (st.mediaUrl ? "media" : "text"),
        value: st.value || st.text || st.content || "",
        caption: st.caption || "",
        mediaUrl: st.mediaUrl || st.value,
        delaySeconds: idx === 0 ? 0 : (cadence === "human" ? 8 : 3),
      }));
    }

    if (Array.isArray(selectedReply.items) && selectedReply.items.length > 0) {
      return selectedReply.items.map((st: any, idx: number) => ({
        type: st.type || "text",
        value: st.value || st.content || "",
        caption: st.caption || "",
        mediaUrl: st.mediaUrl,
        delaySeconds: idx === 0 ? 0 : (cadence === "human" ? 8 : 3),
      }));
    }

    return [
      {
        type: "text",
        value: selectedReply.content || selectedReply.text || "",
        delaySeconds: cadence === "human" ? 8 : 2,
      },
    ];
  }, [selectedReply, customText, cadence]);

  const handleStartDispatch = async () => {
    if (!contact || !contact.phone) {
      notify.warn("Telefone do contato inválido para disparo.");
      return;
    }

    if (selectedReplyId === "custom" && !customText.trim()) {
      notify.warn("Digite a mensagem para o disparo.");
      return;
    }

    setDispatching(true);
    try {
      const targetPhone = contact.phone.replace(/@.*$/, "").replace(/\D/g, "");
      const session = contact.sessionId || "main";
      const overrideDelayMs = cadence === "human" ? 8000 : 4000;

      if (selectedReply) {
        // Disparar fluxo cadastrado no sistema
        await apiService.executeQuickReplyFlow(selectedReply.id, {
          phone: targetPhone,
          sessionId: session,
          overrideDelayMs,
          steps: resolvedSteps,
        });
      } else {
        // Disparar mensagem avulsa com simulação humanizada
        await apiService.sendMessage({
          to: targetPhone,
          content: customText.trim(),
          sessionId: session,
          simulatedTyping: cadence === "human",
          typingDelayMs: cadence === "human" ? 6000 : 1000,
        });
      }

      notify.success(`Disparo iniciado com sucesso para ${contact.name}!`);
      onDispatched?.();
      onClose();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao iniciar disparo para o contato.");
    } finally {
      setDispatching(false);
    }
  };

  const handleGoToCampaignsFull = () => {
    onClose();
    if (contact) {
      navigate("/campaigns", {
        state: {
          reactivationContacts: [
            {
              name: contact.name,
              phone: contact.phone,
            },
          ],
        },
      });
      notify.info(`Contato "${contact.name}" pré-carregado no gerenciador de campanhas.`);
    } else {
      navigate("/campaigns");
    }
  };

  if (!open || !contact) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] sm:max-w-[640px] border-border/80 bg-card/95 backdrop-blur-2xl p-0 overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="sr-only">
          <DialogTitle>Pop-up de Disparos</DialogTitle>
          <DialogDescription>Configurar e disparar campanhas ou fluxos para este contato</DialogDescription>
        </DialogHeader>

        {/* HEADER DO POP-UP DE DISPARO */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-background to-teal-950/30 p-4 border-b border-border/60 relative shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
                <Megaphone className="h-5 w-5" weight="fill" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground truncate">Pop-up de Disparos</h3>
                  <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/40 text-emerald-400 bg-emerald-500/10 py-0">
                    Disparo Individual
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Envie fluxos sequenciais anti-ban ou campanhas diretas para este lead
                </p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onClose}
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* DADOS DO CONTATO RECEPTOR */}
          <div className="mt-3 bg-card/60 border border-border/50 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="h-8 w-8 border border-border/60 shrink-0">
                {contact.avatarUrl && <AvatarImage src={contact.avatarUrl} alt={contact.name} />}
                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                  {contact.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">{contact.name}</p>
                <p className="text-[11px] text-muted-foreground font-mono leading-tight">
                  {formatPhoneNumber(contact.phone)}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-muted-foreground block font-mono">
                Chip: <strong className="text-foreground">{contact.sessionId || "main"}</strong>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                WhatsApp Conectado
              </span>
            </div>
          </div>
        </div>

        {/* CORPO DO POP-UP: Seleção de Fluxo e Parâmetros */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Seletor de Modelo / Fluxo de Disparo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Selecione o Fluxo ou Script de Disparo:</span>
              {loadingReplies && <span className="text-[10px] text-muted-foreground animate-pulse">Carregando fluxos...</span>}
            </label>
            <select
              value={selectedReplyId}
              onChange={(e) => setSelectedReplyId(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium cursor-pointer"
            >
              <option value="custom">✍️ Mensagem Personalizada (Texto Avulso)</option>
              {quickReplies.map((r: any) => (
                <option key={r.id} value={String(r.id)}>
                  {r.isFlow || r.category === "SCRIPTS" ? "⚡ [FLUXO] " : "💬 [RESPOSTA] "}
                  {r.title || r.text || `Item #${r.id}`}
                  {r.steps?.length ? ` (${r.steps.length} etapas)` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Campo de texto se for personalizado */}
          {selectedReplyId === "custom" && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-xs font-semibold text-foreground">Mensagem do Disparo:</label>
              <Textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Olá! Temos uma condição especial para você hoje..."
                className="text-xs min-h-[90px] bg-background border-border resize-none"
              />
            </div>
          )}

          {/* Prévia das Etapas do Fluxo */}
          {resolvedSteps.length > 0 && (
            <div className="space-y-2 bg-muted/20 border border-border/50 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ChatCircleText className="h-3.5 w-3.5 text-emerald-400" />
                  Etapas do Disparo ({resolvedSteps.length})
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {cadence === "human" ? "Delay dinâmico: 8s" : "Delay direto: 2s"}
                </span>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {resolvedSteps.map((step: any, index: number) => (
                  <div key={index} className="bg-card border border-border/60 rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <span className="h-4 w-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
                          {index + 1}
                        </span>
                        {step.type === "audio" && "Áudio WhatsApp (PTT)"}
                        {step.type === "image" && "Imagem / Banner"}
                        {step.type === "video" && "Vídeo"}
                        {(step.type === "text" || !step.type) && "Texto"}
                      </span>
                      {index > 0 && (
                        <span className="text-[10px] text-amber-400/90 font-mono flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          +{step.delaySeconds}s delay
                        </span>
                      )}
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap line-clamp-3 text-[11px] pl-5">
                      {step.caption ? `[Legenda] ${step.caption}` : step.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seletor de Cadência Anti-Ban */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Modo de Disparo & Proteção WhatsApp:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setCadence("human")}
                className={cn(
                  "p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between",
                  cadence === "human"
                    ? "bg-emerald-500/10 border-emerald-500/50 shadow-xs"
                    : "bg-card hover:bg-muted/40 border-border/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" weight="fill" />
                    Humanizada Anti-Ban
                  </span>
                  {cadence === "human" && <CheckCircle className="h-4 w-4 text-emerald-400" weight="fill" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Simula digitação real (6-12s) e intervalos seguros entre etapas. Protege o chip contra suspensão.
                </p>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => setCadence("fast")}
                className={cn(
                  "p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between",
                  cadence === "fast"
                    ? "bg-amber-500/10 border-amber-500/50 shadow-xs"
                    : "bg-card hover:bg-muted/40 border-border/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Lightning className="h-3.5 w-3.5 text-amber-400" weight="fill" />
                    Disparo Turbo (Rápido)
                  </span>
                  {cadence === "fast" && <CheckCircle className="h-4 w-4 text-amber-400" weight="fill" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Intervalo reduzido de 2 segundos. Ideal para atendimento ativo já iniciado com o cliente.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DE AÇÕES */}
        <div className="p-3 sm:p-4 bg-muted/20 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGoToCampaignsFull}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 w-full sm:w-auto"
            title="Abrir página completa de campanhas para disparos em massa"
          >
            <span>Gerenciador de Campanhas</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={dispatching}
              className="h-8 text-xs px-3 border-border/70"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={dispatching || resolvedSteps.length === 0}
              onClick={handleStartDispatch}
              className="h-8 text-xs px-4 font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md gap-1.5"
            >
              <Rocket className="h-3.5 w-3.5" weight="fill" />
              <span>{dispatching ? "Iniciando disparo..." : "Disparar Agora"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
