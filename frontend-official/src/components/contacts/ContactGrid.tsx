import { Phone, ChatCircleDots, DotsThreeVertical } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TemperatureBadge } from "@/components/conversations/TemperatureBadge";

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
  onSelect: (contact: ContactGridItem) => void;
  onGoToChat: (contact: ContactGridItem) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((entry) => entry[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem mensagens";
  return date.toLocaleDateString("pt-BR");
}

export function ContactGrid({ contacts, onSelect, onGoToChat }: ContactGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {contacts.map((contact) => (
        <Card
          key={contact.id}
          className="group cursor-pointer overflow-hidden border-border/50 transition-all hover:shadow-md"
          onClick={() => onSelect(contact)}
        >
          <CardContent className="p-5">
            <div className="mb-4 flex items-start justify-between">
              <Avatar className="h-12 w-12 border-2 border-background shadow-sm transition-transform group-hover:scale-105">
                <AvatarImage src={contact.avatarUrl} />
                <AvatarFallback className="bg-primary/10 font-bold text-primary">{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-end gap-1.5">
                <TemperatureBadge temperature={contact.temperature} />
                {contact.isGroup && <Badge variant="secondary" className="text-[10px]">Grupo</Badge>}
              </div>
            </div>

            <div className="mb-4 space-y-1">
              <h4 className="truncate text-sm font-bold">{contact.name}</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{contact.phone || "Sem telefone"}</span>
              </div>
              {contact.status && (
                <Badge variant="outline" className="mt-1 text-[10px] capitalize">
                  {contact.status}
                </Badge>
              )}
            </div>

            <div className="mb-4 flex min-h-[22px] flex-wrap gap-1.5">
              {contact.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="bg-muted/20 px-1.5 py-0 text-[9px]">
                  {tag}
                </Badge>
              ))}
              {contact.tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{contact.tags.length - 2}</span>}
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-4">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ChatCircleDots className="h-3 w-3" />
                {formatUpdatedAt(contact.updatedAt)}
              </span>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:bg-primary/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    onGoToChat(contact);
                  }}
                  title="Ir para conversa"
                >
                  <ChatCircleDots className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Mais ações">
                  <DotsThreeVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
