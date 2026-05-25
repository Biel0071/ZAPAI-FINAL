import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import ContactsView from "@/lovable/pages/ContactsPageView";
import { createContactsLovableViewModel } from "@/adapters/lovable/contactsAdapter";
import { type ContactGridItem } from "@/components/contacts/ContactGrid";
import { type ContactSegment } from "@/components/contacts/ContactSidebar";
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

  const contactsViewModel = createContactsLovableViewModel({
    activeSegment,
    filteredContacts: filteredContacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      updatedAt: contact.updatedAt,
      isGroup: contact.isGroup,
      tags: contact.tags,
      temperature: contact.temperature,
      status: contact.status,
      unread: contact.unread,
      lastMessage: contact.lastMessage,
    })),
    totalContacts: contacts.length,
    groupCount,
    individualCount,
  });

  return (
    <div className="min-h-screen">
      <Header title="Leads CRM / Contatos" subtitle="Gestão de base e qualificação de leads" />
      <ContactsView
        loading={loading}
        error={error}
        searchQuery={searchQuery}
        tagFilter={tagFilter}
        activeSegment={activeSegment}
        counts={contactCounts}
        viewModel={contactsViewModel}
        onSearchChange={setSearchQuery}
        onTagFilterChange={setTagFilter}
        onSegmentChange={setActiveSegment}
        onRefresh={() => void loadContacts()}
        onGoToChat={(item) => {
          const source = filteredContacts.find((contact) => contact.id === item.id);
          if (source) goToChat(source);
        }}
      />
    </div>
  );
}
