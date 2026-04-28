import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { CampaignStepHeader } from '../components/modules/campaigns/CampaignStepHeader';
import { Card } from '../components/ui/Card';
import { FormField, TextArea, TextInput } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { Tabs } from '../components/ui/Tabs';
import { api } from '../lib/api';
import { mockCampaigns, mockContacts } from '../lib/mocks';
import { useAppStore } from '../store/appStore';
import { Campaign, CampaignMessage, Contact } from '../types';

type Step = 'contacts' | 'messages' | 'settings' | 'review';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('contacts');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<CampaignMessage[]>([{ type: 'text', content: '' }]);
  const [settings, setSettings] = useState({ intervalSeconds: 10, pauseEvery: 10, pauseSeconds: 60, typingDelaySeconds: 3 });
  const setStoreSelectedContacts = useAppStore((state) => state.setSelectedContacts);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [campaignData, contactData] = await Promise.all([
        api.get<Campaign[]>('/api/campaigns'),
        api.get<Contact[]>('/api/contacts'),
      ]);

      setCampaigns(campaignData);
      setContacts(contactData);
    } catch (loadError) {
      setCampaigns(mockCampaigns);
      setContacts(mockContacts);
      setError('Backend indisponivel. Exibindo campanhas mock.');
      console.warn('[Campaigns] fallback mock ativo:', loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const stepIndex = useMemo(() => ({ contacts: 0, messages: 1, settings: 2, review: 3 }[step]), [step]);

  function nextStep() {
    const steps: Step[] = ['contacts', 'messages', 'settings', 'review'];
    setStep(steps[Math.min(steps.length - 1, stepIndex + 1)]);
  }

  function prevStep() {
    const steps: Step[] = ['contacts', 'messages', 'settings', 'review'];
    setStep(steps[Math.max(0, stepIndex - 1)]);
  }

  async function saveCampaign() {
    setSaving(true);
    try {
      await api.post<Campaign>('/api/campaigns', {
        name,
        selectedContacts: selected,
        messages,
        settings,
      });
      setOpen(false);
      setName('');
      setSelected([]);
      setMessages([{ type: 'text', content: '' }]);
      setStoreSelectedContacts([]);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function executeCampaign(id: string) {
    await api.post(`/api/campaigns/${id}/execute`);
    await loadData();
  }

  function toggleContact(contact: Contact) {
    const exists = selected.some((item) => item.id === contact.id);
    const next = exists ? selected.filter((item) => item.id !== contact.id) : [...selected, contact];
    setSelected(next);
    setStoreSelectedContacts(next);
  }

  return (
    <div className="space-y-4">
      <div className="crm-card bg-panelSoft/80 flex items-center justify-between p-5">
        <div>
          <h2 className="text-2xl font-semibold text-textPrimary">Campanhas</h2>
          <p className="text-sm text-textSecondary">Fluxo em 4 etapas: contatos, mensagens, revisao e envio.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Nova campanha</Button>
      </div>
      {loading ? <p className="text-xs text-textSecondary">Carregando campanhas...</p> : null}
      {error ? <p className="rounded-lg border border-amber-700 bg-amber-950/40 p-2 text-xs text-amber-200">{error}</p> : null}

      <Card title="Lista de campanhas" subtitle="Execucao, status e fila">
        <div className="space-y-3">
          {campaigns.length === 0 ? <p className="text-sm text-slate-400">Nenhuma campanha encontrada.</p> : null}
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="crm-hover-lift rounded-lg border border-borderSoft bg-panelSoft p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-textPrimary">{campaign.name}</p>
                  <div className="mt-2">
                    <Badge variant={campaign.status === 'running' ? 'info' : campaign.status === 'sent' ? 'success' : 'neutral'}>
                      {campaign.status}
                    </Badge>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => executeCampaign(campaign.id)}>Executar</Button>
              </div>
              <div className="mt-3 grid gap-2 rounded-lg border border-borderSoft bg-panel px-3 py-2 text-xs text-textSecondary md:grid-cols-3">
                <span>Fila: {campaign.queue?.sent ?? 0}/{campaign.queue?.total ?? 0}</span>
                <span>Falhas: {campaign.queue?.failed ?? 0}</span>
                <span>Pausado: {campaign.queue?.paused ? 'Sim' : 'Nao'}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={open} title="Criar campanha" onClose={() => setOpen(false)}>
        <CampaignStepHeader currentStep={step} />

        <Tabs
          items={[
            { key: 'contacts', label: 'Contatos' },
            { key: 'messages', label: 'Mensagens' },
            { key: 'settings', label: 'Configuracoes' },
            { key: 'review', label: 'Revisao' },
          ]}
          activeKey={step}
          onChange={(key) => setStep(key as Step)}
        />

        <div className="mt-4 space-y-3">
          {step === 'contacts' ? (
            <div className="max-h-72 space-y-2 overflow-auto">
              <FormField label="Nome da campanha">
                <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Campanha Black Friday" />
              </FormField>
              {contacts.map((contact) => {
                const active = selected.some((item) => item.id === contact.id);
                return (
                  <button
                    key={contact.id}
                    onClick={() => toggleContact(contact)}
                    className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${active ? 'border-accent bg-accent/20 text-textPrimary' : 'border-borderSoft bg-panelSoft text-textSecondary hover:border-accentBlue/40'}`}
                  >
                    {contact.name} - {contact.phone}
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 'messages' ? (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <Card key={index} title={`Mensagem ${index + 1}`}>
                  <FormField label="Tipo">
                    <select
                      className="w-full rounded-lg border border-borderSoft bg-panelSoft px-3 py-2"
                      value={message.type}
                      onChange={(event) => {
                        const next = [...messages];
                        next[index] = { ...next[index], type: event.target.value as CampaignMessage['type'] };
                        setMessages(next);
                      }}
                    >
                      <option value="text">Texto</option>
                      <option value="image">Imagem</option>
                      <option value="audio">Audio</option>
                      <option value="video">Video</option>
                    </select>
                  </FormField>
                  <FormField label="Conteudo">
                    <TextArea value={message.content} onChange={(event) => {
                      const next = [...messages];
                      next[index] = { ...next[index], content: event.target.value };
                      setMessages(next);
                    }} />
                  </FormField>
                </Card>
              ))}
              <Button variant="secondary" onClick={() => setMessages([...messages, { type: 'text', content: '' }])}>Adicionar mensagem</Button>
            </div>
          ) : null}

          {step === 'settings' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Intervalo (s)">
                <TextInput type="number" value={settings.intervalSeconds} onChange={(event) => setSettings({ ...settings, intervalSeconds: Number(event.target.value) })} />
              </FormField>
              <FormField label="Pausa a cada X envios">
                <TextInput type="number" value={settings.pauseEvery} onChange={(event) => setSettings({ ...settings, pauseEvery: Number(event.target.value) })} />
              </FormField>
              <FormField label="Tempo de pausa (s)">
                <TextInput type="number" value={settings.pauseSeconds} onChange={(event) => setSettings({ ...settings, pauseSeconds: Number(event.target.value) })} />
              </FormField>
              <FormField label="Typing delay (s)">
                <TextInput type="number" value={settings.typingDelaySeconds} onChange={(event) => setSettings({ ...settings, typingDelaySeconds: Number(event.target.value) })} />
              </FormField>
            </div>
          ) : null}

          {step === 'review' ? (
            <Card title="Revisao">
              <p className="text-sm">Campanha: {name || 'Sem nome'}</p>
              <p className="text-sm">Contatos: {selected.length}</p>
              <p className="text-sm">Mensagens: {messages.length}</p>
              <p className="text-sm">Intervalo: {settings.intervalSeconds}s</p>
            </Card>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" onClick={prevStep}>Voltar</Button>
          {step === 'review' ? (
            <Button onClick={saveCampaign} disabled={saving}>{saving ? 'Salvando...' : 'Criar campanha'}</Button>
          ) : (
            <Button onClick={nextStep}>Proximo</Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
