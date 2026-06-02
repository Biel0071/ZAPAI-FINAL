import { Phone, ChatCircleDots, PencilSimple, Tag, DotsThreeVertical, ChatCircle } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TemperatureBadge } from "@/components/conversations/TemperatureBadge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

export interface ContactGridItem {
  id: string;
  name: string;
  phone: string;
  updatedAt: string;
  isGroup: boolean;
  tags: string[];
  temperature?: string;
  status?: string;
  avatarUrl?: string;
}

interface ContactGridProps {
  contacts: ContactGridItem[];
  onContactClick: (contact: ContactGridItem) => void;
  onEditContact?: (contact: ContactGridItem) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onUpdateContact?: (id: string, payload: { status?: string; lead_temperature?: string; tags?: string[] }) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((entry) => entry[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem mensagens";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return date.toLocaleDateString("pt-BR");
}

export function ContactGrid({
  contacts,
  onContactClick,
  onEditContact,
  selectedIds,
  onToggleSelect,
  onUpdateContact,
}: ContactGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {contacts.map((contact) => {
        const isSelected = selectedIds?.has(contact.id) ?? false;
        return (
          <Card
            key={contact.id}
            className={`group glass-card cursor-pointer overflow-hidden rounded-2xl border transition-all hover:shadow-lg hover:shadow-primary/5 ${
              isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border/70 bg-card/85"
            }`}
            onClick={() => onContactClick(contact)}
          >
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {onToggleSelect && (
                    <div
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                      className="flex items-center"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(contact.id)}
                        className="h-4 w-4 rounded border-border/80 text-primary focus:ring-primary/20"
                      />
                    </div>
                  )}
                  <Avatar className="h-12 w-12 border-2 border-background shadow-sm transition-transform group-hover:scale-105">
                    <AvatarImage src={contact.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 font-bold text-primary">{getInitials(contact.name)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <TemperatureBadge temperature={contact.temperature} />
                  {contact.isGroup && <Badge variant="secondary" className="rounded-full text-[10px]">Grupo</Badge>}
                </div>
              </div>

              <div className="mb-4 space-y-1">
                <h4 className="truncate font-display text-sm font-bold">{contact.name}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{contact.phone || "Sem telefone"}</span>
                </div>
                {contact.status && (
                  <Badge variant="outline" className="mt-1 rounded-full text-[10px] capitalize">
                    {contact.status}
                  </Badge>
                )}
              </div>

              <div className="mb-4 flex min-h-[22px] flex-wrap gap-1.5">
                {contact.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="rounded-full bg-muted/20 px-2 py-0 text-[9px]">
                    <Tag className="mr-0.5 h-2.5 w-2.5" />
                    {tag}
                  </Badge>
                ))}
                {contact.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{contact.tags.length - 3}</span>}
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ChatCircleDots className="h-3 w-3" />
                  {formatUpdatedAt(contact.updatedAt)}
                </span>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary hover:bg-primary/10"
                    onClick={(event) => {
                      event.stopPropagation();
                      onContactClick(contact);
                    }}
                    title="Ir para conversa"
                  >
                    <ChatCircle className="h-4 w-4" />
                  </Button>
                  
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          title="Ações rápidas"
                        >
                          <DotsThreeVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 border-border bg-card/95 backdrop-blur-xl">
                        {onEditContact && (
                          <DropdownMenuItem
                            onClick={() => onEditContact(contact)}
                            className="gap-2"
                          >
                            <PencilSimple className="h-4 w-4" />
                            Editar Contato
                          </DropdownMenuItem>
                        )}
                        
                        {onUpdateContact && (
                          <>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="gap-2">
                                <Tag className="h-4 w-4" />
                                Mudar Status
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-card/95 border-border">
                                {["ativo", "recorrente", "em_risco", "bloqueado"].map((status) => (
                                  <DropdownMenuItem
                                    key={status}
                                    onClick={() => onUpdateContact(contact.id, { status })}
                                    className="capitalize"
                                  >
                                    {status.replace("_", " ")}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="gap-2">
                                <Tag className="h-4 w-4" />
                                Mudar Lead Score
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
                                  >
                                    {t.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
