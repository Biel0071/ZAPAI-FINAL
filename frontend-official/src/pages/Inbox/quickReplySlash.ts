import type { QuickReplyItem } from "./types";

export interface SlashOption {
  cmd: string;
  desc: string;
  text: string;
  reply: QuickReplyItem;
}

/** Replies with several steps / media must run through the flow executor (banner + pause), never be pasted as text. */
export function needsFlowPreview(item: Pick<QuickReplyItem, "isFlow" | "steps" | "items">): boolean {
  if (item.isFlow) return true;
  if ((item.steps?.length ?? 0) > 1) return true;
  return Boolean(item.items?.some((entry) => entry.type !== "text") || (item.items?.length ?? 0) > 1);
}

/** Options for the "/" menu. Only real quick replies are listed (no hardcoded commands). */
export function buildSlashOptions(quickReplies: QuickReplyItem[], messageInput: string): SlashOption[] {
  if (!messageInput.startsWith("/")) return [];
  const needle = messageInput.slice(1).trim().toLowerCase();
  const commandWord = needle.split(/\s+/)[0] || "";
  const options = quickReplies.map((qr) => {
    const shortcut = (qr as { shortcut?: string }).shortcut;
    const cmd = `/${(shortcut || qr.text.split(" ").slice(0, 2).join("_"))
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")}`;
    const fromWhatsapp = (qr as { source?: string }).source === "whatsapp";
    return { cmd, desc: `${fromWhatsapp ? "WhatsApp" : "Resposta Rápida"}: ${qr.category}`, text: qr.text, reply: qr };
  });
  if (!needle) return options;
  return options.filter(
    (item) =>
      item.cmd.includes(needle) ||
      item.cmd.replace("/", "").startsWith(commandWord) ||
      item.text.toLowerCase().includes(needle) ||
      item.desc.toLowerCase().includes(needle),
  );
}
