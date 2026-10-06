import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@/core/services/apiService";

const transport = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({
  default: { create: () => ({ request: transport, interceptors: { response: { use: vi.fn() } } }) },
  isAxiosError: () => false,
}));
vi.mock("@/core/lib/backendConfig", () => ({ API_BASE_URL: "http://localhost:4025", API_ORIGIN: "http://localhost:4025" }));
vi.mock("@/core/lib/apiGuard", () => ({ buildApiHeaders: async () => ({ Authorization: "Bearer test-token" }) }));

beforeEach(() => {
  transport.mockReset();
  transport.mockResolvedValue({ status: 200, data: [] });
});

describe("timestamps in inbox messages", () => {
  it("keeps the WhatsApp event time separate from the database arrival time", async () => {
    transport.mockResolvedValueOnce({ status: 200, data: [{
      id: "message-1",
      created_at: "2026-10-06T12:00:05.000Z",
      timestamp: "2026-10-01T09:30:00.000Z",
    }] });

    const [message] = await apiService.getMessages("conversation-1");

    expect(message.timestamp).toBe("2026-10-01T09:30:00.000Z");
    expect(message.createdAt).toBe("2026-10-06T12:00:05.000Z");
  });

  it("does not fabricate a timestamp when the backend has none", async () => {
    transport.mockResolvedValueOnce({ status: 200, data: [{ id: "message-2" }] });

    const [message] = await apiService.getMessages("conversation-1");

    expect(message.timestamp).toBeUndefined();
    expect(message.createdAt).toBe("");
  });
});
