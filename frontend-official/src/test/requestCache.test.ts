import { afterEach, describe, expect, it } from "vitest";

import { getCache, getRequestAuthScope, invalidateCache, setCache } from "@/core/lib/requestCache";
import { clearAdminAuthSession, persistAdminAuthSession } from "@/core/lib/adminAuthSession";

afterEach(() => clearAdminAuthSession());

describe("requestCache", () => {
  it("invalidates a cache key and all of its parameterized variants", () => {
    setCache("conversations", ["base"], 60_000);
    setCache("conversations:limit:20:session:main", ["main"], 60_000);
    setCache("messages:conversation:1", ["message"], 60_000);

    invalidateCache("conversations");

    expect(getCache("conversations")).toBeNull();
    expect(getCache("conversations:limit:20:session:main")).toBeNull();
    expect(getCache("messages:conversation:1")).toEqual(["message"]);
  });

  it("rejects a late cache write captured before an authentication change", () => {
    const scope = getRequestAuthScope();
    persistAdminAuthSession({ token: "test-token", username: "operator", role: "user", tenantId: "tenant-b", issuedAt: Date.now(), expiresAt: Date.now() + 60_000, remember: false });
    expect(() => setCache("conversations", ["old-user-data"], 60_000, scope)).toThrow("sessão de acesso mudou");
    expect(getCache("conversations")).toBeNull();
  });
});
