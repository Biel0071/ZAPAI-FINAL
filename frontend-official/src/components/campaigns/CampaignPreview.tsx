import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { WhatsAppMessagePreview } from "@/components/conversations/WhatsAppMessagePreview";
import { CompactCard, Card, CardContent } from "@/components/ui/card-variants";
import {
  Timer,
  ArrowDown,
  Sparkle,
  PencilSimple,
  ArrowClockwise,
  Copy,
  Check,
  Rocket,
  BookmarkSimple,
  ShieldCheck,
  Target,
  Users,
  TrendUp,
  Tag,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/services/notifyService";

export interface CampaignStepItem {
  step?: number;
  title?: string;
  delay?: string;
  message: string;
  mediaType?: "text" | "image" | "video" | "audio" | "document" | "file" | "sticker" | null;
  mediaName?: string | null;
}

export interface StructuredCampaignPayload {
  campaignName?: string;
  name?: string;
  objective?: string;
  audience?: string;
  segment?: string;
  tone?: string;
  offer?: string;
  product?: string;
  conditions?: string;
  callToAction?: string;
  cta?: string;
  restrictions?: string;
  score?: number;
  conversionProbability?: string;
  rationale?: string;
  variables?: string[];
  steps?: CampaignStepItem[];
  messages?: string[];
  followUps?: string[];
}

interface CampaignPreviewProps {
  payload: StructuredCampaignPayload | null;
  attendantName?: string;
  attendantAvatarUrl?: string;
  onApplyCampaign?: (payload: StructuredCampaignPayload) => void;
  onSaveDraft?: (payload: StructuredCampaignPayload) => void;
  onRegenerateStep?: (index: number) => void;
  className?: string;
}

export function CampaignPreview({
  payload,
  attendantName = "Camila • Especialista ZAI",
  attendantAvatarUrl,
  onApplyCampaign,
  onSaveDraft,
  onRegenerateStep,
  className,
}: CampaignPreviewProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedSteps, setEditedSteps] = useState<CampaignStepItem[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  React.useEffect(() => {
    if (payload?.steps && payload.steps.length > 0) {
      setEditedSteps(payload.steps);
    } else if (payload?.messages && payload.messages.length > 0) {
      const generated = payload.messages.map((msg, idx) => ({
        step: idx + 1,
        title: idx === 0 ? "Primeiro Contato" : `Follow-up etapa ${idx}`,
        delay: idx === 0 ? "Imediato" : `após ${idx * 2} dias`,
        message: msg,
        mediaType: "text" as const,
      }));
      setEditedSteps(generated);
    }
  }, [payload]);

  if (!payload || editedSteps.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/70 bg-card/20", className)}>
        <Sparkle className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs font-semibold text-foreground">Nenhuma estrutura de campanha gerada ainda.</p>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
          Insira o briefing e clique em &quot;Gerar campanha com IA&quot; para visualizar as mensagens e o preview do WhatsApp.
        </p>
      </div>
    );
  }

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    notify.success("Mensagem copiada para a área de transferência!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveStepEdit = (index: number, newText: string) => {
    setEditedSteps((prev) =>
      prev.map((step, idx) => (idx === index ? { ...step, message: newText } : step))
    );
    setEditingIndex(null);
    notify.success("Mensagem atualizada!");
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Resumo da Estratégia de Campanha */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card/70 to-card/40 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkle className="h-4 w-4" weight="fill" />
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Campanha Estruturada pela IA
              </span>
              <h3 className="font-display text-sm font-bold text-foreground">
                {payload.campaignName || payload.name || "Campanha Inteligente WhatsApp"}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {payload.score && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                Score: {payload.score}/100
              </Badge>
            )}
            {payload.conversionProbability && (
              <Badge variant="outline" className="border-info/30 bg-info/10 text-info text-[10px] font-bold">
                Conversão: {payload.conversionProbability}
              </Badge>
            )}
          </div>
        </div>

        {/* Metadados da Estratégia */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="rounded-xl border border-border/40 bg-background/50 p-2.5 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3 text-primary" /> Objetivo
            </span>
            <p className="font-semibold text-foreground truncate">{payload.objective || "Venda de estoque"}</p>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/50 p-2.5 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3 text-emerald-400" /> Público-Alvo
            </span>
            <p className="font-semibold text-foreground truncate">{payload.audience || payload.segment || "Leads qualificados"}</p>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/50 p-2.5 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3 text-amber-400" /> Tom de Voz
            </span>
            <p className="font-semibold text-foreground truncate">{payload.tone || "Profissional e consultivo"}</p>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/50 p-2.5 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <TrendUp className="h-3 w-3 text-info" /> Oferta Principal
            </span>
            <p className="font-semibold text-foreground truncate">{payload.offer || "Condições especiais"}</p>
          </div>
        </div>

        {payload.rationale && (
          <p className="text-[11px] text-muted-foreground leading-relaxed italic border-l-2 border-primary/40 pl-2.5">
            {payload.rationale}
          </p>
        )}
      </div>

      {/* Sequência de Etapas e Preview do WhatsApp */}
      <div className="flex flex-col items-center gap-3 w-full">
        {editedSteps.map((step, index) => {
          const isEditing = editingIndex === index;

          return (
            <React.Fragment key={index}>
              {index > 0 && (
                <div className="my-1 flex flex-col items-center gap-1 text-muted-foreground select-none">
                  <div className="h-3 w-px bg-border/80"></div>
                  <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3 py-0.5 text-[10.5px] font-semibold text-emerald-400 shadow-sm">
                    <Timer className="h-3 w-3 text-emerald-500" />
                    {step.delay || `após ${index * 2} dias`}
                  </div>
                  <div className="h-3 w-px bg-border/80"></div>
                  <ArrowDown className="h-3 w-3 text-muted-foreground/60" />
                </div>
              )}

              <Card className="w-full rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-4 shadow-sm hover:border-border transition-all">
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      {index + 1}
                    </span>
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                      {step.title || (index === 0 ? "ETAPA 1 — PRIMEIRO CONTATO" : `ETAPA ${index + 1} — FOLLOW-UP`)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingIndex(isEditing ? null : index)}
                      className="h-7 px-2 text-[11px] font-medium gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <PencilSimple className="h-3.5 w-3.5" />
                      {isEditing ? "Fechar" : "Editar"}
                    </Button>

                    {onRegenerateStep && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRegenerateStep(index)}
                        className="h-7 px-2 text-[11px] font-medium gap-1 text-muted-foreground hover:text-primary"
                        title="Pedir para a IA sugerir outra mensagem para esta etapa"
                      >
                        <ArrowClockwise className="h-3.5 w-3.5" />
                        Regenerar
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyMessage(step.message, index)}
                      className="h-7 px-2 text-[11px] font-medium gap-1 text-muted-foreground hover:text-foreground"
                      title="Copiar texto da mensagem"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedIndex === index ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2 mb-3">
                    <Textarea
                      defaultValue={step.message}
                      rows={3}
                      id={`step-edit-${index}`}
                      className="rounded-xl text-xs bg-background/80 border-border/70 leading-relaxed"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditingIndex(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs bg-primary text-primary-foreground font-semibold"
                        onClick={() => {
                          const input = document.getElementById(`step-edit-${index}`) as HTMLTextAreaElement;
                          if (input) handleSaveStepEdit(index, input.value);
                        }}
                      >
                        Salvar Alteração
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* WhatsApp Chat Simulation Container */}
                <div className="rounded-xl border border-border/30 bg-[#0B141A]/60 p-4 flex justify-start">
                  <WhatsAppMessagePreview
                    messageText={step.message}
                    mediaType={step.mediaType}
                    mediaName={step.mediaName}
                    senderName={attendantName}
                    senderAvatarUrl={attendantAvatarUrl}
                  />
                </div>
              </Card>
            </React.Fragment>
          );
        })}
      </div>

      {/* Ações de Conclusão / Ativação */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/40 pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Mensagens validadas com proteção anti-bloqueio WhatsApp.</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onSaveDraft && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSaveDraft({ ...payload, steps: editedSteps })}
              className="rounded-xl text-xs font-semibold h-9 px-4 border-border/80 gap-1.5"
            >
              <BookmarkSimple className="h-3.5 w-3.5" />
              Salvar como Rascunho
            </Button>
          )}

          {onApplyCampaign && (
            <Button
              type="button"
              size="sm"
              onClick={() => onApplyCampaign({ ...payload, steps: editedSteps })}
              className="rounded-xl text-xs font-bold h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-1.5"
            >
              <Rocket className="h-3.5 w-3.5" />
              Usar Esta Campanha no Disparo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
