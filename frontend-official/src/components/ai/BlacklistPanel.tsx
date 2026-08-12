import { useState, useEffect } from "react";
import { Prohibit, MagnifyingGlass, Plus, Trash } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiService } from "@/services/apiService";
import { notify } from "@/services/notifyService";

interface BlockedContact {
  id: number;
  phone: string;
  name: string;
  created_at: string;
}

export function BlacklistPanel() {
  const [blocked, setBlocked] = useState<BlockedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState("");
  const [search, setSearch] = useState("");

  const loadBlocked = async () => {
    try {
      const res: any = await apiService.getBlockedContacts();
      setBlocked(res?.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBlocked(); }, []);

  const handleBlock = async () => {
    const phone = phoneInput.replace(/\D/g, "").trim();
    if (!phone || phone.length < 8) {
      notify.error("Informe um número válido (mínimo 8 dígitos)");
      return;
    }
    try {
      await apiService.blockContact(phone);
      notify.success(`${phone} adicionado à blacklist`);
      setPhoneInput("");
      void loadBlocked();
    } catch (err: any) {
      notify.error(err?.message || "Falha ao bloquear");
    }
  };

  const handleUnblock = async (phone: string) => {
    try {
      await apiService.unblockContact(phone);
      notify.success(`${phone} removido da blacklist`);
      setBlocked((prev) => prev.filter((c) => c.phone !== phone));
    } catch (err: any) {
      notify.error(err?.message || "Falha ao desbloquear");
    }
  };

  const filtered = blocked.filter((c) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (c.phone || "").includes(term) || (c.name || "").toLowerCase().includes(term);
  });

  return (
    <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <Prohibit className="h-5 w-5 text-destructive" weight="duotone" />
          Blacklist (IA não interage)
        </CardTitle>
        <Badge variant="secondary" className="rounded-full">{blocked.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Números na blacklist são ignorados pela IA — apenas atendentes humanos podem interagir com eles.
        </p>

        <div className="flex gap-2">
          <Input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="Número para bloquear (ex: 31999999999)"
            className="rounded-xl"
            onKeyDown={(e) => e.key === "Enter" && handleBlock()}
          />
          <Button onClick={handleBlock} size="sm" className="gap-1.5 rounded-xl" variant="destructive">
            <Plus className="h-4 w-4" />
            Bloquear
          </Button>
        </div>

        {blocked.length > 3 && (
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar na blacklist..."
              className="pl-9 rounded-xl"
            />
          </div>
        )}

        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {blocked.length === 0 ? "Nenhum número bloqueado." : "Nenhum resultado para a busca."}
          </p>
        ) : (
          <div className="scrollbar-thin max-h-60 space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((contact) => (
              <div
                key={contact.id || contact.phone}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{contact.name || contact.phone}</span>
                  {contact.name && <span className="ml-2 text-xs text-muted-foreground">{contact.phone}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => handleUnblock(contact.phone)}
                >
                  <Trash className="h-3.5 w-3.5" />
                  Remover
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BlacklistPanel;
