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
import { AILearningDashboard } from "@/components/ai/AILearningDashboard";
import type { AILovableViewModel } from "@/adapters/lovable/aiAdapter";

export type AISectionId =
  | "status"
  | "prompt"
  | "business-hours"
  | "absence"
  | "reactivation"
  | "training"
  | "learning"
  | "memory"
  | "advanced";

export type TrainingRow = {
  id: string;
  customerQuestion: string;
  aiResponse: string;
  status: "closed" | "lost";
};

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

export interface AIViewProps {
  viewModel: AILovableViewModel;
  activeSection: AISectionId;
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
  trainingRows: TrainingRow[];
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
  onSectionChange: (value: AISectionId) => void;
  onStatusToggle: (enabled: boolean) => void;
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
  onOpenImproveModal: (row: TrainingRow) => void;
  onPromptApplied: (payload: { newPrompt: string; promptVersionId: string }) => void;
  onMemoryEnabledChange: (value: boolean) => void;
  onRememberLastOrderChange: (value: boolean) => void;
  onRememberPreferencesChange: (value: boolean) => void;
  onSaveMemory: () => void;
  onTemperatureChange: (value: number[]) => void;
  onMaxTokensChange: (value: number[]) => void;
  onResponseDelayChange: (value: number[]) => void;
  onAutoFollowUpChange: (value: boolean) => void;
  onSaveAdvanced: () => void;
  onImproveModalOpenChange: (value: boolean) => void;
  onImprovedTextChange: (value: string) => void;
  onImproveResponse: () => void;
  onSaveImprovedResponse: () => void;
}

export function AIView(props: AIViewProps) {
  const {
    viewModel,
    activeSection,
    loading,
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
    onSectionChange,
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
    onMaxTokensChange,
    onResponseDelayChange,
    onAutoFollowUpChange,
    onSaveAdvanced,
    onImproveModalOpenChange,
    onImprovedTextChange,
    onImproveResponse,
    onSaveImprovedResponse,
  } = props;

  return (
    <div className="min-h-screen bg-background">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-container section-stack">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-3 backdrop-blur-xl md:p-5">
          <Tabs
            value={activeSection}
            onValueChange={(value) => onSectionChange(value as AISectionId)}
            orientation="vertical"
            className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]"
          >
            <TabsList className="h-auto w-full flex-col items-stretch rounded-xl bg-muted/60 p-2">
              {viewModel.sections.map((section) => (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:shadow-none"
                >
                  <span>{section.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-2 p-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status da IA</p>
                      <p className="text-lg font-semibold">{aiEnabled ? "Ativada" : "Desativada"}</p>
                    </div>
                    <OperationalStatusBadge label={aiEnabled ? "Assistente online" : "Assistente offline"} tone={aiEnabled ? "online" : "offline"} />
                  </CardContent>
                </Card>
                <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Conversas perdidas</p>
                    <p className="text-lg font-semibold">{lostCount}</p>
                    <OperationalStatusBadge label="Treinamento ativo" tone={lostCount > 0 ? "warning" : "online"} />
                  </CardContent>
                </Card>
                <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fila aguardando</p>
                    <p className="text-lg font-semibold">{queueWaiting}</p>
                    <OperationalStatusBadge label="Reativação monitorada" tone="syncing" />
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
                          <Switch checked={aiEnabled} onCheckedChange={onStatusToggle} disabled={loading} />
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
                    <Textarea value={prompt} onChange={(event) => onPromptChange(event.target.value)} className="min-h-48" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={onSavePrompt} disabled={saving} className="gap-2"><FloppyDisk className="h-4 w-4" />Salvar</Button>
                      <Button type="button" variant="outline" onClick={onRestorePrompt} className="gap-2"><ArrowCounterClockwise className="h-4 w-4" />Restaurar padrão</Button>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-sm font-medium mb-2">Histórico de versões</p>
                      <div className="space-y-2 max-h-40 overflow-auto scrollbar-thin">
                        {promptVersions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma versão salva ainda.</p>
                        ) : (
                          promptVersions.map((version) => (
                            <button key={version.id} className="w-full rounded-lg border border-border p-2 text-left hover:bg-muted/60" onClick={() => onSelectPromptVersion(version.content)}>
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
                            <Input type="time" value={openingHour} onChange={(e) => onOpeningHourChange(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Fechamento</Label>
                            <Input type="time" value={closingHour} onChange={(e) => onClosingHourChange(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Fuso horário</Label>
                          <Input value={timezone} onChange={(e) => onTimezoneChange(e.target.value)} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div>
                            <p className="font-medium">Responder fora do horário</p>
                            <p className="text-xs text-muted-foreground">Ativa resposta automática quando não houver atendimento.</p>
                          </div>
                          <Switch checked={outsideHoursAutoReply} onCheckedChange={onOutsideHoursAutoReplyChange} />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    <Button onClick={onSaveBusinessHours} disabled={saving}>Salvar horário</Button>
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
                      <Switch checked={absenceEnabled} onCheckedChange={onAbsenceEnabledChange} />
                    </div>
                    <Textarea value={absenceMessage} onChange={(event) => onAbsenceMessageChange(event.target.value)} className="min-h-32" />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={onSaveAbsenceMessage} disabled={saving}>Salvar mensagem</Button>
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
                        <Input type="number" min={1} value={queueBatchSize} onChange={(event) => onQueueBatchSizeChange(Number(event.target.value || 1))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Intervalo entre lotes (segundos)</Label>
                        <Input type="number" min={0} value={queueDelaySeconds} onChange={(event) => onQueueDelaySecondsChange(Number(event.target.value || 0))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem de reativação</Label>
                      <Textarea value={queueMessage} onChange={(event) => onQueueMessageChange(event.target.value)} className="min-h-24" />
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
                    <Button onClick={onProcessQueue} disabled={saving} className="gap-2"><MagicWand className="h-4 w-4" />Processar fila</Button>
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
                          <Button size="sm" variant="outline" onClick={() => onOpenImproveModal(row)}>Melhorar resposta</Button>
                        </div>
                        <p className="text-sm"><span className="text-muted-foreground">Pergunta do cliente:</span> {row.customerQuestion}</p>
                        <p className="text-sm"><span className="text-muted-foreground">Resposta da IA:</span> {row.aiResponse}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="learning" className="m-0">
                <AILearningDashboard onPromptApplied={onPromptApplied} />
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
                      <Switch checked={memoryEnabled} onCheckedChange={onMemoryEnabledChange} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <p className="font-medium">Lembrar último pedido</p>
                      <Switch checked={rememberLastOrder} onCheckedChange={onRememberLastOrderChange} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <p className="font-medium">Lembrar preferências</p>
                      <Switch checked={rememberPreferences} onCheckedChange={onRememberPreferencesChange} />
                    </div>
                    <Button onClick={onSaveMemory} disabled={saving}>Salvar memória</Button>
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
                      <Slider value={temperature} onValueChange={onTemperatureChange} min={0} max={1} step={0.1} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>Máximo de tokens</Label><span className="text-sm text-muted-foreground">{maxTokens[0]}</span></div>
                      <Slider value={maxTokens} onValueChange={onMaxTokensChange} min={100} max={2000} step={50} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>Atraso de resposta (segundos)</Label><span className="text-sm text-muted-foreground">{responseDelay[0]}</span></div>
                      <Slider value={responseDelay} onValueChange={onResponseDelayChange} min={0} max={10} step={1} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <p className="font-medium">Follow-up automático</p>
                      <Switch checked={autoFollowUp} onCheckedChange={onAutoFollowUpChange} />
                    </div>
                    <Button onClick={onSaveAdvanced} disabled={saving}>Salvar ajustes</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </motion.div>

      <Dialog open={improveModalOpen} onOpenChange={onImproveModalOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar resposta melhorada</DialogTitle>
            <DialogDescription>Revise o texto antes de aplicar a melhoria.</DialogDescription>
          </DialogHeader>
          <Textarea value={improvedText} onChange={(event) => onImprovedTextChange(event.target.value)} className="min-h-40" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onImproveResponse} disabled={saving}>Gerar sugestão</Button>
            <Button onClick={onSaveImprovedResponse}>Salvar melhoria</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
