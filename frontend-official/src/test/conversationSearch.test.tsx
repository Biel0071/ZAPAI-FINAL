import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConversationSearch } from "@/pages/Inbox/hooks/useInboxState";
import * as inboxHooks from "@/pages/Inbox/hooks/useInboxState";
import { apiService, type Conversation } from "@/core/services/apiService";
import { useAppStore } from "@/state/stores/appStore";
import { MemoryRouter } from "react-router-dom";
import Inbox from "@/pages/Inbox";

vi.mock("@/core/services/apiService", () => ({ apiService: { getConversations: vi.fn() }, requestApiEndpoint: vi.fn() }));
vi.mock("@/state/providers/RuntimeProvider", () => ({ useRuntime: vi.fn() }));
vi.mock("@/pages/Inbox/hooks/useInboxSocket", () => ({ useInboxSocket: vi.fn() }));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/pages/lovable/pages/InboxPageView", () => ({ default: ({ leftPanel }: { leftPanel: React.ReactNode }) => leftPanel }));
vi.mock("@/pages/Inbox/components/ChatListPanel", () => ({ ChatListPanel: ({ filteredConversations }: { filteredConversations: Conversation[] }) => <ul>{filteredConversations.map(row => <li key={row.id}>{row.contactName}</li>)}</ul> }));
vi.mock("@/pages/Inbox/components/ActiveChatPane", () => ({ ActiveChatPane: () => null }));
vi.mock("@/pages/Inbox/components/SidebarPanel", () => ({ SidebarPanel: () => null }));

const conversation = (id: string) => ({ id, contactName: id, phone: "7167", lastMessage: "", updatedAt: "2026-09-30T00:00:00Z" }) as Conversation;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
function renderHook<P, R>(callback: (props: P) => R, { initialProps }: { initialProps: P }) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const result = {} as { current: R };
  function Harness({ props }: { props: P }) { result.current = callback(props); return null; }
  const rerender = (props: P) => act(() => root!.render(<Harness props={props} />));
  rerender(initialProps);
  return { result, rerender };
}
beforeEach(() => { vi.useFakeTimers(); vi.mocked(apiService.getConversations).mockReset(); useAppStore.setState({ activeSessionId: "main" }); });
afterEach(() => { if (root) act(() => root!.unmount()); root = undefined; document.body.innerHTML = ""; vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Inbox server search", () => {
  it("debounces typing and searches the selected session, including conversations absent from the first page", async () => {
    const onResults = vi.fn();
    vi.mocked(apiService.getConversations).mockResolvedValue([conversation("older-match")]);
    const { result, rerender } = renderHook(({ query }) => useConversationSearch(query, onResults), { initialProps: { query: "71" } });
    rerender({ query: "7167" });
    expect(result.current.loading).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(apiService.getConversations).toHaveBeenCalledOnce();
    expect(apiService.getConversations).toHaveBeenCalledWith(true, { limit: 50, sessionId: "main", search: "7167" });
    expect(onResults).toHaveBeenCalledWith([conversation("older-match")]);
    expect(result.current.loading).toBe(false);
  });

  it("ignores delayed responses from previous terms or sessions", async () => {
    const pending: Array<(rows: Conversation[]) => void> = [];
    vi.mocked(apiService.getConversations).mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    const onResults = vi.fn();
    const { rerender } = renderHook(({ query }) => useConversationSearch(query, onResults), { initialProps: { query: "old" } });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    act(() => useAppStore.getState().setActiveSessionId("other"));
    rerender({ query: "new" });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    await act(async () => pending[1]([conversation("new-match")]));
    await act(async () => pending[0]([conversation("stale-match")]));
    expect(onResults).toHaveBeenCalledOnce();
    expect(onResults).toHaveBeenCalledWith([conversation("new-match")]);
  });

  it("shows a failed search, retries it, and cancels results after clearing the field", async () => {
    const onResults = vi.fn();
    vi.mocked(apiService.getConversations).mockRejectedValueOnce(new Error("offline"));
    const { result, rerender } = renderHook(({ query }) => useConversationSearch(query, onResults), { initialProps: { query: "7167" } });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(result.current.failed).toBe(true);
    let resolve!: (rows: Conversation[]) => void;
    vi.mocked(apiService.getConversations).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    act(() => result.current.retry());
    await act(async () => vi.advanceTimersByTimeAsync(300));
    rerender({ query: "" });
    await act(async () => resolve([conversation("cancelled-match")]));
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(false);
    expect(onResults).not.toHaveBeenCalled();
  });

  it("searches all tenant connections when Todas is selected, without preferring the open chat's connection", async () => {
    useAppStore.setState({ activeSessionId: null, activeConversationId: "main-chat" });
    const rows = [{ ...conversation("main-result"), sessionId: "main" }, { ...conversation("other-result"), sessionId: "other" }];
    const onResults = vi.fn();
    vi.mocked(apiService.getConversations).mockResolvedValue(rows);
    renderHook(() => useConversationSearch("7167", onResults), { initialProps: undefined });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(apiService.getConversations).toHaveBeenCalledWith(true, { limit: 50, sessionId: undefined, search: "7167" });
    expect(onResults).toHaveBeenCalledWith(rows);
  });

  it("uses the filter connection even when a chat from another connection remains open", async () => {
    useAppStore.setState({ activeSessionId: "other", activeConversationId: "main-chat" });
    const ownResult = { ...conversation("other-result"), sessionId: "other" };
    const onResults = vi.fn();
    vi.mocked(apiService.getConversations).mockResolvedValue([ownResult, { ...conversation("foreign-result"), sessionId: "main" }]);
    renderHook(() => useConversationSearch("7167", onResults), { initialProps: undefined });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(apiService.getConversations).toHaveBeenCalledWith(true, { limit: 50, sessionId: "other", search: "7167" });
    expect(onResults).toHaveBeenCalledWith([ownResult]);
  });
});

describe("Inbox archived search", () => {
  it("applies the search term to archived conversations instead of returning every archive", () => {
    const matches = { ...conversation("matching"), contactName: "7167 arquivado", status: "archived", sessionId: "main" };
    const unrelated = { ...conversation("unrelated"), contactName: "Outro contato", phone: "1111", status: "archived", sessionId: "main" };
    const open = { ...conversation("open"), contactName: "7167 aberto", status: "open", sessionId: "main" };
    vi.spyOn(inboxHooks, "useInboxState").mockReturnValue({
      conversations: [matches, unrelated, open], selectedConversation: null, messages: [], quickReplies: [], qrDialogItems: [],
      searchQuery: "7167", filter: "archived", archivedChatIds: [], pinnedChatIds: [], selectedChatIds: [],
      draftsByConversationId: {}, conversationControls: {}, aiRuntime: { globalEnabled: false }, messageInputRef: { current: null },
      isQuickReplyDialogOpen: false,
    } as unknown as ReturnType<typeof inboxHooks.useInboxState>);
    const container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    act(() => root!.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Inbox /></MemoryRouter>));
    expect([...document.querySelectorAll("li")].map(row => row.textContent)).toEqual(["7167 arquivado"]);
  });
});
