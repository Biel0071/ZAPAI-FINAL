import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AddressBook, ChatCircleDots, Phone, SquaresFour, List, DotsThreeVertical, Tag, ChatCircle, PencilSimple, Kanban, Archive, Megaphone, Funnel } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ContactGrid, type ContactGridItem } from "@/components/contacts/ContactGrid";
import { ContactSidebar, type ContactSegment } from "@/components/contacts/ContactSidebar";
import { ChatSearchBar } from "@/components/inbox/ChatSearchBar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { StatGridSkeleton, ListSkeleton } from "@/components/ui/loading-skeleton";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import type { ContactsLovableViewModel } from "@/adapters/lovable/contactsAdapter";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TemperatureBadge } from "@/components/conversations/TemperatureBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

export interface ContactsViewProps {
  loading: boolean;
  error: string | null;
  searchQuery: string;
  tagFilter: string;
  activeSegment: ContactSegment;
  counts: Record<string, number>;
  viewModel: ContactsLovableViewModel;
  onSearchChange: (value: string) => void;
  onTagFilterChange: (value: string) => void;
  onSegmentChange: (segment: ContactSegment) => void;
  onRefresh: () => void;
  onGoToChat: (contact: { phone: string; id: string }) => void;
  onEditContact?: (contact: ContactGridItem) => void;

  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onBulkUpdate: (action: { status?: string; temperature?: string; addTag?: string; removeTag?: string }) => void;
  viewMode: "grid" | "list" | "kanban";
  onViewModeChange: (mode: "grid" | "list" | "kanban") => void;
  onUpdateContact?: (id: string, payload: { status?: string; lead_temperature?: string; tags?: string[]; funnel_stage?: string }) => void;
  onDeleteContact?: (id: string) => void;
}

export function ContactsView({
  loading,
  error,
  searchQuery,
  tagFilter,
  activeSegment,
  counts,
  viewModel,
  onSearchChange,
  onTagFilterChange,
  onSegmentChange,
  onRefresh,
  onGoToChat,
  onEditContact,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBulkUpdate,
  viewMode,
  onViewModeChange,
  onUpdateContact,
  onDeleteContact,
}: ContactsViewProps) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const allFilteredSelected = viewModel.contacts.length > 0 && viewModel.contacts.every(c => selectedIds.has(c.id));

  const segmentLabels: Record<string, string> = {
    all: "Todos",
    individual: "Individuais",
    inbox: "Inbox",
    lead: "Leads CRM",
    saved: "Salvos",
    grupos: "Grupos",
    archived: "Arquivados",
    lead_quente: "Lead Quente",
    lead_morno: "Lead Morno",
    lead_frio: "Lead Frio",
    ativo: "Ativos",
    recorrente: "Recorrentes",
    em_risco: "Em Risco",
    bloqueado: "Bloqueados",
  };

  const stages = useMemo(() => {
    const list = Array.from(
      new Set(
        viewModel.contacts
          .map((c: any) => c.funnelStage || "")
          .filter(Boolean)
      )
    ) as string[];

    const standard = ["new_lead", "interested", "price_sent", "negotiation", "ready_to_buy", "closed", "lost"];
    standard.forEach(s => {
      if (!list.includes(s)) list.push(s);
    });
    return list;
  }, [viewModel.contacts]);

  const navigate = useNavigate();

  const stageLabels: Record<string, string> = {
    new_lead: "Novo Lead",
    interested: "Interessado",
    price_sent: "Preço/Orçamento",
    negotiation: "Negociação",
    ready_to_buy: "Pronto para Comprar",
    closed: "Venda Fechada",
    lost: "Perdido",
  };

  return (
    <div className="page-container section-stack w-full max-w-full overflow-x-hidden">
      {loading ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {viewModel.summaryCards.map((card) => {
            const cardSegment = card.segment;
            const isActive = activeSegment === cardSegment;
            const isAll = cardSegment === "all";
            const isIndividual = cardSegment === "individual";
            const Icon = isAll ? AddressBook : isIndividual ? Phone : ChatCircleDots;
            const subtext = isAll ? "Leads cadastrados na base" : isIndividual ? "Contatos individuais ativos" : "Grupos e canais mapeados";

            return (
              <Card
                key={card.label}
                className={cn(
                  "glass-card metric-card rounded-2xl border-border/70 hover-lift cursor-pointer transition-all hover:scale-[1.01] hover:bg-card/95 select-none",
                  isActive && "border-primary/50 bg-primary/5 shadow-glow"
                )}
                onClick={() => onSegmentChange(cardSegment)}
              >
                <CardContent className="space-y-1 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{card.label}</p>
                    <div className={cn(
                      "h-6 w-6 rounded-lg flex items-center justify-center text-xs",
                      isAll ? "bg-primary/10 text-primary" : isIndividual ? "bg-sky-500/10 text-sky-400" : "bg-emerald-500/10 text-emerald-400"
                    )}>
                      <Icon className="h-3.5 w-3.5" weight="duotone" />
                    </div>
                  </div>
                  <p className="font-display text-2xl sm:text-3xl font-black">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground/80 truncate">{subtext}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Mobile Segment Filter Bar (< xl) */}
      <div className="xl:hidden flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0 font-medium">Segmento:</span>
          <Badge variant="secondary" className="truncate text-xs font-semibold">
            {segmentLabels[activeSegment] || activeSegment}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs gap-1.5 shrink-0"
          onClick={() => setMobileFilterOpen(true)}
        >
          <Funnel className="h-3.5 w-3.5 text-primary" />
          Filtrar ({counts[activeSegment] ?? 0})
        </Button>
      </div>

      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="text-sm font-bold flex items-center gap-2">
              <Funnel className="h-4 w-4 text-primary" /> Segmentos & Filtros
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-65px)] overflow-y-auto">
            <ContactSidebar
              activeSegment={activeSegment}
              counts={counts}
              onSegmentChange={(s) => {
                onSegmentChange(s);
                setMobileFilterOpen(false);
              }}
              className="border-0 bg-transparent"
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] w-full min-w-0">
        {/* Desktop Sidebar (>= xl) */}
        <div className="hidden xl:block">
          <ContactSidebar
            activeSegment={activeSegment}
            counts={counts}
            onSegmentChange={onSegmentChange}
            className="rounded-2xl border border-border/70 overflow-hidden shadow-xs"
          />
        </div>

        <div className="space-y-4 min-w-0 w-full">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between w-full min-w-0">
            <div className="flex flex-1 flex-col gap-2.5 sm:flex-row min-w-0">
              <div className="flex-1 min-w-0">
                <ChatSearchBar value={searchQuery} onChange={onSearchChange} placeholder="Buscar contatos..." />
              </div>
              <Input
                value={tagFilter}
                onChange={(event) => onTagFilterChange(event.target.value)}
                placeholder="Filtrar por tag..."
                className="w-full sm:w-44 rounded-xl text-xs h-10"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center rounded-xl border border-border bg-card/50 p-0.5">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => onViewModeChange("grid")}
                  title="Visualização em Grade"
                >
                  <SquaresFour className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => onViewModeChange("list")}
                  title="Visualização em Lista"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "kanban" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => onViewModeChange("kanban")}
                  title="Painel Kanban CRM"
                >
                  <Kanban className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                className="rounded-xl gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-semibold h-8 sm:h-9 px-2.5 sm:px-3 text-xs"
                onClick={() => navigate(`/campaigns?segment=${encodeURIComponent(activeSegment)}`)}
                title="Criar disparo para estes contatos"
              >
                <Megaphone className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Disparar Campanha</span>
                <span className="sm:hidden">Campanha</span>
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl h-8 sm:h-9 px-2.5 sm:px-3 text-xs" onClick={onRefresh}>
                Atualizar
              </Button>
            </div>
          </div>

          {error ? (
            <Card className="glass-card rounded-2xl border-destructive/30">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-sm font-medium text-destructive">{error}</p>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={onRefresh}>Tentar novamente</Button>
              </CardContent>
            </Card>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm text-xs select-none">
            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto text-muted-foreground">
              <button
                type="button"
                onClick={() => onSegmentChange("all")}
                className={cn("flex items-center gap-1.5 transition-colors font-medium hover:text-foreground cursor-pointer", activeSegment === "all" && "text-primary font-bold")}
              >
                <AddressBook className="h-3.5 w-3.5" weight={activeSegment === "all" ? "fill" : "regular"} />
                <span>Total: <strong className="text-foreground">{viewModel.totalFiltered}</strong></span>
              </button>
              <span className="text-border">•</span>
              <button
                type="button"
                onClick={() => onSegmentChange("individual")}
                className={cn("flex items-center gap-1.5 transition-colors font-medium hover:text-foreground cursor-pointer", activeSegment === "individual" && "text-info font-bold")}
              >
                <Phone className="h-3.5 w-3.5" weight={activeSegment === "individual" ? "fill" : "regular"} />
                <span>Individuais: <strong className="text-foreground">{viewModel.individualCount}</strong></span>
              </button>
              <span className="text-border">•</span>
              <button
                type="button"
                onClick={() => onSegmentChange("grupos")}
                className={cn("flex items-center gap-1.5 transition-colors font-medium hover:text-foreground cursor-pointer", activeSegment === "grupos" && "text-success font-bold")}
              >
                <ChatCircleDots className="h-3.5 w-3.5" weight={activeSegment === "grupos" ? "fill" : "regular"} />
                <span>Grupos: <strong className="text-foreground">{viewModel.groupCount}</strong></span>
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
              Visualização: <strong className="text-foreground capitalize">{viewMode}</strong>
            </span>
          </div>

          {selectedIds.size > 0 && (
            <Card className="border-primary/50 bg-primary/5 rounded-2xl shadow-glow">
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary">
                    {selectedIds.size} {selectedIds.size === 1 ? "contato selecionado" : "contatos selecionados"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground h-auto p-0"
                    onClick={onToggleSelectAll}
                  >
                    {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos do filtro"}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 h-9">
                        Mudar Status ({selectedIds.size})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 border-border bg-card/95 backdrop-blur-xl">
                      {[
                        { label: "Ativo", value: "open" },
                        { label: "Recorrente", value: "recorrente" },
                        { label: "Em risco", value: "em_risco" },
                        { label: "Arquivado", value: "archived" },
                      ].map((status) => (
                        <DropdownMenuItem
                          key={status.value}
                          onClick={() => onBulkUpdate({ status: status.value })}
                          className="text-xs"
                        >
                          {status.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 h-9">
                        Temperatura do lead ({selectedIds.size})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 border-border bg-card/95 backdrop-blur-xl">
                      {[
                        { label: "Quente", val: "hot" },
                        { label: "Morno", val: "warm" },
                        { label: "Frio", val: "cold" },
                        { label: "Sem Temperatura", val: "" },
                      ].map((t) => (
                        <DropdownMenuItem
                          key={t.val}
                          onClick={() => onBulkUpdate({ temperature: t.val })}
                          className="text-xs"
                        >
                          {t.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex items-center gap-1.5">
                    <Input
                      id="bulk-tag-input"
                      placeholder="Adicionar tag..."
                      className="h-9 w-32 text-xs rounded-xl"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            onBulkUpdate({ addTag: val });
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 rounded-xl text-xs"
                      onClick={() => {
                        const input = document.getElementById("bulk-tag-input") as HTMLInputElement;
                        const val = input?.value.trim();
                        if (val) {
                          onBulkUpdate({ addTag: val });
                          input.value = "";
                        }
                      }}
                    >
                      Aplicar Tag
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <ListSkeleton rows={6} />
          ) : viewModel.contacts.length === 0 ? (
            <Card className="glass-card rounded-2xl border-border/70 hover-lift">
              <CardContent className="p-0">
                <EmptyState
                  icon={<AddressBook className="h-8 w-8 text-muted-foreground/50" />}
                  title="Nenhum contato encontrado"
                  description="Ajuste a busca ou os filtros para encontrar um lead da base sincronizada."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <OperationalStatusBadge label="Base sincronizada" tone="online" />
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-auto py-1"
                      onClick={() => onBulkUpdate({})} // Empty action clears
                    >
                      Limpar Seleção
                    </Button>
                  )}
                  <Badge variant="secondary" className="rounded-full">{viewModel.contacts.length} registros</Badge>
                </div>
              </div>
                       {viewMode === "grid" ? (
                <ContactGrid
                  contacts={viewModel.contacts}
                  onContactClick={onGoToChat}
                  onEditContact={onEditContact}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onUpdateContact={onUpdateContact}
                  onDeleteContact={onDeleteContact}
                />
              ) : viewMode === "kanban" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
                  {stages.map((stage) => {
                    const stageContacts = viewModel.contacts.filter(
                      (c: any) => (c.funnelStage || "new_lead") === stage
                    );
                    return (
                      <div
                        key={stage}
                        className="rounded-2xl border border-transparent bg-origin-border [background-image:linear-gradient(to_bottom,var(--border)_0%,transparent_100%)] bg-card/40 backdrop-blur-md p-3 min-w-[250px] flex flex-col gap-2 min-h-[500px] shadow-sm relative overflow-hidden"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('bg-card/60');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('bg-card/60');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('bg-card/60');
                          const contactId = e.dataTransfer.getData("contactId");
                          if (contactId && onUpdateContact) {
                            onUpdateContact(contactId, { funnel_stage: stage });
                          }
                        }}
                      >
                        <div className="absolute inset-x-0 top-0 h-px bg-white/5 pointer-events-none" />
                        <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-1">
                          <span className="font-bold text-xs capitalize text-foreground tracking-[0.05em]">
                            {stageLabels[stage] || stage}
                          </span>
                          <Badge variant="secondary" className="text-[10px] rounded-full">
                            {stageContacts.length}
                          </Badge>
                        </div>
                        <div className="flex-1 space-y-2 overflow-y-auto max-h-[600px] scrollbar-thin">
                          {stageContacts.map((contact: any) => {
                            const hasConv = Boolean(contact.conversationId);
                            return (
                              <div
                                key={contact.id}
                                draggable={hasConv}
                                onDragStart={(e) => {
                                  if (!hasConv) {
                                    e.preventDefault();
                                    return;
                                  }
                                  e.dataTransfer.setData("contactId", contact.id);
                                }}
                                className={`rounded-xl border border-border/50 bg-background/55 p-3 space-y-2 transition-all duration-300 select-none ${
                                  hasConv
                                    ? "cursor-grab active:cursor-grabbing hover:border-primary/45 hover:shadow-md hover:-translate-y-0.5 hover:bg-background/80"
                                    : "opacity-60 cursor-not-allowed"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-xs text-foreground truncate">
                                      {contact.name}
                                    </h4>
                                    <p className="text-[10px] text-muted-foreground">{contact.phone}</p>
                                  </div>
                                  {!hasConv && (
                                    <Badge variant="destructive" className="text-[8px] px-1 h-4">
                                      Sem chat
                                    </Badge>
                                  )}
                                </div>
                                {contact.lastMessage && (
                                  <p className="text-[10px] text-muted-foreground line-clamp-2 italic">
                                    "{contact.lastMessage}"
                                  </p>
                                )}
                                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                                  <TemperatureBadge temperature={contact.temperature} />
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-primary hover:bg-primary/10"
                                      onClick={() => onGoToChat(contact)}
                                      title="Ir para conversa"
                                    >
                                      <ChatCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {stageContacts.length === 0 && (
                            <p className="text-center text-[10px] text-muted-foreground/60 py-8">
                              Arraste um lead para cá
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-border/70 bg-card/85 scrollbar-thin">
                  <Table className="min-w-[650px]">
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          <Checkbox
                            checked={allFilteredSelected}
                            onCheckedChange={onToggleSelectAll}
                            className="rounded border-border/80 text-primary"
                          />
                        </TableHead>
                        <TableHead>Nome / Telefone</TableHead>
                        <TableHead>Última Mensagem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lead Score</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead className="w-20 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewModel.contacts.map((contact) => {
                        const isSelected = selectedIds.has(contact.id);
                        return (
                          <TableRow
                            key={contact.id}
                            className={`hover:bg-muted/20 border-border/50 cursor-pointer ${
                              isSelected ? "bg-primary/5 hover:bg-primary/10" : ""
                            }`}
                            onClick={() => onGoToChat(contact)}
                          >
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => onToggleSelect(contact.id)}
                                className="rounded border-border/80 text-primary"
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-border/50">
                                  {contact.avatarUrl && <AvatarImage src={contact.avatarUrl} alt={contact.name} />}
                                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                                    {contact.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm text-foreground">{contact.name}</span>
                                  <span className="text-xs text-muted-foreground">{contact.phone}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                              {contact.lastMessage || <span className="italic text-muted-foreground/40">Sem mensagens</span>}
                            </TableCell>
                            <TableCell>
                              {contact.status ? (
                                <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                                  {contact.status}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <TemperatureBadge temperature={contact.temperature} />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {contact.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="rounded-full bg-muted/20 px-2 py-0 text-[9px]">
                                    {tag}
                                  </Badge>
                                ))}
                                {contact.tags.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground font-medium">+{contact.tags.length - 2}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:bg-primary/10"
                                  onClick={() => onGoToChat(contact)}
                                  title="Ir para conversa"
                                >
                                  <ChatCircle className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    >
                                      <DotsThreeVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 border-border bg-card/95 backdrop-blur-xl">
                                    {onEditContact && (
                                      <DropdownMenuItem onClick={() => onEditContact(contact)} className="gap-2 text-xs">
                                        <PencilSimple className="h-4 w-4" />
                                        Editar nome e etiquetas
                                      </DropdownMenuItem>
                                    )}
                                    {onUpdateContact && (
                                      <>
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger className="gap-2 text-xs">
                                            <Tag className="h-4 w-4" />
                                            Status da conversa
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="bg-card/95 border-border">
                                            {[
                                              { label: "Ativo", value: "open" },
                                              { label: "Recorrente", value: "recorrente" },
                                              { label: "Em risco", value: "em_risco" },
                                              { label: "Arquivado", value: "archived" },
                                            ].map((status) => (
                                              <DropdownMenuItem
                                                key={status.value}
                                                onClick={() => onUpdateContact(contact.id, { status: status.value })}
                                                className="text-xs"
                                              >
                                                {status.label}
                                              </DropdownMenuItem>
                                            ))}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>
 
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger className="gap-2 text-xs">
                                            <Tag className="h-4 w-4" />
                                            Temperatura do lead
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="bg-card/95 border-border">
                                            {[
                                              { label: "Quente", val: "hot" },
                                              { label: "Morno", val: "warm" },
                                              { label: "Frio", val: "cold" },
                                              { label: "Sem Temperatura", val: "" },
                                            ].map((t) => (
                                              <DropdownMenuItem
                                                key={t.val}
                                                onClick={() => onUpdateContact(contact.id, { lead_temperature: t.val })}
                                                className="text-xs"
                                              >
                                                {t.label}
                                              </DropdownMenuItem>
                                            ))}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        <DropdownMenuItem
                                          onClick={() =>
                                            onUpdateContact(contact.id, {
                                              status: contact.status === "archived" ? "open" : "archived",
                                            })
                                          }
                                          className="gap-2 text-xs"
                                        >
                                          <Archive className="h-4 w-4" />
                                          {contact.status === "archived" ? "Reativar conversa" : "Arquivar conversa"}
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactsView;
