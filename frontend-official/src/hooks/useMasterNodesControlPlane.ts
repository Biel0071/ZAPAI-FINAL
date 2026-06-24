import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadNodesControlPlane } from "@/services/masterNodeService";
import { masterWebsocketService } from "@/services/engines/masterWebsocketService";
import { useMasterNodeStore } from "@/stores/masterNodeStore";
import type { NodeControlPlane, NodeDeploymentEvent, NodeMetricsSnapshot } from "@/types/masterNode";

const POLL_INTERVAL_MS = 30_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function normalizeWsNode(payload: unknown): NodeControlPlane | null {
  if (!isObject(payload) || !isObject(payload.node)) return null;
  return payload.node as NodeControlPlane;
}

function normalizeWsMetric(payload: unknown): { nodeId: string; metric: NodeMetricsSnapshot } | null {
  if (!isObject(payload) || !isObject(payload.metric)) return null;
  const nodeId = String(payload.nodeId ?? payload.node_id ?? "").trim();
  if (!nodeId) return null;
  return { nodeId, metric: payload.metric as NodeMetricsSnapshot };
}

function normalizeWsDeployment(payload: unknown): NodeDeploymentEvent | null {
  if (!isObject(payload) || !isObject(payload.deployment)) return null;
  return payload.deployment as NodeDeploymentEvent;
}

export function useMasterNodesControlPlane() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { nodes, cluster, deployments, setNodes, setCluster, pushMetric, upsertDeployment } = useMasterNodeStore();

  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await loadNodesControlPlane();
      if (!mountedRef.current) return;
      setNodes(data.nodes);
      setCluster(data.cluster);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Falha ao carregar cluster");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [setCluster, setNodes]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    void refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, POLL_INTERVAL_MS);

    let nodesSub: Awaited<ReturnType<typeof masterWebsocketService.subscribe>> | null = null;
    let metricsSub: Awaited<ReturnType<typeof masterWebsocketService.subscribe>> | null = null;
    let deploymentsSub: Awaited<ReturnType<typeof masterWebsocketService.subscribe>> | null = null;

    const bootWs = async () => {
      const sub1 = await masterWebsocketService.subscribe("nodes", (payload) => {
        if (!active) return;
        const nextNode = normalizeWsNode(payload);
        if (!nextNode) return;
        const currentNodes = useMasterNodeStore.getState().nodes;
        const merged = currentNodes
          .filter((node) => node.id !== nextNode.id)
          .concat(nextNode)
          .sort((a, b) => a.name.localeCompare(b.name));
        setNodes(merged);
      });
      if (!active) {
        masterWebsocketService.unsubscribe(sub1);
        return;
      }
      nodesSub = sub1;

      const sub2 = await masterWebsocketService.subscribe("metrics", (payload) => {
        if (!active) return;
        const parsed = normalizeWsMetric(payload);
        if (!parsed) return;
        pushMetric(parsed.nodeId, parsed.metric);
      });
      if (!active) {
        masterWebsocketService.unsubscribe(sub2);
        return;
      }
      metricsSub = sub2;

      const sub3 = await masterWebsocketService.subscribe("deployments", (payload) => {
        if (!active) return;
        const event = normalizeWsDeployment(payload);
        if (!event) return;
        upsertDeployment(event);
      });
      if (!active) {
        masterWebsocketService.unsubscribe(sub3);
        return;
      }
      deploymentsSub = sub3;
    };

    void bootWs();

    return () => {
      active = false;
      mountedRef.current = false;
      window.clearInterval(timer);
      if (nodesSub) masterWebsocketService.unsubscribe(nodesSub);
      if (metricsSub) masterWebsocketService.unsubscribe(metricsSub);
      if (deploymentsSub) masterWebsocketService.unsubscribe(deploymentsSub);
    };
  }, [pushMetric, refresh, setNodes, upsertDeployment]);

  const sortedNodes = useMemo(
    () => Array.isArray(nodes) ? [...nodes].sort((a, b) => (a.name || "").localeCompare(b.name || "")) : [],
    [nodes],
  );

  return {
    nodes: sortedNodes,
    cluster,
    deployments,
    loading,
    error,
    refresh,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}
