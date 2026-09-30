import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { authorizeMediaUrl, clearMediaAccessCache, resolveMediaUrl } from "@/core/runtime/utils/inboxNormalization";
import { persistAdminAuthSession, clearAdminAuthSession } from "@/core/lib/adminAuthSession";

const signIn = (tenantId = "a", token = "private-login-token") => persistAdminAuthSession({ tenantId, token, username: "tester", role: "user", issuedAt: Date.now(), expiresAt: Date.now() + 3_600_000, remember: true });

beforeEach(() => { clearAdminAuthSession(); clearMediaAccessCache(); });
afterEach(() => { vi.unstubAllGlobals(); clearAdminAuthSession(); clearMediaAccessCache(); });

describe("protected media access", () => {
  it("removes old JWT query values and never appends the session token", () => {
    signIn();
    expect(resolveMediaUrl("/media/a/images/photo.jpg?token=old-secret")).not.toContain("token=");
    expect(resolveMediaUrl("C:\\app\\uploads\\old.pdf")).toContain("/uploads/old.pdf");
    expect(resolveMediaUrl("/media/a/images/photo.jpg")).not.toContain("private-login-token");
  });

  it("authorizes using a header, reuses current links and renews links before expiry", async () => {
    signIn();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "/media/a/images/photo.jpg?access=limited", expiresAt: Date.now() + 900_000 }) });
    vi.stubGlobal("fetch", fetcher);
    const first = await authorizeMediaUrl("/media/a/images/photo.jpg");
    expect(first?.url).toContain("access=limited");
    expect(first?.url).not.toContain("private-login-token");
    const request = fetcher.mock.calls[0][1];
    expect(request.headers.Authorization).toBe("Bearer private-login-token");
    expect(JSON.parse(request.body)).toEqual({ path: "/media/a/images/photo.jpg" });
    await authorizeMediaUrl("/media/a/images/photo.jpg");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await authorizeMediaUrl("/media/a/images/photo.jpg", true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("clears authorization across account switches and fails closed on rejection", async () => {
    signIn("a", "token-a");
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: { url: "/media/a/photo.jpg?access=limited", expiresAt: Date.now() + 900_000 } }) }).mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetcher);
    expect(await authorizeMediaUrl("/media/a/photo.jpg")).not.toBeNull();
    signIn("b", "token-b");
    expect(await authorizeMediaUrl("/media/a/photo.jpg")).toBeNull();
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe("Bearer token-b");
    clearAdminAuthSession();
    expect(await authorizeMediaUrl("/media/a/photo.jpg")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("leaves local drafts and external avatars usable without sending login credentials", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await authorizeMediaUrl("blob:local-draft"))?.url).toBe("blob:local-draft");
    expect((await authorizeMediaUrl("https://example.com/avatar.jpg"))?.url).toBe("https://example.com/avatar.jpg");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
