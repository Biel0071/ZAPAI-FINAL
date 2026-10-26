import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Brain,
  Tag,
  TrendUp,
  Clock,
  Sparkle,
  ShieldCheck,
  Phone,
  Flame,
  Snowflake,
  Sun,
  Chat,
  MagicWand,
  Megaphone,
  MagnifyingGlassPlus,
  PencilSimple,
  Copy,
  Check,
  Plus,
  FloppyDisk,
  NotePencil,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { TagIconBadge } from "@/components/inbox/TagIconBadge";
import { getTagColor, formatPhoneNumber } from "@/pages/Inbox/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadKnowledgeGraph } from "@/components/contacts/LeadKnowledgeGraph";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { businessLabel } from "@/core/utils/tagEmojis";
import { cn } from "@/core/lib/utils";

export interface LeadDrawerLead {
  id: string;
  name: string;
  phone: string;
  temperature?: string;
  status?: string;
  funnelStage?: string;
  tags?: string[];
  lastMessage?: string;
  updatedAt?: string;
  conversationId?: string;
  sessionId?: string;
  avatarUrl?: string;
  notes?: string;
}

interface LeadDrawerProps {
  lead: LeadDrawerLead | null;
  onClose: () => void;
  onUpdateLead?: (id: string, updates: any) => void;
  fromInbox?: boolean;
}

const FUNNEL_STAGES = [
  { value: "new_lead", label: "🟢 Lead Novo" },
  { value: "first_contact", label: "💬 Primeiro Contato" },
  { value: "price_sent", label: "🏷️ Preço Enviado" },
  { value: "interested", label: "💡 Interessado" },
  { value: "negotiation", label: "🤝 Em Negociação" },
  { value: "ready_to_buy", label: "⚡ Pronto p/ Comprar" },
  { value: "closed", label: "🏆 Venda Fechada" },
  { value: "lost", label: "❌ Perdido" },
];

const PRESET_LABEL_COLORS = [
  { name: "Verde WhatsApp", hex: "#00d26a" },
  { name: "Azul", hex: "#5ac8fa" },
  { name: "Laranja", hex: "#ff9500" },
  { name: "Roxo", hex: "#af52de" },
  { name: "Vermelho", hex: "#ff3b30" },
  { name: "Cinza", hex: "#8e8e93" },
];

export function LeadDrawer({ lead, onClose, onUpdateLead, fromInbox = false }: LeadDrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"summary" | "graph" | "timeline" | "products" | "followups">("summary");
  const [loadingAi, setLoadingAi] = useState(false);
  const leadScope = `${lead?.sessionId || ""}:${lead?.conversationId || lead?.id || ""}`;
  const currentLeadScope = useRef(leadScope);
  currentLeadScope.current = leadScope;
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [followupPlan, setFollowupPlan] = useState<any>(null);
  const [recoveryApproach, setRecoveryApproach] = useState<any>(null);

  // Modal / Editable states
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(lead?.name || "");
  const [currentTemp, setCurrentTemp] = useState(lead?.temperature || "cold");
  const [currentFunnel, setCurrentFunnel] = useState(lead?.funnelStage || "new_lead");
  const [currentTags, setCurrentTags] = useState<string[]>(Array.isArray(lead?.tags) ? lead.tags : []);
  const [newTagInput, setNewTagInput] = useState("");
  const [selectedTagColor, setSelectedTagColor] = useState<string>("#00d26a");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [leadNotes, setLeadNotes] = useState(lead?.notes || "");
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Real WhatsApp & System Labels loaded from database
  const [realLabels, setRealLabels] = useState<Array<{ id: string; name: string; color_hex: string }>>([
    { id: "1", name: "NOVO CLIENTE", color_hex: "#00d26a" },
    { id: "2", name: "AGENDANDO", color_hex: "#5ac8fa" },
    { id: "3", name: "PAGO", color_hex: "#198038" },
    { id: "4", name: "CANCELADO", color_hex: "#e5e5ea" },
    { id: "5", name: "Favoritos", color_hex: "#ff9500" },
    { id: "6", name: "Não lidas", color_hex: "#00a884" },
    { id: "7", name: "Grupos", color_hex: "#53bdeb" },
  ]);

  // Sync state when incoming lead changes
  useEffect(() => {
    if (lead) {
      setEditName(lead.name || "");
      setCurrentTemp(lead.temperature || "cold");
      setCurrentFunnel(lead.funnelStage || "new_lead");
      setCurrentTags(Array.isArray(lead.tags) ? lead.tags : []);
      setLeadNotes(lead.notes || "");
      setIsEditingName(false);
    }
  }, [lead?.id, lead?.name, lead?.temperature, lead?.funnelStage, lead?.tags, lead?.notes]);

  // Load real WhatsApp labels from PostgreSQL & WhatsApp session
  useEffect(() => {
    let isMounted = true;
    if (lead) {
      apiService
        .getWhatsAppLabels?.(lead.sessionId)
        ?.then((res) => {
          if (!isMounted || !res?.labels || !Array.isArray(res.labels)) return;
          setRealLabels((prev) => {
            const map = new Map<string, { id: string; name: string; color_hex: string }>();
            res.labels.forEach((l) => {
              if (!l.deleted && l.name) {
                map.set(l.name.toLowerCase(), {
                  id: String(l.id),
                  name: l.name,
                  color_hex: l.color_hex || "#00d26a",
                });
              }
            });
            prev.forEach((p) => {
              if (!map.has(p.name.toLowerCase())) {
                map.set(p.name.toLowerCase(), p);
              }
            });
            return Array.from(map.values());
          });
        })
        ?.catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [lead?.sessionId, lead?.id]);

  useEffect(() => {
    let active = true;
    setAiData(null);
    setFollowupPlan(null);
    setRecoveryApproach(null);
    setAnalysisError(null);
    setActiveTab("summary");
    const targetId = lead?.conversationId || lead?.id;
    if (!targetId) {
      setLoadingAi(false);
      return;
    }
    setLoadingAi(true);
    apiService
      .getConversationInsights?.(targetId)
      ?.then((res) => {
        if (active) {
          const data = (res as any)?.data && typeof (res as any).data === "object" ? (res as any).data : res;
          setAiData(data || null);
        }
      })
      ?.catch(() => {
        if (active) setAnalysisError("Não foi possível carregar a análise deste contato.");
      })
      ?.finally(() => {
        if (active) setLoadingAi(false);
      });
    return () => {
      active = false;
    };
  }, [leadScope, lead?.conversationId, lead?.id]);

  if (!lead) return null;

  const tempNorm = (currentTemp || "").toLowerCase();
  const isLid =
    String(lead.phone || "").includes("@lid") ||
    (/^\d{14,16}$/.test(String(lead.phone || "").replace(/@.*$/, "")) && !String(lead.phone || "").startsWith("55"));

  const confidence =
    typeof aiData?.confidence === "number" && Number.isFinite(aiData.confidence)
      ? aiData.confidence
      : typeof aiData?.leadScore === "number" && Number.isFinite(aiData.leadScore)
      ? aiData.leadScore <= 1
        ? aiData.leadScore
        : aiData.leadScore / 100
      : null;

  // Handlers for Temperature & Funnel
  const handleSetTemperature = (temp: "hot" | "warm" | "cold") => {
    setCurrentTemp(temp);
    onUpdateLead?.(lead.id, { lead_temperature: temp });
    notify.success(`Temperatura atualizada para ${temp === "hot" ? "Quente" : temp === "warm" ? "Morno" : "Frio"}`);
  };

  const handleSetFunnel = (stage: string) => {
    setCurrentFunnel(stage);
    onUpdateLead?.(lead.id, { funnel_stage: stage });
    notify.success("Estágio do funil atualizado com sucesso!");
  };

  // Toggle real label on/off
  const handleToggleRealLabel = (labelName: string) => {
    const exists = currentTags.some((t) => t.toLowerCase() === labelName.toLowerCase());
    let nextTags: string[];
    if (exists) {
      nextTags = currentTags.filter((t) => t.toLowerCase() !== labelName.toLowerCase());
      notify.info(`Etiqueta "${labelName}" removida.`);
    } else {
      nextTags = [...currentTags, labelName];
      notify.success(`Etiqueta real "${labelName}" associada ao contato!`);
    }
    setCurrentTags(nextTags);
    onUpdateLead?.(lead.id, { tags: nextTags });
  };

  // Create new real label in database and sync with WhatsApp
  const handleCreateRealLabel = async () => {
    const raw = newTagInput.trim();
    if (!raw) return;
    setIsCreatingTag(true);
    try {
      const res = await apiService.createWhatsAppLabel?.({
        name: raw,
        colorHex: selectedTagColor,
        sessionId: lead.sessionId,
      })?.catch(() => null);

      const created = res?.label || { id: String(Date.now()), name: raw, color_hex: selectedTagColor };

      setRealLabels((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === created.name.toLowerCase())) return prev;
        return [...prev, { id: String(created.id), name: created.name, color_hex: created.color_hex || selectedTagColor }];
      });

      if (!currentTags.some((t) => t.toLowerCase() === created.name.toLowerCase())) {
        const nextTags = [...currentTags, created.name];
        setCurrentTags(nextTags);
        onUpdateLead?.(lead.id, { tags: nextTags });
      }

      setNewTagInput("");
      notify.success(`Etiqueta real "${created.name}" criada e sincronizada com sucesso!`);
    } catch {
      notify.error("Erro ao criar etiqueta real.");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = currentTags.filter((t) => t !== tagToRemove);
    setCurrentTags(nextTags);
    onUpdateLead?.(lead.id, { tags: nextTags });
    notify.info(`Etiqueta "${tagToRemove}" removida.`);
  };

  // Handler for Name
  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setIsEditingName(false);
    onUpdateLead?.(lead.id, { name: trimmed });
    notify.success("Nome atualizado!");
  };

  // Handler for Copy Phone
  const handleCopyPhone = () => {
    if (!lead.phone) return;
    navigator.clipboard.writeText(lead.phone);
    setCopiedPhone(true);
    notify.success("Telefone copiado para a área de transferência!");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Handler for Notes
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await onUpdateLead?.(lead.id, { notes: leadNotes });
      notify.success("Anotações do lead salvas com sucesso!");
    } catch {
      notify.error("Erro ao salvar anotações.");
    } finally {
      setSavingNotes(false);
    }
  };

  // Handler to go to Campaigns
  const handleGoToCampaigns = () => {
    onClose();
    navigate("/campaigns", {
      state: {
        reactivationContacts: [
          {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
          },
        ],
      },
    });
    notify.success(`Contato "${lead.name}" selecionado para disparo de campanha.`);
  };

  const handleGenerateFollowup = async () => {
    const scope = leadScope;
    try {
      notify.info("Gerando plano de follow-up por IA...");
      const res = await apiService.getAIFollowupPlan(lead.conversationId || lead.id, lead.phone);
      if (currentLeadScope.current !== scope) return;
      if (!res?.data) throw new Error("Resposta indisponível");
      if (res?.data) {
        setFollowupPlan(res.data);
        setActiveTab("followups");
        notify.success("Plano de Follow-up inteligente gerado com sucesso!");
      }
    } catch {
      notify.error("Falha ao gerar follow-up por IA.");
    }
  };

  const handleGenerateRecovery = async () => {
    const scope = leadScope;
    try {
      notify.info("Criando abordagem de recuperação...");
      const res = await apiService.getAIRecoveryApproach(
        lead.conversationId || lead.id,
        lead.phone,
        lead.lastMessage || ""
      );
      if (currentLeadScope.current !== scope) return;
      if (!res?.data) throw new Error("Resposta indisponível");
      if (res?.data) {
        setRecoveryApproach(res.data);
        notify.success("Nova abordagem de recuperação gerada!");
      }
    } catch {
      notify.error("Falha ao gerar abordagem de recuperação.");
    }
  };

  const handleGoToChat = () => {
    onClose();
    window.localStorage.setItem("zapai_inbox_last_chat_scope", `${lead.sessionId || "default"}:${lead.phone}`);
    navigate(
      `/inbox?phone=${encodeURIComponent(lead.phone)}&chatId=${encodeURIComponent(lead.phone)}&conversationId=${encodeURIComponent(lead.conversationId || lead.id)}`
    );
  };

  return (
    <>
      <Dialog
        open={Boolean(lead)}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-w-xl w-[95vw] sm:max-w-[560px] border-border/80 bg-card/95 backdrop-blur-2xl p-0 overflow-hidden rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        >
          <DialogTitle className="sr-only">Detalhes do Lead {lead.name}</DialogTitle>
          <DialogDescription id="lead-dialog-description" className="sr-only">
            Visão compacta do lead com foto ampliada, dados unificados, funil, temperatura, etiquetas reais e campanhas.
          </DialogDescription>

          {/* Header Compacto com Foto, Dados e Ações Rápidas */}
          <div className="bg-gradient-to-r from-card via-background to-card p-3 sm:p-4 border-b border-border/60 relative shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Foto & Dados Principais */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar Compacto com Zoom Hover e Abertura em Lightbox */}
                <div
                  className="relative group shrink-0 cursor-pointer"
                  onClick={() => setPhotoZoomOpen(true)}
                  title="Clique para ver a foto em alta resolução"
                >
                  <Avatar className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl border-2 border-primary/30 shadow-md transition-all duration-200 group-hover:scale-105 group-hover:border-primary/80 group-hover:shadow-primary/20">
                    {lead.avatarUrl ? (
                      <AvatarImage src={lead.avatarUrl} alt={lead.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-display font-bold text-xl sm:text-2xl rounded-2xl">
                      {lead.name ? lead.name.slice(0, 2).toUpperCase() : "LD"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200 pointer-events-none">
                    <MagnifyingGlassPlus className="h-4 w-4 text-white" weight="bold" />
                    <span className="text-[8px] font-semibold text-white mt-0.5 tracking-tight">Ver Foto</span>
                  </div>
                </div>

                {/* Textos: Nome, Telefone, LID, Status */}
                <div className="min-w-0 flex-1 space-y-1">
                  {/* Nome com edição inline */}
                  <div className="flex items-center gap-1.5">
                    {isEditingName ? (
                      <div className="flex items-center gap-1">
                        <Input
                          size={1}
                          className="h-7 px-2 text-sm font-bold rounded-lg border-primary/50"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                          autoFocus
                        />
                        <Button size="icon" className="h-7 w-7 rounded-lg shrink-0" onClick={handleSaveName}>
                          <Check className="h-3.5 w-3.5" weight="bold" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg shrink-0"
                          onClick={() => {
                            setEditName(lead.name);
                            setIsEditingName(false);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h2 className="font-display text-base sm:text-lg font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">
                          {editName || lead.name}
                        </h2>
                        <button
                          type="button"
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          onClick={() => setIsEditingName(true)}
                          title="Editar nome"
                        >
                          <PencilSimple className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Telefone + Copiar + LID */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono text-xs text-foreground/90 font-semibold flex items-center gap-1">
                      <Phone className="h-3 w-3 text-primary" weight="bold" />
                      {formatPhoneNumber(lead.phone)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      onClick={handleCopyPhone}
                      title="Copiar telefone"
                    >
                      {copiedPhone ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </Button>

                    {isLid && (
                      <Badge
                        variant="outline"
                        className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[9px] py-0 px-1.5 font-mono"
                        title="Identificador Criptografado do WhatsApp (LID)"
                      >
                        LID
                      </Badge>
                    )}
                  </div>

                  {/* Status de Presença & Chip */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {lead.status === "online" ? "Online" : "Sincronizado"}
                    </span>
                    {lead.sessionId && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        • Chip: <strong className="text-foreground">{lead.sessionId}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação no Topo */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                {/* BOTÃO MESTRE: Ir para Disparos / Campanhas */}
                <Button
                  size="sm"
                  className="h-7 sm:h-8 px-2.5 rounded-lg text-xs gap-1.5 font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm active:scale-95 transition-all"
                  onClick={handleGoToCampaigns}
                  title="Abrir página de campanhas com este lead pré-selecionado para disparo"
                >
                  <Megaphone className="h-3.5 w-3.5" weight="fill" />
                  Ir para Disparos
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 sm:h-8 px-2 rounded-lg text-xs gap-1 border-primary/30 hover:bg-primary/10"
                  onClick={() => void handleGenerateFollowup()}
                  title="Gerar follow-up inteligente por IA"
                >
                  <Sparkle className="h-3.5 w-3.5 text-primary animate-pulse" weight="fill" />
                  Follow-up IA
                </Button>

                {!fromInbox && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 sm:h-8 px-2 rounded-lg text-xs gap-1"
                    onClick={handleGoToChat}
                    title="Abrir no Inbox de Conversas"
                  >
                    <Chat className="h-3.5 w-3.5" />
                    Inbox
                  </Button>
                )}
              </div>
            </div>

            {/* SELETORES RÁPIDOS: Temperatura & Funil em linha compacta */}
            <div className="mt-2.5 pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
              {/* Temperatura */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 shrink-0">
                  <Flame className="h-3 w-3 text-amber-500" weight="fill" />
                  Temp:
                </span>
                <div className="inline-flex rounded-lg p-0.5 bg-muted/50 border border-border/40 gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleSetTemperature("cold")}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1",
                      tempNorm === "cold" || tempNorm === "frio"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Snowflake className="h-2.5 w-2.5" weight="fill" />
                    Frio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetTemperature("warm")}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1",
                      tempNorm === "warm" || tempNorm === "morno"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sun className="h-2.5 w-2.5" weight="fill" />
                    Morno
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetTemperature("hot")}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1",
                      tempNorm === "hot" || tempNorm === "quente"
                        ? "bg-red-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Flame className="h-2.5 w-2.5" weight="fill" />
                    Quente
                  </button>
                </div>
              </div>

              {/* Estágio do Funil */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 shrink-0">
                  <TrendUp className="h-3 w-3 text-primary" weight="bold" />
                  Funil:
                </span>
                <Select value={currentFunnel} onValueChange={handleSetFunnel}>
                  <SelectTrigger className="h-7 text-xs font-semibold rounded-lg bg-card border-border/60 w-auto min-w-[150px] max-w-[200px]">
                    <SelectValue placeholder="Estágio" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card">
                    {FUNNEL_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs font-medium cursor-pointer">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Content Body com Scroll Compacto e Tabs */}
          <div className="p-3 sm:p-4 space-y-3 max-h-[52vh] sm:max-h-[56vh] overflow-y-auto scrollbar-thin flex-1">
            {analysisError && <p role="alert" className="text-xs text-amber-400">{analysisError}</p>}

            {/* Quick Metrics Bar Compacta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card className="rounded-xl border-border/60 bg-background/50 p-2">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Confiança IA</span>
                <span className="text-sm font-bold font-display text-success flex items-center gap-1 mt-0.5">
                  <TrendUp className="h-3 w-3" />
                  {confidence !== null ? `${Math.round(confidence * 100)}%` : "—"}
                </span>
              </Card>

              <Card className="rounded-xl border-border/60 bg-background/50 p-2">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Intenção</span>
                <span className="text-xs font-bold text-foreground mt-0.5 block truncate">
                  {aiData?.intent ? businessLabel(aiData.intent) : "—"}
                </span>
              </Card>

              <Card className="rounded-xl border-border/60 bg-background/50 p-2">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Sentimento</span>
                <span className="text-xs font-bold text-primary mt-0.5 block capitalize truncate">
                  {aiData?.sentiment ? businessLabel(aiData.sentiment) : "—"}
                </span>
              </Card>

              <Card className="rounded-xl border-border/60 bg-background/50 p-2">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Próxima Ação</span>
                <span className="text-xs font-bold text-amber-400 mt-0.5 block truncate">
                  {aiData?.nextAction
                    ? businessLabel(aiData.nextAction)
                    : aiData?.nextSuggestedReply
                    ? businessLabel(aiData.nextSuggestedReply)
                    : "—"}
                </span>
              </Card>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="w-full justify-start overflow-x-auto rounded-lg border border-border/60 bg-card/60 p-0.5 h-8">
                <TabsTrigger value="summary" className="text-xs font-semibold h-7">
                  Resumo & Etiquetas
                </TabsTrigger>
                <TabsTrigger value="graph" className="text-xs font-semibold h-7">
                  Grafo
                </TabsTrigger>
                <TabsTrigger value="followups" className="text-xs font-semibold h-7">
                  Follow-ups ({followupPlan?.steps?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              {/* TAB: GRAFO INTELIGENTE DE CONHECIMENTO */}
              <TabsContent value="graph" className="mt-2.5">
                <LeadKnowledgeGraph leadId={lead.conversationId || lead.id} leadName={lead.name} />
              </TabsContent>

              {/* TAB 1: SUMMARY & TAGS */}
              <TabsContent value="summary" className="space-y-3 mt-2.5">
                {/* Resumo da IA */}
                <Card className="rounded-xl border-primary/20 bg-primary/5 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase tracking-wider">
                    <Brain className="h-3.5 w-3.5 animate-pulse" weight="fill" />
                    Resumo Permanente do Lead (IA Memory)
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed italic">
                    {aiData?.summary ||
                      aiData?.conversationSummary ||
                      (loadingAi ? "Carregando análise…" : "Ainda não há resumo de IA disponível para este contato.")}
                  </p>
                </Card>

                {/* CARD GERENCIADOR DE ETIQUETAS REAIS (WHATSAPP & CRM) */}
                <Card className="rounded-xl border-border/60 bg-card/60 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-primary" weight="fill" />
                      Etiquetas Reais (WhatsApp & Sistema)
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {currentTags.length} associada(s)
                    </span>
                  </div>

                  {/* Etiquetas Ativas no Contato */}
                  <div className="flex flex-wrap items-center gap-1.5 min-h-6">
                    {currentTags.length > 0 ? (
                      currentTags.map((tag) => (
                        <TagIconBadge
                          key={tag}
                          tag={tag}
                          colorClass={getTagColor(tag)}
                          size="sm"
                          interactive={false}
                          onRemove={() => handleRemoveTag(tag)}
                        />
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Nenhuma etiqueta associada. Clique nas etiquetas reais abaixo para associar.
                      </span>
                    )}
                  </div>

                  {/* ETIQUETAS REAIS DISPONÍVEIS NO WHATSAPP / BANCO COM 1 CLIQUE */}
                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Etiquetas Reais do Sistema & WhatsApp (Clique para aplicar/remover):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {realLabels.map((lbl) => {
                        const isSelected = currentTags.some(
                          (t) => t.toLowerCase() === lbl.name.toLowerCase()
                        );
                        return (
                          <button
                            key={lbl.id || lbl.name}
                            type="button"
                            onClick={() => handleToggleRealLabel(lbl.name)}
                            className={cn(
                              "text-[11px] px-2 py-1 rounded-lg border font-medium transition-all flex items-center gap-1.5",
                              isSelected
                                ? "bg-primary/20 text-primary border-primary/50 font-bold shadow-sm"
                                : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/40 hover:text-foreground"
                            )}
                            title={isSelected ? `Remover ${lbl.name}` : `Associar ${lbl.name}`}
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: lbl.color_hex || "#00d26a" }}
                            />
                            <span>{lbl.name}</span>
                            <span className="text-[10px] font-bold opacity-80">
                              {isSelected ? "✓" : "+"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CRIAR NOVA ETIQUETA REAL (PERSISTE NO POSTGRESQL & WHATSAPP) */}
                  <div className="space-y-1.5 pt-1.5 border-t border-border/40">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Criar Nova Etiqueta Real:
                    </span>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 flex items-center gap-1.5">
                        <Input
                          placeholder="Nome da nova etiqueta (ex: Cliente_Ouro)..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleCreateRealLabel();
                            }
                          }}
                          className="h-8 text-xs rounded-lg bg-background/50 border-border/60"
                        />
                      </div>

                      {/* Paleta rápida de cores */}
                      <div className="flex items-center gap-1 shrink-0 self-center sm:self-auto">
                        {PRESET_LABEL_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setSelectedTagColor(c.hex)}
                            title={c.name}
                            className={cn(
                              "h-5 w-5 rounded-full border transition-all",
                              selectedTagColor === c.hex
                                ? "scale-110 border-white ring-2 ring-primary"
                                : "border-transparent opacity-70 hover:opacity-100"
                            )}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={isCreatingTag || !newTagInput.trim()}
                        className="h-8 px-2.5 text-xs gap-1 rounded-lg shrink-0 font-semibold"
                        onClick={() => void handleCreateRealLabel()}
                      >
                        <Plus className="h-3 w-3" weight="bold" />
                        {isCreatingTag ? "Criando..." : "Criar Etiqueta"}
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Anotações Privadas do Lead & Engajamento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Anotações do Lead */}
                  <Card className="rounded-xl border-border/60 bg-card/60 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <NotePencil className="h-3.5 w-3.5 text-amber-400" />
                        Notas & Observações
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={savingNotes}
                        className="h-6 px-1.5 text-[10px] text-primary hover:bg-primary/10 gap-1 rounded"
                        onClick={handleSaveNotes}
                      >
                        <FloppyDisk className="h-3 w-3" />
                        {savingNotes ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Observações importantes sobre o cliente..."
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      className="min-h-[70px] text-xs rounded-lg bg-background/50 border-border/60 resize-none"
                    />
                  </Card>

                  {/* Engajamento & Qualificação */}
                  <Card className="rounded-xl border-border/60 bg-card/60 p-2.5 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                      Engajamento
                    </span>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Status:</span>
                        <strong className="text-foreground capitalize">{lead.status || "Ativo"}</strong>
                      </div>
                      {lead.lastMessage && (
                        <div className="flex justify-between text-muted-foreground gap-1">
                          <span className="shrink-0">Última msg:</span>
                          <strong className="text-foreground truncate max-w-[130px]" title={lead.lastMessage}>
                            {lead.lastMessage}
                          </strong>
                        </div>
                      )}
                      <div className="flex justify-between text-muted-foreground">
                        <span>Canal:</span>
                        <strong className="text-primary font-bold">WhatsApp</strong>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Recovery Approach Banner if active */}
                {recoveryApproach && (
                  <Card className="rounded-xl border-amber-500/30 bg-amber-500/10 p-2.5 space-y-1.5 animate-in fade-in-0">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <MagicWand className="h-3.5 w-3.5" weight="fill" />
                        Abordagem de Recuperação IA
                      </span>
                      <Badge variant="outline" className="text-[8px] border-amber-500/40 text-amber-400">
                        Reativação
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground bg-background/60 p-2 rounded-lg border border-amber-500/20">
                      "{recoveryApproach.suggestedMessage}"
                    </p>
                  </Card>
                )}

                <div className="pt-1">
                  <Button
                    variant="outline"
                    className="w-full rounded-lg text-xs gap-1.5 h-8"
                    onClick={() => void handleGenerateRecovery()}
                  >
                    <MagicWand className="h-3.5 w-3.5 text-amber-400" />
                    Gerar Abordagem de Recuperação com IA
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 3: FOLLOW-UPS */}
              <TabsContent value="followups" className="space-y-2.5 mt-2.5">
                {followupPlan ? (
                  <div className="space-y-2">
                    {(Array.isArray(followupPlan.steps) ? followupPlan.steps : []).map((step: any, idx: number) => (
                      <Card key={idx} className="rounded-xl border-border/60 bg-card/60 p-2.5 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-primary flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Passo {idx + 1}: {step.timingLabel}
                          </span>
                          <span className="text-[9px] font-normal uppercase text-muted-foreground">{step.goal}</span>
                        </div>
                        <p className="text-xs text-foreground bg-background/50 p-2 rounded-lg border border-border/30 italic">
                          "{step.message}"
                        </p>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-2">
                    <Brain className="h-8 w-8 text-primary mx-auto animate-pulse" />
                    <p className="text-xs text-muted-foreground">
                      Gere um plano automático de follow-up personalizado para este lead.
                    </p>
                    <Button size="sm" className="rounded-lg text-xs gap-1.5 h-7" onClick={() => void handleGenerateFollowup()}>
                      <Sparkle className="h-3.5 w-3.5" />
                      Gerar Plano Inteligente de Follow-up
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* LIGHTBOX MODAL PARA VER A FOTO AMPLIADA EM ALTA RESOLUÇÃO */}
      <Dialog open={photoZoomOpen} onOpenChange={setPhotoZoomOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-md sm:max-w-lg border-border/80 bg-background/95 backdrop-blur-3xl p-4 sm:p-5 rounded-2xl shadow-2xl flex flex-col items-center justify-center text-center"
        >
          <DialogTitle className="text-sm sm:text-base font-bold font-display text-foreground flex items-center gap-2">
            <span>Foto de Perfil: {lead.name}</span>
          </DialogTitle>
          <DialogDescription id="zoom-dialog-description" className="text-xs text-muted-foreground">
            Visualização em alta resolução da imagem de perfil de {lead.name}.
          </DialogDescription>

          <div className="mt-3 relative rounded-xl overflow-hidden border border-border/60 bg-card p-2 shadow-xl flex items-center justify-center">
            {lead.avatarUrl ? (
              <img
                src={lead.avatarUrl}
                alt={lead.name}
                className="max-h-[55vh] max-w-full rounded-lg object-contain shadow-md"
              />
            ) : (
              <div className="h-40 w-40 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-4xl">
                {lead.name ? lead.name.slice(0, 2).toUpperCase() : "LD"}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {lead.avatarUrl && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-xs gap-1.5 h-8"
                onClick={() => window.open(lead.avatarUrl, "_blank")}
              >
                <ArrowSquareOut className="h-3.5 w-3.5" />
                Abrir Original
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="rounded-lg text-xs gap-1.5 h-8"
              onClick={() => setPhotoZoomOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
