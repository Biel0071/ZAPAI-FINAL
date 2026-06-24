import { useCallback, useEffect, useMemo, useState } from "react";
import { loadNodeDetails, moveSessionToNode, runDeployAction, type DeployAction } from "@/services/masterNodeService";
import { masterWebsocketService } from "@/services/engines/masterWebsocketService";
import { notify } from "@/services/notifyService";
import type { NodeDetailsBundle, NodeDeploymentEvent, NodeMetricsSnapshot } from "@/types/masterNode";

const EMPTY_DETAILS: NodeDetailsBundle = {
  node: null,
  metricsSeries: [],
  containers: [],
  sessions: [],
  deployments: [],
  logs: [],
  runtime: {},
  websocket: {},
  diagnostics: [],
};

export function useNodeDetailsControlPlane(nodeId: string | undefined) {
  const [bundle, setBundle] = useState<NodeDetailsBundle>(EMPTY_DETAILS);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<DeployAction | null>(null);

  const refresh = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const data = await loadNodeDetails(nodeId);
      setBundle(data);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!nodeId) return;

    let active = true;
    let metricsSub: Awaited<ReturnType<typeof masterWebsocketService.subscribe>> | null = null;
    let deploymentsSub: Awaited<ReturnType<typeof masterWebsocketService.subscribe>> | null = null;

    const boot = async () => {
      const sub1 = await masterWebsocketService.subscribe("metrics", (payload) => {
        if (!active) return;
        const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
        const eventNodeId = String(data?.nodeId ?? data?.node_id ?? "");
        if (!data || eventNodeId !== nodeId || !data.metric || typeof data.metric !== "object") return;

        setBundle((prev) => ({
          ...prev,
          metricsSeries: [...prev.metricsSeries, data.metric as NodeMetricsSnapshot].slice(-80),
        }));
      });
      if (!active) {
        masterWebsocketService.unsubscribe(sub1);
        return;
      }
      metricsSub = sub1;

      const sub2 = await masterWebsocketService.subscribe("deployments", (payload) => {
        if (!active) return;
        const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
        if (!data || !data.deployment || typeof data.deployment !== "object") return;
        const deploy = data.deployment as NodeDeploymentEvent;
        if (deploy.nodeId !== nodeId && deploy.nodeId !== "") return;

        setBundle((prev) => {
          const index = prev.deployments.findIndex((item) => item.id === deploy.id);
          if (index === -1) {
            return { ...prev, deployments: [deploy, ...prev.deployments].slice(0, 120) };
          }
          const deployments = prev.deployments.slice();
          deployments[index] = { ...deployments[index], ...deploy };
          return { ...prev, deployments };
        });
      });
      if (!active) {
        masterWebsocketService.unsubscribe(sub2);
        return;
      }
      deploymentsSub = sub2;
    };

    void boot();

    return () => {
      active = false;
      if (metricsSub) masterWebsocketService.unsubscribe(metricsSub);
      if (deploymentsSub) masterWebsocketService.unsubscribe(deploymentsSub);
    };
  }, [nodeId]);

  const runAction = useCallback(
    async (action: DeployAction) => {
      if (!nodeId) return;
      setActionLoading(action);
      try {
        await runDeployAction(nodeId, action);
        notify.success(`Ação ${action} enviada para o node`);
        await refresh();
      } catch {
        notify.error(`Falha ao executar ação ${action}`);
      } finally {
        setActionLoading(null);
      }
    },
    [nodeId, refresh],
  );

  const moveSession = useCallback(
    async (sessionId: string, targetNodeId: string) => {
      if (!sessionId || !targetNodeId) return;
      try {
        await moveSessionToNode(sessionId, targetNodeId);
        notify.success("Sessão movida com sucesso");
        await refresh();
      } catch {
        notify.error("Falha ao mover sessão");
      }
    },
    [refresh],
  );

  const timeline = useMemo(
    () => Array.isArray(bundle?.deployments) ? [...bundle.deployments].sort((a, b) => new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime()) : [],
    [bundle.deployments],
  );

  return {
    bundle,
    loading,
    actionLoading,
    timeline,
    refresh,
    runAction,
    moveSession,
  };
}
