import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Sliders,
  Cpu,
  Clock,
  ShieldCheck,
  Brain,
  Save,
  Sparkles,
  Check,
  Palette,
  Eye,
  Layers,
  Heart,
  Zap,
  Target,
  Smile,
  Shield,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/state/hooks/use-toast";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";

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
  const [activeTab, setActiveTab] = useState<
    "identidade" | "personalidade" | "comportamento" | "atendimento" | "permissoes" | "memoria"
  >("identidade");

  // Identidade
  const [name, setName] = useState(agent?.name || "Camila");
  const [role, setRole] = useState(agent?.sector || "Assistente de Vendas");
  const [avatar, setAvatar] = useState(agent?.avatar || "/assets/evolution/camila_avatar_16bit.png");
  const [themeColor, setThemeColor] = useState(agent?.themeColor || "#25D366");
  const [scene, setScene] = useState(agent?.scene || "escritorio_zai");

  // Personalidade Sliders (0 - 100)
  const [formalidade, setFormalidade] = useState(65);
  const [energia, setEnergia] = useState(80);
  const [humor, setHumor] = useState(50);
  const [objetividade, setObjetividade] = useState(85);
  const [empatia, setEmpatia] = useState(90);
  const [proatividade, setProatividade] = useState(85);

  // Comportamento
  const [autonomia, setAutonomia] = useState<"assistida" | "hibrida" | "total">("hibrida");
  const [exigirConfirmacao, setExigirConfirmacao] = useState(true);
  const [delayResposta, setDelayResposta] = useState(12);

  // Atendimento
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("18:00");
  const [encaminharHumano, setEncaminharHumano] = useState(true);

  // Permissões
  const [permissoes, setPermissoes] = useState({
    consultarCatalogo: true,
    informarPrecos: true,
    gerarOrcamento: true,
    concederDesconto: false,
    confirmarPedidos: true,
    dispararCampanhas: false,
  });

  // Memória
  const [memoriaCliente, setMemoriaCliente] = useState(true);
  const [memoriaEmpresa, setMemoriaEmpresa] = useState(true);
  const [memoriaOperacional, setMemoriaOperacional] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name || "Camila");
      setRole(agent.sector || agent.role || "Assistente de Vendas");
      if (agent.avatar) setAvatar(agent.avatar);
      if (agent.themeColor) setThemeColor(agent.themeColor);
    }
  }, [agent]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updated = {
        ...(agent || {}),
        name,
        sector: role,
        avatar,
        themeColor,
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
        schedule: {
          horarioInicio,
          horarioFim,
          encaminharHumano,
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
        description: `As diretrizes de ${name} foram atualizadas e entraram em vigor imediatamente.`,
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
    { id: "identidade", label: "Identidade", icon: User },
    { id: "personalidade", label: "Personalidade", icon: Sliders },
    { id: "comportamento", label: "Comportamento", icon: Cpu },
    { id: "atendimento", label: "Atendimento", icon: Clock },
    { id: "permissoes", label: "Permissões", icon: ShieldCheck },
    { id: "memoria", label: "Memória", icon: Brain },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] p-0 overflow-hidden bg-[#090e17] border-emerald-500/40 text-foreground shadow-2xl">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-border/60 bg-[#0c1420]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl overflow-hidden border border-emerald-500/50 bg-black shrink-0">
              <img src={avatar} alt={name} className="h-full w-full object-cover" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Customizar Agente — {name}
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  Zero Code
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Personalize identidade, personalidade, autonomia e limites operacionais sem programar.
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
                  "flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap",
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

        {/* TAB CONTENTS */}
        <div className="p-6 max-h-[460px] overflow-y-auto space-y-5">
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
                <Label className="text-xs font-semibold">Cenário de Atuação</Label>
                <Select value={scene} onValueChange={setScene}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o cenário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escritorio_zai">Escritório ZAI (High-Tech)</SelectItem>
                    <SelectItem value="balcao_loja">Balcão da Loja / Depósito</SelectItem>
                    <SelectItem value="showroom">Showroom Comercial</SelectItem>
                    <SelectItem value="corporate">Sala Executiva B2B</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Avatar Selecionado</Label>
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

          {/* TAB 2: PERSONALIDADE */}
          {activeTab === "personalidade" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Ajuste os sliders para definir como o agente se expressa. O sistema formata as instruções neurais automaticamente.
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

          {/* TAB 3: COMPORTAMENTO */}
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
                  Simula digitação humana para evitar que o cliente perceba respostas instantâneas robóticas.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ATENDIMENTO */}
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

          {/* TAB 5: PERMISSÕES */}
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

          {/* TAB 6: MEMÓRIA */}
          {activeTab === "memoria" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-border/60 bg-[#0c1420]/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Memória do Cliente (Per-Contact)</div>
                  <div className="text-[11px] text-muted-foreground">
                    Recorda preferências individuais, formas de pagamento favoritas e histórico de obras.
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
