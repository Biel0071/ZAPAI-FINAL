import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CompanyEntitlementGate } from "@/components/auth/CompanyEntitlementGate";

const { getCompanyEntitlements } = vi.hoisted(() => ({
  getCompanyEntitlements: vi.fn(),
}));

vi.mock("@/core/services/apiService", () => ({
  apiService: { getCompanyEntitlements },
}));

vi.mock("@/core/lib/adminAuthSession", () => ({
  loadAdminAuthSession: () => null,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("CompanyEntitlementGate", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getCompanyEntitlements.mockResolvedValue({ legacyAccess: false, modules: ["inbox"] });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("validates access through the centralized API client before rendering the authorized page", async () => {
    await act(async () => {
      root.render(
        <CompanyEntitlementGate module="inbox">
          <div>Inbox carregado</div>
        </CompanyEntitlementGate>,
      );
    });

    expect(getCompanyEntitlements).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Inbox carregado");
  });
});
