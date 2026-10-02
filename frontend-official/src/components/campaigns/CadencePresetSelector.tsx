import React from "react";
import { cn } from "@/core/lib/utils";
import { ShieldCheck, Gauge, Lightning, Sliders, Warning, CheckCircle, Clock, Sparkle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";

export type CadencePresetType = "safe" | "balanced" | "fast" | "custom";

export interface CadencePresetConfig {
  id: CadencePresetType;
  title: string;
  subtitle: string;
  badge: string;
  badgeVariant: "success" | "warning" | "destructive" | "outline";
  icon: React.ReactNode;
  intervalSeconds: number;
  typingDelaySeconds: number;
  pauseEvery: number;
  pauseSeconds: number;
  speedLabel: string;
  simulatedDurationFor60: string;
  riskDescription: string;
}

export const CADENCE_PRESETS: Record<Exclude<CadencePresetType, "custom">, CadencePresetConfig> = {
  safe: {
    id: "safe",
    title: "Padrão Humano Sem Risco",
    subtitle: "Cadência natural com pausas e digitação realista de atendente",
    badge: "🛡️ Sem Risco (Anti-Ban)",
    badgeVariant: "success",
    icon: <ShieldCheck className="h-5 w-5 text-emerald-500" weight="fill" />,
    intervalSeconds: 115,
    typingDelaySeconds: 8,
    pauseEvery: 7,
    pauseSeconds: 180,
    speedLabel: "~25 a 30 msgs/hora",
    simulatedDurationFor60: "~2 horas para 60 contatos",
    riskDescription: "Risco Mínimo: Imita 100% o comportamento de uma pessoa no WhatsApp.",
  },
  balanced: {
    id: "balanced",
    title: "Modo Equilibrado",
    subtitle: "Velocidade moderada para chips já aquecidos",
    badge: "⚖️ Risco Controlado",
    badgeVariant: "warning",
    icon: <Gauge className="h-5 w-5 text-amber-500" weight="fill" />,
    intervalSeconds: 45,
    typingDelaySeconds: 5,
    pauseEvery: 15,
    pauseSeconds: 60,
    speedLabel: "~60 a 70 msgs/hora",
    simulatedDurationFor60: "~50 minutos para 60 contatos",
    riskDescription: "Risco Baixo/Médio: Recomendado para contas com mais de 7 dias de operação.",
  },
  fast: {
    id: "fast",
    title: "Turbo / Rápido",
    subtitle: "Envio acelerado para urgências (maior exposição)",
    badge: "⚠️ Alto Risco de Bloqueio",
    badgeVariant: "destructive",
    icon: <Lightning className="h-5 w-5 text-rose-500" weight="fill" />,
    intervalSeconds: 15,
    typingDelaySeconds: 2,
    pauseEvery: 30,
    pauseSeconds: 30,
    speedLabel: "~150 a 180 msgs/hora",
    simulatedDurationFor60: "~15 minutos para 60 contatos",
    riskDescription: "Risco Alto: Disparos rápidos podem ativar alertas anti-spam da Meta.",
  },
};

interface CadencePresetSelectorProps {
  selectedPreset: CadencePresetType;
  onSelectPreset: (preset: CadencePresetType) => void;
  recipientCount?: number;
}

export function CadencePresetSelector({
  selectedPreset,
  onSelectPreset,
  recipientCount = 60,
}: CadencePresetSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkle className="h-4 w-4 text-primary" weight="fill" />
            Perfil de Cadência e Proteção Anti-Ban
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione o ritmo de envio para proteger seu chip contra bloqueios ou configure manualmente.
          </p>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Preset Seguro */}
        <button
          type="button"
          onClick={() => onSelectPreset("safe")}
          className={cn(
            "relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
            selectedPreset === "safe"
              ? "border-emerald-500/80 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/40"
              : "border-border/70 bg-card/60 hover:border-emerald-500/40 hover:bg-card/90"
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {CADENCE_PRESETS.safe.icon}
                <span className="font-semibold text-sm text-foreground">Sem Risco</span>
              </div>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400 text-[10px] py-0 px-1.5">
                Recomendado
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {CADENCE_PRESETS.safe.subtitle}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Intervalo:</span>
              <span className="font-medium text-foreground">~115s (2 min)</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Digitação:</span>
              <span className="font-medium text-foreground">8s ativa</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Para {recipientCount} leads:</span>
              <span className="font-medium text-emerald-400">~2 horas</span>
            </div>
          </div>
        </button>

        {/* Preset Equilibrado */}
        <button
          type="button"
          onClick={() => onSelectPreset("balanced")}
          className={cn(
            "relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
            selectedPreset === "balanced"
              ? "border-amber-500/80 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/40"
              : "border-border/70 bg-card/60 hover:border-amber-500/40 hover:bg-card/90"
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {CADENCE_PRESETS.balanced.icon}
                <span className="font-semibold text-sm text-foreground">Equilibrado</span>
              </div>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/15 text-amber-400 text-[10px] py-0 px-1.5">
                Comercial
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {CADENCE_PRESETS.balanced.subtitle}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Intervalo:</span>
              <span className="font-medium text-foreground">45s</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Digitação:</span>
              <span className="font-medium text-foreground">5s ativa</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Para {recipientCount} leads:</span>
              <span className="font-medium text-amber-400">~50 min</span>
            </div>
          </div>
        </button>

        {/* Preset Turbo */}
        <button
          type="button"
          onClick={() => onSelectPreset("fast")}
          className={cn(
            "relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
            selectedPreset === "fast"
              ? "border-rose-500/80 bg-rose-500/10 shadow-sm ring-1 ring-rose-500/40"
              : "border-border/70 bg-card/60 hover:border-rose-500/40 hover:bg-card/90"
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {CADENCE_PRESETS.fast.icon}
                <span className="font-semibold text-sm text-foreground">Turbo / Rápido</span>
              </div>
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/15 text-rose-400 text-[10px] py-0 px-1.5">
                Com Risco
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {CADENCE_PRESETS.fast.subtitle}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Intervalo:</span>
              <span className="font-medium text-foreground">15s</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Digitação:</span>
              <span className="font-medium text-foreground">2s</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Para {recipientCount} leads:</span>
              <span className="font-medium text-rose-400">~15 min</span>
            </div>
          </div>
        </button>

        {/* Preset Personalizado */}
        <button
          type="button"
          onClick={() => onSelectPreset("custom")}
          className={cn(
            "relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
            selectedPreset === "custom"
              ? "border-primary/80 bg-primary/10 shadow-sm ring-1 ring-primary/40"
              : "border-border/70 bg-card/60 hover:border-primary/40 hover:bg-card/90"
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-primary" weight="fill" />
                <span className="font-semibold text-sm text-foreground">Personalizado</span>
              </div>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] py-0 px-1.5">
                Manual
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              Controle individual milissegundo a milissegundo de cada delay e pausa.
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Ajustes:</span>
              <span className="font-medium text-foreground">Steppers livres</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Pausas:</span>
              <span className="font-medium text-foreground">Definidas por você</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Modo:</span>
              <span className="font-medium text-primary">Avançado</span>
            </div>
          </div>
        </button>
      </div>

      {/* Alerta explicativo do modo selecionado */}
      {selectedPreset === "safe" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" weight="fill" />
          <div>
            <p className="font-medium text-emerald-200">Modo Sem Risco Ativo (Padrão Humano)</p>
            <p className="text-emerald-400/90 mt-0.5">
              O motor simula uma pessoa abrindo o chat, lendo a conversa, digitando por 6s a 12s e esperando cerca de 2 minutos antes do próximo contato, com descansos a cada 7 envios. Perfeito para aquecer chips e recuperar clientes sem risco de denúncia.
            </p>
          </div>
        </div>
      )}

      {selectedPreset === "fast" && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2.5">
          <Warning className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" weight="fill" />
          <div>
            <p className="font-medium text-rose-200">Atenção: Modo Turbo com Risco de Bloqueio</p>
            <p className="text-rose-400/90 mt-0.5">
              Envios a cada 15 segundos podem disparar o sensor de tráfego anormal do WhatsApp (especialmente para novos contatos). Utilize apenas se tiver certeza de que a base já tem seu número salvo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
