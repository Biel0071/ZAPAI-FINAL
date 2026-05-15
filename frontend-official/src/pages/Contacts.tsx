import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { ContactGrid, type ContactGridItem } from "@/components/contacts/ContactGrid";
import { ContactSidebar, type ContactSegment } from "@/components/contacts/ContactSidebar";
import { ChatSearchBar } from "@/components/inbox/ChatSearchBar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AddressBook, ChatCircleDots, Phone } from "@phosphor-icons/react";
import { apiService, type Conversation } from "@/services/apiService";

type ContactRow = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
  isGroup: boolean;
  tags: string[];
  conversationId?: string;
  sessionId?: string;
  status?: string;
  temperature?: string;
  funnelStage?: string;
};

function normalizePhone(phone?: string): string {
  const normalized = String(phone ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("@g.us")) return normalized;
  return normalized.replace(/\D/g, "");
}

function isHotTemperature(value?: string): boolean {
  return ["hot", "quente", "ready_to_buy"].includes(String(value ?? "").toLowerCase());
}

function isWarmTemperature(value?: string): boolean {
  return ["warm", "morno"].includes(String(value ?? "").toLowerCase());
}

function isColdTemperature(value?: string): boolean {
  const normalized = String(value ?? "").toLowerCase();
  return Boolean(normalized) && !isHotTemperature(normalized) && !isWarmTemperature(normalized);
}

function isLeadContact(contact: ContactRow): boolean {
  return Boolean(contact.tags.length || contact.temperature || contact.funnelStage);
}

function isAtivoStatus(value?: string): boolean {
  return ["open", "online", "active", "ativo", "typing"].includes(String(value ?? "").toLowerCase());
}

function isRecorrenteStatus(value?: string): boolean {
  return ["recorrente", "returning", "recurring"].includes(String(value ?? "").toLowerCase());
}

function isEmRiscoStatus(value?: string): boolean {
  return ["em_risco", "at_risk", "risk"].includes(String(value ?? "").toLowerCase());
}

function isBloqueadoStatus(value?: string): boolean {
  return ["blocked", "bloqueado", "archived"].includes(String(value ?? "").toLowerCase());
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
    conversationId: conv.id,
    sessionId: conv.sessionId,
    status: conv.status,
  };
}

function matchesSegment(contact: ContactRow, segment: ContactSegment): boolean {
  switch (segment) {
    case "all":
      return true;
    case "inbox":
      return Boolean(contact.conversationId);
    case "lead":
      return isLeadContact(contact);
    case "saved":
      return false;
    case "grupos":
      return contact.isGroup;
    case "archived":
      return false;
    case "lead_quente":
      return isHotTemperature(contact.temperature);
    case "lead_morno":
      return isWarmTemperature(contact.temperature);
    case "lead_frio":
      return isColdTemperature(contact.temperature);
    case "ativo":
      return isAtivoStatus(contact.status);
    case "recorrente":
      return isRecorrenteStatus(contact.status);
    case "em_risco":
      return isEmRiscoStatus(contact.status);
    case "bloqueado":
      return isBloqueadoStatus(contact.status);
    default:
      return true;
  }
}

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [activeSegment, setActiveSegment] = useState<ContactSegment>("all");

  const loadContacts = useCallback(async () => {
    try {
      setError(null);
      const [contactsData, conversationsData] = await Promise.all([
        apiService.getContacts(true),
        apiService.getConversations(true, { limit: 200 }),
      ]);

      const conversationsByPhone = new Map<string, Conversation>();
      (Array.isArray(conversationsData) ? conversationsData : []).forEach((conversation) => {
        const key = conversation.phone || conversation.id;
        if (!key) return;
        const existing = conversationsByPhone.get(key);
        if (!existing || new Date(conversation.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          conversationsByPhone.set(key, conversation);
        }
      });

      const normalizedContacts = (Array.isArray(contactsData) ? contactsData : []).map((contact) => {
        const conversation = conversationsByPhone.get(contact.phone || contact.id);
        return {
          id: contact.id,
          name: contact.name || conversation?.contactName || contact.phone || "Contato",
          phone: contact.phone || conversation?.phone || "",
          lastMessage: conversation?.lastMessage || "",
          updatedAt: conversation?.updatedAt || new Date().toISOString(),
          unread: conversation?.unread ?? 0,
          isGroup: conversation?.isGroup ?? false,
          tags: conversation?.tags ?? [],
          conversationId: conversation?.id,
          sessionId: conversation?.sessionId,
          status: conversation?.status,
          temperature: (conversation as Conversation & { lead_temperature?: string }).lead_temperature,
          funnelStage: (conversation as Conversation & { funnel_stage?: string }).funnel_stage,
        } satisfies ContactRow;
      });

      const orphanConversations = (Array.isArray(conversationsData) ? conversationsData : [])
        .filter((conversation) => {
          const conversationPhone = conversation.phone || conversation.id;
          return !normalizedContacts.some((contact) => (contact.phone || contact.id) === conversationPhone);
        })
        .map(normalizeConversationToContact);

      const byPhone = new Map<string, ContactRow>();
      [...normalizedContacts, ...orphanConversations].forEach((contact) => {
        const key = contact.phone || contact.id;
        const existing = byPhone.get(key);
        if (!existing || new Date(contact.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          byPhone.set(key, contact);
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
    let result = contacts.filter((contact) => matchesSegment(contact, activeSegment));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((contact) => contact.name.toLowerCase().includes(query) || contact.phone.includes(query));
    }

    if (tagFilter.trim()) {
      const tagNeedle = tagFilter.toLowerCase();
      result = result.filter((contact) => contact.tags.some((tag) => tag.toLowerCase().includes(tagNeedle)));
    }

    return result;
  }, [activeSegment, contacts, searchQuery, tagFilter]);

  const contactCounts = useMemo<Record<string, number>>(
    () => ({
      all: contacts.length,
      inbox: contacts.filter((contact) => Boolean(contact.conversationId)).length,
      lead: contacts.filter(isLeadContact).length,
      saved: 0,
      grupos: contacts.filter((contact) => contact.isGroup).length,
      archived: 0,
      lead_quente: contacts.filter((contact) => isHotTemperature(contact.temperature)).length,
      lead_morno: contacts.filter((contact) => isWarmTemperature(contact.temperature)).length,
      lead_frio: contacts.filter((contact) => isColdTemperature(contact.temperature)).length,
      ativo: contacts.filter((contact) => isAtivoStatus(contact.status)).length,
      recorrente: contacts.filter((contact) => isRecorrenteStatus(contact.status)).length,
      em_risco: contacts.filter((contact) => isEmRiscoStatus(contact.status)).length,
      bloqueado: contacts.filter((contact) => isBloqueadoStatus(contact.status)).length,
    }),
    [contacts],
  );

  const gridContacts = useMemo<ContactGridItem[]>(
    () =>
      filteredContacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        updatedAt: contact.updatedAt,
        isGroup: contact.isGroup,
        tags: contact.tags,
        temperature: contact.temperature,
        status: contact.status,
      })),
    [filteredContacts],
  );

  const groupCount = useMemo(() => contacts.filter((contact) => contact.isGroup).length, [contacts]);
  const individualCount = useMemo(() => contacts.filter((contact) => !contact.isGroup).length, [contacts]);

  const goToChat = useCallback(
    (contact: ContactRow | ContactGridItem) => {
      const normalizedPhone = normalizePhone(contact.phone);
      const sessionId = "sessionId" in contact ? contact.sessionId : undefined;
      if (normalizedPhone) {
        const normalizedSessionId = String(sessionId ?? "default").trim() || "default";
        window.localStorage.setItem("zapai_inbox_last_chat_scope", `${normalizedSessionId}:${normalizedPhone}`);
      }
      navigate("/inbox");
    },
    [navigate],
  );

  const selectedSegmentLabel = useMemo(() => {
    const labels: Record<ContactSegment, string> = {
      all: "Todos os contatos",
      inbox: "Contatos com conversa",
      lead: "Leads CRM",
      saved: "Contatos salvos",
      grupos: "Grupos",
      archived: "Arquivados",
      lead_quente: "Lead quente",
      lead_morno: "Lead morno",
      lead_frio: "Lead frio",
      ativo: "Ativos",
      recorrente: "Recorrentes",
      em_risco: "Em risco",
      bloqueado: "Bloqueados",
    };

    return labels[activeSegment];
  }, [activeSegment]);

  return (
    <div className="min-h-screen">
      <Header title="Contatos" subtitle={`${contacts.length} contatos sincronizados do WhatsApp`} />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <AddressBook weight="duotone" className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <h3 className="font-display text-2xl font-bold">{loading ? "—" : contacts.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <Phone weight="duotone" className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Individuais</p>
                  <h3 className="font-display text-2xl font-bold">{loading ? "—" : individualCount}</h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
                  <ChatCircleDots weight="duotone" className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grupos</p>
                  <h3 className="font-display text-2xl font-bold">{loading ? "—" : groupCount}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="glass-card min-h-[540px] overflow-hidden">
            <ContactSidebar activeSegment={activeSegment} onSegmentChange={setActiveSegment} counts={contactCounts} />
          </Card>

          <div className="space-y-4">
            <Card className="glass-card">
              <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                <ChatSearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Buscar por nome ou telefone"
                />
                <Input
                  placeholder="Filtrar por tag"
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                />
                <Button className="md:w-fit" onClick={() => void loadContacts()}>
                  Atualizar
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <AddressBook className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{selectedSegmentLabel}</p>
                      <p className="text-xs text-muted-foreground">CRM enriquecido com dados reais de conversas</p>
                    </div>
                    {!loading && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {filteredContacts.length}
                      </Badge>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={`contact-skeleton-${index}`} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="p-4">
                    <EmptyState
                      icon={<AddressBook className="h-8 w-8 text-muted-foreground/50" />}
                      title="Erro ao carregar contatos"
                      description={error}
                      action={
                        <Button variant="outline" size="sm" onClick={() => void loadContacts()}>
                          Tentar novamente
                        </Button>
                      }
                    />
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={<AddressBook className="h-8 w-8 text-muted-foreground/50" />}
                      title={searchQuery || tagFilter ? "Nenhum contato encontrado" : "Nenhum contato ainda"}
                      description={searchQuery || tagFilter ? "Tente ajustar os filtros de busca." : "Os contatos aparecerão aqui quando houver conversas no WhatsApp."}
                    />
                  </div>
                ) : (
                  <ContactGrid
                    contacts={gridContacts}
                    onSelect={(item) => {
                      const source = filteredContacts.find((contact) => contact.id === item.id);
                      if (source) goToChat(source);
                    }}
                    onGoToChat={(item) => {
                      const source = filteredContacts.find((contact) => contact.id === item.id);
                      if (source) goToChat(source);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
