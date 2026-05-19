import { motion } from "framer-motion";
import { Plus, TreeStructure, Lightning, ChatCircleText, ArrowRight } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { FlowItem, FlowsLovableViewModel } from "@/adapters/lovable/flowsAdapter";

export interface FlowsViewProps {
  viewModel: FlowsLovableViewModel;
  loading: boolean;
  flows: FlowItem[];
  draft: FlowItem;
  onDraftChange: (draft: FlowItem) => void;
  onAddFlow: () => void;
}

export function FlowsView({ viewModel, loading, flows, draft, onDraftChange, onAddFlow }: FlowsViewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="page-container section-stack">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Flows</p><p className="text-2xl font-bold">{viewModel.totalFlows}</p></div><TreeStructure className="w-8 h-8 text-primary" /></CardContent></Card>
        <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Origem dos dados</p><p className="text-2xl font-bold">{viewModel.dataSourceLabel}</p></div><Lightning className="w-8 h-8 text-info" /></CardContent></Card>
        <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Estado</p><p className="text-2xl font-bold">{viewModel.stateLabel}</p></div><ChatCircleText className="w-8 h-8 text-success" /></CardContent></Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="font-display">Novo fluxo comercial</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Flow ID</Label><Input value={draft.id} onChange={(e) => onDraftChange({ ...draft, id: e.target.value })} placeholder="price_request" /></div>
            <div className="space-y-2"><Label>Name</Label><Input value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} placeholder="Price Request" /></div>
          </div>
          <div className="space-y-2"><Label>trigger</Label><Input value={draft.trigger} onChange={(e) => onDraftChange({ ...draft, trigger: e.target.value })} placeholder="customer asks for price" /></div>
          <div className="space-y-2"><Label>response</Label><Textarea value={draft.response} onChange={(e) => onDraftChange({ ...draft, response: e.target.value })} className="min-h-24" /></div>
          <div className="space-y-2"><Label>next steps (comma separated)</Label><Input value={draft.nextSteps.join(", ")} onChange={(e) => onDraftChange({ ...draft, nextSteps: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="ask_budget, offer_plan, handoff_sales" /></div>
          <Button className="gap-2" onClick={onAddFlow}><Plus className="w-4 h-4" />Adicionar Flow</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {flows.length === 0 ? (
          <Card className="glass-card"><CardContent className="p-5 text-sm text-muted-foreground">{loading ? "Sincronizando fluxos da API..." : "Sem fluxos retornados pela API de produção."}</CardContent></Card>
        ) : flows.map((flow) => (
          <Card key={flow.id} className="glass-card">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{flow.name}</p>
                  <p className="text-sm text-muted-foreground">{flow.id}</p>
                </div>
                <Badge variant="secondary">Ativo</Badge>
              </div>
              <p className="text-sm"><span className="text-muted-foreground">trigger:</span> {flow.trigger}</p>
              <p className="text-sm"><span className="text-muted-foreground">response:</span> {flow.response}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {flow.nextSteps.map((step) => (
                  <span key={step} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                    <ArrowRight className="w-3 h-3" />{step}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
