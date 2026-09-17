import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Pencil,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  FlaskConical,
  Target,
  ListChecks,
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN } from "@/services/apiService";

interface Playbook {
  id: number;
  name: string;
  slug: string;
  trigger_condition: string;
  goal: string;
  steps: string[] | string;
  recommended_cta: string;
  confidence: number;
  continuity_boost_pct: number;
  status: string;
  updated_at: string;
}

export function PlaybookManager() {
  const { toast } = useToast();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPb, setEditingPb] = useState<Playbook | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formSteps, setFormSteps] = useState("");
  const [formCta, setFormCta] = useState("");

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/playbooks`, { credentials: "omit" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setPlaybooks(json.data);
      }
    } catch (err: any) {
      console.error("[PlaybookManager] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const openCreateModal = () => {
    setEditingPb(null);
    setFormName("");
    setFormTrigger("");
    setFormGoal("");
    setFormSteps("");
    setFormCta("");
    setModalOpen(true);
  };

  const openEditModal = (pb: Playbook) => {
    setEditingPb(pb);
    setFormName(pb.name);
    setFormTrigger(pb.trigger_condition);
    setFormGoal(pb.goal);
    const parsedSteps = Array.isArray(pb.steps) ? pb.steps : (typeof pb.steps === "string" ? JSON.parse(pb.steps || "[]") : []);
    setFormSteps(parsedSteps.join("\n"));
    setFormCta(pb.recommended_cta || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName || !formTrigger || !formGoal) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const stepsArray = formSteps.split("\n").map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/playbooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          id: editingPb?.id,
          name: formName,
          slug: editingPb?.slug || formName.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          trigger_condition: formTrigger,
          goal: formGoal,
          steps: stepsArray,
          recommended_cta: formCta,
          confidence: editingPb?.confidence || 0.90,
          status: editingPb?.status || "approved"
        })
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Playbook salvo com sucesso!" });
        setModalOpen(false);
        fetchPlaybooks();
      } else {
        toast({ title: "Erro ao salvar", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-600 text-white font-semibold flex items-center gap-1 px-2.5 py-0.5">
                <BookOpen className="w-3.5 h-3.5" /> Camada 3 & 5: Estratégias Comerciais
              </Badge>
              <span className="text-xs text-muted-foreground">Aprendizado Supervisionado</span>
            </div>
            <h2 className="text-xl font-bold mt-1 text-foreground">
              Playbooks Operacionais de Atendimento
            </h2>
            <p className="text-xs text-muted-foreground max-w-2xl mt-0.5">
              Roteiros comerciais testados que ensinam a IA <em>como</em> conduzir o cliente — desde a qualificação
              do bairro e frete até a cotação de itens adicionais e fechamento.
            </p>
          </div>
          <Button onClick={openCreateModal} className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Novo Playbook
          </Button>
        </div>
      </div>

      {/* Playbooks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playbooks.map((pb) => {
          const parsedSteps = Array.isArray(pb.steps) ? pb.steps : (typeof pb.steps === "string" ? JSON.parse(pb.steps || "[]") : []);
          return (
            <Card key={pb.id} className="border border-border/50 bg-card/60 hover:border-purple-500/30 transition-all shadow-sm flex flex-col justify-between">
              <div>
                <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
                  <div className="space-y-1">
                    <Badge
                      variant={pb.status === "approved" ? "default" : "secondary"}
                      className={pb.status === "approved" ? "bg-emerald-600 text-white text-[10px]" : "bg-amber-600 text-white text-[10px]"}
                    >
                      {pb.status === "approved" ? "Aprovado Oficial" : "Teste Sandbox (10%)"}
                    </Badge>
                    <CardTitle className="text-sm font-semibold text-foreground mt-1">
                      {pb.name}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Gatilho: {pb.trigger_condition}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditModal(pb)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3">
                  <div className="bg-muted/20 p-2.5 rounded-lg border border-border/30 text-xs">
                    <p className="text-foreground">
                      <strong className="text-muted-foreground flex items-center gap-1 mb-0.5">
                        <Target className="w-3 h-3 text-purple-400" /> Objetivo:
                      </strong>
                      {pb.goal}
                    </p>
                  </div>

                  {parsedSteps.length > 0 && (
                    <div className="space-y-1 text-xs">
                      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <ListChecks className="w-3 h-3 text-emerald-400" /> Passos do Roteiro:
                      </p>
                      <ul className="space-y-1 pl-4 list-decimal text-muted-foreground text-[11px]">
                        {parsedSteps.map((step: string, idx: number) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {pb.recommended_cta && (
                    <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-xs">
                      <p className="text-[11px] text-purple-300 font-medium flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> CTA Recomendado:
                      </p>
                      <p className="text-[11px] text-foreground italic mt-0.5">
                        "{pb.recommended_cta}"
                      </p>
                    </div>
                  )}
                </CardContent>
              </div>

              <div className="p-4 pt-0 border-t border-border/20 mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Confiança: <strong>{Math.round(Number(pb.confidence || 0.85) * 100)}%</strong></span>
                <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +{pb.continuity_boost_pct || 15}% continuidade
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPb ? "Editar Playbook Operacional" : "Novo Playbook Operacional"}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure a estratégia comercial que orientará o agente a conduzir os atendimentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Playbook</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="ex: Qualificação de Frete e Localização"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Condição de Gatilho (palavras ou intenção)</Label>
              <Input
                value={formTrigger}
                onChange={(e) => setFormTrigger(e.target.value)}
                placeholder="ex: frete, entrega, onde fica, prazo"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Objetivo da Etapa</Label>
              <Textarea
                value={formGoal}
                onChange={(e) => setFormGoal(e.target.value)}
                placeholder="ex: Obter o bairro e a quantidade de material antes de informar o frete final."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Passos do Roteiro (um por linha)</Label>
              <Textarea
                value={formSteps}
                onChange={(e) => setFormSteps(e.target.value)}
                placeholder={"1. Confirmar itens\n2. Solicitar bairro de entrega\n3. Informar frete grátis se atingir valor mínimo"}
                rows={4}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">CTA Recomendado (Pergunta de Fechamento)</Label>
              <Input
                value={formCta}
                onChange={(e) => setFormCta(e.target.value)}
                placeholder="ex: Qual o seu bairro para calcularmos a entrega com o melhor desconto?"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" disabled={saving} onClick={handleSave}>
              {saving ? "Salvando..." : "Salvar Playbook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default PlaybookManager;
