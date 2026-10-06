import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Bot,
  Send,
  RefreshCw,
  Cpu,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Trash2,
  Clock,
  Layers,
  Wand2,
  Flame,
  Target,
  Heart,
  Smile,
  ShieldCheck,
  Sliders,
  Settings2,
  ChevronDown,
  ChevronUp,
  Zap,
  Compass,
  BookOpen,
  HelpCircle,
  Brain,
  ArrowRight,
  ArrowLeft,
  ChevronsUpDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiService, requestApiEndpoint, type AIConnectionTestResult } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { AICharacterViewer, type AgentRuntimeState } from "@/components/evolution/AICharacterViewer";
import { AgentWorkspace } from "@/components/ai/workspace/AgentWorkspace";
import { cn } from "@/core/lib/utils";

const PROMPT_TEMPLATES = [
  {
    title: "Vendas & Conversão",
    desc: "Focado em entender a necessidade, tirar dúvidas e levar ao fechamento rápido.",
    prompt:
      "Você é o especialista de vendas e consultoria da nossa loja. Seu objetivo é entender com gentileza a necessidade do cliente, esclarecer dúvidas com clareza e conduzir naturalmente para a compra ou orçamento. Seja objetivo, amigável e use emojis com moderação.",
  },
  {
    title: "Suporte & Atendimento Humanizado",
    desc: "Focado em acolhimento, resolução de problemas e respostas empáticas.",
    prompt:
      "Você é o atendente de suporte ao cliente. Seu papel é acolher o cliente, compreender o problema informado, oferecer soluções práticas e claras passo a passo. Priorize a empatia e confirme se o problema foi resolvido antes de encerrar.",
  },
  {
    title: "Agendamentos & Consultoria",
    desc: "Focado em coletar dados, verificar horários disponíveis e confirmar compromissos.",
    prompt:
      "Você é o assistente de agendamentos e recepção. Apresente os serviços disponíveis, solicite o nome completo, serviço desejado e melhor período para atendimento. Confirme os dados antes de finalizar o agendamento.",
  },
];

const OBJECTIVES = [
  {
    id: "fechamento",
    title: "Fechamento Imediato",
    icon: Target,
    desc: "Prioriza conversão direta, cálculo de parcelas e envio de chave Pix ou link.",
    badge: "Alta Conversão",
  },
  {
    id: "suporte",
    title: "Suporte Humanizado",
    icon: Heart,
    desc: "Acolhimento empático, tira dúvidas sem pressionar e confirma resolução.",
    badge: "Satisfação CSAT",
  },
  {
    id: "qualificacao",
    title: "Qualificação de Lead",
    icon: Zap,
    desc: "Identifica segmento, porte e necessidade antes de apresentar preços.",
    badge: "Filtro Assertivo",
  },
  {
    id: "agendamento",
    title: "Agendamento & Visitas",
    icon: Clock,
    desc: "Coleta nome, horário de preferência e confirma visita técnica ou reunião.",
    badge: "Reuniões",
  },
];

const TONE_OPTIONS = [
  { id: "friendly", label: "Amigável & Caloroso", desc: "Tom acolhedor e próximo com uso moderado de emojis" },
  { id: "professional", label: "Profissional & Direto", desc: "Claro, objetivo e corporativo sem enrolação" },
  { id: "consultative", label: "Consultivo & Especialista", desc: "Explica opções, orienta e tira dúvidas a fundo" },
  { id: "casual", label: "Descontraído & Ágil", desc: "Linguagem simples, moderna e respostas rápidas" },
];

const PROVIDER_OPTIONS = [
  { id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"] },
  { id: "groq", name: "Groq (Ultra Rápido)", defaultModel: "llama-3.3-70b-versatile", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"] },
  { id: "deepseek", name: "DeepSeek", defaultModel: "deepseek-chat", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "claude", name: "Claude (Anthropic)", defaultModel: "claude-3-5-sonnet-latest", models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"] },
  { id: "gemini", name: "Google Gemini", defaultModel: "gemini-2.0-flash", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "ollama", name: "Ollama (Servidor Local)", defaultModel: "llama3.1", models: ["llama3.1", "mistral", "qwen2.5"] },
];

const QUICK_TEST_PROMPTS = [
  "Vocês aceitam Pix ou parcelam no cartão?",
  "Qual é o prazo de entrega para meu CEP?",
  "Achei o valor um pouco alto, tem desconto?",
  "Como funciona a garantia do produto?",
];

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  metadata?: {
    responseTimeMs?: number;
    tokens?: number;
    model?: string;
    ruleApplied?: string;
    confidenceScore?: number;
  };
}

interface AgentTabProps {
  onOpenVoiceStudio?: () => void;
  selectedAgentKey?: string;
  onSelectAgent?: (key: string) => void;
  onOpenCustomizer?: (agent?: any) => void;
  agents?: any[];
  onRefreshAgents?: () => Promise<void>;
  aiEnabled?: boolean;
  onToggleAI?: (enabled: boolean) => void;
}

export function AgentTab({
  onOpenVoiceStudio,
  selectedAgentKey = "",
  onSelectAgent,
  onOpenCustomizer,
  agents,
  onRefreshAgents,
  aiEnabled = true,
  onToggleAI,
}: AgentTabProps) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode switcher: "complete" (Todas as abas configuráveis) vs "steps" (Passo a passo guiado)
  const [viewMode, setViewMode] = useState<"complete" | "steps">("complete");
  const [activeStep, setActiveStep] = useState<number>(1);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({
    workspace: false,
    objective: false,
    tone: false,
    prompt: false,
    providers: false,
    sandbox: false,
  });

  const toggleCard = (cardKey: string) => {
    setCollapsedCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  const toggleAllCards = () => {
    const allCollapsed = Object.values(collapsedCards).every(Boolean);
    const nextVal = !allCollapsed;
    setCollapsedCards({
      workspace: nextVal,
      objective: nextVal,
      tone: nextVal,
      prompt: nextVal,
      providers: nextVal,
      sandbox: nextVal,
    });
  };

  // Character viewer mode (sync with selectedAgentKey: ONLY zaibot is robot mascot, all others are human characters)
  const [characterMode, setCharacterMode] = useState<"camila" | "zaibot">(
    selectedAgentKey === "zaibot" ? "zaibot" : "camila"
  );

  // Runtime State Machine
  const [runtimeState, setRuntimeState] = useState<AgentRuntimeState>(
    aiEnabled ? "online" : "offline"
  );

  useEffect(() => {
    if (!aiEnabled) {
      setRuntimeState("offline");
    } else {
      setRuntimeState((prev) => (prev === "offline" ? "online" : prev));
    }
  }, [aiEnabled]);

  useEffect(() => {
    if (selectedAgentKey === "zaibot") {
      setCharacterMode("zaibot");
    } else {
      setCharacterMode("camila");
    }
  }, [selectedAgentKey]);

  // Agent configuration
  const [agentName, setAgentName] = useState("Atendente");
  const [agentRole, setAgentRole] = useState("");
  const [agentTone, setAgentTone] = useState("friendly");
  const [responseStyle, setResponseStyle] = useState("short_natural");
  const [selectedObjective, setSelectedObjective] = useState<string>("fechamento");
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATES[0].prompt);
  const [temperature, setTemperature] = useState(0.7);
  const [responseDelay, setResponseDelay] = useState(2);


  // Section toggle: Advanced Provider Config (auto-opens when ?sub=providers)
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(
    searchParams.get("sub") === "providers"
  );

  useEffect(() => {
    if (searchParams.get("sub") === "providers") {
      setShowAdvancedConfig(true);
    }
  }, [searchParams]);

  // Provider configuration
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Digital Team & Modals State
  const [agentsList, setAgentsList] = useState<any[]>(agents || []);
  useEffect(() => { if (agents) setAgentsList(agents); }, [agents]);
  const [showCharacterViewer, setShowCharacterViewer] = useState(true);

  const refreshAgents = async () => {
    if (onRefreshAgents) return onRefreshAgents();
    try {
      const res = await apiService.getAIAgents();
      const list = (res as any)?.agents || (res as any)?.data?.agents || (Array.isArray(res) ? res : []);
      if (Array.isArray(list)) {
        setAgentsList(list);
      }
    } catch (error) {
      toast({ title: "Falha ao atualizar atendentes", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  };

  // Sandbox / Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<AIConnectionTestResult | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const testVersion = useRef(0);
  const selectedKeyRef = useRef(selectedAgentKey);
  selectedKeyRef.current = selectedAgentKey;
  useEffect(() => {
    testVersion.current += 1;
    setChatMessages([]);
    setInputMessage("");
    setIsSending(false);
    setRuntimeState(aiEnabled ? "online" : "offline");
  }, [selectedAgentKey, aiEnabled]);

  // Sync state when agent changes
  useEffect(() => {
    const found = agentsList.find((a) => (a.key || a.id) === selectedAgentKey);
    if (found) {
      setAgentName(found.name || "Atendente");
      setAgentRole(found.role || found.sector || "");
      setPrompt(found.personality || found.prompt || "");
      setAgentTone(found.tone || "professional");
      setResponseStyle(found.responseStyle || "short_natural");
      setTemperature(found.temperature ?? 0.7);
      setSelectedObjective(found.objective || "fechamento");
      setResponseDelay((found.delayProfile?.minMs ?? 12000) / 1000);
    } else {
      setAgentName("Atendente");
      setAgentRole("");
      setPrompt("");
    }
  }, [selectedAgentKey, agentsList]);

  // Load initial configurations
  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const [promptRes, providersRes] = await Promise.all([
          apiService.getAIPrompt().catch(() => ({ success: false, prompt: "" })),
          apiService.getAIProviders().catch(() => ({ success: false, providers: [] })),
        ]);

        if (!mounted) return;

        if (!selectedAgentKey && promptRes?.prompt) {
          setPrompt(promptRes.prompt);
        }

        if (providersRes?.providers && providersRes.providers.length > 0) {
          const activeProv = providersRes.providers.find((p: any) => p.enabled ?? p.active) || providersRes.providers[0];
          if (activeProv) {
            setSelectedProvider(activeProv.provider || activeProv.id || "openai");
            setSelectedModel(activeProv.model || "gpt-4o-mini");
            setApiKey("");
          }
        }
      } catch (err) {
        console.error("[AgentTab] Error loading agent configuration:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadConfig();
    return () => {
      mounted = false;
    };
  }, [selectedAgentKey]);

  useEffect(() => {
    if (agents) return;
    let mounted = true;
    apiService.getAIAgents().then(result => { if (mounted) setAgentsList(result.agents || []); }).catch(error => {
      if (mounted) toast({ title: "Falha ao carregar atendentes", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    });
    return () => { mounted = false; };
  }, [agents, toast]);

  // Update model choices when provider changes
  const currentProviderDef = PROVIDER_OPTIONS.find((p) => p.id === selectedProvider) || PROVIDER_OPTIONS[0];

  const handleProviderChange = (newProviderId: string) => {
    setSelectedProvider(newProviderId);
    const def = PROVIDER_OPTIONS.find((p) => p.id === newProviderId);
    if (def) {
      setSelectedModel(def.defaultModel);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save the selected attendant using its canonical configuration fields.
      if (selectedAgentKey) {
        const saved = await apiService.updateAIAgent(selectedAgentKey, {
          name: agentName,
          role: agentRole,
          prompt,
          personality: prompt,
          tone: agentTone,
          responseStyle,
          temperature,
          delayProfile: { minMs: responseDelay * 1000, maxMs: responseDelay * 1000 },
          objective: selectedObjective,
        });
        if (saved.success === false) throw new Error("Não foi possível salvar o atendente.");
      }

      // 3. Save Provider config if api key provided
      if (apiKey) {
        const saved = await apiService.saveUserProvider({ provider: selectedProvider, api_key: apiKey, model: selectedModel, enabled: true });
        if (saved.success === false) throw new Error("A configuração do provedor não foi salva.");
        setApiKey("");
      }

      toast({
        title: selectedAgentKey ? "Agente salvo com sucesso!" : "Provedor salvo",
        description: selectedAgentKey ? "As instruções e parâmetros do atendente foram atualizados." : "A chave e o modelo do provedor foram salvos.",
      });
      await refreshAgents();
    } catch (err: any) {
      toast({
        title: "Erro ao salvar agente",
        description: err?.message || "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending || !selectedAgentKey) return;

    const userMsg: ChatMessage = {
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsSending(true);
    setRuntimeState("thinking");

    const startTime = Date.now();
    const version = ++testVersion.current;
    const agentKey = selectedAgentKey;
    try {
      const activeObjDef = OBJECTIVES.find((o) => o.id === selectedObjective);
      const enhancedPrompt = `${prompt}
\n[DIRETRIZES DE PERSONALIDADE]
Objetivo Atual: ${activeObjDef?.title || "Vendas"} (${activeObjDef?.desc || ""})
Tom: ${agentTone}. Estilo: ${responseStyle}.`;

      setRuntimeState("working");
      const response = await apiService.testAIMessage({
        message: text,
        prompt: enhancedPrompt,
        model: selectedModel,
        providerId: selectedProvider,
        agentKey: selectedAgentKey,
        sessionId: agentsList.find(agent => (agent.key || agent.id) === selectedAgentKey)?.sessionIds?.[0],
        temperature,
        responseStyle,
      });
      if (version !== testVersion.current || agentKey !== selectedKeyRef.current) return;
      const res = response.result;
      if (response.success === false || !res?.ok || !res.response) throw new Error(response.error || res?.error || "O teste não retornou uma resposta.");

      const responseTimeMs = Date.now() - startTime;
      const replyText =
        res.response;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        metadata: {
          responseTimeMs: res.responseTimeMs || responseTimeMs,
          tokens: res.totalTokens,
          model: res.model || selectedModel,
          ruleApplied: res.rulesTriggered,
        },
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
      setRuntimeState(aiEnabled ? "online" : "offline");
    } catch (err: any) {
      if (version !== testVersion.current || agentKey !== selectedKeyRef.current) return;
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Erro ao testar agente: ${err?.message || "Falha na comunicação com o provedor."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setRuntimeState("error");
    } finally {
      if (version === testVersion.current) setIsSending(false);
    }
  };

  const handleTestConnection = async () => {
    if (apiKey.trim()) {
      toast({ title: "Salve a chave antes de testar", description: "O teste usa a configuração já salva do provedor.", variant: "destructive" });
      return;
    }
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const response = await apiService.testAIMessage({
        message: "Teste de conexão e integridade da API ZAI.",
        prompt: "Responda apenas: CONEXÃO BEM-SUCEDIDA.",
        model: selectedModel,
        providerId: selectedProvider,
      });
      const res = response.result;
      if (!res) throw new Error(response.error || "O teste não retornou dados.");
      setConnectionTestResult(res);
      if (res.ok) {
        toast({
          title: "Conexão Validada!",
          description: `Provedor ${selectedProvider} respondeu em ${res.responseTimeMs || 0}ms.`,
        });
      } else {
        toast({
          title: "Falha na Conexão",
          description: res.error || "O provedor não retornou resposta com sucesso.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro no teste",
        description: err?.message || "Não foi possível testar a conexão com o provedor.",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Compute active agent object for the Living Workspace
  const activeWorkspaceAgent = React.useMemo(() => {
    if (selectedAgentKey === "zaibot" || characterMode === "zaibot") {
      return {
        key: "zaibot",
        name: "ZAIBOT",
        role: "Assistente Operacional ZAI",
        isPlatformAssistant: true,
        active: aiEnabled,
      };
    }
    const found = agentsList.find((a) => (a.key || a.id) === selectedAgentKey);
    if (found) {
      return {
        ...found,
        active: found.active !== false && aiEnabled,
        name: agentName || found.name,
        role: agentRole || found.role,
        prompt: prompt || found.prompt,
        tone: agentTone || found.tone,
        objective: selectedObjective || found.objective,
      };
    }
    return {
      key: selectedAgentKey,
      name: agentName || "Atendente",
      role: agentRole,
      active: false,
      prompt,
      tone: agentTone,
      objective: selectedObjective,
    };
  }, [selectedAgentKey, characterMode, agentsList, aiEnabled, agentName, agentRole, prompt, agentTone, selectedObjective]);

  const handleSlashCommand = (cmd: string) => {
    if (cmd === "/goal") {
      if (viewMode === "steps") setActiveStep(2);
      setCollapsedCards((prev) => ({ ...prev, objective: false }));
      toast({ title: "Comando /goal", description: "Configuração de objetivos estratégicos em foco." });
    } else if (cmd === "/browser") {
      navigate("/ai?tab=evolution");
    } else if (cmd === "/plan") {
      if (viewMode === "steps") setActiveStep(3);
      setCollapsedCards((prev) => ({ ...prev, prompt: false }));
      toast({ title: "Comando /plan", description: "Instruções e templates em foco." });
    } else if (cmd === "/grill-me") {
      if (viewMode === "steps") setActiveStep(5);
      setCollapsedCards((prev) => ({ ...prev, sandbox: false }));
      void handleSendMessage("Tenho urgência no pedido e achei o preço alto, o que você pode fazer?");
    } else if (cmd === "/learn") {
      navigate("/ai?tab=evolution");
    } else if (cmd === "/boost") {
      if (viewMode === "steps") setActiveStep(4);
      setShowAdvancedConfig(true);
      setCollapsedCards((prev) => ({ ...prev, providers: false }));
      toast({ title: "Comando /boost", description: "Parâmetros técnicos e provedores em foco." });
    }
  };

  const currentObjectiveDef = OBJECTIVES.find((o) => o.id === selectedObjective) || OBJECTIVES[0];
  const currentToneDef = TONE_OPTIONS.find((t) => t.id === agentTone) || TONE_OPTIONS[0];

  /* -------------------------------------------------------------
     RENDER SUB-SECTIONS (REUSABLE IN BOTH MODES)
  ------------------------------------------------------------- */
  const renderWorkspaceSection = () => (
    <Card className="bg-card border-border/80 shadow-md overflow-hidden animate-in fade-in duration-200">
      <div className="p-3 border-b border-border/40 flex items-center justify-between bg-muted/10">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold text-foreground">Ambiente Virtual & Atendente 3D ({activeWorkspaceAgent.name})</span>
          <Badge variant="outline" className={cn("text-[10px] py-0", aiEnabled ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground")}>
            {aiEnabled ? "Online" : "Pausado"}
          </Badge>
        </div>
        {viewMode === "complete" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => toggleCard("workspace")}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsedCards.workspace && "rotate-180")} />
          </Button>
        )}
      </div>

      {!collapsedCards.workspace && (
        <AgentWorkspace
          agent={activeWorkspaceAgent}
          isOnline={aiEnabled ?? true}
          onToggleOnline={onToggleAI}
          runtimeState={runtimeState as any}
          onRuntimeStateChange={(st) => setRuntimeState(st as AgentRuntimeState)}
          agentMode={characterMode}
          onToggleMode={(mode) => {
            setCharacterMode(mode);
            onSelectAgent?.(mode);
          }}
          onOpenCustomizer={() => onOpenCustomizer?.(activeWorkspaceAgent)}
        />
      )}
    </Card>
  );

  const renderAttendantSelector = () => (
    <Card className="border-border/80">
      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
        <label htmlFor="ai-config-agent" className="text-sm font-semibold">Atendente das configurações</label>
        <select
          id="ai-config-agent"
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedAgentKey}
          onChange={(event) => onSelectAgent?.(event.target.value)}
          disabled={!agentsList.length}
        >
          {!agentsList.length && <option value="">Nenhum atendente cadastrado</option>}
          {agentsList
            .filter((agent) => !agent.isPlatformAssistant && agent.key !== "zaibot")
            .map((agent) => (
              <option key={agent.key || agent.id} value={agent.key || agent.id}>
                {agent.name} · {agent.role || "Atendimento"}
              </option>
            ))}
        </select>
        <Button
          variant="outline"
          disabled={!selectedAgentKey}
          onClick={() => onOpenCustomizer?.(agentsList.find((agent) => (agent.key || agent.id) === selectedAgentKey))}
        >
          Editar instruções
        </Button>
      </CardContent>
    </Card>
  );

  const renderObjectiveCard = () => (
    <Card className="bg-card border-border/80 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Target className="h-5 w-5 text-emerald-400" /> Objetivo Central de Atendimento
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Define o foco de conversão e a postura que a IA assumirá em cada conversa.
            </CardDescription>
          </div>
          {viewMode === "complete" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleCard("objective")}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsedCards.objective && "rotate-180")} />
            </Button>
          )}
        </div>
      </CardHeader>

      {viewMode === "complete" && collapsedCards.objective ? (
        <div className="p-3 bg-muted/10 flex items-center justify-between text-xs animate-fade-in">
          <span className="text-muted-foreground">Objetivo ativo:</span>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
            {currentObjectiveDef.title} ({currentObjectiveDef.badge})
          </Badge>
        </div>
      ) : (
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OBJECTIVES.map((obj) => {
              const Icon = obj.icon;
              const isSelected = selectedObjective === obj.id;
              return (
                <div
                  key={obj.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedObjective(obj.id);
                    toast({ title: `Objetivo "${obj.title}" ativado.` });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedObjective(obj.id);
                    }
                  }}
                  className={cn(
                    "p-3 rounded-xl border text-left cursor-pointer transition-all space-y-1.5",
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/30"
                      : "bg-muted/20 border-border/60 hover:bg-muted/40 hover:border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center",
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {obj.title}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1.5 py-0",
                        isSelected
                          ? "border-emerald-500/40 text-emerald-300"
                          : "border-border/70 text-muted-foreground"
                      )}
                    >
                      {obj.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {obj.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );

  const renderToneCard = () => (
    <Card className="bg-card border-border/80 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Sliders className="h-5 w-5 text-emerald-400" /> Tom de Atendimento
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Escolha a linguagem usada nas respostas do atendente.
            </CardDescription>
          </div>
          {viewMode === "complete" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleCard("tone")}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsedCards.tone && "rotate-180")} />
            </Button>
          )}
        </div>
      </CardHeader>

      {viewMode === "complete" && collapsedCards.tone ? (
        <div className="p-3 bg-muted/10 flex items-center justify-between text-xs animate-fade-in">
          <span className="text-muted-foreground">Tom de voz ativo:</span>
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
            {currentToneDef.label}
          </Badge>
        </div>
      ) : (
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-foreground">Tom de Voz Principal</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONE_OPTIONS.map((t) => {
                const isSelected = agentTone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAgentTone(t.id)}
                    className={cn(
                      "p-2.5 rounded-xl text-left border text-xs transition-all",
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold shadow-xs"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <span className="block font-medium truncate">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground/80 line-clamp-1 mt-0.5">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );

  const renderPromptCard = () => (
    <Card className="bg-card border-border/80 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-emerald-400" /> Instruções do Atendente (Prompt)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Descreva as diretrizes, produtos, regras e limites do atendente.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Modelos Prontos */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">Templates:</span>
              {PROMPT_TEMPLATES.map((tmpl, idx) => (
                <Button
                  key={idx}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPrompt(tmpl.prompt);
                    toast({ title: `Modelo "${tmpl.title}" aplicado.` });
                  }}
                  className="h-7 px-2 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                >
                  <Wand2 className="h-3 w-3 mr-1" /> {tmpl.title.split(" ")[0]}
                </Button>
              ))}
            </div>

            {viewMode === "complete" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toggleCard("prompt")}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground ml-1"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsedCards.prompt && "rotate-180")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {viewMode === "complete" && collapsedCards.prompt ? (
        <div className="p-3 bg-muted/10 flex items-center justify-between text-xs animate-fade-in">
          <span className="text-muted-foreground font-mono truncate max-w-[280px]">
            {prompt ? `"${prompt.slice(0, 70)}..."` : "Nenhuma instrução salva."}
          </span>
          <Badge variant="outline" className="text-[10px]">{prompt.length} caracteres</Badge>
        </div>
      ) : (
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="Exemplo: Você é o atendente da Loja XPTO. Seja educado, consulte nossa tabela de preços e encerre agendando uma conversa."
              className="text-xs leading-relaxed font-mono bg-muted/20 border-border/70 resize-y"
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
              <span>{prompt.length} caracteres</span>
              <span>Dica: seja específico quanto a preços, formas de pagamento e limites do que responder.</span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );

  const renderProvidersCard = () => (
    <Card className="bg-card border-border/80 shadow-sm">
      <CardHeader
        className="pb-3 border-b border-border/40 cursor-pointer select-none"
        onClick={() => {
          if (viewMode === "complete") {
            toggleCard("providers");
          } else {
            setShowAdvancedConfig((prev) => !prev);
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Cpu className="h-5 w-5 text-emerald-400" /> Provedor de IA & Configuração Técnica
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              OpenAI, Groq, DeepSeek, Claude, Gemini, Ollama e parâmetros de inferência.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground"
          >
            {viewMode === "complete" ? (
              <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsedCards.providers && "rotate-180")} />
            ) : showAdvancedConfig ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {viewMode === "complete" && collapsedCards.providers ? (
        <div className="p-3 bg-muted/10 flex items-center justify-between text-xs animate-fade-in">
          <span className="text-muted-foreground">Provedor & Modelo:</span>
          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px]">
            {currentProviderDef.name} ({selectedModel})
          </Badge>
        </div>
      ) : (showAdvancedConfig || viewMode === "steps" || !collapsedCards.providers) ? (
        <CardContent className="p-4 sm:p-5 space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Provedor de Inteligência</label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Modelo de Linguagem</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {currentProviderDef.models.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-muted-foreground" /> Chave de API ({currentProviderDef.name})
              </label>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showApiKey ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Insira sua chave ${currentProviderDef.name} (ex: sk-...)`}
                className="h-9 text-xs font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="h-9 text-xs shrink-0 gap-1.5 border-border/70"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isTestingConnection && "animate-spin")} />
                {isTestingConnection ? "Testando..." : "Validar"}
              </Button>
            </div>
            {connectionTestResult && (
              <div
                className={cn(
                  "text-xs p-2.5 rounded-lg flex items-center gap-2",
                  connectionTestResult.ok
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-destructive/10 text-destructive border border-destructive/30"
                )}
              >
                {connectionTestResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {connectionTestResult.ok
                    ? `Conexão bem-sucedida! Latência: ${connectionTestResult.responseTimeMs || 0}ms.`
                    : connectionTestResult.error || "Falha na autenticação com o provedor."}
                </span>
              </div>
            )}
          </div>

          {/* Sliders de Temperatura & Delay */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/30">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Criatividade (Temperatura)</span>
                <span className="text-muted-foreground">{temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[temperature]}
                min={0.1}
                max={1.0}
                step={0.1}
                onValueChange={(val) => setTemperature(val[0])}
                className="py-1"
              />
              <span className="text-[10px] text-muted-foreground block">
                Menor = mais assertivo; maior = mais criativo.
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Delay de Digitação Humana</span>
                <span className="text-muted-foreground">{responseDelay}s</span>
              </div>
              <Slider
                value={[responseDelay]}
                min={1}
                max={6}
                step={1}
                onValueChange={(val) => setResponseDelay(val[0])}
                className="py-1"
              />
              <span className="text-[10px] text-muted-foreground block">
                Simula o tempo em que uma pessoa real digitaria.
              </span>
            </div>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );

  const renderSandboxSimulator = () => (
    <Card className="bg-card border-border/80 shadow-md flex flex-col h-[700px] overflow-hidden">
      {/* Header do Sandbox */}
      <CardHeader className="p-3.5 border-b border-border/40 bg-muted/10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xs font-bold text-foreground">
                Sandbox de Atendimento & Testes
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground">
                Testando com as regras de {agentName}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChatMessages([])}
              title="Limpar conversa"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {viewMode === "complete" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toggleCard("sandbox")}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsedCards.sandbox && "rotate-180")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {viewMode === "complete" && collapsedCards.sandbox ? (
        <div className="p-4 flex-1 flex flex-col items-center justify-center text-center text-xs text-muted-foreground space-y-2">
          <Bot className="h-8 w-8 text-emerald-400/50" />
          <p>{chatMessages.length} mensagens trocadas neste teste.</p>
          <Button variant="outline" size="sm" onClick={() => toggleCard("sandbox")} className="text-xs">
            Abrir Sandbox
          </Button>
        </div>
      ) : (
        <>
          {/* Quick Test Chips */}
          <div className="p-2 border-b border-border/30 bg-muted/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            <span className="text-[10px] text-muted-foreground shrink-0 font-medium pl-1">Exemplos:</span>
            {QUICK_TEST_PROMPTS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(q)}
                disabled={isSending || !selectedAgentKey}
                className="px-2 py-0.5 rounded-full text-[10px] bg-muted/40 hover:bg-emerald-500/15 text-muted-foreground hover:text-emerald-300 border border-border/60 shrink-0 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Mensagens do Chat */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs scrollbar-thin">
            {chatMessages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div key={index} className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed shadow-xs",
                      isUser
                        ? "bg-emerald-500 text-white rounded-tr-xs"
                        : "bg-muted/50 text-foreground border border-border/40 rounded-tl-xs"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1 px-1 text-[10px] text-muted-foreground">
                    <span>{msg.timestamp}</span>

                    {!isUser && msg.metadata?.ruleApplied && (
                      <Badge
                        variant="outline"
                        className="text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-400 font-normal"
                      >
                        {msg.metadata.ruleApplied}
                      </Badge>
                    )}

                    {!isUser && msg.metadata?.confidenceScore && (
                      <Badge
                        variant="outline"
                        className="text-[9px] py-0 px-1 border-border/60 text-muted-foreground font-normal"
                      >
                        {msg.metadata.confidenceScore}% Confiança
                      </Badge>
                    )}

                    {msg.metadata?.responseTimeMs && (
                      <span className="text-emerald-400 font-medium">
                        {msg.metadata.responseTimeMs}ms
                      </span>
                    )}

                    {msg.metadata?.tokens && (
                      <span>{msg.metadata.tokens} tok</span>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 text-muted-foreground max-w-[60%]">
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                <span className="text-[11px] animate-pulse">{agentName} digitando...</span>
              </div>
            )}
          </div>

          {/* Input do Sandbox */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 border-t border-border/40 bg-muted/10 shrink-0"
          >
            <div className="flex items-center gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Digite como se fosse um cliente..."
                disabled={isSending}
                className="h-9 text-xs bg-background"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSending || !selectedAgentKey || !inputMessage.trim()}
                className="h-9 w-9 p-0 bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>Modelo: {selectedModel}</span>
              <span>Provedor: {selectedProvider}</span>
            </div>
          </form>
        </>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* TOP ACTION & MODE CONTROL BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/80 bg-card shadow-sm">
        {/* Quick Slash Commands Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">Ações Rápidas:</span>
          {[
            { cmd: "/goal", label: "/goal", icon: Target, desc: "Objetivo Central" },
            { cmd: "/browser", label: "/browser", icon: Compass, desc: "Grafo de Memórias" },
            { cmd: "/plan", label: "/plan", icon: BookOpen, desc: "Prompt & Templates" },
            { cmd: "/grill-me", label: "/grill-me", icon: HelpCircle, desc: "Sabatinar IA" },
            { cmd: "/learn", label: "/learn", icon: Brain, desc: "Aprender do Histórico" },
            { cmd: "/boost", label: "/boost", icon: Zap, desc: "Turbinar Provedor" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.cmd}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSlashCommand(action.cmd)}
                className="h-8 px-2.5 text-xs gap-1.5 rounded-xl border-border/70 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-300 shrink-0 font-mono transition-colors"
                title={action.desc}
              >
                <Icon className="h-3.5 w-3.5 text-emerald-400" />
                <span>{action.label}</span>
              </Button>
            );
          })}
        </div>

        {/* View Mode & Card Collapsing Toggle */}
        <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
          {viewMode === "complete" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllCards}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              <span>{Object.values(collapsedCards).every(Boolean) ? "Expandir Todos" : "Recolher Todos"}</span>
            </Button>
          )}

          <div className="flex items-center p-1 bg-muted/40 border border-border/60 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setViewMode("complete")}
              className={cn(
                "px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5",
                viewMode === "complete"
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Modo Completo</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("steps")}
              className={cn(
                "px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5",
                viewMode === "steps"
                  ? "bg-background text-emerald-400 shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Modo Guiado (Steps)</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODO GUIADO (STEPS WIZARD)
      ========================================================================= */}
      {viewMode === "steps" ? (
        <div className="space-y-6">
          {/* Stepper Progress Bar */}
          <div className="p-3 rounded-2xl bg-card border border-border/80 shadow-xs flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
            {[
              { step: 1, title: "Avatar 3D & Atendente", desc: "Ambiente do funcionário", icon: Bot },
              { step: 2, title: "Objetivo & Tom", desc: "Meta comercial e postura", icon: Target },
              { step: 3, title: "Prompt & Templates", desc: "Instruções oficiais", icon: Sparkles },
              { step: 4, title: "Provedor & IA", desc: "OpenAI, Groq e modelo", icon: Cpu },
              { step: 5, title: "Sandbox de Testes", desc: "Simulação de conversas", icon: Send },
            ].map((s) => {
              const Icon = s.icon;
              const isCurrent = activeStep === s.step;
              const isDone = activeStep > s.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setActiveStep(s.step)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 select-none text-left flex-1 min-w-[140px]",
                    isCurrent
                      ? "bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 shadow-xs ring-1 ring-emerald-500/30"
                      : isDone
                      ? "bg-muted/40 border border-emerald-500/30 text-emerald-400"
                      : "bg-muted/10 border border-border/60 text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  <div
                    className={cn(
                      "h-6 w-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                      isCurrent
                        ? "bg-emerald-500 text-white"
                        : isDone
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.step}
                  </div>
                  <div className="truncate">
                    <span className="block leading-tight truncate">{s.title}</span>
                    <span className="text-[10px] text-muted-foreground font-normal line-clamp-1">{s.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Step Contents */}
          <div className="space-y-6">
            {activeStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                {renderWorkspaceSection()}
                {renderAttendantSelector()}
              </div>
            )}

            {activeStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                {renderObjectiveCard()}
                {renderToneCard()}
              </div>
            )}

            {activeStep === 3 && (
              <div className="space-y-6 animate-fade-in">
                {renderPromptCard()}
              </div>
            )}

            {activeStep === 4 && (
              <div className="space-y-6 animate-fade-in">
                {renderProvidersCard()}
              </div>
            )}

            {activeStep === 5 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
                <div className="lg:col-span-4 space-y-4">
                  <Card className="p-4 bg-card border-border/80 space-y-3">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" /> Resumo do Atendente
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nome:</span>
                        <span className="font-semibold text-foreground">{agentName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Objetivo:</span>
                        <span className="font-semibold text-foreground">{currentObjectiveDef.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tom de Voz:</span>
                        <span className="font-semibold text-foreground">{currentToneDef.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provedor:</span>
                        <span className="font-semibold text-foreground">{currentProviderDef.name} ({selectedModel})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Temperatura:</span>
                        <span className="font-semibold text-foreground">{temperature.toFixed(1)}</span>
                      </div>
                    </div>
                  </Card>
                </div>
                <div className="lg:col-span-8">
                  {renderSandboxSimulator()}
                </div>
              </div>
            )}
          </div>

          {/* Stepper Navigation Footer */}
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              disabled={activeStep === 1}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Passo Anterior
            </Button>
            <div className="flex items-center gap-2">
              {activeStep < 5 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActiveStep((prev) => Math.min(5, prev + 1))}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5 shadow-sm"
                >
                  Próximo Passo ({activeStep + 1}/5) <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5 shadow-sm"
                >
                  {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Concluir & Salvar Agente
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
            MODO COMPLETO (ALL CARDS COLLAPSIBLE & EDITABLE)
        ========================================================================= */
        <div className="space-y-6">
          {renderWorkspaceSection()}
          {renderAttendantSelector()}

          {/* TWO COLUMN WORKSPACE: CONFIGURATION & SIMULATOR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: AGENT & MODEL CONFIGURATION (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-6">
              {renderObjectiveCard()}
              {renderToneCard()}
              {renderPromptCard()}
              {renderProvidersCard()}

              {/* BOTÃO DE SALVAR */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || (!selectedAgentKey && !apiKey.trim())}
                  className="h-10 px-6 font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md gap-2"
                >
                  {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isSaving ? "Salvando Alterações..." : selectedAgentKey ? "Salvar Configurações do Agente" : "Salvar provedor"}
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: RICH INTERACTIVE SANDBOX SIMULATOR (5 cols on lg) */}
            <div className="lg:col-span-5 sticky top-4 space-y-4">
              {renderSandboxSimulator()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
