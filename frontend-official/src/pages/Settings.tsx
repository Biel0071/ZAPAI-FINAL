import { useEffect, useState } from "react";
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
  const [activeSection, setActiveSection] = useState(0);
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

  const settingsViewModel = createSettingsLovableViewModel();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header title="Configurações" subtitle="Gerencie sua conta e preferências" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <SettingsView
          navigation={
            <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
              {settingsViewModel.sections.map((item, index) => {
                const iconMap = [User, Buildings, Users, Bell, Shield, CreditCard, Palette, Globe, Key, Link, Database];
                const Icon = iconMap[index] ?? User;
                const active = activeSection === index;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(index)}
                    className={cn("flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
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
                      <div className="flex items-center gap-6">
                        <Avatar className="w-20 h-20"><AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                          {profileName ? profileName.slice(0, 2).toUpperCase() : "AD"}
                        </AvatarFallback></Avatar>
                        <div><Button variant="outline" size="sm">Alterar foto</Button><p className="mt-2 text-xs text-muted-foreground">JPG, PNG ou GIF. Máx 2MB.</p></div>
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
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                          <div>
                            <p className="font-medium text-sm">{k.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{k.key}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{k.status}</Badge>
                            <Button variant="ghost" size="sm" onClick={() => handleCopyKey(k.key)}>Copiar</Button>
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

              {activeSection !== 0 && activeSection !== 6 && activeSection !== 7 && activeSection !== 8 && (
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
