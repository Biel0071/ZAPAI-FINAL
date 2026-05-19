import { useCallback, useEffect, useMemo, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import { motion } from "framer-motion";
import {
  Plus,
  Megaphone,
  Play,
  Pause,
  Trash,
  PencilSimple,
  Clock,
  CheckCircle,
  Eye,
  Copy,
  CalendarBlank,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { StatGridSkeleton } from "@/components/ui/loading-skeleton";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { notify } from "@/services/notifyService";
import { cn } from "@/lib/utils";
import { requestApiEndpoint } from "@/services/apiService";

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: "scheduled" | "running" | "completed" | "paused";
  scheduledFor?: string;
  recipients: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  tags: string[];
}

const CAMPAIGN_ROW_HEIGHT = 344;

function getStatusColor(status: Campaign["status"]) {
  switch (status) {
    case "completed":
      return "bg-success/10 text-success";
    case "running":
      return "bg-info/10 text-info";
    case "scheduled":
      return "bg-warning/10 text-warning";
    case "paused":
      return "bg-muted text-muted-foreground";
  }
}

function getStatusLabel(status: Campaign["status"]) {
  switch (status) {
    case "completed":
      return "Concluída";
    case "running":
      return "Em execução";
    case "scheduled":
      return "Agendada";
    case "paused":
      return "Pausada";
  }
}

type CampaignRowData = {
  campaigns: Campaign[];
  startingCampaignId: string | null;
  onStart: (campaignId: string) => void;
};

function CampaignVirtualRow({ index, style, ...rowProps }: RowComponentProps<CampaignRowData>) {
  const { campaigns, startingCampaignId, onStart } = rowProps as CampaignRowData;
  const campaign = campaigns[index];
  if (!campaign) return <div style={style} />;

  return (
    <div style={style} className="px-1 py-2">
      <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl",
                campaign.status === "completed"
                  ? "bg-success/10"
                  : campaign.status === "running"
                  ? "bg-info/10"
                  : campaign.status === "scheduled"
                  ? "bg-warning/10"
                  : "bg-muted",
              )}
            >
              <Megaphone
                weight="duotone"
                className={cn(
                  "h-6 w-6",
                  campaign.status === "completed"
                    ? "text-success"
                    : campaign.status === "running"
                    ? "text-info"
                    : campaign.status === "scheduled"
                    ? "text-warning"
                    : "text-muted-foreground",
                )}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-display text-xl font-semibold">{campaign.name}</h3>
                <Badge className={getStatusColor(campaign.status)}>{getStatusLabel(campaign.status)}</Badge>
              </div>
              <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{campaign.message}</p>
              <div className="flex flex-wrap items-center gap-2">
                {campaign.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-full border border-border/70 bg-background/60 text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              {campaign.scheduledFor && (
                <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarBlank className="h-4 w-4" />
                  Agendada para {campaign.scheduledFor}
                </div>
              )}

              {campaign.status !== "scheduled" && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">
                      {campaign.sent} / {campaign.recipients} enviadas
                    </span>
                  </div>
                  <Progress value={campaign.recipients > 0 ? (campaign.sent / campaign.recipients) * 100 : 0} className="h-2" />
                </div>
              )}
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              {campaign.status === "running" && (
                <Button variant="outline" size="icon" disabled>
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {(campaign.status === "paused" || campaign.status === "scheduled") && (
                <Button variant="outline" size="icon" onClick={() => onStart(campaign.id)} disabled={startingCampaignId === campaign.id}>
                  {startingCampaignId === campaign.id ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
              )}
              <Button variant="outline" size="icon" disabled>
                <PencilSimple className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" disabled>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled>
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Campaigns() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [startingCampaignId, setStartingCampaignId] = useState<string | null>(null);
  const [campaignStep, setCampaignStep] = useState(1);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [typingDelay, setTypingDelay] = useState<number[]>([2.8]);
  const [delayRange, setDelayRange] = useState<number[]>([4, 12]);
  const [messageVariants, setMessageVariants] = useState<string[]>([
    "Olá! Temos uma condição especial hoje.",
    "Oi! Posso te mostrar uma oferta que combina com seu perfil.",
  ]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await requestApiEndpoint<unknown>("/api/campaigns");
      const list = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)
          ? ((payload as { data?: unknown[] }).data ?? [])
          : [];

      const normalized = list
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => ({
          id: String(item.id ?? `campaign-${index}`),
          name: String(item.name ?? "Campanha"),
          message: String(item.message ?? item.content ?? ""),
          status: String(item.status ?? "scheduled") as Campaign["status"],
          scheduledFor: typeof item.scheduledFor === "string" ? item.scheduledFor : undefined,
          recipients: Number(item.recipients ?? 0),
          sent: Number(item.sent ?? 0),
          delivered: Number(item.delivered ?? 0),
          read: Number(item.read ?? 0),
          replied: Number(item.replied ?? 0),
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        }));

      setCampaigns(normalized);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const safeCampaigns = useMemo(() => campaigns, [campaigns]);
  const totals = useMemo(() => {
    const sent = safeCampaigns.reduce((acc, item) => acc + item.sent, 0);
    const delivered = safeCampaigns.reduce((acc, item) => acc + item.delivered, 0);
    const read = safeCampaigns.reduce((acc, item) => acc + item.read, 0);
    const replied = safeCampaigns.reduce((acc, item) => acc + item.replied, 0);
    return {
      sent,
      readRate: delivered > 0 ? (read / delivered) * 100 : 0,
      replyRate: delivered > 0 ? (replied / delivered) * 100 : 0,
    };
  }, [safeCampaigns]);

  const handleStartCampaign = useCallback(async (campaignId: string) => {
    if (startingCampaignId) return;
    setStartingCampaignId(campaignId);
    try {
      const updated = await requestApiEndpoint<Partial<Campaign> & Record<string, unknown>>(`/api/campaigns/${encodeURIComponent(campaignId)}/start`, "POST");
      setCampaigns((prev) => prev.map((campaign) => campaign.id === campaignId ? { ...campaign, status: String(updated.status ?? "running") as Campaign["status"] } : campaign));
      notify.success("Campanha iniciada com sucesso");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Falha ao iniciar campanha");
    } finally {
      setStartingCampaignId(null);
    }
  }, [startingCampaignId]);

  const handleLaunchCampaign = useCallback(async () => {
    const payload = {
      name: `Campanha ${new Date().toLocaleTimeString("pt-BR")}`,
      variants: messageVariants,
      shuffleEnabled,
      typingDelaySeconds: typingDelay[0],
      delayRangeSeconds: delayRange,
      currentStep: campaignStep,
    };

    try {
      await requestApiEndpoint("/api/campaigns", "POST", payload);
      notify.success("Campanha criada com sucesso");
      await loadCampaigns();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Falha ao criar campanha");
    }
  }, [campaignStep, delayRange, loadCampaigns, messageVariants, shuffleEnabled, typingDelay]);

  const campaignRowProps = useMemo(
    () => ({ campaigns: safeCampaigns, startingCampaignId, onStart: handleStartCampaign }),
    [safeCampaigns, startingCampaignId, handleStartCampaign],
  );

  const listHeight = useMemo(() => Math.min(760, Math.max(250, safeCampaigns.length * CAMPAIGN_ROW_HEIGHT)), [safeCampaigns.length]);

  return (
    <div className="min-h-screen">
      <Header title="Campanhas" subtitle="Disparos em massa e campanhas programadas" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="page-container section-stack">
        <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
          <CardContent className="space-y-5 p-5">
            <p className="text-xs text-muted-foreground">Origem dos dados: API de produção</p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                "Selecionar contatos",
                "Criar mensagens",
                "Configurar delays",
                "Prévia",
                "Lançar",
              ].map((label, index) => {
                const step = index + 1;
                return (
                  <Button
                    key={label}
                    size="sm"
                    variant={campaignStep === step ? "default" : "outline"}
                    className={campaignStep === step ? "rounded-xl shadow-glow" : "rounded-xl"}
                    onClick={() => setCampaignStep(step)}
                  >
                    {step}. {label}
                  </Button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Randomização</p>
                  <Switch checked={shuffleEnabled} onCheckedChange={setShuffleEnabled} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Alterna entre múltiplas mensagens para variar os envios.</p>
                <div className="mt-3 space-y-2">
                  {messageVariants.map((variant, index) => (
                    <Input
                      key={`variant-${index}`}
                      value={variant}
                      onChange={(event) =>
                        setMessageVariants((prev) => prev.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)))
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Human Simulation</p>
                <p className="mt-1 text-xs text-muted-foreground">Ajuste atraso de digitação e intervalo entre mensagens.</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Typing delay</span>
                      <span>{typingDelay[0].toFixed(1)}s</span>
                    </div>
                    <Slider value={typingDelay} min={0.5} max={8} step={0.1} onValueChange={setTypingDelay} />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Delay range</span>
                      <span>{delayRange[0]}s - {delayRange[1]}s</span>
                    </div>
                    <Slider value={delayRange} min={1} max={20} step={1} onValueChange={setDelayRange} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Resumo de lançamento</p>
                <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                  <p>Etapa atual: <span className="font-medium text-foreground">{campaignStep}/5</span></p>
                  <p>Shuffle: <span className="font-medium text-foreground">{shuffleEnabled ? "Ativo" : "Desativado"}</span></p>
                  <p>Delay padrão: <span className="font-medium text-foreground">{typingDelay[0].toFixed(1)}s</span></p>
                  <p>Range envio: <span className="font-medium text-foreground">{delayRange[0]}-{delayRange[1]}s</span></p>
                </div>
                <Button className="mt-4 w-full rounded-xl shadow-glow" onClick={() => void handleLaunchCampaign()}>
                  Lançar campanha
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"><Megaphone weight="duotone" className="h-6 w-6 text-primary" /></div><div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Campanhas</p><h3 className="font-display text-2xl font-bold">{safeCampaigns.length}</h3></div></div><OperationalStatusBadge label="Orquestração ativa" tone="syncing" /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/10"><PaperPlaneTilt weight="fill" className="h-6 w-6 text-info" /></div><div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Enviadas</p><h3 className="font-display text-2xl font-bold">{totals.sent.toLocaleString("pt-BR")}</h3></div></div><OperationalStatusBadge label="Disparo controlado" tone="online" /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10"><Eye weight="duotone" className="h-6 w-6 text-success" /></div><div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Taxa de Leitura</p><h3 className="font-display text-2xl font-bold">{totals.readRate.toFixed(1)}%</h3></div></div><OperationalStatusBadge label="Interesse monitorado" tone="online" /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10"><CheckCircle weight="fill" className="h-6 w-6 text-warning" /></div><div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Taxa de Resposta</p><h3 className="font-display text-2xl font-bold">{totals.replyRate.toFixed(1)}%</h3></div></div><OperationalStatusBadge label="Follow-up ativo" tone="warning" /></CardContent></Card>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Suas Campanhas</h2>
          <Button className="gap-2 rounded-xl shadow-glow" onClick={() => setCampaignStep(1)}>
            <Plus weight="bold" className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        <div>
          {loading ? (
            <StatGridSkeleton count={4} />
          ) : safeCampaigns.length === 0 ? (
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Megaphone className="h-8 w-8 text-muted-foreground/50" />}
                  title="Nenhuma campanha disponível"
                  description="Crie sua primeira campanha oficial para orquestrar mensagens, delays e lançamentos em um único fluxo."
                  action={<Button className="rounded-xl shadow-glow" onClick={() => setCampaignStep(1)}>Criar campanha</Button>}
                />
              </CardContent>
            </Card>
          ) : (
            <List rowComponent={CampaignVirtualRow} rowCount={safeCampaigns.length} rowHeight={CAMPAIGN_ROW_HEIGHT} rowProps={campaignRowProps} style={{ height: listHeight }} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
