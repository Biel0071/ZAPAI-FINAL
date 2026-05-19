import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import FlowsView from "@/lovable/pages/FlowsPageView";
import { createFlowsLovableViewModel, type FlowItem } from "@/adapters/lovable/flowsAdapter";
import { requestApiEndpoint } from "@/services/apiService";

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

  const flowsViewModel = createFlowsLovableViewModel({ flows, loading });

  return (
    <div className="min-h-screen">
      <Header title="Fluxos de Automação" subtitle="Sistema de fluxos comerciais automatizados" />
      <FlowsView
        viewModel={flowsViewModel}
        loading={loading}
        flows={flows}
        draft={draft}
        onDraftChange={setDraft}
        onAddFlow={handleAddFlow}
      />
    </div>
  );
}
