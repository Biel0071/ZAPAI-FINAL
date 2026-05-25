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
import { cn } from "@/lib/utils";

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
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [isAIStatusLoading, setIsAIStatusLoading] = useState(true);
  const [isAIToggling, setIsAIToggling] = useState(false);

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
                const active = index === 0;
                return (
                  <button key={item.id} className={cn("flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          }
          content={
            <div className="space-y-6">
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
                    <Avatar className="w-20 h-20"><AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">AD</AvatarFallback></Avatar>
                    <div><Button variant="outline" size="sm">Alterar foto</Button><p className="mt-2 text-xs text-muted-foreground">JPG, PNG ou GIF. Máx 2MB.</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="name">Nome completo</Label><Input id="name" defaultValue="Admin User" /></div>
                    <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" defaultValue="admin@empresa.com" /></div>
                    <div className="space-y-2"><Label htmlFor="phone">Telefone</Label><Input id="phone" defaultValue="+55 11 99999-0000" /></div>
                    <div className="space-y-2"><Label htmlFor="role">Cargo</Label><Input id="role" defaultValue="Administrador" /></div>
                  </div>
                  <Button>Salvar Alterações</Button>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="font-display">API Keys</CardTitle><Button variant="outline" size="sm" className="gap-2"><Code className="w-4 h-4" />Gerar Nova Chave</Button></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3"><div><p className="font-medium text-sm">Production Key</p><p className="font-mono text-xs text-muted-foreground">zf_live_xxxxxxxxxxxxxxxxxxxx</p></div><div className="flex items-center gap-2"><Badge variant="secondary">Ativa</Badge><Button variant="ghost" size="sm">Copiar</Button></div></div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3"><div><p className="font-medium text-sm">Test Key</p><p className="font-mono text-xs text-muted-foreground">zf_test_xxxxxxxxxxxxxxxxxxxx</p></div><div className="flex items-center gap-2"><Badge variant="secondary">Ativa</Badge><Button variant="ghost" size="sm">Copiar</Button></div></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          }
        />
      </motion.div>
    </div>
  );
}
