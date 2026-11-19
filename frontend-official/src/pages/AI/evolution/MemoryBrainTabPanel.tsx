import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain,
  Building2,
  CheckCircle2,
  Clock,
  Edit3,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";
import {
  type AgentOption,
  type CategoryCountsMap,
  type EnterpriseMemoryItem,
  type MemoryCategory,
  type MemoryScope,
  type WhatsAppSessionOption,
  MEMORY_CATEGORY_BY_ID,
  MEMORY_CATEGORY_META,
  MEMORY_SCOPE_LABELS,
  formatConfidencePct,
  formatDateTime,
  formatMemoryOrigin,
  formatNumber,
} from "./types";

interface MemoryBrainTabPanelProps {
  agentKey: string;
  sessionId: string;
  agents: AgentOption[];
  sessions: WhatsAppSessionOption[];
  refreshTrigger?: number;
  onDataChanged?: () => void;
}

interface MemoryFormState {
  title: string;
  content: string;
  category: MemoryCategory;
  memoryScope: MemoryScope;
  agentKey: string;
  sessionId: string;
  confidencePct: number;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.error ||
    anyErr?.response?.data?.message ||
    (err instanceof Error ? err.message : null) ||
    fallback
  );
}

export function MemoryBrainTabPanel({
  agentKey,
  sessionId,
  agents,
  sessions,
  refreshTrigger = 0,
  onDataChanged,
}: MemoryBrainTabPanelProps) {
  const { toast } = useToast();
  const requestIdRef = useRef(0);

  const [items, setItems] = useState<EnterpriseMemoryItem[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCountsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // CRUD Dialog State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<EnterpriseMemoryItem | null>(null);
  const [formState, setFormState] = useState<MemoryFormState>({
    title: "",
    content: "",
    category: "insights",
    memoryScope: "agent",
    agentKey: "",
    sessionId: "",
    confidencePct: 90,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Action / Delete state
  const [togglingId, setTogglingId] = useState<string | number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnterpriseMemoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadMemories = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      if (typeof apiService?.listEnterpriseMemories !== "function") {
        throw new Error("Serviço de listagem de memórias indisponível.");
      }
      const res = await apiService.listEnterpriseMemories({
        agentKey: agentKey && agentKey !== "all" ? agentKey : undefined,
        sessionId: sessionId && sessionId !== "all" ? sessionId : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        search: debouncedSearch || undefined,
        status: statusFilter,
        scope: scopeFilter,
        limit: 120,
      });
      if (reqId !== requestIdRef.current) return;
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Não foi possível carregar as memórias.");
      }
      setItems(Array.isArray(res?.items) ? res.items : []);
      setCategoryCounts(res?.categoryCounts || {});
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setItems([]);
      setError(extractErrorMessage(err, "Falha ao carregar memórias do PostgreSQL."));
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, [agentKey, sessionId, categoryFilter, debouncedSearch, statusFilter, scopeFilter, refreshTrigger]);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  const defaultFormAgentKey = useMemo(() => {
    if (agentKey && agentKey !== "all") return agentKey;
    const first = agents.find((a) => !a.isPlatformAssistant && a.key !== "zaibot");
    return first?.key || first?.id || "";
  }, [agentKey, agents]);

  const openCreateModal = () => {
    setEditingMemory(null);
    setFormError(null);
    setFormState({
      title: "",
      content: "",
      category: categoryFilter !== "all" ? (categoryFilter as MemoryCategory) : "commercial_rules",
      memoryScope: scopeFilter !== "all" ? (scopeFilter as MemoryScope) : "agent",
      agentKey: defaultFormAgentKey,
      sessionId: sessionId && sessionId !== "all" ? sessionId : "",
      confidencePct: 90,
    });
    setEditorOpen(true);
  };

  const openEditModal = (memory: EnterpriseMemoryItem) => {
    setEditingMemory(memory);
    setFormError(null);
    const rawConf = Number(memory.confidence);
    const confPct = Number.isFinite(rawConf)
      ? rawConf <= 1 && rawConf > 0
        ? Math.round(rawConf * 100)
        : Math.round(rawConf)
      : 90;
    setFormState({
      title: memory.title || "",
      content: memory.content || "",
      category: (MEMORY_CATEGORY_BY_ID[memory.category]?.id || "insights") as MemoryCategory,
      memoryScope: (["agent", "session", "company_shared"].includes(memory.memoryScope)
        ? memory.memoryScope
        : "agent") as MemoryScope,
      agentKey: memory.agentKey || defaultFormAgentKey,
      sessionId: memory.sessionId || "",
      confidencePct: Math.min(100, Math.max(10, confPct)),
    });
    setEditorOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = formState.title.trim();
    const trimmedContent = formState.content.trim();
    if (!trimmedContent || trimmedContent.length < 3) {
      setFormError("Informe o conteúdo da memória (mínimo de 3 caracteres).");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editingMemory) {
        const res = await apiService.updateEnterpriseMemory(editingMemory.id, {
          title: trimmedTitle || trimmedContent.slice(0, 80),
          content: trimmedContent,
          category: formState.category,
          memoryScope: formState.memoryScope,
        });
        if ((res as any)?.success === false) {
          throw new Error((res as any)?.error || "Não foi possível atualizar a memória.");
        }
        toast({
          title: "Memória atualizada",
          description: "Alteração persistida no PostgreSQL com proteção anti-injeção.",
        });
      } else {
        const res = await apiService.createEnterpriseMemory({
          agentKey: formState.agentKey || undefined,
          sessionId: formState.memoryScope === "session" ? formState.sessionId || null : null,
          memoryScope: formState.memoryScope,
          category: formState.category,
          title: trimmedTitle || trimmedContent.slice(0, 80),
          content: trimmedContent,
          confidence: Math.min(1, Math.max(0.1, formState.confidencePct / 100)),
        });
        if ((res as any)?.success === false) {
          throw new Error((res as any)?.error || "Não foi possível salvar a memória.");
        }
        toast({
          title: "Memória criada",
          description: "Nova memória gravada no PostgreSQL e vinculada ao escopo selecionado.",
        });
      }
      setEditorOpen(false);
      await loadMemories();
      onDataChanged?.();
    } catch (err) {
      const msg = extractErrorMessage(err, "Erro ao salvar memória.");
      setFormError(msg);
      toast({
        title: "Operação bloqueada ou inválida",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (memory: EnterpriseMemoryItem) => {
    const nextStatus = memory.status === "active" ? "disabled" : "active";
    setTogglingId(memory.id);
    try {
      const res = await apiService.updateEnterpriseMemory(memory.id, { status: nextStatus });
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Falha ao alterar status.");
      }
      toast({
        title: nextStatus === "active" ? "Memória reativada" : "Memória desativada",
        description:
          nextStatus === "active"
            ? "A memória voltou a compor o contexto ativo da IA."
            : "A memória permanece registrada, mas não será recuperada nos atendimentos.",
      });
      await loadMemories();
      onDataChanged?.();
    } catch (err) {
      toast({
        title: "Erro ao alterar status",
        description: extractErrorMessage(err, "Não foi possível atualizar a memória."),
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await apiService.deleteEnterpriseMemory(deleteTarget.id);
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Falha ao excluir memória.");
      }
      toast({
        title: "Memória excluída",
        description: `"${deleteTarget.title}" foi removida permanentemente.`,
      });
      setDeleteTarget(null);
      await loadMemories();
      onDataChanged?.();
    } catch (err) {
      toast({
        title: "Erro ao excluir",
        description: extractErrorMessage(err, "Não foi possível excluir a memória."),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const totalAcrossCategories = useMemo(() => {
    return MEMORY_CATEGORY_META.reduce((acc, cat) => {
      const entry = categoryCounts[cat.id];
      if (!entry) return acc;
      return acc + (statusFilter === "active" ? entry.active : entry.total);
    }, 0);
  }, [categoryCounts, statusFilter]);

  const selectableAgents = useMemo(
    () => agents.filter((a) => !a.isPlatformAssistant && a.key !== "zaibot"),
    [agents]
  );

  return (
    <div className="space-y-4">
      {/* SECURITY & ACTION HEADER */}
      <Card className="border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Brain className="h-4 w-4 text-emerald-400" />
                Cérebro & Memória Corporativa
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Gestão auditável das 7 categorias canônicas de memória persistidas no PostgreSQL.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadMemories()}
                disabled={isLoading}
                className="h-8 text-xs"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
                Atualizar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={openCreateModal}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nova Memória
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* INLINE PROMPT-INJECTION PROTECTION NOTE */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 flex items-start gap-2.5 text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-muted-foreground">
              <p className="font-semibold text-emerald-300">
                Proteção anti-injeção de prompt ativa
              </p>
              <p className="text-[11px] leading-relaxed">
                Todo conteúdo salvo passa por sanitização contra sobrescrita de instruções de sistema, alteração forçada de preço ou jailbreak. Mensagens de clientes nunca criam regras comerciais ou preços permanentes automaticamente.
              </p>
            </div>
          </div>

          {/* 7 CANONICAL CATEGORY PILLS + TODAS */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Categorias de memória">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                categoryFilter === "all"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <span>Todas</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-background/60">
                {error ? "—" : formatNumber(totalAcrossCategories)}
              </span>
            </button>

            {MEMORY_CATEGORY_META.map((cat) => {
              const counts = categoryCounts[cat.id];
              const countValue = counts
                ? statusFilter === "active"
                  ? counts.active
                  : counts.total
                : null;
              const isSelected = categoryFilter === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  title={cat.description}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", cat.dotClass)} />
                  <span>{cat.label}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-background/60">
                    {error ? "—" : countValue == null ? "—" : formatNumber(countValue)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* SEARCH, SCOPE & STATUS FILTERS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
            <div className="lg:col-span-5 relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar título, conteúdo ou palavra-chave..."
                className="h-9 pl-8 text-xs bg-background/50 border-border/70"
              />
            </div>

            <div className="lg:col-span-4 flex flex-wrap items-center gap-1 p-1 rounded-xl border border-border/70 bg-background/40">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "agent", label: "Agente" },
                  { id: "session", label: "WhatsApp" },
                  { id: "company_shared", label: "Compartilhado Empresa" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScopeFilter(opt.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                    scopeFilter === opt.id
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="lg:col-span-3 flex items-center justify-end gap-1 p-1 rounded-xl border border-border/70 bg-background/40">
              {(
                [
                  { id: "active", label: "Ativas" },
                  { id: "disabled", label: "Desativadas" },
                  { id: "all", label: "Todas" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatusFilter(opt.id)}
                  className={cn(
                    "flex-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                    statusFilter === opt.id
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MEMORY CARDS LIST */}
      {error ? (
        <Card role="alert" className="border-destructive/40 bg-destructive/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-destructive">Não foi possível carregar as memórias</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadMemories()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
          </Button>
        </Card>
      ) : isLoading ? (
        <div role="status" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <Card key={idx} className="border-border/70 bg-card/70 p-4 space-y-3 animate-pulse">
              <div className="h-4 w-32 bg-muted/50 rounded" />
              <div className="h-12 w-full bg-muted/30 rounded" />
              <div className="h-4 w-48 bg-muted/40 rounded" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card role="status" className="border-dashed border-border/70 bg-card/50 p-8 text-center space-y-2">
          <Brain className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Nenhuma memória registrada para este filtro</p>
          <p className="text-xs text-muted-foreground">
            Crie uma nova memória operacional ou ajuste categoria, escopo, status e busca.
          </p>
          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              onClick={openCreateModal}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Memória
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((mem) => {
            const catMeta = MEMORY_CATEGORY_BY_ID[mem.category] || MEMORY_CATEGORY_BY_ID.insights;
            const isActive = mem.status === "active";
            const isToggling = togglingId === mem.id;
            const scopeLabel = MEMORY_SCOPE_LABELS[mem.memoryScope] || mem.memoryScope || "—";

            return (
              <Card
                key={mem.id}
                className={cn(
                  "border-border/80 bg-card/85 shadow-sm flex flex-col justify-between transition-colors",
                  !isActive && "opacity-75 border-border/50 bg-card/50"
                )}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Top Badges Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[10px] font-semibold", catMeta.badgeClass)}>
                        {mem.categoryLabel || catMeta.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold",
                          isActive
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-500/40 bg-zinc-500/10 text-zinc-400"
                        )}
                      >
                        {isActive ? (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Ativa
                          </span>
                        ) : (
                          "Desativada"
                        )}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-border/70 text-muted-foreground">
                        {scopeLabel}
                      </Badge>
                    </div>

                    <span className="text-[11px] font-mono text-muted-foreground">
                      Confiança: <strong className="text-foreground">{formatConfidencePct(mem.confidence)}</strong>
                    </span>
                  </div>

                  {/* Title & Content */}
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground leading-snug">{mem.title}</h4>
                    <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                      {mem.content}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        Agente: <strong className="text-foreground">{mem.agentKey || "—"}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        Empresa: <strong className="text-foreground">{mem.companyId || "—"}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Smartphone className="h-3 w-3 text-cyan-400 shrink-0" />
                      <span className="truncate">
                        Origem: <strong className="text-foreground">{formatMemoryOrigin(mem.origin, mem.provenance)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Brain className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>
                        Ocorrências: <strong className="font-mono text-foreground">{formatNumber(mem.occurrences)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">Criada: {formatDateTime(mem.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">Atualizada: {formatDateTime(mem.updatedAt)}</span>
                    </div>
                  </div>
                </CardContent>

                {/* CRUD Actions Footer */}
                <div className="px-4 py-2.5 border-t border-border/50 bg-background/30 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    ID #{mem.id}
                    {mem.sessionId ? ` • Sessão ${mem.sessionId}` : ""}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(mem)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isToggling}
                      onClick={() => void handleToggleStatus(mem)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-emerald-300"
                    >
                      {isActive ? (
                        <>
                          <PauseCircle className="h-3 w-3 mr-1" /> Desativar
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-3 w-3 mr-1" /> Reativar
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(mem)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MEMORY DIALOG */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {editingMemory ? "Editar Memória" : "Nova Memória Operacional"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Memórias salvas são verificadas contra injeção de prompt antes de serem persistidas no PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-3.5">
            {formError && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="memory-title" className="text-xs font-semibold text-foreground">
                Título resumido
              </label>
              <Input
                id="memory-title"
                value={formState.title}
                onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex.: Política oficial de prazo de entrega"
                className="h-9 text-xs bg-background/60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="memory-category" className="text-xs font-semibold text-foreground">
                  Categoria
                </label>
                <select
                  id="memory-category"
                  value={formState.category}
                  onChange={(e) => setFormState((prev) => ({ ...prev, category: e.target.value as MemoryCategory }))}
                  className="h-9 w-full rounded-md border border-input bg-background/60 px-2.5 text-xs text-foreground outline-none focus:border-emerald-500"
                >
                  {MEMORY_CATEGORY_META.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-popover text-foreground">
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="memory-scope" className="text-xs font-semibold text-foreground">
                  Escopo
                </label>
                <select
                  id="memory-scope"
                  value={formState.memoryScope}
                  onChange={(e) => setFormState((prev) => ({ ...prev, memoryScope: e.target.value as MemoryScope }))}
                  className="h-9 w-full rounded-md border border-input bg-background/60 px-2.5 text-xs text-foreground outline-none focus:border-emerald-500"
                >
                  <option value="agent" className="bg-popover text-foreground">Agente</option>
                  <option value="session" className="bg-popover text-foreground">WhatsApp</option>
                  <option value="company_shared" className="bg-popover text-foreground">Compartilhado Empresa</option>
                </select>
              </div>
            </div>

            {!editingMemory && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="memory-agent" className="text-xs font-semibold text-foreground">
                    Atendente vinculado
                  </label>
                  <select
                    id="memory-agent"
                    value={formState.agentKey}
                    onChange={(e) => setFormState((prev) => ({ ...prev, agentKey: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background/60 px-2.5 text-xs text-foreground outline-none focus:border-emerald-500"
                  >
                    <option value="" className="bg-popover text-foreground">Padrão do sistema</option>
                    {selectableAgents.map((a) => {
                      const val = a.key || a.id || "";
                      return (
                        <option key={val} value={val} className="bg-popover text-foreground">
                          {a.name || val}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="memory-confidence" className="text-xs font-semibold text-foreground">
                    Confiança (%)
                  </label>
                  <Input
                    id="memory-confidence"
                    type="number"
                    min={10}
                    max={100}
                    value={formState.confidencePct}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        confidencePct: Math.min(100, Math.max(10, Number(e.target.value) || 90)),
                      }))
                    }
                    className="h-9 text-xs bg-background/60 font-mono"
                  />
                </div>
              </div>
            )}

            {!editingMemory && formState.memoryScope === "session" && (
              <div className="space-y-1.5">
                <label htmlFor="memory-session" className="text-xs font-semibold text-foreground">
                  Sessão WhatsApp
                </label>
                <select
                  id="memory-session"
                  value={formState.sessionId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, sessionId: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-background/60 px-2.5 text-xs text-foreground outline-none focus:border-emerald-500"
                >
                  <option value="" className="bg-popover text-foreground">Selecione uma conexão (opcional)</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id} className="bg-popover text-foreground">
                      {s.name} {s.phone ? `(${s.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="memory-content" className="text-xs font-semibold text-foreground">
                Conteúdo / Fato / Diretriz
              </label>
              <Textarea
                id="memory-content"
                rows={4}
                value={formState.content}
                onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Descreva a informação validada que o atendente deve considerar..."
                className="text-xs bg-background/60"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditorOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isSaving ? "Salvando..." : editingMemory ? "Salvar alterações" : "Criar Memória"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Excluir memória</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tem certeza que deseja excluir permanentemente "{deleteTarget?.title}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
            >
              {isDeleting ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
