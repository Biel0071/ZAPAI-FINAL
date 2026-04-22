import { useCallback, useEffect, useMemo, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ContactRow = {
  id: number;
  name: string;
  phone: string;
  tags: string[];
  lastConversation: string;
  status: string;
};

const CONTACT_ROW_HEIGHT = 108;

const contacts: ContactRow[] = [
  { id: 1, name: "Maria Silva", phone: "+55 11 99999-1111", tags: ["Lead", "Premium"], lastConversation: "Hoje, 14:32", status: "Ativo" },
  { id: 2, name: "João Santos", phone: "+55 11 99999-2222", tags: ["Cliente"], lastConversation: "Hoje, 13:20", status: "Ativo" },
  { id: 3, name: "Ana Oliveira", phone: "+55 11 99999-3333", tags: ["Lead"], lastConversation: "Ontem, 18:45", status: "Inativo" },
];

type ContactsRowData = {
  contacts: ContactRow[];
};

function ContactVirtualRow({ index, style, ...rowProps }: RowComponentProps<ContactsRowData>) {
  const { contacts } = rowProps as ContactsRowData;
  const contact = contacts[index];
  if (!contact) return <div style={style} />;

  return (
    <div style={style} className="px-1 py-1">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{contact.name}</p>
            <p className="text-sm text-muted-foreground">{contact.phone}</p>
            <p className="mt-1 text-xs text-muted-foreground">Última conversa: {contact.lastConversation}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {contact.tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
            <Badge className={contact.status === "Ativo" ? "status-online" : "status-offline"}>{contact.status}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  const safeContacts = useMemo(() => (Array.isArray(contacts) ? contacts : []), []);

  const listHeight = useMemo(() => Math.min(560, Math.max(220, safeContacts.length * CONTACT_ROW_HEIGHT)), [safeContacts.length]);

  const contactsRowProps = useMemo(() => ({ contacts: safeContacts }), [safeContacts]);

  const renderSkeletons = useCallback(
    () =>
      Array.from({ length: 4 }).map((_, index) => (
        <div key={`contact-skeleton-${index}`} className="space-y-2 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )),
    [],
  );

  return (
    <div className="min-h-screen">
      <Header title="Contatos" subtitle="Gerencie tags, status e histórico de conversa" />
      <div className="space-y-6 p-6">
        <Card className="glass-card">
          <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
            <Input placeholder="Buscar por nome ou telefone" />
            <Input placeholder="Filtrar por tag" />
            <Button className="md:w-fit">Novo contato</Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Lista de Contatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              renderSkeletons()
            ) : safeContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contato encontrado.</p>
            ) : (
              <List rowComponent={ContactVirtualRow} rowCount={safeContacts.length} rowHeight={CONTACT_ROW_HEIGHT} rowProps={contactsRowProps} style={{ height: listHeight }} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
