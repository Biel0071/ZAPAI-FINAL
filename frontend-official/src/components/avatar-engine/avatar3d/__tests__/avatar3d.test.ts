import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { resolveAvatarLook3D } from "../look3d";
import { buildChibi } from "../buildChibi";

function names(root: THREE.Object3D): string[] {
  const result: string[] = [];
  root.traverse((node) => result.push(node.name));
  return result;
}

const base = { agentId: "camila", body: "female", hair: "hair_01", outfit: "outfit_01", accessories: [] } as any;

describe("resolveAvatarLook3D", () => {
  it("maps catalog ids to 3D parts", () => {
    const look = resolveAvatarLook3D({ ...base, hair: "hair_13", outfit: "outfit_06", accessories: ["acc_02", "acc_05"] });
    expect(look.hairStyle).toBe("long");
    expect(look.headwear).toBe("hardhat");
    expect(look.outfit.kind).toBe("vest");
    expect(look.accessories.headset).toBe(true);
    expect(look.accessories.tablet).toBe(true);
  });

  it("keeps male and beard choices", () => {
    const look = resolveAvatarLook3D({ ...base, body: "male", base: "male", hair: "hair_16" });
    expect(look.female).toBe(false);
    expect(look.beard).toBe(true);
  });

  it("falls back to a valid style for unknown ids", () => {
    const look = resolveAvatarLook3D({ ...base, hair: "unknown", outfit: "unknown" });
    expect(look.hairStyle).toBe("ponytail");
    expect(look.outfit.kind).toBe("polo");
  });
});

describe("buildChibi", () => {
  it("builds exactly one character with rig, hair, outfit and requested accessories", () => {
    const chibi = buildChibi(resolveAvatarLook3D({ ...base, accessories: ["acc_02", "acc_04", "acc_05"] }));
    const parts = names(chibi.rig.root);
    expect(parts.filter((name) => name === "head-skin")).toHaveLength(1);
    expect(parts.filter((name) => name === "torso")).toHaveLength(1);
    expect(parts).toEqual(expect.arrayContaining(["hair-ponytail-0", "outfit-polo", "acc-headset", "acc-glasses", "acc-tablet", "arm-left", "leg-right"]));
    expect(chibi.hold.left).toBe(true);
    chibi.dispose();
  });

  it("swaps only the hair group when the hair changes", () => {
    const a = names(buildChibi(resolveAvatarLook3D({ ...base, hair: "hair_01" })).rig.root);
    const b = names(buildChibi(resolveAvatarLook3D({ ...base, hair: "hair_04" })).rig.root);
    const nonHair = (list: string[]) => list.filter((name) => !name.startsWith("hair"));
    expect(nonHair(a)).toEqual(nonHair(b));
    expect(b).toContain("hair-bun");
    expect(b.some((name) => name.startsWith("hair-ponytail"))).toBe(false);
  });

  it("hides top hair details under headwear", () => {
    const parts = names(buildChibi(resolveAvatarLook3D({ ...base, hair: "hair_04", accessories: ["acc_12"] })).rig.root);
    expect(parts).toContain("headwear-hardhat");
    expect(parts).not.toContain("hair-bun");
  });

  it("puts every outfit on the same body", () => {
    for (const outfit of ["outfit_01", "outfit_02", "outfit_03", "outfit_04", "outfit_05", "outfit_06", "outfit_07", "outfit_08", "outfit_09", "outfit_10"]) {
      const parts = names(buildChibi(resolveAvatarLook3D({ ...base, outfit })).rig.root);
      expect(parts.filter((name) => name === "torso")).toHaveLength(1);
      expect(parts.some((name) => name.startsWith("outfit-"))).toBe(true);
    }
  });
});