import { loadNodeDetails, runDeployAction, type DeployAction } from "@/services/masterNodeService";

export const masterDeployEngine = {
  async list(nodeId: string) {
    const details = await loadNodeDetails(nodeId);
    return details.deployments;
  },

  async run(nodeId: string, action: DeployAction) {
    await runDeployAction(nodeId, action);
  },
};
