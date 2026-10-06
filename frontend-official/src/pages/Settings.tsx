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

// Lazy load admin pages
const QueuePage = React.lazy(() => import("./Queue"));
const MasterNodesPage = React.lazy(() => import("./MasterNodes"));
const MasterAdminsPage = React.lazy(() => import("./MasterAdmins"));
const MasterDeploymentsPage = React.lazy(() => import("./MasterDeployments"));
const MasterVersionsPage = React.lazy(() => import("./MasterVersions"));
const MasterLogsPage = React.lazy(() => import("./MasterLogs"));
const TestsPage = React.lazy(() => import("./Tests"));
const DiagnosticsPage = React.lazy(() => import("@/core/runtime/diagnostics/Diagnostics"));



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
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsViewModel = useMemo(() => createSettingsLovableViewModel(), []);
  const tabParam = searchParams.get("tab") || searchParams.get("section");

  const [activeSection, setActiveSection] = useState<number>(() => {
    if (tabParam) {
      const found = settingsViewModel.sections.findIndex((s) => s.id === tabParam);
      if (found !== -1) return found;
    }
    return 0;
  });

  useEffect(() => {
    if (tabParam) {
      const found = settingsViewModel.sections.findIndex((s) => s.id === tabParam);
      if (found !== -1 && found !== activeSection) {
        setActiveSection(found);
      }
    }
  }, [tabParam, settingsViewModel.sections, activeSection]);

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

  const { username } = useAdminAuth();

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
    11: Queue, 12: HardDrives, 13: Shield, 14: TrendUp, 15: GitCommit, 16: FileText, 17: Flask, 18: Pulse
  }), []);

  const navGroups = useMemo(() => [
    {
      title: "Geral",
      indices: [0, 1, 2, 3, 4, 5],
    },
    {
      title: "Preferências & Chaves",
      indices: [6, 7, 8, 9, 10],
    },
    {
      title: "Sistema & Operações",
      indices: [11, 12, 13, 14, 15, 16, 17, 18],
    },
  ], []);

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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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
                      { label: "Inbox Cockpit", path: "/inbox" },
                      { label: "Campanhas & Disparos", path: "/campaigns" },
                      { label: "Estúdio IA & Agentes", path: "/ai" },
                      { label: "Memória Neural", path: "/memory" },
                      { label: "Central de Operações", path: "/operations" },
                    ].map((mod) => (
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
                        A logo e as cores se ajustam automaticamente ao tema escolhido.
                      </p>
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

              {activeSection >= 11 && activeSection <= 18 && (
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
                    </div>
                  </React.Suspense>
                </Card>
              )}

              {![0, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18].includes(activeSection) && (
                <Card className="glass-card">
                  <UnderConstruction
                    title={settingsViewModel.sections[activeSection]?.label || "Módulo em Desenvolvimento"}
                    description={`A seção de configurações "${settingsViewModel.sections[activeSection]?.label || "Configurações"}" está em fase de construção pela nossa equipe de engenharia e estará disponível em breve no ambiente SaaS.`}
                  />
                </Card>
              )}
            </div>
          }
        />
      </motion.div>


    </div>
  );
}
