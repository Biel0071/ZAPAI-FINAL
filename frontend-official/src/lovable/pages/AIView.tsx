import { motion } from "framer-motion";
import {
  CaretRight,
  CaretLeft,
  PaperPlaneTilt,
  FloppyDisk,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Plus,
  Pencil,
  Trash,
  Sparkles,
  Loader2,
  Play,
  LayoutDashboard,
  Users,
  Cpu,
  UserPlus,
  Terminal,
  FileCode,
  FileSignature,
  Clock,
  Sliders,
  BrainCircuit,
  GraduationCap,
  BarChart3,
  History as HistoryIcon,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Settings,
  ShieldCheck,
  ToggleLeft,
  X,
  BookOpen,
  User,
  Bot,
  Flame,
  Code,
  Heart,
  Target,
  Stethoscope,
  Palette,
  Copy,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AILearningDashboard } from "@/components/ai/AILearningDashboard";
import type { AILovableViewModel } from "@/adapters/lovable/aiAdapter";
import { apiService, API_ORIGIN } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";
import { AIIcon } from "@/components/ai/AIIcon";
import { cn } from "@/lib/utils";


const RESPONSE_STYLE_WORD_LIMITS: Record<string, number> = {
  one_sentence: 20,
  ultra_short: 45,
  short_natural: 90,
  elaborate: 220,
};

const getStyleWordLimit = (style: string) => RESPONSE_STYLE_WORD_LIMITS[style] || RESPONSE_STYLE_WORD_LIMITS.short_natural;
export type AISectionId =
  | "status"
  | "prompt"
  | "test"
  | "providers"
  | "business-hours"
  | "absence"
  | "reactivation"
  | "training"
  | "learning"
  | "memory"
  | "advanced";

export type AIProviderConfig = {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  active: boolean;
  settings?: any;
};

export type AIConnectionTestResult = {
  ok: boolean;
  provider?: string;
  model?: string;
  status?: string;
  response?: string;
  responseTimeMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  error?: string;
  httpStatus?: number | null;
  fullPrompt?: string;
  memoriesUsed?: string;
  rulesTriggered?: string;
};

export type AILog = {
  id: string;
  timestamp: string;
  conversationId: string;
  contactName: string;
  messageReceived: string;
  messageSent: string;
  provider: string;
  model: string;
  totalTokens: number;
};

export type AIMetrics = {
  tokensToday: number;
  promptTokensToday: number;
  completionTokensToday: number;
  messagesToday: number;
  tokensPerConversation: Record<string, number>;
};

interface AIViewProps {
  viewModel: AILovableViewModel;
  activeSection: string;
  loading: boolean;
  saving: boolean;
  aiEnabled: boolean;
  prompt: string;
  promptVersions: Array<{ id: string; content: string; savedAt: string }>;
  openingHour: string;
  closingHour: string;
  timezone: string;
  outsideHoursAutoReply: boolean;
  absenceEnabled: boolean;
  absenceMessage: string;
  queueBatchSize: number;
  queueDelaySeconds: number;
  queueMessage: string;
  queueWaiting: number;
  queueSentToday: number;
  trainingRows: Array<{ id: string; customerQuestion: string; aiResponse: string; status: "closed" | "lost" }>;
  improveModalOpen: boolean;
  improvedText: string;
  memoryEnabled: boolean;
  rememberLastOrder: boolean;
  rememberPreferences: boolean;
  temperature: number[];
  maxTokens: number[];
  responseDelay: number[];
  autoFollowUp: boolean;
  lostCount: number;
  onSectionChange: (section: any) => void;
  onStatusToggle: (value: boolean) => void;
  onPromptChange: (value: string) => void;
  onSelectPromptVersion: (value: string) => void;
  onRestorePrompt: () => void;
  onSavePrompt: () => void;
  onOpeningHourChange: (value: string) => void;
  onClosingHourChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onOutsideHoursAutoReplyChange: (value: boolean) => void;
  onSaveBusinessHours: () => void;
  onAbsenceEnabledChange: (value: boolean) => void;
  onAbsenceMessageChange: (value: string) => void;
  onSaveAbsenceMessage: () => void;
  onQueueBatchSizeChange: (value: number) => void;
  onQueueDelaySecondsChange: (value: number) => void;
  onQueueMessageChange: (value: string) => void;
  onProcessQueue: () => void;
  onOpenImproveModal: (row: any) => void;
  onPromptApplied: (payload: { newPrompt: string; promptVersionId: string }) => void;
  onMemoryEnabledChange: (value: boolean) => void;
  onRememberLastOrderChange: (value: boolean) => void;
  onRememberPreferencesChange: (value: boolean) => void;
  onSaveMemory: () => void;
  onTemperatureChange: (value: number[]) => void;
  agents: any[];
  loadingAgents: boolean;
  onCreateAgent: (agentPayload: any) => Promise<boolean>;
  onUpdateAgent: (key: string, agentPayload: any) => Promise<boolean>;
  onToggleAgent: (key: string, active: boolean) => Promise<boolean>;
  onDeleteAgent?: (key: string) => Promise<boolean>;
  onCloneAgent?: (key: string) => Promise<boolean>;
  onMaxTokensChange: (value: number[]) => void;
  onResponseDelayChange: (value: number[]) => void;
  onAutoFollowUpChange: (value: boolean) => void;
  onSaveAdvanced: () => void;
  onImproveModalOpenChange: (open: boolean) => void;
  onImprovedTextChange: (text: string) => void;
  onImproveResponse: () => void;
  onSaveImprovedResponse: () => void;
  providers: AIProviderConfig[];
  onProviderChange: (provider: AIProviderConfig) => void;
  onProviderToggle: (id: string, active: boolean) => void;
  onSaveProviders: () => void;
  testMessage: string;
  testPrompt: string;
  testModel: string;
  testProviderId: string;
  testingAI: boolean;
  aiTestResult: AIConnectionTestResult | null;
  providerTesting: boolean;
  providerTestResults: AIConnectionTestResult[];
  aiHealthItems: Array<{ label: string; ok: boolean; detail: string }>;
  onTestMessageChange: (text: string) => void;
  onTestPromptChange: (text: string) => void;
  onTestModelChange: (model: string) => void;
  onTestProviderIdChange: (providerId: string) => void;
  onRunAITest: () => void;
  onRunProviderTests: () => void;
  aiLogs?: AILog[];
  aiMetrics?: AIMetrics;
}

const emojiToKeyMap: Record<string, string> = {
  "👩‍💼": "user",
  "👨‍💼": "user",
  "🤖": "bot",
  "🧑‍💻": "code",
  "👩‍⚕️": "stethoscope",
  "👨‍🎨": "palette",
  "💫": "sparkles",
  "✨": "sparkles",
  "🔥": "flame"
};

const getAgentAvatarIcon = (avatarKey: string, className?: string) => {
  const key = emojiToKeyMap[avatarKey] || avatarKey || "user";
  const iconProps = { className: className || "h-4 w-4" };
  switch (key.toLowerCase()) {
    case "user":
      return <User {...iconProps} />;
    case "bot":
      return <Bot {...iconProps} />;
    case "flame":
      return <Flame {...iconProps} />;
    case "sparkles":
      return <Sparkles {...iconProps} />;
    case "code":
      return <Code {...iconProps} />;
    case "heart":
      return <Heart {...iconProps} />;
    case "target":
      return <Target {...iconProps} />;
    case "stethoscope":
      return <Stethoscope {...iconProps} />;
    case "palette":
      return <Palette {...iconProps} />;
    default:
      return <User {...iconProps} />;
  }
};

const PROMPT_TEMPLATES = [
  {
    id: "vendas",
    title: "Vendas e Conversão",
    category: "Vendas",
    description: "Focado em qualificar leads rapidamente, oferecer alternativas e conduzir para o fechamento de pedidos dos produtos ou serviços da loja.",
    prompt: `Você é o atendente de vendas desta loja.
Foco principal: converter perguntas de preços em pedidos fechados.
Regras:
1. Sempre pergunte as quantidades e local de entrega antes de passar orçamento final.
2. Seja prestativa, objetiva e comercial. Termine sempre com uma pergunta instigando a ação.`,
  },
  {
    id: "suporte",
    title: "Suporte Técnico e Dúvidas",
    category: "Suporte",
    description: "Focado em sanar dúvidas sobre produtos, serviços, logística e especificações da loja.",
    prompt: `Você é o atendente de pós-venda e suporte desta loja.
Foco principal: resolver problemas e tirar dúvidas técnicas sobre materiais de construção.
Regras:
1. Explique com calma os prazos de frete e especificações dos produtos da loja.
2. Mantenha tom prestativo e calmo.`,
  },
  {
    id: "cobranca",
    title: "Cobrança e Financeiro",
    category: "Financeiro",
    description: "Focado em negociar faturas em aberto, enviar códigos Pix e orientar o cliente conforme as políticas financeiras da loja.",
    prompt: `Você é o atendente do setor financeiro e cobrança desta loja.
Foco principal: receber pagamentos e regularizar cadastros de faturamento.
Regras:
1. Seja educada mas firme. Envie a chave Pix cópia e cola quando solicitada.
2. Agende o acerto na loja quando o cliente preferir pagamento presencial.`,
  }
];

const PROVIDER_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Recomendado/Rápido)" },
    { value: "gpt-4o", label: "GPT-4o (Alta Inteligência)" },
    { value: "o1-mini", label: "o1-mini (Raciocínio Rápido)" },
  ],
  groq: [
    { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B (Groq)" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Groq - Instantâneo)" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B (Groq)" },
  ],
  claude: [
    { value: "claude-sonnet-4-20250514", label: "Claude 3.5 Sonnet (Recomendado)" },
    { value: "claude-haiku-3-20240307", label: "Claude 3 Haiku (Mais rápido)" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Mais recente)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Janela Gigante)" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat (V3)" },
    { value: "deepseek-coder", label: "DeepSeek Coder" },
  ],
  openrouter: [
    { value: "auto", label: "Auto-Routing (Melhor Custo-Benefício)" },
    { value: "meta-llama/llama-3.1-405b", label: "Llama 3.1 405B (OpenRouter)" },
  ],
  ollama: [
    { value: "llama3.1", label: "Llama 3.1 (Local)" },
    { value: "mistral", label: "Mistral (Local)" },
    { value: "phi3", label: "Phi 3 (Microsoft - Leve)" },
  ],
  elevenlabs: [
    { value: "eleven_multilingual_v2", label: "Eleven Multilingual v2 (Recomendado)" },
    { value: "eleven_monolingual_v1", label: "Eleven Monolingual v1" },
    { value: "eleven_turbo_v2", label: "Eleven Turbo v2 (Mais Rápido)" },
  ]
};

export function AIView(props: AIViewProps) {
  const {
    saving,
    aiEnabled,
    prompt,
    promptVersions,
    openingHour,
    closingHour,
    timezone,
    outsideHoursAutoReply,
    absenceEnabled,
    absenceMessage,
    queueBatchSize,
    queueDelaySeconds,
    queueMessage,
    queueWaiting,
    queueSentToday,
    trainingRows,
    improveModalOpen,
    improvedText,
    memoryEnabled,
    rememberLastOrder,
    rememberPreferences,
    temperature,
    maxTokens,
    responseDelay,
    autoFollowUp,
    lostCount,
    onStatusToggle,
    onPromptChange,
    onSelectPromptVersion,
    onRestorePrompt,
    onSavePrompt,
    onOpeningHourChange,
    onClosingHourChange,
    onTimezoneChange,
    onOutsideHoursAutoReplyChange,
    onSaveBusinessHours,
    onAbsenceEnabledChange,
    onAbsenceMessageChange,
    onSaveAbsenceMessage,
    onQueueBatchSizeChange,
    onQueueDelaySecondsChange,
    onQueueMessageChange,
    onProcessQueue,
    onOpenImproveModal,
    onPromptApplied,
    onMemoryEnabledChange,
    onRememberLastOrderChange,
    onRememberPreferencesChange,
    onSaveMemory,
    onTemperatureChange,
    agents = [],
    loadingAgents = false,
    onCreateAgent,
    onUpdateAgent,
    onToggleAgent,
    onDeleteAgent,
    onCloneAgent,
    onMaxTokensChange,
    onResponseDelayChange,
    onAutoFollowUpChange,
    onSaveAdvanced,
    onImproveModalOpenChange,
    onImprovedTextChange,
    onImproveResponse,
    onSaveImprovedResponse,
    providers,
    onProviderChange,
    onProviderToggle,
    onSaveProviders,
    testMessage,
    testPrompt,
    testModel,
    testProviderId,
    testingAI,
    aiTestResult,
    providerTesting,
    providerTestResults,
    aiHealthItems,
    onTestMessageChange,
    onTestPromptChange,
    onTestModelChange,
    onTestProviderIdChange,
    onRunAITest,
    onRunProviderTests,
    aiLogs = [],
    aiMetrics = { tokensToday: 0, promptTokensToday: 0, completionTokensToday: 0, messagesToday: 0, tokensPerConversation: {} },
  } = props;

  const { toast } = useToast();

  // Internal Navigation Tab
  const [activeInternalTab, setActiveInternalTab] = useState<string>("dashboard");
  const [activeAtendentesSubTab, setActiveAtendentesSubTab] = useState<"lista" | "simulador" | "evolucao">("lista");
  const [activeConhecimentoSubTab, setActiveConhecimentoSubTab] = useState<"templates" | "treinamento">("templates");
  const [activeAnaliseSubTab, setActiveAnaliseSubTab] = useState<"evolucao" | "logs">("evolucao");

  const [evolutionData, setEvolutionData] = useState<any[]>([]);
  const [pipelineLogs, setPipelineLogs] = useState<any[]>([]);
  const [loadingEvolution, setLoadingEvolution] = useState(false);
  const [loadingPipelineLogs, setLoadingPipelineLogs] = useState(false);
  const [showApiKeyMap, setShowApiKeyMap] = useState<Record<string, boolean>>({});

  // Evolution & Learning States
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("");
  const [evolveInstruction, setEvolveInstruction] = useState<string>("");
  const [previewChanges, setPreviewChanges] = useState<any>(null);
  const [previewReasoning, setPreviewReasoning] = useState<string>("");
  const [previewSuggestions, setPreviewSuggestions] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  
  const [learningEvents, setLearningEvents] = useState<any[]>([]);
  const [learningStats, setLearningStats] = useState<any>({ pending: 0, answered: 0, applied: 0, ignored: 0 });
  const [isLoadingLearning, setIsLoadingLearning] = useState<boolean>(false);
  const [answeringAnswers, setAnsweringAnswers] = useState<Record<number, string>>({});
  const [isTeachingId, setIsTeachingId] = useState<number | null>(null);
  
  const [evolutionHistory, setEvolutionHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [evolutionOverview, setEvolutionOverview] = useState({
    score: 0,
    level: "Iniciante",
    goal: { current: 0, target: 20, percentage: 0 },
    components: { answers: 0, refinements: 0, coverage: 0, queue: 0 },
  });
  const [agentMemoryGraph, setAgentMemoryGraph] = useState<{
    nodes: Array<{ id: string; type: string; label: string; weight: number }>;
    edges: Array<{ source: string; target: string; relation: string }>;
  }>({ nodes: [], edges: [] });

  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgentKey) {
      setSelectedAgentKey(agents[0].key || agents[0].name.toLowerCase());
    }
  }, [agents, selectedAgentKey]);

  const loadEvolutionData = async (agentKey: string) => {
    if (!agentKey) return;
    setIsLoadingLearning(true);
    setIsLoadingHistory(true);
    try {
      const learningRes = await apiService.getAgentLearning(agentKey);
      if (learningRes?.success) {
        setLearningEvents(learningRes.pending || []);
        setLearningStats(learningRes.stats || { pending: 0, answered: 0, applied: 0, ignored: 0 });
      }
      
      const evolutionRes = await apiService.getAgentEvolution(agentKey);
      if (evolutionRes?.success) {
        setEvolutionHistory(evolutionRes.history || []);
        if (evolutionRes.evolution) setEvolutionOverview(evolutionRes.evolution);
        if (evolutionRes.memoryGraph) setAgentMemoryGraph(evolutionRes.memoryGraph);
      }
    } catch (err) {
      console.error("Erro ao carregar dados de evolução:", err);
    } finally {
      setIsLoadingLearning(false);
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedAgentKey && activeAtendentesSubTab === "evolucao") {
      void loadEvolutionData(selectedAgentKey);
    }
  }, [selectedAgentKey, activeAtendentesSubTab]);

  const handleEvolveAgent = async () => {
    if (!selectedAgentKey) return;
    if (!evolveInstruction.trim()) {
      toast({
        title: "Campo Obrigatório",
        description: "Digite uma instrução ou o que você deseja ensinar.",
        variant: "destructive"
      });
      return;
    }
    
    setIsAnalyzing(true);
    setPreviewChanges(null);
    try {
      const res = await apiService.evolveAgent({
        agentKey: selectedAgentKey,
        instruction: evolveInstruction.trim()
      });
      if (res?.success && res.preview) {
        setPreviewChanges(res.preview.changes);
        setPreviewReasoning(res.preview.reasoning);
        setPreviewSuggestions(res.preview.suggestions || []);
        toast({
          title: "Análise Concluída",
          description: "A IA propôs alterações abaixo. Revise e clique em aplicar.",
        });
      } else {
        toast({
          title: "Falha na Análise",
          description: res?.error || "Não foi possível analisar a instrução.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro de Conexão",
        description: err.message || "Erro ao conectar com o serviço de refinamento.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!selectedAgentKey || !previewChanges) return;
    setIsApplying(true);
    try {
      const res = await apiService.evolveAgent({
        agentKey: selectedAgentKey,
        instruction: evolveInstruction.trim(),
        apply: true,
        changes: previewChanges,
        sourceDescription: evolveInstruction.trim()
      });
      if (res?.success) {
        toast({
          title: "Evolução Aplicada",
          description: "O atendente foi atualizado e as mudanças estão ativas.",
        });
        setPreviewChanges(null);
        setEvolveInstruction("");
        void loadEvolutionData(selectedAgentKey);
        if (viewModel && typeof viewModel.loadAgents === "function") {
          viewModel.loadAgents();
        }
      } else {
        toast({
          title: "Erro ao Aplicar",
          description: res?.error || "Falha ao gravar alterações no atendente.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro de Conexão",
        description: err.message || "Erro ao salvar alterações.",
        variant: "destructive"
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleAnswerQuestion = async (eventId: number) => {
    const answer = (answeringAnswers[eventId] || "").trim();
    if (!answer) {
      toast({
        title: "Erro",
        description: "Por favor, digite a resposta para o cliente.",
        variant: "destructive"
      });
      return;
    }
    
    setIsTeachingId(eventId);
    try {
      const ansRes = await apiService.answerLearningEvent(eventId, answer);
      if (!ansRes?.success) {
        throw new Error("Falha ao salvar a resposta.");
      }
      
      const applyRes = await apiService.applyLearningAnswer(eventId, answer);
      if (applyRes?.success) {
        toast({
          title: "Sucesso!",
          description: `O atendente aprendeu a resposta e a integrou no campo: ${applyRes.targetField.toUpperCase()}.`,
        });
        setAnsweringAnswers(prev => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
        void loadEvolutionData(selectedAgentKey);
        if (viewModel && typeof viewModel.loadAgents === "function") {
          viewModel.loadAgents();
        }
      } else {
        toast({
          title: "Erro ao Integrar",
          description: "Falha ao processar a resposta com IA.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Falha ao treinar o atendente.",
        variant: "destructive"
      });
    } finally {
      setIsTeachingId(null);
    }
  };

  const handleIgnoreEvent = async (eventId: number) => {
    try {
      const res = await apiService.ignoreLearningEvent(eventId);
      if (res?.success) {
        toast({
          title: "Ignorado",
          description: "A pergunta foi descartada com sucesso.",
        });
        void loadEvolutionData(selectedAgentKey);
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Erro ao descartar pergunta.",
        variant: "destructive"
      });
    }
  };

  const handleDetectGaps = async () => {
    if (!selectedAgentKey) return;
    toast({
      title: "Analisando Conversas",
      description: "Buscando lacunas de conhecimento e perguntas sem resposta..."
    });
    try {
      const res = await apiService.detectAgentGaps(selectedAgentKey);
      if (res?.success) {
        toast({
          title: "Análise Concluída",
          description: `Identificamos ${res.createdCount} novas dúvidas dos clientes.`,
        });
        void loadEvolutionData(selectedAgentKey);
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: "Falha ao analisar conversas.",
        variant: "destructive"
      });
    }
  };

  const [restartingAI, setRestartingAI] = useState(false);

  const handleRestartAI = async () => {
    setRestartingAI(true);
    try {
      const res = await apiService.restartAI();
      if (res?.success) {
        toast({
          title: "IA Reiniciada",
          description: "O cache de respostas e os atendentes foram recarregados com sucesso.",
        });
        handleClearSim();
      } else {
        toast({
          title: "Erro ao reiniciar",
          description: res?.message || "Não foi possível reiniciar o motor de IA.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro de conexão",
        description: err.message || "Erro ao conectar com o servidor.",
        variant: "destructive",
      });
    } finally {
      setRestartingAI(false);
    }
  };
  const [deployingVPS, setDeployingVPS] = useState(false);

  const handleDeployVPS = async () => {
    setDeployingVPS(true);
    try {
      const res = await apiService.deployVPS();
      if (res?.success) {
        toast({
          title: "Deploy Iniciado",
          description: "O script de deploy automático foi disparado na VPS. O sistema será reiniciado em instantes.",
        });
      } else {
        toast({
          title: "Erro no deploy",
          description: res?.message || "Não foi possível disparar o deploy na VPS.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro de conexão",
        description: err.message || "Erro ao conectar com o servidor.",
        variant: "destructive",
      });
    } finally {
      setDeployingVPS(false);
    }
  };

  // States for the Testar IA simulation
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [localTestAttendant, setLocalTestAttendant] = useState("");
  const [localTestMessage, setLocalTestMessage] = useState("");
  const [localTestingAI, setLocalTestingAI] = useState(false);
  const [localTestResult, setLocalTestResult] = useState<any | null>(null);

  // Automatically select the first agent when modal opens
  useEffect(() => {
    if (isTestModalOpen && !localTestAttendant && agents && agents.length > 0) {
      setLocalTestAttendant(agents[0].key);
    }
  }, [isTestModalOpen, localTestAttendant, agents]);

  const handleRunAITest = async () => {
    if (!localTestMessage.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Por favor, digite uma mensagem para testar.",
        variant: "destructive",
      });
      return;
    }
    setLocalTestingAI(true);
    setLocalTestResult(null);
    try {
      const selectedAgent = (agents || []).find((a) => a.key === localTestAttendant);
      const res = await apiService.testAIMessage({
        message: localTestMessage,
        agentKey: localTestAttendant,
        agentName: selectedAgent?.name,
        prompt: selectedAgent?.personality || selectedAgent?.prompt,
      });

      if (res?.success && res.result) {
        setLocalTestResult({
          ok: true,
          response: res.result.response || "Sem resposta do modelo.",
          responseTimeMs: res.result.responseTimeMs || 0,
          model: res.result.model || "Desconhecido",
          status: "Sucesso (200)",
        });
      } else {
        setLocalTestResult({
          ok: false,
          error: res?.error || "Erro na simulação do atendente.",
          status: `Erro (500) - ${res?.error || "Internal Server Error"}`,
          responseTimeMs: 0,
          model: "Falha",
        });
      }
    } catch (err: any) {
      setLocalTestResult({
        ok: false,
        error: err.message || "Erro de conexão com o servidor.",
        status: `Erro - Conexão falhou`,
        responseTimeMs: 0,
        model: "Erro",
      });
    } finally {
      setLocalTestingAI(false);
    }
  };

  useEffect(() => {
    if (props.activeSection) {
      setActiveInternalTab(props.activeSection);
    }
  }, [props.activeSection]);

  const onSectionChange = (section: any) => {
    setActiveInternalTab(section);
    if (props.onSectionChange) {
      props.onSectionChange(section);
    }
  };

  const fetchAnalysisData = async () => {
    setLoadingEvolution(true);
    setLoadingPipelineLogs(true);
    try {
      const [evoRes, logsRes] = await Promise.all([
        apiService.getAIEvolution().catch(() => ({ success: false, evolution: [] })),
        apiService.getPipelineLogs().catch(() => ({ success: false, logs: [] }))
      ]);
      if (evoRes?.success) {
        setEvolutionData(evoRes.evolution || []);
      }
      if (logsRes?.success) {
        setPipelineLogs(logsRes.logs || []);
      }
    } catch (err) {
      console.error("Error loading analysis data:", err);
    } finally {
      setLoadingEvolution(false);
      setLoadingPipelineLogs(false);
    }
  };

  useEffect(() => {
    if (activeInternalTab === "analise") {
      void fetchAnalysisData();
    }
  }, [activeInternalTab]);

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [favoriteTemplates, setFavoriteTemplates] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("zapai_favorite_prompt_templates") ?? "[]");
    } catch {
      return [];
    }
  });

  const [lastUsedTemplateId, setLastUsedTemplateId] = useState<string | null>(() => {
    return window.localStorage.getItem("zapai_last_used_prompt_template");
  });

  // Agent Wizard & Form States
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [editingAgentKey, setEditingAgentKey] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [agentFormName, setAgentFormName] = useState("");
  const [agentFormSector, setAgentFormSector] = useState("Comercial");
  const [agentFormObjective, setAgentFormObjective] = useState("Qualificar Leads");
  const [agentFormPrompt, setAgentFormPrompt] = useState("");
  const [agentFormTemp, setAgentFormTemp] = useState(0.7);
  const [agentFormResponseStyle, setAgentFormResponseStyle] = useState("short_natural");
  const [agentFormMaxWords, setAgentFormMaxWords] = useState(RESPONSE_STYLE_WORD_LIMITS.short_natural);
  const [agentFormResponseDelayMin, setAgentFormResponseDelayMin] = useState(2);
  const [agentFormResponseDelayMax, setAgentFormResponseDelayMax] = useState(8);
  const [agentFormTypingDelayMin, setAgentFormTypingDelayMin] = useState(1);
  const [agentFormTypingDelayMax, setAgentFormTypingDelayMax] = useState(3);
  const [agentFormAvatar, setAgentFormAvatar] = useState("user");
  const [agentFormActive, setAgentFormActive] = useState(true);
  const [agentFormHours, setAgentFormHours] = useState("");
  const [agentFormRules, setAgentFormRules] = useState("");
  const [agentFormMemory, setAgentFormMemory] = useState("");
  const [agentFormVoiceEnabled, setAgentFormVoiceEnabled] = useState(false);
  const [agentFormVoiceRule, setAgentFormVoiceRule] = useState("always");
  const [agentFormVoiceId, setAgentFormVoiceId] = useState("");
  const [agentFormVoiceProvider, setAgentFormVoiceProvider] = useState("default");
  const [agentFormVoiceGender, setAgentFormVoiceGender] = useState("female");
  const [wizardViewMode, setWizardViewMode] = useState<"steps" | "accordion">("steps");
  const [voiceTestText, setVoiceTestText] = useState("Olá! Sou o seu assistente de voz e estou pronto para conversar com você.");
  const [testingVoice, setTestingVoice] = useState(false);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  
  // Extra business context states
  const [agentFormCompany, setAgentFormCompany] = useState("");
  const [agentFormCompanyDesc, setAgentFormCompanyDesc] = useState("");
  const [agentFormProducts, setAgentFormProducts] = useState("");
  const [agentFormServices, setAgentFormServices] = useState("");
  const [agentFormFaq, setAgentFormFaq] = useState("");
  const [agentFormPolicies, setAgentFormPolicies] = useState("");

  // Follow-Up States (matching Images 3 & 4)
  const [followUpActive, setFollowUpActive] = useState(true);
  const [followUpAiGenerated, setFollowUpAiGenerated] = useState(true);
  const [followUpRespectBusinessHours, setFollowUpRespectBusinessHours] = useState(true);
  const [followUpCount, setFollowUpCount] = useState(3);
  const [followUpCheckMin, setFollowUpCheckMin] = useState(300);
  const [followUpIntervalHours, setFollowUpIntervalHours] = useState(8);
  const [followUpPrompt, setFollowUpPrompt] = useState(
    `Você é um assistente especializado em criar mensagens de follow-up personalizadas para conversas de WhatsApp, com foco em conversão de vendas para ${agentFormCompany || "a empresa"}.\n\nSua função é analisar a conversa fornecida e gerar 3 mensagens de follow-up sequenciais, amigáveis e estratégicas.`
  );
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [generatingFollowUpPrompt, setGeneratingFollowUpPrompt] = useState(false);

  // Mídia com IA States (matching Image 5)
  const [mediaAiEnabled, setMediaAiEnabled] = useState(true);
  const [registeredMediaList, setRegisteredMediaList] = useState<Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: string;
    descricaoIa: string;
    descricaoHumana: string;
    url?: string;
  }>>([
    {
      id: "1",
      fileName: "Tabela_Precos_Materiais.pdf",
      fileType: "PDF",
      fileSize: "1.8 MB",
      descricaoIa: "Enviar quando o cliente solicitar a tabela completa de preços ou orçamentos em PDF.",
      descricaoHumana: "Tabela de preços atualizada com descontos à vista."
    }
  ]);
  const [analyzingMedia, setAnalyzingMedia] = useState(false);

  const handleGenerateFollowUpPromptByAI = async () => {
    setGeneratingFollowUpPrompt(true);
    try {
      const res = await apiService.generateFollowUpPrompt({
        agentName: agentFormName,
        sector: agentFormSector,
        objective: agentFormObjective,
        company: agentFormCompany,
        products: agentFormProducts,
      });

      if (res && res.success && res.prompt) {
        setFollowUpPrompt(res.prompt);
        toast({
          title: "Prompt Gerado com Sucesso!",
          description: "O prompt de follow-up foi gerado e personalizado para este atendente.",
        });
      } else {
        throw new Error(res?.error || "Falha ao gerar prompt de follow-up.");
      }
    } catch (err: any) {
      toast({
        title: "Erro ao Gerar Follow-Up",
        description: err.message || "Erro ao conectar com o serviço de IA.",
        variant: "destructive",
      });
    } finally {
      setGeneratingFollowUpPrompt(false);
    }
  };

  const handleFileUploadMediaAI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setAnalyzingMedia(true);

    toast({
      title: "Analisando Mídia com IA...",
      description: `A IA está inspecionando "${file.name}" para extrair detalhes e criar descrições.`,
    });

    try {
      const res = await apiService.analyzeMediaWithAI({
        fileName: file.name,
        fileType: file.type || file.name.split(".").pop(),
        agentName: agentFormName,
        companyDesc: agentFormCompanyDesc,
      });

      const newMedia = {
        id: String(Date.now()),
        fileName: file.name,
        fileType: (file.name.split(".").pop() || "ARQUIVO").toUpperCase(),
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        descricaoIa: res?.descricao_ia || `Enviar quando o cliente pedir informações sobre ${file.name}.`,
        descricaoHumana: res?.descricao_humana || `Arquivo ${file.name} cadastrado para envio.`,
        url: URL.createObjectURL(file),
      };

      setRegisteredMediaList((prev) => [newMedia, ...prev]);

      toast({
        title: "Mídia Cadastrada!",
        description: "A IA analisou o arquivo e cadastrou as regras de envio automático.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao Analisar Mídia",
        description: err.message || "Falha na análise da mídia por IA.",
        variant: "destructive",
      });
    } finally {
      setAnalyzingMedia(false);
      e.target.value = "";
    }
  };

  // Escalation configurations
  const [agentFormEscalationPhone, setAgentFormEscalationPhone] = useState("");
  const [agentFormEscalationWhatsapp, setAgentFormEscalationWhatsapp] = useState("");
  const [agentFormEscalationActive, setAgentFormEscalationActive] = useState(false);
  const [agentFormEscalationMode, setAgentFormEscalationMode] = useState<number>(1);
  const [agentFormEscalationTriggers, setAgentFormEscalationTriggers] = useState<string[]>([]);

  // Chat Simulator states
  const [simSelectedAgent, setSimSelectedAgent] = useState<string>("");
  const [simMessages, setSimMessages] = useState<Array<{ sender: "user" | "bot"; content: string }>>([
    { sender: "bot", content: "Olá! Como posso ajudar você hoje?" }
  ]);
  const [simInput, setSimInput] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simStatus, setSimStatus] = useState("Pensando...");
  const [simMetrics, setSimMetrics] = useState<AIConnectionTestResult | null>(null);
  
  // Simulator quick edit states
  const [simTemp, setSimTemp] = useState(0.7);
  const [simStyle, setSimStyle] = useState("short_natural");
  const [simMaxWords, setSimMaxWords] = useState(RESPONSE_STYLE_WORD_LIMITS.short_natural);
  const [simAgentPrompt, setSimAgentPrompt] = useState("");
  const [savingSimSettings, setSavingSimSettings] = useState(false);
  const [simTab, setSimTab] = useState<"ajuste" | "metricas">("ajuste");
  const [refinementInstruction, setRefinementInstruction] = useState("");
  const [refiningPrompt, setRefiningPrompt] = useState(false);

  useEffect(() => {
    if (!Array.isArray(agents) || agents.length === 0) {
      if (!simSelectedAgent) setSimSelectedAgent("camila");
      return;
    }
    const agentObj = agents.find(
      (a: any) =>
        a.key === simSelectedAgent ||
        a.name?.toLowerCase() === simSelectedAgent.toLowerCase()
    );
    if (agentObj) {
      setSimTemp(agentObj.temperature ?? 0.7);
      setSimStyle(agentObj.responseStyle || "short_natural");
      setSimMaxWords(agentObj.maxWords || getStyleWordLimit(agentObj.responseStyle || "short_natural"));
      setSimAgentPrompt(agentObj.personality || agentObj.prompt || "");
    }
  }, [agents, simSelectedAgent]);

  const toggleFavoriteTemplate = (id: string) => {
    setFavoriteTemplates((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      window.localStorage.setItem("zapai_favorite_prompt_templates", JSON.stringify(next));
      return next;
    });
  };

  const filteredTemplates = PROMPT_TEMPLATES.filter((t) => {
    const q = templateSearch.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const aFav = favoriteTemplates.includes(a.id) ? 1 : 0;
    const bFav = favoriteTemplates.includes(b.id) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return a.title.localeCompare(b.title);
  });

  const currentProviderId = selectedProviderId || providers.find((p) => p.active)?.id || providers[0]?.id || "";
  const selectedProvider = providers.find((p) => p.id === currentProviderId);
  const activeProviderCount = providers.filter((provider) => provider.active).length;
  const selectProvider = (providerId: string) => {
    setSelectedProviderId(providerId);
    const firstModel = PROVIDER_MODELS[providerId]?.[0]?.value || "";
    onTestProviderIdChange(providerId);
    onTestModelChange(firstModel);
  };


  // Agent CRUD & Wizard handlers
  const handleOpenAddAgent = () => {
    setEditingAgentKey(null);
    setAgentFormName("");
    setAgentFormSector("Comercial");
    setAgentFormObjective("Qualificar Leads");
    setAgentFormPrompt("Você é um atendente focado em auxiliar o cliente com simpatia e clareza.");
    setAgentFormTemp(0.7);
    setAgentFormResponseStyle("short_natural");
    setAgentFormMaxWords(RESPONSE_STYLE_WORD_LIMITS.short_natural);
    setAgentFormResponseDelayMin(2);
    setAgentFormResponseDelayMax(8);
    setAgentFormTypingDelayMin(1);
    setAgentFormTypingDelayMax(3);
    setAgentFormAvatar("user");
    setAgentFormActive(true);
    setAgentFormHours("");
    setAgentFormRules("");
    setAgentFormMemory("");
    setAgentFormCompany("");
    setAgentFormCompanyDesc("");
    setAgentFormProducts("");
    setAgentFormServices("");
    setAgentFormFaq("");
    setAgentFormPolicies("");
    setAgentFormEscalationPhone("");
    setAgentFormEscalationWhatsapp("");
    setAgentFormEscalationActive(false);
    setAgentFormEscalationMode(1);
    setAgentFormEscalationTriggers([]);
    setAgentFormVoiceEnabled(false);
    setAgentFormVoiceRule("always");
    setAgentFormVoiceId("");
    setAgentFormVoiceProvider("default");
    setAgentFormVoiceGender("female");
    setWizardStep(1);
    setIsAgentDialogOpen(true);
  };

  const handleOpenEditAgent = (agent: any) => {
    setEditingAgentKey(agent.key || agent.name);
    setAgentFormName(agent.name);
    setAgentFormSector(agent.sector || "Comercial");
    setAgentFormObjective(agent.objective || "Qualificar Leads");
    setAgentFormPrompt(agent.personality || agent.prompt || "");
    setAgentFormTemp(agent.temperature !== undefined ? agent.temperature : 0.7);
    setAgentFormResponseStyle(agent.responseStyle || "short_natural");
    setAgentFormMaxWords(agent.maxWords || getStyleWordLimit(agent.responseStyle || "short_natural"));
    setAgentFormResponseDelayMin(Math.max(0, Math.round((agent.delayProfile?.minMs ?? 2000) / 1000)));
    setAgentFormResponseDelayMax(Math.max(0, Math.round((agent.delayProfile?.maxMs ?? 8000) / 1000)));
    setAgentFormTypingDelayMin(Math.max(0, Math.round((agent.typingDelayProfile?.minMs ?? 1000) / 1000)));
    setAgentFormTypingDelayMax(Math.max(0, Math.round((agent.typingDelayProfile?.maxMs ?? 3000) / 1000)));
    setAgentFormAvatar(agent.avatar || "user");
    setAgentFormActive(agent.active !== false);
    setAgentFormHours(agent.hours || "");
    setAgentFormRules(agent.rules || "");
    setAgentFormMemory(agent.memory || "");
    setAgentFormCompany(agent.company || "");
    setAgentFormCompanyDesc(agent.companyDescription || "");
    setAgentFormProducts(agent.products || "");
    setAgentFormServices(agent.services || "");
    setAgentFormFaq(agent.faq || "");
    setAgentFormPolicies(agent.policies || "");
    setAgentFormEscalationPhone(agent.escalationPhone || "");
    setAgentFormEscalationWhatsapp(agent.escalationWhatsapp || "");
    setAgentFormEscalationActive(Boolean(agent.escalationActive));
    setAgentFormEscalationMode(Number(agent.escalationMode || 1));
    setAgentFormEscalationTriggers(Array.isArray(agent.escalationTriggers) ? agent.escalationTriggers : []);
    setAgentFormVoiceEnabled(Boolean(agent.voiceEnabled));
    setAgentFormVoiceRule(agent.voiceRule || "always");
    setAgentFormVoiceId(agent.voiceId || "");
    setAgentFormVoiceProvider(agent.voiceProvider || "default");
    setAgentFormVoiceGender(agent.voiceGender || "female");
    setWizardStep(1);
    setIsAgentDialogOpen(true);
  };

  const handleSaveAgent = async () => {
    if (!agentFormName.trim()) {
      toast({ title: "O nome do atendente é obrigatório.", variant: "destructive" });
      return;
    }
    if (!agentFormPrompt.trim()) {
      toast({ title: "O prompt de personalidade é obrigatório.", variant: "destructive" });
      return;
    }

    const payload = {
      name: agentFormName.trim(),
      sector: agentFormSector.trim(),
      objective: agentFormObjective.trim(),
      personality: agentFormPrompt.trim(),
      temperature: agentFormTemp,
      responseStyle: agentFormResponseStyle,
      delayProfile: {
        minMs: Math.max(0, Math.min(agentFormResponseDelayMin, agentFormResponseDelayMax) * 1000),
        maxMs: Math.max(agentFormResponseDelayMin, agentFormResponseDelayMax) * 1000,
      },
      typingDelayProfile: {
        minMs: Math.max(0, Math.min(agentFormTypingDelayMin, agentFormTypingDelayMax) * 1000),
        maxMs: Math.max(agentFormTypingDelayMin, agentFormTypingDelayMax) * 1000,
      },
      avatar: agentFormAvatar,
      active: agentFormActive,
      hours: agentFormHours.trim(),
      rules: agentFormRules.trim(),
      memory: agentFormMemory.trim(),
      company: agentFormCompany.trim(),
      companyDescription: agentFormCompanyDesc.trim(),
      products: agentFormProducts.trim(),
      services: agentFormServices.trim(),
      faq: agentFormFaq.trim(),
      policies: agentFormPolicies.trim(),
      escalationPhone: agentFormEscalationPhone.trim(),
      escalationWhatsapp: agentFormEscalationWhatsapp.trim(),
      escalationActive: agentFormEscalationActive,
      escalationMode: agentFormEscalationMode,
      escalationTriggers: agentFormEscalationTriggers,
      voiceEnabled: agentFormVoiceEnabled,
      voiceRule: agentFormVoiceRule,
      voiceId: agentFormVoiceId.trim(),
      voiceProvider: agentFormVoiceProvider,
      voiceGender: agentFormVoiceGender,
      maxWords: agentFormMaxWords,
    };

    let success = false;
    if (editingAgentKey) {
      if (onUpdateAgent) {
        success = await onUpdateAgent(editingAgentKey, payload);
      }
    } else {
      if (onCreateAgent) {
        success = await onCreateAgent(payload);
      }
    }

    if (success) {
      setIsAgentDialogOpen(false);
    }
  };

  const toggleTrigger = (trigger: string) => {
    setAgentFormEscalationTriggers((prev) =>
      prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger]
    );
  };

  const handleTestVoice = async () => {
    if (!voiceTestText.trim()) return;
    setTestingVoice(true);
    setVoiceAudioUrl(null);
    try {
      const selectedVoice = agentFormVoiceId === "custom" ? "" : agentFormVoiceId;
      const data = await apiService.testVoice(voiceTestText.trim(), selectedVoice || "21m00Tcm4TlvDq8ikWAM");
      if (data && data.url) {
        const audioUrl = data.url.startsWith("http") ? data.url : `${API_ORIGIN || ""}${data.url}`;
        setVoiceAudioUrl(audioUrl);
        toast({ title: "Áudio de teste gerado com sucesso!", variant: "default" });
      } else {
        toast({ title: "Erro ao testar voz: resposta vazia.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: err?.message || "Erro ao testar voz.", variant: "destructive" });
    } finally {
      setTestingVoice(false);
    }
  };

  // Chat Simulator helpers
  const splitLongMessage = (text: string) => {
    if (!text || text.length <= 250) return [text];
    const parts = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) return [text];
    const chunks: string[] = [];
    let currentChunk = '';
    for (const part of parts) {
      if (currentChunk && (currentChunk.length + part.length < 320)) {
        currentChunk += '\n\n' + part;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = part;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks.length > 0 ? chunks : [text];
  };

  const handleSimSend = async () => {
    if (!simInput.trim()) return;
    const userMsg = simInput.trim();
    const mappedHistory = simMessages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    setSimMessages((prev) => [...prev, { sender: "user", content: userMsg }]);
    setSimInput("");
    setSimLoading(true);
    setSimMetrics(null);

    // Calculate humanized delay based on agent's profile
    const agentObj = (agents || []).find(
      (a: any) =>
        a.key === simSelectedAgent ||
        a.name?.toLowerCase() === simSelectedAgent.toLowerCase()
    );

    let finalDelayMs = 0;
    if (agentObj) {
      const responseMin = Number(agentObj.delayProfile?.minMs) || 0;
      const responseMax = Number(agentObj.delayProfile?.maxMs) || responseMin;
      const typingMin = Number(agentObj.typingDelayProfile?.minMs) || 0;
      const typingMax = Number(agentObj.typingDelayProfile?.maxMs) || typingMin;
      
      const responseDelay = responseMax === responseMin ? responseMin : Math.floor(Math.random() * (responseMax - responseMin + 1)) + responseMin;
      const typingDelay = typingMax === typingMin ? typingMin : Math.floor(Math.random() * (typingMax - typingMin + 1)) + typingMin;
      finalDelayMs = responseDelay + typingDelay;
    }

    // Default to at least 1.5s delay if not configured
    if (finalDelayMs <= 0) {
      finalDelayMs = 1500;
    }

    const delaySec = (finalDelayMs / 1000).toFixed(1);
    setSimStatus(`Digitando... (atraso humanizado de ${delaySec}s)`);

    try {
      const agentModel = testModel || "gpt-4o-mini";
      const agentProvider = testProviderId || "openai";

      // Execute API call and delay concurrently
      const apiPromise = apiService.testAIMessage({
        message: userMsg,
        prompt: simAgentPrompt.trim(),
        model: agentModel,
        providerId: agentProvider,
        agentKey: agentObj?.key,
        agentName: agentObj?.name,
        temperature: simTemp,
        responseStyle: simStyle,
        history: mappedHistory,
        maxWords: simMaxWords,
      });

      // Quick test delay of 600ms to avoid waiting in simulator
      const delayPromise = new Promise((resolve) => setTimeout(resolve, 600));

      const [response] = await Promise.all([apiPromise, delayPromise]);

      if (response && response.success && response.result) {
        const botReply = response.result?.response || "Sem resposta do atendente.";
        const replyChunks = splitLongMessage(botReply);

        for (let i = 0; i < replyChunks.length; i++) {
          if (i === 0) {
            setSimMessages((prev) => [
              ...prev,
              { sender: "bot", content: replyChunks[i] }
            ]);
          } else {
            setTimeout(() => {
              setSimMessages((prev) => [
                ...prev,
                { sender: "bot", content: replyChunks[i] }
              ]);
            }, i * 800);
          }
        }
        setSimMetrics({ ...response.result, ok: true });
      } else {
        const errorMessage = response?.error || response?.result?.error || "Sem resposta.";
        setSimMessages((prev) => [
          ...prev,
          { sender: "bot", content: `Erro na simulação: ${errorMessage}` }
        ]);
        setSimMetrics({
          ...(response?.result || {}),
          ok: false,
          provider: response?.result?.provider || agentProvider,
          model: response?.result?.model || agentModel,
          status: response?.result?.status || "error",
          error: errorMessage,
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || String(err);
      setSimMessages((prev) => [
        ...prev,
        { sender: "bot", content: `Falha na simulação: ${errorMessage}` }
      ]);
      setSimMetrics({
        ok: false,
        provider: agentProvider,
        model: agentModel,
        status: "error",
        error: errorMessage,
      });
    } finally {
      setSimLoading(false);
    }
  };

  const handleSaveSimSettings = async () => {
    const agentObj = (agents || []).find(
      (a: any) =>
        a.key === simSelectedAgent ||
        a.name?.toLowerCase() === simSelectedAgent.toLowerCase()
    );
    if (!agentObj) {
      toast({ title: "Nenhum atendente selecionado para salvar.", variant: "destructive" });
      return;
    }

    setSavingSimSettings(true);
    try {
      const payload = {
        ...agentObj,
        temperature: simTemp,
        responseStyle: simStyle,
        personality: simAgentPrompt.trim(),
        maxWords: simMaxWords,
      };
      
      if (onUpdateAgent) {
        const success = await onUpdateAgent(agentObj.key, payload);
        if (success) {
          toast({ title: "Configurações do atendente salvas com sucesso!", variant: "default" });
        } else {
          toast({ title: "Erro ao salvar configurações do atendente.", variant: "destructive" });
        }
      }
    } catch (err: any) {
      toast({ title: err?.message || "Falha ao salvar configurações.", variant: "destructive" });
    } finally {
       setSavingSimSettings(false);
     }
  };

  const handleRefinePrompt = async () => {
    if (!refinementInstruction.trim()) return;

    setRefiningPrompt(true);
    try {
      const response = await apiService.refinePrompt({
        currentPrompt: simAgentPrompt,
        instruction: refinementInstruction.trim(),
      });

      if (response && response.success && response.refinedPrompt) {
        setSimAgentPrompt(response.refinedPrompt);
        setRefinementInstruction("");
        toast({
          title: "Instruções ajustadas com sucesso!",
          description: "O prompt do atendente foi aprimorado pela inteligência artificial.",
          variant: "default",
        });
      } else {
        throw new Error(response?.error || "Falha ao refinar instruções.");
      }
    } catch (err: any) {
      toast({
        title: "Erro ao ajustar instruções",
        description: err.message || "Houve uma falha ao tentar aprimorar o prompt com IA.",
        variant: "destructive",
      });
    } finally {
      setRefiningPrompt(false);
    }
  };

  const handleClearSim = () => {
    setSimMessages([{ sender: "bot", content: "Olá! Como posso ajudar você hoje?" }]);
    setSimMetrics(null);
  };

  const renderStepIdentificacao = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="agent-name" className="text-[11px] font-bold">Nome do Atendente</Label>
        <Input
          id="agent-name"
          placeholder="Ex: Vendas, Suporte"
          value={agentFormName}
          onChange={(e) => setAgentFormName(e.target.value)}
          disabled={!!editingAgentKey}
          className="bg-background h-8 text-xs"
        />
        <p className="text-[9px] text-muted-foreground">Nome público que o bot usará para se apresentar.</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="agent-avatar" className="text-[11px] font-bold">Avatar (Ícone)</Label>
        <Select value={agentFormAvatar} onValueChange={setAgentFormAvatar}>
          <SelectTrigger id="agent-avatar" className="bg-background h-8 text-xs">
            <SelectValue placeholder="Selecione um ícone" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {[
              { value: "user", label: "Usuário/Atendente" },
              { value: "bot", label: "Robô/IA" },
              { value: "flame", label: "Destaque/Fogo" },
              { value: "sparkles", label: "Brilho/Inteligência" },
              { value: "code", label: "Desenvolvedor/Técnico" },
              { value: "heart", label: "Saúde/Cuidado" },
              { value: "target", label: "Objetivo/Comercial" },
              { value: "stethoscope", label: "Especialista/Médico" },
              { value: "palette", label: "Design/Criativo" }
            ].map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                <div className="flex items-center gap-2">
                  {getAgentAvatarIcon(opt.value, "h-3.5 w-3.5 text-primary")}
                  <span>{opt.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 pt-2">
        <Label className="text-[11px] font-bold">Setor de Atuação / Cargo</Label>
        <div className="grid grid-cols-2 gap-2">
          {["Comercial", "Suporte", "Financeiro", "Cobrança"].map((s) => (
            <Button
              key={s}
              type="button"
              variant={agentFormSector === s ? "default" : "outline"}
              className="h-8 text-xs font-normal"
              onClick={() => setAgentFormSector(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="space-y-1 pt-1">
          <Label htmlFor="agent-sector-custom" className="text-[10px] text-muted-foreground">Setor Personalizado</Label>
          <Input
            id="agent-sector-custom"
            placeholder="Ex: Pós-venda, Diretoria"
            value={agentFormSector}
            onChange={(e) => setAgentFormSector(e.target.value)}
            className="bg-background h-8 text-xs"
          />
        </div>
      </div>
      <div className="space-y-1 pt-2">
        <Label htmlFor="agent-objective" className="text-[11px] font-bold">Objetivo Principal</Label>
        <Input
          id="agent-objective"
          placeholder="Ex: Vender materiais de construção, agendar visitas"
          value={agentFormObjective}
          onChange={(e) => setAgentFormObjective(e.target.value)}
          className="bg-background h-8 text-xs"
        />
      </div>
    </div>
  );

  const renderStepContextoEmpresa = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <Label htmlFor="agent-company" className="text-[11px] font-bold">Nome da Empresa</Label>
        <Input
          id="agent-company"
          placeholder="Ex: Depósito Vista Alegre"
          value={agentFormCompany}
          onChange={(e) => setAgentFormCompany(e.target.value)}
          className="bg-background h-8 text-xs"
        />
      </div>
      <div className="space-y-1 pt-2">
        <Label htmlFor="agent-company-desc" className="text-[11px] font-bold">Descrição da Empresa</Label>
        <Textarea
          id="agent-company-desc"
          placeholder="Descreva o que a empresa faz, sua história, localização e diferenciais..."
          value={agentFormCompanyDesc}
          onChange={(e) => setAgentFormCompanyDesc(e.target.value)}
          className="min-h-[140px] bg-background text-xs"
        />
        <p className="text-[9px] text-muted-foreground">Essa descrição ajudará a IA a se situar no contexto institucional.</p>
      </div>
    </div>
  );

  const renderStepProdutosServicos = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <Label htmlFor="agent-products" className="text-[11px] font-bold">Tabela de Produtos e Preços</Label>
        <Textarea
          id="agent-products"
          placeholder="Ex: Tijolo 8 furos - R$ 780,00 (milheiro)&#10;Cimento Liz - R$ 21,90..."
          value={agentFormProducts}
          onChange={(e) => setAgentFormProducts(e.target.value)}
          className="min-h-[100px] bg-background text-xs font-mono"
        />
      </div>
      <div className="space-y-1 pt-2">
        <Label htmlFor="agent-services" className="text-[11px] font-bold">Serviços Prestados</Label>
        <Textarea
          id="agent-services"
          placeholder="Ex: Entrega rápida de materiais, fabricação de churrasqueiras pré-moldadas..."
          value={agentFormServices}
          onChange={(e) => setAgentFormServices(e.target.value)}
          className="min-h-[100px] bg-background text-xs"
        />
      </div>
    </div>
  );

  const renderStepFaqPoliticas = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <Label htmlFor="agent-faq" className="text-[11px] font-bold">FAQ (Perguntas Frequentes)</Label>
        <Textarea
          id="agent-faq"
          placeholder="Ex: P: Qual o frete? R: O frete varia de acordo com a quilometragem...&#10;P: Aceita boleto? R: Apenas mediante cadastro aprovado..."
          value={agentFormFaq}
          onChange={(e) => setAgentFormFaq(e.target.value)}
          className="min-h-[100px] bg-background text-xs"
        />
      </div>
      <div className="space-y-1 pt-2">
        <Label htmlFor="agent-policies" className="text-[11px] font-bold">Políticas Comerciais e Garantia</Label>
        <Textarea
          id="agent-policies"
          placeholder="Ex: Troca de tijolos apenas se danificados no transporte. Garantia de 3 meses para ferramentas elétricas..."
          value={agentFormPolicies}
          onChange={(e) => setAgentFormPolicies(e.target.value)}
          className="min-h-[100px] bg-background text-xs"
        />
      </div>
    </div>
  );

  const renderStepPersonalidade = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <Label htmlFor="agent-prompt" className="text-[11px] font-bold">Personalidade do Atendente (Instruções Principais)</Label>
        <Textarea
          id="agent-prompt"
          placeholder="Ex: Você é um atendente simpático, cordial e focado em fechar vendas de materiais..."
          value={agentFormPrompt}
          onChange={(e) => setAgentFormPrompt(e.target.value)}
          className="min-h-[120px] bg-background text-xs"
        />
      </div>
      <div className="space-y-1.5 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-bold flex items-center gap-1.5">
            <span>Temperatura (Criatividade): {Number(agentFormTemp).toFixed(2)}</span>
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs bg-card border-border p-2">
                Define a variação e criatividade das respostas da IA. Valores mais baixos (0.00 a 0.30) tornam as respostas mais conservadoras e diretas. Valores mais altos (0.70 a 1.00) tornam a fala mais criativa e expressiva.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Slider
          id="agent-temp"
          value={[agentFormTemp]}
          onValueChange={(val) => setAgentFormTemp(val[0])}
          min={0}
          max={1}
          step={0.05}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>Mais Conservador (0.00)</span>
          <span>Mais Criativo (1.00)</span>
        </div>
      </div>

      <div className="space-y-1.5 pt-2">
        <Label htmlFor="agent-response-style" className="text-[11px] font-bold">Nível de Objetividade / Estilo de Resposta</Label>
        <Select
          value={agentFormResponseStyle}
          onValueChange={(style) => {
            setAgentFormResponseStyle(style);
            setAgentFormMaxWords(getStyleWordLimit(style));
          }}
        >
          <SelectTrigger id="agent-response-style" className="bg-background h-8 text-xs">
            <SelectValue placeholder="Selecione o estilo de resposta" />
          </SelectTrigger>
          <SelectContent className="border-border bg-card/95 backdrop-blur-xl">
            <SelectItem value="short_natural" className="text-xs">Natural & Equilibrado (Padrão)</SelectItem>
            <SelectItem value="ultra_short" className="text-xs">Objetivo & Direto (Máx. 2 parágrafos curtos)</SelectItem>
            <SelectItem value="one_sentence" className="text-xs">Ultra Curto (Máx. 1 ou 2 frases curtas)</SelectItem>
            <SelectItem value="elaborate" className="text-xs">Detalhado & Explicativo (Respostas completas)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[9px] text-muted-foreground">Define se a IA deve ser direta ao ponto ou fornecer respostas longas e detalhadas.</p>
      </div>

      <div className="space-y-1.5 pt-2">
        <div className="flex justify-between items-center">
          <Label className="text-[11px] font-bold">Limite de Palavras: {agentFormMaxWords || "Automático"}</Label>
          <span className="text-[9px] text-muted-foreground">
            {agentFormMaxWords === 0 ? "Default do estilo" : `${agentFormMaxWords} palavras`}
          </span>
        </div>
        <Slider
          value={[agentFormMaxWords]}
          onValueChange={(val) => setAgentFormMaxWords(val[0])}
          min={0}
          max={250}
          step={5}
        />
        <p className="text-[9px] text-muted-foreground">Ajuste o limite de palavras para a IA respeitar estritamente no estilo selecionado.</p>
      </div>

      <div className="space-y-3 rounded-lg border border-border/50 bg-background/20 p-3">
        <div>
          <Label className="text-[11px] font-bold">Delay humanizado</Label>
          <p className="text-[9px] text-muted-foreground">Variação aleatória usada antes de responder e enquanto aparece como digitando.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="response-delay-min" className="text-[10px]">Responder após mín. (s)</Label>
            <Input
              id="response-delay-min"
              type="number"
              min={0}
              value={agentFormResponseDelayMin}
              onChange={(e) => setAgentFormResponseDelayMin(Number(e.target.value) || 0)}
              className="bg-background h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="response-delay-max" className="text-[10px]">Responder após máx. (s)</Label>
            <Input
              id="response-delay-max"
              type="number"
              min={0}
              value={agentFormResponseDelayMax}
              onChange={(e) => setAgentFormResponseDelayMax(Number(e.target.value) || 0)}
              className="bg-background h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="typing-delay-min" className="text-[10px]">Digitando mín. (s)</Label>
            <Input
              id="typing-delay-min"
              type="number"
              min={0}
              value={agentFormTypingDelayMin}
              onChange={(e) => setAgentFormTypingDelayMin(Number(e.target.value) || 0)}
              className="bg-background h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="typing-delay-max" className="text-[10px]">Digitando máx. (s)</Label>
            <Input
              id="typing-delay-max"
              type="number"
              min={0}
              value={agentFormTypingDelayMax}
              onChange={(e) => setAgentFormTypingDelayMax(Number(e.target.value) || 0)}
              className="bg-background h-8 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepHorariosTrabalho = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <Label htmlFor="agent-hours" className="text-[11px] font-bold">Instruções de Horário Personalizado</Label>
        <Textarea
          id="agent-hours"
          placeholder="Ex: Atendimento online das 7h às 20h. Fora do horário, informar educadamente que responderemos no próximo dia útil."
          value={agentFormHours}
          onChange={(e) => setAgentFormHours(e.target.value)}
          className="min-h-[140px] bg-background text-xs"
        />
      </div>
    </div>
  );

  const renderStepRegrasCustomizadas = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <Label htmlFor="agent-rules" className="text-[11px] font-bold">Regras e Restrições Comerciais</Label>
        <Textarea
          id="agent-rules"
          placeholder="Ex: Proibido conceder mais de 5% de desconto para pagamento à vista. Direcionar para cadastro se quiser parcelar."
          value={agentFormRules}
          onChange={(e) => setAgentFormRules(e.target.value)}
          className="min-h-[100px] bg-background text-xs"
        />
      </div>
      <div className="space-y-1 pt-2">
        <Label htmlFor="agent-memory" className="text-[11px] font-bold">Instruções de Memória Específicas</Label>
        <Textarea
          id="agent-memory"
          placeholder="Ex: Recordar o nome do cliente e referências de locais de entrega citadas anteriormente..."
          value={agentFormMemory}
          onChange={(e) => setAgentFormMemory(e.target.value)}
          className="min-h-[100px] bg-background text-xs"
        />
      </div>
    </div>
  );

  const renderStepTransbordoHumano = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between rounded-lg border border-border p-2.5 bg-background/10">
        <div>
          <Label htmlFor="escalation-active" className="text-xs font-semibold cursor-pointer">Ativar Transbordo Humano</Label>
          <p className="text-[9px] text-muted-foreground">Se ativo, a IA poderá acionar ou passar para um operador humano.</p>
        </div>
        <Switch
          id="escalation-active"
          checked={agentFormEscalationActive}
          onCheckedChange={setAgentFormEscalationActive}
        />
      </div>

      {agentFormEscalationActive && (
        <div className="space-y-3 pt-2 animate-fade-in">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="escalation-phone" className="text-[10px] font-bold">Telefone do Responsável</Label>
              <Input
                id="escalation-phone"
                placeholder="Ex: 5511999999999"
                value={agentFormEscalationPhone}
                onChange={(e) => setAgentFormEscalationPhone(e.target.value)}
                className="bg-background h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="escalation-whatsapp" className="text-[10px] font-bold">WhatsApp do Responsável</Label>
              <Input
                id="escalation-whatsapp"
                placeholder="Ex: 5511999999999"
                value={agentFormEscalationWhatsapp}
                onChange={(e) => setAgentFormEscalationWhatsapp(e.target.value)}
                className="bg-background h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="escalation-mode" className="text-[10px] font-bold">Modo de Transbordo</Label>
            <Select
              value={String(agentFormEscalationMode)}
              onValueChange={(val) => setAgentFormEscalationMode(Number(val))}
            >
              <SelectTrigger id="escalation-mode" className="bg-background h-8 text-xs">
                <SelectValue placeholder="Selecione o modo" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="1" className="text-xs">Modo 1: Notificar humano e IA continua</SelectItem>
                <SelectItem value="2" className="text-xs">Modo 2: Notificar humano e IA pausa</SelectItem>
                <SelectItem value="3" className="text-xs">Modo 3: Transferir totalmente para humano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-1 border-t border-border/30">
            <Label className="text-[10px] font-bold">Gatilhos de Ativação do Transbordo</Label>
            <div className="space-y-2">
              {[
                "cliente pediu humano",
                "cliente pediu ligação",
                "cliente reclamou",
                "cliente pediu orçamento complexo",
                "IA sem resposta"
              ].map((trigger) => {
                const isChecked = agentFormEscalationTriggers.includes(trigger);
                return (
                  <label key={trigger} className="flex items-center gap-2 cursor-pointer select-none text-[10px] hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTrigger(trigger)}
                      className="rounded border-border text-primary focus:ring-primary bg-background h-3.5 w-3.5"
                    />
                    <span className="capitalize">{trigger}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStepConfiguracaoVoz = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between rounded-lg border border-border p-2.5 bg-background/10">
        <div>
          <Label htmlFor="voice-enabled" className="text-xs font-semibold cursor-pointer">Responder com Voz (ElevenLabs)</Label>
          <p className="text-[9px] text-muted-foreground">Se ativo, as respostas deste atendente serão enviadas como mensagens de áudio gravadas.</p>
        </div>
        <Switch
          id="voice-enabled"
          checked={agentFormVoiceEnabled}
          onCheckedChange={setAgentFormVoiceEnabled}
        />
      </div>

      {agentFormVoiceEnabled && (
        <div className="space-y-3 pt-2 animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="voice-provider" className="text-[10px] font-bold">Provedor de Voz (TTS)</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 text-primary" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs bg-card border-border p-2">
                    Escolha o motor de síntese de voz. O Padrão Neural Grátis utiliza voz neural em Português do Brasil com excelente naturalidade humana.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={agentFormVoiceProvider}
              onValueChange={setAgentFormVoiceProvider}
            >
              <SelectTrigger id="voice-provider" className="bg-background h-8 text-xs">
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="default" className="text-xs">Padrão Neural BR Grátis (Edge TTS)</SelectItem>
                <SelectItem value="elevenlabs" className="text-xs">ElevenLabs (Chave Própria / Customizada)</SelectItem>
                <SelectItem value="openai" className="text-xs">OpenAI Audio TTS (Alloy, Onyx, Nova...)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold text-foreground">ZAPFLOW AI Voices (4 Femininas e 4 Masculinas BR)</Label>
            </div>
            
            {/* Female Voices */}
            <div className="space-y-1.5 border border-border/40 rounded-lg p-2.5 bg-background/20">
              <span className="text-[9px] font-bold uppercase tracking-wider text-pink-400">Vozes Femininas ZAPFLOW</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {[
                  { id: "zapflow-aurora", name: "ZAPFLOW Aurora", tag: "Especialista Comercial" },
                  { id: "zapflow-luna", name: "ZAPFLOW Luna", tag: "Jovem & Dinâmica" },
                  { id: "zapflow-sophia", name: "ZAPFLOW Sophia", tag: "Executiva" },
                  { id: "zapflow-maya", name: "ZAPFLOW Maya", tag: "Acolhedora" },
                ].map((v) => (
                  <div key={v.id} className={cn("flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all", agentFormVoiceId === v.id ? "border-primary bg-primary/10 font-bold" : "border-border/50 hover:bg-muted/50")} onClick={() => setAgentFormVoiceId(v.id)}>
                    <div>
                      <p className="text-[11px] leading-none font-bold text-foreground">{v.name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{v.tag}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full hover:bg-primary/20 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAgentFormVoiceId(v.id);
                        if (typeof window !== "undefined" && "speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                          const utt = new SpeechSynthesisUtterance(`Olá! Eu sou a voz ${v.name} e estou pronta para responder com alta conversão.`);
                          utt.lang = "pt-BR";
                          window.speechSynthesis.speak(utt);
                        }
                      }}
                      title="Ouvir demonstração ZAPFLOW"
                    >
                      <Play className="h-3 w-3 fill-current" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Male Voices */}
            <div className="space-y-1.5 border border-border/40 rounded-lg p-2.5 bg-background/20">
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">Vozes Masculinas ZAPFLOW</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {[
                  { id: "zapflow-orion", name: "ZAPFLOW Orion", tag: "Consultor" },
                  { id: "zapflow-atlas", name: "ZAPFLOW Atlas", tag: "Executivo" },
                  { id: "zapflow-noah", name: "ZAPFLOW Noah", tag: "Jovem" },
                  { id: "zapflow-titan", name: "ZAPFLOW Titan", tag: "Premium" },
                ].map((v) => (
                  <div key={v.id} className={cn("flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all", agentFormVoiceId === v.id ? "border-primary bg-primary/10 font-bold" : "border-border/50 hover:bg-muted/50")} onClick={() => setAgentFormVoiceId(v.id)}>
                    <div>
                      <p className="text-[11px] leading-none font-bold text-foreground">{v.name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{v.tag}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full hover:bg-primary/20 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAgentFormVoiceId(v.id);
                        if (typeof window !== "undefined" && "speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                          const utt = new SpeechSynthesisUtterance(`Olá! Eu sou a voz ${v.name} e estou pronto para responder com alta conversão.`);
                          utt.lang = "pt-BR";
                          window.speechSynthesis.speak(utt);
                        }
                      }}
                      title="Ouvir demonstração ZAPFLOW"
                    >
                      <Play className="h-3 w-3 fill-current" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="voice-rule" className="text-[10px] font-bold">Regra de Envio de Voz</Label>
            <Select
              value={agentFormVoiceRule}
              onValueChange={setAgentFormVoiceRule}
            >
              <SelectTrigger id="voice-rule" className="bg-background h-8 text-xs">
                <SelectValue placeholder="Selecione uma regra" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="always" className="text-xs">Sempre responder em áudio humanizado</SelectItem>
                <SelectItem value="voice_in" className="text-xs">Responder em áudio somente quando receber mensagem de áudio</SelectItem>
                <SelectItem value="smart" className="text-xs">Modo Inteligente (Texto longo, explicações e saudações em áudio)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(agentFormVoiceId === "custom" || !["21m00Tcm4TlvDq8ikWAM", "AZnzlk1XvdvUeBnXmlld", "EXAVITQu4vr4xnSDxMaL", "ErXwobaYiN019PkySvjV", "MF3mGyEYCl7XYW7tl59X"].includes(agentFormVoiceId)) && (
            <div className="space-y-1 animate-fade-in">
              <Label htmlFor="custom-voice-id" className="text-[10px] font-bold">Voice ID Personalizado</Label>
              <Input
                id="custom-voice-id"
                placeholder="Digite o ElevenLabs Voice ID"
                value={agentFormVoiceId === "custom" ? "" : agentFormVoiceId}
                onChange={(e) => setAgentFormVoiceId(e.target.value)}
                className="bg-background h-8 text-xs"
              />
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-border/30">
            <Label htmlFor="voice-test-text" className="text-[10px] font-bold">Texto de Teste para Voz</Label>
            <div className="flex gap-2">
              <Input
                id="voice-test-text"
                placeholder="Olá! Sou o seu assistente de voz e estou pronto para conversar."
                value={voiceTestText}
                onChange={(e) => setVoiceTestText(e.target.value)}
                className="bg-background h-8 text-xs flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleTestVoice}
                disabled={testingVoice || !voiceTestText.trim()}
                className="h-8 text-xs"
              >
                {testingVoice ? "Gerando..." : "Testar Voz"}
              </Button>
            </div>
            {voiceAudioUrl && (
              <div className="pt-2 animate-fade-in">
                <audio src={voiceAudioUrl} controls className="w-full h-8" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderStepFollowUp = () => (
    <div className="space-y-4 animate-fade-in">
      <Card className="border border-border/60 bg-card/60 shadow-sm">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-bold">Mensagens de Follow-Up</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs bg-card border-border p-2">
                Configure as mensagens de reativação automática para clientes que pararam de responder.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <div>
              <Label className="text-xs font-semibold cursor-pointer">Ativar Follow-Up</Label>
              <p className="text-[9px] text-muted-foreground">Envie mensagens automáticas para reaquecer o lead.</p>
            </div>
            <Switch checked={followUpActive} onCheckedChange={setFollowUpActive} />
          </div>

          {followUpActive && (
            <div className="space-y-3 pt-1 animate-fade-in">
              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <div>
                  <Label className="text-xs font-semibold cursor-pointer">Gerar mensagens por IA</Label>
                  <p className="text-[9px] text-muted-foreground">A IA analisará a conversa e criará o follow-up mais adequado.</p>
                </div>
                <Switch checked={followUpAiGenerated} onCheckedChange={setFollowUpAiGenerated} />
              </div>

              {followUpAiGenerated && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex items-center gap-1.5"
                      onClick={() => setIsFollowUpModalOpen(true)}
                    >
                      <Pencil className="h-3 w-3" /> Editar Prompt de Follow-Up
                    </Button>
                    
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleGenerateFollowUpPromptByAI}
                      disabled={generatingFollowUpPrompt}
                    >
                      {generatingFollowUpPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Gerar Follow-up por IA com base no atendente
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Qtd mensagens</Label>
                  <Select value={String(followUpCount)} onValueChange={(val) => setFollowUpCount(Number(val))}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">1 mensagem</SelectItem>
                      <SelectItem value="2" className="text-xs">2 mensagens</SelectItem>
                      <SelectItem value="3" className="text-xs">3 mensagens</SelectItem>
                      <SelectItem value="4" className="text-xs">4 mensagens</SelectItem>
                      <SelectItem value="5" className="text-xs">5 mensagens</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Verificação (min)</Label>
                  <Input
                    type="number"
                    value={followUpCheckMin}
                    onChange={(e) => setFollowUpCheckMin(Number(e.target.value) || 300)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Intervalo (hrs)</Label>
                  <Input
                    type="number"
                    value={followUpIntervalHours}
                    onChange={(e) => setFollowUpIntervalHours(Number(e.target.value) || 8)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <div>
                  <Label className="text-xs font-semibold cursor-pointer">Respeitar horário comercial</Label>
                  <p className="text-[9px] text-muted-foreground">Não envia follow-ups fora do horário de expediente.</p>
                </div>
                <Switch checked={followUpRespectBusinessHours} onCheckedChange={setFollowUpRespectBusinessHours} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderStepMidiaComIA = () => (
    <div className="space-y-4 animate-fade-in">
      <Card className="border border-border/60 bg-card/60 shadow-sm">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-bold">Mídia com IA</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs bg-card border-border p-2">
                Cadastre fotos, tabelas em PDF, documentos ou vídeos da sua loja. A IA analisará o conteúdo e enviará automaticamente ao cliente quando solicitado.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 text-xs text-primary-foreground/90 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-primary">
              <Info className="h-3.5 w-3.5" /> Como funciona
            </p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Ao habilitar esta opção, a IA poderá enviar imagens, documentos (PDF), áudios e vídeos diretamente para o cliente durante o atendimento, caso o assunto exija.
            </p>
            <p className="text-[9px] text-muted-foreground/80 font-mono pt-0.5">
              Extensões aceitas: JPG, PNG, GIF, WEBP, MP4, AVI, MOV, MKV, WEBM, MP3, OGG, OPUS, M4A, WAV, AAC, FLAC, PDF, DOCX, TXT, RTF.
            </p>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <div>
              <Label className="text-xs font-semibold cursor-pointer">Habilitar Mídia com IA</Label>
              <p className="text-[9px] text-muted-foreground">Permite o envio inteligente de arquivos durante a conversa.</p>
            </div>
            <Switch checked={mediaAiEnabled} onCheckedChange={setMediaAiEnabled} />
          </div>

          {!mediaAiEnabled && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-[10px] text-amber-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>As mídias cadastradas não serão utilizadas pela IA enquanto esta opção estiver desabilitada.</span>
            </div>
          )}

          {mediaAiEnabled && (
            <div className="space-y-3 pt-1 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Mídias Cadastradas ({registeredMediaList.length})</span>
                <label className="cursor-pointer">
                  <input type="file" className="hidden" onChange={handleFileUploadMediaAI} disabled={analyzingMedia} />
                  <Button type="button" size="sm" variant="default" className="h-7 text-xs flex items-center gap-1.5" disabled={analyzingMedia} asChild>
                    <span>
                      {analyzingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      <span>+ Adicionar Mídias</span>
                    </span>
                  </Button>
                </label>
              </div>

              <div className="space-y-2">
                {registeredMediaList.map((media) => (
                  <div key={media.id} className="p-3 rounded-lg border border-border/50 bg-background/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs font-bold text-foreground">{media.fileName}</p>
                          <span className="text-[9px] text-muted-foreground uppercase">{media.fileType} • {media.fileSize}</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => setRegisteredMediaList((prev) => prev.filter((m) => m.id !== media.id))}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-1.5 text-[10px]">
                      <div className="bg-primary/10 p-2 rounded border border-primary/20">
                        <span className="font-bold text-primary block">Descrição IA (Com base no atendente):</span>
                        <p className="text-foreground/90 mt-0.5">{media.descricaoIa}</p>
                      </div>
                      <div className="bg-background/50 p-2 rounded border border-border/30">
                        <span className="font-bold text-muted-foreground block">Descrição Humana:</span>
                        <p className="text-foreground/80 mt-0.5">{media.descricaoHumana}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {registeredMediaList.length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                    Nenhuma mídia cadastrada ainda. Clique no botão acima para adicionar arquivos.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderStepRevisaoGeral = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col items-center justify-center text-center py-2 space-y-2 border-b border-border/30 pb-3">
        <CheckCircle className="h-8 w-8 text-emerald-500 animate-bounce" />
        <h4 className="font-bold text-foreground text-xs">Revisão do Atendente</h4>
        <p className="text-[9px] text-muted-foreground max-w-xs">Revise o resumo antes de salvar as configurações de {agentFormName}.</p>
      </div>

      <div className="space-y-2 text-[10px] leading-relaxed">
        <div className="grid grid-cols-2 gap-2 bg-background/30 p-2 rounded border border-border/40">
          <div>
            <span className="block text-muted-foreground text-[8px]">Perfil</span>
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              {getAgentAvatarIcon(agentFormAvatar, "h-3.5 w-3.5 text-primary")}
              <span>{agentFormName} ({agentFormSector})</span>
            </div>
          </div>
          <div>
            <span className="block text-muted-foreground text-[8px]">Empresa</span>
            <span className="font-bold text-foreground">{agentFormCompany || "Vista Alegre"}</span>
          </div>
        </div>

        <div className="bg-background/30 p-2 rounded border border-border/40">
          <span className="block text-muted-foreground text-[8px]">Transbordo Humano</span>
          <span className="font-medium text-foreground">
            {agentFormEscalationActive 
              ? `Ativo - Modo ${agentFormEscalationMode} (${agentFormEscalationTriggers.length} gatilhos)` 
              : "Inativo"}
          </span>
        </div>

        <div className="bg-background/30 p-2 rounded border border-border/40">
          <span className="block text-muted-foreground text-[8px]">IA de Voz</span>
          <span className="font-medium text-foreground">
            {agentFormVoiceEnabled 
              ? `Ativo (${agentFormVoiceProvider === "default" ? `Voz Padrão ${agentFormVoiceGender === "male" ? "Masc" : "Fem"}` : "ElevenLabs"}) - Regra: ${
                  agentFormVoiceRule === "always" 
                    ? "Sempre" 
                    : agentFormVoiceRule === "voice_in"
                    ? "Se receber áudio"
                    : "Smart"
                }` 
              : "Inativo"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-2.5 bg-background/10 mt-2">
        <div className="text-left">
          <p className="text-xs font-semibold">Atendente Ativo</p>
          <p className="text-[10px] text-muted-foreground">Define se este atendente responderá interações automaticamente.</p>
        </div>
        <Switch checked={agentFormActive} onCheckedChange={setAgentFormActive} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-container section-stack">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-3 backdrop-blur-xl md:p-6 space-y-6">
          
          {/* Summary Dashboard Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Status Geral da IA</p>
                  <p className="text-lg font-bold mt-1 text-foreground">{aiEnabled ? "Ativada" : "Desativada"}</p>
                </div>
                <OperationalStatusBadge label={aiEnabled ? "Assistente online" : "Assistente offline"} tone={aiEnabled ? "online" : "offline"} />
              </CardContent>
            </Card>

            <Card className="metric-card rounded-2xl border-border/70 bg-card/85 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Tráfego de Respostas</p>
                <p className="text-lg font-bold mt-1 text-foreground">{aiMetrics?.messagesToday ?? 0} hoje</p>
                <OperationalStatusBadge label="Tráfego ativo" tone="online" />
              </CardContent>
            </Card>

            <Card className="metric-card rounded-2xl border-border/70 bg-card/85 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Fila de Reativação</p>
                <p className="text-lg font-bold mt-1 text-foreground">{queueWaiting} leads</p>
                <OperationalStatusBadge label="Reativação monitorada" tone="syncing" />
              </CardContent>
            </Card>
          </div>

          {/* Internal Navigation Menu & Content Panel Split */}
          <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-h-[600px]">
            
            {/* Sidebar Menu */}
            <aside className="w-full lg:w-[240px] shrink-0 bg-card/50 border border-border/60 rounded-2xl p-4 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">IA & Automação</div>
              
              <button
                onClick={() => onSectionChange("dashboard")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "dashboard" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard IA</span>
              </button>

              <button
                onClick={() => onSectionChange("atendentes")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "atendentes" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Users className="h-4 w-4" />
                <span>Atendentes</span>
              </button>

              <button
                onClick={() => onSectionChange("provedores")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "provedores" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Cpu className="h-4 w-4" />
                <span>Provedores</span>
              </button>

              <button
                onClick={() => onSectionChange("conhecimento")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "conhecimento" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <GraduationCap className="h-4 w-4" />
                <span>Conhecimento</span>
              </button>

              <button
                onClick={() => onSectionChange("operacao")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "operacao" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Sliders className="h-4 w-4" />
                <span>Operação</span>
              </button>

              <button
                onClick={() => onSectionChange("analise")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "analise" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Análise</span>
              </button>
            </aside>

            {/* Content Display */}
            <main className="flex-1 w-full min-w-0 bg-card/20 border border-border/50 rounded-2xl p-4 md:p-6 shadow-sm min-h-[500px]">
              
              {/* TAB 1: DASHBOARD IA */}
              {activeInternalTab === "dashboard" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <LayoutDashboard className="h-4 w-4 text-primary" /> Painel de Controle IA
                    </h3>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Status Toggle & Health */}
                    <div className="space-y-4">
                      <Card className="glass-card">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs font-semibold flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" /> Ativar Atendimento Automático
                          </CardTitle>
                          <CardDescription className="text-[11px]">Controle a resposta automática global do chatbot.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-1 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Atendimento ativo pelo motor de IA</span>
                          <Switch checked={aiEnabled} onCheckedChange={onStatusToggle} />
                        </CardContent>
                      </Card>

                      <Card className="glass-card">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                          <div>
                            <CardTitle className="text-xs font-semibold flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-primary" /> Saúde e Integridade do Sistema
                            </CardTitle>
                            <CardDescription className="text-[11px] mt-0.5">Diagnósticos das integrações e serviços críticos.</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] px-2.5 rounded-lg flex items-center gap-1 hover:text-primary"
                              onClick={handleDeployVPS}
                              disabled={deployingVPS}
                            >
                              {deployingVPS ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                              <span>Deploy VPS</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] px-2.5 rounded-lg flex items-center gap-1 hover:text-primary"
                              onClick={handleRestartAI}
                              disabled={restartingAI}
                            >
                              {restartingAI ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              <span>Reiniciar IA</span>
                            </Button>
                            
                            <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5 rounded-lg flex items-center gap-1">
                                  <Terminal className="h-3.5 w-3.5" /> Testar IA
                                </Button>
                              </DialogTrigger>
                            <DialogContent className="max-w-md rounded-2xl border-border bg-card">
                              <DialogHeader>
                                <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                  <Terminal className="h-4 w-4 text-primary" /> Testar Resposta da IA
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                  Envie uma mensagem simulando o comportamento de um atendente selecionado.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-2">
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-semibold">Selecionar Atendente</Label>
                                                                  <Select value={localTestAttendant} onValueChange={setLocalTestAttendant}>
                                    <SelectTrigger className="h-9 text-xs">
                                      <SelectValue placeholder="Selecione o atendente para o teste" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(agents || []).map((agent) => (
                                        <SelectItem key={agent.key} value={agent.key} className="text-xs">
                                          {agent.name} ({agent.sector})
                                        </SelectItem>
                                      ))}
                                      {(agents || []).length === 0 && (
                                        <SelectItem value="default" className="text-xs">
                                          Nenhum atendente cadastrado (Simulador padrão)
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-semibold">Mensagem de Teste</Label>
                                  <Textarea
                                    value={localTestMessage}
                                    onChange={(e) => setLocalTestMessage(e.target.value)}
                                    placeholder="Digite a mensagem que o cliente enviaria..."
                                    className="min-h-[80px] text-xs resize-none"
                                  />
                                </div>

                                {localTestResult && (
                                  <div className="p-3.5 rounded-xl border border-border/80 bg-muted/40 space-y-3">
                                    <h4 className="text-[11px] font-bold text-foreground">Resultado da Simulação</h4>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                      <div className="p-2 rounded-lg bg-background border border-border/40">
                                        <span className="block text-[8px] uppercase tracking-wide text-muted-foreground">Tempo</span>
                                        <span className="text-xs font-bold text-foreground">
                                          {localTestResult.responseTimeMs > 0 ? `${localTestResult.responseTimeMs}ms` : "--"}
                                        </span>
                                      </div>
                                      <div className="p-2 rounded-lg bg-background border border-border/40">
                                        <span className="block text-[8px] uppercase tracking-wide text-muted-foreground">Modelo</span>
                                        <span className="text-xs font-bold text-foreground truncate block">
                                          {localTestResult.model || "N/A"}
                                        </span>
                                      </div>
                                      <div className="p-2 rounded-lg bg-background border border-border/40">
                                        <span className="block text-[8px] uppercase tracking-wide text-muted-foreground">Status</span>
                                        <span className={cn(
                                          "text-xs font-bold block truncate",
                                          localTestResult.ok ? "text-emerald-500" : "text-destructive"
                                        )}>
                                          {localTestResult.status}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-2 text-xs">
                                      <span className="font-semibold block text-muted-foreground mb-1">Resposta do Atendente:</span>
                                      <div className="p-2.5 rounded-lg bg-background border border-border/60 text-foreground leading-relaxed whitespace-pre-wrap">
                                        {localTestResult.ok ? localTestResult.response : localTestResult.error}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <DialogFooter className="gap-2 sm:gap-0 mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setIsTestModalOpen(false)}
                                  className="text-xs"
                                >
                                  Fechar
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={localTestingAI}
                                  onClick={handleRunAITest}
                                  className="text-xs flex items-center gap-1"
                                >
                                  {localTestingAI ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" /> Testando...
                                    </>
                                  ) : (
                                    "Simular Mensagem"
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-2">
                          {aiHealthItems.map((item) => (
                            <div key={item.label} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                              <span className="text-muted-foreground">{item.label}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">{item.detail}</span>
                                <span className={cn("h-2 w-2 rounded-full", item.ok ? "bg-emerald-500" : "bg-destructive")} />
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Overview / Stats */}
                    <div className="space-y-4">
                      <Card className="glass-card">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs font-semibold flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" /> Visão Geral do Sistema
                          </CardTitle>
                          <CardDescription className="text-[11px]">Estatísticas de uso e tráfego da IA no dia de hoje.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded border border-border/40 p-2.5 bg-background/20">
                              <span className="block text-[10px] text-muted-foreground">Mensagens de IA</span>
                              <span className="text-sm font-bold text-foreground">{aiMetrics?.messagesToday ?? 0}</span>
                            </div>
                            <div className="rounded border border-border/40 p-2.5 bg-background/20">
                              <span className="block text-[10px] text-muted-foreground">Tokens Utilizados</span>
                              <span className="text-sm font-bold text-foreground">{aiMetrics?.tokensToday ?? 0}</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-relaxed p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                            A IA do ZAPFLOW opera com atendentes segmentados para qualificação, suporte e financeiro, integrados com memórias de cliente e regras de transbordo automatizadas.
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ATENDENTES */}
              {activeInternalTab === "atendentes" && (
                <div className="space-y-6">
                  {/* Subtabs Menu */}
                  <div className="flex gap-2 border-b border-border/60 pb-2">
                    <button
                      onClick={() => setActiveAtendentesSubTab("lista")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeAtendentesSubTab === "lista" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Meus Atendentes
                    </button>
                    <button
                      onClick={() => setActiveAtendentesSubTab("simulador")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeAtendentesSubTab === "simulador" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Simulador de Conversa
                    </button>
                    <button
                      onClick={() => setActiveAtendentesSubTab("evolucao")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeAtendentesSubTab === "evolucao" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Evolução do Atendente
                    </button>
                  </div>

                  {activeAtendentesSubTab === "lista" && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Atendentes Ativos</h3>
                        <Button onClick={handleOpenAddAgent} size="sm" className="h-8 gap-1">
                          <Plus className="h-4 w-4" /> Novo Atendente
                        </Button>
                      </div>

                      {loadingAgents ? (
                        <div className="flex h-36 items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {(agents || []).map((agent) => (
                            <Card key={agent.key || agent.name} className="relative overflow-hidden border border-border/60 bg-card/45 hover:border-primary/20 transition-all shadow-sm">
                              <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                  {getAgentAvatarIcon(agent.avatar, "h-5 w-5")}
                                </div>
                                <div className="min-w-0 flex-grow">
                                  <CardTitle className="text-xs font-bold text-foreground truncate">{agent.name}</CardTitle>
                                  <CardDescription className="text-[10px] text-muted-foreground truncate">{agent.sector || "Comercial"}</CardDescription>
                                </div>
                                <Switch
                                  checked={agent.active !== false}
                                  onCheckedChange={(checked) => void onToggleAgent(agent.key || agent.name, checked)}
                                />
                              </CardHeader>
                              <CardContent className="p-4 pt-1 space-y-2 text-xs">
                                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                                  {agent.personality || agent.prompt || "Sem personalidade definida."}
                                </p>
                                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Temp: {agent.temperature ?? 0.7}</span>
                                  <TooltipProvider>
                                    <div className="flex gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            onClick={() => handleOpenEditAgent(agent)}
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-[10px]">Editar atendente</p>
                                        </TooltipContent>
                                      </Tooltip>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                              if (onCloneAgent) {
                                                void onCloneAgent(agent.key || agent.name);
                                              }
                                            }}
                                          >
                                            <Copy className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-[10px]">Clonar atendente</p>
                                        </TooltipContent>
                                      </Tooltip>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive hover:text-destructive/80"
                                            onClick={() => {
                                              if (window.confirm(`Tem certeza que deseja excluir o atendente ${agent.name}?`)) {
                                                if (onDeleteAgent) {
                                                  void onDeleteAgent(agent.key || agent.name);
                                                }
                                              }
                                            }}
                                          >
                                            <Trash className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-[10px]">Excluir atendente</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TooltipProvider>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          {(agents || []).length === 0 && (
                            <div className="sm:col-span-2 py-8 text-center text-xs text-muted-foreground bg-background/20 rounded-xl border border-dashed border-border">
                              Nenhum atendente cadastrado. Crie um novo para iniciar.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeAtendentesSubTab === "simulador" && (
                    <div className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-3">
                        {/* Chat Box */}
                        <Card className="md:col-span-2 flex flex-col h-[480px] border border-border/60 bg-background/25">
                          <CardHeader className="p-3 border-b border-border/50 flex flex-row items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                              <Select value={simSelectedAgent} onValueChange={setSimSelectedAgent}>
                                <SelectTrigger className="h-7 text-[11px] w-48 bg-background/50">
                                  <SelectValue placeholder="Selecione Atendente" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                  {(agents || []).map((a) => (
                                    <SelectItem key={a.key || a.name} value={a.key || a.name} className="text-xs">
                                      <div className="flex items-center gap-2">
                                        {getAgentAvatarIcon(a.avatar, "h-3.5 w-3.5 text-primary")}
                                        <span>{a.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                  {agents.length === 0 && (
                                    <SelectItem value="camila" className="text-xs">
                                      <div className="flex items-center gap-2">
                                        {getAgentAvatarIcon("user", "h-3.5 w-3.5 text-primary")}
                                        <span>Simulador padrão</span>
                                      </div>
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <Badge variant="outline" className="h-5 rounded-full text-[9px] uppercase">Simulando</Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleRestartAI}
                                disabled={restartingAI}
                                className="h-7 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center gap-1"
                              >
                                {restartingAI ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                <span>Reiniciar IA</span>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={handleClearSim} className="h-7 text-[10px] text-destructive hover:bg-destructive/10">
                                Limpar
                              </Button>
                            </div>
                          </CardHeader>
                          
                          {/* Messages Container */}
                          <CardContent className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin">
                            {simMessages.map((msg, index) => (
                              <div
                                key={index}
                                className={cn(
                                  "flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-normal shadow-sm",
                                  msg.sender === "user"
                                    ? "bg-primary text-primary-foreground ml-auto rounded-tr-none"
                                    : "bg-card border border-border/60 text-foreground mr-auto rounded-tl-none"
                                )}
                              >
                                <span className="font-bold text-[9px] uppercase tracking-wide opacity-75 mb-1">
                                  {msg.sender === "user" ? "Cliente (Você)" : "Atendente IA"}
                                </span>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            ))}
                            {simLoading && (
                              <div className="bg-card border border-border/60 text-foreground mr-auto rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                <span className="text-[10px] text-muted-foreground animate-pulse">{simStatus}</span>
                              </div>
                            )}
                          </CardContent>

                          <div className="p-3 border-t border-border/50 flex gap-2 shrink-0">
                            <Input
                              placeholder="Digite como se fosse um cliente no WhatsApp..."
                              value={simInput}
                              onChange={(e) => setSimInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSimSend()}
                              className="bg-background h-9 text-xs"
                              disabled={simLoading}
                            />
                            <Button size="icon" onClick={handleSimSend} disabled={simLoading || !simInput.trim()} className="h-9 w-9">
                              <PaperPlaneTilt className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>

                        {/* Observability Box */}
                        <Card className="rounded-xl border border-border bg-background/25 p-3 text-xs flex flex-col justify-between h-[480px] overflow-y-auto">
                          <div>
                            <div className="flex border-b border-border/50 pb-2 mb-3 gap-3 justify-start items-center">
                              <button
                                onClick={() => setSimTab("ajuste")}
                                className={cn(
                                  "text-[10px] uppercase font-bold tracking-wider pb-1 transition-all border-b-2",
                                  simTab === "ajuste" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                              >
                                Ajuste Rápido
                              </button>
                              <button
                                onClick={() => setSimTab("metricas")}
                                className={cn(
                                  "text-[10px] uppercase font-bold tracking-wider pb-1 transition-all border-b-2",
                                  simTab === "metricas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                              >
                                Auditoria & Métricas
                              </button>
                            </div>

                            {simTab === "ajuste" ? (
                              <div className="space-y-3 mt-1 animate-fade-in">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <Label htmlFor="sim-prompt" className="text-[10px] font-bold text-foreground">Instruções de Personalidade (Prompt)</Label>
                                    <span className="text-[9px] text-muted-foreground">{simAgentPrompt.length} chars</span>
                                  </div>
                                  <Textarea
                                    id="sim-prompt"
                                    value={simAgentPrompt}
                                    onChange={(e) => setSimAgentPrompt(e.target.value)}
                                    placeholder="Instruções principais de atendimento..."
                                    className="min-h-[120px] bg-background/50 text-[11px] leading-relaxed resize-y scrollbar-thin font-sans"
                                  />
                                </div>

                                <div className="space-y-1 bg-primary/5 p-2 rounded-lg border border-primary/10">
                                  <Label htmlFor="ai-refinement" className="text-[10px] font-bold text-foreground flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                                    Ajustar Instruções via Prompt com IA
                                  </Label>
                                  <div className="flex gap-1.5 mt-1">
                                    <Input
                                      id="ai-refinement"
                                      placeholder="Ex: adicione 10% de desconto no PIX e retire boleto..."
                                      value={refinementInstruction}
                                      onChange={(e) => setRefinementInstruction(e.target.value)}
                                      className="h-7 text-[11px] bg-background"
                                      disabled={refiningPrompt}
                                      onKeyDown={(e) => e.key === "Enter" && handleRefinePrompt()}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={handleRefinePrompt}
                                      disabled={refiningPrompt || !refinementInstruction.trim()}
                                      className="h-7 px-2.5 text-[10px] gap-1 shrink-0"
                                    >
                                      {refiningPrompt ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-3 w-3" />
                                      )}
                                      Ajustar
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <Label className="text-[10px] font-bold text-foreground">Temperatura (Criatividade): {simTemp}</Label>
                                    <span className="text-[9px] text-muted-foreground">
                                      {simTemp <= 0.2 ? "Conservador" : simTemp >= 0.8 ? "Criativo" : "Equilibrado"}
                                    </span>
                                  </div>
                                  <Slider
                                    value={[simTemp]}
                                    onValueChange={(val) => setSimTemp(val[0])}
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    className="py-1"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <Label htmlFor="sim-style" className="text-[10px] font-bold text-foreground">Estilo de Resposta (Objetividade)</Label>
                                  <Select
                                    value={simStyle}
                                    onValueChange={(style) => {
                                      setSimStyle(style);
                                      setSimMaxWords(getStyleWordLimit(style));
                                    }}
                                  >
                                    <SelectTrigger id="sim-style" className="bg-background/50 h-7 text-xs">
                                      <SelectValue placeholder="Selecione o estilo" />
                                    </SelectTrigger>
                                    <SelectContent className="border-border bg-card/95 backdrop-blur-xl">
                                      <SelectItem value="short_natural" className="text-xs">Natural & Equilibrado (Padrão)</SelectItem>
                                      <SelectItem value="ultra_short" className="text-xs">Objetivo & Direto (Máx. 2 parágrafos)</SelectItem>
                                      <SelectItem value="one_sentence" className="text-xs">Ultra Curto (Máx. 1 ou 2 frases)</SelectItem>
                                      <SelectItem value="elaborate" className="text-xs">Detalhado & Explicativo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <Label className="text-[10px] font-bold text-foreground">Limite de Palavras: {simMaxWords || "Automático"}</Label>
                                    <span className="text-[9px] text-muted-foreground">
                                      {simMaxWords === 0 ? "Default do estilo" : `${simMaxWords} palavras`}
                                    </span>
                                  </div>
                                  <Slider
                                    value={[simMaxWords]}
                                    onValueChange={(val) => setSimMaxWords(val[0])}
                                    min={0}
                                    max={250}
                                    step={5}
                                    className="py-1"
                                  />
                                </div>

                                {(() => {
                                  const lastBotMsg = simMessages.filter(m => m.sender === "bot").slice(-1)[0]?.content || "";
                                  const botWordCount = lastBotMsg ? lastBotMsg.trim().split(/\s+/).filter(Boolean).length : 0;
                                  const botCharCount = lastBotMsg ? lastBotMsg.length : 0;
                                  
                                  if (botWordCount === 0) return null;

                                  return (
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-primary/5 border border-primary/10 text-[10px] shrink-0">
                                      <span className="font-semibold text-primary">Tamanho da Resposta:</span>
                                      <span className="font-mono font-bold text-foreground">{botWordCount} palavras ({botCharCount} ch)</span>
                                    </div>
                                  );
                                })()}

                                <Button
                                  size="sm"
                                  onClick={handleSaveSimSettings}
                                  disabled={savingSimSettings || simLoading}
                                  className="w-full text-xs h-8 gap-1.5 rounded-lg shadow-glow"
                                >
                                  {savingSimSettings ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <FloppyDisk className="h-3.5 w-3.5" />
                                  )}
                                  Salvar no Atendente
                                </Button>
                              </div>
                            ) : (
                              <div className="animate-fade-in">
                                {simMetrics ? (
                                  <div className="space-y-4 mt-1">
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                      <div className="rounded border border-border/50 p-2 bg-background/30">
                                        <span className="block text-muted-foreground text-[9px]">Latência</span>
                                        <span className="font-bold text-foreground text-xs">{simMetrics.responseTimeMs ? `${simMetrics.responseTimeMs}ms` : "n/d"}</span>
                                      </div>
                                      <div className="rounded border border-border/50 p-2 bg-background/30">
                                        <span className="block text-muted-foreground text-[9px]">Tokens Totais</span>
                                        <span className="font-bold text-foreground text-xs">{simMetrics.totalTokens ?? "n/d"}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                      <span className="block text-muted-foreground text-[9px]">Provedor / Modelo</span>
                                      <span className="font-semibold text-foreground text-[10px] uppercase">{simMetrics.provider || "openai"} ({simMetrics.model || "padrão"})</span>
                                    </div>

                                    {simMetrics.analysis && (
                                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-2 mt-1">
                                        <span className="block font-bold text-primary text-[10px] uppercase">Resultado da Auto-Análise de Lead</span>
                                        
                                        {simMetrics.analysis.funnel_stage && (
                                          <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-muted-foreground">Estágio do Funil:</span>
                                            <span className="font-semibold text-foreground bg-primary/10 px-1.5 py-0.5 rounded capitalize">
                                              {simMetrics.analysis.funnel_stage}
                                            </span>
                                          </div>
                                        )}

                                        {Array.isArray(simMetrics.analysis.tags_to_add) && simMetrics.analysis.tags_to_add.length > 0 && (
                                          <div className="flex flex-col gap-1 text-[10px]">
                                            <span className="text-muted-foreground">Tags a Adicionar:</span>
                                            <div className="flex flex-wrap gap-1">
                                              {simMetrics.analysis.tags_to_add.map((tag: string, idx: number) => (
                                                <span key={idx} className="bg-background border border-border px-1 py-0.5 rounded text-[9px]">
                                                  {tag}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {simMetrics.analysis.address && (
                                          <div className="flex flex-col gap-0.5 text-[10px]">
                                            <span className="text-muted-foreground">Endereço de Entrega:</span>
                                            <span className="font-mono text-foreground bg-background/50 p-1 rounded break-words border border-border/50">
                                              {simMetrics.analysis.address}
                                            </span>
                                          </div>
                                        )}

                                        {simMetrics.analysis.phone && (
                                          <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-muted-foreground">Telefone:</span>
                                            <span className="font-mono font-semibold text-foreground">
                                              {simMetrics.analysis.phone}
                                            </span>
                                          </div>
                                        )}

                                        {simMetrics.analysis.coordinates && (
                                          <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-muted-foreground">Coordenadas Resolvidas:</span>
                                            <span className="font-mono text-success bg-success/15 px-1 py-0.5 rounded font-bold">
                                              {simMetrics.analysis.coordinates.lat.toFixed(5)}, {simMetrics.analysis.coordinates.lng.toFixed(5)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {!simMetrics.ok && simMetrics.error && (
                                      <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-[10px] text-destructive">
                                        <span className="block font-bold uppercase text-[9px] mb-1">Falha no teste</span>
                                        <p className="whitespace-pre-wrap break-words">{simMetrics.error}</p>
                                      </div>
                                    )}

                                    {simMetrics.promptTokens && (
                                      <div className="text-[9px] text-muted-foreground flex justify-between p-1.5 rounded bg-background/40">
                                        <span>Input: {simMetrics.promptTokens}</span>
                                        <span>Output: {simMetrics.completionTokens}</span>
                                      </div>
                                    )}

                                    <div className="space-y-1">
                                      <span className="block text-muted-foreground text-[9px]">Memórias Utilizadas</span>
                                      <p className="text-[10px] bg-background/40 p-2 rounded text-foreground border border-border/30 line-clamp-3" title={simMetrics.memoriesUsed}>
                                        {simMetrics.memoriesUsed || "Padrão global (último pedido, preferências)"}
                                      </p>
                                    </div>

                                    <div className="space-y-1">
                                      <span className="block text-muted-foreground text-[9px]">Regras de Negócio Disparadas</span>
                                      <p className="text-[10px] bg-background/40 p-2 rounded text-foreground border border-border/30 line-clamp-3" title={simMetrics.rulesTriggered}>
                                        {simMetrics.rulesTriggered || "Padrão global (reativação automática)"}
                                      </p>
                                    </div>

                                    {simMetrics.fullPrompt && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button size="sm" variant="outline" className="w-full text-[9px] h-7 gap-1">
                                            <BookOpen className="h-3 w-3" /> Ver Prompt Final Montado
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl bg-card border-border text-foreground">
                                          <DialogHeader>
                                            <DialogTitle className="text-xs font-bold">Prompt Final Enviado ao LLM</DialogTitle>
                                            <DialogDescription className="text-[11px]">
                                              Este é o prompt compilado com as diretrizes do atendente, regras do negócio, horas e memórias.
                                            </DialogDescription>
                                          </DialogHeader>
                                          <pre className="text-[10px] bg-background p-3 rounded-lg overflow-y-auto max-h-[350px] whitespace-pre-wrap font-mono border border-border/50 text-muted-foreground">
                                            {simMetrics.fullPrompt}
                                          </pre>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-center text-[10px] text-muted-foreground h-72">
                                    <AIIcon className="h-8 w-8 mb-2 text-muted-foreground/40 animate-pulse" />
                                    <span>Envie uma mensagem no simulador ao lado para auditar a montagem do prompt final e consumo de tokens.</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {simMetrics && (
                            <div
                              className={cn(
                                "text-[9px] rounded p-1.5 text-center flex items-center justify-center gap-1.5 shrink-0 mt-3 border",
                                simMetrics.ok
                                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  : "text-destructive bg-destructive/10 border-destructive/20"
                              )}
                            >
                              {simMetrics.ok ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                              {simMetrics.ok ? "Resposta concluída com sucesso" : "Teste concluído com falha"}
                            </div>
                          )}
                        </Card>
                      </div>
                    </div>
                  )}

                  {activeAtendentesSubTab === "evolucao" && (
                    <div className="space-y-6 animate-fade-in">
                      {/* Cabecalho de Selecao */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/35 border border-border/50 rounded-xl p-4 shadow-sm">
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-foreground">Painel de Evolução do Atendente</h3>
                          <p className="text-[11px] text-muted-foreground">Melhore, ajuste e ensine novas informações ao seu atendente de forma contínua.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="evolution-agent-select" className="text-xs font-semibold text-foreground shrink-0">Atendente:</Label>
                          <Select value={selectedAgentKey} onValueChange={setSelectedAgentKey}>
                            <SelectTrigger id="evolution-agent-select" className="h-9 text-xs w-48 bg-background/50">
                              <SelectValue placeholder="Selecione o Atendente" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {(agents || []).map((a) => (
                                <SelectItem key={a.key || a.name} value={a.key || a.name} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    {getAgentAvatarIcon(a.avatar, "h-3.5 w-3.5 text-primary")}
                                    <span>{a.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleDetectGaps}
                            className="h-9 text-xs gap-1 rounded-lg hover:bg-primary/5"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Detectar Dúvidas
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.6fr]">
                        <Card className="overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card/60 to-card/40">
                          <CardContent className="p-5 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{"N\u00edvel do atendente"}</p>
                                <p className="mt-1 text-lg font-bold text-foreground">{evolutionOverview.level}</p>
                              </div>
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-primary/30 bg-background/60 shadow-glow">
                                <span className="font-display text-xl font-black text-primary">{evolutionOverview.score}</span>
                                <span className="text-[9px] text-muted-foreground">/100</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold text-foreground">Meta de respostas ensinadas</span>
                                <span className="font-mono text-primary">{evolutionOverview.goal.current}/{evolutionOverview.goal.target}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                                  style={{ width: `${evolutionOverview.goal.percentage}%` }}
                                />
                              </div>
                              <p className="text-[9px] leading-relaxed text-muted-foreground">
                                Cada resposta aplicada vira conhecimento permanente e aumenta a maturidade do atendente.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px]">
                              <div className="rounded-lg border border-border/40 bg-background/35 p-2"><span className="block text-muted-foreground">Respostas</span><strong>+{evolutionOverview.components.answers}</strong></div>
                              <div className="rounded-lg border border-border/40 bg-background/35 p-2"><span className="block text-muted-foreground">Refinamentos</span><strong>+{evolutionOverview.components.refinements}</strong></div>
                              <div className="rounded-lg border border-border/40 bg-background/35 p-2"><span className="block text-muted-foreground">Cobertura</span><strong>+{evolutionOverview.components.coverage}</strong></div>
                              <div className="rounded-lg border border-border/40 bg-background/35 p-2"><span className="block text-muted-foreground">Fila em dia</span><strong>+{evolutionOverview.components.queue}</strong></div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="rounded-xl border border-border/60 bg-card/40">
                          <CardHeader className="p-4 pb-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <BrainCircuit className="h-5 w-5 text-primary" />
                                <div>
                                  <CardTitle className="text-xs font-bold uppercase tracking-wider">{"Mem\u00f3ria em grafo"}</CardTitle>
                                  <CardDescription className="text-[10px]">Conexoes reais entre contatos, conversas, conceitos e respostas.</CardDescription>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[9px]">{agentMemoryGraph.edges.length} conexoes</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-2">
                            <div className="flex flex-col items-center">
                              <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-center shadow-glow">
                                <Bot className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="text-[10px] font-bold">{selectedAgentKey || "Atendente"}</span>
                              </div>
                              <div className="h-4 w-px bg-primary/35" />
                              <div className="flex w-full flex-wrap justify-center gap-2 border-t border-primary/20 pt-3">
                                {agentMemoryGraph.nodes.filter((node) => ["field", "concept", "contact"].includes(node.type)).slice(0, 12).map((node) => (
                                  <div key={node.id} className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-[9px] font-semibold">
                                    {node.label} <span className="text-primary">{node.weight}</span>
                                  </div>
                                ))}
                                {agentMemoryGraph.nodes.filter((node) => ["field", "concept", "contact"].includes(node.type)).length === 0 && (
                                  <p className="py-3 text-[10px] text-muted-foreground">As primeiras conversas formarao o grafo automaticamente.</p>
                                )}
                              </div>
                              <div className="mt-3 grid w-full gap-2 sm:grid-cols-2">
                                {agentMemoryGraph.nodes.filter((node) => ["lesson", "episode"].includes(node.type)).slice(0, 6).map((node) => (
                                  <div key={node.id} className="truncate rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-2.5 py-2 text-[9px] text-muted-foreground" title={node.label}>
                                    <CheckCircle className="mr-1 inline h-3 w-3 text-emerald-400" /> {node.label}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                        {/* Coluna 1 e 2: Ajuste Inteligente & Perguntas Sem Resposta */}
                      <div className="grid gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2 space-y-6">
                          {/* CARD 1: AJUSTE VIA PROMPT */}
                          <Card className="border border-border/60 bg-card/40 shadow-sm rounded-xl">
                            <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center gap-2">
                              <BrainCircuit className="h-5 w-5 text-primary" />
                              <div>
                                <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">Ajuste Rápido via IA (Instrução Direta)</CardTitle>
                                <CardDescription className="text-[10px] text-muted-foreground mt-0.5">Escreva o que você deseja mudar ou ensinar em linguagem natural (ex: preços, comportamento, políticas).</CardDescription>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                              <div className="space-y-1.5">
                                <Label htmlFor="evolve-instruction" className="text-xs font-semibold text-foreground">O que você deseja ensinar ou alterar?</Label>
                                <Textarea
                                  id="evolve-instruction"
                                  placeholder="Ex: Agora vendemos cimento CP-II por R$32 a saca. Ofereça frete grátis acima de 50 sacas. Seja muito simpático."
                                  value={evolveInstruction}
                                  onChange={(e) => setEvolveInstruction(e.target.value)}
                                  className="min-h-[90px] bg-background/40 text-xs leading-relaxed rounded-lg"
                                  disabled={isAnalyzing}
                                />
                              </div>

                              <Button
                                onClick={handleEvolveAgent}
                                disabled={isAnalyzing || !evolveInstruction.trim()}
                                className="w-full h-9 text-xs gap-1.5 rounded-lg font-bold shadow-sm"
                              >
                                {isAnalyzing ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando Atendente...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4" /> Analisar e Propor Mudanças
                                  </>
                                )}
                              </Button>

                              {/* Preview de mudanças propostas */}
                              {previewChanges && (
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4 animate-fade-in">
                                  <div className="flex items-center gap-2 border-b border-primary/20 pb-2">
                                    <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
                                    <span className="font-bold text-primary text-xs uppercase tracking-wider">Alterações Propostas pela IA</span>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="bg-background/55 p-3 rounded-lg border border-border/30">
                                      <span className="block font-semibold text-[11px] text-foreground mb-1">Raciocínio da IA:</span>
                                      <p className="text-[11px] text-muted-foreground leading-relaxed">{previewReasoning}</p>
                                    </div>

                                    {Object.keys(previewChanges).map((field) => {
                                      const change = previewChanges[field];
                                      return (
                                        <div key={field} className="space-y-1 text-xs">
                                          <div className="flex items-center justify-between">
                                            <span className="font-bold capitalize text-foreground">{field === "personality" ? "Prompt Principal" : field}</span>
                                            <Badge variant="outline" className={`h-4.5 text-[8px] uppercase font-bold leading-none ${
                                              change.action === "append" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" : "border-amber-500/30 text-amber-400 bg-amber-500/5"
                                            }`}>
                                              {change.action === "append" ? "Adicionar" : "Substituir"}
                                            </Badge>
                                          </div>
                                          <pre className="text-[10px] bg-background/55 p-2 rounded border border-border/30 overflow-x-auto max-h-[100px] whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">
                                            {change.value}
                                          </pre>
                                        </div>
                                      );
                                    })}

                                    {previewSuggestions && previewSuggestions.length > 0 && (
                                      <div className="bg-background/25 p-2.5 rounded-lg border border-border/20 text-[10px] space-y-1">
                                        <span className="block font-bold text-foreground">💡 Sugestões adicionais:</span>
                                        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                          {previewSuggestions.map((s, idx) => <li key={idx}>{s}</li>)}
                                        </ul>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex gap-2 pt-1 border-t border-primary/20">
                                    <Button
                                      onClick={handleApplyChanges}
                                      disabled={isApplying}
                                      className="flex-grow h-8 text-[11px] font-bold rounded-lg"
                                      variant="default"
                                    >
                                      {isApplying ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin mr-1" /> Aplicando...
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aplicar e Salvar no Atendente
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      onClick={() => setPreviewChanges(null)}
                                      variant="outline"
                                      size="sm"
                                      disabled={isApplying}
                                      className="h-8 text-[11px] rounded-lg border-border/50 hover:bg-background"
                                    >
                                      Descartar
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* CARD 2: FEED DE PERGUNTAS SEM RESPOSTA */}
                          <Card className="border border-border/60 bg-card/40 shadow-sm rounded-xl">
                            <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <WarningCircle className="h-5 w-5 text-amber-500" />
                                <div>
                                  <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">Perguntas Sem Resposta dos Clientes</CardTitle>
                                  <CardDescription className="text-[10px] text-muted-foreground mt-0.5">Ensine seu atendente respondendo dúvidas reais que ele não soube responder nas conversas.</CardDescription>
                                </div>
                              </div>
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border border-amber-500/25 h-5 px-2 font-bold text-[10px]">
                                {learningStats.pending} Pendentes
                              </Badge>
                            </CardHeader>
                            <CardContent className="p-4">
                              {isLoadingLearning ? (
                                <div className="flex h-36 items-center justify-center">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                              ) : learningEvents.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground space-y-2 border border-dashed border-border/50 rounded-xl bg-background/5">
                                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/60" />
                                  <p className="text-xs font-semibold">Tudo em dia! O atendente não tem dúvidas.</p>
                                  <p className="text-[10px] text-muted-foreground/80 max-w-[320px] mx-auto">Toda vez que a IA falhar em uma resposta ou o cliente acionar transbordo, a dúvida aparecerá aqui para você treinar.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                                  {learningEvents.map((event) => (
                                    <div key={event.id} className="group rounded-xl border border-border/40 bg-background/25 p-4 space-y-3 hover:border-border/60 hover:bg-background/45 transition-all shadow-sm">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5">
                                          <p className="font-bold text-xs text-foreground/90 leading-tight">“ {event.customer_question} ”</p>
                                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-medium">
                                            <span>Cliente: {event.contact_name || event.contact_phone || "Desconhecido"}</span>
                                            <span>•</span>
                                            <span>{new Date(event.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                          </div>
                                        </div>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handleIgnoreEvent(event.id)}
                                          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                        >
                                          <Trash className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>

                                      {event.ai_response && (
                                        <div className="bg-destructive/5 text-destructive/90 border border-destructive/15 rounded-lg p-2.5 text-[10px] leading-relaxed">
                                          <span className="font-bold block uppercase text-[8.5px] tracking-wider mb-0.5">Resposta Falha da IA:</span>
                                          {event.ai_response}
                                        </div>
                                      )}

                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Digite a resposta correta para treinar o atendente..."
                                          value={answeringAnswers[event.id] || ""}
                                          onChange={(e) => setAnsweringAnswers(prev => ({ ...prev, [event.id]: e.target.value }))}
                                          className="h-8.5 text-xs bg-background"
                                          disabled={isTeachingId === event.id}
                                          onKeyDown={(e) => e.key === "Enter" && handleAnswerQuestion(event.id)}
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => handleAnswerQuestion(event.id)}
                                          disabled={isTeachingId === event.id || !(answeringAnswers[event.id] || "").trim()}
                                          className="h-8.5 font-semibold text-xs px-3 rounded-lg shadow-sm"
                                        >
                                          {isTeachingId === event.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                          ) : (
                                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                                          )}
                                          Ensinar
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Coluna 3: Histórico de Evolução */}
                        <div className="space-y-6">
                          <Card className="border border-border/60 bg-card/40 shadow-sm rounded-xl">
                            <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center gap-2">
                              <HistoryIcon className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">Histórico de Evolução</CardTitle>
                                <CardDescription className="text-[10px] text-muted-foreground mt-0.5">Linha do tempo de aprendizados e refinamentos aplicados.</CardDescription>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4">
                              {isLoadingHistory ? (
                                <div className="flex h-36 items-center justify-center">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                              ) : evolutionHistory.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground/80 text-[10px] space-y-1">
                                  <HistoryIcon className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
                                  <p>Nenhuma modificação registrada ainda.</p>
                                  <p>As atualizações via prompt ou respostas salvas aparecerão aqui.</p>
                                </div>
                              ) : (
                                <div className="relative pl-4 border-l border-border/50 ml-1 space-y-5 py-1.5 max-h-[640px] overflow-y-auto scrollbar-thin pr-1">
                                  {evolutionHistory.map((log) => {
                                    const fields = Object.keys(log.fields_changed || {});
                                    return (
                                      <div key={log.id} className="relative space-y-1.5 text-xs">
                                        {/* Dot */}
                                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                                        
                                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                                          <span className="font-semibold">{new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                          <Badge variant="secondary" className="h-4.5 px-1.5 text-[8.5px] uppercase font-bold bg-muted/80 text-muted-foreground">
                                            {log.change_type === "prompt_refinement" ? "Prompt" : 
                                             log.change_type === "question_learned" ? "Dúvida" : "Ajuste"}
                                          </Badge>
                                        </div>

                                        <p className="font-semibold text-foreground/90 leading-normal">{log.source_description}</p>
                                        
                                        {fields.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {fields.map((f) => (
                                              <span key={f} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border border-primary/20 bg-primary/5 text-primary scale-90">
                                                {f}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CONHECIMENTO */}
              {activeInternalTab === "conhecimento" && (
                <div className="space-y-6">
                  {/* Subtabs Menu */}
                  <div className="flex gap-2 border-b border-border/60 pb-2">
                    <button
                      onClick={() => setActiveConhecimentoSubTab("templates")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeConhecimentoSubTab === "templates" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Templates de Prompt
                    </button>
                    <button
                      onClick={() => setActiveConhecimentoSubTab("treinamento")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeConhecimentoSubTab === "treinamento" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Treinamento de Casos
                    </button>
                  </div>

                  {activeConhecimentoSubTab === "templates" ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs text-muted-foreground">Escolha um template rápido para o prompt de personalidade</Label>
                        <Input
                          placeholder="Buscar templates..."
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                          className="bg-background h-8 text-xs max-w-xs"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        {filteredTemplates.map((template) => (
                          <Card key={template.id} className="border border-border/60 bg-card/45 hover:border-primary/20 transition-all flex flex-col justify-between p-3.5 text-xs shadow-sm">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-foreground">{template.title}</span>
                                <Badge className="text-[8px] h-4">{template.category}</Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">{template.description}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-[10px] h-7"
                              onClick={() => {
                                onPromptChange(template.prompt);
                                toast({ title: `Template "${template.title}" copiado. Cole no campo correspondente.` });
                              }}
                            >
                              Copiar Instruções
                            </Button>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Card className="glass-card shadow-sm">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs font-semibold">Tabela de Interações de Clientes</CardTitle>
                          <CardDescription className="text-[10px]">Ajuste e revise respostas sugeridas baseando-se em casos reais de leads perdidos.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto text-xs">
                            <table className="w-full text-left">
                              <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground tracking-wider border-b border-border/60">
                                <tr>
                                  <th className="p-3">Pergunta do Cliente</th>
                                  <th className="p-3">Resposta Atual da IA</th>
                                  <th className="p-3">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {trainingRows.map((row) => (
                                  <tr key={row.id} className="hover:bg-muted/10">
                                    <td className="p-3 font-medium text-foreground">{row.customerQuestion}</td>
                                    <td className="p-3 text-muted-foreground">{row.aiResponse}</td>
                                    <td className="p-3">
                                      <Button size="sm" variant="ghost" onClick={() => onOpenImproveModal(row)} className="h-7 px-2 text-[10px]">
                                        Revisar
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: OPERAÇÃO */}
              {activeInternalTab === "operacao" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Sliders className="h-4 w-4 text-primary" /> Configurações de Operação e Funcionamento
                    </h3>
                  </div>

                  <Accordion type="single" collapsible className="w-full space-y-3">
                    {/* 1. Funcionamento (Horários) */}
                    <AccordionItem value="business-hours" className="border border-border/60 rounded-xl px-4 bg-card/30">
                      <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>Funcionamento (Horários de Atendimento)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 text-xs space-y-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px]">Horário de Abertura</Label>
                            <Input value={openingHour} onChange={(e) => onOpeningHourChange(e.target.value)} className="bg-background h-8 text-xs" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px]">Horário de Fechamento</Label>
                            <Input value={closingHour} onChange={(e) => onClosingHourChange(e.target.value)} className="bg-background h-8 text-xs" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px]">Fuso Horário</Label>
                            <Input value={timezone} onChange={(e) => onTimezoneChange(e.target.value)} className="bg-background h-8 text-xs" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-2 border-t border-border/30">
                          <div>
                            <p className="font-semibold text-foreground">Responder fora do horário</p>
                            <p className="text-[10px] text-muted-foreground">Enviar resposta de ausência automaticamente.</p>
                          </div>
                          <Switch checked={outsideHoursAutoReply} onCheckedChange={onOutsideHoursAutoReplyChange} />
                        </div>
                        <Button onClick={onSaveBusinessHours} disabled={saving} size="sm" className="gap-1 h-8">
                          <FloppyDisk className="h-3.5 w-3.5" /> Salvar Configuração
                        </Button>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 2. Mensagem de Ausência (Absence) */}
                    <AccordionItem value="absence" className="border border-border/60 rounded-xl px-4 bg-card/30">
                      <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-primary" />
                          <span>Mensagem de Ausência (Handoff)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px]">Habilitar mensagem de ausência</span>
                          <Switch checked={absenceEnabled} onCheckedChange={onAbsenceEnabledChange} />
                        </div>
                        <Textarea
                          value={absenceMessage}
                          onChange={(e) => onAbsenceMessageChange(e.target.value)}
                          className="min-h-[90px] bg-background text-xs"
                          placeholder="Escreva a mensagem..."
                        />
                        <Button onClick={onSaveAbsenceMessage} disabled={saving} size="sm" className="w-full h-8 gap-1">
                          <FloppyDisk className="h-3.5 w-3.5" /> Salvar Mensagem
                        </Button>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 3. Reativação (Queue) */}
                    <AccordionItem value="reactivation" className="border border-border/60 rounded-xl px-4 bg-card/30">
                      <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <Play className="h-4 w-4 text-primary" />
                          <span>Reativação Automática (Fila)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 text-xs space-y-3">
                        <div className="grid gap-3 grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Tamanho do Lote</Label>
                            <Input
                              type="number"
                              value={queueBatchSize}
                              onChange={(e) => onQueueBatchSizeChange(Number(e.target.value))}
                              className="bg-background h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Intervalo (segundos)</Label>
                            <Input
                              type="number"
                              value={queueDelaySeconds}
                              onChange={(e) => onQueueDelaySecondsChange(Number(e.target.value))}
                              className="bg-background h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Mensagem de Reativação</Label>
                          <Textarea
                            value={queueMessage}
                            onChange={(e) => onQueueMessageChange(e.target.value)}
                            className="min-h-[60px] bg-background text-xs"
                          />
                        </div>
                        <Button onClick={onProcessQueue} disabled={saving} size="sm" className="w-full h-8 gap-1">
                          <Play className="h-3.5 w-3.5" /> Processar Fila ({queueWaiting} pendentes)
                        </Button>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 4. Memória */}
                    <AccordionItem value="memory" className="border border-border/60 rounded-xl px-4 bg-card/30">
                      <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="h-4 w-4 text-primary" />
                          <span>Memória da IA</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 text-xs space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-border/30">
                          <div>
                            <p className="font-semibold text-foreground">Lembrar preferências</p>
                            <p className="text-[10px] text-muted-foreground">Gravar e consultar gostos e formas de atendimento de clientes.</p>
                          </div>
                          <Switch checked={rememberPreferences} onCheckedChange={onRememberPreferencesChange} />
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-border/30">
                          <div>
                            <p className="font-semibold text-foreground">Lembrar último pedido</p>
                            <p className="text-[10px] text-muted-foreground">Manter histórico do que o cliente solicitou na última conversa.</p>
                          </div>
                          <Switch checked={rememberLastOrder} onCheckedChange={onRememberLastOrderChange} />
                        </div>

                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-semibold text-foreground">Memória de Contexto Ativa</p>
                            <p className="text-[10px] text-muted-foreground">Habilitar a IA a consultar memórias passadas globalmente.</p>
                          </div>
                          <Switch checked={memoryEnabled} onCheckedChange={onMemoryEnabledChange} />
                        </div>

                        <Button onClick={onSaveMemory} disabled={saving} size="sm" className="gap-1 h-8">
                          <FloppyDisk className="h-3.5 w-3.5" /> Salvar Memória
                        </Button>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}

              {/* TAB 4.5: PROVEDORES */}
              {activeInternalTab === "provedores" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Cpu className="h-4 w-4 text-primary" /> Provedores de Inteligência Artificial
                    </h3>
                    <div className="flex items-center gap-2 text-[10px]">
                      <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        {activeProviderCount} ativos
                      </Badge>
                      <Badge variant="outline" className="gap-1.5 border-red-500/30 bg-red-500/10 text-red-400">
                        <span className="h-2 w-2 rounded-full bg-red-400" />
                        {providers.length - activeProviderCount} inativos
                      </Badge>
                    </div>
                  </div>

                  <Card className="glass-card p-6">
                    <div className="space-y-4">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {providers.map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => selectProvider(provider.id)}
                            aria-pressed={currentProviderId === provider.id}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-muted/30",
                              currentProviderId === provider.id ? "border-primary/60 bg-primary/10 shadow-sm" : "border-border/60 bg-background/25",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", provider.active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-400")} />
                                  <span className="truncate text-xs font-bold text-foreground">{provider.name}</span>
                                </div>
                                <p className="mt-1 truncate pl-[18px] text-[9px] text-muted-foreground">{provider.model || "Sem modelo"}</p>
                              </div>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide",
                                  provider.active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400",
                                )}
                              >
                                {provider.active ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[10px] text-muted-foreground">Selecione o Provedor</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="text-muted-foreground hover:text-foreground">
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-popover border border-border text-popover-foreground text-xs p-2 rounded-md">
                                Escolha qual provedor de inteligência artificial deseja configurar.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Select
                          value={currentProviderId}
                          onValueChange={selectProvider}
                        >
                          <SelectTrigger className="bg-background/50 h-8 text-xs">
                            <SelectValue placeholder="Escolha um provedor" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {providers.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                <div className="flex min-w-[240px] items-center justify-between gap-4">
                                  <span className="flex items-center gap-2">
                                    <span className={cn("h-2.5 w-2.5 rounded-full", p.active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-400")} />
                                    {p.name}
                                  </span>
                                  <span className={p.active ? "text-emerald-400" : "text-red-400"}>{p.active ? "Ativo" : "Inativo"}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedProvider && (
                        <div className={cn("space-y-4 rounded-xl border p-4", selectedProvider.active ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-red-500/30 bg-red-500/[0.04]")}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className={cn("h-3 w-3 rounded-full", selectedProvider.active ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" : "bg-red-400")} />
                              <div>
                                <span className="text-xs font-bold text-foreground">{selectedProvider.name}</span>
                                <p className="text-[9px] text-muted-foreground">Status operacional do provedor</p>
                              </div>
                              <Badge variant="outline" className={cn("text-[9px]", selectedProvider.active ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400")}>
                                {selectedProvider.active ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                            <Switch
                              checked={selectedProvider.active}
                              onCheckedChange={(checked) => onProviderToggle(selectedProvider.id, checked)}
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Label className="text-[10px] text-muted-foreground">API Key</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button type="button" className="text-muted-foreground hover:text-foreground">
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-popover border border-border text-popover-foreground text-xs p-2 rounded-md">
                                    Insira a chave secreta de autenticação gerada no painel do provedor.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="relative flex items-center">
                              <Input
                                type={showApiKeyMap[selectedProvider.id] ? "text" : "password"}
                                placeholder="Chave da API"
                                value={selectedProvider.apiKey}
                                onChange={(e) => onProviderChange({ ...selectedProvider, apiKey: e.target.value })}
                                className="bg-background h-8 text-xs font-mono pr-8"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowApiKeyMap((prev) => ({
                                    ...prev,
                                    [selectedProvider.id]: !prev[selectedProvider.id],
                                  }))
                                }
                                className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                              >
                                {showApiKeyMap[selectedProvider.id] ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[10px] text-muted-foreground">Modelo Padrão</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button type="button" className="text-muted-foreground hover:text-foreground">
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-popover border border-border text-popover-foreground text-xs p-2 rounded-md">
                                    Selecione o modelo padrão da IA a ser utilizado para as chamadas.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Select
                              value={selectedProvider.model}
                              onValueChange={(val) => onProviderChange({ ...selectedProvider, model: val })}
                            >
                              <SelectTrigger className="bg-background h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {(PROVIDER_MODELS[selectedProvider.id] || []).map((m) => (
                                  <SelectItem key={m.value} value={m.value} className="text-xs">
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedProvider.id === "elevenlabs" && (
                            <div className="space-y-3 pt-3 border-t border-border/40">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Voice ID (Rachel por padrão: 21m00Tcm4TlvDq8ikWAM)</Label>
                                <Input
                                  placeholder="Voice ID do ElevenLabs"
                                  value={selectedProvider.settings?.voice_id || ""}
                                  onChange={(e) => onProviderChange({
                                    ...selectedProvider,
                                    settings: {
                                      ...(selectedProvider.settings || {}),
                                      voice_id: e.target.value
                                    }
                                  })}
                                  className="bg-background h-8 text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-muted-foreground font-bold">
                                  <span>Estabilidade: {selectedProvider.settings?.stability ?? 0.5}</span>
                                </div>
                                <Slider
                                  value={[selectedProvider.settings?.stability ?? 0.5]}
                                  onValueChange={(val) => onProviderChange({
                                    ...selectedProvider,
                                    settings: {
                                      ...(selectedProvider.settings || {}),
                                      stability: val[0]
                                    }
                                  })}
                                  min={0}
                                  max={1}
                                  step={0.05}
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-muted-foreground font-bold">
                                  <span>Clareza / Similaridade: {selectedProvider.settings?.similarity_boost ?? 0.75}</span>
                                </div>
                                <Slider
                                  value={[selectedProvider.settings?.similarity_boost ?? 0.75]}
                                  onValueChange={(val) => onProviderChange({
                                    ...selectedProvider,
                                    settings: {
                                      ...(selectedProvider.settings || {}),
                                      similarity_boost: val[0]
                                    }
                                  })}
                                  min={0}
                                  max={1}
                                  step={0.05}
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-muted-foreground font-bold">
                                  <span>Estilo (Exageração): {selectedProvider.settings?.style ?? 0}</span>
                                </div>
                                <Slider
                                  value={[selectedProvider.settings?.style ?? 0]}
                                  onValueChange={(val) => onProviderChange({
                                    ...selectedProvider,
                                    settings: {
                                      ...(selectedProvider.settings || {}),
                                      style: val[0]
                                    }
                                  })}
                                  min={0}
                                  max={1}
                                  step={0.05}
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground font-semibold">Boost do Falante (Speaker Boost)</span>
                                <Switch
                                  checked={selectedProvider.settings?.use_speaker_boost !== false}
                                  onCheckedChange={(checked) => onProviderChange({
                                    ...selectedProvider,
                                    settings: {
                                      ...(selectedProvider.settings || {}),
                                      use_speaker_boost: checked
                                    }
                                  })}
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground">Regra Global de Voz</Label>
                                <Select
                                  value={selectedProvider.settings?.voice_rule || "always"}
                                  onValueChange={(val) => onProviderChange({
                                    ...selectedProvider,
                                    settings: {
                                      ...(selectedProvider.settings || {}),
                                      voice_rule: val
                                    }
                                  })}
                                >
                                  <SelectTrigger className="bg-background h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border">
                                    <SelectItem value="always" className="text-xs">Sempre responder com áudio</SelectItem>
                                    <SelectItem value="audio_inbound" className="text-xs">Responder com áudio apenas se receber áudio</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                          <Button
                            size="sm"
                            className="w-full text-xs h-8 gap-1 mt-2"
                            onClick={onSaveProviders}
                            disabled={saving}
                          >
                            <FloppyDisk className="h-3.5 w-3.5" /> Salvar Provedor
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {/* TAB 5: ANÁLISE */}
              {activeInternalTab === "analise" && (
                <div className="space-y-6">
                  {/* Subtabs Menu */}
                  <div className="flex gap-2 border-b border-border/60 pb-2">
                    <button
                      onClick={() => setActiveAnaliseSubTab("evolucao")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeAnaliseSubTab === "evolucao" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Evolução IA
                    </button>
                    <button
                      onClick={() => setActiveAnaliseSubTab("logs")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeAnaliseSubTab === "logs" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Logs de Auditoria IA
                    </button>
                  </div>

                  {activeAnaliseSubTab === "evolucao" ? (
                    <div className="space-y-4">
                      {loadingEvolution ? (
                        <div className="flex h-36 items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {evolutionData.map((agent) => (
                            <Card key={agent.agent_key} className="border border-border/60 bg-card/45 p-4 text-xs space-y-3 shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground capitalize">{agent.agent_key}</span>
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5">
                                  Score: {agent.evolution_score}/100
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="rounded border border-border/40 p-2 bg-background/20">
                                  <span className="block text-muted-foreground">Conversas Analisadas</span>
                                  <span className="font-bold text-foreground">{agent.conversations_analyzed}</span>
                                </div>
                                <div className="rounded border border-border/40 p-2 bg-background/20">
                                  <span className="block text-muted-foreground">Conversões</span>
                                  <span className="font-bold text-foreground text-emerald-500">{agent.conversions}</span>
                                </div>
                                <div className="rounded border border-border/40 p-2 bg-background/20">
                                  <span className="block text-muted-foreground">Objeções Capturadas</span>
                                  <span className="font-bold text-foreground text-amber-500">{agent.objections}</span>
                                </div>
                                <div className="rounded border border-border/40 p-2 bg-background/20">
                                  <span className="block text-muted-foreground">Taxa de Sucesso</span>
                                  <span className="font-bold text-foreground">{agent.success_rate}%</span>
                                </div>
                              </div>
                              {agent.faq_data?.top_questions && (
                                <div className="space-y-1.5 pt-2 border-t border-border/30">
                                  <span className="block text-[10px] font-bold text-muted-foreground uppercase">Tópicos Mais Frequentes</span>
                                  <div className="space-y-1">
                                    {agent.faq_data.top_questions.map((q: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-[10px] text-muted-foreground">
                                        <span className="truncate max-w-[80%]">"{q.question}"</span>
                                        <span className="font-semibold text-foreground">{q.count}x</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </Card>
                          ))}
                          {evolutionData.length === 0 && (
                            <div className="sm:col-span-2 py-8 text-center text-xs text-muted-foreground bg-background/20 rounded-xl border border-dashed border-border">
                              Nenhuma métrica de evolução disponível ainda. As métricas são coletadas conforme as conversas são processadas.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loadingPipelineLogs ? (
                        <div className="flex h-36 items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <Card className="border border-border/60 bg-card/45 shadow-sm">
                          <CardContent className="p-0">
                            <div className="overflow-x-auto text-xs">
                              <table className="w-full text-left">
                                <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground tracking-wider border-b border-border/60">
                                  <tr>
                                    <th className="p-3">Horário</th>
                                    <th className="p-3">Mensagem ID</th>
                                    <th className="p-3">Gargalo / Passo</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Erro</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                  {pipelineLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted/10">
                                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleString("pt-BR")}
                                      </td>
                                      <td className="p-3 font-mono text-[10px] text-foreground max-w-[120px] truncate" title={log.message_id}>
                                        {log.message_id}
                                      </td>
                                      <td className="p-3 font-semibold text-foreground uppercase text-[10px] tracking-wider">
                                        {log.step}
                                      </td>
                                      <td className="p-3">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[9px] uppercase font-bold",
                                            log.status === "success"
                                              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
                                              : "border-destructive/20 bg-destructive/5 text-destructive"
                                          )}
                                        >
                                          {log.status === "success" ? "Sucesso" : "Falhou"}
                                        </Badge>
                                      </td>
                                      <td className="p-3 text-destructive max-w-[200px] truncate" title={log.error_message || ""}>
                                        {log.error_message || "-"}
                                      </td>
                                    </tr>
                                  ))}
                                  {pipelineLogs.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">
                                        Nenhum log de auditoria encontrado.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              )}

            </main>
          </div>

        </div>
      </motion.div>

      {/* Training row suggestions modal */}
      <Dialog open={improveModalOpen} onOpenChange={onImproveModalOpenChange}>
        <DialogContent className="rounded-2xl bg-card border-border p-6 text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Editar resposta melhorada</DialogTitle>
            <DialogDescription>Revise o texto antes de aplicar a melhoria.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              value={improvedText}
              onChange={(e) => onImprovedTextChange(e.target.value)}
              className="min-h-[140px] bg-background text-xs"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => onImproveModalOpenChange(false)} size="sm">
              Cancelar
            </Button>
            <Button onClick={onImproveResponse} disabled={saving} variant="outline" size="sm">
              Melhorar com IA
            </Button>
            <Button onClick={onSaveImprovedResponse} size="sm">
              Aplicar Resposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Creation/Editing Dialog (9-Step Wizard / Accordion Form) */}
      <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-card border-border p-6 text-foreground shadow-lg flex flex-col justify-between min-h-[480px]">
          
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>{editingAgentKey ? "Editar Atendente" : "Adicionar Atendente"}</DialogTitle>
              {/* Toggle switch between modes */}
              <div className="flex items-center gap-1.5 bg-background/50 rounded-lg p-0.5 border border-border/30">
                <button
                  type="button"
                  onClick={() => setWizardViewMode("steps")}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-semibold rounded transition-all",
                    wizardViewMode === "steps" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Etapas
                </button>
                <button
                  type="button"
                  onClick={() => setWizardViewMode("accordion")}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-semibold rounded transition-all",
                    wizardViewMode === "accordion" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Página Única
                </button>
              </div>
            </div>
            <DialogDescription className="text-xs">
              {wizardViewMode === "steps" 
                ? "Configure o perfil da IA seguindo o assistente passo a passo." 
                : "Configure todas as opções em uma única página usando seções expansíveis."}
            </DialogDescription>
            
            {/* Visual Step Progress Bar (only show in steps mode) */}
            {wizardViewMode === "steps" && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[9px] text-muted-foreground font-semibold pb-1">
                  <span>Passo {wizardStep} de 10: {
                    wizardStep === 1 ? "Identificação" :
                    wizardStep === 2 ? "Contexto da Empresa" :
                    wizardStep === 3 ? "Produtos & Serviços" :
                    wizardStep === 4 ? "FAQ & Políticas" :
                    wizardStep === 5 ? "Personalidade" :
                    wizardStep === 6 ? "Horários de Trabalho" :
                    wizardStep === 7 ? "Regras Customizadas" :
                    wizardStep === 8 ? "Transbordo Humano" :
                    wizardStep === 9 ? "Configuração de Voz" : "Revisão Geral e Ativação"
                  }</span>
                  <span>{Math.round((wizardStep / 10) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(wizardStep / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Wizard/Accordion Content container */}
          <div className="flex-1 my-4 text-xs overflow-y-auto pr-1">
            {wizardViewMode === "steps" ? (
              <>
                {wizardStep === 1 && renderStepIdentificacao()}
                {wizardStep === 2 && renderStepContextoEmpresa()}
                {wizardStep === 3 && renderStepProdutosServicos()}
                {wizardStep === 4 && renderStepFaqPoliticas()}
                {wizardStep === 5 && renderStepPersonalidade()}
                {wizardStep === 6 && renderStepHorariosTrabalho()}
                {wizardStep === 7 && renderStepRegrasCustomizadas()}
                {wizardStep === 8 && renderStepTransbordoHumano()}
                {wizardStep === 9 && renderStepConfiguracaoVoz()}
                {wizardStep === 10 && renderStepRevisaoGeral()}
              </>
            ) : (
              <Accordion type="multiple" defaultValue={["step-1"]} className="space-y-2">
                <AccordionItem value="step-1" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">1. Identificação</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepIdentificacao()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-2" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">2. Contexto da Empresa</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepContextoEmpresa()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-3" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">3. Produtos & Serviços</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepProdutosServicos()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-4" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">4. FAQ & Políticas</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepFaqPoliticas()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-5" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">5. Personalidade</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepPersonalidade()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-6" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">6. Horários de Trabalho</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepHorariosTrabalho()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-7" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">7. Regras Customizadas</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepRegrasCustomizadas()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-8" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">8. Transbordo Humano</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepTransbordoHumano()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-9" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">9. Mensagens de Follow-Up</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepFollowUp()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-10" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">10. Mídia com IA</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepMidiaComIA()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-11" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">11. Configuração de Voz</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepConfiguracaoVoz()}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-12" className="border border-border/50 bg-background/25 rounded-xl px-4 py-2">
                  <AccordionTrigger className="py-1 text-xs font-bold text-foreground hover:no-underline">12. Revisão Geral e Ativação</AccordionTrigger>
                  <AccordionContent className="pb-2 pt-2">{renderStepRevisaoGeral()}</AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>

          {/* Wizard Footer controls */}
          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/40 shrink-0">
            {wizardViewMode === "steps" ? (
              <>
                {wizardStep > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWizardStep((prev) => prev - 1)}
                    className="h-8 text-xs"
                  >
                    Voltar
                  </Button>
                )}
                {wizardStep < 12 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (wizardStep === 1 && !agentFormName.trim()) {
                        toast({ title: "O nome é obrigatório.", variant: "destructive" });
                        return;
                      }
                      if (wizardStep === 5 && !agentFormPrompt.trim()) {
                        toast({ title: "O prompt é obrigatório.", variant: "destructive" });
                        return;
                      }
                      setWizardStep((prev) => prev + 1);
                    }}
                    className="h-8 text-xs ml-auto"
                  >
                    Avançar
                  </Button>
                ) : (
                  <Button
                    onClick={handleSaveAgent}
                    disabled={saving}
                    size="sm"
                    className="h-8 text-xs ml-auto"
                  >
                    Concluir & Salvar
                  </Button>
                )}
              </>
            ) : (
              <Button
                onClick={handleSaveAgent}
                disabled={saving}
                size="sm"
                className="h-8 text-xs ml-auto"
              >
                Concluir & Salvar
              </Button>
            )}
          </DialogFooter>
          
        </DialogContent>
      </Dialog>

      {/* Modal Configurar Prompt de Follow-Up (Image 4) */}
      <Dialog open={isFollowUpModalOpen} onOpenChange={setIsFollowUpModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Pencil className="h-4 w-4 text-primary" /> Configurar Prompt de Follow-Up
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              O prompt de follow-up instrui a IA sobre como retomar o contato com o cliente após um tempo de inatividade. O histórico da conversa e as mensagens anteriores serão passados para a IA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Prompt de Follow-Up</Label>
                <button
                  type="button"
                  onClick={() => setFollowUpPrompt(`Você é um assistente especializado em criar mensagens de follow-up personalizadas para conversas de WhatsApp, com foco em conversão de vendas para ${agentFormCompany || "a empresa"}.\n\nSua função é analisar a conversa fornecida e gerar 3 mensagens de follow-up sequenciais, amigáveis e estratégicas.`)}
                  className="text-[10px] text-primary hover:underline font-semibold"
                >
                  Restaurar padrão
                </button>
              </div>
              <Textarea
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                className="min-h-[140px] text-xs bg-background resize-y font-sans"
                placeholder="Digite as instruções de follow-up para a IA..."
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span>{followUpPrompt.length} caracteres (Mín. sugerido: 50 | Máx.: 2000)</span>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-xs space-y-1.5">
              <span className="font-bold text-primary block">Exemplos de personalização:</span>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                <p><strong className="text-foreground">E-commerce:</strong> No e-commerce, instigue a dúvida do cliente perguntando se o produto ainda faz sentido ou ofereça frete grátis.</p>
                <p><strong className="text-foreground">Serviços:</strong> Em serviços, pergunte se o cliente prefere reagendar a conversa ou se ficou com alguma dúvida sobre o orçamento enviado.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsFollowUpModalOpen(false)} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={() => {
              setIsFollowUpModalOpen(false);
              toast({ title: "Prompt Salvo!", description: "As instruções de follow-up foram atualizadas." });
            }} className="h-8 text-xs">
              Salvar Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AIView;
