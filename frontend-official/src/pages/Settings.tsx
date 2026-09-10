import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
  Code,
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
import SettingsView from "@/lovable/pages/SettingsPageView";
import { createSettingsLovableViewModel } from "@/adapters/lovable/settingsAdapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiService, type AIStatusResponse } from "@/services/apiService";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { notify } from "@/services/notifyService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UnderConstruction } from "@/components/layout/UnderConstruction";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// Lazy load admin pages
const QueuePage = React.lazy(() => import("./Queue"));
const MasterNodesPage = React.lazy(() => import("./MasterNodes"));
const MasterAdminsPage = React.lazy(() => import("./MasterAdmins"));
const MasterDeploymentsPage = React.lazy(() => import("./MasterDeployments"));
const MasterVersionsPage = React.lazy(() => import("./MasterVersions"));
const MasterLogsPage = React.lazy(() => import("./MasterLogs"));
const TestsPage = React.lazy(() => import("./Tests"));
const DiagnosticsPage = React.lazy(() => import("@/runtime/diagnostics/Diagnostics"));

const LANGUAGE_STORAGE_KEY = "zapai_language";
const LANGUAGE_OPTIONS = [
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "en-US", label: "English (US)" },
  { id: "es-ES", label: "Español" },
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

export default function Settings() {
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
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === "undefined") return "pt-BR";
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "pt-BR";
  });
  const handleSelectLanguage = (id: string) => {
    setLanguage(id);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, id);
    } catch {}
    notify.success("Idioma atualizado. Algumas áreas aplicam após recarregar.");
  };

  // Profile States
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // API Keys States
  const [apiKeys, setApiKeys] = useState<{ name: string; key: string; status: string }[]>([]);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");

  const { username } = useAdminAuth();

  // Load API Keys from cache
  useEffect(() => {
    try {
      const stored = localStorage.getItem("zapai_api_keys");
      if (stored) {
        setApiKeys(JSON.parse(stored));
      } else {
        const defaults = [
          { name: "Production Key", key: "zf_live_prodkeyexample12345", status: "Ativa" },
          { name: "Test Key", key: "zf_test_testkeyexample12345", status: "Ativa" },
        ];
        localStorage.setItem("zapai_api_keys", JSON.stringify(defaults));
        setApiKeys(defaults);
      }
    } catch (err) {
      console.warn("Failed to load API keys:", err);
    }
  }, []);

  // Load profile from API & cache
  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setIsProfileLoading(true);
      const cacheKey = `user_profile_${username || "default"}`;
      let cached: any = null;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          cached = JSON.parse(raw);
          if (isMounted) {
            setProfileName(cached.name || "");
            setProfileEmail(cached.email || "");
            setProfilePhone(cached.phone || "");
            setProfileRole(cached.role || "");
          }
        }
      } catch (err) {
        console.warn("Failed to load profile from cache:", err);
      }

      try {
        const users = await apiService.getAdminUsers();
        const curUser = users.find((u) => u.username === username);
        if (curUser && isMounted) {
          setUserId(curUser.id);
          setProfileEmail(curUser.email || "");
          setProfileRole(curUser.role || "");
          
          const updatedCache = {
            name: cached?.name || "",
            phone: cached?.phone || "",
            email: curUser.email || "",
            role: curUser.role || "",
          };
          localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
        }
      } catch (err) {
        console.warn("Failed to load profile from API:", err);
      } finally {
        if (isMounted) setIsProfileLoading(false);
      }
    };

    if (username) {
      void loadProfile();
    }
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
    const cacheKey = `user_profile_${username || "default"}`;
    try {
      if (userId !== null) {
        await apiService.updateAdminUser(userId, {
          email: profileEmail,
          role: profileRole,
        });
      }

      const updatedProfile = {
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
        role: profileRole,
      };
      localStorage.setItem(cacheKey, JSON.stringify(updatedProfile));
      notify.success("Configurações do perfil salvas com sucesso.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleGenerateKey = () => {
    const name = newKeyName.trim();
    if (!name) {
      notify.error("Por favor, informe um nome para a chave.");
      return;
    }
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let randomHash = "";
    for (let i = 0; i < 20; i++) {
      randomHash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newKey = `zf_live_${randomHash}`;
    const updatedKeys = [...apiKeys, { name, key: newKey, status: "Ativa" }];
    setApiKeys(updatedKeys);
    localStorage.setItem("zapai_api_keys", JSON.stringify(updatedKeys));
    notify.success(`Chave "${name}" gerada com sucesso.`);
    setIsNewKeyModalOpen(false);
    setNewKeyName("");
  };

  const handleCopyKey = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    notify.success("Chave copiada para a área de transferência.");
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
      <Header title="Configurações" subtitle="Gerencie sua conta e preferências" />

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
              </nav>
            </div>
          }
          content={
            <div className="space-y-6">
              {activeSection === 0 && (
                <>
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="font-display flex items-center gap-2"><Robot className="w-5 h-5" />IA Global</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">IA Ativa</p>
                        <p className="text-sm text-muted-foreground">Controla o motor de IA para automações e respostas.</p>
                      </div>
                      <Button variant="outline" onClick={() => void handleAIToggle()} disabled={isAIToggling || isAIStatusLoading} className="gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", isAIEnabled ? "bg-success" : "bg-muted-foreground/50")} />
                        IA Ativa
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-card">
                    <CardHeader><CardTitle className="font-display">Perfil</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
                        <Avatar className="w-20 h-20 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                          {profileName ? profileName.slice(0, 2).toUpperCase() : "AD"}
                        </AvatarFallback></Avatar>
                        <div><Button variant="outline" size="sm" className="rounded-xl">Alterar foto</Button><p className="mt-2 text-xs text-muted-foreground">JPG, PNG ou GIF. Máx 2MB.</p></div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome completo</Label>
                          <Input id="name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-mail</Label>
                          <Input id="email" type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone</Label>
                          <Input id="phone" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Cargo</Label>
                          <Input id="role" value={profileRole} onChange={(e) => setProfileRole(e.target.value)} />
                        </div>
                      </div>
                      <Button onClick={handleSaveProfile} disabled={isProfileSaving}>
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
                    <Label className="mb-1 block">Idioma da interface</Label>
                    <div className="space-y-2">
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectLanguage(opt.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                            language === opt.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {opt.label}
                          {language === opt.id && <Badge variant="secondary" className="rounded-full">Ativo</Badge>}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Preferência salva neste dispositivo. A tradução completa da interface será expandida gradualmente.
                    </p>
                  </CardContent>
                </Card>
              )}

              {activeSection === 8 && (
                <Card className="glass-card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-display">API Keys</CardTitle>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsNewKeyModalOpen(true)}>
                      <Code className="w-4 h-4" />
                      Gerar Nova Chave
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {apiKeys.map((k, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-muted/40 p-3 border border-border/40">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground">{k.name}</p>
                            <p className="font-mono text-xs text-muted-foreground truncate">{k.key}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="rounded-full text-xs">{k.status}</Badge>
                            <Button variant="ghost" size="sm" className="rounded-lg h-8 text-xs" onClick={() => handleCopyKey(k.key)}>Copiar</Button>
                          </div>
                        </div>
                      ))}
                      {apiKeys.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma chave de API gerada.</p>
                      )}
                    </div>
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

      <Dialog open={isNewKeyModalOpen} onOpenChange={setIsNewKeyModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border/70 bg-card/95">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Gerar Nova Chave de API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="key-name-input" className="text-sm font-medium">Nome da Chave</Label>
              <Input
                id="key-name-input"
                placeholder="Ex: Production, Test, Integração Externa"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setIsNewKeyModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="rounded-xl shadow-glow" onClick={handleGenerateKey}>
                Gerar Chave
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
