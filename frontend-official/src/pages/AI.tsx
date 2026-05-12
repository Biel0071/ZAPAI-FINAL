import { useEffect, useMemo, useState, type ElementType } from "react";
import { motion } from "framer-motion";
import {
  Robot,
  Clock,
  NotePencil,
  WarningCircle,
  Repeat,
  Brain,
  Sliders,
  Sparkle,
  CheckCircle,
  XCircle,
  FloppyDisk,
  ArrowCounterClockwise,
  MagicWand,
  Queue,
  Info,
  GraduationCap,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiService, type AIStatusResponse } from "@/services/apiService";
import { AILearningDashboard } from "@/components/ai/AILearningDashboard";
import { cn } from "@/lib/utils";

type SectionId =
  | "status"
  | "prompt"
  | "business-hours"
  | "absence"
  | "reactivation"
  | "training"
  | "learning"
  | "memory"
  | "advanced";

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

const sections: Array<{ id: SectionId; label: string; icon: ElementType }> = [
  { id: "status", label: "Status da IA", icon: Robot },
  { id: "prompt", label: "Editor de Prompt", icon: NotePencil },
  { id: "business-hours", label: "Horário Comercial", icon: Clock },
  { id: "absence", label: "Mensagem de Ausência", icon: WarningCircle },
  { id: "reactivation", label: "Fila de Reativação", icon: Queue },
  { id: "training", label: "Central de Treinamento", icon: Sparkle },
  { id: "learning", label: "AI Learning", icon: GraduationCap },
  { id: "memory", label: "Configuração de Memória", icon: Brain },
  { id: "advanced", label: "Ajustes Avançados", icon: Sliders },
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

function TitleInfo({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Informação"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
      });
      notifySaved();
    } catch {
      toast({ title: "Erro ao salvar configurações avançadas.", variant: "destructive" });
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

  return (
    <div className="min-h-screen bg-background">
      <Header title="Configuração de IA" subtitle="Central de Controle" />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6">
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-3 md:p-5">
          <Tabs
            value={activeSection}
            onValueChange={(value) => setActiveSection(value as SectionId)}
            orientation="vertical"
            className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]"
          >
            <TabsList className="h-auto w-full flex-col items-stretch rounded-xl bg-muted/60 p-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:shadow-none"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{section.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="glass-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Status da IA</p>
                      <p className="text-lg font-semibold">{aiEnabled ? "Ativada" : "Desativada"}</p>
                    </div>
                    <span className={cn("h-3 w-3 rounded-full", aiEnabled ? "bg-success" : "bg-destructive")} />
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Conversas perdidas</p>
                    <p className="text-lg font-semibold">{lostCount}</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Fila aguardando</p>
                    <p className="text-lg font-semibold">{queueWaiting}</p>
                  </CardContent>
                </Card>
              </div>

              <TabsContent value="status" className="m-0">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Robot className="h-5 w-5 text-primary" />Status da IA
                      <TitleInfo text="Controla se a IA está ativa para responder automaticamente." />
                    </CardTitle>
                    <CardDescription>Acompanhe e altere o estado da IA em tempo real.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Collapsible defaultOpen>
                      <div className="flex items-center justify-between rounded-xl border border-border p-4">
                        <div>
                          <p className="font-medium">Ativar ou desativar IA</p>
                          <p className="text-sm text-muted-foreground">Escolha se o atendimento automático fica ligado.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={aiEnabled ? "secondary" : "destructive"} className="gap-1">
                            {aiEnabled ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                            {aiEnabled ? "Ativada" : "Desativada"}
                          </Badge>
                          <Switch checked={aiEnabled} onCheckedChange={(value) => void handleStatusToggle(value)} disabled={loading} />
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="mt-2">Ver mais</Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 text-sm text-muted-foreground">
                        O status é atualizado periodicamente para manter o painel sempre sincronizado.
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="prompt" className="m-0">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <NotePencil className="h-5 w-5 text-primary" />Editor de Prompt
                      <TitleInfo text="Define como a IA deve se comportar e falar com os clientes." />
                    </CardTitle>
                    <CardDescription>Edite o texto base e mantenha versões salvas.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-48" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={() => void savePrompt()} disabled={saving} className="gap-2"><FloppyDisk className="h-4 w-4" />Salvar</Button>
                      <Button type="button" variant="outline" onClick={() => setPrompt(DEFAULT_PROMPT)} className="gap-2"><ArrowCounterClockwise className="h-4 w-4" />Restaurar padrão</Button>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-sm font-medium mb-2">Histórico de versões</p>
                      <div className="space-y-2 max-h-40 overflow-auto scrollbar-thin">
                        {promptVersions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma versão salva ainda.</p>
                        ) : (
                          promptVersions.map((version) => (
                            <button key={version.id} className="w-full rounded-lg border border-border p-2 text-left hover:bg-muted/60" onClick={() => setPrompt(version.content)}>
                              <p className="text-xs text-muted-foreground">{new Date(version.savedAt).toLocaleString("pt-BR")}</p>
                              <p className="text-sm truncate">{version.content}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="business-hours" className="m-0">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />Horário Comercial
                      <TitleInfo text="Define o período de atendimento e o comportamento fora do horário." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">Configurar horários</Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Abertura</Label>
                            <Input type="time" value={openingHour} onChange={(e) => setOpeningHour(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Fechamento</Label>
                            <Input type="time" value={closingHour} onChange={(e) => setClosingHour(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Fuso horário</Label>
                          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div>
                            <p className="font-medium">Responder fora do horário</p>
                            <p className="text-xs text-muted-foreground">Ativa resposta automática quando não houver atendimento.</p>
                          </div>
                          <Switch checked={outsideHoursAutoReply} onCheckedChange={setOutsideHoursAutoReply} />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    <Button onClick={() => void saveBusinessHours()} disabled={saving}>Salvar horário</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="absence" className="m-0">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <WarningCircle className="h-5 w-5 text-primary" />Mensagem de Ausência
                      <TitleInfo text="Mensagem enviada quando o cliente chama fora do horário de atendimento." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="font-medium">Ativar mensagem automática</p>
                        <p className="text-xs text-muted-foreground">Liga ou desliga a resposta de ausência.</p>
                      </div>
                      <Switch checked={absenceEnabled} onCheckedChange={setAbsenceEnabled} />
                    </div>
                    <Textarea value={absenceMessage} onChange={(event) => setAbsenceMessage(event.target.value)} className="min-h-32" />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void saveAbsenceMessage()} disabled={saving}>Salvar mensagem</Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" type="button">Testar mensagem</Button>
                          </TooltipTrigger>
                          <TooltipContent>Use para validar o texto antes do uso em produção.</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reactivation" className="m-0">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Repeat className="h-5 w-5 text-primary" />Fila de Reativação
                      <TitleInfo text="Retoma contato com clientes que ficaram sem resposta." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tamanho do lote</Label>
                        <Input type="number" min={1} value={queueBatchSize} onChange={(event) => setQueueBatchSize(Number(event.target.value || 1))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Intervalo entre lotes (segundos)</Label>
                        <Input type="number" min={0} value={queueDelaySeconds} onChange={(event) => setQueueDelaySeconds(Number(event.target.value || 0))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem de reativação</Label>
                      <Textarea value={queueMessage} onChange={(event) => setQueueMessage(event.target.value)} className="min-h-24" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-xs text-muted-foreground">Clientes aguardando</p>
                        <p className="text-xl font-semibold">{queueWaiting}</p>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-xs text-muted-foreground">Mensagens enviadas hoje</p>
                        <p className="text-xl font-semibold">{queueSentToday}</p>
                      </div>
                    </div>
                    <Button onClick={() => void processQueue()} disabled={saving} className="gap-2"><MagicWand className="h-4 w-4" />Processar fila</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="training" className="m-0">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkle className="h-5 w-5 text-primary" />Central de Treinamento
                      <TitleInfo text="Melhora respostas da IA com base em conversas reais." />
                    </CardTitle>
                    <CardDescription>Revise respostas e aplique melhorias com um clique.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {trainingRows.map((row) => (
                      <div key={row.id} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={row.status === "lost" ? "destructive" : "secondary"}>{row.status === "lost" ? "perdida" : "encerrada"}</Badge>
                          <Button size="sm" variant="outline" onClick={() => openImproveModal(row)}>Melhorar resposta</Button>
                        </div>
                        <p className="text-sm"><span className="text-muted-foreground">Pergunta do cliente:</span> {row.customerQuestion}</p>
                        <p className="text-sm"><span className="text-muted-foreground">Resposta da IA:</span> {row.aiResponse}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="learning" className="m-0">
                <AILearningDashboard onPromptApplied={handleLearningPromptApplied} />
              </TabsContent>

              <TabsContent value="memory" className="m-0">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />Configuração de Memória
                      <TitleInfo text="Guarda contexto importante para personalizar o atendimento." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <p className="font-medium">Ativar memória</p>
                      <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <p className="font-medium">Lembrar último pedido</p>
                      <Switch checked={rememberLastOrder} onCheckedChange={setRememberLastOrder} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <p className="font-medium">Lembrar preferências</p>
                      <Switch checked={rememberPreferences} onCheckedChange={setRememberPreferences} />
                    </div>
                    <Button onClick={() => void saveMemory()} disabled={saving}>Salvar memória</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="advanced" className="m-0">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sliders className="h-5 w-5 text-primary" />Ajustes Avançados
                      <TitleInfo text="Controla estilo, tamanho e tempo das respostas automáticas." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>Temperatura</Label><span className="text-sm text-muted-foreground">{temperature[0].toFixed(1)}</span></div>
                      <Slider value={temperature} onValueChange={setTemperature} min={0} max={1} step={0.1} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>Máximo de tokens</Label><span className="text-sm text-muted-foreground">{maxTokens[0]}</span></div>
                      <Slider value={maxTokens} onValueChange={setMaxTokens} min={100} max={2000} step={50} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>Atraso de resposta (segundos)</Label><span className="text-sm text-muted-foreground">{responseDelay[0]}</span></div>
                      <Slider value={responseDelay} onValueChange={setResponseDelay} min={0} max={10} step={1} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <p className="font-medium">Follow-up automático</p>
                      <Switch checked={autoFollowUp} onCheckedChange={setAutoFollowUp} />
                    </div>
                    <Button onClick={() => void saveAdvanced()} disabled={saving}>Salvar ajustes</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </motion.div>

      <Dialog open={improveModalOpen} onOpenChange={setImproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar resposta melhorada</DialogTitle>
            <DialogDescription>Revise o texto antes de aplicar a melhoria.</DialogDescription>
          </DialogHeader>
          <Textarea value={improvedText} onChange={(event) => setImprovedText(event.target.value)} className="min-h-40" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => void improveResponse()} disabled={saving}>Gerar sugestão</Button>
            <Button onClick={saveImprovedResponse}>Salvar melhoria</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
