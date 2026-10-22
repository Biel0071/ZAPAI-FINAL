import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";

export type WhatsappQuickReplyEntry = { shortcut: string; message: string };

export const OPEN_WA_IMPORT_EVENT = "zapai:open-whatsapp-import";

/** Accepts a JSON array of {shortcut,message} or lines like `/atalho | mensagem` (use \n for line breaks). */
export function parseWhatsappQuickReplies(raw: string): WhatsappQuickReplyEntry[] {
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => ({ shortcut: String(item?.shortcut ?? "").trim(), message: String(item?.message ?? item?.text ?? "").trim() }))
          .filter((item) => item.shortcut && item.message);
      }
    } catch { /* fall through to line format */ }
  }
  return text.split(/\r?\n/).flatMap((line) => {
    const index = line.indexOf("|");
    if (index < 0) return [];
    const shortcut = line.slice(0, index).trim().replace(/^\/+/, "");
    const message = line.slice(index + 1).trim().replace(/\\n/g, "\n");
    return shortcut && message ? [{ shortcut, message }] : [];
  });
}

/** Lives inside the dropdown, so it only fires an event: the dialog must outlive the menu. */
export function ImportWhatsappQuickRepliesMenuItem() {
  return (
    <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event(OPEN_WA_IMPORT_EVENT))} className="flex items-center gap-2.5 cursor-pointer py-2">
      <Download className="h-4 w-4 text-sky-400" />
      <span className="font-semibold text-xs">Importar do WhatsApp</span>
    </DropdownMenuItem>
  );
}

export function ImportWhatsappQuickRepliesDialog() {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_WA_IMPORT_EVENT, show);
    return () => window.removeEventListener(OPEN_WA_IMPORT_EVENT, show);
  }, []);

  const submit = async () => {
    const entries = parseWhatsappQuickReplies(raw);
    if (!entries.length) {
      notify.error("Nenhuma resposta válida. Use: /atalho | mensagem");
      return;
    }
    setBusy(true);
    try {
      const result = await apiService.importWhatsappQuickReplies(entries);
      notify.success(`WhatsApp: ${result.created} criadas, ${result.updated} atualizadas, ${result.skipped} ignoradas.`);
      window.dispatchEvent(new Event("zapai:quick-replies-reload"));
      setRaw("");
      setOpen(false);
    } catch {
      notify.error("Falha ao importar respostas rápidas do WhatsApp.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar respostas rápidas do WhatsApp</DialogTitle>
          <DialogDescription>
            Uma por linha: /atalho | mensagem (use \n para quebra de linha), ou cole um JSON com shortcut e message. Reimportar o mesmo atalho atualiza a resposta.
          </DialogDescription>
        </DialogHeader>
        <textarea
          aria-label="Respostas do WhatsApp"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={8}
          className="w-full rounded-md border border-border bg-background p-2 text-xs"
          placeholder="/ola | Olá, tudo bem?"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Importando…" : "Importar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
