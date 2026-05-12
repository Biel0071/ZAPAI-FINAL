import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AddressBook, MagnifyingGlass, Phone, ChatCircleDots } from "@phosphor-icons/react";
import { apiService, type Conversation } from "@/services/apiService";
import { cn } from "@/lib/utils";

type ContactRow = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
  isGroup: boolean;
  tags: string[];
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function normalizeConversationToContact(conv: Conversation): ContactRow {
  return {
    id: conv.id,
    name: conv.contactName || conv.phone || "Contato",
    phone: conv.phone || "",
    lastMessage: conv.lastMessage || "",
    updatedAt: conv.updatedAt || "",
    unread: conv.unread ?? 0,
    isGroup: conv.isGroup ?? false,
    tags: conv.tags ?? [],
  };
}

export default function Contacts() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const loadContacts = useCallback(async () => {
    try {
      setError(null);
      const conversations = await apiService.getConversations(true);
      const normalized = (Array.isArray(conversations) ? conversations : []).map(normalizeConversationToContact);
      
      // Dedupe by phone
      const byPhone = new Map<string, ContactRow>();
      normalized.forEach((c) => {
        const key = c.phone || c.id;
        const existing = byPhone.get(key);
        if (!existing || new Date(c.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          byPhone.set(key, c);
        }
      });
      
      setContacts([...byPhone.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (err) {
      console.error("Erro ao carregar contatos:", err);
      setError("Não foi possível carregar os contatos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
      );
    }
    if (tagFilter.trim()) {
      const t = tagFilter.toLowerCase();
      result = result.filter((c) => c.tags.some((tag) => tag.toLowerCase().includes(t)));
    }
    return result;
  }, [contacts, searchQuery, tagFilter]);

  const groupCount = useMemo(() => contacts.filter((c) => c.isGroup).length, [contacts]);
  const individualCount = useMemo(() => contacts.filter((c) => !c.isGroup).length, [contacts]);

  return (
    <div className="min-h-screen">
      <Header title="Contatos" subtitle={`${contacts.length} contatos sincronizados do WhatsApp`} />
      <div className="space-y-6 p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <AddressBook weight="duotone" className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <h3 className="text-2xl font-bold font-display">{loading ? "—" : contacts.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Phone weight="duotone" className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Individuais</p>
                  <h3 className="text-2xl font-bold font-display">{loading ? "—" : individualCount}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <ChatCircleDots weight="duotone" className="w-6 h-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grupos</p>
                  <h3 className="text-2xl font-bold font-display">{loading ? "—" : groupCount}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass-card">
          <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              placeholder="Filtrar por tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
            <Button className="md:w-fit" onClick={() => void loadContacts()}>
              Atualizar
            </Button>
          </CardContent>
        </Card>

        {/* Contact List */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <AddressBook className="h-4 w-4 text-primary" />
              Contatos
              {!loading && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {filteredContacts.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`skel-${i}`} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <EmptyState
                icon={<AddressBook className="h-8 w-8 text-muted-foreground/50" />}
                title="Erro ao carregar contatos"
                description={error}
                action={<Button variant="outline" size="sm" onClick={() => void loadContacts()}>Tentar novamente</Button>}
              />
            ) : filteredContacts.length === 0 ? (
              <EmptyState
                icon={<AddressBook className="h-8 w-8 text-muted-foreground/50" />}
                title={searchQuery || tagFilter ? "Nenhum contato encontrado" : "Nenhum contato ainda"}
                description={searchQuery || tagFilter ? "Tente ajustar os filtros de busca." : "Os contatos aparecerão aqui quando houver conversas no WhatsApp."}
              />
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className={cn("text-xs font-semibold", contact.isGroup ? "bg-info/15 text-info" : "bg-primary/15 text-primary")}>
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{contact.name}</p>
                        {contact.isGroup && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Grupo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                      {contact.lastMessage && (
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{contact.lastMessage}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground">{formatRelativeTime(contact.updatedAt)}</span>
                      {contact.unread > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 justify-center text-[10px] font-semibold bg-primary text-primary-foreground">
                          {contact.unread > 99 ? "99+" : contact.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
