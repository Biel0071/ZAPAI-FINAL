import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Brain,
  ChatCircleText,
  Tag,
  TrendUp,
  Clock,
  ShoppingBag,
  FileText,
  Sparkle,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Paperclip,
  Calendar,
  User,
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
  ArrowsOut,
  NotePencil,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { TagIconBadge } from "@/components/inbox/TagIconBadge";
import { getTagColor, formatPhoneNumber } from "@/pages/Inbox/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  { value: "negotiation", label: "🤝 Em Negociação / Fechamento" },
  { value: "ready_to_buy", label: "⚡ Pronto para Comprar" },
  { value: "closed", label: "🏆 Venda Fechada / Ganho" },
  { value: "lost", label: "❌ Perdido / Desistência" },
];

const QUICK_TAG_SUGGESTIONS = [
  "cliente_vip",
  "churrasqueira",
  "orcamento",
  "prioridade",
  "duvida",
  "retorno_pendente",
  "aguardando_pagamento",
  "promocao",
  "anuncio_ativo",
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
  const [leadNotes, setLeadNotes] = useState(lead?.notes || "");
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

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
      .getConversationInsights(targetId)
      .then((res) => {
        if (active) {
          const data = (res as any)?.data && typeof (res as any).data === "object" ? (res as any).data : res;
          setAiData(data || null);
        }
      })
      .catch(() => {
        if (active) setAnalysisError("Não foi possível carregar a análise deste contato.");
      })
      .finally(() => {
        if (active) setLoadingAi(false);
      });
    return () => {
      active = false;
    };
  }, [leadScope, lead?.conversationId, lead?.id]);

  if (!lead) return null;

  const tempNorm = (currentTemp || "").toLowerCase();
  const isLid = String(lead.phone || "").includes("@lid") || (/^\d{14,16}$/.test(String(lead.phone || "").replace(/@.*$/, "")) && !String(lead.phone || "").startsWith("55"));

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

  // Handlers for Tags
  const handleAddTag = (tagToAdd?: string) => {
    const raw = tagToAdd || newTagInput;
    const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    if (currentTags.some((t) => t.toLowerCase() === trimmed)) {
      notify.info("Esta etiqueta já está associada ao contato.");
      setNewTagInput("");
      return;
    }
    const nextTags = [...currentTags, trimmed];
    setCurrentTags(nextTags);
    setNewTagInput("");
    onUpdateLead?.(lead.id, { tags: nextTags });
    notify.success(`Etiqueta "${trimmed}" adicionada!`);
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
      const res = await apiService.getAIRecoveryApproach(lead.conversationId || lead.id, lead.phone, lead.lastMessage || "");
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
      <Dialog open={Boolean(lead)} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-4xl border-border/80 bg-card/95 backdrop-blur-2xl p-0 overflow-hidden rounded-3xl shadow-2xl"
        >
          <DialogTitle className="sr-only">Detalhes do Lead {lead.name}</DialogTitle>
          <DialogDescription id="lead-dialog-description" className="sr-only">
            Visão 360 do lead com foto ampliada, dados unificados, funil, temperatura, etiquetas e ações de campanha.
          </DialogDescription>

          {/* Header Principal com Foto Grande, Dados e Ações Rápidas */}
          <div className="bg-gradient-to-r from-card via-background to-card p-5 sm:p-7 border-b border-border/60 relative">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              {/* Foto Maior & Dados Principais */}
              <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
                {/* Avatar Maior e Interativo com Efeito de Zoom */}
                <div
                  className="relative group shrink-0 cursor-pointer"
                  onClick={() => setPhotoZoomOpen(true)}
                  title="Clique para ver a foto ampliada"
                >
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl border-2 border-primary/30 shadow-xl transition-all duration-300 group-hover:scale-105 group-hover:border-primary/80 group-hover:shadow-primary/20">
                    {lead.avatarUrl ? (
                      <AvatarImage src={lead.avatarUrl} alt={lead.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-display font-bold text-2xl sm:text-3xl rounded-3xl">
                      {lead.name ? lead.name.slice(0, 2).toUpperCase() : "LD"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200 pointer-events-none">
                    <MagnifyingGlassPlus className="h-6 w-6 text-white" weight="bold" />
                    <span className="text-[10px] font-semibold text-white mt-0.5 tracking-tight">Ver Foto</span>
                  </div>
                </div>

                {/* Textos: Nome, Telefone, LID, Status */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Nome do Contato com edição inline */}
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          size={1}
                          className="h-8 px-2.5 text-base font-bold rounded-lg border-primary/50"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                          autoFocus
                        />
                        <Button size="icon" className="h-8 w-8 rounded-lg" onClick={handleSaveName}>
                          <Check className="h-4 w-4" weight="bold" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => {
                            setEditName(lead.name);
                            setIsEditingName(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate max-w-xs sm:max-w-md">
                          {editName || lead.name}
                        </h2>
                        <button
                          type="button"
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                          onClick={() => setIsEditingName(true)}
                          title="Editar nome do contato"
                        >
                          <PencilSimple className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Telefone formatado com botão Copiar */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-sm text-foreground/90 font-semibold flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-primary" weight="bold" />
                      {formatPhoneNumber(lead.phone)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      onClick={handleCopyPhone}
                      title="Copiar número de telefone"
                    >
                      {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>

                    {isLid && (
                      <Badge
                        variant="outline"
                        className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] py-0 px-2 font-mono"
                        title="Identificador Criptografado do WhatsApp (LID)"
                      >
                        WhatsApp LID
                      </Badge>
                    )}
                  </div>

                  {/* Status de Presença */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      {lead.status === "online" ? "Online agora" : "Sincronizado no WhatsApp"}
                    </span>
                    {lead.sessionId && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        • Chip: <strong className="text-foreground">{lead.sessionId}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação de Destaque no Topo */}
              <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                {/* BOTÃO MESTRE: Ir para Disparos / Campanhas */}
                <Button
                  size="sm"
                  className="rounded-xl text-xs gap-2 font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  onClick={handleGoToCampaigns}
                  title="Abrir página de campanhas com este lead pré-selecionado para disparo"
                >
                  <Megaphone className="h-4 w-4" weight="fill" />
                  Ir para Disparos / Campanhas
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 border-primary/30 hover:bg-primary/10"
                  onClick={() => void handleGenerateFollowup()}
                >
                  <Sparkle className="h-4 w-4 text-primary animate-pulse" weight="fill" />
                  Follow-up IA
                </Button>

                {!fromInbox && (
                  <Button size="sm" variant="secondary" className="rounded-xl text-xs gap-1.5" onClick={handleGoToChat}>
                    <Chat className="h-4 w-4" />
                    Abrir no Inbox
                  </Button>
                )}
              </div>
            </div>

            {/* SELETORES RÁPIDOS: Temperatura & Funil de Vendas */}
            <div className="mt-5 pt-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* 1. Temperatura do Lead */}
              <div className="flex items-center justify-between sm:justify-start gap-3 bg-background/50 p-2.5 rounded-2xl border border-border/40">
                <span className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Flame className="h-4 w-4 text-amber-500" weight="fill" />
                  Temperatura:
                </span>
                <div className="inline-flex rounded-xl p-0.5 bg-muted/50 border border-border/40 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetTemperature("cold")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      tempNorm === "cold" || tempNorm === "frio"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Snowflake className="h-3 w-3" weight="fill" />
                    Frio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetTemperature("warm")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      tempNorm === "warm" || tempNorm === "morno"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sun className="h-3 w-3" weight="fill" />
                    Morno
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetTemperature("hot")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      tempNorm === "hot" || tempNorm === "quente"
                        ? "bg-red-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Flame className="h-3 w-3" weight="fill" />
                    Quente
                  </button>
                </div>
              </div>

              {/* 2. Estágio do Funil */}
              <div className="flex items-center justify-between sm:justify-start gap-3 bg-background/50 p-2.5 rounded-2xl border border-border/40">
                <span className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <TrendUp className="h-4 w-4 text-primary" weight="bold" />
                  Funil:
                </span>
                <Select value={currentFunnel} onValueChange={handleSetFunnel}>
                  <SelectTrigger className="h-8 text-xs font-semibold rounded-xl bg-card border-border/60 w-full max-w-[240px]">
                    <SelectValue placeholder="Selecione o estágio" />
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

          {/* Content Body com Tabs e Gerenciador de Etiquetas */}
          <div className="p-5 sm:p-7 space-y-6 max-h-[65vh] overflow-y-auto scrollbar-thin">
            {analysisError && <p role="alert" className="text-sm text-amber-400">{analysisError}</p>}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Confiança da análise IA</span>
                <span className="text-lg font-bold font-display text-success flex items-center gap-1 mt-0.5">
                  <TrendUp className="h-4 w-4" />
                  {confidence !== null ? `${Math.round(confidence * 100)}%` : "—"}
                </span>
              </Card>

              <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Intenção Identificada</span>
                <span className="text-xs font-bold text-foreground mt-1 block truncate">
                  {aiData?.intent ? businessLabel(aiData.intent) : "—"}
                </span>
              </Card>

              <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Sentimento</span>
                <span className="text-xs font-bold text-primary mt-1 block capitalize">
                  {aiData?.sentiment ? businessLabel(aiData.sentiment) : "—"}
                </span>
              </Card>

              <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Próxima Ação IA</span>
                <span className="text-xs font-bold text-amber-400 mt-1 block truncate">
                  {aiData?.nextAction ? businessLabel(aiData.nextAction) : aiData?.nextSuggestedReply ? businessLabel(aiData.nextSuggestedReply) : "—"}
                </span>
              </Card>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="w-full justify-start overflow-x-auto rounded-xl border border-border/60 bg-card/60 p-1">
                <TabsTrigger value="summary" className="text-xs font-semibold">Resumo IA & Visão 360°</TabsTrigger>
                <TabsTrigger value="graph" className="text-xs font-semibold">Grafo Inteligente</TabsTrigger>
                <TabsTrigger value="followups" className="text-xs font-semibold">Plano de Follow-up ({followupPlan?.steps?.length ?? 0})</TabsTrigger>
              </TabsList>

              {/* TAB: GRAFO INTELIGENTE DE CONHECIMENTO */}
              <TabsContent value="graph" className="mt-4">
                <LeadKnowledgeGraph leadId={lead.conversationId || lead.id} leadName={lead.name} />
              </TabsContent>

              {/* TAB 1: SUMMARY & TAGS */}
              <TabsContent value="summary" className="space-y-5 mt-4">
                {/* Resumo da IA */}
                <Card className="rounded-2xl border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                    <Brain className="h-4 w-4 animate-pulse" weight="fill" />
                    Resumo Permanente do Lead (IA Continuus Memory)
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed italic">
                    {aiData?.summary ||
                      aiData?.conversationSummary ||
                      (loadingAi ? "Carregando análise…" : "Ainda não há resumo de IA disponível para este contato.")}
                  </p>
                </Card>

                {/* CARD GERENCIADOR DE ETIQUETAS (TAGS) COMPLETO */}
                <Card className="rounded-2xl border-border/60 bg-card/60 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-4 w-4 text-primary" weight="fill" />
                      Etiquetas & Tags do Contato
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {currentTags.length} etiqueta(s) associada(s)
                    </span>
                  </div>

                  {/* Lista de Tags Ativas com Botão de Remoção X */}
                  <div className="flex flex-wrap items-center gap-2 min-h-8">
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
                        Nenhuma etiqueta associada ainda. Adicione uma nova ou use as sugestões rápidas abaixo.
                      </span>
                    )}
                  </div>

                  {/* Linha de Inserção de Nova Tag */}
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="Adicionar nova etiqueta personalizada..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="h-9 text-xs rounded-xl bg-background/50 border-border/60"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-3 text-xs gap-1.5 rounded-xl shrink-0"
                      onClick={() => handleAddTag()}
                    >
                      <Plus className="h-3.5 w-3.5" weight="bold" />
                      Adicionar
                    </Button>
                  </div>

                  {/* Tags Rápidas Sugeridas com 1 Clique */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Sugestões Rápidas:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TAG_SUGGESTIONS.map((sug) => {
                        const isSelected = currentTags.includes(sug);
                        return (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => (isSelected ? handleRemoveTag(sug) : handleAddTag(sug))}
                            className={cn(
                              "text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1",
                              isSelected
                                ? "bg-primary/20 text-primary border-primary/40 font-bold"
                                : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/40 hover:text-foreground"
                            )}
                          >
                            <span>{isSelected ? "✓" : "+"}</span>
                            <span>{sug}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                {/* Anotações Privadas do Lead & Dados de Engajamento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Anotações do Lead */}
                  <Card className="rounded-2xl border-border/60 bg-card/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <NotePencil className="h-4 w-4 text-amber-400" />
                        Notas & Observações Internas
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={savingNotes}
                        className="h-7 px-2 text-[11px] text-primary hover:bg-primary/10 gap-1 rounded-lg"
                        onClick={handleSaveNotes}
                      >
                        <FloppyDisk className="h-3.5 w-3.5" />
                        {savingNotes ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Adicione observações importantes sobre este cliente (preferências, acordos, prazos)..."
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      className="min-h-[90px] text-xs rounded-xl bg-background/50 border-border/60 resize-none"
                    />
                  </Card>

                  {/* Engajamento & Qualificação */}
                  <Card className="rounded-2xl border-border/60 bg-card/60 p-4 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-success" />
                      Engajamento & Qualificação
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Status do Contato:</span>
                        <strong className="text-foreground capitalize">{lead.status || "Ativo"}</strong>
                      </div>
                      {lead.lastMessage && (
                        <div className="flex justify-between text-muted-foreground gap-2">
                          <span className="shrink-0">Última mensagem:</span>
                          <strong className="text-foreground truncate max-w-[180px]" title={lead.lastMessage}>
                            {lead.lastMessage}
                          </strong>
                        </div>
                      )}
                      <div className="flex justify-between text-muted-foreground">
                        <span>Última interação:</span>
                        <strong className="text-foreground">
                          {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString("pt-BR") : "—"}
                        </strong>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Canal de Origem:</span>
                        <strong className="text-primary font-bold">WhatsApp</strong>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Recovery Approach Banner if active */}
                {recoveryApproach && (
                  <Card className="rounded-2xl border-amber-500/30 bg-amber-500/10 p-4 space-y-2 animate-in fade-in-0">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <MagicWand className="h-4 w-4" weight="fill" />
                        Abordagem de Recuperação Sugerida por IA
                      </span>
                      <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">
                        Reativação
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground bg-background/60 p-2.5 rounded-xl border border-amber-500/20">
                      "{recoveryApproach.suggestedMessage}"
                    </p>
                  </Card>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-xs gap-2"
                    onClick={() => void handleGenerateRecovery()}
                  >
                    <MagicWand className="h-4 w-4 text-amber-400" />
                    Gerar Abordagem de Recuperação com IA
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 3: FOLLOW-UPS */}
              <TabsContent value="followups" className="space-y-3 mt-4">
                {followupPlan ? (
                  <div className="space-y-2">
                    {(Array.isArray(followupPlan.steps) ? followupPlan.steps : []).map((step: any, idx: number) => (
                      <Card key={idx} className="rounded-2xl border-border/60 bg-card/60 p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-primary flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Passo {idx + 1}: {step.timingLabel}
                          </span>
                          <span className="text-[9px] font-normal uppercase text-muted-foreground">{step.goal}</span>
                        </div>
                        <p className="text-xs text-foreground bg-background/50 p-2.5 rounded-xl border border-border/30 italic">
                          "{step.message}"
                        </p>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-3">
                    <Brain className="h-10 w-10 text-primary mx-auto animate-pulse" />
                    <p className="text-xs text-muted-foreground">
                      Gere um plano automático de follow-up personalizado para este lead.
                    </p>
                    <Button size="sm" className="rounded-xl text-xs gap-2" onClick={() => void handleGenerateFollowup()}>
                      <Sparkle className="h-4 w-4" />
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
          className="max-w-md sm:max-w-lg border-border/80 bg-background/95 backdrop-blur-3xl p-5 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center"
        >
          <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
            <span>Foto de Perfil: {lead.name}</span>
          </DialogTitle>
          <DialogDescription id="zoom-dialog-description" className="text-xs text-muted-foreground">
            Visualização em alta resolução da imagem de perfil de {lead.name}.
          </DialogDescription>

          <div className="mt-4 relative rounded-2xl overflow-hidden border border-border/60 bg-card p-2 shadow-2xl flex items-center justify-center">
            {lead.avatarUrl ? (
              <img
                src={lead.avatarUrl}
                alt={lead.name}
                className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md"
              />
            ) : (
              <div className="h-48 w-48 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-5xl">
                {lead.name ? lead.name.slice(0, 2).toUpperCase() : "LD"}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            {lead.avatarUrl && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1.5"
                onClick={() => window.open(lead.avatarUrl, "_blank")}
              >
                <ArrowSquareOut className="h-3.5 w-3.5" />
                Abrir Imagem Original
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl text-xs gap-1.5"
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
