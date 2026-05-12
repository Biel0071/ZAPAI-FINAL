import { loadNodeDetails } from "@/services/masterNodeService";

export const masterMetricsEngine = {
  async getSeries(nodeId: string) {
    const details = await loadNodeDetails(nodeId);
    return details.metricsSeries;
  },
};
