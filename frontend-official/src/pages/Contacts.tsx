import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import ContactsView from "@/lovable/pages/ContactsPageView";
import { createContactsLovableViewModel } from "@/adapters/lovable/contactsAdapter";
import { type ContactGridItem } from "@/components/contacts/ContactGrid";
import { type ContactSegment } from "@/components/contacts/ContactSidebar";
import { apiService, type Conversation } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "@phosphor-icons/react";

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
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [activeSegment, setActiveSegment] = useState<ContactSegment>("all");

  // Edit contact modal state
  const [editContact, setEditContact] = useState<ContactRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // New multi-select and view layout states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list" | "kanban">("grid");

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeSegment, searchQuery, tagFilter]);

  const loadContacts = useCallback(async () => {
    try {
      setError(null);
      const [contactsResult, conversationsResult] = await Promise.allSettled([
        apiService.getContacts(true),
        apiService.getConversations(true, { limit: 1000 }),
      ]);

      const contactsData = contactsResult.status === "fulfilled" && Array.isArray(contactsResult.value)
        ? contactsResult.value
        : [];
      const conversationsData = conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value)
        ? conversationsResult.value
        : [];

      if (contactsResult.status === "rejected" && conversationsResult.status === "rejected") {
        throw contactsResult.reason ?? conversationsResult.reason;
      }

      const conversationsByPhone = new Map<string, Conversation>();
      (Array.isArray(conversationsData) ? conversationsData : []).forEach((conversation) => {
        const key = normalizePhone(conversation.phone) || String(conversation.id || "").trim();
        if (!key) return;
        const existing = conversationsByPhone.get(key);
        if (!existing || new Date(conversation.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          conversationsByPhone.set(key, conversation);
        }
      });

      const normalizedContacts = (Array.isArray(contactsData) ? contactsData : []).map((contact) => {
        const contactPhone = normalizePhone(contact.phone);
        const conversation = conversationsByPhone.get(contactPhone || String(contact.id || "").trim());
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
          temperature: (conversation as Conversation & { lead_temperature?: string })?.lead_temperature,
          funnelStage: (conversation as Conversation & { funnel_stage?: string })?.funnel_stage,
        } satisfies ContactRow;
      });

      const orphanConversations = (Array.isArray(conversationsData) ? conversationsData : [])
        .filter((conversation) => {
          const conversationPhone = normalizePhone(conversation.phone) || String(conversation.id || "").trim();
          return !normalizedContacts.some((contact) => (normalizePhone(contact.phone) || String(contact.id || "").trim()) === conversationPhone);
        })
        .map(normalizeConversationToContact);

      const byPhone = new Map<string, ContactRow>();
      [...normalizedContacts, ...orphanConversations].forEach((contact) => {
        const key = normalizePhone(contact.phone) || String(contact.id || "").trim();
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

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const filteredIds = filteredContacts.map((c) => c.id);
    const allSelected = filteredIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleBulkUpdate = async (action: {
    status?: string;
    temperature?: string;
    addTag?: string;
    removeTag?: string;
  }) => {
    if (selectedIds.size === 0) return;

    if (Object.keys(action).length === 0) {
      setSelectedIds(new Set());
      return;
    }

    setLoading(true);
    try {
      const promises = Array.from(selectedIds).map(async (id) => {
        const contact = contacts.find((c) => c.id === id);
        if (!contact?.conversationId) return;

        let newTags = [...contact.tags];
        if (action.addTag) {
          const trimmed = action.addTag.trim();
          if (trimmed && !newTags.includes(trimmed)) {
            newTags.push(trimmed);
          }
        }
        if (action.removeTag) {
          newTags = newTags.filter((t) => t !== action.removeTag);
        }

        const payload: Parameters<typeof apiService.patchConversation>[1] = {};
        if (action.status !== undefined) payload.status = action.status;
        if (action.temperature !== undefined) payload.lead_temperature = action.temperature;
        if (action.addTag || action.removeTag) payload.tags = newTags;

        await apiService.patchConversation(contact.conversationId, payload);
      });

      await Promise.all(promises);
      toast({ title: "Contatos atualizados com sucesso!" });
      setSelectedIds(new Set());
      await loadContacts();
    } catch (err) {
      console.error("Erro ao atualizar contatos em lote:", err);
      toast({ title: "Erro ao atualizar contatos em lote.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContact = async (id: string, payload: { status?: string; lead_temperature?: string; tags?: string[]; funnel_stage?: string }) => {
    const contact = contacts.find((c) => c.id === id);
    if (!contact?.conversationId) {
      toast({ title: "Contato sem conversa vinculada.", variant: "destructive" });
      return;
    }
    const originalContacts = [...contacts];

    // Optimistic Update
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            status: payload.status !== undefined ? payload.status : c.status,
            temperature: payload.lead_temperature !== undefined ? payload.lead_temperature : c.temperature,
            tags: payload.tags !== undefined ? payload.tags : c.tags,
            funnelStage: payload.funnel_stage !== undefined ? payload.funnel_stage : c.funnelStage,
          };
        }
        return c;
      })
    );

    try {
      await apiService.patchConversation(contact.conversationId, payload);
      toast({ title: "Contato atualizado." });
      await loadContacts();
    } catch (err) {
      console.error("Erro ao atualizar contato:", err);
      toast({ title: "Erro ao atualizar contato. Revertendo...", variant: "destructive" });
      setContacts(originalContacts);
    }
  };

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
      conversationId: contact.conversationId,
      funnelStage: contact.funnelStage,
    })),
    totalContacts: contacts.length,
    groupCount,
    individualCount,
  });

  const openEditModal = (gridItem: ContactGridItem) => {
    const source = contacts.find((c) => c.id === gridItem.id);
    if (!source) return;
    setEditContact(source);
    setEditName(source.name);
    setEditTags([...source.tags]);
    setNewTag("");
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed || editTags.includes(trimmed)) return;
    setEditTags((prev) => [...prev, trimmed]);
    setNewTag("");
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSaveEdit = async () => {
    if (!editContact?.conversationId) {
      toast({ title: "Contato sem conversa vinculada — não é possível editar.", variant: "destructive" });
      return;
    }
    setEditSaving(true);
    try {
      await apiService.patchConversation(editContact.conversationId, { name: editName, tags: editTags });
      setContacts((prev) =>
        prev.map((c) => (c.id === editContact.id ? { ...c, name: editName, tags: editTags } : c)),
      );
      toast({ title: "Contato atualizado com sucesso." });
      setEditContact(null);
    } catch {
      toast({ title: "Erro ao salvar contato.", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

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
        onEditContact={openEditModal}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onBulkUpdate={handleBulkUpdate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onUpdateContact={handleUpdateContact}
      />

      {/* Edit Contact Dialog */}
      <Dialog open={editContact !== null} onOpenChange={(open) => { if (!open) setEditContact(null); }}>
        <DialogContent className="sm:max-w-md border-border/80 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display">Editar contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do contato"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editContact?.phone ?? ""} disabled className="rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {editTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 rounded-full">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Nova tag"
                  className="rounded-xl"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                />
                <Button variant="outline" size="sm" className="rounded-xl" onClick={handleAddTag} disabled={!newTag.trim()}>Adicionar</Button>
              </div>
            </div>
            <Button className="w-full rounded-xl shadow-glow" onClick={() => void handleSaveEdit()} disabled={editSaving}>
              {editSaving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
