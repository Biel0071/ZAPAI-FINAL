import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowsClockwise,
  Brain,
  Buildings,
  CheckCircle,
  ClockCounterClockwise,
  Cloud,
  Cpu,
  Eye,
  EyeSlash,
  FloppyDisk,
  Globe,
  HardDrives,
  Key,
  Lightning,
  Lock,
  Play,
  PlugsConnected,
  Pulse,
  Robot,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  TerminalWindow,
  Trash,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/core/lib/utils";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";

type RoutingMode = "AUTO" | "FAST" | "QUALITY" | "LOCAL" | "SPECIFIC";
type VaultScope = "master" | "company";

interface CatalogModel {
  id: string;
  providerId: string;
  category: "local" | "free_tier" | "paid" | string;
  available: boolean;
  active: boolean;
  isDefault: boolean;
  requiresKey: boolean;
  localInstalled: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTemperature: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  qualityScore: number;
  speedScore: number;
  healthStatus: string;
  latencyMs: number | null;
  lastTestedAt: string | null;
  lastError: string | null;
}

interface CatalogProvider {
  id: string;
  name: string;
  kind: "managed" | "local" | "cloud" | string;
  requiresClientKey: boolean;
  hasCredential: boolean;
  credentialScope: string | null;
  credentialHint: string | null;
  defaultModel: string;
  healthStatus: string;
  latencyMs: number | null;
  lastTestedAt: string | null;
  models: CatalogModel[];
}

interface RouterPolicy {
  companyId: string;
  defaultMode: RoutingMode | string;
  fallbackEnabled: boolean;
  zaiEnabled: boolean;
  dailyZaiLimit: number;
  preferredProviders: string[];
  updatedBy: string | null;
  updatedAt: string | null;
}

interface OllamaRuntimeStatus {
  online: boolean;
  installedCount: number;
  installedModels: string[];
  latencyMs: number | null;
  error: string | null;
}

interface MaskedCredential {
  id: number | string;
  scope: "master" | "company" | "agent" | string;
  company_id: string;
  agent_key?: string | null;
  provider_id: string;
  label?: string | null;
  key_hint: string;
  default_model?: string | null;
  enabled: boolean;
  health_status?: string | null;
  last_tested_at?: string | null;
  last_latency_ms?: number | null;
  last_error?: string | null;
  last_used_at?: string | null;
  created_by?: string | null;
  revoked_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  legacy?: boolean;
}

interface AuditLogEntry {
  id: number | string;
  company_id: string;
  scope: string;
  agent_key?: string | null;
  provider_id: string;
  action: string;
  actor_id?: string | null;
  actor_name?: string | null;
  detail?: Record<string, unknown> | string | null;
  created_at: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface InlineTestResult {
  ok: boolean;
  providerId: string;
  modelId: string;
  healthStatus: string;
  latencyMs?: number;
  error?: string;
}

const CANONICAL_PROVIDER_ORDER = [
  "zai",
  "ollama",
  "groq",
  "openai",
  "gemini",
  "claude",
  "deepseek",
  "openrouter",
  "cloudflare",
] as const;

const ROUTING_MODE_META: Record<
  RoutingMode,
  { label: string; short: string; description: string }
> = {
  AUTO: {
    label: "AUTO",
    short: "Melhor modelo saudável",
    description:
      "Seleciona automaticamente o melhor modelo saudável considerando prioridade ZAI gerenciado, runtime local, tier gratuito e qualidade.",
  },
  FAST: {
    label: "FAST",
    short: "Menor latência",
    description:
      "Minimiza o tempo de resposta priorizando modelos com maior velocidade (speedScore) e menor latência medida em milissegundos.",
  },
  QUALITY: {
    label: "QUALITY",
    short: "Máxima capacidade",
    description:
      "Maximiza raciocínio, contexto e precisão escolhendo modelos de maior pontuação de qualidade disponíveis no catálogo.",
  },
  LOCAL: {
    label: "LOCAL",
    short: "Somente Ollama VPS",
    description:
      "Mantém toda a inferência restrita ao runtime local Ollama na VPS, sem enviar prompts para provedores cloud externos.",
  },
  SPECIFIC: {
    label: "SPECIFIC",
    short: "Provedor/Modelo fixo",
    description:
      "Respeita estritamente o provedor e modelo fixados no agente ou credencial, acionando fallback apenas quando habilitado.",
  },
};

const HEALTH_BADGE_MAP: Record<string, { label: string; className: string }> = {
  healthy: {
    label: "healthy",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  },
  available: {
    label: "healthy",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  },
  degraded: {
    label: "degraded",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  quota_exceeded: {
    label: "quota_exceeded",
    className: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  },
  unauthorized: {
    label: "unauthorized",
    className: "border-destructive/50 bg-destructive/15 text-destructive",
  },
  unconfigured: {
    label: "unconfigured",
    className: "border-border/70 bg-muted/60 text-muted-foreground",
  },
  unavailable: {
    label: "unconfigured",
    className: "border-border/70 bg-muted/60 text-muted-foreground",
  },
  revoked: {
    label: "revoked",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  unknown: {
    label: "unconfigured",
    className: "border-border/70 bg-muted/60 text-muted-foreground",
  },
};

const AUDIT_ACTION_BADGE_MAP: Record<string, { label: string; className: string }> = {
  created: {
    label: "created",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  },
  rotated: {
    label: "rotated",
    className: "border-info/40 bg-info/15 text-info",
  },
  updated: {
    label: "updated",
    className: "border-info/40 bg-info/15 text-info",
  },
  tested: {
    label: "tested",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  tested_failed: {
    label: "tested (falha)",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  revoked: {
    label: "revoked",
    className: "border-destructive/40 bg-destructive/15 text-destructive",
  },
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTokens(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString("pt-BR");
}

function formatUsdCost(input: number, output: number): string {
  if (!input && !output) return "Grátis ($0.00)";
  return `$${input.toFixed(2)} / $${output.toFixed(2)}`;
}

function parseAuditDetail(detail: AuditLogEntry["detail"]): Record<string, unknown> {
  if (!detail) return {};
  if (typeof detail === "object") return detail;
  try {
    const parsed = JSON.parse(detail);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readInitialCompanyContext(): string {
  try {
    return window.localStorage.getItem("zai_admin_company_context")?.trim() || "default";
  } catch {
    return "default";
  }
}

function HealthBadge({ status }: { status: string | null | undefined }) {
  const key = String(status || "unconfigured").toLowerCase();
  const cfg = HEALTH_BADGE_MAP[key] || {
    label: key,
    className: "border-border/70 bg-muted/60 text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px] px-2 py-0.5", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  if (category === "local") {
    return (
      <Badge variant="outline" className="border-emerald-500/35 bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0">
        Local
      </Badge>
    );
  }
  if (category === "free_tier") {
    return (
      <Badge variant="outline" className="border-sky-500/35 bg-sky-500/10 text-sky-400 text-[10px] px-1.5 py-0">
        Gratuito
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/35 bg-amber-500/10 text-amber-300 text-[10px] px-1.5 py-0">
      Pago
    </Badge>
  );
}

export default function MasterAIProviders() {
  const [companyId, setCompanyId] = useState<string>(readInitialCompanyContext);
  const [companies, setCompanies] = useState<CompanyOption[]>([
    { id: "default", name: "Global / Default (default)" },
  ]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [routingModes, setRoutingModes] = useState<RoutingMode[]>(["AUTO", "FAST", "QUALITY", "LOCAL", "SPECIFIC"]);
  const [ollama, setOllama] = useState<OllamaRuntimeStatus>({
    online: false,
    installedCount: 0,
    installedModels: [],
    latencyMs: null,
    error: null,
  });
  const [providers, setProviders] = useState<CatalogProvider[]>([]);
  const [credentials, setCredentials] = useState<MaskedCredential[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [policyDraft, setPolicyDraft] = useState<RouterPolicy>({
    companyId: "default",
    defaultMode: "AUTO",
    fallbackEnabled: true,
    zaiEnabled: true,
    dailyZaiLimit: 200,
    preferredProviders: ["zai", "groq", "openai", "gemini", "openrouter"],
    updatedBy: null,
    updatedAt: null,
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [matrixFilter, setMatrixFilter] = useState<"all" | "configured" | "available">("all");
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | number | null>(null);

  // Vault state — apiKey is strictly ephemeral in React memory, cleared immediately on submit, never persisted to localStorage.
  const [vaultScope, setVaultScope] = useState<VaultScope>("master");
  const [vaultProviderId, setVaultProviderId] = useState<string>("openai");
  const [vaultDefaultModel, setVaultDefaultModel] = useState<string>("__provider_default__");
  const [vaultApiKey, setVaultApiKey] = useState<string>("");
  const [vaultLabel, setVaultLabel] = useState<string>("");
  const [showVaultKey, setShowVaultKey] = useState(false);
  const [savingVault, setSavingVault] = useState(false);
  const [testingVault, setTestingVault] = useState(false);
  const [vaultTestResult, setVaultTestResult] = useState<InlineTestResult | null>(null);

  const loadCompanies = useCallback(async () => {
    try {
      const res = await requestApiEndpoint<{ companies?: Array<{ id: string; name: string }> }>(
        "/admin/master/companies",
        "GET",
      );
      const list = Array.isArray(res?.companies) ? res.companies : [];
      const mapped: CompanyOption[] = [{ id: "default", name: "Global / Default (default)" }];
      for (const item of list) {
        if (item?.id && item.id !== "default") {
          mapped.push({ id: item.id, name: `${item.name || item.id} (${item.id})` });
        }
      }
      setCompanies(mapped);
    } catch {
      // Non-fatal: fallback to default company option.
    }
  }, []);

  const loadControlPlane = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setRefreshing(true);
      try {
        const [catalogRes, auditRes] = await Promise.all([
          apiService.getMasterAIProvidersCatalog(companyId, forceRefresh),
          apiService.getMasterAIAuditLog(companyId, 80),
        ]);

        const modes = (catalogRes.routingModes || ["AUTO", "FAST", "QUALITY", "LOCAL", "SPECIFIC"]).filter(
          (m): m is RoutingMode => m in ROUTING_MODE_META,
        );
        setRoutingModes(modes.length > 0 ? modes : ["AUTO", "FAST", "QUALITY", "LOCAL", "SPECIFIC"]);

        if (catalogRes.ollama) {
          setOllama({
            online: Boolean(catalogRes.ollama.online),
            installedCount: Number(catalogRes.ollama.installedCount || 0),
            installedModels: Array.isArray(catalogRes.ollama.installedModels)
              ? catalogRes.ollama.installedModels
              : [],
            latencyMs: catalogRes.ollama.latencyMs ?? null,
            error: catalogRes.ollama.error ?? null,
          });
        }

        if (catalogRes.policy) {
          setPolicyDraft({
            companyId: catalogRes.policy.companyId || companyId,
            defaultMode: (catalogRes.policy.defaultMode || "AUTO") as RoutingMode,
            fallbackEnabled: catalogRes.policy.fallbackEnabled !== false,
            zaiEnabled: catalogRes.policy.zaiEnabled !== false,
            dailyZaiLimit: Number(catalogRes.policy.dailyZaiLimit ?? 200),
            preferredProviders: Array.isArray(catalogRes.policy.preferredProviders)
              ? catalogRes.policy.preferredProviders
              : ["zai", "groq", "openai", "gemini", "openrouter"],
            updatedBy: catalogRes.policy.updatedBy ?? null,
            updatedAt: catalogRes.policy.updatedAt ?? null,
          });
        }

        const rawProviders: CatalogProvider[] = Array.isArray(catalogRes.providers)
          ? catalogRes.providers
          : [];
        const sortedProviders = [...rawProviders].sort((a, b) => {
          const idxA = CANONICAL_PROVIDER_ORDER.indexOf(a.id as (typeof CANONICAL_PROVIDER_ORDER)[number]);
          const idxB = CANONICAL_PROVIDER_ORDER.indexOf(b.id as (typeof CANONICAL_PROVIDER_ORDER)[number]);
          const rankA = idxA === -1 ? 999 : idxA;
          const rankB = idxB === -1 ? 999 : idxB;
          return rankA - rankB;
        });
        setProviders(sortedProviders);
        setCredentials(Array.isArray(catalogRes.credentials) ? catalogRes.credentials : []);
        setAuditLogs(Array.isArray(auditRes?.logs) ? auditRes.logs : []);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao carregar control plane de IA.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId],
  );

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    setLoading(true);
    void loadControlPlane(false);
  }, [loadControlPlane]);

  // Clear ephemeral key state if component unmounts or scope switches.
  useEffect(() => {
    return () => {
      setVaultApiKey("");
    };
  }, []);

  const orderedProviders = useMemo(() => {
    if (matrixFilter === "configured") {
      return providers.filter((p) => p.hasCredential || p.id === "zai" || p.id === "ollama");
    }
    if (matrixFilter === "available") {
      return providers.filter((p) => p.models.some((m) => m.available));
    }
    return providers;
  }, [providers, matrixFilter]);

  const zaiProvider = useMemo(
    () => providers.find((p) => p.id === "zai") || null,
    [providers],
  );

  const selectedVaultProvider = useMemo(
    () => providers.find((p) => p.id === vaultProviderId) || null,
    [providers, vaultProviderId],
  );

  const activeModeKey = (
    policyDraft.defaultMode in ROUTING_MODE_META ? policyDraft.defaultMode : "AUTO"
  ) as RoutingMode;
  const activeModeInfo = ROUTING_MODE_META[activeModeKey];

  const kpiSummary = useMemo(() => {
    const healthyProviders = providers.filter((p) => p.healthStatus === "healthy").length;
    const totalModels = providers.reduce((acc, p) => acc + p.models.length, 0);
    const availableModels = providers.reduce(
      (acc, p) => acc + p.models.filter((m) => m.available).length,
      0,
    );
    const activeVaultKeys = credentials.filter((c) => c.enabled && !c.revoked_at).length;
    return { healthyProviders, totalModels, availableModels, activeVaultKeys };
  }, [providers, credentials]);

  const handleSavePolicy = async (successMessage = "Política de roteamento de IA atualizada.") => {
    setSavingPolicy(true);
    try {
      const res = await apiService.updateMasterAIRouterPolicy({
        companyId,
        defaultMode: policyDraft.defaultMode,
        fallbackEnabled: policyDraft.fallbackEnabled,
        zaiEnabled: policyDraft.zaiEnabled,
        dailyZaiLimit: Math.max(0, Number(policyDraft.dailyZaiLimit) || 0),
        preferredProviders: policyDraft.preferredProviders,
      });
      if (res?.policy) {
        setPolicyDraft((prev) => ({ ...prev, ...res.policy }));
      }
      toast.success(successMessage);
      await loadControlPlane(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar política de IA.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleTestProviderOrModel = async ({
    providerId,
    modelId,
    scope,
    credentialId,
  }: {
    providerId: string;
    modelId?: string;
    scope?: string;
    credentialId?: number | string | null;
  }) => {
    const key = `${providerId}:${modelId || "default"}:${credentialId || "none"}`;
    setTestingKey(key);
    try {
      const result = await apiService.testMasterAIProvider({
        providerId,
        modelId,
        scope: scope || (providerId === "zai" || providerId === "ollama" ? "master" : "company"),
        companyId,
        credentialId: credentialId ?? null,
      });
      if (result.ok) {
        toast.success(
          `${providerId.toUpperCase()} (${result.modelId}) operacional · ${result.latencyMs ?? "—"} ms`,
        );
      } else {
        toast.error(
          `${providerId.toUpperCase()} (${result.modelId}): ${result.error || result.healthStatus}`,
        );
      }
      await loadControlPlane(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao testar conexão do provedor.");
    } finally {
      setTestingKey(null);
    }
  };

  const handleTestVaultKey = async () => {
    setTestingVault(true);
    setVaultTestResult(null);
    try {
      const chosenModel =
        vaultDefaultModel === "__provider_default__"
          ? selectedVaultProvider?.defaultModel
          : vaultDefaultModel;
      const result = await apiService.testMasterAIProvider({
        providerId: vaultProviderId,
        modelId: chosenModel || undefined,
        apiKey: vaultApiKey.trim() || undefined,
        scope: vaultScope,
        companyId,
      });
      setVaultTestResult({
        ok: result.ok,
        providerId: result.providerId,
        modelId: result.modelId,
        healthStatus: result.healthStatus,
        latencyMs: result.latencyMs,
        error: result.error,
      });
      if (result.ok) {
        toast.success(`Chave validada (${result.providerId}/${result.modelId}) · ${result.latencyMs ?? 0} ms`);
      } else {
        toast.error(`Falha na validação: ${result.error || result.healthStatus}`);
      }
      await loadControlPlane(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao testar chave de API.");
    } finally {
      setTestingVault(false);
    }
  };

  const handleSaveVaultCredential = async (event: React.FormEvent) => {
    event.preventDefault();
    const rawSecret = vaultApiKey.trim();
    // Immediately clear raw API key from React state on submit; never store in localStorage.
    setVaultApiKey("");

    if (!rawSecret) {
      toast.error("Informe uma API key válida antes de salvar ou rotacionar no cofre.");
      return;
    }

    setSavingVault(true);
    try {
      const chosenModel =
        vaultDefaultModel === "__provider_default__"
          ? selectedVaultProvider?.defaultModel || undefined
          : vaultDefaultModel;

      const res = await apiService.saveMasterAICredential({
        scope: vaultScope,
        companyId: vaultScope === "master" ? undefined : companyId,
        providerId: vaultProviderId,
        apiKey: rawSecret,
        defaultModel: chosenModel,
        label: vaultLabel.trim() || undefined,
        enabled: true,
      });

      setVaultLabel("");
      setVaultTestResult(null);
      toast.success(
        `Credencial salva no cofre criptografado (${res.credential?.key_hint || "mascarada"}).`,
      );
      await loadControlPlane(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar credencial no cofre.");
    } finally {
      setSavingVault(false);
    }
  };

  const handleRevokeCredential = async (cred: MaskedCredential) => {
    setRevokingId(cred.id);
    try {
      const targetCompany = cred.company_id === "__master__" ? companyId : cred.company_id;
      await apiService.revokeMasterAICredential(cred.id, targetCompany);
      toast.success(`Credencial ${cred.provider_id} (${cred.key_hint}) revogada.`);
      await loadControlPlane(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao revogar credencial.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header
        title="PROVEDORES & MODELOS DE IA"
        subtitle="Control Plane Master · Model Router, Runtime ZAI/Ollama e Cofre Criptografado"
        runtimeState={ollama.online || kpiSummary.healthyProviders > 0 ? "running" : "reconnecting"}
      />

      <div className="page-container section-stack">
        {/* Enterprise Banner */}
        <Card className="glass-card border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-card/90 to-card/70">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                    <Cpu className="h-5 w-5" weight="duotone" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        PROVEDORES &amp; MODELOS DE IA
                      </h1>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400 gap-1.5 text-[11px]"
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        Control Plane Ativo
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 text-[11px]",
                          ollama.online
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                        )}
                      >
                        <HardDrives className="h-3 w-3" />
                        Ollama {ollama.online ? `Online (${ollama.latencyMs ?? 0} ms)` : "Offline"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      Orquestração multi-provedor, políticas do Model Router, monitoramento de saúde e cofre AES-256-GCM sem exposição de segredos.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="min-w-[220px]">
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger aria-label="Contexto da empresa" className="h-9 bg-background/70 border-border/70 text-xs">
                      <Buildings className="mr-1.5 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <SelectValue placeholder="Empresa alvo" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={refreshing || loading}
                  onClick={() => void loadControlPlane(true)}
                  className="h-9 border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                >
                  <ArrowsClockwise className={cn("mr-1.5 h-4 w-4", refreshing && "animate-spin")} />
                  Redescobrir Modelos
                </Button>
              </div>
            </div>

            {/* Operational Metrics Row */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Provedores Saudáveis</span>
                  <Pulse className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <p className="mt-1 font-display text-xl font-bold text-foreground">
                  {kpiSummary.healthyProviders} <span className="text-xs font-normal text-muted-foreground">/ {providers.length}</span>
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Modelos Disponíveis</span>
                  <Sparkle className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <p className="mt-1 font-display text-xl font-bold text-foreground">
                  {kpiSummary.availableModels} <span className="text-xs font-normal text-muted-foreground">/ {kpiSummary.totalModels}</span>
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Modo Router Ativo</span>
                  <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <p className="mt-1 font-display text-xl font-bold text-emerald-400">{activeModeKey}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Chaves no Cofre</span>
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <p className="mt-1 font-display text-xl font-bold text-foreground">{kpiSummary.activeVaultKeys}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <WarningCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => void loadControlPlane(true)}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Row 1: PROVEDOR ZAI Card + Model Router Policy Card */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* PROVEDOR ZAI Card */}
          <Card className="glass-card border-emerald-500/25">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                    <Robot className="h-5 w-5" weight="duotone" />
                  </div>
                  <div>
                    <CardTitle className="font-display text-base">PROVEDOR ZAI</CardTitle>
                    <CardDescription className="text-xs">
                      Motor gerenciado nativo da plataforma sobre Ollama VPS
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <HealthBadge status={zaiProvider?.healthStatus || (ollama.online ? "healthy" : "degraded")} />
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      policyDraft.zaiEnabled
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                    )}
                  >
                    {policyDraft.zaiEnabled ? "Habilitado" : "Desabilitado"}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" weight="fill" />
                <div>
                  <p className="font-semibold text-emerald-300">
                    Zero API Key pessoal exigida para Master ou planos habilitados
                  </p>
                  <p className="mt-0.5 text-emerald-200/80">
                    O PROVEDOR ZAI utiliza automaticamente a infraestrutura gerenciada e modelos locais da VPS sem exigir chave externa do cliente.
                  </p>
                </div>
              </div>

              {/* Ollama Local Runtime & Discovered Models */}
              <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <TerminalWindow className="h-4 w-4 text-emerald-400" />
                    <span>Runtime Ollama Local</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        ollama.online
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                          : "border-destructive/40 bg-destructive/15 text-destructive",
                      )}
                    >
                      {ollama.online ? "Online" : "Offline"}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {ollama.latencyMs != null ? `${ollama.latencyMs} ms` : "—"}
                    </span>
                  </div>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-full" />
                ) : ollama.installedModels.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      Modelos locais descobertos ({ollama.installedCount}):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ollama.installedModels.map((modelName) => (
                        <Badge
                          key={modelName}
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-mono text-[11px]"
                        >
                          {modelName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {ollama.error
                      ? `Falha na descoberta local: ${ollama.error}`
                      : "Nenhum modelo local reportado pelo runtime Ollama no momento."}
                  </p>
                )}
              </div>

              {/* ZAI Policy Controls */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/40 px-3.5 py-2.5">
                  <div>
                    <Label htmlFor="zai-enabled-switch" className="text-xs font-semibold">
                      Ativar Provedor ZAI
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Disponibiliza ZAI no roteador desta empresa
                    </p>
                  </div>
                  <Switch
                    id="zai-enabled-switch"
                    checked={policyDraft.zaiEnabled}
                    onCheckedChange={(checked) =>
                      setPolicyDraft((prev) => ({ ...prev, zaiEnabled: checked }))
                    }
                  />
                </div>

                <div className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-2 space-y-1">
                  <Label htmlFor="zai-daily-limit" className="text-xs font-semibold">
                    Limite Diário ZAI (req/dia)
                  </Label>
                  <Input
                    id="zai-daily-limit"
                    type="number"
                    min={0}
                    value={policyDraft.dailyZaiLimit}
                    onChange={(e) =>
                      setPolicyDraft((prev) => ({
                        ...prev,
                        dailyZaiLimit: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Atualizado: {formatDateTime(policyDraft.updatedAt)}
                  {policyDraft.updatedBy ? ` por ${policyDraft.updatedBy}` : ""}
                </span>
                <Button
                  size="sm"
                  disabled={savingPolicy || loading}
                  onClick={() => void handleSavePolicy("Política do PROVEDOR ZAI salva.")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <FloppyDisk className="mr-1.5 h-4 w-4" />
                  {savingPolicy ? "Salvando..." : "Salvar Política ZAI"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Model Router Policy Card */}
          <Card className="glass-card border-border/80">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
                    <Brain className="h-5 w-5" weight="duotone" />
                  </div>
                  <div>
                    <CardTitle className="font-display text-base">Política do Model Router</CardTitle>
                    <CardDescription className="text-xs">
                      Estratégia padrão de seleção de modelo e fallback automático
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-mono text-[11px]">
                  Modo: {activeModeKey}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Interactive Mode Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Modo de Roteamento Padrão</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {routingModes.map((mode) => {
                    const meta = ROUTING_MODE_META[mode];
                    const selected = activeModeKey === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          setPolicyDraft((prev) => ({ ...prev, defaultMode: mode }))
                        }
                        className={cn(
                          "rounded-xl border px-2.5 py-2 text-left transition-all",
                          selected
                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 shadow-sm"
                            : "border-border/70 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        <p className="font-mono text-xs font-bold">{meta.label}</p>
                        <p className="mt-0.5 text-[10px] leading-tight opacity-85 line-clamp-2">
                          {meta.short}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Mode Explanation */}
              <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <Lightning className="h-3.5 w-3.5" weight="fill" />
                  <span>Comportamento do modo {activeModeInfo.label}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">{activeModeInfo.description}</p>
              </div>

              {/* Automatic Fallback Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/40 px-3.5 py-2.5">
                <div>
                  <Label htmlFor="router-fallback-switch" className="text-xs font-semibold">
                    Fallback Automático em Falhas / Quota
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Redireciona automaticamente para o próximo candidato saudável em caso de 401/429/timeout
                  </p>
                </div>
                <Switch
                  id="router-fallback-switch"
                  checked={policyDraft.fallbackEnabled}
                  onCheckedChange={(checked) =>
                    setPolicyDraft((prev) => ({ ...prev, fallbackEnabled: checked }))
                  }
                />
              </div>

              {policyDraft.preferredProviders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-muted-foreground">Ordem preferencial:</span>
                  {policyDraft.preferredProviders.map((prov, idx) => (
                    <Badge key={prov} variant="outline" className="font-mono text-[10px]">
                      {idx + 1}. {prov}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  disabled={savingPolicy || loading}
                  onClick={() => void handleSavePolicy("Política do Model Router salva com sucesso.")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <FloppyDisk className="mr-1.5 h-4 w-4" />
                  {savingPolicy ? "Salvando..." : "Salvar Roteamento"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider & Model Matrix */}
        <Card className="glass-card border-border/80">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <PlugsConnected className="h-5 w-5 text-emerald-400" weight="duotone" />
                  Matriz de Provedores &amp; Modelos
                </CardTitle>
                <CardDescription className="text-xs">
                  Status em tempo real de todos os provedores suportados, janelas de contexto, custos por 1M tokens, latência e teste 1-clique.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "all" as const, label: `Todos (${providers.length})` },
                  { id: "configured" as const, label: "Configurados / Locais" },
                  { id: "available" as const, label: "Com Modelos Disponíveis" },
                ].map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant={matrixFilter === opt.id ? "default" : "outline"}
                    onClick={() => setMatrixFilter(opt.id)}
                    className="h-8 text-xs"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={`provider-skel-${idx}`} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : orderedProviders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum provedor corresponde ao filtro selecionado.
              </p>
            ) : (
              orderedProviders.map((provider) => {
                const providerTestKey = `${provider.id}:${provider.defaultModel || "default"}:none`;
                const isProviderTesting = testingKey === providerTestKey;

                return (
                  <div
                    key={provider.id}
                    className="rounded-xl border border-border/70 bg-background/40 overflow-hidden"
                  >
                    {/* Provider Subheader */}
                    <div className="flex flex-col gap-3 border-b border-border/60 bg-card/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-emerald-400">
                          {provider.kind === "local" ? (
                            <HardDrives className="h-4 w-4" />
                          ) : provider.kind === "managed" ? (
                            <Robot className="h-4 w-4" />
                          ) : (
                            <Cloud className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {provider.name}
                            </span>
                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                              {provider.id}
                            </Badge>
                            <HealthBadge status={provider.healthStatus} />
                            {!provider.requiresClientKey ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/35 bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0"
                              >
                                Sem chave pessoal
                              </Badge>
                            ) : provider.hasCredential ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/35 bg-emerald-500/10 text-emerald-300 font-mono text-[10px] px-1.5 py-0"
                              >
                                {provider.credentialHint || "Chave ativa"} ({provider.credentialScope || "company"})
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-border/70 bg-muted/40 text-muted-foreground text-[10px] px-1.5 py-0"
                              >
                                Requer API Key
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Padrão: <span className="font-mono text-foreground">{provider.defaultModel || "—"}</span> · Latência média:{" "}
                            <span className="font-mono">
                              {provider.latencyMs != null ? `${provider.latencyMs} ms` : "—"}
                            </span>{" "}
                            · Último teste: {formatDateTime(provider.lastTestedAt)}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProviderTesting}
                        onClick={() =>
                          void handleTestProviderOrModel({
                            providerId: provider.id,
                            modelId: provider.defaultModel || undefined,
                            scope: provider.credentialScope || undefined,
                          })
                        }
                        className="h-8 shrink-0 border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs"
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" weight="fill" />
                        {isProviderTesting ? "Testando..." : "Testar Conexão"}
                      </Button>
                    </div>

                    {/* Models Table */}
                    {provider.models.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">
                        Nenhum modelo descoberto para <span className="font-mono">{provider.id}</span> no momento.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-[11px]">
                              <TableHead>Modelo</TableHead>
                              <TableHead>Status &amp; Tipo</TableHead>
                              <TableHead>Contexto</TableHead>
                              <TableHead>Max Output</TableHead>
                              <TableHead>Custo / 1M Tokens (In / Out)</TableHead>
                              <TableHead>Latência</TableHead>
                              <TableHead>Último Teste</TableHead>
                              <TableHead>Saúde</TableHead>
                              <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {provider.models.map((model) => {
                              const mKey = `${provider.id}:${model.id}:none`;
                              const isModelTesting = testingKey === mKey;
                              return (
                                <TableRow key={`${provider.id}-${model.id}`} className="text-xs">
                                  <TableCell className="font-mono font-medium text-foreground">
                                    <div>{model.id}</div>
                                    {model.lastError && (
                                      <p className="mt-0.5 max-w-[260px] truncate text-[10px] text-amber-400" title={model.lastError}>
                                        {model.lastError}
                                      </p>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {model.active && (
                                        <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] px-1.5 py-0">
                                          Ativo
                                        </Badge>
                                      )}
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] px-1.5 py-0",
                                          model.available
                                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400"
                                            : "border-border/70 bg-muted/50 text-muted-foreground",
                                        )}
                                      >
                                        {model.available ? "Disponível" : "Indisponível"}
                                      </Badge>
                                      <CategoryBadge category={model.category} />
                                      {model.isDefault && (
                                        <Badge
                                          variant="outline"
                                          className="border-primary/40 bg-primary/10 text-primary text-[10px] px-1.5 py-0"
                                        >
                                          Padrão
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-muted-foreground">
                                    {formatTokens(model.contextWindow)}
                                  </TableCell>
                                  <TableCell className="font-mono text-muted-foreground">
                                    {model.maxOutputTokens.toLocaleString("pt-BR")}
                                  </TableCell>
                                  <TableCell className="font-mono text-muted-foreground">
                                    {formatUsdCost(model.inputCostPer1M, model.outputCostPer1M)}
                                  </TableCell>
                                  <TableCell className="font-mono text-muted-foreground">
                                    {model.latencyMs != null ? `${model.latencyMs} ms` : "—"}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {formatDateTime(model.lastTestedAt)}
                                  </TableCell>
                                  <TableCell>
                                    <HealthBadge status={model.healthStatus} />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={isModelTesting}
                                      onClick={() =>
                                        void handleTestProviderOrModel({
                                          providerId: provider.id,
                                          modelId: model.id,
                                          scope: provider.credentialScope || undefined,
                                        })
                                      }
                                      className="h-7 px-2 text-[11px] text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200"
                                    >
                                      {isModelTesting ? "..." : "Testar"}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Central Encrypted API Key Vault */}
        <Card className="glass-card border-border/80">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                  <Key className="h-5 w-5" weight="duotone" />
                </div>
                <div>
                  <CardTitle className="font-display text-lg">
                    Cofre Central de API Keys Criptografadas (Master &amp; Empresa)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Criptografia AES-256-GCM no servidor. Segredos nunca são salvos em localStorage nem retornados em texto puro após o envio.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/35 bg-emerald-500/10 text-emerald-400 gap-1 text-[11px]">
                <Lock className="h-3 w-3" weight="fill" />
                Zero Exposição de Segredo
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Credential Form */}
            <form
              onSubmit={(e) => void handleSaveVaultCredential(e)}
              autoComplete="off"
              className="rounded-xl border border-border/70 bg-background/40 p-4 space-y-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="vault-scope" className="text-xs font-semibold">
                    Escopo da Credencial
                  </Label>
                  <Select
                    value={vaultScope}
                    onValueChange={(value) => {
                      setVaultScope(value as VaultScope);
                      setVaultTestResult(null);
                    }}
                  >
                    <SelectTrigger id="vault-scope" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="master">Master Global (__master__)</SelectItem>
                      <SelectItem value="company">Empresa ({companyId})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="vault-provider" className="text-xs font-semibold">
                    Provedor
                  </Label>
                  <Select
                    value={vaultProviderId}
                    onValueChange={(value) => {
                      setVaultProviderId(value);
                      setVaultDefaultModel("__provider_default__");
                      setVaultTestResult(null);
                    }}
                  >
                    <SelectTrigger id="vault-provider" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(providers.length > 0
                        ? providers
                        : CANONICAL_PROVIDER_ORDER.map((id) => ({ id, name: id.toUpperCase() }))
                      ).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="vault-model" className="text-xs font-semibold">
                    Modelo Padrão (Opcional)
                  </Label>
                  <Select value={vaultDefaultModel} onValueChange={setVaultDefaultModel}>
                    <SelectTrigger id="vault-model" className="h-9 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__provider_default__">
                        Padrão do provedor ({selectedVaultProvider?.defaultModel || "auto"})
                      </SelectItem>
                      {(selectedVaultProvider?.models || []).map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                          {m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="vault-label" className="text-xs font-semibold">
                    Rótulo (Opcional)
                  </Label>
                  <Input
                    id="vault-label"
                    value={vaultLabel}
                    onChange={(e) => setVaultLabel(e.target.value)}
                    placeholder="Ex: Produção Principal"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="vault-api-key" className="text-xs font-semibold">
                    API Key (limpa da memória imediatamente após envio)
                  </Label>
                  <div className="relative flex items-center">
                    <Input
                      id="vault-api-key"
                      type={showVaultKey ? "text" : "password"}
                      value={vaultApiKey}
                      onChange={(e) => setVaultApiKey(e.target.value)}
                      autoComplete="new-password"
                      spellCheck={false}
                      placeholder="Cole a chave secreta aqui (ex: sk-...)"
                      className="h-9 pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowVaultKey((prev) => !prev)}
                      aria-label={showVaultKey ? "Ocultar chave" : "Visualizar chave temporariamente"}
                      className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showVaultKey ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingVault || savingVault}
                    onClick={() => void handleTestVaultKey()}
                    className="h-9 text-xs"
                  >
                    <Globe className="mr-1.5 h-3.5 w-3.5" />
                    {testingVault ? "Testando Chave..." : "Testar Chave"}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingVault || !vaultApiKey.trim()}
                    className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                  >
                    <FloppyDisk className="mr-1.5 h-3.5 w-3.5" />
                    {savingVault ? "Criptografando..." : "Salvar / Rotacionar"}
                  </Button>
                </div>
              </div>

              {vaultTestResult && (
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
                    vaultTestResult.ok
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {vaultTestResult.ok ? (
                      <CheckCircle className="h-4 w-4 shrink-0" weight="fill" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" weight="fill" />
                    )}
                    <span>
                      Teste {vaultTestResult.providerId} ({vaultTestResult.modelId}):{" "}
                      {vaultTestResult.ok
                        ? `Conectado (${vaultTestResult.latencyMs ?? 0} ms)`
                        : vaultTestResult.error || vaultTestResult.healthStatus}
                    </span>
                  </div>
                  <HealthBadge status={vaultTestResult.healthStatus} />
                </div>
              )}
            </form>

            {/* Stored Masked Vault Credentials Table */}
            <div className="rounded-xl border border-border/70 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[11px]">
                      <TableHead>Escopo</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Hint Mascarado</TableHead>
                      <TableHead>Modelo Padrão</TableHead>
                      <TableHead>Saúde</TableHead>
                      <TableHead>Último Uso</TableHead>
                      <TableHead>Latência</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, idx) => (
                        <TableRow key={`cred-skel-${idx}`}>
                          <TableCell colSpan={9}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : credentials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-6 text-center text-xs text-muted-foreground">
                          Nenhuma credencial armazenada no cofre para este contexto.
                        </TableCell>
                      </TableRow>
                    ) : (
                      credentials.map((cred) => {
                        const isRevoked = Boolean(cred.revoked_at) || !cred.enabled;
                        const testRowKey = `${cred.provider_id}:${cred.default_model || "default"}:${cred.id}`;
                        const isRowTesting = testingKey === testRowKey;
                        const isRevoking = revokingId === cred.id;

                        return (
                          <TableRow key={String(cred.id)} className="text-xs">
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-mono text-[10px]",
                                  cred.scope === "master"
                                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                                    : "border-info/40 bg-info/10 text-info",
                                )}
                              >
                                {cred.scope}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {cred.company_id}
                            </TableCell>
                            <TableCell className="font-semibold text-foreground">
                              <div>{cred.provider_id}</div>
                              {cred.label && (
                                <p className="text-[10px] font-normal text-muted-foreground">{cred.label}</p>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-foreground">
                              {cred.key_hint || "••••"}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {cred.default_model || "—"}
                            </TableCell>
                            <TableCell>
                              <HealthBadge status={isRevoked ? "revoked" : cred.health_status} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDateTime(cred.last_used_at)}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {cred.last_latency_ms != null ? `${cred.last_latency_ms} ms` : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isRevoked || isRowTesting}
                                  onClick={() =>
                                    void handleTestProviderOrModel({
                                      providerId: cred.provider_id,
                                      modelId: cred.default_model || undefined,
                                      scope: cred.scope,
                                      credentialId: cred.id,
                                    })
                                  }
                                  className="h-7 px-2 text-[11px]"
                                >
                                  {isRowTesting ? "Testando..." : "Testar Chave"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isRevoked || isRevoking || Boolean(cred.legacy)}
                                  onClick={() => void handleRevokeCredential(cred)}
                                  title={
                                    cred.legacy
                                      ? "Credencial legada somente leitura nesta tabela"
                                      : "Revogar credencial"
                                  }
                                  className="h-7 px-2 text-[11px] border-destructive/40 text-destructive hover:bg-destructive/15"
                                >
                                  <Trash className="mr-1 h-3 w-3" />
                                  {isRevoking ? "Revogando..." : isRevoked ? "Revogada" : "Revogar"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Non-Secret Credential Audit Log */}
        <Card className="glass-card border-border/80">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-emerald-400">
                  <ClockCounterClockwise className="h-5 w-5" weight="duotone" />
                </div>
                <div>
                  <CardTitle className="font-display text-lg">
                    Trilha de Auditoria de Credenciais (Sem Segredos)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Registro imutável de criação, rotação, testes e revogação exibindo apenas hints mascarados.
                  </CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={refreshing || loading}
                onClick={() => void loadControlPlane(false)}
                className="h-8 text-xs"
              >
                <ArrowsClockwise className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
                Atualizar Auditoria
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Ator</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Key Hint Mascarado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <TableRow key={`audit-skel-${idx}`}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                        Nenhum evento de auditoria de credencial registrado ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((entry) => {
                      const detail = parseAuditDetail(entry.detail);
                      const hint = typeof detail.keyHint === "string" ? detail.keyHint : "—";
                      const actionBadge = AUDIT_ACTION_BADGE_MAP[entry.action] || {
                        label: entry.action,
                        className: "border-border/70 bg-muted/50 text-muted-foreground",
                      };

                      return (
                        <TableRow key={String(entry.id)} className="text-xs">
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {formatDateTime(entry.created_at)}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {entry.actor_name || entry.actor_id || "system"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {entry.scope} · {entry.company_id}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono font-semibold text-foreground">
                            {entry.provider_id}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("font-mono text-[10px]", actionBadge.className)}>
                              {actionBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {hint}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
