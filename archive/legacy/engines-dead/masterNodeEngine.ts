import { loadNodeDetails, loadNodesControlPlane } from "@/services/masterNodeService";

export const masterNodeEngine = {
  async getCluster() {
    return loadNodesControlPlane();
  },

  async getNode(nodeId: string) {
    return loadNodeDetails(nodeId);
  },
};
