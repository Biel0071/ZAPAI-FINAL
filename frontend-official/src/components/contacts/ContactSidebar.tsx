import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Archive,
  ChatCircleDots,
  Circle,
  Hash,
  Star,
  ThermometerCold,
  ThermometerHot,
  ThermometerSimple,
  Users,
} from "@phosphor-icons/react";

export type ContactSegment =
  | "all"
  | "inbox"
  | "lead"
  | "saved"
  | "grupos"
  | "archived"
  | "lead_quente"
  | "lead_morno"
  | "lead_frio"
  | "ativo"
  | "recorrente"
  | "em_risco"
  | "bloqueado";

interface ContactSidebarProps {
  activeSegment: ContactSegment;
  onSegmentChange: (segment: ContactSegment) => void;
  counts: Record<string, number>;
}

export function ContactSidebar({ activeSegment, onSegmentChange, counts }: ContactSidebarProps) {
  const mainItems = [
    { id: "all", label: "Todos", icon: Users },
    { id: "inbox", label: "Inbox", icon: ChatCircleDots },
    { id: "lead", label: "Leads CRM", icon: Star },
    { id: "saved", label: "Salvos", icon: Star },
    { id: "grupos", label: "Grupos", icon: Hash },
    { id: "archived", label: "Arquivados", icon: Archive },
  ] as const;

  const temperatureItems = [
    { id: "lead_quente", label: "Lead Quente", icon: ThermometerHot, color: "text-destructive" },
    { id: "lead_morno", label: "Lead Morno", icon: ThermometerSimple, color: "text-warning" },
    { id: "lead_frio", label: "Lead Frio", icon: ThermometerCold, color: "text-info" },
  ] as const;

  const statusItems = [
    { id: "ativo", label: "Ativos", icon: Circle, color: "text-success" },
    { id: "recorrente", label: "Recorrentes", icon: Circle, color: "text-primary" },
    { id: "em_risco", label: "Em Risco", icon: Circle, color: "text-warning" },
    { id: "bloqueado", label: "Bloqueados", icon: Circle, color: "text-muted-foreground" },
  ] as const;

  const renderItem = (item: { id: ContactSegment; label: string; icon: ElementType; color?: string }) => (
    <Button
      key={item.id}
      variant="ghost"
      size="sm"
      className={cn(
        "w-full justify-start gap-3 px-3 transition-all",
        activeSegment === item.id ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-muted/50",
      )}
      onClick={() => onSegmentChange(item.id)}
    >
      <item.icon className={cn("h-4 w-4", item.color)} weight={item.icon === Circle ? "fill" : activeSegment === item.id ? "duotone" : "regular"} />
      <span className="flex-1 text-left">{item.label}</span>
      {counts[item.id] > 0 && (
        <Badge variant="secondary" className="bg-muted/50 text-[10px] px-1.5 py-0 min-w-5 h-5 flex items-center justify-center">
          {counts[item.id]}
        </Badge>
      )}
    </Button>
  );

  return (
    <div className="flex h-full flex-col bg-card/50 border-r border-border">
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-6">
          <section>
            <h4 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Segmentos</h4>
            <div className="space-y-1">{mainItems.map(renderItem)}</div>
          </section>

          <section>
            <h4 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Temperatura</h4>
            <div className="space-y-1">{temperatureItems.map(renderItem)}</div>
          </section>

          <section>
            <h4 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Status operacional</h4>
            <div className="space-y-1">{statusItems.map(renderItem)}</div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
