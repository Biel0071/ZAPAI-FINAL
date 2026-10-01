import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeTagName,
  extractLeadingEmoji,
  getTagDescriptor,
  getTagEmoji,
  getDeterministicIconForTag,
  setCustomTagDescriptor,
  resetTagDescriptor,
  getAllCustomTagDescriptors,
} from "./tagEmojis";

describe("tagEmojis utility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes tag names with accents and spacing correctly", () => {
    expect(normalizeTagName("  Orçamento  ")).toBe("orcamento");
    expect(normalizeTagName("NOVO LEAD")).toBe("novo lead");
    expect(normalizeTagName("Dúvida")).toBe("duvida");
    expect(normalizeTagName("Urgência")).toBe("urgencia");
  });

  it("extracts leading emoji properly", () => {
    expect(extractLeadingEmoji("⭐ VIP")).toEqual({ emoji: "⭐", cleanText: "VIP" });
    expect(extractLeadingEmoji("🎯 Novo Lead")).toEqual({ emoji: "🎯", cleanText: "Novo Lead" });
    expect(extractLeadingEmoji("Sem Emoji")).toEqual({ emoji: null, cleanText: "Sem Emoji" });
  });

  it("semantically matches known business tags to appropriate emojis", () => {
    expect(getTagDescriptor("Novo Lead").value).toBe("🎯");
    expect(getTagDescriptor("VIP").value).toBe("⭐");
    expect(getTagDescriptor("Venda").value).toBe("💰");
    expect(getTagDescriptor("Urgente").value).toBe("🚨");
    expect(getTagDescriptor("hot").value).toBe("🔥");
    expect(getTagDescriptor("Cliente").value).toBe("💼");
    expect(getTagDescriptor("Suporte").value).toBe("🛠️");
    expect(getTagDescriptor("Financeiro").value).toBe("💳");
    expect(getTagDescriptor("Entrega").value).toBe("📦");
  });

  it("does not generate fake icons or emojis for tags without an emoji to prevent visual clutter", () => {
    expect(getTagDescriptor("cold").type).toBe("none");
    expect(getTagDescriptor("information").type).toBe("none");
    expect(getTagDescriptor("educate").type).toBe("none");
    expect(getTagEmoji("cold")).toBeNull();
    expect(getTagEmoji("information")).toBeNull();
    expect(getTagEmoji("educate")).toBeNull();
  });

  it("extracts emojis properly with getTagEmoji", () => {
    expect(getTagEmoji("⭐ VIP")).toBe("⭐");
    expect(getTagEmoji("Novo Lead")).toBe("🎯");
    expect(getTagEmoji("Cliente")).toBe("💼");
    expect(getTagEmoji("Tag Sem Emoji")).toBeNull();
  });

  it("allows setting custom overrides that persist and can be reset", () => {
    expect(getTagEmoji("Fornecedor Especial")).toBeNull();

    // Override with an emoji
    setCustomTagDescriptor("Fornecedor Especial", {
      type: "emoji",
      value: "🏆",
      isMonochrome: false,
      label: "Troféu",
    });

    expect(getTagDescriptor("Fornecedor Especial").value).toBe("🏆");
    expect(getTagEmoji("Fornecedor Especial")).toBe("🏆");
    expect(getAllCustomTagDescriptors()["fornecedor especial"]).toBeDefined();

    // Reset
    resetTagDescriptor("Fornecedor Especial");
    expect(getTagEmoji("Fornecedor Especial")).toBeNull();
  });

  it("supports unicode emoji custom override with monochrome toggle", () => {
    setCustomTagDescriptor("VIP", {
      type: "emoji",
      value: "💎",
      isMonochrome: true,
      label: "Diamante",
    });

    const desc = getTagDescriptor("VIP");
    expect(desc.type).toBe("emoji");
    expect(desc.value).toBe("💎");
    expect(desc.isMonochrome).toBe(true);
  });
});

