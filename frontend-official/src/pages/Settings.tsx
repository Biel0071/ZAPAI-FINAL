import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Buildings,
  Bell,
  Shield,
  CreditCard,
  Users,
  Palette,
  Globe,
  Key,
  Database,
  Link,
  Robot,
  Queue,
  HardDrives,
  TrendUp,
  GitCommit,
  FileText,
  Flask,
  Pulse,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import SettingsView from "@/pages/lovable/pages/SettingsPageView";
import { createSettingsLovableViewModel } from "@/core/adapters/lovable/settingsAdapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiService, type AIStatusResponse } from "@/core/services/apiService";
import { useAdminAuth } from "@/state/hooks/useAdminAuth";
import { notify } from "@/core/services/notifyService";
import { UnderConstruction } from "@/components/layout/UnderConstruction";
import { useTheme } from "next-themes";
import { cn } from "@/core/lib/utils";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ZAI_OPEN_EVENT } from "@/components/ai/ZaibotFloatingAssistant";
import {
  fetchZaiAssistantConfigFromApi,
  getZaiAssistantConfig,
  saveZaiAssistantConfigToApi,
  ZAI_PERSONALITY_TONES,
  type ZaiAssistantConfig,
} from "@/core/services/zaiAssistantConfigService";

// Lazy load admin pages
const QueuePage = React.lazy(() => import("./Queue"));
const MasterNodesPage = React.lazy(() => import("./MasterNodes"));
const MasterAdminsPage = React.lazy(() => import("./MasterAdmins"));
const MasterDeploymentsPage = React.lazy(() => import("./MasterDeployments"));
const MasterVersionsPage = React.lazy(() => import("./MasterVersions"));
const MasterLogsPage = React.lazy(() => import("./MasterLogs"));
const TestsPage = React.lazy(() => import("./Tests"));
const DiagnosticsPage = React.lazy(() => import("@/core/runtime/diagnostics/Diagnostics"));
const MasterCompaniesPage = React.lazy(() => import("./MasterCompanies"));
const CompanyTeamPage = React.lazy(() => import("./CompanyTeam"));



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

export default function Settings() {
  const navigate = useNavigate();
  const { username, role, session } = useAdminAuth();
  const canOpenPlatformHub = role === "master";
  const [selectedCompanyContext, setSelectedCompanyContext] = useState(() => {
    try { return window.localStorage.getItem("zai_admin_company_context") || ""; } catch { return ""; }
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsViewModel = useMemo(() => createSettingsLovableViewModel(), []);
  const tabParam = searchParams.get("tab") || searchParams.get("section");

  const isMasterIndex = (idx: number) => idx >= 8 && idx <= 19;
  const isCompanyAdminSection = (idx: number) => [1, 2, 5].includes(idx);
  const canViewUserSection = (idx: number) => !isCompanyAdminSection(idx) || canOpenPlatformHub || role === "admin";

  const [activeSection, setActiveSection] = useState<number>(() => {
    if (tabParam) {
      const found = settingsViewModel.sections.findIndex((s) => s.id === tabParam);
      if (found !== -1 && (canOpenPlatformHub || !isMasterIndex(found)) && canViewUserSection(found)) return found;
    }
    return 0;
  });

  const [settingsMode, setSettingsMode] = useState<"user" | "master">(() => {
    if (tabParam) {
      const found = settingsViewModel.sections.findIndex((s) => s.id === tabParam);
      if (canOpenPlatformHub && found !== -1 && isMasterIndex(found)) return "master";
    }
    return "user";
  });

  useEffect(() => {
    if (tabParam) {
      const found = settingsViewModel.sections.findIndex((s) => s.id === tabParam);
      if (found !== -1) {
        if (!canOpenPlatformHub && isMasterIndex(found)) {
          setActiveSection(0);
          setSettingsMode("user");
          setSearchParams({ tab: settingsViewModel.sections[0]?.id || "perfil" }, { replace: true });
          return;
        }
        if (!canViewUserSection(found)) {
          setActiveSection(0);
          setSearchParams({ tab: settingsViewModel.sections[0]?.id || "perfil" }, { replace: true });
          return;
        }
        if (found !== activeSection) setActiveSection(found);
        setSettingsMode(canOpenPlatformHub && isMasterIndex(found) ? "master" : "user");
      }
    }
  }, [tabParam, settingsViewModel.sections, activeSection, canOpenPlatformHub, canViewUserSection, setSearchParams]);

  const handleSectionChange = (index: number) => {
    setActiveSection(index);
    const item = settingsViewModel.sections[index];
    if (item) {
      setSearchParams({ tab: item.id });
    }
  };

  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [isAIStatusLoading, setIsAIStatusLoading] = useState(true);
  const [isAIToggling, setIsAIToggling] = useState(false);

  // Appearance (theme) + language preferences
  const { theme, setTheme } = useTheme();
  // Profile States
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [companyEntitlements, setCompanyEntitlements] = useState<Awaited<ReturnType<typeof apiService.getCompanyEntitlements>> | null>(null);
  const [companyLoadError, setCompanyLoadError] = useState<string | null>(null);
  const [companyUnlinked, setCompanyUnlinked] = useState(false);
  const [companyNameInput, setCompanyNameInput] = useState("");
  const [companyResponsibleInput, setCompanyResponsibleInput] = useState("");
  const [companyContextApplied, setCompanyContextApplied] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [licenseToken, setLicenseToken] = useState("");
  const [isRedeemingLicense, setIsRedeemingLicense] = useState(false);
  const companyContextHeaders = canOpenPlatformHub && selectedCompanyContext ? { "x-admin-company-context": selectedCompanyContext } : undefined;

  useEffect(() => {
    let mounted = true;
    const contextHeaders = canOpenPlatformHub && selectedCompanyContext ? { "x-admin-company-context": selectedCompanyContext } : undefined;
    void apiService.getCompanyEntitlements(contextHeaders).then((value) => {
      if (mounted) { setCompanyEntitlements(value); setCompanyNameInput(value.company.name); setCompanyResponsibleInput(value.company.responsible_name || ""); setCompanyUnlinked(false); setCompanyLoadError(null); setCompanyContextApplied(true); }
    }).catch((error) => {
      if (!mounted) return;
      const message = error instanceof Error ? error.message : "";
      if (/404|empresa não encontrada/i.test(message)) { setCompanyUnlinked(true); setCompanyContextApplied(true); }
      else setCompanyLoadError(/403|empresa/i.test(message) ? "A empresa selecionada não existe ou não está disponível." : "Não foi possível carregar empresa e licença.");
    });
    return () => { mounted = false; };
  }, [canOpenPlatformHub, selectedCompanyContext]);

  const handleRedeemLicense = async () => {
    if (isRedeemingLicense || !licenseToken.trim()) return;
    setIsRedeemingLicense(true);
    try {
      await apiService.redeemCompanyLicense(licenseToken.trim(), companyContextHeaders);
      setLicenseToken("");
      setCompanyEntitlements(await apiService.getCompanyEntitlements(companyContextHeaders));
      notify.success("Licença resgatada para esta empresa.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Não foi possível resgatar a licença.");
    } finally { setIsRedeemingLicense(false); }
  };

  const handleSaveCompanyProfile = async () => {
    if (isSavingCompany) return;
    setIsSavingCompany(true);
    try {
      await apiService.updateCompanyProfile({ name: companyNameInput, responsibleName: companyResponsibleInput }, companyContextHeaders);
      setCompanyEntitlements(await apiService.getCompanyEntitlements(companyContextHeaders));
      notify.success("Dados da empresa salvos.");
    } catch (error) { notify.error(error instanceof Error ? error.message : "Não foi possível salvar a empresa."); }
    finally { setIsSavingCompany(false); }
  };

  // Only backend-supported account fields can be saved.
  useEffect(() => {
    let isMounted = true;
    setUserId(null); setProfileEmail(''); setProfileRole(''); setProfileError(null);
    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
        const users = await apiService.getAdminUsers();
        const user = users.find(item => item.username === username);
        if (isMounted && user) { setUserId(user.id); setProfileEmail(user.email || ''); setProfileRole(user.role || ''); }
        else if (isMounted) setProfileError('O perfil não está disponível para edição nesta conta.');
      } catch {
        if (isMounted) setProfileError('Não foi possível carregar o perfil.');
      } finally {
        if (isMounted) setIsProfileLoading(false);
      }
    };
    if (username) void loadProfile(); else setIsProfileLoading(false);
    return () => { isMounted = false; };
  }, [username]);

  // Load AI Global status
  useEffect(() => {
    let isMounted = true;

    const loadStatus = async () => {
      try {
        const status = await apiService.getAIStatus();
        if (isMounted) setIsAIEnabled(resolveAIEnabled(status));
      } catch (error) {
        console.error("Erro ao carregar status da IA:", error);
      } finally {
        if (isMounted) setIsAIStatusLoading(false);
      }
    };

    void loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAIToggle = async () => {
    if (isAIToggling || isAIStatusLoading) return;

    setIsAIToggling(true);
    try {
      if (isAIEnabled) {
        await apiService.disableAI();
        setIsAIEnabled(false);
      } else {
        await apiService.enableAI();
        setIsAIEnabled(true);
      }
    } catch (error) {
      console.error("Erro ao alternar IA:", error);
    } finally {
      setIsAIToggling(false);
    }
  };

  // ZAI System Assistant Configuration State (disabled by default at the moment)
  const [zaiConfig, setZaiConfig] = useState<ZaiAssistantConfig>(() => getZaiAssistantConfig());
  const [isSavingZaiConfig, setIsSavingZaiConfig] = useState(false);

  useEffect(() => {
    let mounted = true;
    void fetchZaiAssistantConfigFromApi().then((cfg) => {
      if (mounted) setZaiConfig(cfg);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleZaiAssistant = async (checked: boolean) => {
    try {
      const updated = await saveZaiAssistantConfigToApi({ ...zaiConfig, enabled: checked });
      setZaiConfig(updated);
      notify.success(checked ? "Painel lateral do ZAI ativado." : "Painel lateral do ZAI desativado.");
    } catch {
      notify.error("Não foi possível salvar a ativação do painel ZAI.");
    }
  };

  const handleSaveZaiConfig = async () => {
    if (isSavingZaiConfig) return;
    setIsSavingZaiConfig(true);
    try {
      const saved = await saveZaiAssistantConfigToApi(zaiConfig);
      setZaiConfig(saved);
      notify.success("Configurações do Assistente ZAI (Sistema) salvas com sucesso.");
    } catch {
      notify.error("Erro ao salvar configurações do Assistente ZAI.");
    } finally {
      setIsSavingZaiConfig(false);
    }
  };

  const renderZaiSystemAssistantCard = () => (
    <Card className="glass-card border-emerald-500/25" data-testid="zai-system-assistant-settings-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-1 overflow-hidden">
              <img
                src="/assets/mascot/zaibot_avatar.png"
                alt="Mascote ZAI"
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="font-display text-base">
                  Assistente ZAI (Apenas Assistente do Sistema)
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold",
                    zaiConfig.enabled && zaiConfig.globallyEnabled !== false
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                  )}
                >
                  {zaiConfig.globallyEnabled === false ? "BLOQUEADO PELO ADMIN" : zaiConfig.enabled ? "PAINEL ATIVO" : "PAINEL DESATIVADO"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                O ZAI atua exclusivamente como copiloto interno do sistema. O atendimento de clientes da loja no WhatsApp é feito pela atendente <strong>Camila</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 rounded-xl border border-border/70 bg-background/60 px-3.5 py-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-2 text-xs"
              disabled={!zaiConfig.enabled || zaiConfig.globallyEnabled === false}
              onClick={() => window.dispatchEvent(new Event(ZAI_OPEN_EVENT))}
            >
              Abrir copiloto
            </Button>
            <div className="text-right">
              <p className="text-xs font-bold text-foreground">
                {zaiConfig.globallyEnabled === false ? "Indisponível pelo administrador" : zaiConfig.enabled ? "Painel lateral ativo" : "Painel lateral inativo"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Análise do WhatsApp independe deste painel
              </p>
            </div>
            <Switch
              data-testid="toggle-zai-system-assistant"
              aria-label="Ativar painel lateral do Assistente ZAI"
              checked={Boolean(zaiConfig.enabled)}
              disabled={zaiConfig.globallyEnabled === false}
              onCheckedChange={(checked) => void handleToggleZaiAssistant(checked)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-2">
        <div className="space-y-3 pt-3 border-t border-border/50">
          <Label className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
            Ajustes de personalidade do Assistente ZAI
          </Label>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {ZAI_PERSONALITY_TONES.map((tone) => {
              const selected = zaiConfig.personality.tone === tone.id;
              return (
                <button
                  key={tone.id}
                  type="button"
                  data-testid={`select-zai-tone-${tone.id}`}
                  onClick={() =>
                    setZaiConfig((prev) => ({
                      ...prev,
                      personality: { ...prev.personality, tone: tone.id },
                    }))
                  }
                  className={cn(
                    "flex flex-col items-start text-left rounded-xl border p-3 transition-colors",
                    selected
                      ? "border-emerald-500 bg-emerald-500/12 text-foreground"
                      : "border-border/70 bg-card/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-foreground">{tone.label}</span>
                    {selected && (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/15 text-[9px] text-emerald-400">
                        Selecionado
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{tone.description}</p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Objetividade</span>
                <span className="font-mono font-bold text-emerald-400">{zaiConfig.personality.objectivity}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                aria-label="Objetividade do Assistente ZAI"
                value={zaiConfig.personality.objectivity}
                onChange={(e) =>
                  setZaiConfig((prev) => ({
                    ...prev,
                    personality: { ...prev.personality, objectivity: Number(e.target.value) },
                  }))
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Proatividade</span>
                <span className="font-mono font-bold text-emerald-400">{zaiConfig.personality.proactivity}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                aria-label="Proatividade do Assistente ZAI"
                value={zaiConfig.personality.proactivity}
                onChange={(e) =>
                  setZaiConfig((prev) => ({
                    ...prev,
                    personality: { ...prev.personality, proactivity: Number(e.target.value) },
                  }))
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Formalidade</span>
                <span className="font-mono font-bold text-emerald-400">{zaiConfig.personality.formality}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                aria-label="Formalidade do Assistente ZAI"
                value={zaiConfig.personality.formality}
                onChange={(e) =>
                  setZaiConfig((prev) => ({
                    ...prev,
                    personality: { ...prev.personality, formality: Number(e.target.value) },
                  }))
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="zai-greeting-input" className="text-xs">
              Mensagem de Saudação do Assistente do Sistema
            </Label>
            <Input
              id="zai-greeting-input"
              value={zaiConfig.personality.greetingMessage}
              onChange={(e) =>
                setZaiConfig((prev) => ({
                  ...prev,
                  personality: { ...prev.personality, greetingMessage: e.target.value },
                }))
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <p className="text-[11px] text-muted-foreground">
            Estado do painel:{" "}
            <strong className={zaiConfig.enabled && zaiConfig.globallyEnabled !== false ? "text-emerald-400" : "text-amber-300"}>
              {zaiConfig.globallyEnabled === false ? "Bloqueado pelo administrador" : zaiConfig.enabled ? "Ativado" : "Desativado; análise segue ativa"}
            </strong>
          </p>
          <Button
            type="button"
            data-testid="save-zai-assistant-config-btn"
            onClick={() => void handleSaveZaiConfig()}
            disabled={isSavingZaiConfig}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isSavingZaiConfig ? "Salvando..." : "Salvar Configuração do ZAI"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const handleSaveProfile = async () => {
    if (isProfileSaving) return;
    setIsProfileSaving(true);
    try {
      if (userId === null) throw new Error('Carregue o perfil antes de salvar.');
      const saved = await apiService.updateAdminUser(userId, { email: profileEmail });
      if (!saved) throw new Error('O servidor não confirmou a atualização do perfil.');
      notify.success('E-mail do perfil atualizado.');
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const iconMap: Record<number, any> = useMemo(() => ({
    0: User, 1: Buildings, 2: Users, 3: Bell, 4: Shield, 5: CreditCard,
    6: Palette, 7: Globe, 8: Key, 9: Link, 10: Database,
    11: Queue, 12: HardDrives, 13: Shield, 14: TrendUp, 15: GitCommit, 16: FileText, 17: Flask, 18: Pulse, 19: Buildings, 20: Robot,
  }), []);

  const userNavGroups = useMemo(() => [
    {
      title: "Conta e Acesso",
      indices: [0, 3, 4], // Perfil, Notificações, Segurança
    },
    {
      title: "Minha Empresa & Loja",
      indices: [1, 2, 5].filter((index) => canViewUserSection(index)), // Empresa, Equipe, Faturamento
    },
    { title: "Personalização", indices: [6, 7] },
    { title: "Inteligência Artificial", indices: [20] },
  ], [canViewUserSection]);

  const masterNavGroups = useMemo(() => [
    {
      title: "Cluster & Mensageria",
      indices: [12, 11, 14, 15], // Cluster Nodes, Fila de Envios, Deployments, Versões
    },
    {
      title: "Auditoria & Acessos",
      indices: [16, 13], // Logs, Usuários Master
    },
    {
      title: "Integrações & Dados",
      indices: [8, 9, 10], // API Keys, Webhooks, Dados
    },
    {
      title: "Diagnóstico & IA Sistema",
      indices: [18, 17], // Diagnósticos, Central de Testes
    },
    { title: "Empresas e Licenças", indices: [19] },
  ], []);

  const navGroups = settingsMode === "master" ? masterNavGroups : companyUnlinked && !canOpenPlatformHub ? [] : userNavGroups;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header
        title="Configurações"
        subtitle="Gerencie sua conta, preferências e motor de IA"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleAIToggle()}
            disabled={isAIToggling || isAIStatusLoading}
            className="h-8 gap-2 rounded-xl text-xs border-border/70 hover:bg-card/80"
            title="Alternar motor global de IA para automações e respostas"
          >
            <Robot className="h-3.5 w-3.5 text-primary" />
            <span className={cn("h-2 w-2 rounded-full", isAIEnabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50")} />
            <span className="font-semibold">{isAIEnabled ? "IA Ativa" : "IA Pausada"}</span>
          </Button>
        }
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Hub switch is visible only to platform masters. */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-sm">
          <div className={cn("grid gap-1.5 w-full sm:w-auto", canOpenPlatformHub ? "grid-cols-2" : "grid-cols-1")}>
            <button
              type="button"
              onClick={() => {
                setSettingsMode("user");
                if (isMasterIndex(activeSection)) {
                  handleSectionChange(0);
                }
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
                settingsMode === "user"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <User className="w-3.5 h-3.5" weight={settingsMode === "user" ? "fill" : "regular"} />
              <span>{settingsMode === "user" && canOpenPlatformHub ? `Conta da Empresa · ${selectedCompanyContext || session?.tenantId || "selecione"}` : "Conta & Loja"}</span>
            </button>

            {canOpenPlatformHub && <button
              type="button"
              onClick={() => {
                try { window.localStorage.removeItem("zai_admin_company_context"); } catch { /* ignore unavailable storage */ }
                setSelectedCompanyContext("");
                setSettingsMode("master");
                handleSectionChange(19);
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
                settingsMode === "master"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Shield className="w-3.5 h-3.5" weight={settingsMode === "master" ? "fill" : "regular"} />
              <span>🛡️ Painel Master Enterprise</span>
            </button>}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground pr-3 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10.5px]">ZAI Enterprise OS v2.6.4</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border/70 text-muted-foreground">
              {settingsMode === "user" ? "Operador Comercial" : "Cluster & DevOps"}
            </Badge>
          </div>
        </div>
        <SettingsView
          navigation={
            <div className="w-full">
              {/* Mobile Navigation (< lg): Dropdown selector + category pills */}
              <div className="lg:hidden space-y-3 w-full pb-2">
                <div className="relative w-full">
                  <select
                    value={activeSection}
                    onChange={(e) => handleSectionChange(Number(e.target.value))}
                    className="w-full h-11 rounded-xl border border-border/80 bg-card/90 px-3.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  >
                    {navGroups.map((group) => (
                      <optgroup key={group.title} label={group.title} className="bg-popover text-foreground font-bold">
                        {group.indices.map((idx) => {
                          const item = settingsViewModel.sections[idx];
                          return item ? (
                            <option key={item.id} value={idx} className="bg-card text-foreground font-medium py-1">
                              {item.label}
                            </option>
                          ) : null;
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Quick Category Jump Pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {navGroups.map((group) => {
                    const isCurrentGroup = group.indices.includes(activeSection);
                    return (
                      <button
                        key={group.title}
                        type="button"
                        onClick={() => handleSectionChange(group.indices[0])}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors border",
                          isCurrentGroup
                            ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                            : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {group.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Desktop Navigation (>= lg): Clean Grouped Sidebar with Sticky Positioning */}
              <nav className="hidden lg:flex flex-col gap-5 sticky top-4">
                {navGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      {group.title}
                    </p>
                    <div className="space-y-0.5">
                      {group.indices.map((index) => {
                        const item = settingsViewModel.sections[index];
                        if (!item) return null;
                        const Icon = iconMap[index] ?? User;
                        const active = activeSection === index;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSectionChange(index)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all select-none text-left",
                              active
                                ? "bg-primary/15 text-primary shadow-sm font-bold"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                          >
                            <Icon className="w-4 h-4 shrink-0" weight={active ? "duotone" : "regular"} />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Quick Operational Hub Links */}
                <div className="pt-2 border-t border-border/40 space-y-1">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    Módulos do Sistema
                  </p>
                  <div className="space-y-0.5">
                    {[
                      { label: "WhatsApp Conexões", path: "/connections" },
                      { label: "Inbox Cockpit", path: "/inbox", module: "inbox" },
                      { label: "Campanhas & Disparos", path: "/campaigns", module: "campaigns" },
                      { label: "Estúdio IA & Agentes", path: "/ai" },
                      { label: "Memória Neural", path: "/memory" },
                      { label: "Central de Operações", path: "/operations" },
                    ].filter((mod) => settingsMode === "master" || !mod.module || companyEntitlements?.legacyAccess || companyEntitlements?.modules.includes(mod.module)).map((mod) => (
                      <button
                        key={mod.path}
                        type="button"
                        onClick={() => navigate(mod.path)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors text-left"
                      >
                        <span className="truncate">{mod.label}</span>
                        <span className="text-[10px] text-muted-foreground/50">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              </nav>
            </div>
          }
          content={
            companyUnlinked && !canOpenPlatformHub ? (
              <Card className="glass-card"><CardHeader><CardTitle>Conta sem empresa vinculada</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>Peça ao administrador master um link de cadastro ou conclua a solicitação enviada. O acesso será liberado após aprovação.</p><p>Solicitações de cadastro não enviam e-mail automaticamente.</p></CardContent></Card>
            ) : (
            <div className="space-y-6">
              {activeSection === 0 && (
                <>
                  <Card className="glass-card">
                    <CardHeader><CardTitle className="font-display">Perfil</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
                        <Avatar className="w-20 h-20 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                          {username ? username.slice(0, 2).toUpperCase() : "—"}
                        </AvatarFallback></Avatar>

                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">Usuário</Label>
                          <Input id="name" value={username || ""} readOnly />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-mail</Label>
                          <Input id="email" type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="role">Permissão da conta</Label>
                          <Input id="role" value={profileRole} readOnly />
                        </div>
                      </div>
                      {profileError && <p role="alert" className="text-sm text-amber-400">{profileError}</p>}
                      <Button onClick={handleSaveProfile} disabled={isProfileSaving || isProfileLoading || userId === null}>
                        {isProfileSaving ? "Salvando..." : "Salvar Alterações"}
                      </Button>
                    </CardContent>
                  </Card>

                </>
              )}

              {activeSection === 20 && renderZaiSystemAssistantCard()}

              {activeSection === 1 && (
                <Card className="glass-card">
                  <CardHeader><CardTitle className="font-display">Dados da empresa</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {companyLoadError ? <p role="alert" className="text-sm text-amber-400">{companyLoadError}</p> : companyEntitlements ? <>
                      <div className="space-y-1.5"><Label htmlFor="company-name">Empresa</Label><Input id="company-name" value={companyNameInput} onChange={(event) => setCompanyNameInput(event.target.value)} readOnly={role === "user"} /></div>
                      <div className="space-y-1.5"><Label htmlFor="company-responsible">Responsável</Label><Input id="company-responsible" value={companyResponsibleInput} onChange={(event) => setCompanyResponsibleInput(event.target.value)} readOnly={role === "user"} /></div>
                      <div><p className="text-xs text-muted-foreground">Identificador mantido</p><p className="font-mono text-xs">{companyEntitlements.company.id}</p></div>
                      {(role === "admin" || (canOpenPlatformHub && Boolean(selectedCompanyContext))) && <Button onClick={() => void handleSaveCompanyProfile()} disabled={isSavingCompany || !companyNameInput.trim() || !companyContextApplied}>{isSavingCompany ? "Salvando…" : "Salvar dados da empresa"}</Button>}
                    </> : <p role="status" className="text-sm text-muted-foreground">Carregando dados da empresa…</p>}
                    {!companyEntitlements && !companyLoadError && <p className="text-sm text-muted-foreground">Sem empresa vinculada. Solicite um link de cadastro ao administrador ou conclua o cadastro aprovado.</p>}
                  </CardContent>
                </Card>
              )}

      {activeSection === 2 && <React.Suspense fallback={<div role="status" className="p-8 text-center text-sm text-muted-foreground">Carregando equipe…</div>}><CompanyTeamPage adminHeaders={companyContextHeaders} /></React.Suspense>}

              {activeSection === 5 && (
                <Card className="glass-card">
                  <CardHeader><CardTitle className="font-display">Plano e licença</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {companyEntitlements?.legacyAccess ? <p className="text-sm text-muted-foreground">Acesso legado mantido enquanto um pacote não for atribuído.</p> : companyEntitlements?.license ? <div className="space-y-1 text-sm"><p>Plano: <strong>{companyEntitlements.license.plan}</strong></p><p>Módulos: {companyEntitlements.modules.join(", ") || "nenhum"}</p><p>Números WhatsApp: {companyEntitlements.numberLimit ?? 0}</p><p>Validade: {companyEntitlements.license.expires_at ? new Date(companyEntitlements.license.expires_at).toLocaleDateString() : "sem vencimento"}</p></div> : <p className="text-sm text-muted-foreground">Nenhuma licença ativa vinculada a esta empresa.</p>}
                    {(role === "admin" || (canOpenPlatformHub && Boolean(selectedCompanyContext))) && <div className="flex flex-col gap-2 sm:flex-row"><Input value={licenseToken} onChange={(event) => setLicenseToken(event.target.value)} placeholder="Token da licença" aria-label="Token da licença" /><Button disabled={!licenseToken.trim() || isRedeemingLicense} onClick={() => void handleRedeemLicense()}>{isRedeemingLicense ? "Validando…" : "Resgatar licença"}</Button></div>}
                  </CardContent>
                </Card>
              )}

              {activeSection === 6 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="font-display">Aparência</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Tema</Label>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {[
                          { id: "dark", label: "Escuro" },
                          { id: "light", label: "Claro" },
                          { id: "system", label: "Sistema" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTheme(opt.id)}
                            className={cn(
                              "rounded-xl border p-4 text-sm font-medium transition-colors",
                              theme === opt.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        A logo oficial em SVG vetorial e as cores se ajustam automaticamente ao tema escolhido.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/60">
                      <Label className="mb-3 block text-xs uppercase tracking-wider text-muted-foreground">
                        Identidade Visual ZAI — Variantes Vetoriais (SVG)
                      </Label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex items-center gap-3.5 rounded-xl border border-emerald-500/25 bg-[#090d14] p-3.5 text-white shadow-sm">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-1.5">
                            <BrandLogo size={44} variant="dark" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">Tema Escuro</span>
                              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-400">
                                Z Branco
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-400">
                              SVG vetorial com letra Z branca e circuito verde neon.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-[#f8fafc] p-3.5 text-slate-900 shadow-sm">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-600/25 bg-emerald-500/10 p-1.5">
                            <BrandLogo size={44} variant="light" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">Tema Claro</span>
                              <Badge variant="outline" className="border-emerald-600/30 bg-emerald-500/10 text-[10px] text-emerald-700">
                                Z Carbono
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-600">
                              SVG vetorial com letra Z preta carbono (#0F1412) e circuito verde.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeSection === 7 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="font-display">Idioma</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">Português (Brasil)</p>
                    <p className="text-xs text-muted-foreground">Este é o idioma disponível na interface.</p>
                  </CardContent>
                </Card>
              )}

              {activeSection === 8 && (
                <Card className="glass-card">
                  <CardHeader><CardTitle className="font-display">Integrações de API</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">A emissão de chaves de acesso para integrações externas não está disponível neste sistema.</p>
                    <Button variant="outline" onClick={() => navigate('/ai')}>Configurar provedor de IA</Button>
                  </CardContent>
                </Card>
              )}

              {activeSection >= 11 && activeSection <= 19 && (
                <Card className="glass-card overflow-hidden w-full max-w-full min-w-0">
                  <React.Suspense fallback={<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">Carregando painel...</div>}>
                    <style>{`
                      .admin-hub-content-wrapper header,
                      .admin-hub-content-wrapper .sticky.top-0 {
                        display: none !important;
                      }
                      .admin-hub-content-wrapper > div {
                        height: auto !important;
                        min-height: 500px;
                        max-width: 100% !important;
                      }
                    `}</style>
                    <div className="admin-hub-content-wrapper w-full max-w-full overflow-x-auto min-w-0 scrollbar-thin">
                      {activeSection === 11 && <QueuePage />}
                      {activeSection === 12 && <MasterNodesPage />}
                      {activeSection === 13 && <MasterAdminsPage />}
                      {activeSection === 14 && <MasterDeploymentsPage />}
                      {activeSection === 15 && <MasterVersionsPage />}
                      {activeSection === 16 && <MasterLogsPage />}
                      {activeSection === 17 && <TestsPage />}
                      {activeSection === 18 && <DiagnosticsPage />}
                      {activeSection === 19 && <MasterCompaniesPage />}
                    </div>
                  </React.Suspense>
                </Card>
              )}

              {![0, 1, 2, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].includes(activeSection) && (
                <Card className="glass-card">
                  <UnderConstruction
                    title={settingsViewModel.sections[activeSection]?.label || "Módulo em Desenvolvimento"}
                    description={`A seção de configurações "${settingsViewModel.sections[activeSection]?.label || "Configurações"}" está em fase de construção pela nossa equipe de engenharia e estará disponível em breve no ambiente SaaS.`}
                  />
                </Card>
              )}
            </div>
            )
          }
        />
      </motion.div>


    </div>
  );
}
