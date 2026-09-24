import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  useIsMobile,
  useViewMode,
  setViewMode,
  getViewMode,
  VIEW_MODE_STORAGE_KEY,
  VIEW_MODE_CHANGE_EVENT,
} from "@/hooks/use-mobile";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useAppStore } from "@/stores/appStore";

// Mock in-memory localStorage for Node test runner
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storageMap.set(key, String(value))),
  removeItem: vi.fn((key: string) => storageMap.delete(key)),
  clear: vi.fn(() => storageMap.clear()),
};

vi.stubGlobal("localStorage", localStorageMock);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function HookTester({ onResult }: { onResult?: (values: any) => void }) {
  const isMobile = useIsMobile();
  const [viewMode, setMode] = useViewMode();

  useEffect(() => {
    onResult?.({ isMobile, viewMode, setMode });
  }, [isMobile, viewMode, setMode, onResult]);

  return (
    <div
      id="hook-info"
      data-mode={viewMode}
      data-mobile={String(isMobile)}
    />
  );
}

beforeEach(() => {
  storageMap.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    useAppStore.setState({
      activeConversationId: null,
      conversations: [],
    });
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  if (container) {
    container.remove();
  }
  document.body.innerHTML = "";
  storageMap.clear();
  vi.clearAllMocks();
});

describe("Mobile App Interface & Mode Switcher", () => {
  describe("useViewMode & useIsMobile Hook", () => {
    it("defaults to auto mode", async () => {
      await act(async () => {
        root!.render(<HookTester />);
      });

      const el = document.getElementById("hook-info");
      expect(el?.getAttribute("data-mode")).toBe("auto");
      expect(getViewMode()).toBe("auto");
    });

    it("forces mobile mode when setViewMode('mobile') is called", async () => {
      await act(async () => {
        root!.render(<HookTester />);
      });

      await act(async () => {
        setViewMode("mobile");
      });

      const el = document.getElementById("hook-info");
      expect(el?.getAttribute("data-mode")).toBe("mobile");
      expect(el?.getAttribute("data-mobile")).toBe("true");
      expect(storageMap.get(VIEW_MODE_STORAGE_KEY)).toBe("mobile");
      expect(getViewMode()).toBe("mobile");
    });

    it("forces desktop mode when setViewMode('desktop') is called", async () => {
      await act(async () => {
        root!.render(<HookTester />);
      });

      await act(async () => {
        setViewMode("desktop");
      });

      const el = document.getElementById("hook-info");
      expect(el?.getAttribute("data-mode")).toBe("desktop");
      expect(el?.getAttribute("data-mobile")).toBe("false");
      expect(storageMap.get(VIEW_MODE_STORAGE_KEY)).toBe("desktop");
      expect(getViewMode()).toBe("desktop");
    });

    it("dispatches VIEW_MODE_CHANGE_EVENT on setViewMode", () => {
      const spyListener = vi.fn();
      window.addEventListener(VIEW_MODE_CHANGE_EVENT, spyListener);

      act(() => {
        setViewMode("mobile");
      });

      expect(spyListener).toHaveBeenCalled();
      window.removeEventListener(VIEW_MODE_CHANGE_EVENT, spyListener);
    });
  });

  describe("MobileBottomNav Component", () => {
    it("renders all 6 navigation tabs when in mobile mode", async () => {
      act(() => {
        setViewMode("mobile");
      });

      await act(async () => {
        root!.render(
          <MemoryRouter initialEntries={["/dashboard"]}>
            <MobileBottomNav />
          </MemoryRouter>
        );
      });

      expect(document.body.textContent).toContain("Inbox");
      expect(document.body.textContent).toContain("Contatos");
      expect(document.body.textContent).toContain("Campanhas");
      expect(document.body.textContent).toContain("Painel");
      expect(document.body.textContent).toContain("IA");
      expect(document.body.textContent).toContain("Mais");
    });

    it("does not render when in desktop mode", async () => {
      act(() => {
        setViewMode("desktop");
      });

      await act(async () => {
        root!.render(
          <MemoryRouter initialEntries={["/dashboard"]}>
            <MobileBottomNav />
          </MemoryRouter>
        );
      });

      const nav = document.querySelector("nav[aria-label='Navegação móvel']");
      expect(nav).toBeNull();
    });

    it("displays unread count badge for Inbox tab", async () => {
      act(() => {
        setViewMode("mobile");
        useAppStore.setState({
          conversations: [
            { id: "conv-1", unreadCount: 3, contactName: "Cliente 1" } as any,
            { id: "conv-2", unreadCount: 2, contactName: "Cliente 2" } as any,
          ],
        });
      });

      await act(async () => {
        root!.render(
          <MemoryRouter initialEntries={["/dashboard"]}>
            <MobileBottomNav />
          </MemoryRouter>
        );
      });

      // Total unread = 5
      expect(document.body.textContent).toContain("5");
    });

    it("remains visible in /inbox when viewing the conversation list", async () => {
      act(() => {
        setViewMode("mobile");
        useAppStore.setState({
          activeConversationId: "conv-1",
          isMobileChatOpen: false,
          conversations: [{ id: "conv-1", contactName: "Cliente 1" } as any],
        });
      });

      await act(async () => {
        root!.render(
          <MemoryRouter initialEntries={["/inbox"]}>
            <MobileBottomNav />
          </MemoryRouter>
        );
      });

      const nav = document.querySelector("nav[aria-label='Navegação móvel']");
      expect(nav).not.toBeNull();
      expect(document.body.textContent).toContain("Inbox");
    });

    it("hides when an active conversation chat pane is open in /inbox", async () => {
      act(() => {
        setViewMode("mobile");
        useAppStore.setState({
          activeConversationId: "conv-1",
          isMobileChatOpen: true,
        });
      });

      await act(async () => {
        root!.render(
          <MemoryRouter initialEntries={["/inbox"]}>
            <MobileBottomNav />
          </MemoryRouter>
        );
      });

      const nav = document.querySelector("nav[aria-label='Navegação móvel']");
      expect(nav).toBeNull();
    });

    it("dispatches zapflow:open-mobile-menu when Mais button is clicked", async () => {
      act(() => {
        setViewMode("mobile");
      });

      const menuSpy = vi.fn();
      window.addEventListener("zapflow:open-mobile-menu", menuSpy);

      await act(async () => {
        root!.render(
          <MemoryRouter initialEntries={["/dashboard"]}>
            <MobileBottomNav />
          </MemoryRouter>
        );
      });

      const buttons = Array.from(document.querySelectorAll("button"));
      const maisButton = buttons.find((b) => b.textContent?.includes("Mais"));
      expect(maisButton).toBeDefined();

      await act(async () => {
        maisButton!.click();
      });

      expect(menuSpy).toHaveBeenCalledTimes(1);
      window.removeEventListener("zapflow:open-mobile-menu", menuSpy);
    });
  });

  describe("usePwaInstall Hook", () => {
    it("handles beforeinstallprompt event and triggers installation", async () => {
      const { usePwaInstall } = await import("@/hooks/usePwaInstall");

      let hookResult: any;
      function PwaTester() {
        hookResult = usePwaInstall();
        return null;
      }

      await act(async () => {
        root!.render(<PwaTester />);
      });

      expect(hookResult.hasPrompt).toBe(false);

      // Simulate browser beforeinstallprompt
      const promptMock = vi.fn().mockResolvedValue(undefined);
      const fakeEvent = new Event("beforeinstallprompt") as any;
      fakeEvent.prompt = promptMock;
      fakeEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

      await act(async () => {
        window.dispatchEvent(fakeEvent);
      });

      expect(hookResult.canInstall).toBe(true);
      expect(hookResult.hasPrompt).toBe(true);

      let outcome: string | undefined;
      await act(async () => {
        outcome = await hookResult.promptInstall();
      });

      expect(promptMock).toHaveBeenCalled();
      expect(outcome).toBe("accepted");
      expect(hookResult.isInstalled).toBe(true);
    });
  });
});
