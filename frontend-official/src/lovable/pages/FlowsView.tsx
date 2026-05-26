import { motion } from "framer-motion";
import { Plus, TreeStructure, Lightning, ChatCircleText, ArrowRight, PencilSimple, Trash } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import type { FlowItem, FlowsLovableViewModel } from "@/adapters/lovable/flowsAdapter";

export interface FlowsViewProps {
  viewModel: FlowsLovableViewModel;
  loading: boolean;
  flows: FlowItem[];
  draft: FlowItem;
  editingId: string | null;
  onDraftChange: (draft: FlowItem) => void;
  onAddFlow: () => void;
  onEditFlow: (flow: FlowItem) => void;
  onDeleteFlow: (flowId: string) => void;
  onCancelEdit: () => void;
}

export function FlowsView({ viewModel, loading, flows, draft, editingId, onDraftChange, onAddFlow, onEditFlow, onDeleteFlow, onCancelEdit }: FlowsViewProps) {
  const isEditing = editingId !== null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="page-container section-stack">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="metric-card rounded-2xl"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Total Flows</p><p className="font-display text-2xl font-bold">{viewModel.totalFlows}</p></div><TreeStructure className="h-8 w-8 text-primary" /></CardContent></Card>
        <Card className="metric-card rounded-2xl"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Origem dos dados</p><p className="font-display text-2xl font-bold">{viewModel.dataSourceLabel}</p></div><Lightning className="h-8 w-8 text-info" /></CardContent></Card>
        <Card className="metric-card rounded-2xl"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p><p className="font-display text-2xl font-bold">{viewModel.stateLabel}</p></div><ChatCircleText className="h-8 w-8 text-success" /></CardContent></Card>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display">{isEditing ? "Editar fluxo" : "Novo fluxo comercial"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Flow ID</Label><Input value={draft.id} onChange={(e) => onDraftChange({ ...draft, id: e.target.value })} placeholder="price_request" className="rounded-xl" disabled={isEditing} /></div>
            <div className="space-y-2"><Label>Nome</Label><Input value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} placeholder="Price Request" className="rounded-xl" /></div>
          </div>
          <div className="space-y-2"><Label>Gatilho</Label><Input value={draft.trigger} onChange={(e) => onDraftChange({ ...draft, trigger: e.target.value })} placeholder="customer asks for price" className="rounded-xl" /></div>
          <div className="space-y-2"><Label>Resposta</Label><Textarea value={draft.response} onChange={(e) => onDraftChange({ ...draft, response: e.target.value })} className="min-h-24 rounded-xl" /></div>
          <div className="space-y-2"><Label>Próximos passos (separados por vírgula)</Label><Input value={draft.nextSteps.join(", ")} onChange={(e) => onDraftChange({ ...draft, nextSteps: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="ask_budget, offer_plan, handoff_sales" className="rounded-xl" /></div>
          <div className="flex gap-2">
            <Button className="gap-2 rounded-xl shadow-glow" onClick={onAddFlow}>
              <Plus className="h-4 w-4" />{isEditing ? "Salvar alterações" : "Adicionar Flow"}
            </Button>
            {isEditing && (
              <Button variant="outline" className="rounded-xl" onClick={onCancelEdit}>Cancelar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : flows.length === 0 ? (
          <Card className="glass-card rounded-2xl">
            <CardContent className="p-0">
              <EmptyState
                icon={<TreeStructure className="h-8 w-8 text-muted-foreground/50" />}
                title="Nenhum fluxo cadastrado"
                description="Crie o primeiro fluxo comercial para automatizar interações com os clientes."
              />
            </CardContent>
          </Card>
        ) : flows.map((flow) => (
          <Card key={flow.id} className="glass-card rounded-2xl">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold">{flow.name}</p>
                  <p className="text-xs text-muted-foreground">{flow.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full">Ativo</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50" onClick={() => onEditFlow(flow)} title="Editar">
                    <PencilSimple className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onDeleteFlow(flow.id)} title="Excluir">
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm"><span className="text-muted-foreground">gatilho:</span> {flow.trigger}</p>
              <p className="text-sm"><span className="text-muted-foreground">resposta:</span> {flow.response}</p>
              {flow.nextSteps.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {flow.nextSteps.map((step) => (
                    <span key={step} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                      <ArrowRight className="h-3 w-3" />{step}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

export default FlowsView;
