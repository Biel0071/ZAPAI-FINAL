import { AddressBook, ChatCircleDots, Phone } from "@phosphor-icons/react";
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
}: ContactsViewProps) {
  return (
    <div className="page-container section-stack">
      {loading ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {viewModel.summaryCards.map((card) => (
            <Card key={card.label} className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="font-display text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <ContactSidebar activeSegment={activeSegment} counts={counts} onSelect={onSegmentChange} />

        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <ChatSearchBar value={searchQuery} onChange={onSearchChange} placeholder="Buscar contatos..." />
              <Input value={tagFilter} onChange={(event) => onTagFilterChange(event.target.value)} placeholder="Filtrar por tag" className="max-w-xs rounded-xl" />
            </div>
            <Button variant="outline" className="rounded-xl" onClick={onRefresh}>Atualizar</Button>
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
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85"><CardContent className="flex items-center gap-3 p-4"><AddressBook className="h-5 w-5 text-primary" weight="duotone" /><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Total filtrado</p><p className="font-display text-2xl font-bold">{viewModel.totalFiltered}</p></div></CardContent></Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85"><CardContent className="flex items-center gap-3 p-4"><Phone className="h-5 w-5 text-info" weight="duotone" /><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Individuais</p><p className="font-display text-2xl font-bold">{viewModel.individualCount}</p></div></CardContent></Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85"><CardContent className="flex items-center gap-3 p-4"><ChatCircleDots className="h-5 w-5 text-success" weight="duotone" /><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Grupos</p><p className="font-display text-2xl font-bold">{viewModel.groupCount}</p></div></CardContent></Card>
          </div>

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
                <Badge variant="secondary" className="rounded-full">{viewModel.contacts.length} registros</Badge>
              </div>
              <ContactGrid contacts={viewModel.contacts} onContactClick={onGoToChat} onEditContact={onEditContact} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactsView;
