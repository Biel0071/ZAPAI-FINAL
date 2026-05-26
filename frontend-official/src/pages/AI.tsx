import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import AIView from "@/lovable/pages/AIPageView";
import { createAILovableViewModel } from "@/adapters/lovable/aiAdapter";
import { useToast } from "@/hooks/use-toast";
import { apiService, type AIStatusResponse } from "@/services/apiService";
import type { AIProviderConfig } from "@/lovable/pages/AIView";

type SectionId =
  | "status"
  | "prompt"
  | "providers"
  | "business-hours"
  | "absence"
  | "reactivation"
  | "training"
  | "learning"
  | "memory"
  | "advanced";

const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  { id: "openai", name: "OpenAI", apiKey: "", model: "gpt-4o-mini", active: false },
  { id: "groq", name: "Groq", apiKey: "", model: "llama-3.1-70b-versatile", active: false },
  { id: "claude", name: "Claude (Anthropic)", apiKey: "", model: "claude-sonnet-4-20250514", active: false },
  { id: "gemini", name: "Gemini (Google)", apiKey: "", model: "gemini-2.0-flash", active: false },
  { id: "deepseek", name: "Deepseek", apiKey: "", model: "deepseek-chat", active: false },
  { id: "openrouter", name: "OpenRouter", apiKey: "", model: "auto", active: false },
  { id: "ollama", name: "Ollama (Local)", apiKey: "", model: "llama3.1", active: false },
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

const DEFAULT_PROMPT = "Você é Camila, assistente de vendas do Depósito Vista Alegre.";

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
  if (typeof status.status === "string") {
    const normalized = status.status.toLowerCase();
    return normalized === "on" || normalized === "enabled" || normalized === "active";
  }
  return false;
}

export default function AI() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<SectionId>("status");
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

  const lostCount = useMemo(() => trainingRows.filter((row) => row.status === "lost").length, [trainingRows]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [status, promptData, businessHours, absence, queue, memory, advanced] = await Promise.all([
          apiService.getAIStatus(),
          apiService.getAIPrompt(),
          apiService.getBusinessHours(),
          apiService.getAbsenceMessage(),
          apiService.getQueueStats(),
          apiService.getMemorySettings(),
          apiService.getAdvancedAISettings(),
        ]);

        if (!mounted) return;

        setAiEnabled(resolveAIEnabled(status));

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
          if (Array.isArray(advanced.providers) && advanced.providers.length > 0) {
            setProviders((prev) =>
              prev.map((p) => {
                const saved = (advanced.providers as AIProviderConfig[]).find((s: AIProviderConfig) => s.id === p.id);
                return saved ? { ...p, ...saved } : p;
              }),
            );
          }
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
        const status = await apiService.getAIStatus();
        if (mounted) setAiEnabled(resolveAIEnabled(status));
      } catch {
        // ignore
      }
    }, 10_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const notifySaved = () => {
    toast({ title: "Configuração salva com sucesso." });
  };

  const handleStatusToggle = async (enabled: boolean) => {
    setAiEnabled(enabled);
    try {
      if (enabled) await apiService.enableAI();
      else await apiService.disableAI();
      notifySaved();
    } catch {
      setAiEnabled(!enabled);
      toast({ title: "Não foi possível atualizar o status da IA.", variant: "destructive" });
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
      await apiService.saveAdvancedAISettings({
        temperature: temperature[0],
        maxTokens: maxTokens[0],
        responseDelaySeconds: responseDelay[0],
        autoFollowUp,
        providers,
      });
      notifySaved();
    } catch {
      toast({ title: "Erro ao salvar provedores.", variant: "destructive" });
    } finally {
      setSaving(false);
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

  const aiViewModel = createAILovableViewModel();

  return (
    <div className="min-h-screen bg-background">
      <Header title={aiViewModel.title} subtitle={aiViewModel.subtitle} />
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
        onSectionChange={setActiveSection}
        onStatusToggle={(value) => void handleStatusToggle(value)}
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
      />
    </div>
  );
}
