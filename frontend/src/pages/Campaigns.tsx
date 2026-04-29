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
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { notify } from "@/services/notifyService";
import { cn } from "@/lib/utils";
import { apiService, type Campaign } from "@/services/apiService";

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
      <Card className="glass-card">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-12 w-12 flex-shrink-0 rounded-xl flex items-center justify-center",
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
                <h3 className="font-semibold">{campaign.name}</h3>
                <Badge className={getStatusColor(campaign.status)}>{getStatusLabel(campaign.status)}</Badge>
              </div>
              <p className="mb-2 line-clamp-1 text-sm text-muted-foreground">{campaign.message}</p>
              <div className="flex items-center gap-2">
                {campaign.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              {campaign.scheduledFor && (
                <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
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
                  <Progress value={(campaign.sent / campaign.recipients) * 100} className="h-2" />
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
              {campaign.status === "scheduled" && (
                <Button variant="outline" size="icon">
                  <PencilSimple className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
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
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [startingCampaignId, setStartingCampaignId] = useState<string | null>(null);
  const [campaignStep, setCampaignStep] = useState(1);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [typingDelay, setTypingDelay] = useState<number[]>([2.8]);
  const [delayRange, setDelayRange] = useState<number[]>([4, 12]);
  const [messageVariants, setMessageVariants] = useState<string[]>([
    "Olá! Temos uma condição especial hoje.",
    "Oi! Posso te mostrar uma oferta que combina com seu perfil.",
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCampaignsError(null);
    apiService.getCampaigns()
      .then((data) => {
        if (!cancelled) {
          setCampaigns(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCampaignsError(err instanceof Error ? err.message : "Erro ao carregar campanhas");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const safeCampaigns = useMemo(() => (Array.isArray(campaigns) ? campaigns : []), [campaigns]);

  const handleStartCampaign = useCallback((campaignId: string) => {
    if (startingCampaignId) return;
    setStartingCampaignId(campaignId);
    window.setTimeout(() => {
      notify.success("Campaign started successfully");
      setStartingCampaignId(null);
    }, 900);
  }, [startingCampaignId]);

  const campaignRowProps = useMemo(
    () => ({ campaigns: safeCampaigns, startingCampaignId, onStart: handleStartCampaign }),
    [safeCampaigns, startingCampaignId, handleStartCampaign],
  );

  const listHeight = useMemo(() => Math.min(760, Math.max(250, safeCampaigns.length * CAMPAIGN_ROW_HEIGHT)), [safeCampaigns.length]);

  return (
    <div className="min-h-screen">
      <Header title="Campanhas" subtitle="Disparos em massa e campanhas programadas" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-6">
        <Card className="glass-card">
          <CardContent className="space-y-5 p-5">
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
                    onClick={() => setCampaignStep(step)}
                  >
                    {step}. {label}
                  </Button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
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

              <div className="rounded-xl border border-border bg-card p-4">
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

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Resumo de lançamento</p>
                <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                  <p>Etapa atual: <span className="font-medium text-foreground">{campaignStep}/5</span></p>
                  <p>Shuffle: <span className="font-medium text-foreground">{shuffleEnabled ? "Ativo" : "Desativado"}</span></p>
                  <p>Delay padrão: <span className="font-medium text-foreground">{typingDelay[0].toFixed(1)}s</span></p>
                  <p>Range envio: <span className="font-medium text-foreground">{delayRange[0]}-{delayRange[1]}s</span></p>
                </div>
                <Button className="mt-4 w-full">Lançar campanha</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><Megaphone weight="duotone" className="w-6 h-6 text-primary" /></div><div><p className="text-sm text-muted-foreground">Campanhas</p><h3 className="text-2xl font-bold font-display">{safeCampaigns.length}</h3></div></div></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center"><PaperPlaneTilt weight="fill" className="w-6 h-6 text-info" /></div><div><p className="text-sm text-muted-foreground">Enviadas</p><h3 className="text-2xl font-bold font-display">7,416</h3></div></div></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center"><Eye weight="duotone" className="w-6 h-6 text-success" /></div><div><p className="text-sm text-muted-foreground">Taxa de Leitura</p><h3 className="text-2xl font-bold font-display">76.4%</h3></div></div></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center"><CheckCircle weight="fill" className="w-6 h-6 text-warning" /></div><div><p className="text-sm text-muted-foreground">Taxa de Resposta</p><h3 className="text-2xl font-bold font-display">10.5%</h3></div></div></CardContent></Card>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Suas Campanhas</h2>
          <Button className="gap-2">
            <Plus weight="bold" className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        <div>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={`campaign-skeleton-${index}`} className="glass-card">
                  <CardContent className="space-y-3 p-5">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-2 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-9" />
                      <Skeleton className="h-9 w-9" />
                      <Skeleton className="h-9 w-9" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <List rowComponent={CampaignVirtualRow} rowCount={safeCampaigns.length} rowHeight={CAMPAIGN_ROW_HEIGHT} rowProps={campaignRowProps} style={{ height: listHeight }} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
