import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { AddressBook, ChatCircleDots, Phone, SquaresFour, List, DotsThreeVertical, Tag, ChatCircle, PencilSimple, Kanban, Archive } from "@phosphor-icons/react";
import { ContactGrid, type ContactGridItem } from "@/components/contacts/ContactGrid";
import { ContactSidebar, type ContactSegment } from "@/components/contacts/ContactSidebar";
import { ChatSearchBar } from "@/components/inbox/ChatSearchBar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const allFilteredSelected = viewModel.contacts.length > 0 && viewModel.contacts.every(c => selectedIds.has(c.id));

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
    <div className="page-container section-stack">
      {loading ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {viewModel.summaryCards.map((card) => {
            const cardSegment = card.segment;
            const isActive = activeSegment === cardSegment;
            return (
              <Card
                key={card.label}
                className={cn(
                  "metric-card rounded-2xl border-border/70 bg-card/85 cursor-pointer transition-all hover:scale-[1.02] hover:bg-card/95 select-none",
                  isActive && "border-primary/50 bg-primary/5 shadow-glow"
                )}
                onClick={() => onSegmentChange(cardSegment)}
              >
                <CardContent className="space-y-2 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
                  <p className="font-display text-2xl font-bold">{card.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <ContactSidebar activeSegment={activeSegment} counts={counts} onSegmentChange={onSegmentChange} />

        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <ChatSearchBar value={searchQuery} onChange={onSearchChange} placeholder="Buscar contatos..." />
              <Input value={tagFilter} onChange={(event) => onTagFilterChange(event.target.value)} placeholder="Filtrar por tag" className="max-w-xs rounded-xl" />
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border border-border bg-card/50 p-1">
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
              <Button variant="outline" className="rounded-xl" onClick={onRefresh}>Atualizar</Button>
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card
              className={cn(
                "glass-card rounded-2xl border-border/70 bg-card/85 cursor-pointer transition-all hover:scale-[1.02] hover:bg-card/95 select-none",
                activeSegment === "all" && "border-primary/50 bg-primary/5 shadow-glow"
              )}
              onClick={() => onSegmentChange("all")}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <AddressBook className="h-5 w-5 text-primary" weight="duotone" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total filtrado</p>
                  <p className="font-display text-2xl font-bold">{viewModel.totalFiltered}</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "glass-card rounded-2xl border-border/70 bg-card/85 cursor-pointer transition-all hover:scale-[1.02] hover:bg-card/95 select-none",
                activeSegment === "individual" && "border-info/50 bg-info/5 shadow-glow"
              )}
              onClick={() => onSegmentChange("individual")}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <Phone className="h-5 w-5 text-info" weight="duotone" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Individuais</p>
                  <p className="font-display text-2xl font-bold">{viewModel.individualCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "glass-card rounded-2xl border-border/70 bg-card/85 cursor-pointer transition-all hover:scale-[1.02] hover:bg-card/95 select-none",
                activeSegment === "grupos" && "border-success/50 bg-success/5 shadow-glow"
              )}
              onClick={() => onSegmentChange("grupos")}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <ChatCircleDots className="h-5 w-5 text-success" weight="duotone" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Grupos</p>
                  <p className="font-display text-2xl font-bold">{viewModel.groupCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {selectedIds.size > 0 && (
            <Card className="border-primary/50 bg-primary/5 rounded-2xl shadow-glow">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
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
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="p-0">
                <EmptyState
                  icon={<AddressBook className="h-8 w-8 text-muted-foreground/50" />}
                  title="Nenhum contato encontrado"
                  description="Ajuste a busca ou os filtros para encontrar um lead da base sincronizada."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
                  {stages.map((stage) => {
                    const stageContacts = viewModel.contacts.filter(
                      (c: any) => (c.funnelStage || "new_lead") === stage
                    );
                    return (
                      <div
                        key={stage}
                        className="rounded-2xl border border-border/75 bg-card/65 p-3 min-w-[250px] flex flex-col gap-2 min-h-[500px]"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const contactId = e.dataTransfer.getData("contactId");
                          if (contactId && onUpdateContact) {
                            onUpdateContact(contactId, { funnel_stage: stage });
                          }
                        }}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-1">
                          <span className="font-bold text-xs capitalize text-foreground">
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
                                className={`rounded-xl border border-border/50 bg-background/55 p-3 space-y-2 transition-all select-none ${
                                  hasConv
                                    ? "cursor-grab active:cursor-grabbing hover:border-primary/45 hover:shadow-sm"
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
                <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/85">
                  <Table>
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
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-foreground">{contact.name}</span>
                                <span className="text-xs text-muted-foreground">{contact.phone}</span>
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
