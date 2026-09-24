import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { requestApiEndpoint } from '@/services/apiService';
import {
  Store,
  Plus,
  Save,
  RefreshCw,
  Globe,
  Phone,
  Clock,
  ShieldCheck,
  Package,
  Sparkles,
  Bot,
  Copy,
  Check
} from 'lucide-react';

export interface StoreData {
  id: string;
  name: string;
  segment?: string;
  phone?: string;
  website?: string;
  business_hours?: string;
  policies?: string;
  catalog_summary?: string;
  knowledge?: string;
}

export interface WhiteLabelStoreManagerProps {
  agents: Array<{ key: string; name: string; personality: string }>;
  selectedAgentKey?: string;
  onSelectAgent?: (key: string) => void;
}

export const WhiteLabelStoreManager: React.FC<WhiteLabelStoreManagerProps> = ({
  agents,
  selectedAgentKey,
  onSelectAgent,
}) => {
  const { toast } = useToast();
  const [stores, setStores] = useState<StoreData[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [policies, setPolicies] = useState('');
  const [catalogSummary, setCatalogSummary] = useState('');
  const [knowledge, setKnowledge] = useState('');

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res = await requestApiEndpoint<{ stores: StoreData[] }>('/api/ai/history');
      if (res?.stores) {
        setStores(res.stores);
        if (res.stores.length > 0 && !selectedStoreId) {
          loadStoreToForm(res.stores[0]);
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar lojas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const loadStoreToForm = (store: StoreData) => {
    setSelectedStoreId(store.id);
    setName(store.name || '');
    setSegment(store.segment || '');
    setPhone(store.phone || '');
    setWebsite(store.website || '');
    setBusinessHours(store.business_hours || '');
    setPolicies(store.policies || '');
    setCatalogSummary(store.catalog_summary || '');
    setKnowledge(store.knowledge || '');
  };

  const handleSelectStore = (id: string) => {
    const s = stores.find((st) => st.id === id);
    if (s) loadStoreToForm(s);
  };

  const handleNewStore = () => {
    setSelectedStoreId('');
    setName('Nova Loja White-Label');
    setSegment('Comércio Geral');
    setPhone('');
    setWebsite('');
    setBusinessHours('Segunda a Sexta: 08h às 18h | Sábado: 08h às 12h');
    setPolicies('Trocas e devoluções em até 7 dias corridos. Frete sob consulta.');
    setCatalogSummary('');
    setKnowledge('');
  };

  const handleSaveStore = async () => {
    if (!name.trim()) {
      toast({ title: 'Aviso', description: 'Informe o nome da loja.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        segment: segment.trim(),
        phone: phone.trim(),
        website: website.trim(),
        business_hours: businessHours.trim(),
        policies: policies.trim(),
        catalog_summary: catalogSummary.trim(),
        knowledge: knowledge.trim(),
      };

      if (selectedStoreId) {
        // Update existing store
        await requestApiEndpoint(`/api/ai/history/stores/${encodeURIComponent(selectedStoreId)}`, 'PUT', payload);
        toast({ title: 'Loja Atualizada', description: `Dados da loja ${name} salvos com sucesso!` });
      } else {
        // Create new store
        const created = await requestApiEndpoint<{ id: string }>('/api/ai/history/stores', 'POST', payload);
        setSelectedStoreId(created.id);
        toast({ title: 'Loja Criada', description: `Loja ${name} criada com sucesso!` });
      }
      await fetchStores();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar loja', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const activeAgent = agents.find((a) => a.key === selectedAgentKey) || agents[0];

  // Combined live prompt preview
  const livePromptPreview = `=== INFORMAÇÕES OFICIAIS DA LOJA (WHITE-LABEL) ===
Nome da Loja: ${name || '[Nome da Loja]'}
${phone ? `Telefone / WhatsApp Oficial: ${phone}\n` : ''}${website ? `Site Oficial: ${website}\n` : ''}${businessHours ? `Horário de Atendimento: ${businessHours}\n` : ''}${policies ? `Políticas (Garantia/Trocas/Frete): ${policies}\n` : ''}${catalogSummary ? `Catálogo & Produtos Principais:\n${catalogSummary}\n` : ''}${knowledge ? `Instruções & Base de Conhecimento Específica:\n${knowledge}\n` : ''}
=== PERFIL DO ATENDENTE ===
Você é ${activeAgent?.name || 'Camila'}, assistente oficial da ${name || '[Nome da Loja]'}.
Instruções de Personalidade & Estilo:
${activeAgent?.personality || 'Atendimento amigável, humanizado, focado na melhor experiência do cliente.'}`;

  const copyPromptPreview = () => {
    navigator.clipboard.writeText(livePromptPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copiado', description: 'Prévia do prompt white-label copiada!' });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining White-Label concept */}
      <div className="p-4 sm:p-5 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Atendente White-Label
            </Badge>
            <Badge variant="outline" className="text-primary border-primary/30">
              1 Persona = Múltiplas Lojas
            </Badge>
          </div>
          <h3 className="text-base font-bold text-foreground">
            Desacoplamento: Persona de Vendas x Dados da Loja
          </h3>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Depois que seu atendente foi treinado e validado em conversas reais, você pode conectá-lo a 
            <strong> qualquer loja ou produto</strong>. O estilo de venda permanece o mesmo, mudando apenas 
            o nome, WhatsApp, catálogo e políticas comerciais da loja de forma 100% white-label.
          </p>
        </div>

        <Button
          onClick={handleNewStore}
          size="sm"
          className="shrink-0 flex items-center gap-1.5 font-semibold"
        >
          <Plus className="w-4 h-4" /> Nova Loja
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Store Selector & Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Store Selector Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Lojas:
            </span>
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectStore(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0 ${
                  selectedStoreId === s.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card/70 border-border/70 text-foreground hover:bg-muted'
                }`}
              >
                {s.name}
              </button>
            ))}
            {stores.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma loja cadastrada ainda.</span>
            )}
          </div>

          {/* Form Card */}
          <Card className="border border-border/60 bg-card/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Store className="w-4 h-4 text-primary" />
                    {selectedStoreId ? `Configurar: ${name}` : 'Cadastrar Nova Loja'}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Informações comerciais injetadas dinamicamente nas respostas da IA.
                  </CardDescription>
                </div>
                <Button
                  onClick={handleSaveStore}
                  disabled={saving || loading}
                  size="sm"
                  className="font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar Loja'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Nome Comercial da Loja</label>
                  <Input
                    placeholder="Ex: Bella Modas"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 bg-background/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Segmento de Atuação</label>
                  <Input
                    placeholder="Ex: Roupas Femininas & Acessórios"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="h-9 bg-background/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3 text-muted-foreground" /> Telefone / WhatsApp Oficial
                  </label>
                  <Input
                    placeholder="Ex: (11) 98765-4321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-9 bg-background/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    <Globe className="w-3 h-3 text-muted-foreground" /> Site / E-commerce
                  </label>
                  <Input
                    placeholder="Ex: www.bellamodas.com.br"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="h-9 bg-background/60"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground" /> Horário de Atendimento da Loja
                </label>
                <Input
                  placeholder="Ex: Seg a Sex: 08:00 às 18:00 | Sábado: 08:00 às 12:00"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  className="h-9 bg-background/60"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Políticas Oficiais (Garantia, Trocas, Pagamentos & Frete)
                </label>
                <Textarea
                  placeholder="Ex: Pagamentos em até 6x sem juros ou 5% no PIX. Frete grátis para compras acima de R$ 200. Troca garantida em até 7 dias."
                  value={policies}
                  onChange={(e) => setPolicies(e.target.value)}
                  className="bg-background/60 min-h-20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <Package className="w-3 h-3 text-amber-400" /> Catálogo & Produtos Principais
                </label>
                <Textarea
                  placeholder="Liste os principais produtos, categorias ou linhas comercializadas pela loja."
                  value={catalogSummary}
                  onChange={(e) => setCatalogSummary(e.target.value)}
                  className="bg-background/60 min-h-20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Base de Conhecimento Específica (FAQ e Regras Especiais)
                </label>
                <Textarea
                  placeholder="Instruções complementares ou regras exclusivas desta unidade/loja."
                  value={knowledge}
                  onChange={(e) => setKnowledge(e.target.value)}
                  className="bg-background/60 min-h-24"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Agent Persona Linking & Live Prompt Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Agent Selector Card */}
          <Card className="border border-border/60 bg-card/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Atendente Vinculado
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione qual atendente validado atenderá esta loja.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {agents.map((ag) => (
                  <button
                    key={ag.key}
                    type="button"
                    onClick={() => onSelectAgent?.(ag.key)}
                    className={`p-2.5 rounded-xl border text-left transition-all text-xs ${
                      selectedAgentKey === ag.key
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border/60 bg-background/50 hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{ag.name}</span>
                      {selectedAgentKey === ag.key && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Prompt Preview Card */}
          <Card className="border border-border/60 bg-muted/20 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Prévia do Prompt White-Label
                  </CardTitle>
                  <CardDescription className="text-[11px] mt-0.5">
                    Como a IA junta o estilo do atendente com os dados desta loja:
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyPromptPreview}
                  className="h-7 text-xs gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-1">
              <div className="p-3 rounded-xl bg-background/80 border border-border/60 font-mono text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[380px] overflow-y-auto">
                {livePromptPreview}
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
};
