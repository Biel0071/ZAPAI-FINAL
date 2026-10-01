import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { apiService, type AIConnectionTestResult } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
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

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  metadata?: {
    responseTimeMs?: number;
    tokens?: number;
    model?: string;
  };
}

interface AgentTabProps {
  onOpenVoiceStudio?: () => void;
}

export function AgentTab({ onOpenVoiceStudio }: AgentTabProps) {
  const { toast } = useToast();

  // Agent configuration
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("default");
  const [agentName, setAgentName] = useState("Assistente ZAI");
  const [agentRole, setAgentRole] = useState("Vendedor e Consultor Especialista");
  const [agentTone, setAgentTone] = useState("friendly");
  const [responseStyle, setResponseStyle] = useState("short_natural");
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATES[0].prompt);
  const [temperature, setTemperature] = useState(0.7);
  const [responseDelay, setResponseDelay] = useState(2);

  // Provider configuration
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sandbox / Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Olá! Sou seu assistente virtual configurado. Como posso ajudar com sua dúvida ou pedido hoje?",
      timestamp: "Agora",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<AIConnectionTestResult | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Load initial configurations
  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const [agentsRes, promptRes, providersRes] = await Promise.all([
          apiService.getAIAgents().catch(() => ({ success: false, agents: [] })),
          apiService.getAIPrompt().catch(() => ({ success: false, prompt: "" })),
          apiService.getAIProviders().catch(() => ({ success: false, providers: [] })),
        ]);

        if (!mounted) return;

        if (agentsRes?.agents && agentsRes.agents.length > 0) {
          setAgents(agentsRes.agents);
          const firstAgent = agentsRes.agents[0];
          setSelectedAgentKey(firstAgent.key || firstAgent.id || "default");
          setAgentName(firstAgent.name || "Assistente ZAI");
          setAgentRole(firstAgent.role || "Especialista de Atendimento");
          if (firstAgent.prompt) setPrompt(firstAgent.prompt);
          if (firstAgent.tone) setAgentTone(firstAgent.tone);
        } else if (promptRes?.prompt) {
          setPrompt(promptRes.prompt);
        }

        if (providersRes?.providers && providersRes.providers.length > 0) {
          const activeProv = providersRes.providers.find((p: any) => p.active) || providersRes.providers[0];
          if (activeProv) {
            setSelectedProvider(activeProv.id || "openai");
            setSelectedModel(activeProv.model || "gpt-4o-mini");
            if (activeProv.apiKey) setApiKey(activeProv.apiKey);
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
  }, []);

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
      // 1. Save Prompt
      await apiService.saveAIPrompt(prompt);

      // 2. Save Agent if existing or create
      if (selectedAgentKey && selectedAgentKey !== "default") {
        await apiService.updateAIAgent(selectedAgentKey, {
          name: agentName,
          role: agentRole,
          prompt,
          tone: agentTone,
          responseStyle,
          temperature,
          delaySeconds: responseDelay,
          providerId: selectedProvider,
          model: selectedModel,
        }).catch(() => null);
      }

      // 3. Save Provider config if api key provided
      if (apiKey) {
        await apiService.saveAIProviders([
          {
            id: selectedProvider,
            name: currentProviderDef.name,
            apiKey,
            model: selectedModel,
            active: true,
          },
        ]).catch(() => null);
      }

      toast({
        title: "Agente salvo com sucesso!",
        description: "As instruções e parâmetros foram atualizados no cérebro da IA.",
      });
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

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsSending(true);

    const startTime = Date.now();
    try {
      const res = await apiService.testAIConnection({
        message: text,
        prompt: `${prompt}\n\nInstrução de Tom: ${agentTone}. Estilo de Resposta: ${responseStyle}.`,
        model: selectedModel,
        providerId: selectedProvider,
      });

      const responseTimeMs = Date.now() - startTime;
      const replyText =
        res.response ||
        (res.ok
          ? "Recebi sua mensagem e o fluxo da IA está operando perfeitamente."
          : `Não foi possível gerar a resposta: ${res.error || "Verifique a chave de API e o modelo."}`);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        metadata: {
          responseTimeMs: res.responseTimeMs || responseTimeMs,
          tokens: res.totalTokens,
          model: res.model || selectedModel,
        },
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Erro ao testar agente: ${err?.message || "Falha na comunicação com o provedor."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const res = await apiService.testAIConnection({
        message: "Teste de conexão e integridade da API ZAI.",
        prompt: "Responda apenas: CONEXÃO BEM-SUCEDIDA.",
        model: selectedModel,
        providerId: selectedProvider,
      });
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: AGENT & MODEL CONFIGURATION (7 cols on lg) */}
      <div className="lg:col-span-7 space-y-6">
        {/* Identidade do Agente */}
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Bot className="h-5 w-5 text-emerald-400" /> Identidade & Atendente Virtual
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Configure o nome, perfil profissional e tom de atendimento do seu robô.
                </CardDescription>
              </div>
              {onOpenVoiceStudio && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenVoiceStudio}
                  className="h-8 text-xs gap-1.5 border-border/70 hover:border-emerald-500/50"
                >
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" /> Voz do Agente
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Nome do Atendente</label>
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Ex: Sofia, Lucas, Atendente ZAI"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Cargo / Papel</label>
                <Input
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                  placeholder="Ex: Consultor Especialista de Vendas"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Tom de Voz */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Tom de Voz do Atendimento</label>
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
        </Card>

        {/* Cérebro & Instruções (Prompt) */}
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

              {/* Modelos Prontos */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
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
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="space-y-1.5">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={7}
                placeholder="Exemplo: Você é o atendente da Loja XPTO. Seja educado, consulte nossa tabela de preços e encerre agendando uma conversa."
                className="text-xs leading-relaxed font-mono bg-muted/20 border-border/70 resize-y"
              />
              <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
                <span>{prompt.length} caracteres</span>
                <span>Dica: seja específico quanto a preços, formas de pagamento e limites do que responder.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provedor de IA & Parâmetros */}
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Cpu className="h-5 w-5 text-emerald-400" /> Provedor de IA & Configuração Técnica
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Escolha o modelo de inteligência e defina a chave de autenticação.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
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
                  Valores menores = mais preciso; valores maiores = mais criativo.
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
                  Simula o tempo em que uma pessoa real digitaria a resposta.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Salvar Alterações */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 px-6 font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md gap-2"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isSaving ? "Salvando Alterações..." : "Salvar Configurações do Agente"}
          </Button>
        </div>
      </div>

      {/* RIGHT COLUMN: INTERACTIVE SANDBOX SIMULATOR (5 cols on lg) */}
      <div className="lg:col-span-5 sticky top-4 space-y-4">
        <Card className="bg-card border-border/80 shadow-md flex flex-col h-[650px] overflow-hidden">
          {/* Header do Sandbox */}
          <CardHeader className="p-3.5 border-b border-border/40 bg-muted/10 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold text-foreground">Sandbox de Atendimento</CardTitle>
                  <CardDescription className="text-[10px] text-muted-foreground">
                    Teste seu agente com o prompt em tempo real
                  </CardDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setChatMessages([
                    {
                      role: "assistant",
                      text: "Conversa reiniciada. Como posso ajudar?",
                      timestamp: "Agora",
                    },
                  ])
                }
                title="Limpar conversa"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>

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
                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-muted-foreground">
                    <span>{msg.timestamp}</span>
                    {msg.metadata?.responseTimeMs && (
                      <span className="text-emerald-400 font-medium">
                        {msg.metadata.responseTimeMs}ms
                      </span>
                    )}
                    {msg.metadata?.tokens && (
                      <span>{msg.metadata.tokens} tokens</span>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 text-muted-foreground max-w-[60%]">
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                <span className="text-[11px] animate-pulse">Agente digitando...</span>
              </div>
            )}
          </div>

          {/* Input do Sandbox */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-border/40 bg-muted/10 shrink-0">
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
                disabled={isSending || !inputMessage.trim()}
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
        </Card>
      </div>
    </div>
  );
}
