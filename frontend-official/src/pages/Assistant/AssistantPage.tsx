import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Robot,
  Sparkle,
  Storefront,
  Headset,
  WhatsappLogo,
  ShieldCheck,
  Lightning,
  TrendUp,
  ArrowsLeftRight,
  Plus,
} from "@phosphor-icons/react";
import { ZaiPlatformAssistantView } from "@/components/ai/ZaiPlatformAssistantView";
import { NewAgentWizardModal } from "@/components/ai/NewAgentWizardModal";
import { useNavigate } from "react-router-dom";

export default function AssistantPage() {
  const navigate = useNavigate();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardDefaultRole, setWizardDefaultRole] = useState<string>("Vendas");

  const handleOpenWizard = (defaultRole?: string) => {
    setWizardDefaultRole(defaultRole || "Vendas");
    setIsWizardOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title="Assistente ZAI" />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 overflow-hidden p-0.5">
                <img
                  src="/assets/mascot/zaibot_avatar.png"
                  alt="ZAIBOT"
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-display flex items-center gap-2">
                  <span>Assistente ZAI</span>
                  <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-400 bg-amber-500/10">
                    Copiloto Administrativo
                  </Badge>
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Inteligência de gestão: crie, configure, audite e evolua seus atendentes digitais por loja e número de WhatsApp.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/attendants?section=business")}
              className="rounded-xl text-xs gap-1.5 border-border/60"
            >
              <Storefront className="h-3.5 w-3.5" />
              <span>Ver Lojas</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/attendants")}
              className="rounded-xl text-xs gap-1.5 border-border/60"
            >
              <Headset className="h-3.5 w-3.5" />
              <span>Ver Atendentes</span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleOpenWizard("Vendas")}
              className="rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow"
            >
              <Plus weight="bold" className="h-3.5 w-3.5" />
              <span>Novo Atendente</span>
            </Button>
          </div>
        </div>

        {/* Operational Copilot Interface */}
        <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur shadow-sm p-4 md:p-6">
          <ZaiPlatformAssistantView
            onOpenNewAgentWizard={handleOpenWizard}
            onRefreshAgents={() => {}}
          />
        </div>
      </main>

      {/* New Agent Wizard */}
      {isWizardOpen && (
        <NewAgentWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onSuccess={() => setIsWizardOpen(false)}
          defaultRole={wizardDefaultRole}
        />
      )}
    </div>
  );
}
