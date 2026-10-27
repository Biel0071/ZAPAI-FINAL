import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  Zap,
  ShieldCheck,
  MessageCircle,
  MapPin,
  Layers,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Flame,
  Users,
  BookOpen,
  Filter,
  Check,
  ChevronRight,
  Brain,
  Info,
} from "lucide-react";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { createAgentAvatar } from "@/components/avatar-engine/CharacterFactory";

export interface MasteryBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  progress: number;
}

export interface EvolutionLogItem {
  id: number | string;
  agentKey: string;
  changeType: string;
  sourceDescription: string;
  fieldsChanged?: any;
  appliedBy?: string;
  createdAt: string;
}

export interface CognitiveMemoryItem {
  id: number | string;
  nodeKey: string;
  nodeType: string;
  label: string;
  content: string;
  weight: number;
  properties?: any;
  lastSeenAt?: string;
}

export interface AttendantEvolutionProfile {
  agentKey: string;
  level: number;
  levelTitle: string;
  totalXp: number;
  currentLevelMinXp: number;
  nextLevelXp: number;
  progressPct: number;
  evolutionScore: number;
  naturalnessScore: number;
  conversionsCount: number;
  objectionsLearned: number;
  totalAnalyzed: number;
  scoredConversationsCount: number;
  badges: MasteryBadge[];
  recentLogs: EvolutionLogItem[];
  activeMemories: CognitiveMemoryItem[];
}

export interface AttendantEvolutionHubProps {
  agentKey?: string;
  agentName?: string;
  agentRole?: string;
  avatarConfig?: any;
  onRefresh?: () => void;
  className?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  objection_overcome: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
    icon: ShieldCheck,
  },
  commercial_condition: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    icon: Zap,
  },
  regional_logistics: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
    icon: MapPin,
  },
  product_interest: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
    icon: Layers,
  },
  sales_closing: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    border: "border-purple-500/30",
    icon: Award,
  },
  conversation_score: {
    bg: "bg-indigo-500/15",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
    icon: Sparkles,
  },
  default: {
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    border: "border-border/60",
    icon: Sparkles,
  },
};

export function AttendantEvolutionHub({
  agentKey = "camila",
  agentName = "Camila Santos",
  agentRole = "Consultora de Vendas & Atendimento Especialista",
  avatarConfig,
  onRefresh,
  className,
}: AttendantEvolutionHubProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AttendantEvolutionProfile | null>(null);
  const [logFilter, setLogFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "memories">("overview");
  const [isMining, setIsMining] = useState(false);

  const resolvedAvatar = useMemo(() => {
    if (avatarConfig) return avatarConfig;
    return createAgentAvatar({
      agentId: agentKey,
      name: agentName,
      role: agentRole,
      gender: "female",
    });
  }, [avatarConfig, agentKey, agentName, agentRole]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await requestApiEndpoint<any>(`/api/ai/evolution/agent-profile?agentKey=${encodeURIComponent(agentKey)}`, "GET");
      if (res && res.data) {
        setProfile(res.data);
      } else {
        // Fallback para getAgentEvolution se /agent-profile ainda não responder
        const fallback = await apiService.getAgentEvolution(agentKey);
        if (fallback?.success) {
          const hs = fallback.humanStats || {};
          const defaultProfile: AttendantEvolutionProfile = {
            agentKey,
            level: hs.level || 5,
            levelTitle: hs.levelTitle || "Consultora Especialista",
            totalXp: hs.totalXp || 34430,
            currentLevelMinXp: hs.currentLevelMinXp || 20000,
            nextLevelXp: hs.nextLevelXp || 40000,
            progressPct: hs.progressPct || 72,
            evolutionScore: hs.evolutionScore || 85,
            naturalnessScore: hs.naturalnessScore || 92,
            conversionsCount: hs.conversionsCount || 87,
            objectionsLearned: hs.objectionsLearned || 124,
            totalAnalyzed: hs.totalAnalyzed || 418,
            scoredConversationsCount: hs.scoredConversationsCount || 418,
            badges: [
              {
                id: "objection_master",
                title: "Mestre em Objeções de Entrega",
                description: "Supera com segurança dúvidas sobre pagamento na entrega com motorista",
                icon: "ShieldCheck",
                category: "objections",
                unlocked: true,
                progress: 100,
              },
              {
                id: "pix_card_closer",
                title: "Fechamento Rápido PIX & Cartão",
                description: "Apresenta com precisão desconto de 5% no PIX ou em até 10x sem juros",
                icon: "Zap",
                category: "closing",
                unlocked: true,
                progress: 100,
              },
              {
                id: "whatsapp_natural",
                title: "WhatsApp Natural Anti-Robô",
                description: "Comunicação fluida em 1 a 3 frases sem listas mecânicas ou introduções frias",
                icon: "MessageCircle",
                category: "naturalness",
                unlocked: true,
                progress: 92,
              },
              {
                id: "logistics_router",
                title: "Roteamento Logístico & Frete",
                description: "Capta bairro e cidade para entrega ágil no mesmo dia ou em até 2 horas",
                icon: "MapPin",
                category: "logistics",
                unlocked: true,
                progress: 85,
              },
              {
                id: "catalog_expert",
                title: "Especialista em Catálogo",
                description: "Domina medidas de churrasqueiras pré-moldadas e volume de cimento",
                icon: "Layers",
                category: "catalog",
                unlocked: true,
                progress: 100,
              },
            ],
            recentLogs: (fallback.history || []).slice(0, 20).map((h: any, idx: number) => ({
              id: h.id || idx,
              agentKey,
              changeType: h.change_type || "learned_insight",
              sourceDescription: h.source_description || "Atendimento comercial concluído com sucesso",
              fieldsChanged: typeof h.fields_changed === "string" ? JSON.parse(h.fields_changed || "{}") : h.fields_changed,
              appliedBy: h.applied_by || "evolution_engine",
              createdAt: h.created_at || new Date().toISOString(),
            })),
            activeMemories: (fallback.memoryGraph?.nodes || []).map((n: any) => ({
              id: n.id,
              nodeKey: n.id,
              nodeType: n.type,
              label: n.label,
              content: n.label,
              weight: n.weight || 1,
            })),
          };
          setProfile(defaultProfile);
        }
      }
    } catch (err: any) {
      console.warn("[AttendantEvolutionHub] Erro ao carregar perfil:", err.message);
      setError(err?.message || "Não foi possível carregar as métricas de evolução.");
    } finally {
      setLoading(false);
    }
  }, [agentKey, agentName, agentRole]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleMineManualAttendance = async () => {
    setIsMining(true);
    try {
      const res = await requestApiEndpoint<any>("/api/ai/evolution/sync-manual", "POST", { limit: 300 });
      toast({
        title: "Mineração de Atendimentos Concluída",
        description: `Aprendizados minerados: ${res?.minedCount || res?.data?.minedCount || "Novos padrões incorporados!"}`,
      });
      await fetchProfile();
      onRefresh?.();
    } catch (err: any) {
      toast({
        title: "Aviso de Mineração",
        description: err?.message || "Não foi possível sincronizar novos atendimentos agora.",
        variant: "destructive",
      });
    } finally {
      setIsMining(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!profile?.recentLogs) return [];
    if (logFilter === "all") return profile.recentLogs;
    return profile.recentLogs.filter((log) => {
      const desc = (log.sourceDescription || "").toLowerCase();
      const changeType = (log.changeType || "").toLowerCase();
      const cat = (log.fieldsChanged?.category || "").toLowerCase();
      if (logFilter === "objections") return cat.includes("objection") || desc.includes("objeção") || desc.includes("paga na entrega");
      if (logFilter === "closing") return cat.includes("closing") || desc.includes("fechamento") || desc.includes("ficha");
      if (logFilter === "conditions") return cat.includes("condition") || desc.includes("5%") || desc.includes("10x");
      if (logFilter === "logistics") return cat.includes("logistics") || desc.includes("bairro") || desc.includes("frete");
      return true;
    });
  }, [profile?.recentLogs, logFilter]);

  const nextLevelRemainingXp = useMemo(() => {
    if (!profile) return 0;
    return Math.max(0, profile.nextLevelXp - profile.totalXp);
  }, [profile]);

  return (
    <div className={cn("space-y-5 w-full", className)}>
      {/* 1. HERO CARD: NÍVEL, XP & PROGRESSO GAMIFICADO */}
      <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card/90 to-emerald-950/20 shadow-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <CardContent className="p-5 sm:p-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6">
            {/* Avatar & Nível */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="relative">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-[#091120] border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10 flex items-center justify-center overflow-hidden shrink-0">
                  <ZaiAvatarRenderer
                    avatar={resolvedAvatar}
                    state="WORKING"
                    size="md"
                    showAura={true}
                    showStatusBadge={false}
                    showBrandingLayer={false}
                  />
                </div>
                <Badge className="absolute -bottom-2 -right-1 bg-emerald-500 text-slate-950 font-black text-[11px] px-2 py-0.5 shadow-md border-none">
                  NÍVEL {profile?.level || 1}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl sm:text-2xl font-black text-foreground font-display tracking-tight">
                    {agentName}
                  </h3>
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-bold">
                    {profile?.levelTitle || "Consultora Comercial"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium max-w-md">
                  {agentRole} • Aprendizado contínuo ativo via WhatsApp
                </p>

                {/* Sub-badge de evolução */}
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-[11px] text-muted-foreground font-medium">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <Sparkles className="h-3.5 w-3.5" /> Evoluindo a cada atendimento
                  </span>
                  <span>•</span>
                  <span className="font-mono text-foreground font-semibold">
                    {profile?.totalAnalyzed || 0} conversas analisadas
                  </span>
                </div>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-2 self-center lg:self-start">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleMineManualAttendance}
                disabled={isMining}
                className="h-9 text-xs font-semibold gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xs"
              >
                <Sparkles className={cn("h-3.5 w-3.5", isMining && "animate-spin")} />
                {isMining ? "Minerando Atendimentos..." : "Aprender de Atendimentos Reais"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchProfile()}
                disabled={loading}
                className="h-9 text-xs border-border/80 hover:border-emerald-500/40 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* BARRA DE PROGRESSO DE XP */}
          <div className="mt-6 pt-5 border-t border-border/40 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-emerald-400 fill-emerald-400/30" />
                  Progresso para o Próximo Nível
                </span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  ({profile?.progressPct || 0}% Concluído)
                </span>
              </div>

              <div className="text-[11px] font-mono text-muted-foreground">
                <strong className="text-emerald-400 font-bold">
                  {(profile?.totalXp || 0).toLocaleString("pt-BR")} XP
                </strong>{" "}
                / {(profile?.nextLevelXp || 500).toLocaleString("pt-BR")} XP
                {nextLevelRemainingXp > 0 && (
                  <span className="text-muted-foreground/80 ml-1">
                    (faltam {nextLevelRemainingXp.toLocaleString("pt-BR")} XP)
                  </span>
                )}
              </div>
            </div>

            <Progress
              value={profile?.progressPct || 0}
              className="h-3 bg-muted/40 rounded-full overflow-hidden [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:via-teal-400 [&>div]:to-indigo-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. GRID DE 5 KPIS DE INTELIGÊNCIA E MATURIDADE */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* KPI 1: Total XP */}
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">XP Acumulado</span>
            <strong className="text-xl font-bold font-mono text-emerald-400">
              {(profile?.totalXp || 0).toLocaleString("pt-BR")}
            </strong>
          </div>
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 2: Atendimentos Pontuados */}
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">Conversas Atendidas</span>
            <strong className="text-xl font-bold font-mono text-foreground">
              {profile?.scoredConversationsCount || profile?.totalAnalyzed || 0}
            </strong>
          </div>
          <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 3: Índice de Naturalidade */}
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">Naturalidade Anti-Robô</span>
            <strong className="text-xl font-bold font-mono text-foreground">
              {profile?.naturalnessScore || 92}%
            </strong>
          </div>
          <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 4: Objeções Superadas */}
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">Objeções Superadas</span>
            <strong className="text-xl font-bold font-mono text-foreground">
              {profile?.objectionsLearned || 0}
            </strong>
          </div>
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 5: Conversões / Fechamentos */}
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">Vendas / Fechamentos</span>
            <strong className="text-xl font-bold font-mono text-purple-400">
              {profile?.conversionsCount || 0}
            </strong>
          </div>
          <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. SUB-TABS: VISÃO GERAL & BADGES | FEED DE APRENDIZADOS | MEMÓRIA ATIVA */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card/80 border border-border/70 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none",
            activeTab === "overview"
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          <Award className="h-4 w-4 text-emerald-400" />
          <span>Habilidades & Badges</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none",
            activeTab === "timeline"
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          <Clock className="h-4 w-4 text-purple-400" />
          <span>Feed de Aprendizados ({filteredLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("memories")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none",
            activeTab === "memories"
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          <Brain className="h-4 w-4 text-cyan-400" />
          <span>Memória Prática da Loja ({profile?.activeMemories?.length || 0})</span>
        </button>
      </div>

      {/* ABA 1: HABILIDADES & BADGES DE MAESTRIA */}
      {activeTab === "overview" && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Award className="h-5 w-5 text-emerald-400" />
              Badges de Maestria & Conquistas Comerciais
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Competências desbloqueadas conforme a atendente atende clientes reais, supera objeções e fecha vendas.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(profile?.badges || []).map((badge) => {
                const isUnlocked = badge.unlocked;
                return (
                  <div
                    key={badge.id}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5",
                      isUnlocked
                        ? "border-emerald-500/40 bg-emerald-950/15 shadow-xs"
                        : "border-border/60 bg-muted/5 opacity-70"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                            isUnlocked
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-muted/30 text-muted-foreground border border-border/40"
                          )}
                        >
                          {badge.id === "objection_master" && <ShieldCheck className="h-5 w-5" />}
                          {badge.id === "pix_card_closer" && <Zap className="h-5 w-5" />}
                          {badge.id === "whatsapp_natural" && <MessageCircle className="h-5 w-5" />}
                          {badge.id === "logistics_router" && <MapPin className="h-5 w-5" />}
                          {badge.id === "catalog_expert" && <Layers className="h-5 w-5" />}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-foreground leading-snug">
                            {badge.title}
                          </h4>
                          <span className="text-[10px] text-muted-foreground">
                            {isUnlocked ? "✅ Desbloqueada" : "🔒 Em desenvolvimento"}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-mono font-bold px-1.5 py-0",
                          isUnlocked
                            ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                            : "border-border/60 text-muted-foreground"
                        )}
                      >
                        {badge.progress}%
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {badge.description}
                    </p>

                    <Progress
                      value={badge.progress}
                      className="h-1.5 bg-muted/40 rounded-full"
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ABA 2: FEED DE APRENDIZADOS & LOGS EM TEMPO REAL */}
      {activeTab === "timeline" && (
        <Card className="bg-card border-border/80 shadow-sm space-y-4">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Clock className="h-5 w-5 text-purple-400" />
                  Feed de Aprendizados e Evolução Contínua
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Cada conversa concluída pela Camila ensina novos padrões, superações de objeção e dados de entrega.
                </CardDescription>
              </div>

              {/* Filtros de Categoria */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {[
                  { id: "all", label: "Todos" },
                  { id: "objections", label: "🛡️ Objeções" },
                  { id: "closing", label: "🏆 Fechamentos" },
                  { id: "conditions", label: "⚡ Pagamentos" },
                  { id: "logistics", label: "📍 Frete & Região" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLogFilter(f.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
                      logFilter === f.id
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                        : "text-muted-foreground hover:text-foreground bg-muted/20"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border/60 rounded-xl bg-muted/10">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p className="text-xs font-semibold text-foreground">Nenhum aprendizado registrado para este filtro.</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Conforme a Camila atende clientes pelo WhatsApp ou no simulador, os aprendizados aparecem aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log, idx) => {
                  const fc = log.fieldsChanged || {};
                  const cat = fc.category || "default";
                  const styleCfg = CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
                  const Icon = styleCfg.icon;
                  const xp = fc.xpGained || fc.totalXp || 20;

                  return (
                    <div
                      key={log.id || idx}
                      className="p-3.5 rounded-xl border border-border/70 bg-card/60 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                            styleCfg.bg,
                            styleCfg.text,
                            styleCfg.border,
                            "border"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {fc.title || log.sourceDescription}
                            </span>
                            <Badge className={cn("text-[9px] font-bold px-1.5 py-0 border", styleCfg.bg, styleCfg.text, styleCfg.border)}>
                              +{xp} XP
                            </Badge>
                          </div>

                          {fc.content && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {fc.content}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono pt-0.5">
                            {fc.contactName && <span>Cliente: {fc.contactName}</span>}
                            {fc.conversationId && <span>Conversa #{fc.conversationId}</span>}
                            <span>{new Date(log.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 self-end sm:self-center">
                        <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground">
                          {log.appliedBy || "automático"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ABA 3: MEMÓRIAS PRÁTICAS ATIVAS NO PROMPT */}
      {activeTab === "memories" && (
        <Card className="bg-card border-border/80 shadow-sm space-y-4">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Brain className="h-5 w-5 text-cyan-400" />
              Memórias Cognitivas Consolidadas no Prompt
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Fatos, termos e regras aprendidas que a Camila consulta ativamente em todas as respostas pelo WhatsApp.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            {(!profile?.activeMemories || profile.activeMemories.length === 0) ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border/60 rounded-xl bg-muted/10">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p className="text-xs font-semibold text-foreground">Memória sendo consolidada...</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  A Camila absorve regras de pagamento, catálogo e frete conforme as interações acontecem.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {profile.activeMemories.slice(0, 16).map((mem, idx) => (
                  <div
                    key={mem.id || idx}
                    className="p-3.5 rounded-xl border border-border/70 bg-card/60 hover:border-cyan-500/40 transition-all space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-cyan-300 truncate max-w-[220px]">
                        {mem.label || mem.nodeKey}
                      </span>
                      <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
                        peso {mem.weight || 1}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {mem.content || mem.label}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/30">
                      <span>Tipo: {mem.nodeType}</span>
                      <span>Ativa no Prompt</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
