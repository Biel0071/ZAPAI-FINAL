import React, { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Storefront,
  Plus,
  PencilSimple,
  Trash,
  Phone,
  Globe,
  Clock,
  ShieldCheck,
  Package,
  Sparkle,
  WhatsappLogo,
  User,
  ArrowRight,
  CheckCircle,
  FileText,
  Buildings,
  TShirt,
} from "@phosphor-icons/react";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { cn } from "@/core/lib/utils";
import { useNavigate } from "react-router-dom";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { createAgentAvatar, buildStoreVisualDNA } from "@/components/avatar-engine/CharacterFactory";

interface StoreItem {
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
  numbers?: Array<{
    id: string | number;
    sessionId: string;
    sessionName: string;
    phone?: string;
    status?: string;
    attendant?: {
      key: string;
      name: string;
      role: string;
      active: boolean;
      avatar?: string;
    } | null;
  }>;
  attendants?: Array<any>;
}

export default function StoresPage() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // Store Create / Edit Dialog
  const [isStoreDialogOpen, setIsStoreDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    segment: "",
    address: "",
    phone: "",
    website: "",
    business_hours: "",
    policies: "",
    catalog_summary: "",
    knowledge: "",
    theme_color: "#10b981",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirm Dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<StoreItem | null>(null);

  const fetchStores = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getStores();
      if (res && Array.isArray(res.stores)) {
        setStores(res.stores);
        if (res.stores.length > 0 && !selectedStoreId) {
          setSelectedStoreId(res.stores[0].id);
        }
      }
    } catch (err: any) {
      notify.error(err?.message || "Falha ao carregar lojas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const activeStore = useMemo(() => {
    return stores.find((s) => s.id === selectedStoreId) || stores[0] || null;
  }, [stores, selectedStoreId]);

  const handleOpenCreate = () => {
    setEditingStore(null);
    setFormData({
      name: "",
      segment: "Varejo & Serviços",
      address: "",
      phone: "",
      website: "",
      business_hours: "Seg a Sex: 08:00 às 18:00 | Sábado: 08:00 às 13:00",
      policies: "Frete grátis em compras acima de R$ 200 na região. Desconto de 5% no PIX ou até 6x sem juros.",
      catalog_summary: "",
      knowledge: "",
      theme_color: "#10b981",
    });
    setIsStoreDialogOpen(true);
  };

  const handleOpenEdit = (store: StoreItem) => {
    setEditingStore(store);
    setFormData({
      name: store.name || "",
      segment: store.segment || "",
      address: store.address || "",
      phone: store.phone || "",
      website: store.website || "",
      business_hours: store.business_hours || "",
      policies: store.policies || "",
      catalog_summary: store.catalog_summary || "",
      knowledge: store.knowledge || "",
      theme_color: store.theme_color || "#10b981",
    });
    setIsStoreDialogOpen(true);
  };

  const handleSaveStore = async () => {
    if (!formData.name.trim()) {
      notify.error("Informe o nome da loja.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingStore) {
        await apiService.updateStore(editingStore.id, formData);
        notify.success("Padrão da loja atualizado com sucesso!");
      } else {
        const res = await apiService.createStore(formData);
        notify.success("Loja criada com sucesso!");
        if (res.id) setSelectedStoreId(res.id);
      }
      setIsStoreDialogOpen(false);
      await fetchStores();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao salvar loja.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStore = async () => {
    if (!storeToDelete) return;
    try {
      await apiService.deleteStore(storeToDelete.id);
      notify.success("Loja removida.");
      setDeleteConfirmOpen(false);
      setStoreToDelete(null);
      await fetchStores();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao remover loja.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Storefront weight="fill" className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-display">
                  Lojas & Padrões Comerciais
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Hierarquia oficial: cada loja possui seus números de WhatsApp e atendentes dedicados que herdam o catálogo e políticas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenCreate}
              className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-glow"
            >
              <Plus weight="bold" className="h-4 w-4" />
              <span>Nova Loja</span>
            </Button>
          </div>
        </div>

        {/* Store Tabs / Selector */}
        {stores.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {stores.map((store) => {
              const isSelected = activeStore?.id === store.id;
              return (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => setSelectedStoreId(store.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs md:text-sm font-medium transition-all shrink-0 select-none",
                    isSelected
                      ? "bg-card border-emerald-500/50 text-foreground shadow-sm ring-1 ring-emerald-500/30"
                      : "bg-card/50 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <Storefront weight={isSelected ? "fill" : "regular"} className={cn("h-4 w-4", isSelected ? "text-emerald-400" : "text-muted-foreground")} />
                  <span>{store.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/60 bg-background/50 font-mono">
                    {store.numbers?.length || 0} zap{store.numbers?.length === 1 ? "" : "s"}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        {/* Store Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            <div className="h-64 rounded-2xl bg-card/60 border border-border/50 col-span-2" />
            <div className="h-64 rounded-2xl bg-card/60 border border-border/50" />
          </div>
        ) : !activeStore ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-4">
            <Storefront weight="light" className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Nenhuma loja cadastrada</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Cadastre sua primeira loja para definir catálogo, horários, frete e atribuir números com atendentes digitais.
              </p>
            </div>
            <Button onClick={handleOpenCreate} className="gap-2 rounded-xl">
              <Plus weight="bold" className="h-4 w-4" />
              <span>Criar Loja Agora</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: STORE PROFILE (Padrão da Loja) */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-2xl border-border/70 bg-card/80 backdrop-blur shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold text-foreground font-display flex items-center gap-2">
                        {activeStore.name}
                      </CardTitle>
                      {activeStore.segment && (
                        <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                          {activeStore.segment}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      Perfil comercial herdado automaticamente pelos atendentes digitais vinculados.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(activeStore)}
                      className="h-8 rounded-xl px-2.5 gap-1.5 text-xs border-border/60 hover:border-emerald-500/40"
                    >
                      <PencilSimple className="h-3.5 w-3.5" />
                      <span>Editar Padrão</span>
                    </Button>
                    {stores.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStoreToDelete(activeStore);
                          setDeleteConfirmOpen(true);
                        }}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 pt-4">
                  {/* Meta Chips */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-border/50 bg-background/40 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-400" />
                        Horário de Atendimento
                      </p>
                      <p className="text-xs font-semibold text-foreground truncate">
                        {activeStore.business_hours || "Não especificado"}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border/50 bg-background/40 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-emerald-400" />
                        Telefone Oficial
                      </p>
                      <p className="text-xs font-semibold text-foreground truncate">
                        {activeStore.phone || "Não informado"}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border/50 bg-background/40 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-emerald-400" />
                        Website / Catálogo
                      </p>
                      <p className="text-xs font-semibold text-foreground truncate">
                        {activeStore.website || "Não informado"}
                      </p>
                    </div>
                  </div>

                  {/* Policies & Commercial Rules */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <ShieldCheck weight="fill" className="h-4 w-4 text-emerald-400" />
                      <span>Políticas Comerciais, Fretes & Formas de Pagamento</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-border/60 bg-background/60 text-xs text-foreground/90 leading-relaxed whitespace-pre-line font-sans">
                      {activeStore.policies || "Nenhuma política definida ainda. Clique em Editar Padrão para configurar."}
                    </div>
                  </div>

                  {/* Catalog Summary */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Package weight="fill" className="h-4 w-4 text-emerald-400" />
                      <span>Resumo do Catálogo & Principais Produtos</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-border/60 bg-background/60 text-xs text-foreground/90 leading-relaxed whitespace-pre-line font-sans max-h-48 overflow-y-auto">
                      {activeStore.catalog_summary || "Nenhum resumo de produtos cadastrado. Adicione seus principais itens para que os atendentes recomendem com precisão."}
                    </div>
                  </div>

                  {/* Store Visual DNA (Padrão Visual dos Atendentes) */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <TShirt weight="fill" className="h-4 w-4 text-emerald-400" />
                        <span>DNA Visual dos Atendentes (Store Visual DNA)</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/attendants")}
                        className="h-6 text-[11px] px-2 text-emerald-400 hover:text-emerald-300 gap-1"
                      >
                        <span>Abrir Avatar Studio</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Cores Oficiais:</span>
                          <div className="flex items-center gap-1">
                            <span
                              className="w-4 h-4 rounded-full border border-black/30 shadow-xs"
                              style={{ backgroundColor: activeStore.theme_color || "#10b981" }}
                              title="Cor Primária"
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-black/30 shadow-xs bg-[#0f172a]"
                              title="Cor Secundária"
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-black/30 shadow-xs bg-[#00f090]"
                              title="Cor Acento Neon"
                            />
                          </div>
                        </div>

                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Uniforme Padrão:</span> Camisa Polo ZAI com detalhe verde • Crachá Oficial em cordão • Headset ZAI
                        </div>

                        <p className="text-[10px] text-muted-foreground italic">
                          Todos os atendentes criados para {activeStore.name} herdam automaticamente este padrão institucional, mantendo individualidade de rosto e cabelo (sem clones).
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/50">
                        <ZaiAvatarRenderer
                          avatar={createAgentAvatar({
                            agentId: "camila",
                            name: "Camila",
                            role: "Vendas",
                            storeId: activeStore.id,
                            storeDNA: buildStoreVisualDNA(activeStore),
                            gender: "female",
                          })}
                          size="sm"
                          showAura={false}
                          showStatusBadge={false}
                        />
                        <ZaiAvatarRenderer
                          avatar={createAgentAvatar({
                            agentId: "rafael",
                            name: "Rafael",
                            role: "Suporte",
                            storeId: activeStore.id,
                            storeDNA: buildStoreVisualDNA(activeStore),
                            gender: "male",
                          })}
                          size="sm"
                          showAura={false}
                          showStatusBadge={false}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Col: NUMBERS & DIGITAL ATTENDANTS IN THIS STORE */}
            <div className="space-y-6">
              <Card className="rounded-2xl border-border/70 bg-card/80 backdrop-blur shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground font-display">
                        Conexões & Atendentes
                      </CardTitle>
                      <CardDescription className="text-xs">
                        1 Número WhatsApp = 1 Atendente Principal
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-border/60 bg-muted/30 text-xs">
                      {activeStore.numbers?.length || 0} número(s)
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  {(!activeStore.numbers || activeStore.numbers.length === 0) ? (
                    <div className="text-center py-8 rounded-xl border border-dashed border-border/70 bg-background/30 space-y-3">
                      <WhatsappLogo className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">
                        Nenhum número de WhatsApp vinculado a esta loja no momento.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("/connections")}
                        className="rounded-xl text-xs gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Vincular em Conexões</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeStore.numbers.map((num) => {
                        const attendant = num.attendant;
                        return (
                          <div
                            key={num.sessionId}
                            className="p-3.5 rounded-xl border border-border/60 bg-background/50 space-y-2.5 transition-all hover:border-emerald-500/30"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                                  <WhatsappLogo weight="fill" className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {num.sessionName}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate font-mono">
                                    {num.phone || num.sessionId}
                                  </p>
                                </div>
                              </div>

                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] uppercase font-bold",
                                  num.status === "connected"
                                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                    : "border-border/60 text-muted-foreground bg-muted/20"
                                )}
                              >
                                {num.status === "connected" ? "Conectado" : "Offline"}
                              </Badge>
                            </div>

                            {/* Attendant linked to this number */}
                            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                              {attendant ? (
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <img
                                      src={attendant.avatar || "/assets/evolution/camila_avatar.png"}
                                      alt={attendant.name}
                                      className="h-8 w-8 rounded-full border border-emerald-500/30 object-cover bg-background"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = "/assets/evolution/camila_avatar.png";
                                      }}
                                    />
                                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                                      {attendant.name}
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-emerald-500/30 text-emerald-400">
                                        {attendant.role || "Vendas"}
                                      </Badge>
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Herda Padrão: {activeStore.name}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <User className="h-4 w-4" />
                                  <span>Sem atendente vinculado</span>
                                </div>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate("/attendants")}
                                className="h-7 text-[11px] px-2 rounded-lg text-emerald-400 hover:text-emerald-300"
                              >
                                Gerenciar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      onClick={() => navigate("/attendants")}
                      className="w-full rounded-xl gap-2 text-xs h-9 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Novo Atendente para esta Loja</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL DE CRIAÇÃO / EDIÇÃO DE LOJA ================= */}
      <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border/80 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {editingStore ? "Editar Loja & Padrão Comercial" : "Cadastrar Nova Loja"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure as informações oficiais da sua loja. Os atendentes herdarão automaticamente este catálogo e regras.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="store-name" className="text-xs font-semibold">Nome da Loja *</Label>
                <Input
                  id="store-name"
                  placeholder="Ex: Depósito Mais Barato"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="store-segment" className="text-xs font-semibold">Nicho / Segmento</Label>
                <Input
                  id="store-segment"
                  placeholder="Ex: Materiais de Construção & Reforma"
                  value={formData.segment}
                  onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="store-phone" className="text-xs font-semibold">Telefone / WhatsApp de Contato</Label>
                <Input
                  id="store-phone"
                  placeholder="Ex: (11) 99999-1111"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="store-website" className="text-xs font-semibold">Website / Link Oficial</Label>
                <Input
                  id="store-website"
                  placeholder="Ex: www.depositomais.com.br"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-hours" className="text-xs font-semibold">Horário de Atendimento Oficial</Label>
              <Input
                id="store-hours"
                placeholder="Ex: Seg a Sex: 07:30 às 18:00 | Sábado: 07:30 às 13:00"
                value={formData.business_hours}
                onChange={(e) => setFormData({ ...formData, business_hours: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-policies" className="text-xs font-semibold">
                Regras de Frete, Formas de Pagamento & Garantias (Herança Oficial)
              </Label>
              <Textarea
                id="store-policies"
                rows={3}
                placeholder="Ex: Frete grátis em compras acima de R$ 200 na região. Desconto de 5% no PIX ou até 6x sem juros no cartão."
                value={formData.policies}
                onChange={(e) => setFormData({ ...formData, policies: e.target.value })}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-catalog" className="text-xs font-semibold">
                Resumo do Catálogo & Produtos Principais
              </Label>
              <Textarea
                id="store-catalog"
                rows={4}
                placeholder="Ex: Cimento CP-II e CP-III (50kg), Tijolos 8 furos, Tintas Suvinil 18L, Telhas de fibrocimento..."
                value={formData.catalog_summary}
                onChange={(e) => setFormData({ ...formData, catalog_summary: e.target.value })}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-knowledge" className="text-xs font-semibold">
                Instruções Gerais de Atendimento & Diferenciais
              </Label>
              <Textarea
                id="store-knowledge"
                rows={2}
                placeholder="Ex: Entregas em até 4 horas na região para pedidos feitos até as 11h. Emissão de NF para CPF e CNPJ."
                value={formData.knowledge}
                onChange={(e) => setFormData({ ...formData, knowledge: e.target.value })}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsStoreDialogOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveStore}
              disabled={isSaving || !formData.name.trim()}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSaving ? "Salvando..." : editingStore ? "Salvar Alterações" : "Criar Loja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ================= */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="border-destructive/30 bg-card/95">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash className="h-5 w-5" />
              Excluir Loja
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{storeToDelete?.name}</strong>? Os atendentes e números vinculados não serão apagados, mas deixarão de herdar este padrão.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteStore} className="rounded-xl">
              Excluir Loja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

