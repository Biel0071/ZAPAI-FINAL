import { loadNodeDetails } from "@/services/masterNodeService";

export const masterDiagnosticsEngine = {
  async checks(nodeId: string) {
    const details = await loadNodeDetails(nodeId);
    return details.diagnostics;
  },
};
