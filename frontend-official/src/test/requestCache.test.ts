import { describe, expect, it } from "vitest";

import { getCache, invalidateCache, setCache } from "@/lib/requestCache";

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
});
