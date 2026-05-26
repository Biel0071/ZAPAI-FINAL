import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import FlowsView from "@/lovable/pages/FlowsPageView";
import { createFlowsLovableViewModel, type FlowItem } from "@/adapters/lovable/flowsAdapter";
import { requestApiEndpoint } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";

export default function Flows() {
  const { toast } = useToast();
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FlowItem>({
    id: "",
    name: "",
    trigger: "",
    response: "",
    nextSteps: [],
  });

  const loadFlows = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await requestApiEndpoint<unknown>("/api/flows");
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
    } catch {
      setFlows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFlows();
  }, [loadFlows]);

  const handleAddOrUpdateFlow = async () => {
    if (!draft.trigger.trim() || !draft.response.trim()) {
      toast({ title: "Preencha pelo menos gatilho e resposta.", variant: "destructive" });
      return;
    }

    const payload = {
      id: draft.id.trim() || `flow-${Date.now()}`,
      name: draft.name.trim() || draft.id.trim() || `Flow ${flows.length + 1}`,
      trigger: draft.trigger.trim(),
      response: draft.response.trim(),
      nextSteps: draft.nextSteps,
    };

    try {
      if (editingId) {
        // Update existing
        const updated = await requestApiEndpoint<Record<string, unknown>>(`/api/flows/${encodeURIComponent(editingId)}`, "PUT", payload);
        const normalized = {
          id: String(updated.id ?? payload.id),
          name: String(updated.name ?? payload.name),
          trigger: String(updated.trigger ?? payload.trigger),
          response: String(updated.response ?? payload.response),
          nextSteps: Array.isArray(updated.nextSteps) ? updated.nextSteps.map(String) : payload.nextSteps,
        } satisfies FlowItem;
        setFlows((prev) => prev.map((f) => (f.id === editingId ? normalized : f)));
        toast({ title: "Fluxo atualizado com sucesso." });
        setEditingId(null);
      } else {
        // Create new
        const created = await requestApiEndpoint<Record<string, unknown>>("/api/flows", "POST", payload);
        const normalized = {
          id: String(created.id ?? payload.id),
          name: String(created.name ?? payload.name),
          trigger: String(created.trigger ?? payload.trigger),
          response: String(created.response ?? payload.response),
          nextSteps: Array.isArray(created.nextSteps) ? created.nextSteps.map(String) : payload.nextSteps,
        } satisfies FlowItem;
        setFlows((prev) => [normalized, ...prev]);
        toast({ title: "Fluxo criado com sucesso." });
      }
      setDraft({ id: "", name: "", trigger: "", response: "", nextSteps: [] });
    } catch {
      toast({ title: editingId ? "Erro ao atualizar fluxo." : "Erro ao criar fluxo.", variant: "destructive" });
    }
  };

  const handleEditFlow = (flow: FlowItem) => {
    setEditingId(flow.id);
    setDraft({ ...flow });
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteFlow = async (flowId: string) => {
    try {
      await requestApiEndpoint(`/api/flows/${encodeURIComponent(flowId)}`, "DELETE");
      setFlows((prev) => prev.filter((f) => f.id !== flowId));
      if (editingId === flowId) {
        setEditingId(null);
        setDraft({ id: "", name: "", trigger: "", response: "", nextSteps: [] });
      }
      toast({ title: "Fluxo excluído com sucesso." });
    } catch {
      toast({ title: "Erro ao excluir fluxo.", variant: "destructive" });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft({ id: "", name: "", trigger: "", response: "", nextSteps: [] });
  };

  const flowsViewModel = createFlowsLovableViewModel({ flows, loading });

  return (
    <div className="min-h-screen">
      <Header title="Fluxos de Automação" subtitle="Sistema de fluxos comerciais automatizados" />
      <FlowsView
        viewModel={flowsViewModel}
        loading={loading}
        flows={flows}
        draft={draft}
        editingId={editingId}
        onDraftChange={setDraft}
        onAddFlow={() => void handleAddOrUpdateFlow()}
        onEditFlow={handleEditFlow}
        onDeleteFlow={(id) => void handleDeleteFlow(id)}
        onCancelEdit={handleCancelEdit}
      />
    </div>
  );
}
