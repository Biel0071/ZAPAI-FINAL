import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import AIView from "@/lovable/pages/AIPageView";
import { createAILovableViewModel } from "@/adapters/lovable/aiAdapter";
import { useToast } from "@/hooks/use-toast";
import { apiService, type AIConnectionTestResult, type AIStatusResponse } from "@/services/apiService";
import type { AIProviderConfig } from "@/lovable/pages/AIView";
import { useAppStore } from "@/stores/appStore";
import { VoiceStudioDrawer } from "@/components/ai/VoiceStudioDrawer";
import { AIExecutiveInsightsCard } from "@/components/ai/AIExecutiveInsightsCard";

type SectionId =
  | "dashboard"
  | "atendentes"
  | "provedores"
  | "conhecimento"
  | "operacao"
  | "analise";

const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  { id: "openai", name: "OpenAI", apiKey: "", model: "gpt-4o-mini", active: false },
  { id: "groq", name: "Groq", apiKey: "", model: "llama-3.1-70b-versatile", active: false },
  { id: "claude", name: "Claude (Anthropic)", apiKey: "", model: "claude-sonnet-4-20250514", active: false },
  { id: "gemini", name: "Gemini (Google)", apiKey: "", model: "gemini-2.0-flash", active: false },
  { id: "deepseek", name: "Deepseek", apiKey: "", model: "deepseek-chat", active: false },
  { id: "openrouter", name: "OpenRouter", apiKey: "", model: "auto", active: false },
  { id: "ollama", name: "Ollama (Local)", apiKey: "", model: "llama3.1", active: false },
  { id: "elevenlabs", name: "ElevenLabs (Voz)", apiKey: "", model: "eleven_multilingual_v2", active: false, settings: { voice_id: "21m00Tcm4TlvDq8ikWAM", stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, voice_rule: "always" } },
];

type PromptVersion = {
  id: string;
  content: string;
  savedAt: string;
};

type TrainingRow = {
  id: string;
  customerQuestion: string;
  aiResponse: string;
  status: "closed" | "lost";
};

type AIHealthItem = {
  label: string;
  ok: boolean;
  detail: string;
};

const DEFAULT_PROMPT = "Você é o atendente virtual desta loja. Responda conforme as informações e regras configuradas pela empresa.";

const defaultTrainingRows: TrainingRow[] = [
  {
    id: "1",
    customerQuestion: "Quero saber se vocês entregam hoje no centro.",
    aiResponse: "Posso verificar para você. Qual o seu CEP?",
    status: "lost",
  },
  {
    id: "2",
    customerQuestion: "Tem desconto no pix para 20 unidades?",
    aiResponse: "Temos condições especiais para atacado, posso te enviar uma proposta.",
    status: "lost",
  },
  {
    id: "3",
    customerQuestion: "Qual o prazo para faturamento?",
    aiResponse: "Em média até 24h úteis após confirmação dos dados.",
    status: "closed",
  },
];

function resolveAIEnabled(status: AIStatusResponse | null): boolean {
  if (!status) return false;
  if (typeof status.enabled === "boolean") return status.enabled;
  if (typeof status.active === "boolean") return status.active;
  if (typeof status.ai === "boolean") return status.ai;
  if (typeof status.status === "string") {
    const normalized = status.status.toLowerCase();
    return normalized === "on" || normalized === "enabled" || normalized === "active";
  }
  return false;
}

export default function AI() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as SectionId | null;
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);

  useEffect(() => {
    if (tabParam && ["dashboard", "atendentes", "provedores", "conhecimento", "operacao", "analise"].includes(tabParam)) {
      setActiveSection(tabParam);
    } else if (!tabParam) {
      setSearchParams({ tab: "dashboard" });
    }
  }, [tabParam, setSearchParams]);

  const handleSectionChange = (section: SectionId) => {
    setActiveSection(section);
    setSearchParams({ tab: section });
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [aiEnabled, setAiEnabled] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);

  const [openingHour, setOpeningHour] = useState("07:00");
  const [closingHour, setClosingHour] = useState("20:00");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [outsideHoursAutoReply, setOutsideHoursAutoReply] = useState(true);

  const [absenceEnabled, setAbsenceEnabled] = useState(true);
  const [absenceMessage, setAbsenceMessage] = useState(
    "Olá! No momento estamos fora do horário de atendimento. Nosso atendimento online ocorre das 7h às 20h.",
  );

  const [queueBatchSize, setQueueBatchSize] = useState(5);
  const [queueDelaySeconds, setQueueDelaySeconds] = useState(60);
  const [queueMessage, setQueueMessage] = useState(
    "Olá! Ontem você entrou em contato conosco fora do horário. Posso ajudar agora?",
  );
  const [queueWaiting, setQueueWaiting] = useState(0);
  const [queueSentToday, setQueueSentToday] = useState(0);

  const [trainingRows, setTrainingRows] = useState<TrainingRow[]>(defaultTrainingRows);
  const [improveModalOpen, setImproveModalOpen] = useState(false);
  const [improveRowId, setImproveRowId] = useState<string | null>(null);
  const [improvedText, setImprovedText] = useState("");

  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [rememberLastOrder, setRememberLastOrder] = useState(true);
  const [rememberPreferences, setRememberPreferences] = useState(true);

  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([500]);
  const [responseDelay, setResponseDelay] = useState([2]);
  const [autoFollowUp, setAutoFollowUp] = useState(true);

  const [providers, setProviders] = useState<AIProviderConfig[]>(DEFAULT_PROVIDERS);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [runtimeHealth, setRuntimeHealth] = useState<{ runtime: string; sessions: string; activeSessions: number; totalSessions: number } | null>(null);
  const [providerOnline, setProviderOnline] = useState(false);
  const [webhooks, setWebhooks] = useState<Array<Record<string, unknown>>>([]);
  const [testMessage, setTestMessage] = useState("Olá, preciso validar se a IA está respondendo.");
  const [testPrompt, setTestPrompt] = useState(DEFAULT_PROMPT);
  const [testModel, setTestModel] = useState("gpt-4o-mini");
  const [testProviderId, setTestProviderId] = useState("openai");
  const [testingAI, setTestingAI] = useState(false);
  const [providerTesting, setProviderTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<AIConnectionTestResult | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<AIConnectionTestResult[]>([]);
  const [aiMetrics, setAiMetrics] = useState<any>({
    tokensToday: 0,
    promptTokensToday: 0,
    completionTokensToday: 0,
    messagesToday: 0,
    tokensPerConversation: {},
  });

  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const websocketHealth = useAppStore((state) => state.websocketHealth);

  const lostCount = useMemo(() => trainingRows.filter((row) => row.status === "lost").length, [trainingRows]);
  const aiHealthItems = useMemo<any[]>(() => {
    const activeProvider = providers.find((provider) => provider.active);
    return [
      {
        label: "Banco",
        ok: runtimeHealth?.runtime === "online",
        detail: runtimeHealth?.runtime === "online" ? "Conectado" : "Desconectado",
      },
      {
        label: "Socket",
        ok: websocketHealth === "online",
        detail: websocketHealth === "online" ? "Conectado" : websocketHealth === "reconnecting" ? "Reconectando" : "Desconectado",
      },
      {
        label: "Baileys",
        ok: runtimeHealth?.sessions === "online" || (runtimeHealth?.activeSessions ?? 0) > 0,
        detail: `${runtimeHealth?.activeSessions ?? 0}/${runtimeHealth?.totalSessions ?? 0} ativas`,
      },
      {
        label: "OpenAI",
        ok: providerOnline || Boolean(activeProvider?.apiKey || activeProvider?.id === "ollama"),
        detail: activeProvider ? `${activeProvider.name} (${activeProvider.model})` : providerOnline ? "Provider configurado no servidor" : "Nenhum provider ativo",
      },
      {
        label: "Filas",
        ok: queueWaiting >= 0,
        detail: `${queueWaiting} aguardando`,
      },
      {
        label: "Inbox",
        ok: runtimeHealth?.runtime === "online" && websocketHealth === "online",
        detail: runtimeHealth?.runtime === "online" && websocketHealth === "online" ? "Operacional" : "Indisponível",
      },
    ];
  }, [providerOnline, providers, queueWaiting, runtimeHealth, websocketHealth]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [status, promptData, businessHours, absence, queue, memory, advanced, logsData, metricsData, runtimeData, webhooksData, agentsData, userProvidersData] = await Promise.all([
          apiService.getAIStatus().catch(() => ({})),
          apiService.getAIPrompt().catch(() => null),
          apiService.getBusinessHours().catch(() => null),
          apiService.getAbsenceMessage().catch(() => null),
          apiService.getQueueStats().catch(() => null),
          apiService.getMemorySettings().catch(() => null),
          apiService.getAdvancedAISettings().catch(() => null),
          apiService.getAILogs(activeSessionId).catch(() => ({ logs: [] })),
          apiService.getAIMetrics(activeSessionId).catch(() => ({ tokensToday: 0, promptTokensToday: 0, completionTokensToday: 0, messagesToday: 0, tokensPerConversation: {} })),
          apiService.getRuntimeSessionHealth().catch(() => null),
          apiService.getWebhooks().catch(() => ({ webhooks: [] })),
          apiService.getAIAgents().catch(() => ({ success: false, agents: [] })),
          apiService.getUserProviders().catch(() => ({ success: false, providers: [] })),
        ]);

        if (!mounted) return;

        setAiEnabled(resolveAIEnabled(status));
        setProviderOnline(Boolean((status as any)?.providerConfigured ?? (status as any)?.providerOnline ?? (status as any)?.online));
        setAiLogs(logsData?.logs || []);
        setAiMetrics(metricsData || {});
        setRuntimeHealth(runtimeData);
        setWebhooks(Array.isArray(webhooksData?.webhooks) ? webhooksData.webhooks : []);
        if (agentsData?.success) {
          setAgents(agentsData.agents || []);
        }

        if (promptData?.prompt) setPrompt(promptData.prompt);
        if (Array.isArray(promptData?.versions)) {
          setPromptVersions(
            promptData.versions.map((version, index) => ({
              id: version.id ?? `version-${index}`,
              content: version.content ?? "",
              savedAt: version.savedAt ?? new Date().toISOString(),
            })),
          );
        }

        if (businessHours) {
          setOpeningHour(businessHours.openTime ?? "07:00");
          setClosingHour(businessHours.closeTime ?? "20:00");
          setTimezone(businessHours.timezone ?? "America/Sao_Paulo");
          setOutsideHoursAutoReply(Boolean(businessHours.autoReplyOutsideHours));
        }

        if (absence) {
          setAbsenceEnabled(Boolean(absence.enabled));
          setAbsenceMessage(absence.message ?? absenceMessage);
        }

        if (queue) {
          setQueueBatchSize(queue.batchSize ?? 5);
          setQueueDelaySeconds(queue.delaySeconds ?? 60);
          setQueueMessage(queue.reactivationMessage ?? queueMessage);
          setQueueWaiting(queue.customersWaiting ?? 0);
          setQueueSentToday(queue.messagesSentToday ?? 0);
        }

        if (memory) {
          setMemoryEnabled(Boolean(memory.enabled));
          setRememberLastOrder(Boolean(memory.rememberLastOrder));
          setRememberPreferences(Boolean(memory.rememberPreferences));
        }

        if (advanced) {
          setTemperature([advanced.temperature ?? 0.7]);
          setMaxTokens([advanced.maxTokens ?? 500]);
          setResponseDelay([advanced.responseDelaySeconds ?? 2]);
          setAutoFollowUp(Boolean(advanced.autoFollowUp));
        }

        const userProviders = Array.isArray(userProvidersData?.providers) ? userProvidersData.providers : [];
        const mergedProviders = DEFAULT_PROVIDERS.map((p) => {
          const saved = userProviders.find((s: any) => String(s.provider).toLowerCase() === p.id.toLowerCase());
          if (saved) {
            return {
              ...p,
              apiKey: saved.api_key || "",
              model: saved.model || p.model,
              active: Boolean(saved.enabled),
              settings: saved.settings || p.settings,
            };
          }
          if (advanced && Array.isArray(advanced.providers)) {
            const legacy = (advanced.providers as AIProviderConfig[]).find((s: AIProviderConfig) => s.id === p.id);
            if (legacy) {
              return { ...p, ...legacy };
            }
          }
          return p;
        });

        setProviders(mergedProviders);

        const activeProvider = mergedProviders.find((provider) => provider.active) || mergedProviders[0];
        if (activeProvider) {
          setTestProviderId(activeProvider.id);
          setTestModel(activeProvider.model || "gpt-4o-mini");
        }
      } catch {
        // defaults
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadData();

    const interval = window.setInterval(async () => {
      try {
        const [status, logsData, metricsData, runtimeData] = await Promise.all([
          apiService.getAIStatus().catch(() => ({})),
          apiService.getAILogs(activeSessionId).catch(() => ({ logs: [] })),
          apiService.getAIMetrics(activeSessionId).catch(() => ({ tokensToday: 0, promptTokensToday: 0, completionTokensToday: 0, messagesToday: 0, tokensPerConversation: {} })),
          apiService.getRuntimeSessionHealth().catch(() => null),
        ]);
        if (mounted) {
          setAiEnabled(resolveAIEnabled(status));
          setProviderOnline(Boolean((status as any)?.providerConfigured ?? (status as any)?.providerOnline ?? (status as any)?.online));
          setAiLogs(logsData?.logs || []);
          setAiMetrics(metricsData || {});
          if (runtimeData) setRuntimeHealth(runtimeData);
        }
      } catch {
        // ignore
      }
    }, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [activeSessionId]);

  const notifySaved = () => {
    toast({ title: "Configuração salva com sucesso." });
  };

  const handleStatusToggle = async (enabled: boolean) => {
    const previous = aiEnabled;
    setAiEnabled(enabled);
    try {
      const result = enabled ? await apiService.enableAI() : await apiService.disableAI();
      const persistedEnabled = resolveAIEnabled(result);
      setAiEnabled(persistedEnabled);
      if (persistedEnabled !== enabled) {
        throw new Error("O backend não confirmou o estado solicitado.");
      }
      notifySaved();
    } catch {
      setAiEnabled(previous);
      toast({ title: "Não foi possível atualizar o status da IA no servidor.", variant: "destructive" });
    }
  };

  const savePrompt = async () => {
    setSaving(true);
    try {
      await apiService.saveAIPrompt(prompt);
      setPromptVersions((prev) => [
        { id: `version-${Date.now()}`, content: prompt, savedAt: new Date().toISOString() },
        ...prev,
      ]);
      notifySaved();
    } catch {
      toast({ title: "Erro ao salvar prompt.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLearningPromptApplied = (payload: { newPrompt: string; promptVersionId: string }) => {
    setPrompt(payload.newPrompt);
    setPromptVersions((prev) => [
      { id: payload.promptVersionId, content: payload.newPrompt, savedAt: new Date().toISOString() },
      ...prev,
    ]);
    notifySaved();
  };

  const saveBusinessHours = async () => {
    setSaving(true);
    try {
      await apiService.saveBusinessHours({
        openTime: openingHour,
        closeTime: closingHour,
        timezone,
        autoReplyOutsideHours: outsideHoursAutoReply,
      });
      notifySaved();
    } catch {
      toast({ title: "Erro ao salvar horário comercial.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveAbsenceMessage = async () => {
    setSaving(true);
    try {
      await apiService.saveAbsenceMessage({ enabled: absenceEnabled, message: absenceMessage });
      notifySaved();
    } catch {
      toast({ title: "Erro ao salvar mensagem de ausência.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const processQueue = async () => {
    setSaving(true);
    try {
      const result = await apiService.processQueue({
        batchSize: queueBatchSize,
        delaySeconds: queueDelaySeconds,
        reactivationMessage: queueMessage,
      });
      setQueueSentToday((prev) => prev + (result.messagesSent ?? 0));
      setQueueWaiting((prev) => Math.max(0, prev - (result.messagesSent ?? 0)));
      notifySaved();
    } catch {
      toast({ title: "Erro ao processar fila.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveMemory = async () => {
    setSaving(true);
    try {
      await apiService.saveMemorySettings({
        enabled: memoryEnabled,
        rememberLastOrder,
        rememberPreferences,
      });
      notifySaved();
    } catch {
      toast({ title: "Erro ao salvar memória.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveAdvanced = async () => {
    setSaving(true);
    try {
      await apiService.saveAdvancedAISettings({
        temperature: temperature[0],
        maxTokens: maxTokens[0],
        responseDelaySeconds: responseDelay[0],
        autoFollowUp,
        providers,
      });
      notifySaved();
    } catch {
      toast({ title: "Erro ao salvar configurações avançadas.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (updated: AIProviderConfig) => {
    setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleProviderToggle = (providerId: string, active: boolean) => {
    setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, active } : p)));
  };

  const saveProviders = async () => {
    setSaving(true);
    try {
      await Promise.all(
        providers
          .filter((p) => p.apiKey && p.apiKey.trim() !== "")
          .map((p) =>
            apiService.saveUserProvider({
              provider: p.id,
              api_key: p.apiKey,
              model: p.model,
              enabled: p.active,
              settings: p.settings || null,
            })
          )
      );
      notifySaved();
    } catch {
      toast({ title: "Erro ao salvar provedores.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runAITest = async () => {
    if (!testMessage.trim()) {
      toast({ title: "Informe uma mensagem de teste.", variant: "destructive" });
      return;
    }

    setTestingAI(true);
    setAiTestResult(null);
    try {
      const response = await apiService.testAIMessage({
        message: testMessage,
        prompt: testPrompt,
        model: testModel,
        providerId: testProviderId,
      });
      setAiTestResult(response.result ?? {
        ok: Boolean(response.success),
        provider: testProviderId,
        model: testModel,
        status: response.success ? "connected" : "error",
        error: response.error,
      });
    } catch (error) {
      setAiTestResult({
        ok: false,
        provider: testProviderId,
        model: testModel,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTestingAI(false);
    }
  };

  const runProviderTests = async () => {
    setProviderTesting(true);
    try {
      const response = await apiService.testAIProviders();
      setProviderTestResults(response.results ?? []);
    } catch (error) {
      setProviderTestResults([
        {
          ok: false,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      setProviderTesting(false);
    }
  };

  const openImproveModal = (row: TrainingRow) => {
    setImproveRowId(row.id);
    setImprovedText(row.aiResponse);
    setImproveModalOpen(true);
  };

  const improveResponse = async () => {
    const row = trainingRows.find((item) => item.id === improveRowId);
    if (!row) return;

    setSaving(true);
    try {
      const response = await apiService.improveAIResponse({
        customerQuestion: row.customerQuestion,
        aiResponse: improvedText,
        status: row.status,
      });
      const suggestion = response.improvedResponse ?? response.suggestion ?? improvedText;
      setImprovedText(suggestion);
    } catch {
      toast({ title: "Erro ao gerar melhoria.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveImprovedResponse = () => {
    if (!improveRowId) return;
    setTrainingRows((prev) =>
      prev.map((row) => (row.id === improveRowId ? { ...row, aiResponse: improvedText, status: "closed" } : row)),
    );
    setImproveModalOpen(false);
    notifySaved();
  };

  const handleLoadAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await apiService.getAIAgents();
      if (response && response.success) {
        setAgents(response.agents || []);
      }
    } catch {
      toast({ title: "Erro ao carregar atendentes.", variant: "destructive" });
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleCreateAgent = async (agentPayload: any) => {
    try {
      const response = await apiService.createAIAgent(agentPayload);
      if (response && response.success) {
        toast({ title: "Atendente criado com sucesso." });
        await handleLoadAgents();
        return true;
      }
    } catch (err: any) {
      toast({ title: err?.message || "Erro ao criar atendente.", variant: "destructive" });
    }
    return false;
  };

  const handleUpdateAgent = async (key: string, agentPayload: any) => {
    try {
      const response = await apiService.updateAIAgent(key, agentPayload);
      if (response && response.success) {
        toast({ title: "Atendente atualizado com sucesso." });
        await handleLoadAgents();
        return true;
      }
    } catch (err: any) {
      toast({ title: err?.message || "Erro ao atualizar atendente.", variant: "destructive" });
    }
    return false;
  };

  const handleToggleAgent = async (key: string, active: boolean) => {
    try {
      const response = await apiService.toggleAIAgent(key, active);
      if (response && response.success) {
        toast({ title: active ? "Atendente ativado." : "Atendente desativado." });
        await handleLoadAgents();
        return true;
      }
    } catch {
      toast({ title: "Erro ao alterar status do atendente.", variant: "destructive" });
    }
    return false;
  };

  const handleDeleteAgent = async (key: string) => {
    try {
      const response = await apiService.deleteAIAgent(key);
      if (response && response.success) {
        toast({ title: "Atendente excluído com sucesso." });
        await handleLoadAgents();
        return true;
      }
    } catch (err: any) {
      toast({ title: err?.message || "Erro ao excluir atendente.", variant: "destructive" });
    }
    return false;
  };

  const handleCloneAgent = async (key: string) => {
    try {
      const response = await apiService.cloneAIAgent(key);
      if (response && response.success) {
        toast({ title: "Atendente clonado com sucesso." });
        await handleLoadAgents();
        return true;
      }
    } catch (err: any) {
      toast({ title: err?.message || "Erro ao clonar atendente.", variant: "destructive" });
    }
    return false;
  };

  const aiViewModel = createAILovableViewModel();

  return (
    <div className="min-h-screen bg-background">
      <Header title={aiViewModel.title} subtitle={aiViewModel.subtitle} />
      <div className="p-6 pb-0">
        <AIExecutiveInsightsCard />
      </div>
      <AIView
        viewModel={aiViewModel}
        activeSection={activeSection}
        loading={loading}
        saving={saving}
        aiEnabled={aiEnabled}
        prompt={prompt}
        promptVersions={promptVersions}
        openingHour={openingHour}
        closingHour={closingHour}
        timezone={timezone}
        outsideHoursAutoReply={outsideHoursAutoReply}
        absenceEnabled={absenceEnabled}
        absenceMessage={absenceMessage}
        queueBatchSize={queueBatchSize}
        queueDelaySeconds={queueDelaySeconds}
        queueMessage={queueMessage}
        queueWaiting={queueWaiting}
        queueSentToday={queueSentToday}
        trainingRows={trainingRows}
        improveModalOpen={improveModalOpen}
        improvedText={improvedText}
        memoryEnabled={memoryEnabled}
        rememberLastOrder={rememberLastOrder}
        rememberPreferences={rememberPreferences}
        temperature={temperature}
        maxTokens={maxTokens}
        responseDelay={responseDelay}
        autoFollowUp={autoFollowUp}
        lostCount={lostCount}
        onSectionChange={handleSectionChange}
        onStatusToggle={(value) => void handleStatusToggle(value)}
        onDeleteAgent={handleDeleteAgent}
        onCloneAgent={handleCloneAgent}
        onPromptChange={setPrompt}
        onSelectPromptVersion={setPrompt}
        onRestorePrompt={() => setPrompt(DEFAULT_PROMPT)}
        onSavePrompt={() => void savePrompt()}
        onOpeningHourChange={setOpeningHour}
        onClosingHourChange={setClosingHour}
        onTimezoneChange={setTimezone}
        onOutsideHoursAutoReplyChange={setOutsideHoursAutoReply}
        onSaveBusinessHours={() => void saveBusinessHours()}
        onAbsenceEnabledChange={setAbsenceEnabled}
        onAbsenceMessageChange={setAbsenceMessage}
        onSaveAbsenceMessage={() => void saveAbsenceMessage()}
        onQueueBatchSizeChange={setQueueBatchSize}
        onQueueDelaySecondsChange={setQueueDelaySeconds}
        onQueueMessageChange={setQueueMessage}
        onProcessQueue={() => void processQueue()}
        onOpenImproveModal={openImproveModal}
        onPromptApplied={handleLearningPromptApplied}
        onMemoryEnabledChange={setMemoryEnabled}
        onRememberLastOrderChange={setRememberLastOrder}
        onRememberPreferencesChange={setRememberPreferences}
        onSaveMemory={() => void saveMemory()}
        onTemperatureChange={setTemperature}
        agents={agents}
        loadingAgents={loadingAgents}
        onCreateAgent={handleCreateAgent}
        onUpdateAgent={handleUpdateAgent}
        onToggleAgent={handleToggleAgent}
        onMaxTokensChange={setMaxTokens}
        onResponseDelayChange={setResponseDelay}
        onAutoFollowUpChange={setAutoFollowUp}
        onSaveAdvanced={() => void saveAdvanced()}
        onImproveModalOpenChange={setImproveModalOpen}
        onImprovedTextChange={setImprovedText}
        onImproveResponse={() => void improveResponse()}
        onSaveImprovedResponse={saveImprovedResponse}
        providers={providers}
        onProviderChange={handleProviderChange}
        onProviderToggle={handleProviderToggle}
        onSaveProviders={() => void saveProviders()}
        testMessage={testMessage}
        testPrompt={testPrompt}
        testModel={testModel}
        testProviderId={testProviderId}
        testingAI={testingAI}
        aiTestResult={aiTestResult}
        providerTesting={providerTesting}
        providerTestResults={providerTestResults}
        aiHealthItems={aiHealthItems}
        onTestMessageChange={setTestMessage}
        onTestPromptChange={setTestPrompt}
        onTestModelChange={setTestModel}
        onTestProviderIdChange={setTestProviderId}
        onRunAITest={() => void runAITest()}
        onRunProviderTests={() => void runProviderTests()}
        aiLogs={aiLogs}
        aiMetrics={aiMetrics}
      />

      {/* ZAPFLOW AI Voices Studio Drawer */}
      <VoiceStudioDrawer
        open={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
      />
    </div>
  );
}
