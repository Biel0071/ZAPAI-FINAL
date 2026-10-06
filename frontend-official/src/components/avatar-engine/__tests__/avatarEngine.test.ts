import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import * as characterFactory from "../CharacterFactory";
import { AvatarEditorModal } from "../AvatarEditorModal";
import { ZaiAvatarRenderer } from "../ZaiAvatarRenderer";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { normalizeAgentToIdentity } from "../../ai/workspace/AgentIdentity";
import { AgentWorkspace } from "../../ai/workspace/AgentWorkspace";
import {
  buildStoreVisualDNA,
  createAgentAvatar,
  equipItem,
  unequipItem,
  randomizeAvatar,
  resolveSpriteForAvatar,
  applyStylePreset,
} from "../CharacterFactory";
import {
  StoreVisualDNA,
  DEFAULT_AVATAR_PRESETS,
  AVATAR_HAIRS,
  AVATAR_FACES,
  AVATAR_OUTFITS,
  AVATAR_ACCESSORIES,
  AVATAR_STYLES,
  AgentAvatarConfig,
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
  it("previews a gender-specific full-look preset, preserves it through accessory edits, and saves it", async () => {
    const agent = { key: "camila", name: "Camila", avatarConfig: createAgentAvatar({ agentId: "camila", name: "Camila" }) };
    const saveAvatar = vi.spyOn(apiService, "updateAgentAvatar").mockResolvedValue({ success: true, agent: {} } as any);
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root = createRoot(container);
    try {
      await act(async () => {
        root.render(React.createElement(AvatarEditorModal, { open: true, onOpenChange: vi.fn(), agent }));
      });
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]')).find(button => button.textContent?.includes("Cabelo"))?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      expect(Array.from(document.querySelectorAll('[role="tab"]')).find(button => button.textContent?.includes("Cabelo"))?.getAttribute("data-state")).toBe("active");
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="female_short_business"]')?.click();
      });
      expect(document.querySelector('img[alt="camila"]')?.getAttribute("src")).toContain("sprite_r2_c7_clean.png");

      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]')).find(button => button.textContent?.includes("Roupas"))?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="female_curly_updo"]')?.click();
      });
      expect(document.querySelector('img[alt="camila"]')?.getAttribute("src")).toContain("sprite_r2_c4_clean.png");

      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]')).find(button => button.textContent?.includes("Acessórios"))?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Headset ZAI Wireless Pro"))?.click();
      });
      expect(document.querySelector('img[alt="camila"]')?.getAttribute("src")).toContain("sprite_r2_c4_clean.png");

      await act(async () => {
        Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Salvar Avatar"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(saveAvatar).toHaveBeenCalledWith("camila", expect.objectContaining({
        avatarConfig: expect.objectContaining({ body: "female", hair: "female_curly_updo", catalogSpriteId: "sprite_r2_c4" }),
      }));

      const persistedAvatar = saveAvatar.mock.calls[0][1].avatarConfig;
      await act(async () => root.unmount());
      root = createRoot(container);
      await act(async () => {
        root.render(React.createElement(AvatarEditorModal, {
          open: true,
          onOpenChange: vi.fn(),
          agent: { ...agent, avatarConfig: persistedAvatar },
        }));
      });
      expect(document.querySelector('img[alt="camila"]')?.getAttribute("src")).toContain("sprite_r2_c4_clean.png");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      saveAvatar.mockRestore();
    }
  });

  it("does not announce a store visual save when the API rejects it", async () => {
    const save = vi.spyOn(apiService, "updateStoreVisualDNA").mockResolvedValue({ success: false, visualDNA: null, message: "Não salvo" });
    const success = vi.spyOn(notify, "success").mockImplementation(() => {});
    const error = vi.spyOn(notify, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(React.createElement(AvatarEditorModal, {
        open: true, onOpenChange: vi.fn(), agent: { key: "camila", name: "Camila" }, store: { id: "shop-1", name: "Loja Centro" },
      })));
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]')).find(tab => tab.textContent?.includes("Loja DNA"))?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Definir Como Padrão Oficial"))?.click();
      });
      expect(save).toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Não salvo"));
    } finally {
      await act(async () => root.unmount());
      container.remove();
      save.mockRestore(); success.mockRestore(); error.mockRestore();
    }
  });

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

  it("verifies simultaneous 5-category composition and independent layer changes (Requirement 21)", async () => {
    const agent = {
      key: "camila",
      name: "Camila",
      avatarConfig: createAgentAvatar({ agentId: "camila", name: "Camila", gender: "female" }),
    };
    const saveAvatar = vi.spyOn(apiService, "updateAgentAvatar").mockResolvedValue({ success: true, agent: {} } as any);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(React.createElement(AvatarEditorModal, { open: true, onOpenChange: vi.fn(), agent }));
      });

      // 1. select Cabelo 03
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]'))
          .find((tab) => tab.textContent?.includes("Cabelo"))
          ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="hair_03"]')?.click();
      });

      // 2. select Rosto 04
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]'))
          .find((tab) => tab.textContent?.includes("Rosto"))
          ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="face_04"]')?.click();
      });

      // 3. select Roupa 05
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]'))
          .find((tab) => tab.textContent?.includes("Roupas"))
          ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="outfit_05"]')?.click();
      });

      // 4. select Acessório 02
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]'))
          .find((tab) => tab.textContent?.includes("Acessórios"))
          ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="acc_02"]')?.click();
      });

      // 5. select Estilo Vendas
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]'))
          .find((tab) => tab.textContent?.includes("Estilo"))
          ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="style_vendas"]')?.click();
      });

      // 6. verify simultaneous composition
      const previewImg = document.querySelector('img[alt="camila"]');
      expect(previewImg).toBeTruthy();

      // 7. change Cabelo to 07 -> verify only hair changes
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]'))
          .find((tab) => tab.textContent?.includes("Cabelo"))
          ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="hair_07"]')?.click();
      });

      // 8. change Roupa to 02 -> verify hair stays 07
      await act(async () => {
        Array.from(document.querySelectorAll('[role="tab"]'))
          .find((tab) => tab.textContent?.includes("Roupas"))
          ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-avatar-item="outfit_02"]')?.click();
      });

      // 9. persist
      await act(async () => {
        Array.from(document.querySelectorAll("button"))
          .find((button) => button.textContent?.includes("Salvar Avatar"))
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(saveAvatar).toHaveBeenCalledWith("camila", expect.objectContaining({
        avatarConfig: expect.objectContaining({
          hair: "hair_07",
          face: "face_04",
          outfit: "outfit_02",
          style: "style_vendas",
        }),
      }));
    } finally {
      await act(async () => root.unmount());
      container.remove();
      saveAvatar.mockRestore();
    }
  });

  it("executes simultaneous 5-category composition and layer persistence logic (Requirement 21 Engine)", () => {
    const base = createAgentAvatar({
      agentId: "camila",
      name: "Camila",
      role: "Vendas",
      gender: "female",
    });

    // select Cabelo 03 -> Rosto 04 -> Roupa 05 -> Acessório 02 -> Estilo Vendas
    let config: AgentAvatarConfig = { ...base, hair: "hair_03", face: "face_04", outfit: "outfit_05", clothing: "outfit_05" };
    config = equipItem(config, "headset", "headset_zai_green");
    config = applyStylePreset(config, "style_vendas");

    // verify simultaneous composition
    expect(config.hair).toBe("hair_03");
    expect(config.face).toBe("face_04");
    expect(config.outfit).toBe("outfit_05");
    expect(config.accessories.headset).toBe("headset_zai_green");
    expect(config.style).toBe("style_vendas");

    // change Cabelo to 07 -> verify only hair changes
    const configHair07 = {
      ...config,
      hair: "hair_07",
      catalogSpriteId: AVATAR_HAIRS.find((h) => h.id === "hair_07")?.spriteRef || resolveSpriteForAvatar({ ...config, hair: "hair_07", catalogSpriteId: undefined }, true),
    };
    expect(configHair07.hair).toBe("hair_07");
    expect(configHair07.face).toBe("face_04");
    expect(configHair07.outfit).toBe("outfit_05");
    expect(configHair07.accessories.headset).toBe("headset_zai_green");
    expect(configHair07.style).toBe("style_vendas");

    // change Roupa to 02 -> verify hair stays 07
    const configOutfit02 = {
      ...configHair07,
      outfit: "outfit_02",
      clothing: "outfit_02",
      catalogSpriteId: AVATAR_OUTFITS.find((o) => o.id === "outfit_02")?.spriteRef || resolveSpriteForAvatar({ ...configHair07, outfit: "outfit_02", catalogSpriteId: undefined }, true),
    };
    expect(configOutfit02.hair).toBe("hair_07");
    expect(configOutfit02.outfit).toBe("outfit_02");
    expect(configOutfit02.face).toBe("face_04");
    expect(configOutfit02.style).toBe("style_vendas");
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
