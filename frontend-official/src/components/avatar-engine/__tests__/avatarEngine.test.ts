import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import * as characterFactory from "../CharacterFactory";
import { AvatarEditorModal } from "../AvatarEditorModal";
import { ZaiAvatarRenderer } from "../ZaiAvatarRenderer";
import { normalizeAgentToIdentity } from "../../ai/workspace/AgentIdentity";
import { AgentWorkspace } from "../../ai/workspace/AgentWorkspace";
import {
  buildStoreVisualDNA,
  createAgentAvatar,
  equipItem,
  unequipItem,
  randomizeAvatar,
  resolveSpriteForAvatar,
} from "../CharacterFactory";
import {
  StoreVisualDNA,
  DEFAULT_AVATAR_PRESETS,
} from "../AvatarDefinition";

describe("ZAI Avatar Engine — Modular Character Factory & Store DNA", () => {
  const mockStore = {
    id: "store-vista-alegre",
    name: "Depósito Vista Alegre",
    theme_color: "#10b981",
    settings: {
      storeVisualDNA: {
        storeId: "store-vista-alegre",
        storeName: "Depósito Vista Alegre",
        primaryColor: "#10b981",
        secondaryColor: "#0f172a",
        accentColor: "#00f090",
        logo: "VISTA",
        defaultClothing: "polo_zai_black",
        defaultAccessories: ["headset_zai_green", "badge_zai_lanyard"],
        defaultBadge: true,
        defaultShoes: "sneakers_zai_green",
        visualStyle: "pixel_isometric",
      },
    },
  };

  it("buildStoreVisualDNA correctly retrieves or infers store DNA", () => {
    const dna = buildStoreVisualDNA(mockStore);
    expect(dna.storeId).toBe("store-vista-alegre");
    expect(dna.storeName).toBe("Depósito Vista Alegre");
    expect(dna.primaryColor).toBe("#10b981");
    expect(dna.logo).toBe("VISTA");
    expect(dna.defaultClothing).toBe("polo_zai_black");
  });

  it("creates an agent inheriting the store DNA without losing individual traits", () => {
    const storeDNA = buildStoreVisualDNA(mockStore);
    const camila = createAgentAvatar({
      agentId: "camila",
      name: "Camila",
      role: "Vendas",
      storeId: mockStore.id,
      storeDNA,
      gender: "female",
    });

    expect(camila.storeId).toBe("store-vista-alegre");
    expect(camila.branding.storeName).toBe("Depósito Vista Alegre");
    expect(camila.branding.logo).toBe("VISTA");
    expect(camila.branding.primaryColor).toBe("#10b981");
    expect(camila.clothing).toBe("polo_zai_black");
    expect(camila.badge).toBe(true);
    expect(camila.body).toBe("female");
    expect(camila.catalogSpriteId).toBeDefined();
  });

  it("guarantees that two agents from the same store are not clones", () => {
    const storeDNA = buildStoreVisualDNA(mockStore);

    const camila = createAgentAvatar({
      agentId: "camila",
      name: "Camila",
      role: "Vendas",
      storeId: mockStore.id,
      storeDNA,
      gender: "female",
    });

    const rafael = createAgentAvatar({
      agentId: "rafael",
      name: "Rafael",
      role: "Suporte Técnico",
      storeId: mockStore.id,
      storeDNA,
      gender: "male",
      individualOverrides: {
        glasses: "glasses_round_black",
        workObject: "tablet_zai",
      },
    });

    // Both share store branding & uniform
    expect(camila.branding.primaryColor).toBe(rafael.branding.primaryColor);
    expect(camila.branding.storeName).toBe(rafael.branding.storeName);
    expect(camila.clothing).toBe(rafael.clothing);

    // But they have distinct individual identities (not clones)
    expect(camila.body).not.toBe(rafael.body);
    expect(camila.hair).not.toBe(rafael.hair);
    expect(camila.glasses).not.toBe(rafael.glasses);
    expect(camila.catalogSpriteId).not.toBe(rafael.catalogSpriteId);
  });

  it("equips and unequips items immutably", () => {
    const storeDNA = buildStoreVisualDNA(mockStore);
    const avatar = createAgentAvatar({
      agentId: "test-agent",
      name: "Test",
      storeId: mockStore.id,
      storeDNA,
      gender: "female",
    });

    // Equip glasses
    const equipped = equipItem(avatar, "glasses", "glasses_round_black");
    expect(equipped.glasses).toBe("glasses_round_black");
    expect(equipped.accessories.glasses).toBe("glasses_round_black");

    // Equip work object
    const withBoxes = equipItem(equipped, "workObject", "boxes_delivery");
    expect(withBoxes.workObject).toBe("boxes_delivery");
    expect(withBoxes.catalogSpriteId).toBe("sprite_r3_c1");

    // Unequip glasses
    const unequipped = unequipItem(withBoxes, "glasses");
    expect(unequipped.glasses).toBe("none");
    expect(unequipped.accessories.glasses).toBeUndefined();
  });

  it("randomizes appearance while preserving the store DNA", () => {
    const storeDNA = buildStoreVisualDNA(mockStore);
    const initial = createAgentAvatar({
      agentId: "camila",
      name: "Camila",
      storeId: mockStore.id,
      storeDNA,
      gender: "female",
    });

    const randomized = randomizeAvatar(initial, storeDNA);
    // Store branding and uniform preserved
    expect(randomized.branding.primaryColor).toBe(storeDNA.primaryColor);
    expect(randomized.branding.storeName).toBe(storeDNA.storeName);
    expect(randomized.clothing).toBe(storeDNA.defaultClothing);
    expect(randomized.catalogSpriteId).toBeDefined();
  });
});

describe("Avatar operational state regressions", () => {
  it("keeps store-bound editing stable and preserves an unsaved change on rerender", async () => {
    const store = { id: "shop-1", name: "Loja Centro", settings: {} };
    const agent = { key: "camila", name: "Camila", role: "Vendas" };
    const buildDNA = characterFactory.buildStoreVisualDNA;
    let calls = 0;
    const spy = vi.spyOn(characterFactory, "buildStoreVisualDNA").mockImplementation((value) => {
      if (++calls > 8) throw new Error("Store DNA render loop");
      return buildDNA(value);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onOpenChange = vi.fn();
    try {
      await expect(act(async () => {
        root.render(React.createElement(AvatarEditorModal, { open: true, onOpenChange, agent, store }));
      })).resolves.toBeUndefined();
      const getMaleButton = () => Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Masculino"))!;
      const maleButton = getMaleButton();
      await act(async () => maleButton.click());
      expect(maleButton.className).toContain("border-emerald-500");
      expect(document.querySelector('img[alt="camila"]')?.getAttribute("src")).toContain("sprite_r1_c1");
      await act(async () => {
        root.render(React.createElement(AvatarEditorModal, { open: true, onOpenChange, agent, store }));
      });
      expect(getMaleButton().className).toContain("border-emerald-500");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      spy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("does not invent active conversations or metrics when only activation is known", () => {
    const identity = normalizeAgentToIdentity({ key: "ana", name: "Ana", active: true });
    expect(identity.presenceState).toBe("IDLE");
    expect(identity.stats).toBeUndefined();
    expect(normalizeAgentToIdentity(undefined).presenceState).toBe("OFFLINE");
  });

  it("does not render runtime activity for a paused agent or simulated state controls", () => {
    const markup = renderToStaticMarkup(React.createElement(AgentWorkspace, {
      agent: { key: "ana", name: "Ana", active: true },
      isOnline: false,
      runtimeState: "RESPONDING",
    }));
    expect(markup).toContain("Pausado");
    expect(markup).not.toContain("respondendo à conversa");
    expect(markup).not.toContain("Simular estado");
  });

  it.each([
    ["WAITING", "Aguardando"],
    ["TYPING", "Digitando"],
    ["ERROR", "Atenção"],
  ] as const)("renders a useful label for %s", (state, label) => {
    const markup = renderToStaticMarkup(React.createElement(ZaiAvatarRenderer, {
      avatar: {}, state, showStatusBadge: true,
    }));
    expect(markup).toContain(label);
  });
});
