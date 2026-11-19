import { aggregateCluster } from "@/core/services/masterNodeService";
import type { NodeControlPlane } from "@/core/types/masterNode";

describe("master node metrics", () => {
  it("keeps unavailable measurements distinct from measured zero values", () => {
    const unknownNode = {
      status: "UNKNOWN",
      health: "unknown",
      whatsappSessions: null,
      metrics: null,
    } as NodeControlPlane;

    const unavailable = aggregateCluster([unknownNode], {});
    expect(unavailable.onlineNodes).toBeNull();
    expect(unavailable.totalSessions).toBeNull();
    expect(unavailable.totalMessages).toBeNull();
    expect(unavailable.queueSize).toBeNull();
    expect(unavailable.unhealthyNodes).toBeNull();
    expect(unavailable.redisUsageMb).toBeNull();
    expect(unavailable.postgresUsageMb).toBeNull();

    const measuredZero = aggregateCluster([], { totalMessages: 0, websocketConnections: 0 });
    expect(measuredZero.totalMessages).toBe(0);
    expect(measuredZero.websocketConnections).toBe(0);

    const explicitNull = aggregateCluster([], { totalMessages: null, websocketConnections: null });
    expect(explicitNull.totalMessages).toBeNull();
    expect(explicitNull.websocketConnections).toBeNull();
  });
});
