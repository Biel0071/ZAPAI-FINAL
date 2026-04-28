import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { TextInput } from '../components/ui/FormField';
import { Contact } from '../types';
import { api } from '../lib/api';
import { useAppStore } from '../store/appStore';
import { mockContacts } from '../lib/mocks';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { contactsFilter, setContactsFilter, selectedContacts, setSelectedContacts } = useAppStore();

  useEffect(() => {
    setLoading(true);
    setError(null);

    void api
      .get<Contact[]>('/api/contacts')
      .then(setContacts)
      .catch((loadError) => {
        setContacts(mockContacts);
        setError('Backend indisponivel. Exibindo contatos mock.');
        console.warn('[Contacts] fallback mock ativo:', loadError);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return contacts.filter((item) => {
      const byQuery = `${item.name} ${item.phone}`.toLowerCase().includes(query.toLowerCase());
      if (!byQuery) {
        return false;
      }

      if (contactsFilter === 'groups') {
        return item.phone.includes('-');
      }

      if (contactsFilter === 'tags') {
        return item.name.includes('#') || item.name.includes('[');
      }

      return true;
    });
  }, [contacts, contactsFilter, query]);

  function toggleContact(contact: Contact) {
    const exists = selectedContacts.some((item) => item.id === contact.id);
    if (exists) {
      setSelectedContacts(selectedContacts.filter((item) => item.id !== contact.id));
      return;
    }
    setSelectedContacts([...selectedContacts, contact]);
  }

  return (
    <div className="space-y-4">
      <header className="crm-card bg-panelSoft/80 p-5">
        <h2 className="text-2xl font-semibold text-textPrimary">Contatos</h2>
        <p className="text-sm text-textSecondary">Gestao de contatos, grupos e etiquetas.</p>
      </header>
      {loading ? <p className="text-xs text-slate-400">Carregando contatos...</p> : null}
      {error ? <p className="rounded-lg border border-amber-700 bg-amber-950/40 p-2 text-xs text-amber-200">{error}</p> : null}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Tabs
            items={[
              { key: 'saved', label: 'Contatos salvos' },
              { key: 'groups', label: 'Grupos' },
              { key: 'tags', label: 'Etiquetas' },
            ]}
            activeKey={contactsFilter}
            onChange={(key) => setContactsFilter(key as 'saved' | 'groups' | 'tags')}
          />
          <TextInput placeholder="Buscar por nome ou numero" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
          <div className="max-h-[520px] overflow-auto rounded-lg border border-borderSoft bg-panelSoft/50">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-slate-400">Nenhum contato encontrado para o filtro atual.</p>
            ) : null}
            {filtered.map((item) => {
              const active = selectedContacts.some((entry) => entry.id === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleContact(item)}
                  className={`flex w-full items-center justify-between border-b border-borderSoft px-3 py-2 text-left text-sm transition ${
                    active ? 'bg-accent/18' : 'bg-transparent hover:bg-panel'
                  }`}
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-slate-400">{item.phone}</span>
                </button>
              );
            })}
          </div>

          <Card title="Selecionados" subtitle={`${selectedContacts.length} contatos`}>
            <div className="space-y-2 text-sm">
              {selectedContacts.length === 0 ? <p className="text-slate-400">Nenhum contato selecionado.</p> : null}
              {selectedContacts.map((item) => (
                <div key={item.id} className="rounded-lg bg-panelSoft px-3 py-2">
                  {item.name} - {item.phone}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
