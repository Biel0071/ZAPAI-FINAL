import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, TreeStructure, Lightning, ChatCircleText, ArrowRight } from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { requestApiEndpoint } from "@/services/apiService";

type FlowItem = {
  id: string;
  name: string;
  trigger: string;
  response: string;
  nextSteps: string[];
};

export default function Flows() {
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<FlowItem>({
    id: "",
    name: "",
    trigger: "",
    response: "",
    nextSteps: [],
  });

  const totalFlows = useMemo(() => flows.length, [flows]);

  useEffect(() => {
    let active = true;
    void requestApiEndpoint<unknown>("/api/flows")
      .then((payload) => {
        if (!active) return;
        const list = Array.isArray(payload)
          ? payload
          : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)
            ? ((payload as { data?: unknown[] }).data ?? [])
            : [];

        const normalized = list
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item, index) => ({
            id: String(item.id ?? item.flowId ?? `flow-${index}`),
            name: String(item.name ?? item.title ?? item.id ?? `Flow ${index + 1}`),
            trigger: String(item.trigger ?? item.keyword ?? ""),
            response: String(item.response ?? item.reply ?? ""),
            nextSteps: Array.isArray(item.nextSteps) ? item.nextSteps.map(String) : [],
          }));

        setFlows(normalized);
      })
      .catch(() => setFlows([]))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAddFlow = async () => {
    if (!draft.id.trim() || !draft.trigger.trim() || !draft.response.trim()) return;

    const payload = {
      id: draft.id.trim(),
      name: draft.name.trim() || draft.id.trim(),
      trigger: draft.trigger.trim(),
      response: draft.response.trim(),
      nextSteps: draft.nextSteps,
    };

    try {
      const created = await requestApiEndpoint<Record<string, unknown>>("/api/flows", "POST", payload);
      const normalized = {
        id: String(created.id ?? payload.id),
        name: String(created.name ?? payload.name),
        trigger: String(created.trigger ?? payload.trigger),
        response: String(created.response ?? payload.response),
        nextSteps: Array.isArray(created.nextSteps) ? created.nextSteps.map(String) : payload.nextSteps,
      } satisfies FlowItem;
      setFlows((prev) => [normalized, ...prev]);
      setDraft({ id: "", name: "", trigger: "", response: "", nextSteps: [] });
    } catch {
      // keep UI stable; API error feedback can be added in a dedicated UX pass
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Flows" subtitle="Sistema de fluxos comerciais automatizados" />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Flows</p><p className="text-2xl font-bold">{totalFlows}</p></div><TreeStructure className="w-8 h-8 text-primary" /></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Origem dos dados</p><p className="text-2xl font-bold">API</p></div><Lightning className="w-8 h-8 text-info" /></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Estado</p><p className="text-2xl font-bold">{loading ? "Sync" : "OK"}</p></div><ChatCircleText className="w-8 h-8 text-success" /></CardContent></Card>
        </div>

        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display">Novo fluxo comercial</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Flow ID</Label><Input value={draft.id} onChange={(e) => setDraft((prev) => ({ ...prev, id: e.target.value }))} placeholder="price_request" /></div>
              <div className="space-y-2"><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Price Request" /></div>
            </div>
            <div className="space-y-2"><Label>trigger</Label><Input value={draft.trigger} onChange={(e) => setDraft((prev) => ({ ...prev, trigger: e.target.value }))} placeholder="customer asks for price" /></div>
            <div className="space-y-2"><Label>response</Label><Textarea value={draft.response} onChange={(e) => setDraft((prev) => ({ ...prev, response: e.target.value }))} className="min-h-24" /></div>
            <div className="space-y-2"><Label>next steps (comma separated)</Label><Input value={draft.nextSteps.join(", ")} onChange={(e) => setDraft((prev) => ({ ...prev, nextSteps: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))} placeholder="ask_budget, offer_plan, handoff_sales" /></div>
            <Button className="gap-2" onClick={handleAddFlow}><Plus className="w-4 h-4" />Adicionar Flow</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {flows.length === 0 ? (
            <Card className="glass-card"><CardContent className="p-5 text-sm text-muted-foreground">Sem fluxos retornados pela API de produção.</CardContent></Card>
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
    </div>
  );
}
