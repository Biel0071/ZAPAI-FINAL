import React, { useState } from "react";
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
import {
  UserPlus,
  Briefcase,
  Smile,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ShoppingBag,
  Headphones,
  DollarSign,
  HeartHandshake,
  Calendar,
  Layers,
  MessageSquare,
  Globe,
  Smartphone,
  Shield,
  BookOpen,
  FileText,
  HelpCircle,
  Tag,
  Check,
} from "lucide-react";
import { useToast } from "@/state/hooks/use-toast";
import { useAppStore } from "@/state/stores/appStore";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";

interface NewAgentWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (agent: any) => void;
  defaultRole?: string;
}

const ROLES = [
  { id: "Vendas", label: "Vendas", icon: ShoppingBag, desc: "Apresenta produtos, negocia e fecha orçamentos" },
  { id: "Suporte", label: "Suporte", icon: Headphones, desc: "Resolve problemas e orienta dúvidas técnicas" },
  { id: "Pós-venda", label: "Pós-venda", icon: HeartHandshake, desc: "Acompanha entrega, satisfação e recompra" },
  { id: "Financeiro", label: "Financeiro", icon: DollarSign, desc: "Boletos, 2ª via, cobrança e pagamentos" },
  { id: "Recepção", label: "Recepção", icon: Calendar, desc: "Triagem de clientes, horário e direcionamento" },
  { id: "Consultoria", label: "Consultoria", icon: Briefcase, desc: "Diagnóstico aprofundado e soluções personalizadas" },
  { id: "Cobrança", label: "Cobrança", icon: DollarSign, desc: "Negociação de débitos e acordos amigáveis" },
  { id: "Marketing", label: "Marketing", icon: Sparkles, desc: "Qualificação de campanhas e captação de leads" },
  { id: "Outro", label: "Outro", icon: Layers, desc: "Função personalizada para o seu negócio" },
];

const PERSONALITIES = [
  {
    id: "amigavel",
    label: "AMIGÁVEL",
    subtitle: "Atencioso, próximo e simpático",
    desc: "Tom acolhedor e próximo, estabelece empatia imediata com o cliente.",
    badge: "Acolhimento",
    traits: { empathy: 95, proactivity: 75, formality: 40, objectivity: 70 },
  },
  {
    id: "profissional",
    label: "PROFISSIONAL",
    subtitle: "Objetivo, educado e corporativo",
    desc: "Comunicação formal, clara e segura, ideal para relações B2B e institucionais.",
    badge: "Corporativo",
    traits: { empathy: 75, proactivity: 80, formality: 90, objectivity: 90 },
  },
  {
    id: "comercial",
    label: "COMERCIAL",
    subtitle: "Proativo, persuasivo e focado em vendas",
    desc: "Identifica oportunidades, valoriza produtos e conduz com energia ao fechamento.",
    badge: "Alta Conversão",
    traits: { empathy: 85, proactivity: 95, formality: 60, objectivity: 85 },
  },
  {
    id: "tecnico",
    label: "TÉCNICO",
    subtitle: "Preciso, detalhista e objetivo",
    desc: "Respostas exatas, baseadas em especificações técnicas, sem enrolação.",
    badge: "Exatidão",
    traits: { empathy: 65, proactivity: 70, formality: 75, objectivity: 95 },
  },
  {
    id: "consultivo",
    label: "CONSULTIVO",
    subtitle: "Faz perguntas e entende a necessidade antes de responder",
    desc: "Escuta atenta, diagnóstico do cenário e recomendação da melhor alternativa.",
    badge: "Especialista",
    traits: { empathy: 90, proactivity: 85, formality: 70, objectivity: 80 },
  },
  {
    id: "personalizado",
    label: "PERSONALIZADO",
    subtitle: "Configurar manualmente",
    desc: "Ajuste fino de tom de voz, métricas e instruções específicas.",
    badge: "Flexível",
    traits: { empathy: 80, proactivity: 80, formality: 60, objectivity: 80 },
  },
];

const RESPONSIBILITIES = [
  { id: "atender_clientes", label: "Atender clientes", desc: "Recepção e triagem inicial" },
  { id: "vender", label: "Vender", desc: "Apresentar produtos e negociar" },
  { id: "tirar_duvidas", label: "Tirar dúvidas", desc: "Esclarecer sobre produtos e serviços" },
  { id: "enviar_orcamento", label: "Enviar orçamento", desc: "Cálculo de valores e propostas" },
  { id: "fazer_followup", label: "Fazer follow-up", desc: "Retomar contatos que não responderam" },
  { id: "suporte", label: "Suporte", desc: "Atendimento pós-ativação e resolução de dúvidas" },
  { id: "pos_venda", label: "Pós-venda", desc: "Verificação de satisfação e recompra" },
  { id: "agendamento", label: "Agendamento", desc: "Marcar reuniões e visitas técnicas" },
  { id: "outro", label: "Outro", desc: "Responsabilidades adicionais" },
];

const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", icon: Smartphone, desc: "Canal principal oficial via ZAPFLOW" },
  { id: "inbox", label: "Inbox ZAI", icon: MessageSquare, desc: "Painel de atendimento operacional interno" },
  { id: "instagram", label: "Instagram", icon: Globe, desc: "Direct e mensagens de campanhas" },
  { id: "web", label: "Web / Site", icon: Globe, desc: "Widget de chat no site da empresa" },
];

const KNOWLEDGE_SOURCES = [
  { id: "products", label: "Catálogo de Produtos & Serviços", icon: Tag, desc: "Itens, especificações e disponibilidade" },
  { id: "prices", label: "Preços & Condições de Pagamento", icon: DollarSign, desc: "Tabelas de preços, parcelamento e Pix" },
  { id: "policies", label: "Políticas da Loja, Prazos & Frete", icon: FileText, desc: "Regras de troca, devolução e entregas" },
  { id: "faq", label: "Dúvidas Frequentes (FAQ)", icon: HelpCircle, desc: "Perguntas comuns e respostas oficiais validadas" },
];

export function NewAgentWizardModal({
  open,
  onOpenChange,
  onCreated,
  defaultRole,
}: NewAgentWizardModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [role, setRole] = useState(defaultRole || "Vendas");
  const [customRole, setCustomRole] = useState("");
  const [personality, setPersonality] = useState("comercial");
  const [responsibilities, setResponsibilities] = useState<string[]>([
    "atender_clientes",
    "vender",
    "tirar_duvidas",
  ]);
  const [channels, setChannels] = useState<string[]>(["whatsapp", "inbox"]);
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>([
    "products",
    "prices",
    "policies",
    "faq",
  ]);

  // Reset or preset on open
  React.useEffect(() => {
    if (open) {
      setStep(1);
      if (defaultRole) {
        setRole(defaultRole);
        if (defaultRole.toLowerCase().includes("pós") || defaultRole.toLowerCase().includes("pos")) {
          setName("Marina");
          setPersonality("amigavel");
          setResponsibilities(["atender_clientes", "pos_venda", "fazer_followup"]);
        } else if (defaultRole.toLowerCase().includes("suporte")) {
          setName("João");
          setPersonality("tecnico");
          setResponsibilities(["atender_clientes", "suporte", "tirar_duvidas"]);
        }
      } else {
        setName("");
        setRole("Vendas");
        setPersonality("comercial");
      }
    }
  }, [open, defaultRole]);

  const toggleResponsibility = (id: string) => {
    setResponsibilities((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleKnowledge = (id: string) => {
    setKnowledgeSources((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (step === 1 && !name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite o nome do seu novo funcionário digital.",
        variant: "destructive",
      });
      return;
    }
    setStep((prev) => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinish = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);

    const selectedRole = role === "Outro" && customRole.trim() ? customRole.trim() : role;
    const selectedPersonalityObj = PERSONALITIES.find((p) => p.id === personality) || PERSONALITIES[0];

    const agentKey = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const storeSessions = useAppStore.getState().sessions || [];
    const validSessionIds = storeSessions
      .map((s: any) => s.id || s.sessionId || s.session_id)
      .filter(Boolean);
    const assignedSessions = validSessionIds.length > 0 ? validSessionIds : ["main"];

    const newAgentPayload = {
      key: agentKey || `agent-${Date.now()}`,
      name: name.trim(),
      role: selectedRole,
      sector: selectedRole,
      sessionIds: assignedSessions,
      active: true,
      status: "active",
      personalityType: personality,
      tone: personality === "tecnico" ? "objective" : personality === "amigavel" ? "warm" : "commercial",
      personality: `Você é ${name.trim()}, funcionário(a) digital responsável por ${selectedRole}. Sua personalidade é ${selectedPersonalityObj.subtitle}. Seja assertivo, atencioso e responda com clareza representando a empresa.`,
      objective: `Atuar com excelência em ${selectedRole}, cumprindo responsabilidades de: ${responsibilities.join(", ")}.`,
      responsibilities: responsibilities.map((r) => {
        const match = RESPONSIBILITIES.find((item) => item.id === r);
        return match ? match.label : r;
      }),
      channels: channels.length > 0 ? channels : ["whatsapp"],
      knowledgeSources,
      avatar: personality === "amigavel" || selectedRole.includes("Pós-venda")
        ? "/assets/mascot/mascot_laptop_working.png"
        : "/assets/mascot/zaibot_avatar.png",
      character: {
        gender: name.toLowerCase().endsWith("a") ? "female" : "male",
        outfit: "business",
        theme: "emerald",
      },
      personalityTraits: selectedPersonalityObj.traits,
      permissions: ["reply_messages", "view_catalog", "send_quotes"],
      stats: {
        chatsToday: 0,
        activeChats: 0,
        opportunities: 0,
        slaPercent: 100,
        avgResponseTime: "15s",
        satisfactionCsat: 100,
      },
      recentActivity: [
        {
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          action: "Agente criado e integrado à equipe digital",
          type: "system",
        },
      ],
    };

    try {
      const res = await apiService.createAIAgent(newAgentPayload);
      toast({
        title: "Agente criado com sucesso!",
        description: `${name} já faz parte da sua Equipe Digital e está pronto para atender.`,
      });
      if (onCreated) {
        onCreated(res.agent || newAgentPayload);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erro ao criar agente",
        description: err?.message || "Não foi possível cadastrar o agente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-border/80 bg-background text-foreground shadow-2xl">
        {/* HEADER */}
        <div className="p-6 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {step === 6 ? "Revisão do Novo Agente" : "Vamos criar seu novo agente"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Adicione um funcionário digital à sua equipe em poucos passos
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    s === step
                      ? "w-6 bg-emerald-500"
                      : s < step
                      ? "w-2 bg-emerald-500/60"
                      : "w-2 bg-muted/60"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* STEP CONTENT */}
        <div className="p-6 space-y-6">
          {/* STEP 1: NOME & FUNÇÃO */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Qual será o nome do agente?
                </label>
                <Input
                  autoFocus
                  placeholder="Ex: Camila, Marina, João, Carlos..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 text-sm bg-muted/30 border-border/80 focus-visible:ring-emerald-500/30"
                />
                <p className="text-[11px] text-muted-foreground">
                  Dê um nome humano para que seus clientes sintam um atendimento próximo e personalizado.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Qual será a função dele(a)?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {ROLES.map((r) => {
                    const isSelected = role === r.id;
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer relative",
                          isSelected
                            ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30"
                            : "bg-muted/20 border-border/60 hover:bg-muted/40 hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={cn("h-4 w-4", isSelected ? "text-emerald-400" : "text-muted-foreground")} />
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        </div>
                        <div>
                          <div className={cn("text-xs font-bold", isSelected ? "text-emerald-400" : "text-foreground")}>
                            {r.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {r.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {role === "Outro" && (
                  <div className="pt-2 animate-in fade-in duration-150">
                    <Input
                      placeholder="Especifique a função (Ex: Especialista em Orçamentos Rápidos)..."
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      className="h-10 text-xs bg-muted/30 border-border/80"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: PERSONALIDADE */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-foreground">Como {name || "o agente"} deve atender?</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escolha o estilo de comunicação e postura com os clientes
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERSONALITIES.map((p) => {
                  const isSelected = personality === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPersonality(p.id)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer relative",
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30"
                          : "bg-muted/20 border-border/60 hover:bg-muted/40 hover:border-border"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-bold tracking-wide", isSelected ? "text-emerald-400" : "text-foreground")}>
                          {p.label}
                        </span>
                        <Badge variant="outline" className="text-[9px] py-0 border-border/60">
                          {p.badge}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-foreground/90">
                        "{p.subtitle}"
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: RESPONSABILIDADES */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-foreground">Quais serão as responsabilidades de {name || "este agente"}?</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecione as tarefas que ele(a) estará autorizado(a) a executar
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {RESPONSIBILITIES.map((r) => {
                  const isChecked = responsibilities.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleResponsibility(r.id)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer",
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-500/50"
                          : "bg-muted/20 border-border/60 hover:bg-muted/40"
                      )}
                    >
                      <div>
                        <div className={cn("text-xs font-semibold", isChecked ? "text-emerald-400" : "text-foreground")}>
                          {r.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                          isChecked
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border/80 bg-background"
                        )}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: CANAIS */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-foreground">Em quais canais {name || "o agente"} vai atuar?</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecione os pontos de contato onde o funcionário atenderá
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CHANNELS.map((c) => {
                  const isChecked = channels.includes(c.id);
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChannel(c.id)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer",
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30"
                          : "bg-muted/20 border-border/60 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", isChecked ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground")}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className={cn("text-xs font-bold", isChecked ? "text-emerald-400" : "text-foreground")}>
                            {c.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{c.desc}</div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                          isChecked
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border/80 bg-background"
                        )}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: CONHECIMENTO */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-foreground">Fontes de Conhecimento</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quais dados da empresa {name || "o agente"} deve consultar para responder com segurança?
                </p>
              </div>

              <div className="space-y-2.5">
                {KNOWLEDGE_SOURCES.map((k) => {
                  const isChecked = knowledgeSources.includes(k.id);
                  const Icon = k.icon;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggleKnowledge(k.id)}
                      className={cn(
                        "w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer",
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-500/50"
                          : "bg-muted/20 border-border/60 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", isChecked ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className={cn("text-xs font-bold", isChecked ? "text-emerald-400" : "text-foreground")}>
                            {k.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{k.desc}</div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                          isChecked
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border/80 bg-background"
                        )}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: PRONTO / PREVIEW */}
          {step === 6 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={personality === "amigavel" || role.includes("Pós")
                        ? "/assets/mascot/mascot_laptop_working.png"
                        : "/assets/mascot/zaibot_avatar.png"}
                      alt={name}
                      className="h-14 w-14 rounded-2xl object-cover border border-emerald-500/40 bg-black/40 shadow"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">{name}</h3>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                          ● Ativo
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                        {role === "Outro" && customRole ? customRole : role}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Personalidade: {PERSONALITIES.find((p) => p.id === personality)?.label}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Canais</span>
                    <p className="font-semibold text-foreground mt-0.5 capitalize">{channels.join(", ") || "Nenhum"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Tarefas</span>
                    <p className="font-semibold text-foreground mt-0.5">{responsibilities.length} atribuídas</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Conhecimento</span>
                    <p className="font-semibold text-foreground mt-0.5">{knowledgeSources.length} bases conectadas</p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Tudo pronto! Seu novo funcionário digital será integrado à equipe e responderá conforme as diretrizes configuradas.
              </div>
            </div>
          )}
        </div>

        {/* FOOTER CONTROLS */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={step === 1 ? () => onOpenChange(false) : handleBack}
            className="text-xs"
          >
            {step === 1 ? "Cancelar" : <><ChevronLeft className="h-3.5 w-3.5 mr-1" /> Voltar</>}
          </Button>

          {step < 6 ? (
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4"
            >
              Avançar <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleFinish}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-5 shadow"
            >
              {isSubmitting ? "Criando funcionário..." : "Concluir e Ativar Agente"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
