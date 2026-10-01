import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@/core/services/apiService";
import { clearAdminAuthSession, loadAdminAuthSession, persistAdminAuthSession } from "@/core/lib/adminAuthSession";

const transport = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({ default: { create: () => ({ request: transport, interceptors: { response: { use: vi.fn() } } }), isAxiosError: () => false } }));
vi.mock("@/core/lib/backendConfig", () => ({ API_BASE_URL: "http://localhost:4025", API_ORIGIN: "http://localhost:4025" }));
vi.mock("@/core/runtime/services/frontendHealthService", () => ({ reportFrontendIssue: vi.fn() }));
vi.mock("@/core/runtime/logs/structuredLogger", () => ({ slog: { info: vi.fn(), warn: vi.fn(), apiRequest: vi.fn() } }));
vi.mock("@/core/services/notifyService", () => ({ notify: { error: vi.fn() } }));

const options = { sessionId: "main", search: "7167", limit: 50 };
const row = (id: string) => ({ id, phone: "5531993807167", contactName: id, lastMessage: "", updatedAt: "2026-10-01T10:00:00Z", sessionId: "main" });
const response = (id: string) => ({ status: 200, data: [row(id)] });
function login(tenantId: string, username = "operator") {
  persistAdminAuthSession({ token: `test-token-${tenantId}-${username}`, username, tenantId, role: "user", issuedAt: Date.now(), expiresAt: Date.now() + 60_000, remember: false });
}
beforeEach(() => { transport.mockReset(); clearAdminAuthSession(); login("tenant-a"); });
afterEach(() => clearAdminAuthSession());

describe("API authentication scope", () => {
  it("does not return a previous tenant's conversation cache after changing login in the same tab", async () => {
    transport.mockResolvedValueOnce(response("tenant-a-result")).mockResolvedValueOnce(response("tenant-b-result"));
    expect((await apiService.getConversations(false, options))[0].id).toBe("tenant-a-result");
    login("tenant-b");
    expect((await apiService.getConversations(false, options))[0].id).toBe("tenant-b-result");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1][0].headers["x-tenant-id"]).toBe("tenant-b");
  });

  it("starts a separate request for a new tenant and rejects a delayed response from the old login", async () => {
    const pending: Array<(value: ReturnType<typeof response>) => void> = [];
    transport.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    const previous = apiService.getConversations(true, options).then(value => value, error => error);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    const previousSignal = transport.mock.calls[0][0].signal as AbortSignal;
    login("tenant-b");
    const current = apiService.getConversations(true, options);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    expect(previousSignal?.aborted).toBe(true);
    pending[0](response("stale-a-result"));
    expect(await previous).toMatchObject({ code: "AUTH_SESSION_CHANGED" });
    pending[1](response("current-b-result"));
    expect((await current)[0].id).toBe("current-b-result");
    expect((await apiService.getConversations(false, options))[0].id).toBe("current-b-result");
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("does not let a late 401 from an old request sign out the new user", async () => {
    let finish!: (value: { status: number; data: unknown }) => void;
    transport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const previous = apiService.getConversations(true, options).then(value => value, error => error);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    login("tenant-b");
    finish({ status: 401, data: { error: "Expired old login" } });
    expect(await previous).toMatchObject({ code: "AUTH_SESSION_CHANGED" });
    expect(loadAdminAuthSession()?.tenantId).toBe("tenant-b");
  });

  it("keeps the short agent-response cache scoped to the current login", async () => {
    transport.mockResolvedValueOnce({ status: 200, data: { success: true, agents: [{ name: "Agent A" }] } })
      .mockResolvedValueOnce({ status: 200, data: { success: true, agents: [{ name: "Agent B" }] } });
    expect((await apiService.getAIAgents()).agents[0].name).toBe("Agent A");
    login("tenant-b");
    expect((await apiService.getAIAgents()).agents[0].name).toBe("Agent B");
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("does not deduplicate pending requests across different logins in the same tenant", async () => {
    const pending: Array<(value: ReturnType<typeof response>) => void> = [];
    transport.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    const previous = apiService.getConversations(true, options).then(value => value, error => error);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    login("tenant-a", "another-user");
    const current = apiService.getConversations(true, options);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    pending[0](response("previous-user-result"));
    expect(await previous).toMatchObject({ code: "AUTH_SESSION_CHANGED" });
    pending[1](response("current-user-result"));
    expect((await current)[0].id).toBe("current-user-result");
  });
});
