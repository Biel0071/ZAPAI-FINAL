import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, TreeStructure, Lightning, ChatCircleText, ArrowRight } from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type FlowItem = {
  id: string;
  name: string;
  trigger: string;
  response: string;
  nextSteps: string[];
};

const initialFlows: FlowItem[] = [
  {
    id: "price_request",
    name: "Price Request",
    trigger: "customer asks for price",
    response: "Posso te enviar a tabela e indicar o melhor plano para o seu perfil.",
    nextSteps: ["ask_budget", "offer_plan", "handoff_sales"],
  },
  {
    id: "delivery_request",
    name: "Delivery Request",
    trigger: "customer asks about delivery",
    response: "Entregamos para todo o Brasil e informamos prazo por CEP.",
    nextSteps: ["ask_zip_code", "calculate_eta", "confirm_order"],
  },
  {
    id: "payment_request",
    name: "Payment Request",
    trigger: "customer asks payment options",
    response: "Aceitamos PIX, cartão e boleto; posso te enviar o checkout agora.",
    nextSteps: ["show_methods", "send_checkout", "confirm_payment"],
  },
];

export default function Flows() {
  const [flows, setFlows] = useState<FlowItem[]>(initialFlows);
  const [draft, setDraft] = useState<FlowItem>({
    id: "",
    name: "",
    trigger: "",
    response: "",
    nextSteps: [],
  });

  const totalFlows = useMemo(() => flows.length, [flows]);

  const handleAddFlow = () => {
    if (!draft.id.trim() || !draft.trigger.trim() || !draft.response.trim()) return;

    setFlows((prev) => [
      {
        id: draft.id.trim(),
        name: draft.name.trim() || draft.id.trim(),
        trigger: draft.trigger.trim(),
        response: draft.response.trim(),
        nextSteps: draft.nextSteps,
      },
      ...prev,
    ]);

    setDraft({ id: "", name: "", trigger: "", response: "", nextSteps: [] });
  };

  return (
    <div className="min-h-screen">
      <Header title="Flows" subtitle="Sistema de fluxos comerciais automatizados" />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Flows</p><p className="text-2xl font-bold">{totalFlows}</p></div><TreeStructure className="w-8 h-8 text-primary" /></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Templates principais</p><p className="text-2xl font-bold">3</p></div><Lightning className="w-8 h-8 text-info" /></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Resposta automática</p><p className="text-2xl font-bold">ON</p></div><ChatCircleText className="w-8 h-8 text-success" /></CardContent></Card>
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
          {flows.map((flow) => (
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
