import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { buildSlashOptions, needsFlowPreview } from "@/pages/Inbox/quickReplySlash";
import { bubbleClassFor, isWhatsappDeviceMessage } from "@/pages/Inbox/messageOrigin";
import { WhatsappLabelBadges } from "@/components/inbox/WhatsappLabelBadges";
import type { QuickReplyItem } from "@/pages/Inbox/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const qr = (over: Partial<QuickReplyItem>): QuickReplyItem => ({ id: "1", title: "T", category: "general", text: "Olá cliente tudo bem", ...over });

describe('menu "/"', () => {
  it("lists only real quick replies (nothing hardcoded) and is empty without them", () => {
    expect(buildSlashOptions([], "/")).toEqual([]);
    const list = buildSlashOptions([qr({ id: "a", text: "Preço do plano" })], "/");
    expect(list).toHaveLength(1);
    expect(list[0].reply.id).toBe("a");
  });

  it("ignores input that is not a slash command and filters by text", () => {
    expect(buildSlashOptions([qr({})], "olá")).toEqual([]);
    const items = [qr({ id: "a", text: "Preço do plano" }), qr({ id: "b", text: "Endereço da loja" })];
    expect(buildSlashOptions(items, "/endere").map((o) => o.reply.id)).toEqual(["b"]);
  });

  it("uses the WhatsApp shortcut as command and labels the source", () => {
    const [opt] = buildSlashOptions([qr({ source: "whatsapp", shortcut: "ola", text: "Olá!" })], "/ol");
    expect(opt.cmd).toBe("/ola");
    expect(opt.desc.startsWith("WhatsApp")).toBe(true);
  });

  it("sends steps/media through the flow executor (banner) and plain text through the draft", () => {
    expect(needsFlowPreview(qr({ isFlow: true }))).toBe(true);
    expect(needsFlowPreview(qr({ steps: [{ id: "1" } as any, { id: "2" } as any] }))).toBe(true);
    expect(needsFlowPreview(qr({ items: [{ type: "image", value: "x" } as any] }))).toBe(true);
    expect(needsFlowPreview(qr({ items: [{ type: "text", value: "a" } as any] }))).toBe(false);
  });
});

describe("bolha azul do WhatsApp", () => {
  it("device origin is blue, even if it looks like AI; system stays green; received is neutral", () => {
    const device = { fromMe: true, origin: "whatsapp_device" };
    expect(isWhatsappDeviceMessage(device)).toBe(true);
    expect(bubbleClassFor({ fromMe: true, isDevice: true, isAi: true })).toBe("chat-bubble-wa");
    expect(isWhatsappDeviceMessage({ fromMe: true, origin: "human" })).toBe(false);
    expect(isWhatsappDeviceMessage({ fromMe: true })).toBe(false); // unknown origin is never blue
    expect(isWhatsappDeviceMessage({ fromMe: false, origin: "whatsapp_device" })).toBe(false);
    expect(bubbleClassFor({ fromMe: true, isDevice: false, isAi: false })).toBe("chat-bubble-sent");
    expect(bubbleClassFor({ fromMe: true, isDevice: false, isAi: true })).toBe("chat-bubble-ai-sent");
    expect(bubbleClassFor({ fromMe: false, isDevice: false, isAi: false })).toBe("chat-bubble-received");
  });
});

describe("etiquetas do WhatsApp", () => {
  it("renders blue WA badges, collapses overflow and renders nothing without labels", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() => root.render(<WhatsappLabelBadges labels={["Cliente VIP", "Pago", "Entrega"]} maxVisible={2} />));
    const wrap = host.querySelector('[data-testid="whatsapp-label-badges"]')!;
    expect(wrap.textContent).toContain("WA");
    expect(wrap.textContent).toContain("Cliente VIP");
    expect(wrap.textContent).toContain("+1");
    expect(wrap.innerHTML).toContain("sky-500");
    act(() => root.render(<WhatsappLabelBadges labels={[]} />));
    expect(host.querySelector('[data-testid="whatsapp-label-badges"]')).toBeNull();
    act(() => root.unmount());
  });
});
