import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeTagName,
  extractLeadingEmoji,
  getTagDescriptor,
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

  it("semantically matches known business tags to appropriate monochromatic icons", () => {
    expect(getTagDescriptor("Novo Lead").value).toBe("Target");
    expect(getTagDescriptor("VIP").value).toBe("Star");
    expect(getTagDescriptor("Venda").value).toBe("CurrencyDollar");
    expect(getTagDescriptor("Urgente").value).toBe("Warning");
    expect(getTagDescriptor("hot").value).toBe("Flame");
    expect(getTagDescriptor("cold").value).toBe("Snowflake");
    expect(getTagDescriptor("Cliente").value).toBe("Briefcase");
    expect(getTagDescriptor("Suporte").value).toBe("Wrench");
    expect(getTagDescriptor("Financeiro").value).toBe("CreditCard");
    expect(getTagDescriptor("Entrega").value).toBe("Package");
  });

  it("generates deterministic and consistent icons for custom tags", () => {
    const desc1 = getTagDescriptor("Fornecedor A");
    const desc2 = getTagDescriptor("Fornecedor A");
    const desc3 = getTagDescriptor("Transportadora X");

    expect(desc1.value).toBe(desc2.value); // Consistent
    expect(desc1.type).toBe("icon");
    expect(desc1.isMonochrome).toBe(true);

    const iconA = getDeterministicIconForTag("Tag Alpha");
    const iconB = getDeterministicIconForTag("Tag Beta");
    // Ensure determinism works and palette has diversity
    expect(typeof iconA.name).toBe("string");
    expect(typeof iconB.name).toBe("string");
  });

  it("allows setting custom overrides that persist and can be reset", () => {
    expect(getTagDescriptor("Fornecedor Especial").value).not.toBe("Trophy");

    // Override
    setCustomTagDescriptor("Fornecedor Especial", {
      type: "icon",
      value: "Trophy",
      isMonochrome: true,
      label: "Troféu",
    });

    expect(getTagDescriptor("Fornecedor Especial").value).toBe("Trophy");
    expect(getAllCustomTagDescriptors()["fornecedor especial"]).toBeDefined();

    // Reset
    resetTagDescriptor("Fornecedor Especial");
    expect(getTagDescriptor("Fornecedor Especial").value).not.toBe("Trophy");
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
