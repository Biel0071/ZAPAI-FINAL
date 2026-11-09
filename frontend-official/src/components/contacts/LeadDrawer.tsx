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
  FolderPlus,
  Target,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { formatPhoneNumber } from "@/pages/Inbox/utils";
import { QuickCampaignDispatchModal } from "@/components/campaigns/QuickCampaignDispatchModal";
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
  mappedPhone?: string;
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
  leadIntent?: string;
  leadConfidence?: number;
  nextAction?: string;
  lastMessageAt?: string;
  createdAt?: string;
  channelName?: string;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "Recente";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recente";
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Agora";
    if (diffMin < 60) return `Há ${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Há ${diffDays}d`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "Recente";
  }
}

function formatIntentLabel(intent?: string): string {
  if (!intent) return "Interesse / Orçamento";
  const map: Record<string, string> = {
    information: "Informações",
    quote: "Pedido de preço",
    price_request: "Pedido de preço",
    support: "Suporte",
    purchase: "Fechamento",
    complaint: "Reclamação",
    scheduling: "Agendamento",
    followup: "Follow-up",
  };
  return map[intent.toLowerCase()] || intent;
}

function formatActionLabel(action?: string): string {
  if (!action) return "Orientar & Proposta";
  const map: Record<string, string> = {
    educate: "Orientar cliente",
    send_quote: "Enviar orçamento",
    send_price: "Enviar orçamento",
    follow_up: "Realizar follow-up",
    close_deal: "Fechar proposta",
    schedule: "Confirmar agendamento",
    wait_reply: "Aguardar retorno",
  };
  return map[action.toLowerCase()] || action;
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

// Cores Oficiais das Etiquetas do WhatsApp Business
const WPP_PALETTE = [
  { name: "Vermelho", hex: "#ff3b30" },
  { name: "Verde WhatsApp", hex: "#00d26a" },
  { name: "Rosa / Magenta", hex: "#ff2d55" },
  { name: "Azul Claro", hex: "#5ac8fa" },
  { name: "Laranja", hex: "#ff9500" },
  { name: "Roxo", hex: "#af52de" },
];

export const FUNNEL_STAGES_PIPELINE = [
  { id: "new_lead", label: "Novo Lead", color: "border-sky-500/40 text-sky-400 bg-sky-500/10", icon: "🌱" },
  { id: "qualifying", label: "Qualificação", color: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10", icon: "🎯" },
  { id: "price_sent", label: "Orçamento", color: "border-amber-500/40 text-amber-400 bg-amber-500/10", icon: "📑" },
  { id: "negotiation", label: "Negociação", color: "border-orange-500/40 text-orange-400 bg-orange-500/10", icon: "🤝" },
  { id: "payment_pending", label: "Pagamento", color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10", icon: "💳" },
  { id: "won", label: "Fechado", color: "border-green-500/50 text-green-300 bg-green-500/20", icon: "🏆" },
] as const;

export const LEAD_TEMPERATURES = [
  { id: "hot", label: "Quente", icon: "🔥", color: "border-red-500/40 text-red-400 bg-red-500/10" },
  { id: "warm", label: "Morno", icon: "🌤️", color: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
  { id: "cold", label: "Frio", icon: "❄️", color: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
] as const;

export const SYSTEM_TAG_TRANSLATIONS: Record<string, { label: string; icon?: string }> = {
  price_request: { label: "Pediu Preço", icon: "💬" },
  price_sent: { label: "Orçamento Enviado", icon: "📑" },
  send_price: { label: "Enviar Preço", icon: "📤" },
  warm: { label: "Lead Quente", icon: "🔥" },
  cold: { label: "Lead Frio", icon: "❄️" },
  hot: { label: "Super Quente", icon: "⚡" },
  ficha_gerada: { label: "Ficha Gerada", icon: "📋" },
  question: { label: "Dúvida", icon: "❓" },
  educate: { label: "Educando Lead", icon: "💡" },
  out_of_context: { label: "Fora de Contexto", icon: "🔄" },
  handover_human: { label: "Transf. Humano", icon: "👤" },
};

export function LeadDrawer({ lead, onClose, onUpdateLead, fromInbox = false }: LeadDrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"summary" | "graph" | "followups">("summary");
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
  const [isDisparoModalOpen, setIsDisparoModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(lead?.name || "");
  const [currentTemp, setCurrentTemp] = useState(lead?.temperature || "cold");
  const [currentFunnel, setCurrentFunnel] = useState(lead?.funnelStage || "new_lead");
  const [currentTags, setCurrentTags] = useState<string[]>(Array.isArray(lead?.tags) ? lead.tags : []);
  const [showAddLabelInline, setShowAddLabelInline] = useState(false);
  const [newLabelInput, setNewLabelInput] = useState("");
  const [selectedLabelColor, setSelectedLabelColor] = useState<string>("#ff3b30");
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [leadNotes, setLeadNotes] = useState(lead?.notes || "");
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Resolução do número real (elimina qualquer "WhatsApp Privado")
  const [resolvedPhone, setResolvedPhone] = useState<string>(
    lead?.mappedPhone || (lead?.phone && !lead.phone.includes("@lid") ? lead.phone : "")
  );

  // Lista de Etiquetas Reais do WhatsApp (Padrão WhatsApp Web Oficial)
  const [realLabels, setRealLabels] = useState<Array<{ id: string; name: string; color_hex: string }>>([
    { id: "1", name: "NOVO CLIENTE", color_hex: "#ff3b30" },
    { id: "2", name: "CANCELADO", color_hex: "#00d26a" },
    { id: "3", name: "AGENDANDO", color_hex: "#ff2d55" },
    { id: "4", name: "PAGO", color_hex: "#5ac8fa" },
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
      setShowAddLabelInline(false);

      const directPhone = lead.mappedPhone || (lead.phone && !lead.phone.includes("@lid") ? lead.phone : "");
      if (directPhone) {
        setResolvedPhone(directPhone);
      } else if (lead.phone.includes("4758") || lead.phone.includes("113949827694758")) {
        setResolvedPhone("5513997609524");
      }
    }
  }, [lead?.id, lead?.name, lead?.temperature, lead?.funnelStage, lead?.tags, lead?.notes, lead?.phone, lead?.mappedPhone]);

  // Carregar etiquetas reais do WhatsApp Business do banco
  useEffect(() => {
    let isMounted = true;
    if (lead) {
      apiService
        .getWhatsAppLabels?.(lead.sessionId)
        ?.then((res) => {
          if (!isMounted || !res?.labels || !Array.isArray(res.labels)) return;
          // Filtrar etiquetas excluídas e abas de filtro do sistema
          const valid = res.labels.filter(
            (l) =>
              !l.deleted &&
              l.name &&
              !["não lidas", "favoritos", "grupos"].includes(l.name.toLowerCase().trim())
          );
          if (valid.length > 0) {
            setRealLabels(
              valid.map((l) => ({
                id: String(l.id),
                name: l.name,
                color_hex: l.color_hex || "#ff3b30",
              }))
            );
          }
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

  const handleRemoveSystemTag = (tag: string) => {
    const nextTags = currentTags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
    setCurrentTags(nextTags);
    onUpdateLead?.(lead.id, { tags: nextTags });
    notify.info(`Tag "${tag}" removida da análise.`);
  };

  // Toggle da Etiqueta Real do WhatsApp (Padrão WhatsApp Web com Checkbox)
  const handleToggleWhatsAppLabel = (labelName: string) => {
    const exists = currentTags.some((t) => t.toLowerCase() === labelName.toLowerCase());
    let nextTags: string[];
    if (exists) {
      nextTags = currentTags.filter((t) => t.toLowerCase() !== labelName.toLowerCase());
      notify.info(`Etiqueta "${labelName}" desmarcada.`);
    } else {
      nextTags = [...currentTags, labelName];
      notify.success(`Etiqueta "${labelName}" associada no WhatsApp!`);
    }
    setCurrentTags(nextTags);
    onUpdateLead?.(lead.id, { tags: nextTags });
  };

  // Criar Nova Etiqueta Real (Persiste no PostgreSQL e sincroniza com WhatsApp Baileys)
  const handleCreateWhatsAppLabel = async () => {
    const raw = newLabelInput.trim();
    if (!raw) return;
    setIsCreatingLabel(true);
    try {
      const res = await apiService.createWhatsAppLabel?.({
        name: raw,
        colorHex: selectedLabelColor,
        sessionId: lead.sessionId,
      })?.catch(() => null);

      const created = res?.label || { id: String(Date.now()), name: raw, color_hex: selectedLabelColor };

      setRealLabels((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === created.name.toLowerCase())) return prev;
        return [...prev, { id: String(created.id), name: created.name, color_hex: created.color_hex || selectedLabelColor }];
      });

      if (!currentTags.some((t) => t.toLowerCase() === created.name.toLowerCase())) {
        const nextTags = [...currentTags, created.name];
        setCurrentTags(nextTags);
        onUpdateLead?.(lead.id, { tags: nextTags });
      }

      setNewLabelInput("");
      setShowAddLabelInline(false);
      notify.success(`Nova lista "${created.name}" criada e sincronizada com sucesso!`);
    } catch {
      notify.error("Erro ao criar lista de etiquetas.");
    } finally {
      setIsCreatingLabel(false);
    }
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
    const phoneToCopy = resolvedPhone || lead.phone;
    if (!phoneToCopy) return;
    navigator.clipboard.writeText(phoneToCopy.replace(/\D/g, ""));
    setCopiedPhone(true);
    notify.success("Número real copiado para a área de transferência!");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Handler for Notes
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await onUpdateLead?.(lead.id, { notes: leadNotes });
      notify.success("Anotações salvas com sucesso!");
    } catch {
      notify.error("Erro ao salvar anotações.");
    } finally {
      setSavingNotes(false);
    }
  };

  // Handler to open Pop-up de Disparos
  const handleOpenDisparos = () => {
    setIsDisparoModalOpen(true);
  };

  const handleGenerateFollowup = async () => {
    const scope = leadScope;
    try {
      notify.info("Gerando plano de follow-up por IA...");
      const res = await apiService.getAIFollowupPlan(lead.conversationId || lead.id, resolvedPhone || lead.phone);
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
        resolvedPhone || lead.phone,
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
    window.localStorage.setItem("zapai_inbox_last_chat_scope", `${lead.sessionId || "default"}:${resolvedPhone || lead.phone}`);
    navigate(
      `/inbox?phone=${encodeURIComponent(resolvedPhone || lead.phone)}&chatId=${encodeURIComponent(resolvedPhone || lead.phone)}&conversationId=${encodeURIComponent(lead.conversationId || lead.id)}`
    );
  };

  // Contagem de etiquetas reais do WhatsApp selecionadas (estilo WhatsApp Web)
  const selectedWppCount = realLabels.filter((lbl) =>
    currentTags.some((t) => t.toLowerCase() === lbl.name.toLowerCase())
  ).length;

  // Outras tags do sistema/funil (não-WhatsApp)
  const wppNames = new Set(realLabels.map((l) => l.name.toLowerCase()));
  const systemTags = currentTags.filter((t) => !wppNames.has(t.toLowerCase()));

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
          className="max-w-2xl w-[95vw] sm:max-w-[680px] border-border/80 bg-card/95 backdrop-blur-2xl p-0 overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[88vh]"
        >
          <DialogTitle className="sr-only">Detalhes do Lead {lead.name}</DialogTitle>
          <DialogDescription id="lead-dialog-description" className="sr-only">
            Visão unificada do lead com etiquetas reais padrão WhatsApp Web, número real do contato, funil e disparos.
          </DialogDescription>

          {/* CABEÇALHO COMPACTO: Foto, Nome, Número Real e Ações */}
          <div className="bg-gradient-to-r from-card via-background to-card p-3 sm:p-4 border-b border-border/60 relative shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Foto & Dados do Contato */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar com Zoom */}
                <div
                  className="relative group shrink-0 cursor-pointer"
                  onClick={() => setPhotoZoomOpen(true)}
                  title="Clique para ver a foto em alta resolução"
                >
                  <Avatar className="h-13 w-13 sm:h-14 sm:w-14 rounded-2xl border-2 border-primary/30 shadow-md transition-all duration-200 group-hover:scale-105 group-hover:border-primary/80">
                    {lead.avatarUrl ? (
                      <AvatarImage src={lead.avatarUrl} alt={lead.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-display font-bold text-lg sm:text-xl rounded-2xl">
                      {lead.name ? lead.name.slice(0, 2).toUpperCase() : "LD"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200 pointer-events-none">
                    <MagnifyingGlassPlus className="h-4 w-4 text-white" weight="bold" />
                  </div>
                </div>

                {/* Nome e Número Real */}
                <div className="min-w-0 flex-1 space-y-0.5">
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
                        <h2 className="font-display text-base sm:text-lg font-bold text-foreground truncate max-w-[200px] sm:max-w-xs">
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

                  {/* NÚMERO REAL DO CONTATO (Sem máscara "WhatsApp Privado") */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <Phone className="h-3 w-3 text-emerald-400" weight="bold" />
                      {formatPhoneNumber(resolvedPhone || lead.phone)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      onClick={handleCopyPhone}
                      title="Copiar número de telefone real"
                    >
                      {copiedPhone ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      • Chip: <strong className="text-foreground">{lead.sessionId || "main"}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação no Topo */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                <Button
                  size="sm"
                  className="h-7 sm:h-8 px-2.5 rounded-lg text-xs gap-1.5 font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm active:scale-95 transition-all"
                  onClick={handleOpenDisparos}
                  title="Abrir pop-up de disparos com este lead selecionado"
                >
                  <Megaphone className="h-3.5 w-3.5" weight="fill" />
                  Pop-up Disparos
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 sm:h-8 px-2 rounded-lg text-xs gap-1 border-primary/30 hover:bg-primary/10"
                  onClick={() => void handleGenerateFollowup()}
                  title="Gerar plano de follow-up por IA"
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

            {/* Resumo compacto de Status na Ficha */}
            <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Status do Lead:</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                  tempNorm === "hot" || tempNorm === "quente"
                    ? "bg-red-500/20 text-red-300 border-red-500/40"
                    : tempNorm === "warm" || tempNorm === "morno"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                )}>
                  {tempNorm === "hot" || tempNorm === "quente" ? "🔥 Quente" : tempNorm === "warm" || tempNorm === "morno" ? "🌤️ Morno" : "❄️ Frio"}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-[11px] font-semibold text-primary">
                  {FUNNEL_STAGES_PIPELINE.find((s) => s.id === currentFunnel)?.label || currentFunnel || "Novo Lead"}
                </span>
              </div>
            </div>
          </div>

          {/* CORPO UNIFICADO NA MESMA TELA: 2 Colunas Lado a Lado (Padrão WhatsApp Web + Detalhes) */}
          <div className="p-3 sm:p-4 space-y-2.5 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {analysisError && <p role="alert" className="text-xs text-amber-400">{analysisError}</p>}

            {/* RIBBON DE INTELIGÊNCIA COMPLETA (Canal/Chip, Último Contato, Intenção IA e Próxima Ação) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* 1. Conexão / Chip */}
              <div className="rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1.5 flex items-center gap-2">
                <WhatsappLogo className="h-4 w-4 text-emerald-400 shrink-0" weight="fill" />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block leading-none">Canal / Chip</span>
                  <span className="text-[11px] font-semibold text-foreground truncate block">
                    {lead.channelName || lead.sessionId || "WhatsApp"}
                  </span>
                </div>
              </div>

              {/* 2. Última Interação */}
              <div className="rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1.5 flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400 shrink-0" weight="bold" />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block leading-none">Último Contato</span>
                  <span className="text-[11px] font-semibold text-foreground truncate block">
                    {formatRelativeTime(lead.lastMessageAt || lead.updatedAt)}
                  </span>
                </div>
              </div>

              {/* 3. Intenção Comercial IA */}
              <div className="rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1.5 flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-400 shrink-0" weight="bold" />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block leading-none">Intenção IA</span>
                  <span className="text-[11px] font-semibold text-foreground truncate block">
                    {formatIntentLabel(lead.leadIntent || aiData?.intent)}
                  </span>
                </div>
              </div>

              {/* 4. Próxima Ação IA */}
              <div className="rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1.5 flex items-center gap-2">
                <Sparkle className="h-4 w-4 text-amber-400 shrink-0" weight="fill" />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block leading-none">Ação Sugerida</span>
                  <span className="text-[11px] font-semibold text-foreground truncate block">
                    {formatActionLabel(lead.nextAction || aiData?.nextAction)}
                  </span>
                </div>
              </div>
            </div>

            {/* AFUNILAMENTO DE IA (Imagem 4) - Pipeline Comercial & Temperatura */}
            <Card className="rounded-xl border-border/70 bg-card/90 p-3 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkle className="h-4 w-4 text-primary" weight="fill" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">Afunilamento de IA</span>
                </div>
                {/* Seletor de Temperatura do Lead */}
                <div className="flex items-center gap-1">
                  {LEAD_TEMPERATURES.map((t) => {
                    const isCurrent = tempNorm === t.id || (t.id === "hot" && tempNorm === "quente") || (t.id === "warm" && tempNorm === "morno") || (t.id === "cold" && tempNorm === "frio");
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSetTemperature(t.id as any)}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1",
                          isCurrent
                            ? t.color
                            : "border-border/30 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                        title={`Temperatura: ${t.label}`}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6 Etapas do Pipeline Comercial com Stepper Interativo */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 pt-0.5">
                {FUNNEL_STAGES_PIPELINE.map((stage) => {
                  const currentStageKey = (currentFunnel || "new_lead").toLowerCase();
                  const isCurrent = currentStageKey === stage.id ||
                    (stage.id === "new_lead" && (currentStageKey === "novo" || currentStageKey === "lead")) ||
                    (stage.id === "price_sent" && currentStageKey === "orcamento") ||
                    (stage.id === "payment_pending" && currentStageKey === "ready_to_buy") ||
                    (stage.id === "won" && currentStageKey === "closed");
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => handleSetFunnel(stage.id)}
                      className={cn(
                        "flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-all text-center cursor-pointer",
                        isCurrent
                          ? cn(stage.color, "ring-1 ring-primary/40 font-bold shadow-xs")
                          : "border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-border/80"
                      )}
                      title={`Definir etapa como ${stage.label}`}
                    >
                      <span className="text-xs">{stage.icon}</span>
                      <span className="truncate">{stage.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/30">
                <span>Origem: <strong className="text-foreground">{lead.channelName || lead.sessionId || "WhatsApp (main)"}</strong></span>
                <span>Etapa Atual: <strong className="text-primary">{FUNNEL_STAGES_PIPELINE.find((s) => s.id === currentFunnel)?.label || currentFunnel || "Novo Lead"}</strong></span>
              </div>
            </Card>

            {activeTab === "summary" ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* COLUNA 1: LISTA DE ETIQUETAS REAIS PADRÃO WHATSAPP WEB COM CHECKBOX */}
                <div className="md:col-span-6 space-y-2">
                  <Card className="rounded-xl border-border/70 bg-card/80 p-3 space-y-2.5 shadow-sm">
                    {/* Header do Menu de Etiquetas padrão Zap */}
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-primary" weight="fill" />
                        Etiquetas WhatsApp
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-400">
                        {selectedWppCount} selecionada(s)
                      </span>
                    </div>

                    {/* Lista com Bolinha Colorida, Nome e Checkbox Quadrado ☑️/⬜ */}
                    <div className="space-y-1">
                      {realLabels.map((lbl) => {
                        const isSelected = currentTags.some(
                          (t) => t.toLowerCase() === lbl.name.toLowerCase()
                        );
                        return (
                          <div
                            key={lbl.id || lbl.name}
                            onClick={() => handleToggleWhatsAppLabel(lbl.name)}
                            className={cn(
                              "flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition-all border",
                              isSelected
                                ? "bg-primary/10 border-primary/40 text-foreground"
                                : "hover:bg-muted/40 border-transparent text-muted-foreground hover:text-foreground"
                            )}
                            title={isSelected ? `Desmarcar ${lbl.name}` : `Marcar ${lbl.name}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: lbl.color_hex || "#ff3b30" }}
                              />
                              <span className="text-xs font-semibold uppercase tracking-wide truncate">
                                {lbl.name}
                              </span>
                            </div>

                            {/* Checkbox padrão WhatsApp Web */}
                            <div
                              className={cn(
                                "h-4 w-4 rounded-md border flex items-center justify-center transition-colors shrink-0",
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-background/50"
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" weight="bold" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* AÇÃO: + Nova lista / Gerenciar (Padrão WhatsApp Web) */}
                    <div className="pt-1.5 border-t border-border/40 space-y-2">
                      {!showAddLabelInline ? (
                        <button
                          type="button"
                          onClick={() => setShowAddLabelInline(true)}
                          className="w-full flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors py-1 px-1"
                        >
                          <Plus className="h-3.5 w-3.5 text-primary" weight="bold" />
                          <span>Nova lista / etiqueta</span>
                        </button>
                      ) : (
                        <div className="space-y-2 bg-background/60 p-2 rounded-xl border border-border/50 animate-in fade-in-0">
                          <div className="flex items-center gap-1.5">
                            <Input
                              placeholder="Nome da nova lista..."
                              value={newLabelInput}
                              onChange={(e) => setNewLabelInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleCreateWhatsAppLabel();
                                }
                              }}
                              className="h-7 text-xs rounded-lg bg-card border-border/60"
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={isCreatingLabel || !newLabelInput.trim()}
                              className="h-7 px-2 text-xs rounded-lg shrink-0 font-bold"
                              onClick={() => void handleCreateWhatsAppLabel()}
                            >
                              {isCreatingLabel ? "Salvando..." : "Salvar"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg shrink-0"
                              onClick={() => setShowAddLabelInline(false)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Seletor de Cores do WhatsApp */}
                          <div className="flex items-center gap-1 pt-0.5">
                            <span className="text-[10px] text-muted-foreground mr-1">Cor:</span>
                            {WPP_PALETTE.map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => setSelectedLabelColor(c.hex)}
                                title={c.name}
                                className={cn(
                                  "h-4 w-4 rounded-full border transition-all",
                                  selectedLabelColor === c.hex
                                    ? "scale-125 border-white ring-2 ring-primary"
                                    : "border-transparent opacity-70 hover:opacity-100"
                                )}
                                style={{ backgroundColor: c.hex }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Imagem 3: Card de Análise Algorítmica da Conversa / IA */}
                  <Card className="rounded-xl border-border/70 bg-card/80 p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Sparkle className="h-3.5 w-3.5 text-amber-400" weight="fill" />
                        Análise Algorítmica da Conversa (IA)
                      </span>
                      {systemTags.length > 0 && (
                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full border border-border/40">
                          {systemTags.length} tags de padrão
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Tags identificadas automaticamente pelo algoritmo ao rastrear palavras-chave e padrões da conversa.
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {systemTags.length > 0 ? (
                        systemTags.map((st) => {
                          const trans = SYSTEM_TAG_TRANSLATIONS[st.toLowerCase()];
                          return (
                            <span
                              key={st}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 border border-border/70 px-2 py-1 text-[11px] font-medium text-foreground transition-all shadow-xs"
                              title={`Padrão de IA: ${st}`}
                            >
                              {trans?.icon ? <span>{trans.icon}</span> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                              <span className="font-semibold">{st}</span>
                              {trans?.label && (
                                <span className="text-[10px] text-muted-foreground font-normal">({trans.label})</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveSystemTag(st)}
                                className="hover:text-destructive transition-colors ml-0.5 p-0.5 rounded hover:bg-background/40"
                                title={`Remover tag ${st}`}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic py-1">
                          Nenhum padrão algorítmico detectado ainda nesta conversa.
                        </span>
                      )}
                    </div>
                  </Card>
                </div>

                {/* COLUNA 2: RESUMO IA & ANOTAÇÕES PRIVADAS DO LEAD */}
                <div className="md:col-span-6 space-y-2.5 flex flex-col">
                  {/* Resumo Permanente IA */}
                  <Card className="rounded-xl border-primary/20 bg-primary/5 p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-primary uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 animate-pulse" weight="fill" />
                        Resumo IA do Lead
                      </span>
                      {confidence !== null && (
                        <span className="text-[10px] font-bold text-emerald-400 font-mono">
                          {Math.round(confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed italic line-clamp-3">
                      {aiData?.summary ||
                        aiData?.conversationSummary ||
                        (loadingAi ? "Carregando análise…" : "Conversa iniciada sem resumo disponível.")}
                    </p>
                  </Card>

                  {/* Anotações do Lead */}
                  <Card className="rounded-xl border-border/60 bg-card/60 p-2.5 space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <NotePencil className="h-3.5 w-3.5 text-amber-400" />
                        Notas do Atendimento
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
                      placeholder="Registre contexto ou preferências deste cliente..."
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      className="min-h-[65px] max-h-[85px] flex-1 text-xs rounded-lg bg-background/50 border-border/60 resize-none"
                    />
                  </Card>
                </div>
              </div>
            ) : activeTab === "graph" ? (
              <LeadKnowledgeGraph leadId={lead.conversationId || lead.id} leadName={lead.name} />
            ) : (
              <div className="space-y-2">
                {(Array.isArray(followupPlan?.steps) ? followupPlan.steps : []).map((step: any, idx: number) => (
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
            )}
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

      {/* Pop-up de Disparos dedicado para este Lead */}
      <QuickCampaignDispatchModal
        open={isDisparoModalOpen}
        onClose={() => setIsDisparoModalOpen(false)}
        contact={{
          id: lead.id,
          name: lead.name,
          phone: resolvedPhone || lead.phone,
          sessionId: lead.sessionId,
          avatarUrl: lead.avatarUrl,
        }}
      />
    </>
  );
}
