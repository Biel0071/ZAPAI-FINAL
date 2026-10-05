import React, { useState, useEffect } from "react";
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
  Store,
  Sliders,
} from "lucide-react";
import { useToast } from "@/state/hooks/use-toast";
import { useAppStore } from "@/state/stores/appStore";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";

export interface NewAgentWizardModalProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onCreated?: (agent: any) => void;
  onSuccess?: () => void;
  defaultRole?: string;
}

const ROLES = [
  { id: "Vendas", label: "Vendas & Orçamentos", icon: ShoppingBag, desc: "Apresenta produtos, negocia e fecha orçamentos" },
  { id: "Suporte", label: "Suporte Técnico", icon: Headphones, desc: "Resolve problemas e orienta dúvidas técnicas" },
  { id: "Pós-venda", label: "Pós-venda & Satisfação", icon: HeartHandshake, desc: "Acompanha entrega, satisfação e recompra" },
  { id: "Financeiro", label: "Cobrança & Financeiro", icon: DollarSign, desc: "Boletos, 2ª via, cobrança e pagamentos" },
  { id: "Recepção", label: "Recepção & Triagem", icon: Calendar, desc: "Triagem de clientes, horário e direcionamento" },
  { id: "Outro", label: "Especialista Geral", icon: Layers, desc: "Função personalizada para sua loja" },
];

const PERSONALITIES = [
  {
    id: "comercial",
    label: "COMERCIAL",
    subtitle: "Proativo, persuasivo e focado em vendas",
    desc: "Identifica oportunidades, valoriza produtos e conduz com energia ao fechamento.",
    badge: "Alta Conversão",
    traits: { empathy: 85, proactivity: 95, formality: 60, objectivity: 85 },
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
    id: "amigavel",
    label: "AMIGÁVEL",
    subtitle: "Atencioso, próximo e simpático",
    desc: "Tom acolhedor e próximo, estabelece empatia imediata com o cliente.",
    badge: "Acolhimento",
    traits: { empathy: 95, proactivity: 75, formality: 40, objectivity: 70 },
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
    id: "profissional",
    label: "PROFISSIONAL",
    subtitle: "Objetivo, educado e corporativo",
    desc: "Comunicação formal, clara e segura, ideal para relações B2B e institucionais.",
    badge: "Corporativo",
    traits: { empathy: 75, proactivity: 80, formality: 90, objectivity: 90 },
  },
];

export function NewAgentWizardModal({
  open,
  isOpen,
  onOpenChange,
  onClose,
  onCreated,
  onSuccess,
  defaultRole,
}: NewAgentWizardModalProps) {
  const visible = open !== undefined ? open : (isOpen !== undefined ? isOpen : false);
  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const { toast } = useToast();
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available data from backend
  const [stores, setStores] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Wizard state
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [useStoreProfile, setUseStoreProfile] = useState<boolean>(true);

  // Agent Identity
  const [name, setName] = useState("");
  const [role, setRole] = useState(defaultRole || "Vendas");
  const [personality, setPersonality] = useState("comercial");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [outfit, setOutfit] = useState<string>("business");
  const [hasHeadset, setHasHeadset] = useState(true);

  // Load stores & connections
  useEffect(() => {
    if (visible) {
      setStep(1);
      if (defaultRole) setRole(defaultRole);
      setName(defaultRole === "Suporte" ? "Rafael" : defaultRole === "Pós-venda" ? "Mariana" : "Camila");

      // Fetch stores and sessions
      apiService.getStores().then((res) => {
        if (res.stores && res.stores.length > 0) {
          setStores(res.stores);
          setSelectedStoreId(res.stores[0].id);
        }
      }).catch(() => {});

      apiService.getConnections().then((res) => {
        const list = Array.isArray(res) ? res : [];
        setSessions(list);
        if (list.length > 0) {
          setSelectedSessionId(list[0].sessionId || list[0].id);
        }
      }).catch(() => {});
    }
  }, [visible, defaultRole]);

  const selectedStore = stores.find((s) => s.id === selectedStoreId) || stores[0] || null;
  const selectedSession = sessions.find((s) => (s.sessionId || s.id) === selectedSessionId) || sessions[0] || null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Informe o nome do atendente", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const agentKey = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const newAgentPayload = {
      key: agentKey || `attendant-${Date.now()}`,
      name: name.trim(),
      role: role,
      storeId: selectedStore?.id || null,
      inheritStoreProfile: useStoreProfile,
      sessionIds: selectedSession ? [selectedSession.sessionId || selectedSession.id] : [],
      active: true,
      status: "active",
      personalityType: personality,
      tone: personality === "tecnico" ? "objective" : personality === "amigavel" ? "warm" : "commercial",
      personality: `Você é ${name.trim()}, atendente digital oficial da loja ${selectedStore?.name || "ZAI"}. Especialidade: ${role}. Atue com tom ${personality}, prestativo e acolhedor, tirando dúvidas com precisão comercial.`,
      avatar: gender === "female" ? "/assets/evolution/camila_avatar.png" : "/assets/evolution/joao_avatar.png",
      character: {
        gender,
        outfit,
        clothingColor: "#10b981",
        hairColor: gender === "female" ? "#3d2314" : "#1a1a1a",
        skinTone: "#fcd3b0",
        accessories: hasHeadset ? ["headset", "badge"] : ["badge"],
        theme: "emerald",
      },
      appearance: {
        avatar: gender === "female" ? "/assets/evolution/camila_avatar.png" : "/assets/evolution/joao_avatar.png",
        character: gender === "female" ? "female_attendant" : "male_attendant",
        outfit,
        accessories: hasHeadset ? ["headset", "badge"] : ["badge"],
        environment: "office_sales",
        animation: "idle_friendly",
        theme: "emerald",
      },
    };

    try {
      const res = await apiService.createAIAgent(newAgentPayload);

      // Vincular à conexão se selecionada
      if (selectedSession) {
        const sessId = selectedSession.sessionId || selectedSession.id;
        await apiService.assignAttendantToConnection(sessId, newAgentPayload.key).catch(() => {});
      }

      toast({
        title: "Atendente criado com sucesso!",
        description: `${name} foi vinculado(a) à loja ${selectedStore?.name || "principal"} e está pronto(a) para atender.`,
      });

      if (onCreated) onCreated(res.agent || newAgentPayload);
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err: any) {
      toast({
        title: "Erro ao criar atendente",
        description: err?.message || "Não foi possível criar o atendente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border/80 bg-card/95 backdrop-blur-xl">
        <DialogHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg flex items-center gap-2">
                <Store className="h-5 w-5 text-emerald-400" />
                <span>Criação de Atendente Digital por Loja</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Passo {step} de 5: {
                  step === 1 ? "Escolher a Loja" :
                  step === 2 ? "Escolher o Número WhatsApp" :
                  step === 3 ? "Herança do Padrão da Loja" :
                  step === 4 ? "Especialidade & Personalidade" : "Avatar & Ativação"
                }
              </DialogDescription>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs">
              1 Número = 1 Atendente
            </Badge>
          </div>
        </DialogHeader>

        {/* ================= STEP 1: ESCOLHER LOJA ================= */}
        {step === 1 && (
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">A qual loja este atendente pertencerá?</h4>
              <p className="text-xs text-muted-foreground">
                O atendente herdará o catálogo de produtos, horário de funcionamento e políticas de frete desta loja.
              </p>
            </div>

            {stores.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/70 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Nenhuma loja cadastrada. Usaremos a Loja Principal Padrão.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {stores.map((st) => {
                  const isSelected = selectedStoreId === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStoreId(st.id)}
                      className={cn(
                        "p-3.5 rounded-xl border text-left cursor-pointer transition-all space-y-1.5 select-none",
                        isSelected
                          ? "bg-card border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30"
                          : "bg-background/40 border-border/60 hover:bg-card/80"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground truncate">{st.name}</p>
                        {isSelected && <Check className="h-4 w-4 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{st.segment || "Varejo"}</p>
                      <p className="text-[10px] text-emerald-400 font-mono truncate">{st.phone || "Telefone não informado"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 2: ESCOLHER NÚMERO WHATSAPP ================= */}
        {step === 2 && (
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Qual número de WhatsApp este atendente irá operar?</h4>
              <p className="text-xs text-muted-foreground">
                Regra Canônica: 1 Número WhatsApp = 1 Atendente Principal. O atendente responderá exclusivamente através desta conexão.
              </p>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              <div
                onClick={() => setSelectedSessionId("")}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                  selectedSessionId === ""
                    ? "bg-card border-emerald-500/60 ring-1 ring-emerald-500/30"
                    : "bg-background/40 border-border/60 hover:bg-card"
                )}
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">Criar sem vincular agora (Configuração prévia)</p>
                  <p className="text-[11px] text-muted-foreground">Você poderá vincular a qualquer conexão na tela de Conexões depois.</p>
                </div>
                {selectedSessionId === "" && <Check className="h-4 w-4 text-emerald-400" />}
              </div>

              {sessions.map((sess) => {
                const id = sess.sessionId || sess.id;
                const isSelected = selectedSessionId === id;
                return (
                  <div
                    key={id}
                    onClick={() => setSelectedSessionId(id)}
                    className={cn(
                      "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                      isSelected
                        ? "bg-card border-emerald-500/60 ring-1 ring-emerald-500/30"
                        : "bg-background/40 border-border/60 hover:bg-card"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{sess.sessionName || sess.name || id}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{sess.phone || id}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-400" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= STEP 3: USAR PADRÃO DA LOJA? ================= */}
        {step === 3 && (
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Herança do Padrão da Loja (STORE_PROFILE)</h4>
              <p className="text-xs text-muted-foreground">
                Deseja que este atendente herde automaticamente as regras, fretes, garantias e catálogo de <strong>{selectedStore?.name || "sua loja"}</strong>?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div
                onClick={() => setUseStoreProfile(true)}
                className={cn(
                  "p-4 rounded-xl border cursor-pointer transition-all space-y-2 select-none",
                  useStoreProfile
                    ? "bg-card border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30"
                    : "bg-background/40 border-border/60 hover:bg-card"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">SIM — Usar Padrão da Loja (Recomendado)</span>
                  {useStoreProfile && <Check className="h-4 w-4 text-emerald-400" />}
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  O atendente herda automaticamente todos os produtos, preços, fretes e horários. Você só precisa definir o tom e o avatar.
                </p>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 space-y-0.5">
                  <p>• Fretes e pagamentos sempre atualizados</p>
                  <p>• Sem risco de inventar regras comerciais</p>
                </div>
              </div>

              <div
                onClick={() => setUseStoreProfile(false)}
                className={cn(
                  "p-4 rounded-xl border cursor-pointer transition-all space-y-2 select-none",
                  !useStoreProfile
                    ? "bg-card border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30"
                    : "bg-background/40 border-border/60 hover:bg-card"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">NÃO — Customizar do Zero</span>
                  {!useStoreProfile && <Check className="h-4 w-4 text-emerald-400" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O atendente terá regras e instruções completamente manuais e isoladas da loja.
                </p>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 space-y-0.5">
                  <p>• Requer configuração individual de catálogo</p>
                  <p>• Recomendado para atendentes de projetos específicos</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: ESPECIALIDADE & PERSONALIDADE ================= */}
        {step === 4 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Nome do Atendente *</label>
                <Input
                  placeholder="Ex: Camila, Rafael, Mariana..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Especialidade / Função</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Estilo de Atendimento & Personalidade</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto">
                {PERSONALITIES.map((p) => {
                  const isSelected = personality === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setPersonality(p.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left cursor-pointer transition-all select-none space-y-1",
                        isSelected
                          ? "bg-card border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30"
                          : "bg-background/40 border-border/60 hover:bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{p.label}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-400">
                          {p.badge}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">{p.subtitle}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 5: AVATAR & ATIVAÇÃO ================= */}
        {step === 5 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Avatar & Visual no Workspace 2.5D</h4>
              <p className="text-xs text-muted-foreground">
                Escolha a apresentação visual do atendente no cenário digital e nos cartões de atendimento.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setGender("female")}
                className={cn(
                  "p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 select-none",
                  gender === "female"
                    ? "bg-card border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-sm"
                    : "bg-background/40 border-border/60 hover:bg-card"
                )}
              >
                <img
                  src="/assets/evolution/camila_avatar.png"
                  alt="Feminino"
                  className="h-12 w-12 rounded-xl object-cover border border-emerald-500/30 bg-background"
                />
                <div>
                  <p className="text-xs font-bold text-foreground">Atendente Feminina</p>
                  <p className="text-[11px] text-muted-foreground">Modelo Camila / Mariana</p>
                </div>
              </div>

              <div
                onClick={() => setGender("male")}
                className={cn(
                  "p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 select-none",
                  gender === "male"
                    ? "bg-card border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-sm"
                    : "bg-background/40 border-border/60 hover:bg-card"
                )}
              >
                <img
                  src="/assets/evolution/joao_avatar.png"
                  alt="Masculino"
                  className="h-12 w-12 rounded-xl object-cover border border-emerald-500/30 bg-background"
                />
                <div>
                  <p className="text-xs font-bold text-foreground">Atendente Masculino</p>
                  <p className="text-[11px] text-muted-foreground">Modelo Rafael / Carlos</p>
                </div>
              </div>
            </div>

            {/* Summary card */}
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1.5">
              <p className="font-semibold text-emerald-400">Resumo da Configuração:</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <p>• Nome: <strong className="text-foreground">{name || "Atendente"}</strong></p>
                <p>• Loja: <strong className="text-foreground">{selectedStore?.name || "Padrão"}</strong></p>
                <p>• Especialidade: <strong className="text-foreground">{role}</strong></p>
                <p>• Número: <strong className="text-foreground">{selectedSession?.sessionName || "Em espera"}</strong></p>
                <p>• Padrão da Loja: <strong className="text-foreground">{useStoreProfile ? "Ativo" : "Manual"}</strong></p>
                <p>• Estilo: <strong className="text-foreground">{personality}</strong></p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (step === 1) handleClose();
              else setStep((s) => s - 1);
            }}
            className="rounded-xl text-xs gap-1 border-border/60"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>{step === 1 ? "Cancelar" : "Voltar"}</span>
          </Button>

          {step < 5 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <span>Avançar</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting || !name.trim()}
              onClick={handleSubmit}
              className="rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Criando..." : "Ativar Atendente"}</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
