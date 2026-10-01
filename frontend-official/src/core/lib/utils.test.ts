import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUuid } from "./utils";

afterEach(() => vi.unstubAllGlobals());

describe("generateUuid", () => {
  it("uses the native secure UUID when available", () => {
    const randomUUID = vi.fn(() => "123e4567-e89b-42d3-a456-426614174000");
    vi.stubGlobal("crypto", { randomUUID });
    expect(generateUuid()).toBe("123e4567-e89b-42d3-a456-426614174000");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("creates distinct RFC 4122 UUIDs using getRandomValues on HTTP without randomUUID", () => {
    let sequence = 0;
    const cryptoMock = {
      getRandomValues(bytes: Uint8Array) {
        expect(this).toBe(cryptoMock);
        bytes.fill(++sequence);
        return bytes;
      },
    };
    vi.stubGlobal("crypto", cryptoMock);
    const first = generateUuid();
    const second = generateUuid();
    expect(first).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
    expect(second).not.toBe(first);
  });

  it("does not silently use weak randomness when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => generateUuid()).toThrow("geração segura");
  });
});
