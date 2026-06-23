import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Megaphone,
  PaperPlaneTilt,
  Eye,
  CheckCircle,
  Plus,
  ArrowClockwise,
  Play,
  Pause,
  Trash,
  Copy,
  PencilSimple,
  Users,
  Clock,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import CampaignsView from "@/lovable/pages/CampaignsPageView";
import { createCampaignsLovableViewModel } from "@/adapters/lovable/campaignsAdapter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { StatGridSkeleton } from "@/components/ui/loading-skeleton";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  apiService,
  type CampaignContact,
  type CampaignRecord,
  type Conversation,
  type Contact,
} from "@/services/apiService";
import { notify } from "@/services/notifyService";
import { cn } from "@/lib/utils";

type ComposerMode = "create" | "edit" | "duplicate";
type CampaignAction = "save" | "launch" | "start" | "pause" | "resume" | "delete" | "refresh" | null;

const STEP_LABELS = [
  "Público",
  "Mensagem",
  "Delays",
  "Revisão",
  "Lançar",
] as const;

const DEFAULT_MESSAGES = [
  "Olá! Tenho uma condição especial para te apresentar hoje.",
  "Oi! Posso te mostrar uma oportunidade alinhada ao seu perfil?",
];

function normalizeCampaignStatus(campaign: CampaignRecord): CampaignRecord["status"] {
  if (campaign.queue?.paused) return "paused";
  return campaign.status || "draft";
}

function statusMeta(campaign: CampaignRecord) {
  const status = normalizeCampaignStatus(campaign).toLowerCase();

  if (["completed", "sent"].includes(status)) {
    return { label: "Concluída", tone: "online" as const, cardLine: "bg-success" };
  }
  if (["running", "active", "processing"].includes(status)) {
    return { label: "Em execução", tone: "syncing" as const, cardLine: "bg-info" };
  }
  if (["paused"].includes(status)) {
    return { label: "Pausada", tone: "warning" as const, cardLine: "bg-warning" };
  }
  if (["scheduled", "ready"].includes(status)) {
    return { label: "Pronta para lançar", tone: "warning" as const, cardLine: "bg-warning" };
  }
  if (["cancelled", "canceled"].includes(status)) {
    return { label: "Cancelada", tone: "offline" as const, cardLine: "bg-muted" };
  }
  return { label: "Rascunho", tone: "offline" as const, cardLine: "bg-muted" };
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não agendada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não agendada";
  return parsed.toLocaleString("pt-BR");
}

function formatInputDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function normalizePhone(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("@g.us")) return normalized;
  return normalized.replace(/\D/g, "");
}

function uniqueContacts(contacts: Contact[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = normalizePhone(contact.phone) || String(contact.id || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function Campaigns() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagInputVal, setTagInputVal] = useState("");
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaignStep, setCampaignStep] = useState(1);
  const [composerMode, setComposerMode] = useState<ComposerMode>("create");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [messageVariants, setMessageVariants] = useState<string[]>(DEFAULT_MESSAGES);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [typingDelay, setTypingDelay] = useState<number[]>([3]);
  const [intervalSeconds, setIntervalSeconds] = useState<number[]>([10]);
  const [pauseEvery, setPauseEvery] = useState("10");
  const [pauseSeconds, setPauseSeconds] = useState("60");
  const [startAt, setStartAt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [actionCampaignId, setActionCampaignId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<CampaignAction>(null);

  const loadPageData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const [campaignList, contactList, conversationsData] = await Promise.all([
        apiService.getCampaigns(),
        apiService.getContacts(true),
        apiService.getConversations(true, { limit: 500 }).catch(() => []),
      ]);
      setCampaigns(Array.isArray(campaignList) ? campaignList : []);

      const conversationsByPhone = new Map<string, Conversation>();
      (Array.isArray(conversationsData) ? conversationsData : []).forEach((conversation) => {
        const key = normalizePhone(conversation.phone) || String(conversation.id || "").trim();
        if (!key) return;
        const existing = conversationsByPhone.get(key);
        if (!existing || new Date(conversation.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          conversationsByPhone.set(key, conversation);
        }
      });

      const normalizedContacts = (Array.isArray(contactList) ? contactList : []).map((contact) => {
        const conversation = conversationsByPhone.get(normalizePhone(contact.phone) || String(contact.id || "").trim());
        return {
          id: contact.id,
          name: contact.name || conversation?.contactName || contact.phone || "Contato",
          phone: contact.phone || conversation?.phone || "",
          status: conversation?.status,
          updatedAt: conversation?.updatedAt || new Date().toISOString(),
        };
      });

      const orphanConversations = (Array.isArray(conversationsData) ? conversationsData : [])
        .filter((conversation) => {
          const conversationPhone = normalizePhone(conversation.phone) || String(conversation.id || "").trim();
          return !normalizedContacts.some((contact) => (normalizePhone(contact.phone) || String(contact.id || "").trim()) === conversationPhone);
        })
        .map((conv) => ({
          id: conv.id,
          name: conv.contactName || conv.phone || "Contato",
          phone: conv.phone || "",
          status: conv.status,
          updatedAt: conv.updatedAt || new Date().toISOString(),
        }));

      const byPhone = new Map<string, Contact>();
      [...normalizedContacts, ...orphanConversations].forEach((contact) => {
        const key = normalizePhone(contact.phone) || String(contact.id || "").trim();
        const existing = byPhone.get(key);
        if (!existing || new Date(contact.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          byPhone.set(key, contact);
        }
      });

      const mergedContacts = [...byPhone.values()];
      setContacts(uniqueContacts(mergedContacts));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Falha ao carregar campanhas");
      if (!options?.silent) {
        setCampaigns([]);
        setContacts([]);
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const resetComposer = useCallback(() => {
    setComposerMode("create");
    setEditingCampaignId(null);
    setCampaignName("");
    setSelectedContactIds([]);
    setMessageVariants(DEFAULT_MESSAGES);
    setShuffleEnabled(true);
    setTypingDelay([3]);
    setIntervalSeconds([10]);
    setPauseEvery("10");
    setPauseSeconds("60");
    setStartAt("");
    setTagsInput("");
    setCampaignStep(1);
    setSearchQuery("");
  }, []);

  const hydrateComposer = useCallback((campaign: CampaignRecord, mode: ComposerMode) => {
    setComposerMode(mode);
    setEditingCampaignId(mode === "edit" ? campaign.id : null);
    setCampaignName(mode === "duplicate" ? `${campaign.name} (cópia)` : campaign.name);
    setSelectedContactIds(
      (campaign.selectedContacts ?? [])
        .map((contact) => String(contact.phone || contact.id || "").trim())
        .filter(Boolean),
    );
    setMessageVariants(
      campaign.messages && campaign.messages.length > 0
        ? campaign.messages.map((message) => String(message.content || "").trim()).filter(Boolean)
        : DEFAULT_MESSAGES,
    );
    setShuffleEnabled((campaign.messages ?? []).length > 1);
    setTypingDelay([campaign.settings?.typingDelaySeconds ?? 3]);
    setIntervalSeconds([campaign.settings?.intervalSeconds ?? 10]);
    setPauseEvery(String(campaign.settings?.pauseEvery ?? 10));
    setPauseSeconds(String(campaign.settings?.pauseSeconds ?? 60));
    setStartAt(formatInputDateTime(campaign.settings?.startAt));
    setTagsInput(Array.isArray(campaign.tags) ? campaign.tags.join(", ") : "");
    setCampaignStep(1);
  }, []);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const needle = searchQuery.toLowerCase();
    return contacts.filter((contact) => {
      const name = String(contact.name || "").toLowerCase();
      const phone = String(contact.phone || "").toLowerCase();
      return name.includes(needle) || phone.includes(needle);
    });
  }, [contacts, searchQuery]);

  const selectedContacts = useMemo<CampaignContact[]>(() => {
    return selectedContactIds.map((contactId, index) => {
      const existing = contacts.find((contact) => String(contact.phone || contact.id) === contactId);
      return {
        id: existing?.id ?? contactId,
        name: existing?.name ?? `Contato ${index + 1}`,
        phone: existing?.phone ?? contactId,
        status: existing?.status,
      };
    });
  }, [contacts, selectedContactIds]);

  const selectedContactCount = selectedContacts.length;
  const cleanMessages = useMemo(
    () => messageVariants.map((message) => message.trim()).filter(Boolean),
    [messageVariants],
  );

  const editingCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null,
    [campaigns, editingCampaignId],
  );

  const totals = useMemo(() => {
    return campaigns.reduce(
      (accumulator, campaign) => {
        accumulator.sent += Number(campaign.queue?.sent ?? 0);
        accumulator.total += Number(campaign.queue?.total ?? 0);
        accumulator.processed += Number(campaign.queue?.processed ?? 0);
        accumulator.failed += Number(campaign.queue?.failed ?? 0);
        return accumulator;
      },
      { sent: 0, total: 0, processed: 0, failed: 0 },
    );
  }, [campaigns]);

  const launchReadiness = useMemo(() => {
    const missing: string[] = [];
    if (!campaignName.trim()) missing.push("Defina um nome");
    if (selectedContactCount === 0) missing.push("Selecione contatos");
    if (cleanMessages.length === 0) missing.push("Crie ao menos uma mensagem");
    return missing;
  }, [campaignName, cleanMessages.length, selectedContactCount]);

  const isSaving = actionType === "save" || actionType === "launch";

  const buildPayload = useCallback(
    (nextStatus: string) => {
      const queueBase = editingCampaign?.queue ?? { total: 0, processed: 0, sent: 0, failed: 0, paused: false };
      return {
        id: editingCampaignId ?? undefined,
        name: campaignName.trim(),
        status: nextStatus,
        selectedContacts,
        messages: cleanMessages.map((content, index) => ({
          id: editingCampaign?.messages?.[index]?.id,
          type: "text" as const,
          content,
          delaySeconds: intervalSeconds[0],
        })),
        settings: {
          intervalSeconds: intervalSeconds[0],
          pauseEvery: Math.max(1, Number(pauseEvery) || 1),
          pauseSeconds: Math.max(0, Number(pauseSeconds) || 0),
          typingDelaySeconds: typingDelay[0],
          startAt: startAt ? new Date(startAt).toISOString() : null,
          shuffleEnabled,
        },
        queue: {
          total: selectedContacts.length,
          processed: Math.min(Number(queueBase.processed ?? 0), selectedContacts.length),
          sent: Math.min(Number(queueBase.sent ?? 0), selectedContacts.length),
          failed: Number(queueBase.failed ?? 0),
          paused: nextStatus === "paused",
        },
        tags: tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
    },
    [campaignName, cleanMessages, editingCampaign, editingCampaignId, intervalSeconds, pauseEvery, pauseSeconds, selectedContacts, shuffleEnabled, startAt, tagsInput, typingDelay],
  );

  const persistCampaign = useCallback(
    async (mode: "save" | "launch") => {
      if (launchReadiness.length > 0) {
        notify.error(launchReadiness[0]);
        return;
      }

      setActionType(mode);
      setActionCampaignId(editingCampaignId ?? "draft");
      try {
        const initialStatus = mode === "launch" ? "scheduled" : editingCampaign?.status ?? "draft";
        const payload = buildPayload(initialStatus);
        const savedCampaign = editingCampaignId
          ? await apiService.updateCampaign(editingCampaignId, payload)
          : await apiService.createCampaign(payload);

        if (mode === "launch") {
          await apiService.startCampaignDispatch(savedCampaign.id);
          notify.success("Campanha criada e lançada com sucesso");
          resetComposer();
        } else {
          notify.success(editingCampaignId ? "Campanha atualizada" : "Campanha salva como rascunho");
          hydrateComposer(savedCampaign, "edit");
        }

        await loadPageData({ silent: true });
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Falha ao salvar campanha");
      } finally {
        setActionType(null);
        setActionCampaignId(null);
      }
    },
    [buildPayload, editingCampaign?.status, editingCampaignId, hydrateComposer, launchReadiness, loadPageData, resetComposer],
  );

  const runCampaignAction = useCallback(
    async (campaignId: string, action: Exclude<CampaignAction, "save" | "launch" | "refresh" | null>) => {
      const targetCampaign = campaigns.find((campaign) => campaign.id === campaignId);
      if (!targetCampaign) return;

      setActionCampaignId(campaignId);
      setActionType(action);
      try {
        if (action === "start") {
          await apiService.startCampaignDispatch(campaignId);
          notify.success("Campanha iniciada");
        }

        if (action === "pause") {
          await apiService.updateCampaign(campaignId, {
            ...targetCampaign,
            status: "paused",
            queue: {
              ...targetCampaign.queue,
              paused: true,
            },
          });
          notify.success("Campanha pausada");
        }

        if (action === "resume") {
          await apiService.updateCampaign(campaignId, {
            ...targetCampaign,
            status: "scheduled",
            queue: {
              ...targetCampaign.queue,
              paused: false,
            },
          });
          await apiService.startCampaignDispatch(campaignId);
          notify.success("Campanha retomada");
        }

        if (action === "delete") {
          await apiService.deleteCampaign(campaignId);
          if (editingCampaignId === campaignId) resetComposer();
          notify.success("Campanha removida");
        }

        await loadPageData({ silent: true });
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Falha na ação da campanha");
      } finally {
        setActionCampaignId(null);
        setActionType(null);
      }
    },
    [campaigns, editingCampaignId, loadPageData, resetComposer],
  );

  const toggleContact = useCallback((contactKey: string) => {
    setSelectedContactIds((current) =>
      current.includes(contactKey)
        ? current.filter((entry) => entry !== contactKey)
        : [...current, contactKey],
    );
  }, []);

  const toggleSelectAllVisibleContacts = useCallback(() => {
    const visibleKeys = filteredContacts.map((contact) => String(contact.phone || contact.id));
    const everySelected = visibleKeys.every((key) => selectedContactIds.includes(key));

    if (everySelected) {
      setSelectedContactIds((current) => current.filter((key) => !visibleKeys.includes(key)));
      return;
    }

    setSelectedContactIds((current) => Array.from(new Set([...current, ...visibleKeys])));
  }, [filteredContacts, selectedContactIds]);

  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        notify.error("Arquivo CSV vazio.");
        return;
      }

      const separator = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase());

      const nameIdx = headers.findIndex((h) => h.includes("nome") || h.includes("name"));
      const phoneIdx = headers.findIndex((h) => h.includes("fone") || h.includes("phone") || h.includes("tel"));

      const importedContacts: Contact[] = [];
      const newSelectedIds: string[] = [];

      let importedCount = 0;
      let ignoredCount = 0;
      let duplicateCount = 0;

      const seenInCsv = new Set<string>();
      const existingPhones = new Set(contacts.map((c) => normalizePhone(c.phone)));

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(separator).map((p) => p.trim());
        const phoneRaw = phoneIdx !== -1 ? parts[phoneIdx] : parts[0];
        const nameRaw = nameIdx !== -1 ? parts[nameIdx] : parts[1];

        const cleanPhone = phoneRaw?.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 8) {
          ignoredCount++;
          continue;
        }

        const phoneKey = cleanPhone;

        if (seenInCsv.has(phoneKey) || existingPhones.has(phoneKey)) {
          duplicateCount++;
          if (existingPhones.has(phoneKey) && !selectedContactIds.includes(phoneKey)) {
            newSelectedIds.push(phoneKey);
          }
          continue;
        }

        seenInCsv.add(phoneKey);

        const newContact: Contact = {
          id: `csv-${phoneKey}`,
          name: nameRaw || `Importado ${phoneKey}`,
          phone: phoneKey,
          status: "Importado",
          updatedAt: new Date().toISOString(),
        };

        importedContacts.push(newContact);
        newSelectedIds.push(phoneKey);
        importedCount++;
      }

      if (importedContacts.length > 0) {
        setContacts((prev) => [...prev, ...importedContacts]);
      }

      if (newSelectedIds.length > 0) {
        setSelectedContactIds((current) => Array.from(new Set([...current, ...newSelectedIds])));
      }

      notify.success(
        `Importação concluída. Importados: ${importedCount} | Ignorados: ${ignoredCount} | Duplicados: ${duplicateCount}`,
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleApplyTagSelection = async () => {
    const tag = tagInputVal.trim();
    if (!tag) return;

    const normalizedTag = tag.toLowerCase();
    try {
      const conversations = await apiService.getConversations(false);
      const matchingPhones = conversations
        .filter((conv) => conv.tags?.some((t) => t.toLowerCase() === normalizedTag))
        .map((conv) => normalizePhone(conv.phone))
        .filter(Boolean);

      const matchedContactKeys = contacts
        .filter((c) => matchingPhones.includes(normalizePhone(c.phone)))
        .map((c) => String(c.phone || c.id));

      if (matchedContactKeys.length === 0) {
        notify.error(`Nenhum contato encontrado com a tag "${tag}" na lista atual.`);
      } else {
        setSelectedContactIds((current) => Array.from(new Set([...current, ...matchedContactKeys])));
        notify.success(`${matchedContactKeys.length} contatos com a tag "${tag}" selecionados.`);
        setIsTagModalOpen(false);
        setTagInputVal("");
      }
    } catch (err) {
      console.error(err);
      notify.error("Erro ao filtrar contatos por etiquetas.");
    }
  };

  const stepProgress = (campaignStep / STEP_LABELS.length) * 100;
  const lovableCampaignsViewModel = createCampaignsLovableViewModel(campaigns);

  return (
    <div className="min-h-screen">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleCsvImport}
        accept=".csv"
        className="hidden"
      />
      <Header
        title="Campanhas"
        subtitle="Disparos em massa e campanhas programadas"
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void persistCampaign("save")}>
              Salvar Rascunho
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
              Importar Contatos
            </Button>
            <Button size="sm" className="rounded-xl shadow-glow" onClick={resetComposer}>
              <Plus className="h-4 w-4" />
              Nova Campanha
            </Button>
          </>
        }
      />

      <div>
        {loading ? (
          <div className="page-container section-stack">
            <StatGridSkeleton count={4} />
          </div>
        ) : (
          <CampaignsView
            summaryCards={
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                        <Megaphone weight="duotone" className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Campanhas</p>
                        <h3 className="font-display text-2xl font-bold">{lovableCampaignsViewModel.totalCampaigns}</h3>
                      </div>
                    </div>
                    <OperationalStatusBadge label="Base persistida" tone="syncing" />
                  </CardContent>
                </Card>

                <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/10">
                        <PaperPlaneTilt weight="fill" className="h-6 w-6 text-info" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Envios</p>
                        <h3 className="font-display text-2xl font-bold">{lovableCampaignsViewModel.sentMessages.toLocaleString("pt-BR")}</h3>
                      </div>
                    </div>
                    <OperationalStatusBadge label="Pipeline ativo" tone="online" />
                  </CardContent>
                </Card>

                <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10">
                        <Eye weight="duotone" className="h-6 w-6 text-success" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contatos na fila</p>
                        <h3 className="font-display text-2xl font-bold">{lovableCampaignsViewModel.totalQueuedContacts.toLocaleString("pt-BR")}</h3>
                      </div>
                    </div>
                    <OperationalStatusBadge label="Segmentação pronta" tone="online" />
                  </CardContent>
                </Card>

                <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10">
                        <CheckCircle weight="fill" className="h-6 w-6 text-warning" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Etapa atual</p>
                        <h3 className="font-display text-2xl font-bold">{campaignStep}/{STEP_LABELS.length}</h3>
                      </div>
                    </div>
                    <OperationalStatusBadge label={composerMode === "edit" ? "Modo edição" : composerMode === "duplicate" ? "Duplicando" : "Novo rascunho"} tone="warning" />
                  </CardContent>
                </Card>
              </div>
            }
            composer={
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-5 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="mt-1 font-display text-2xl font-semibold">Nova Campanha de Alta Conversão</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                        Importar CSV
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={() => void persistCampaign("save")}>
                        Salvar Rascunho
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                    {STEP_LABELS.map((label, index) => {
                      const step = index + 1;
                      const active = campaignStep === step;
                      const complete = campaignStep > step;
                      return (
                        <button
                          key={label}
                          type="button"
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-xl border border-transparent px-3 py-4 text-center transition-all",
                            active && "border-primary/30 bg-primary/10 shadow-glow",
                            complete && !active && "text-success",
                          )}
                          onClick={() => setCampaignStep(step)}
                        >
                          <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm", active ? "border-primary/40 text-primary" : "border-border/70 text-muted-foreground")}>{step}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {campaignStep === 1 && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-2xl font-semibold">Definir Público-Alvo</h3>
                          <p className="mt-2 text-base text-muted-foreground">Escolha os contatos que receberão esta campanha.</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
                          {selectedContactCount} Leads Selecionados
                        </Badge>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <button type="button" onClick={() => { setSelectedContactIds(contacts.map(c => String(c.phone || c.id))); notify.success("Todos os leads da base foram selecionados!"); }} className="rounded-2xl border border-success/20 bg-success/5 p-6 text-left transition-colors hover:bg-success/10">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10">
                            <Users className="h-6 w-6 text-success" />
                          </div>
                          <p className="mt-5 text-2xl font-semibold">Filtro Atual</p>
                          <p className="mt-3 text-sm text-muted-foreground">Usar leads do mapa ou CRM</p>
                        </button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-border/70 bg-background/30 p-6 text-left transition-colors hover:bg-card/60">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60">
                            <ArrowClockwise className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="mt-5 text-2xl font-semibold">Importar Lista</p>
                          <p className="mt-3 text-sm text-muted-foreground">Planilha .xlsx ou .csv</p>
                        </button>
                        <button type="button" onClick={() => setIsTagModalOpen(true)} className="rounded-2xl border border-border/70 bg-background/30 p-6 text-left transition-colors hover:bg-card/60">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60">
                            <Badge variant="secondary" className="h-10 rounded-xl px-3 text-sm">#</Badge>
                          </div>
                          <p className="mt-5 text-2xl font-semibold">Por Etiquetas</p>
                          <p className="mt-3 text-sm text-muted-foreground">Segmentar por tags do CRM</p>
                        </button>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-background/30">
                        <div className="flex items-center justify-between border-b border-border/70 px-4 py-4">
                          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lista de Disparo</p>
                          <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Buscar na lista..."
                            className="h-10 w-full max-w-xs rounded-xl"
                          />
                        </div>
                        <div className="scrollbar-thin max-h-[420px] space-y-2 overflow-y-auto p-4">
                          {filteredContacts.length === 0 ? (
                            <EmptyState
                              icon={<Users className="h-8 w-8 text-muted-foreground/50" />}
                              title="Nenhum contato disponível"
                              description="Sincronize contatos reais para alimentar a campanha oficial."
                            />
                          ) : (
                            filteredContacts.map((contact) => {
                              const key = String(contact.phone || contact.id);
                              const checked = selectedContactIds.includes(key);
                              return (
                                <div
                                  key={key}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggleContact(key)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      toggleContact(key);
                                    }
                                  }}
                                  className={cn(
                                    "flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                    checked
                                      ? "border-primary/40 bg-primary/10"
                                      : "border-border/70 bg-card/60 hover:border-border hover:bg-card/80",
                                  )}
                                >
                                  <Checkbox checked={checked} className="mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{contact.name || "Contato"}</p>
                                    <p className="truncate text-xs text-muted-foreground">{contact.phone || "Sem telefone"}</p>
                                  </div>
                                  {contact.status ? <Badge variant="secondary">{contact.status}</Badge> : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {campaignStep === 2 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">Variantes da mensagem</p>
                          <p className="text-xs text-muted-foreground">Crie textos alternativos reais para personalizar os envios.</p>
                        </div>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => setMessageVariants((current) => [...current, ""])}
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar variante
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {messageVariants.map((variant, index) => (
                          <Card key={`variant-${index}`} className="rounded-2xl border-border/70 bg-background/30">
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">Mensagem {index + 1}</p>
                                  <p className="text-xs text-muted-foreground">Texto enviado para o contato durante a campanha.</p>
                                </div>
                                {messageVariants.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-xl"
                                    onClick={() => setMessageVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <Textarea
                                value={variant}
                                onChange={(event) =>
                                  setMessageVariants((current) =>
                                    current.map((entry, itemIndex) => (itemIndex === index ? event.target.value : entry)),
                                  )
                                }
                                placeholder="Escreva a mensagem da variante"
                                className="min-h-[120px]"
                              />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {campaignStep === 3 && (
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Randomização</p>
                              <p className="text-xs text-muted-foreground">Alterna as variantes para distribuir melhor os envios.</p>
                            </div>
                            <Switch checked={shuffleEnabled} onCheckedChange={setShuffleEnabled} />
                          </div>
                          <OperationalStatusBadge label={shuffleEnabled ? "Shuffle ativo" : "Shuffle desligado"} tone={shuffleEnabled ? "online" : "offline"} />
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <div>
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span>Typing delay</span>
                              <span>{typingDelay[0].toFixed(1)}s</span>
                            </div>
                            <Slider value={typingDelay} min={0.5} max={8} step={0.1} onValueChange={setTypingDelay} />
                          </div>
                          <div>
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span>Intervalo entre contatos</span>
                              <span>{intervalSeconds[0]}s</span>
                            </div>
                            <Slider value={intervalSeconds} min={2} max={60} step={1} onValueChange={setIntervalSeconds} />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                            <div>
                              <label className="mb-2 block text-sm font-medium">Pausar a cada X envios</label>
                              <Input value={pauseEvery} onChange={(event) => setPauseEvery(event.target.value)} inputMode="numeric" />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium">Tempo da pausa (s)</label>
                              <Input value={pauseSeconds} onChange={(event) => setPauseSeconds(event.target.value)} inputMode="numeric" />
                            </div>
                            <div className="md:col-span-2 lg:col-span-1">
                              <label className="mb-2 block text-sm font-medium">Agendamento opcional</label>
                              <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {campaignStep === 4 && (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <div>
                            <p className="text-sm font-medium">Prévia da campanha</p>
                            <p className="text-xs text-muted-foreground">Confira a estrutura final antes de salvar ou lançar.</p>
                          </div>
                          <div className="space-y-2 rounded-2xl border border-border/70 bg-card/80 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Nome</p>
                            <p className="text-lg font-semibold">{campaignName || "Campanha sem nome"}</p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Contatos selecionados</p>
                              <p className="mt-1 font-display text-2xl font-bold">{selectedContactCount}</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Mensagens ativas</p>
                              <p className="mt-1 font-display text-2xl font-bold">{cleanMessages.length}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {cleanMessages.map((message, index) => (
                              <div key={`preview-${index}`} className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
                                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Variante {index + 1}</p>
                                <p className="text-foreground">{message}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <p className="text-sm font-medium">Checklist operacional</p>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <p>• Typing delay: <span className="font-medium text-foreground">{typingDelay[0].toFixed(1)}s</span></p>
                            <p>• Intervalo por contato: <span className="font-medium text-foreground">{intervalSeconds[0]}s</span></p>
                            <p>• Pausa a cada: <span className="font-medium text-foreground">{pauseEvery} envios</span></p>
                            <p>• Tempo da pausa: <span className="font-medium text-foreground">{pauseSeconds}s</span></p>
                            <p>• Agendamento: <span className="font-medium text-foreground">{startAt ? formatDateTime(new Date(startAt).toISOString()) : "Imediato"}</span></p>
                            <p>• Shuffle: <span className="font-medium text-foreground">{shuffleEnabled ? "Ativo" : "Desligado"}</span></p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tags</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {tagsInput
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                                .map((tag) => (
                                  <Badge key={tag} variant="secondary" className="rounded-full border border-border/70 bg-background/60">
                                    {tag}
                                  </Badge>
                                ))}
                              {!tagsInput.trim() && <span className="text-sm text-muted-foreground">Sem tags definidas</span>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {campaignStep === 5 && (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <div>
                            <p className="text-sm font-medium">Pronto para persistir e lançar</p>
                            <p className="text-xs text-muted-foreground">O rascunho é salvo em `/api/campaigns` e o lançamento usa o runtime oficial de campanhas.</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado esperado</p>
                            <p className="mt-2 text-sm text-foreground">A campanha será persistida com contatos, mensagens, tags, fila e configuração de envio. Em seguida, poderá ser executada no backend oficial.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <OperationalStatusBadge label={`${selectedContactCount} contatos`} tone={selectedContactCount > 0 ? "online" : "offline"} />
                            <OperationalStatusBadge label={`${cleanMessages.length} mensagens`} tone={cleanMessages.length > 0 ? "online" : "offline"} />
                            <OperationalStatusBadge label={startAt ? "Com agendamento" : "Execução imediata"} tone="syncing" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <p className="text-sm font-medium">Readiness</p>
                          {launchReadiness.length === 0 ? (
                            <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-success">
                              Campanha consistente para salvar ou lançar.
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                              {launchReadiness.map((item) => (
                                <p key={item}>• {item}</p>
                              ))}
                            </div>
                          )}
                          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">Modo atual</p>
                            <p className="mt-1">{composerMode === "edit" ? "Editando uma campanha existente" : composerMode === "duplicate" ? "Gerando uma cópia pronta para ajustes" : "Criando um novo rascunho"}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="outline" className="rounded-xl" onClick={resetComposer}>
                      Cancelar
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-xl" disabled={campaignStep === 1} onClick={() => setCampaignStep((current) => Math.max(1, current - 1))}>
                        Voltar
                      </Button>
                      <Button className="rounded-xl shadow-glow" disabled={campaignStep === STEP_LABELS.length} onClick={() => setCampaignStep((current) => Math.min(STEP_LABELS.length, current + 1))}>
                        Próximo Passo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="space-y-4 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">Resumo lateral</p>
                    <h3 className="mt-1 font-display text-lg font-semibold">Operação da campanha</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Nome atual</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{campaignName || "Aguardando definição"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Contatos</p>
                        <p className="mt-1 font-display text-2xl font-bold">{selectedContactCount}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Variantes</p>
                        <p className="mt-1 font-display text-2xl font-bold">{cleanMessages.length}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Cadência</p>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <p>Typing delay: <span className="font-medium text-foreground">{typingDelay[0].toFixed(1)}s</span></p>
                        <p>Intervalo: <span className="font-medium text-foreground">{intervalSeconds[0]}s</span></p>
                        <p>Pausa: <span className="font-medium text-foreground">{pauseEvery} / {pauseSeconds}s</span></p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Prévia da audiência</p>
                      <div className="mt-3 space-y-2">
                        {selectedContacts.slice(0, 5).map((contact) => (
                          <div key={`${contact.id}-${contact.phone}`} className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm">
                            <p className="font-medium">{contact.name || "Contato"}</p>
                            <p className="text-xs text-muted-foreground">{contact.phone || "Sem telefone"}</p>
                          </div>
                        ))}
                        {selectedContacts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contato selecionado.</p>}
                        {selectedContacts.length > 5 && <p className="text-xs text-muted-foreground">+ {selectedContacts.length - 5} contatos adicionais</p>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            }
            listSection={
              <>
                <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">Campanhas persistidas</p>
                <h2 className="mt-1 font-display text-lg font-semibold">Lista operacional</h2>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => void loadPageData()} disabled={actionType === "refresh"}>
                <ArrowClockwise className="h-4 w-4" />
                Atualizar lista
              </Button>
            </div>

            {campaigns.length === 0 ? (
              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="p-0">
                  <EmptyState
                    icon={<Megaphone className="h-8 w-8 text-muted-foreground/50" />}
                    title="Nenhuma campanha disponível"
                    description="Crie a primeira campanha oficial para persistir audiência, mensagens e configurações diretamente no backend consolidado."
                    action={
                      <Button className="rounded-xl shadow-glow" onClick={resetComposer}>
                        Criar campanha
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {campaigns.map((campaign) => {
                  const meta = statusMeta(campaign);
                  const recipients = Number(campaign.queue?.total ?? campaign.selectedContacts?.length ?? 0);
                  const sent = Number(campaign.queue?.sent ?? 0);
                  const progress = recipients > 0 ? Math.min(100, Math.round((sent / recipients) * 100)) : 0;
                  const busy = actionCampaignId === campaign.id;

                  return (
                    <Card key={campaign.id} className="glass-card overflow-hidden rounded-2xl border-border/70 bg-card/85">
                      <div className={cn("h-1", meta.cardLine)} />
                      <CardContent className="space-y-4 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-display text-xl font-semibold">{campaign.name}</h3>
                              <OperationalStatusBadge label={meta.label} tone={meta.tone} pulse={meta.tone === "syncing"} />
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {(campaign.messages ?? []).map((message) => message.content).filter(Boolean).join(" • ") || "Sem mensagem cadastrada"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(campaign.tags ?? []).map((tag) => (
                                <Badge key={tag} variant="secondary" className="rounded-full border border-border/70 bg-background/60 text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {(campaign.tags ?? []).length === 0 && <Badge variant="secondary">Sem tags</Badge>}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 lg:w-[220px]">
                            <Button variant="outline" className="rounded-xl" onClick={() => hydrateComposer(campaign, "edit")}>
                              <PencilSimple className="h-4 w-4" />
                              Editar
                            </Button>
                            <Button variant="outline" className="rounded-xl" onClick={() => hydrateComposer(campaign, "duplicate")}>
                              <Copy className="h-4 w-4" />
                              Duplicar
                            </Button>
                            {normalizeCampaignStatus(campaign) === "paused" ? (
                              <Button className="rounded-xl shadow-glow" onClick={() => void runCampaignAction(campaign.id, "resume")} disabled={busy}>
                                {busy && actionType === "resume" ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Retomar
                              </Button>
                            ) : (
                              <Button className="rounded-xl shadow-glow" onClick={() => void runCampaignAction(campaign.id, "start")} disabled={busy}>
                                {busy && actionType === "start" ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Iniciar
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => void runCampaignAction(campaign.id, "delete")}
                              disabled={busy}
                            >
                              {busy && actionType === "delete" ? <Clock className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                              Excluir
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Contatos</p>
                            <p className="mt-1 font-display text-2xl font-bold">{recipients}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Enviadas</p>
                            <p className="mt-1 font-display text-2xl font-bold">{sent}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Falhas</p>
                            <p className="mt-1 font-display text-2xl font-bold">{Number(campaign.queue?.failed ?? 0)}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Agendamento</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{formatDateTime(campaign.settings?.startAt)}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progresso operacional</span>
                            <span className="font-medium text-foreground">{progress}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => hydrateComposer(campaign, "edit")}>
                            <ArrowClockwise className="h-4 w-4" />
                            Carregar no editor
                          </Button>
                          {normalizeCampaignStatus(campaign) !== "paused" && normalizeCampaignStatus(campaign) !== "completed" && (
                            <Button variant="outline" className="rounded-xl" onClick={() => void runCampaignAction(campaign.id, "pause")} disabled={busy}>
                              {busy && actionType === "pause" ? <Clock className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                              Pausar
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
            }
          />
        )}
      </div>

      <Dialog open={isTagModalOpen} onOpenChange={setIsTagModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border/70 bg-card/95">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Selecionar por Etiqueta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="tag-input" className="text-sm font-medium">Nome da etiqueta (tag)</Label>
              <Input
                id="tag-input"
                placeholder="Ex: cliente, pendente, etc"
                value={tagInputVal}
                onChange={(e) => setTagInputVal(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setIsTagModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="rounded-xl shadow-glow" onClick={handleApplyTagSelection}>
                Aplicar Filtro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
