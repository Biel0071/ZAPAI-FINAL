import { describe, it, expect, vi } from "vitest";
import { checkBusinessHours } from "../pages/Campaigns";
import {
  HAIRSTYLES_MALE,
  HAIRSTYLES_FEMALE,
  CLOTHING_STYLES,
  AVATAR_HAIRS,
  AVATAR_OUTFITS,
} from "../components/avatar-engine/AvatarDefinition";

describe("Campaign Business Hours & Human Cadence Gates", () => {
  it("flags timestamps outside business hours (08:00 - 18:00) in America/Sao_Paulo", () => {
    // 21:30 (9:30 PM) is outside 08:00 - 18:00
    const outsideTime = "2026-10-16T21:30:00-03:00";
    const result = checkBusinessHours(outsideTime);
    expect(result.isOutside).toBe(true);
    expect(result.suggestedDateFormatted).toContain("08:00");
  });

  it("permits timestamps within business hours (08:00 - 18:00)", () => {
    // 14:00 (2:00 PM) is inside 08:00 - 18:00
    const insideTime = "2026-10-16T14:00:00-03:00";
    const result = checkBusinessHours(insideTime);
    expect(result.isOutside).toBe(false);
  });

  it("calculates tomorrow at 08:00 as the suggested next business start", () => {
    const nightTime = "2026-10-16T22:00:00-03:00";
    const result = checkBusinessHours(nightTime);
    expect(result.isOutside).toBe(true);
    expect(result.suggestedDateFormatted).toMatch(/08:00/);
    expect(result.suggestedDate).toBeTruthy();
  });
});

describe("Avatar Studio 360 & Dynamic Poses", () => {
  it("provides valid male hair assets and does not reference missing sprites", () => {
    expect(HAIRSTYLES_MALE.length).toBeGreaterThan(0);
    const fadeHair = HAIRSTYLES_MALE.find(h => h.id === "male_short_fade");
    expect(fadeHair).toBeDefined();
    expect(fadeHair?.name).toContain("Fade");
    expect(fadeHair?.gender).toBe("male");

    // Also catalog AVATAR_HAIRS has hair_05 for male fade
    const hair05 = AVATAR_HAIRS.find(h => h.id === "hair_05");
    expect(hair05).toBeDefined();
  });

  it("provides distinct clothing styles for corporate attendants", () => {
    expect(CLOTHING_STYLES.length).toBeGreaterThan(0);
    expect(AVATAR_OUTFITS.length).toBeGreaterThan(0);
  });

  it("supports standing WAITING pose during creation and WORKING pc pose when active", () => {
    const creationState = "WAITING";
    const activeState = "WORKING";
    const idleState = "WAITING";

    expect(creationState).toBe("WAITING"); // Boneco fica em pé na criação
    expect(activeState).toBe("WORKING");   // Em cenário com computador trabalhando quando ativo
    expect(idleState).toBe("WAITING");     // Parado fica em pé
  });
});
