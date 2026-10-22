import { describe, expect, it } from "vitest";
import { parseWhatsappQuickReplies } from "@/pages/Inbox/components/ImportWhatsappQuickRepliesDialog";

describe("parseWhatsappQuickReplies", () => {
  it("parses `/atalho | mensagem` lines and ignores invalid ones", () => {
    expect(parseWhatsappQuickReplies("/ola | Olá\\nTudo bem?\nsem barra\n | vazio\n/x |  ")).toEqual([
      { shortcut: "ola", message: "Olá\nTudo bem?" },
    ]);
  });
  it("parses JSON arrays", () => {
    expect(parseWhatsappQuickReplies('[{"shortcut":"/a","message":"b"},{"shortcut":"","message":"c"}]')).toEqual([{ shortcut: "/a", message: "b" }]);
  });
  it("returns empty for blank input", () => {
    expect(parseWhatsappQuickReplies("  ")).toEqual([]);
  });
});
