import React, { useState } from "react";
import {
  Sparkle,
  X,
  Brain,
  CheckCircle,
  TrendUp,
  Clock,
  PencilSimple,
  Rocket,
  ShieldCheck,
  MagicWand,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiService } from "@/services/apiService";
import { notify } from "@/services/notifyService";

interface AICampaignModalProps {
  open: boolean;
  onClose: () => void;
  onApplyGeneratedCampaign: (campaignData: any) => void;
}

export function AICampaignModal({ open, onClose, onApplyGeneratedCampaign }: AICampaignModalProps) {
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState<string>("morno");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      notify.warn("Por favor, digite o objetivo da campanha para a IA.");
      return;
    }
    setLoading(true);
    try {
      notify.info("Criando campanha inteligente com IA...");
      const res = await apiService.generateCampaignAI(prompt, temperature);
      if (res?.data) {
        setResult(res.data);
        notify.success("Campanha por IA gerada com sucesso!");
      }
    } catch {
      notify.error("Falha ao gerar campanha por IA. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApplyGeneratedCampaign(result);
    onClose();
    notify.success("Campanha carregada no editor de disparos!");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="max-w-3xl border-border/80 bg-card/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-5">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-3">
          <DialogTitle className="font-display text-lg font-bold flex items-center gap-2 text-foreground">
            <Sparkle className="h-5 w-5 text-primary animate-pulse" weight="fill" />
            Criador Inteligente de Campanhas por IA
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Qual é o objetivo principal da sua campanha?
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Exemplo: Quero vender caixa d'água Fortlev para leads mornos oferecendo frete grátis e desconto progressivo nesta semana."
                rows={4}
                className="rounded-2xl bg-background/60 border-border/60 text-xs p-3.5 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Temperatura Ideal do Público-Alvo:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "quente", label: "Quente (Pronto P/ Comprar)" },
                  { id: "morno", label: "Morno (Com Interesse)" },
                  { id: "frio", label: "Frio (Educativo)" },
                  { id: "all", label: "Toda a Base" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTemperature(item.id)}
                    className={`rounded-xl border p-2.5 text-center text-xs font-bold transition-all ${
                      temperature === item.id
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background/40 border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full rounded-xl h-11 text-xs font-bold gap-2 shadow-glow"
              onClick={() => void handleGenerate()}
              disabled={loading || !prompt.trim()}
            >
              <MagicWand className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "A IA está estruturando sua campanha..." : "Gerar Campanha com Inteligência Artificial"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
            {/* Generated Campaign Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="rounded-2xl border-primary/30 bg-primary/5 p-3">
                <span className="text-[10px] uppercase font-bold text-primary">Score da Campanha</span>
                <h4 className="font-display text-xl font-bold text-foreground mt-0.5">{result.score || 94} / 100</h4>
                <span className="text-[10px] text-success font-semibold">Excelente Estruturação</span>
              </Card>

              <Card className="rounded-2xl border-success/30 bg-success/5 p-3">
                <span className="text-[10px] uppercase font-bold text-success">Chance Estimada Conversão</span>
                <h4 className="font-display text-xl font-bold text-success mt-0.5">{result.conversionProbability || "28% ~ 35%"}</h4>
                <span className="text-[10px] text-muted-foreground">Baseado em histórico B2B</span>
              </Card>

              <Card className="rounded-2xl border-border/60 bg-background/50 p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Tom de Voz Sugerido</span>
                <h4 className="font-display text-xs font-bold text-foreground mt-1 truncate">{result.tone || "Consultivo e Agil"}</h4>
                <span className="text-[10px] text-muted-foreground">CTA: {result.cta || "Reserva Direta"}</span>
              </Card>
            </div>

            {/* Campaign Rationale */}
            <Card className="rounded-2xl border-border/60 bg-card/60 p-4 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-primary" />
                Por que a IA criou esta estratégia?
              </span>
              <p className="text-xs text-foreground/90 leading-relaxed italic">
                {result.rationale}
              </p>
            </Card>

            {/* Editable Generated Fields */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Nome da Campanha</label>
                <Input
                  value={result.name}
                  onChange={(e) => setResult({ ...result, name: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Sequência de Mensagens Geradas</label>
                {result.messages.map((msg: string, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <span className="text-[9px] font-bold text-primary">Mensagem {idx + 1}:</span>
                    <Textarea
                      value={msg}
                      onChange={(e) => {
                        const newMsgs = [...result.messages];
                        newMsgs[idx] = e.target.value;
                        setResult({ ...result, messages: newMsgs });
                      }}
                      rows={2}
                      className="rounded-xl text-xs bg-background/50 border-border/60"
                    />
                  </div>
                ))}
              </div>

              {result.followup && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-amber-400">Mensagem de Follow-up Pós 24h:</span>
                  <Textarea
                    value={result.followup}
                    onChange={(e) => setResult({ ...result, followup: e.target.value })}
                    rows={2}
                    className="rounded-xl text-xs bg-background/50 border-amber-500/30"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="w-1/3 rounded-xl text-xs" onClick={() => setResult(null)}>
                Nova Solicitação
              </Button>
              <Button className="w-2/3 rounded-xl text-xs font-bold gap-2 shadow-glow" onClick={handleApply}>
                <Rocket className="h-4 w-4" />
                Usar Esta Campanha no Editor
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
