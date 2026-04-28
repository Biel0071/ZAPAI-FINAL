import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField, TextArea, TextInput } from '../components/ui/FormField';
import { Toggle } from '../components/ui/Toggle';
import { api } from '../lib/api';

interface AdvancedAISettings {
  temperature: number;
  maxTokens: number;
  responseDelaySeconds: number;
  autoFollowUp: boolean;
  model?: string;
  top_p?: number;
  basePrompt?: string;
}

export default function AIConfigPage() {
  const [settings, setSettings] = useState<AdvancedAISettings>({
    temperature: 0.6,
    maxTokens: 600,
    responseDelaySeconds: 1,
    autoFollowUp: true,
    model: 'gpt-4.1-mini',
    top_p: 0.25,
    basePrompt: '',
  });

  useEffect(() => {
    void api.get<AdvancedAISettings>('/config/advanced-ai').then((data) => {
      setSettings((prev) => ({ ...prev, ...data }));
    });
  }, []);

  async function save() {
    await api.post('/config/advanced-ai', settings);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Configuracao de IA</h2>
      <Card title="Modelo e parametros">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Modelo">
            <TextInput value={settings.model || ''} onChange={(event) => setSettings({ ...settings, model: event.target.value })} />
          </FormField>
          <FormField label="Temperatura">
            <TextInput type="number" step="0.01" value={settings.temperature} onChange={(event) => setSettings({ ...settings, temperature: Number(event.target.value) })} />
          </FormField>
          <FormField label="Top P">
            <TextInput type="number" step="0.01" value={settings.top_p || 0.25} onChange={(event) => setSettings({ ...settings, top_p: Number(event.target.value) })} />
          </FormField>
          <FormField label="Max tokens">
            <TextInput type="number" value={settings.maxTokens} onChange={(event) => setSettings({ ...settings, maxTokens: Number(event.target.value) })} />
          </FormField>
          <FormField label="Delay de resposta (s)">
            <TextInput type="number" value={settings.responseDelaySeconds} onChange={(event) => setSettings({ ...settings, responseDelaySeconds: Number(event.target.value) })} />
          </FormField>
          <div className="space-y-1">
            <span className="text-xs text-slate-300">Auto follow-up</span>
            <Toggle checked={settings.autoFollowUp} onChange={(value) => setSettings({ ...settings, autoFollowUp: value })} />
          </div>
        </div>
        <div className="mt-3">
          <FormField label="Prompt base">
            <TextArea value={settings.basePrompt || ''} onChange={(event) => setSettings({ ...settings, basePrompt: event.target.value })} className="h-28" />
          </FormField>
        </div>
        <div className="mt-4">
          <Button onClick={save}>Salvar configuracoes</Button>
        </div>
      </Card>
    </div>
  );
}
