export type FlowItem = {
  id: string;
  name: string;
  trigger: string;
  response: string;
  nextSteps: string[];
};

export type FlowsLovableViewModel = {
  totalFlows: number;
  dataSourceLabel: string;
  stateLabel: string;
};

export function createFlowsLovableViewModel(params: {
  flows: FlowItem[];
  loading: boolean;
}): FlowsLovableViewModel {
  const { flows, loading } = params;

  return {
    totalFlows: flows.length,
    dataSourceLabel: "API",
    stateLabel: loading ? "Sync" : "OK",
  };
}
