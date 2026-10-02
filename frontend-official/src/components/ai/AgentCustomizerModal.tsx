import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Shirt,
  Sliders,
  Cpu,
  BookOpen,
  Clock,
  GitBranch,
  ShieldCheck,
  Brain,
  Save,
  Sparkles,
  Check,
  Heart,
  Zap,
  Target,
  Smile,
  Shield,
  MessageSquare,
  Building2,
  Store,
  Warehouse,
  Headphones,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/state/hooks/use-toast";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";

export type CustomizerTab =
  | "identidade"
  | "aparencia"
  | "personalidade"
  | "comportamento"
  | "conhecimento"
  | "atendimento"
  | "automacoes"
  | "permissoes"
  | "memoria";

interface AgentCustomizerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: any;
  onSave?: (updatedAgent: any) => Promise<void> | void;
}

export function AgentCustomizerModal({
  open,
  onOpenChange,
  agent,
  onSave,
}: AgentCustomizerModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<CustomizerTab>("identidade");

  // Tab 1: Identidade
  const [name, setName] = useState(agent?.name || "Camila");
  const [role, setRole] = useState(agent?.sector || agent?.role || "Especialista em Vendas & Atendimento");
  const [avatar, setAvatar] = useState(agent?.avatar || "/assets/mascot/mascot_laptop_working.png");
  const [themeColor, setThemeColor] = useState(agent?.themeColor || "#10b981");

  // Tab 2: Aparência
  const [outfit, setOutfit] = useState<string>(agent?.outfit || "uniforme_zai");
  const [accessories, setAccessories] = useState<string[]>(
    agent?.accessories || ["headset", "cracha"]
  );
  const [scene, setScene] = useState<string>(agent?.scene || "escritorio_zai");

  // Tab 3: Personalidade Sliders (0 - 100)
  const [empatia, setEmpatia] = useState(90);
  const [objetividade, setObjetividade] = useState(85);
  const [proatividade, setProatividade] = useState(85);
  const [formalidade, setFormalidade] = useState(60);
  const [energia, setEnergia] = useState(80);
  const [humor, setHumor] = useState(55);

  // Tab 4: Comportamento
  const [autonomia, setAutonomia] = useState<"assistida" | "hibrida" | "total">("hibrida");
  const [exigirConfirmacao, setExigirConfirmacao] = useState(true);
  const [delayResposta, setDelayResposta] = useState(12);

  // Tab 5: Conhecimento
  const [fontes, setFontes] = useState({
    catalogo: true,
    politicas: true,
    faq: true,
    precos: true,
  });
  const [ragThreshold, setRagThreshold] = useState(78);
  const [fallbackMode, setFallbackMode] = useState<"humano" | "aproximar" | "pedir_detalhes">("humano");

  // Tab 6: Atendimento
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("18:00");
  const [encaminharHumano, setEncaminharHumano] = useState(true);

  // Tab 7: Automações
  const [playbooks, setPlaybooks] = useState({
    fechamentoRapido: true,
    recuperacaoCarrinho: true,
    posVendaNps: true,
    ofertaRelampago: false,
  });
  const [gatilhos, setGatilhos] = useState({
    inboundWhats: true,
    leadCampanha: true,
    inatividade24h: false,
  });
  const [acoesPermitidas, setAcoesPermitidas] = useState({
    etiquetarCrm: true,
    moverKanban: true,
    criarPedido: true,
  });

  // Tab 8: Permissões
  const [permissoes, setPermissoes] = useState({
    consultarCatalogo: true,
    informarPrecos: true,
    gerarOrcamento: true,
    concederDesconto: false,
    confirmarPedidos: true,
    dispararCampanhas: false,
  });

  // Tab 9: Memória
  const [memoriaCliente, setMemoriaCliente] = useState(true);
  const [memoriaEmpresa, setMemoriaEmpresa] = useState(true);
  const [memoriaOperacional, setMemoriaOperacional] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name || "Camila");
      setRole(agent.sector || agent.role || "Especialista em Vendas & Atendimento");
      if (agent.avatar) setAvatar(agent.avatar);
      if (agent.themeColor) setThemeColor(agent.themeColor);
      if (agent.outfit) setOutfit(agent.outfit);
      if (agent.accessories) setAccessories(agent.accessories);
      if (agent.scene) setScene(agent.scene);
    }
  }, [agent]);

  const toggleAccessory = (accId: string) => {
    setAccessories((prev) =>
      prev.includes(accId) ? prev.filter((a) => a !== accId) : [...prev, accId]
    );
  };

  // Dynamic preview text based on personality
  const previewResponse = useMemo(() => {
    if (objetividade >= 85) {
      return `Olá! Sou ${name}. Temos pronta entrega com frete expresso e parcelamento em 10x sem juros. Deseja que eu emita o orçamento do seu pedido agora?`;
    }
    if (empatia >= 85) {
      return `Olá! Que prazer te atender hoje 😊 Sou a ${name}, e estou aqui para te ajudar em cada detalhe. Me conta, qual é a sua principal prioridade para esse projeto?`;
    }
    return `Olá! Sou ${name}, assistente da Loja ZAPFLOW. Como posso te auxiliar com suas compras hoje?`;
  }, [name, objetividade, empatia]);

  // Mascot dynamic mood title
  const moodTitle = useMemo(() => {
    if (objetividade >= 80) return "Closer Comercial";
    if (empatia >= 80) return "Acolhedor & Empático";
    if (proatividade >= 80) return "Consultivo Dinâmico";
    return "Assistente Padrão";
  }, [objetividade, empatia, proatividade]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updated = {
        ...(agent || {}),
        name,
        sector: role,
        avatar,
        themeColor,
        outfit,
        accessories,
        scene,
        personalitySliders: {
          formalidade,
          energia,
          humor,
          objetividade,
          empatia,
          proatividade,
        },
        behavior: {
          autonomia,
          exigirConfirmacao,
          delayResposta,
        },
        knowledge: {
          fontes,
          ragThreshold,
          fallbackMode,
        },
        schedule: {
          horarioInicio,
          horarioFim,
          encaminharHumano,
        },
        automations: {
          playbooks,
          gatilhos,
          acoesPermitidas,
        },
        permissions: permissoes,
        memory: {
          memoriaCliente,
          memoriaEmpresa,
          memoriaOperacional,
        },
      };

      if (onSave) {
        await onSave(updated);
      } else if (agent?.key) {
        await apiService.updateAIAgent(agent.key, updated);
      }

      toast({
        title: "Agente Customizado com Sucesso!",
        description: `As diretrizes de ${name} foram atualizadas com sucesso.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erro ao salvar customização",
        description: err.message || "Não foi possível salvar os ajustes do agente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "identidade" as CustomizerTab, label: "Identidade", icon: User },
    { id: "aparencia" as CustomizerTab, label: "Aparência", icon: Shirt },
    { id: "personalidade" as CustomizerTab, label: "Personalidade", icon: Sliders },
    { id: "comportamento" as CustomizerTab, label: "Comportamento", icon: Cpu },
    { id: "conhecimento" as CustomizerTab, label: "Conhecimento", icon: BookOpen },
    { id: "atendimento" as CustomizerTab, label: "Atendimento", icon: Clock },
    { id: "automacoes" as CustomizerTab, label: "Automações", icon: GitBranch },
    { id: "permissoes" as CustomizerTab, label: "Permissões", icon: ShieldCheck },
    { id: "memoria" as CustomizerTab, label: "Memória", icon: Brain },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1020px] w-[95vw] p-0 overflow-hidden bg-[#090e17] border-emerald-500/40 text-foreground shadow-2xl">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-border/60 bg-[#0c1420]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl overflow-hidden border border-emerald-500/50 bg-black shrink-0 relative">
              <img src={avatar} alt={name} className="h-full w-full object-cover" />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Customizar Agente — {name}
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  Zero Code
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Personalize identidade, roupas 3D, comportamento, playbooks e limites operacionais sem programar.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center px-4 bg-[#080d16] border-b border-border/50 gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                  isSelected
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/10"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* BODY: SPLIT VIEW (SETTINGS FORM + LIVE MASCOT PREVIEW PANE) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[500px] overflow-hidden">
          {/* LEFT FORM AREA (7 COLS) */}
          <div className="lg:col-span-7 p-6 overflow-y-auto space-y-5 border-r border-border/50">
            {/* TAB 1: IDENTIDADE */}
            {activeTab === "identidade" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nome do Agente</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Camila"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Função / Especialidade</Label>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Ex: Assistente de Vendas & Fechamento"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Avatar do Mascote</Label>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[
                      { label: "Camila 16-bit", src: "/assets/evolution/camila_avatar_16bit.png" },
                      { label: "ZAIBOT 3D", src: "/assets/mascot/zaibot_avatar.png" },
                      { label: "Mascote Thumbs", src: "/assets/mascot/mascot_standing_thumbsup.png" },
                      { label: "Mascote Laptop", src: "/assets/mascot/mascot_laptop_working.png" },
                    ].map((av) => (
                      <button
                        key={av.src}
                        type="button"
                        onClick={() => setAvatar(av.src)}
                        className={cn(
                          "p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer",
                          avatar === av.src
                            ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-500"
                            : "border-border/60 hover:bg-muted/30"
                        )}
                      >
                        <img src={av.src} alt={av.label} className="h-10 w-10 rounded-lg object-cover" />
                        <span className="text-[10px] font-medium truncate w-full text-center">
                          {av.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: APARÊNCIA */}
            {activeTab === "aparencia" && (
              <div className="space-y-4">
                {/* Roupas */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Shirt className="h-3.5 w-3.5 text-emerald-400" /> Figurino / Roupas
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: "uniforme_zai", label: "Uniforme ZAI Pro", desc: "Verde neon com crachá digital" },
                      { id: "uniforme_vendas", label: "Comercial Elegante", desc: "Camisa social corporativa" },
                      { id: "casual", label: "Casual Moderno", desc: "Camiseta e jaqueta descolada" },
                      { id: "executivo", label: "Executivo B2B", desc: "Blazer alfaiataria premium" },
                      { id: "jaleco", label: "Jaleco Especialista", desc: "Branco consultivo técnico" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setOutfit(item.id)}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          outfit === item.id
                            ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-500"
                            : "border-border/60 hover:bg-muted/30"
                        )}
                      >
                        <span className="text-xs font-bold block text-foreground">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5 leading-tight">
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Acessórios */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Headphones className="h-3.5 w-3.5 text-emerald-400" /> Acessórios em Uso
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: "headset", label: "Headset Gamer / Operador" },
                      { id: "cracha", label: "Crachá ZAI Holográfico" },
                      { id: "tablet", label: "Tablet Digital de Vendas" },
                      { id: "celular", label: "Smartphone WhatsApp VIP" },
                      { id: "oculos", label: "Óculos Inteligentes AR" },
                    ].map((acc) => {
                      const active = accessories.includes(acc.id);
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => toggleAccessory(acc.id)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                            active
                              ? "border-emerald-400 bg-emerald-500/15 text-foreground"
                              : "border-border/60 hover:bg-muted/30 text-muted-foreground"
                          )}
                        >
                          <span className="text-xs font-semibold">{acc.label}</span>
                          {active && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cenário */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cenário Virtual de Fundo</Label>
                  <Select value={scene} onValueChange={setScene}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o cenário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="escritorio_zai">Escritório ZAI (Dark Glassmorphism)</SelectItem>
                      <SelectItem value="balcao_loja">Balcão da Loja / Depósito</SelectItem>
                      <SelectItem value="showroom">Showroom Comercial</SelectItem>
                      <SelectItem value="corporate">Sala Executiva B2B</SelectItem>
                      <SelectItem value="expedicao">Centro de Expedição</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* TAB 3: PERSONALIDADE */}
            {activeTab === "personalidade" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Ajuste os sliders para definir o tom de voz e assertividade de condução. O motor neural calibra as diretrizes em tempo real.
                </p>

                {[
                  { label: "Empatia & Acolhimento", value: empatia, setter: setEmpatia, icon: Heart, low: "Direto", high: "Altamente Acolhedor" },
                  { label: "Objetividade Comercial", value: objetividade, setter: setObjetividade, icon: Target, low: "Conversacional", high: "Focado em Fechamento" },
                  { label: "Proatividade em Vendas", value: proatividade, setter: setProatividade, icon: Zap, low: "Reativo", high: "Oferece Ofertas/Produtos" },
                  { label: "Formalidade no Tom", value: formalidade, setter: setFormalidade, icon: Shield, low: "Informal/Emojis", high: "Corporativo" },
                  { label: "Energia & Entusiasmo", value: energia, setter: setEnergia, icon: Sparkles, low: "Calmo", high: "Vibrante" },
                  { label: "Bom Humor & Leveza", value: humor, setter: setHumor, icon: Smile, low: "Sério", high: "Descontraído" },
                ].map((slider) => {
                  const Icon = slider.icon;
                  return (
                    <div key={slider.label} className="p-3 rounded-xl border border-border/60 bg-[#0c1420]/60 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-emerald-400" />
                          {slider.label}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">{slider.value}%</span>
                      </div>
                      <Slider
                        value={[slider.value]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(val) => slider.setter(val[0])}
                        className="py-1"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{slider.low}</span>
                        <span>{slider.high}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 4: COMPORTAMENTO */}
            {activeTab === "comportamento" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border/60 bg-[#0c1420]/60 space-y-3">
                  <Label className="text-xs font-semibold">Nível de Autonomia Operacional</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "assistida", title: "Assistida", desc: "Apenas sugere respostas para o atendente aprovar" },
                      { id: "hibrida", title: "Híbrida (Padrão)", desc: "Responde dúvidas comuns; pede confirmação em orçamentos" },
                      { id: "total", title: "Autônoma Total", desc: "Conduz o cliente até a geração do pedido" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setAutonomia(mode.id as any)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all cursor-pointer",
                          autonomia === mode.id
                            ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-500"
                            : "border-border/60 hover:bg-muted/30"
                        )}
                      >
                        <div className="font-bold text-xs text-foreground">{mode.title}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{mode.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-[#0c1420]/60">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Exigir Confirmação Humana para Descontos</div>
                    <div className="text-[11px] text-muted-foreground">Impede concessão de margem sem aval do gerente</div>
                  </div>
                  <Switch checked={exigirConfirmacao} onCheckedChange={setExigirConfirmacao} />
                </div>

                <div className="p-3.5 rounded-xl border border-border/60 bg-[#0c1420]/60 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">Tempo Natural de Digitação</span>
                    <span className="font-mono text-emerald-400 font-bold">{delayResposta} segundos</span>
                  </div>
                  <Slider
                    value={[delayResposta]}
                    min={3}
                    max={30}
                    step={1}
                    onValueChange={(val) => setDelayResposta(val[0])}
                  />
                  <div className="text-[10px] text-muted-foreground">
                    Simula digitação humana para evitar respostas instantâneas robóticas.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: CONHECIMENTO */}
            {activeTab === "conhecimento" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Fontes de Conhecimento Ativas</Label>
                  <div className="space-y-2">
                    {[
                      { key: "catalogo", label: "Catálogo de Produtos & Estoque", desc: "Dimensões, fotos, especificações e disponibilidade" },
                      { key: "politicas", label: "Políticas de Frete & Entrega", desc: "Prazos, taxas regionais e transportadoras homologadas" },
                      { key: "faq", label: "Base de Conhecimento & FAQ", desc: "Perguntas frequentes e dúvidas comuns de compradores" },
                      { key: "precos", label: "Tabela de Preços & Descontos Pix", desc: "Regras de parcelamento e descontos à vista" },
                    ].map((f) => (
                      <div
                        key={f.key}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-[#0c1420]/60"
                      >
                        <div>
                          <div className="text-xs font-semibold text-foreground">{f.label}</div>
                          <div className="text-[11px] text-muted-foreground">{f.desc}</div>
                        </div>
                        <Switch
                          checked={(fontes as any)[f.key]}
                          onCheckedChange={(val) =>
                            setFontes((prev) => ({ ...prev, [f.key]: val }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/60 bg-[#0c1420]/60 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">Assertividade de Busca Semântica (RAG)</span>
                    <span className="font-mono text-emerald-400 font-bold">{ragThreshold}%</span>
                  </div>
                  <Slider
                    value={[ragThreshold]}
                    min={50}
                    max={95}
                    step={1}
                    onValueChange={(val) => setRagThreshold(val[0])}
                  />
                  <div className="text-[10px] text-muted-foreground">
                    Valores mais altos evitam alucinações; valores moderados permitem flexibilidade criativa.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Comportamento Quando Não Souber</Label>
                  <Select value={fallbackMode} onValueChange={(val: any) => setFallbackMode(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="humano">Transferir imediatamente para atendente humano</SelectItem>
                      <SelectItem value="pedir_detalhes">Pedir mais detalhes ao cliente de forma educada</SelectItem>
                      <SelectItem value="aproximar">Oferecer opções similares mais próximas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* TAB 6: ATENDIMENTO */}
            {activeTab === "atendimento" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Início do Expediente</Label>
                    <Input
                      type="time"
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Fim do Expediente</Label>
                    <Input
                      type="time"
                      value={horarioFim}
                      onChange={(e) => setHorarioFim(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-[#0c1420]/60">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Transbordo para Atendente Humano</div>
                    <div className="text-[11px] text-muted-foreground">
                      Quando o cliente solicitar operador ou o robô detectar impasse
                    </div>
                  </div>
                  <Switch checked={encaminharHumano} onCheckedChange={setEncaminharHumano} />
                </div>
              </div>
            )}

            {/* TAB 7: AUTOMAÇÕES */}
            {activeTab === "automacoes" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Playbooks de Conversão Ativos</Label>
                  {[
                    { key: "fechamentoRapido", label: "Playbook Fechamento Rápido", desc: "Apresenta valor com desconto no Pix e link de pagamento" },
                    { key: "recuperacaoCarrinho", label: "Recuperação de Carrinho / Orçamento", desc: "Reativa clientes que pediram preço e não responderam" },
                    { key: "posVendaNps", label: "Pós-Venda & Avaliação NPS", desc: "Solicita feedback 24h após a entrega do produto" },
                    { key: "ofertaRelampago", label: "Oferta Relâmpago / Condição Especial", desc: "Oferece bônus de frete para fechar no mesmo dia" },
                  ].map((pb) => (
                    <div
                      key={pb.key}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-[#0c1420]/60"
                    >
                      <div>
                        <div className="text-xs font-semibold text-foreground">{pb.label}</div>
                        <div className="text-[11px] text-muted-foreground">{pb.desc}</div>
                      </div>
                      <Switch
                        checked={(playbooks as any)[pb.key]}
                        onCheckedChange={(val) =>
                          setPlaybooks((prev) => ({ ...prev, [pb.key]: val }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Ações Automáticas Autorizadas no CRM</Label>
                  {[
                    { key: "etiquetarCrm", label: "Etiquetar Contato Automaticamente", desc: "Adiciona tags como 'Interessado', 'Quente', 'Orçamento Enviado'" },
                    { key: "moverKanban", label: "Mover Card de Etapa no Funil", desc: "Avança o lead para 'Proposta Feita' ou 'Negociação'" },
                    { key: "criarPedido", label: "Registrar Pedido de Venda", desc: "Gera rascunho de pedido pronto para faturamento" },
                  ].map((act) => (
                    <div
                      key={act.key}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-[#0c1420]/60"
                    >
                      <div>
                        <div className="text-xs font-semibold text-foreground">{act.label}</div>
                        <div className="text-[11px] text-muted-foreground">{act.desc}</div>
                      </div>
                      <Switch
                        checked={(acoesPermitidas as any)[act.key]}
                        onCheckedChange={(val) =>
                          setAcoesPermitidas((prev) => ({ ...prev, [act.key]: val }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 8: PERMISSÕES */}
            {activeTab === "permissoes" && (
              <div className="space-y-2.5">
                {[
                  { key: "consultarCatalogo", title: "Consultar Catálogo e Estoque", desc: "Acessar tabela de produtos e disponibilidade" },
                  { key: "informarPrecos", title: "Informar Preços e Condições", desc: "Passar valores à vista e parcelados" },
                  { key: "gerarOrcamento", title: "Gerar Orçamentos e Ficha", desc: "Montar orçamentos preliminares em PDF/texto" },
                  { key: "concederDesconto", title: "Conceder Desconto Especial", desc: "Permitir margem de 5% a 10% negociada" },
                  { key: "confirmarPedidos", title: "Confirmar Pedidos de Venda", desc: "Registrar pedido fechado no CRM" },
                  { key: "dispararCampanhas", title: "Disparar Mensagens Ativas", desc: "Iniciar contato ativo com leads frios" },
                ].map((perm) => (
                  <div
                    key={perm.key}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-[#0c1420]/60"
                  >
                    <div>
                      <div className="text-xs font-semibold text-foreground">{perm.title}</div>
                      <div className="text-[11px] text-muted-foreground">{perm.desc}</div>
                    </div>
                    <Switch
                      checked={(permissoes as any)[perm.key]}
                      onCheckedChange={(val) =>
                        setPermissoes((prev) => ({ ...prev, [perm.key]: val }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {/* TAB 9: MEMÓRIA */}
            {activeTab === "memoria" && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-border/60 bg-[#0c1420]/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Memória do Cliente (Per-Contact)</div>
                    <div className="text-[11px] text-muted-foreground">
                      Recorda preferências individuais, formas de pagamento favoritas e histórico de compras.
                    </div>
                  </div>
                  <Switch checked={memoriaCliente} onCheckedChange={setMemoriaCliente} />
                </div>

                <div className="p-3.5 rounded-xl border border-border/60 bg-[#0c1420]/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Memória da Empresa (Políticas & Frete)</div>
                    <div className="text-[11px] text-muted-foreground">
                      Armazena regras de entrega, prazos, formas de pagamento aceitas e endereço da loja.
                    </div>
                  </div>
                  <Switch checked={memoriaEmpresa} onCheckedChange={setMemoriaEmpresa} />
                </div>

                <div className="p-3.5 rounded-xl border border-border/60 bg-[#0c1420]/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Memória Operacional (CRM & Pedidos)</div>
                    <div className="text-[11px] text-muted-foreground">
                      Acompanha se o cliente já recebeu orçamento, se aguarda faturamento ou entrega.
                    </div>
                  </div>
                  <Switch checked={memoriaOperacional} onCheckedChange={setMemoriaOperacional} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANE: LIVE MASCOT PREVIEW (5 COLS) */}
          <div className="lg:col-span-5 bg-gradient-to-b from-[#0c1420] to-[#070b12] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-foreground">Preview Vivo do Mascote</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] uppercase font-bold tracking-wider">
                  {moodTitle}
                </Badge>
              </div>

              {/* MASCOT DISPLAY STAGE */}
              <div className="relative mt-4 h-52 rounded-2xl border border-emerald-500/30 bg-black/40 overflow-hidden flex flex-col items-center justify-center p-4 shadow-inner">
                {/* Background scenery tint */}
                <div className="absolute inset-0 bg-radial from-emerald-500/10 via-transparent to-black pointer-events-none" />

                {/* Scenery label */}
                <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 text-[9px] text-emerald-400/80 bg-background/80 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Building2 className="h-2.5 w-2.5" />
                  <span className="capitalize">{scene.replace("_", " ")}</span>
                </div>

                {/* Avatar with dynamic glow */}
                <div className="relative z-10 animate-float flex flex-col items-center">
                  <div className="h-28 w-28 rounded-2xl overflow-hidden border-2 border-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.35)] bg-emerald-950/30">
                    <img src={avatar} alt={name} className="h-full w-full object-cover" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-foreground flex items-center gap-1">
                    {name}
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                    {role}
                  </span>
                </div>

                {/* Active Outfit & Accessories badges */}
                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 justify-center z-10">
                  <Badge variant="outline" className="text-[8px] px-1.5 py-0 border-emerald-500/30 text-emerald-300 bg-background/80">
                    {outfit.replace("_", " ")}
                  </Badge>
                  {accessories.map((acc) => (
                    <Badge key={acc} variant="outline" className="text-[8px] px-1.5 py-0 border-border/80 text-muted-foreground bg-background/80">
                      +{acc}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* SIMULATED WHATSAPP MESSAGE BUBBLE */}
              <div className="mt-4 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3 text-emerald-400" /> Tom de Resposta Simulado:
                </span>
                <div className="p-3 rounded-xl rounded-tl-sm border border-emerald-500/30 bg-emerald-950/30 text-xs text-foreground/90 leading-relaxed shadow-sm">
                  "{previewResponse}"
                </div>
              </div>
            </div>

            {/* QUICK STATS */}
            <div className="p-3 rounded-xl border border-border/60 bg-muted/10 grid grid-cols-3 text-center gap-2 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block">Autonomia</span>
                <span className="font-bold text-emerald-400 capitalize">{autonomia}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Delay Digitação</span>
                <span className="font-bold text-foreground font-mono">{delayResposta}s</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">RAG Mínimo</span>
                <span className="font-bold text-purple-400 font-mono">{ragThreshold}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 border-t border-border/60 bg-[#080d16] flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            Configuração validada pelo motor de conformidade ZAI
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs border-border/70"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSaveAll}
              className="h-8 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black px-4 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
