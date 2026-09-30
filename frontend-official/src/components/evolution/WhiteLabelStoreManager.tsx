import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/state/hooks/use-toast';
import { requestApiEndpoint } from '@/core/services/apiService';
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
  Check,
  Palette,
  MapPin,
  UserCheck
} from 'lucide-react';

export interface StoreData {
  id: string;
  name: string;
  segment?: string;
  address?: string;
  phone?: string;
  website?: string;
  business_hours?: string;
  policies?: string;
  catalog_summary?: string;
  knowledge?: string;
  theme_color?: string;
  attendant_name?: string;
  attendant_role?: string;
  attendant_config?: any;
}

export interface WhiteLabelStoreManagerProps {
  initialStoreId?: string;
  onStoreSelected?: (store: StoreData) => void;
  onStoreUpdated?: (store: StoreData) => void;
}

export const WhiteLabelStoreManager: React.FC<WhiteLabelStoreManagerProps> = ({
  initialStoreId,
  onStoreSelected,
  onStoreUpdated
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
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [policies, setPolicies] = useState('');
  const [catalogSummary, setCatalogSummary] = useState('');
  const [knowledge, setKnowledge] = useState('');
  const [themeColor, setThemeColor] = useState('#10b981');
  const [attendantName, setAttendantName] = useState('');
  const [attendantRole, setAttendantRole] = useState('');

  const colorPalettes = [
    { name: 'Verde Esmeralda', hex: '#10b981' },
    { name: 'Azul Corporativo', hex: '#2563eb' },
    { name: 'Roxo Tech', hex: '#7c3aed' },
    { name: 'Âmbar Comercial', hex: '#f59e0b' },
    { name: 'Vinho Elegante', hex: '#991b1b' },
    { name: 'Laranja Varejo', hex: '#ea580c' },
    { name: 'Ciano Moderno', hex: '#06b6d4' },
    { name: 'Grafite Escuro', hex: '#334155' },
  ];

  const fetchStores = async (preferredStoreId?: string) => {
    try {
      setLoading(true);
      const res = await requestApiEndpoint<{ stores: StoreData[] }>('/api/ai/history');
      if (res?.stores) {
        setStores(res.stores);
        if (res.stores.length > 0) {
          const storeId = preferredStoreId || selectedStoreId || initialStoreId;
          loadStoreToForm(res.stores.find((store) => store.id === storeId) || res.stores[0]);
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
    setAddress(store.address || '');
    setPhone(store.phone || '');
    setWebsite(store.website || '');
    setBusinessHours(store.business_hours || '');
    setPolicies(store.policies || '');
    setCatalogSummary(store.catalog_summary || '');
    setKnowledge(store.knowledge || '');
    setThemeColor(store.theme_color || '#10b981');
    setAttendantName(store.attendant_name || '');
    setAttendantRole(store.attendant_role || '');
  };

  const handleSelectStore = (id: string) => {
    const s = stores.find((st) => st.id === id);
    if (s) {
      loadStoreToForm(s);
      onStoreSelected?.(s);
    }
  };

  const handleNewStore = () => {
    setSelectedStoreId('');
    setName('');
    setSegment('');
    setAddress('');
    setPhone('');
    setWebsite('');
    setBusinessHours('');
    setPolicies('');
    setCatalogSummary('');
    setKnowledge('');
    setThemeColor('#10b981');
    setAttendantName('');
    setAttendantRole('');
  };

  const handleSaveStore = async () => {
    if (!name.trim()) {
      toast({ title: 'Aviso', description: 'Informe o nome da loja.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const currentSelected = stores.find((s) => s.id === selectedStoreId);
      const currentConfig = currentSelected?.attendant_config || {};

      const payload = {
        name: name.trim(),
        segment: segment.trim(),
        address: address.trim(),
        phone: phone.trim(),
        website: website.trim(),
        business_hours: businessHours.trim(),
        policies: policies.trim(),
        catalog_summary: catalogSummary.trim(),
        knowledge: knowledge.trim(),
        theme_color: themeColor,
        attendant_name: attendantName.trim(),
        attendant_role: attendantRole.trim(),
        attendant_config: {
          ...currentConfig,
          clothingColor: themeColor,
        }
      };

      let storeId = selectedStoreId;
      if (selectedStoreId) {
        // Update existing store
        await requestApiEndpoint(`/api/ai/history/stores/${encodeURIComponent(selectedStoreId)}`, 'PUT', payload);
        toast({ title: 'Loja Atualizada', description: `Dados e atendente da loja ${name} salvos com sucesso!` });
      } else {
        // Create new store
        const created = await requestApiEndpoint<{ id: string }>('/api/ai/history/stores', 'POST', payload);
        storeId = created.id;
        setSelectedStoreId(created.id);
        toast({ title: 'Loja Criada', description: `Loja ${name} criada com sucesso!` });
      }

      onStoreUpdated?.({ id: storeId, ...payload });
      await fetchStores(storeId);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar loja', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Combined live prompt preview
  const livePromptPreview = `=== INFORMAÇÕES OFICIAIS DA LOJA (WHITE-LABEL) ===
Nome da Loja: ${name || '[Nome da Loja]'}
Segmento: ${segment || '[Segmento]'}
${address ? `Endereço / Unidade: ${address}\n` : ''}${phone ? `Telefone / WhatsApp Oficial: ${phone}\n` : ''}${website ? `Site Oficial: ${website}\n` : ''}${businessHours ? `Horário de Atendimento: ${businessHours}\n` : ''}${policies ? `Políticas (Garantia/Trocas/Frete/Pagamento):\n${policies}\n` : ''}${catalogSummary ? `Catálogo & Produtos Principais:\n${catalogSummary}\n` : ''}${knowledge ? `Instruções & Base de Conhecimento Específica:\n${knowledge}\n` : ''}
=== IDENTIDADE DO ATENDENTE NA PRÉVIA ===
Você é ${attendantName || '[Nome do atendente]'}, ${attendantRole || 'assistente'} da ${name || '[Nome da Loja]'}.
Instruções de Personalidade & Estilo:
Atenda de forma clara e consultiva via WhatsApp. Use apenas preços, prazos e políticas informados pela loja; quando faltarem dados, peça confirmação.`;

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
              <Sparkles className="w-3.5 h-3.5" /> Configuração da loja
            </Badge>
          </div>
          <h3 className="text-base font-bold text-foreground">
            Identidade e informações da loja
          </h3>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Defina os dados que o atendente pode usar nas respostas e personalize sua aparência.
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
        
        {/* Store selector and form */}
        <div className="lg:col-span-12 space-y-4">
          
          {/* Store Selector Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Lojas:
            </span>
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectStore(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedStoreId === s.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card/70 border-border/70 text-foreground hover:bg-muted'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: s.theme_color || '#10b981' }}
                />
                <span>{s.name}</span>
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
                    {selectedStoreId ? `Configurar Loja: ${name}` : 'Cadastrar Nova Loja'}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Identidade, horários, catálogo e regras comerciais da loja.
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
              
              {/* Cores da Loja (Tema / Accent Color) */}
              <div className="p-3 rounded-xl bg-background/50 border border-border/50 space-y-2">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-primary" />
                  Cor Principal da Loja & Uniforme do Atendente
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colorPalettes.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setThemeColor(c.hex)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all ${
                        themeColor === c.hex
                          ? 'border-white bg-white/10 font-bold shadow-sm'
                          : 'border-border/40 hover:border-border/80'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-muted-foreground">Hex:</span>
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="w-7 h-7 rounded border border-border/60 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Informações Básicas da Loja */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Nome Comercial da Loja</label>
                  <Input
                    placeholder="Ex: Depósito Vista Alegre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 bg-background/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Segmento de Atuação</label>
                  <Input
                    placeholder="Ex: Materiais de Construção & Reforma"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="h-9 bg-background/60"
                  />
                </div>
              </div>

              {/* Endereço Físico e Contatos */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" /> Endereço Físico da Loja / Unidade
                </label>
                <Input
                  placeholder="Ex: Av. Comercial Vista Alegre, 1200 - Centro, Belo Horizonte - MG"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 bg-background/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3 text-muted-foreground" /> Telefone / WhatsApp Oficial
                  </label>
                  <Input
                    placeholder="Ex: (31) 99380-7167"
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
                    placeholder="Ex: www.depositovistaalegre.com.br"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="h-9 bg-background/60"
                  />
                </div>
              </div>

              {/* Configuração do Atendente Desta Loja */}
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    Nome e papel do atendente na prévia
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Nome do Atendente</label>
                    <Input
                      placeholder="Ex: Camila, Vitória, Lucas..."
                      value={attendantName}
                      onChange={(e) => setAttendantName(e.target.value)}
                      className="h-9 bg-background/80"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Papel / Função Comercial</label>
                    <Input
                      placeholder="Ex: Especialista em Vendas & Orçamentos"
                      value={attendantRole}
                      onChange={(e) => setAttendantRole(e.target.value)}
                      className="h-9 bg-background/80"
                    />
                  </div>
                </div>
              </div>

              {/* Horário de Atendimento */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground" /> Horário de Atendimento da Loja
                </label>
                <Input
                  placeholder="Ex: Seg a Sex: 07:30 às 18:00 | Sábado: 07:30 às 13:00"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  className="h-9 bg-background/60"
                />
              </div>

              {/* Políticas Oficiais */}
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

              {/* Catálogo & Produtos Principais */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <Package className="w-3 h-3 text-amber-400" /> Catálogo & Produtos Principais
                </label>
                <Textarea
                  placeholder="Liste os principais produtos, categorias, marcas e especificações da loja."
                  value={catalogSummary}
                  onChange={(e) => setCatalogSummary(e.target.value)}
                  className="bg-background/60 min-h-20"
                />
              </div>

              {/* Base de Conhecimento Específica */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Base de Conhecimento Específica (FAQ e Regras Comerciais Exclusivas)
                </label>
                <Textarea
                  placeholder="Instruções complementares ou regras exclusivas desta unidade/loja para a IA responder com precisão."
                  value={knowledge}
                  onChange={(e) => setKnowledge(e.target.value)}
                  className="bg-background/60 min-h-24"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <details className="lg:col-span-12 rounded-2xl border border-border/60 bg-card/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Ver prévia das instruções da loja</summary>
          <Card className="mt-4 border border-border/60 bg-muted/20 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Instruções geradas com os dados da loja
                  </CardTitle>
                  <CardDescription className="text-[11px] mt-0.5">
                    Confira o texto antes de copiar ou compartilhar.
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
              <div className="p-3 rounded-xl bg-background/80 border border-border/60 font-mono text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                {livePromptPreview}
              </div>
            </CardContent>
          </Card>

        </details>

      </div>
    </div>
  );
};
