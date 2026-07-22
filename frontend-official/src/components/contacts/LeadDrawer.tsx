import React, { useState, useEffect } from "react";
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
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiService } from "@/services/apiService";
import { notify } from "@/services/notifyService";

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
}

interface LeadDrawerProps {
  lead: LeadDrawerLead | null;
  onClose: () => void;
  onUpdateLead?: (id: string, updates: any) => void;
}

export function LeadDrawer({ lead, onClose, onUpdateLead }: LeadDrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"summary" | "timeline" | "products" | "followups">("summary");
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiData, setAiData] = useState<any>(null);
  const [followupPlan, setFollowupPlan] = useState<any>(null);
  const [recoveryApproach, setRecoveryApproach] = useState<any>(null);

  useEffect(() => {
    if (!lead) {
      setAiData(null);
      setFollowupPlan(null);
      setRecoveryApproach(null);
      return;
    }

    const loadLeadDetails = async () => {
      setLoadingAi(true);
      try {
        if (lead.conversationId) {
          const res = await apiService.getAIConversationAnalysis(lead.conversationId).catch(() => null);
          if (res?.data) {
            setAiData(res.data);
          }
        }
      } catch (err) {
        console.warn("Error fetching lead AI analysis:", err);
      } finally {
        setLoadingAi(false);
      }
    };

    void loadLeadDetails();
  }, [lead]);

  if (!lead) return null;

  const temp = (lead.temperature || "warm").toLowerCase();
  const tempBadge =
    temp === "hot" || temp === "quente"
      ? { label: "Quente", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: <Flame className="h-3.5 w-3.5 text-red-400" weight="fill" /> }
      : temp === "cold" || temp === "frio"
      ? { label: "Frio", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: <Snowflake className="h-3.5 w-3.5 text-blue-400" weight="fill" /> }
      : { label: "Morno", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: <Sun className="h-3.5 w-3.5 text-amber-400" weight="fill" /> };

  const handleGenerateFollowup = async () => {
    try {
      notify.info("Gerando plano de follow-up por IA...");
      const res = await apiService.getAIFollowupPlan(lead.conversationId || lead.id, lead.phone);
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
    try {
      notify.info("Criando abordagem de recuperação...");
      const res = await apiService.getAIRecoveryApproach(lead.conversationId || lead.id, lead.phone, "Orçamento de materiais");
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
    window.localStorage.setItem("zapai_inbox_last_chat_scope", `default:${lead.phone}`);
    navigate(`/inbox?phone=${encodeURIComponent(lead.phone)}&chatId=${encodeURIComponent(lead.phone)}&conversationId=${encodeURIComponent(lead.conversationId || lead.id)}`);
  };

  return (
    <Dialog open={Boolean(lead)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl border-border/80 bg-card/95 backdrop-blur-xl p-0 overflow-hidden rounded-3xl shadow-2xl">
        {/* Header Header */}
        <div className="bg-gradient-to-r from-card via-background to-card p-6 border-b border-border/50 relative">
          <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors">
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-display font-bold text-xl shadow-glow">
                {lead.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-foreground">{lead.name}</h2>
                  <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${tempBadge.color}`}>
                    {tempBadge.icon}
                    {tempBadge.label}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {lead.phone}</span>
                  <span>•</span>
                  <span className="capitalize">Funil: {lead.funnelStage || "Novo Lead"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 border-primary/30 hover:bg-primary/10" onClick={() => void handleGenerateFollowup()}>
                <Sparkle className="h-4 w-4 text-primary animate-pulse" weight="fill" />
                Follow-up IA
              </Button>
              <Button size="sm" className="rounded-xl text-xs gap-1.5 shadow-glow" onClick={handleGoToChat}>
                <Chat className="h-4 w-4" />
                Abrir no Inbox
              </Button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Chance de Fechamento</span>
              <span className="text-lg font-bold font-display text-success flex items-center gap-1 mt-0.5">
                <TrendUp className="h-4 w-4" />
                {aiData?.confidence ? `${Math.round(aiData.confidence * 100)}%` : "84%"}
              </span>
            </Card>

            <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Intenção Identificada</span>
              <span className="text-xs font-bold text-foreground mt-1 block truncate">
                {aiData?.intent || "Compra Direta / Orçamento"}
              </span>
            </Card>

            <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Sentimento</span>
              <span className="text-xs font-bold text-primary mt-1 block capitalize">
                {aiData?.sentiment || "Muito Interessado"}
              </span>
            </Card>

            <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Próxima Ação IA</span>
              <span className="text-xs font-bold text-amber-400 mt-1 block truncate">
                {aiData?.nextAction || "Enviar proposta com desconto"}
              </span>
            </Card>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="w-full justify-start rounded-xl border border-border/60 bg-card/60 p-1">
              <TabsTrigger value="summary" className="text-xs font-semibold">Resumo IA & Visão 360°</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs font-semibold">Linha do Tempo</TabsTrigger>
              <TabsTrigger value="products" className="text-xs font-semibold">Produtos & Propostas</TabsTrigger>
              <TabsTrigger value="followups" className="text-xs font-semibold">Plano de Follow-up ({followupPlan?.steps?.length || 6})</TabsTrigger>
            </TabsList>

            {/* TAB 1: SUMMARY */}
            <TabsContent value="summary" className="space-y-4 mt-4">
              <Card className="rounded-2xl border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                  <Brain className="h-4 w-4 animate-pulse" weight="fill" />
                  Resumo Permanente do Lead (IA Continuus Memory)
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed italic">
                  {aiData?.summary ||
                    `O cliente ${lead.name} demonstrou forte interesse em reservatórios e caixas d'água de grande capacidade (Fortlev). Questionou sobre tabela de desconto para volumes acima de 3 unidades e prazos de entrega para ${lead.phone.includes("11") ? "São Paulo" : "Região Metropolitana"}. Objeção principal citada foi o valor do frete.`}
                </p>
              </Card>

              {/* Recovery Approach Banner if active */}
              {recoveryApproach && (
                <Card className="rounded-2xl border-amber-500/30 bg-amber-500/10 p-4 space-y-2 animate-in fade-in-0">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <MagicWand className="h-4 w-4" weight="fill" />
                      Abordagem de Recuperação Sugerida por IA
                    </span>
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">Reativação</Badge>
                  </div>
                  <p className="text-xs text-foreground bg-background/60 p-2.5 rounded-xl border border-amber-500/20">
                    "{recoveryApproach.suggestedMessage}"
                  </p>
                </Card>
              )}

              {/* Tags and Key facts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="rounded-2xl border-border/60 bg-card/60 p-4 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-primary" />
                    Etiquetas & Tags Inteligentes
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(lead.tags && lead.tags.length > 0 ? lead.tags : ["Decisor de Compra", "Lead Qualificado", "Aguardando Orçamento", "Fortlev"]).map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-lg text-[10px] px-2.5 py-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Card>

                <Card className="rounded-2xl border-border/60 bg-card/60 p-4 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    Engajamento & Qualificação
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Responsividade:</span>
                      <strong className="text-foreground">Alta (Responde em &lt; 5 min)</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Última interação:</span>
                      <strong className="text-foreground">{lead.updatedAt ? new Date(lead.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoje'}</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Canal de Origem:</span>
                      <strong className="text-primary font-bold">WhatsApp Direct B2B</strong>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="w-full rounded-xl text-xs gap-2" onClick={() => void handleGenerateRecovery()}>
                  <MagicWand className="h-4 w-4 text-amber-400" />
                  Gerar Abordagem de Recuperação
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: TIMELINE */}
            <TabsContent value="timeline" className="space-y-3 mt-4">
              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                <div className="relative pl-7 space-y-1">
                  <span className="absolute left-1.5 top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-card"></span>
                  <p className="text-xs font-bold text-foreground">Lead visualizou proposta enviada</p>
                  <p className="text-[10px] text-muted-foreground">Hoje às 12:45 • WhatsApp Direct</p>
                </div>
                <div className="relative pl-7 space-y-1">
                  <span className="absolute left-1.5 top-1 h-3 w-3 rounded-full bg-info ring-4 ring-card"></span>
                  <p className="text-xs font-bold text-foreground">IA respondeu dúvidas sobre prazo de entrega</p>
                  <p className="text-[10px] text-muted-foreground">Hoje às 11:20 • Resposta Automática</p>
                </div>
                <div className="relative pl-7 space-y-1">
                  <span className="absolute left-1.5 top-1 h-3 w-3 rounded-full bg-success ring-4 ring-card"></span>
                  <p className="text-xs font-bold text-foreground">Estágio de Funil alterado para "Em Negociação"</p>
                  <p className="text-[10px] text-muted-foreground">Ontem às 16:30 • Atualização por Agente</p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: PRODUCTS */}
            <TabsContent value="products" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Card className="rounded-2xl border-border/60 bg-card/60 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Caixa d'Água Fortlev 1.000L Polietileno</p>
                      <p className="text-[10px] text-muted-foreground">Qtd: 2 unidades • Código: FLV-1000</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-primary">R$ 1.480,00</span>
                </Card>

                <Card className="rounded-2xl border-border/60 bg-card/60 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Orçamento #4820 — Condição Especial</p>
                      <p className="text-[10px] text-muted-foreground">PDF enviado com validade até sexta-feira</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-success/30 text-success">Enviado</Badge>
                </Card>
              </div>
            </TabsContent>

            {/* TAB 4: FOLLOW-UPS */}
            <TabsContent value="followups" className="space-y-3 mt-4">
              {followupPlan ? (
                <div className="space-y-2">
                  {followupPlan.steps.map((step: any, idx: number) => (
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
                  <p className="text-xs text-muted-foreground">Gere um plano automático de follow-up personalizado para este lead.</p>
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
  );
}
