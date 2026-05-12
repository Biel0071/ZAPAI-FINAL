import { create } from "zustand";
import type { ClusterOverview, NodeControlPlane, NodeDeploymentEvent, NodeMetricsSnapshot } from "@/types/masterNode";

type MasterNodeState = {
  nodes: NodeControlPlane[];
  cluster: ClusterOverview | null;
  metricsByNode: Record<string, NodeMetricsSnapshot[]>;
  deployments: NodeDeploymentEvent[];
  selectedNodeId: string | null;
  lastSyncAt: number | null;
  setNodes: (nodes: NodeControlPlane[]) => void;
  setCluster: (cluster: ClusterOverview | null) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  pushMetric: (nodeId: string, metric: NodeMetricsSnapshot) => void;
  upsertDeployment: (event: NodeDeploymentEvent) => void;
};

export const useMasterNodeStore = create<MasterNodeState>((set) => ({
  nodes: [],
  cluster: null,
  metricsByNode: {},
  deployments: [],
  selectedNodeId: null,
  lastSyncAt: null,

  setNodes: (nodes) => set({ nodes, lastSyncAt: Date.now() }),
  setCluster: (cluster) => set({ cluster, lastSyncAt: Date.now() }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  pushMetric: (nodeId, metric) =>
    set((state) => {
      const current = state.metricsByNode[nodeId] ?? [];
      const next = [...current, metric].slice(-60);
      return {
        metricsByNode: { ...state.metricsByNode, [nodeId]: next },
        lastSyncAt: Date.now(),
      };
    }),

  upsertDeployment: (event) =>
    set((state) => {
      const index = state.deployments.findIndex((item) => item.id === event.id);
      if (index === -1) {
        return { deployments: [event, ...state.deployments].slice(0, 100), lastSyncAt: Date.now() };
      }
      const updated = state.deployments.slice();
      updated[index] = { ...updated[index], ...event };
      return { deployments: updated, lastSyncAt: Date.now() };
    }),
}));
