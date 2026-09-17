import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Package,
  Truck,
  CreditCard,
  Clock,
  HelpCircle,
  AlertCircle
} from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN } from "@/services/apiService";

interface OfficialKnowledgeItem {
  id: number;
  category: string;
  key: string;
  title: string;
  content: any;
  raw_text: string;
  tags: string[];
  is_active: boolean;
  updated_at: string;
}

export function OfficialKnowledgeManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<OfficialKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OfficialKnowledgeItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formCategory, setFormCategory] = useState("products");
  const [formKey, setFormKey] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formRawText, setFormRawText] = useState("");
  const [formTags, setFormTags] = useState("");

  const fetchItems = async () => {
    try {
      setLoading(true);
      const url = `${API_ORIGIN}/api/ai/evolution/official-knowledge${search ? `?q=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url, { credentials: "omit" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setItems(json.data);
      }
    } catch (err: any) {
      console.error("[OfficialKnowledgeManager] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [search]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormCategory("products");
    setFormKey("");
    setFormTitle("");
    setFormRawText("");
    setFormTags("");
    setModalOpen(true);
  };

  const openEditModal = (item: OfficialKnowledgeItem) => {
    setEditingItem(item);
    setFormCategory(item.category);
    setFormKey(item.key);
    setFormTitle(item.title);
    setFormRawText(item.raw_text || "");
    setFormTags(Array.isArray(item.tags) ? item.tags.join(", ") : "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formCategory || !formKey || !formTitle || !formRawText) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/official-knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          id: editingItem?.id,
          category: formCategory,
          key: formKey,
          title: formTitle,
          raw_text: formRawText,
          tags: formTags.split(",").map(t => t.trim()).filter(Boolean),
          is_active: true
        })
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Conhecimento Oficial Salvo com Sucesso!" });
        setModalOpen(false);
        fetchItems();
      } else {
        toast({ title: "Erro ao salvar", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover este item oficial?")) return;
    try {
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/official-knowledge/${id}`, {
        method: "DELETE",
        credentials: "omit"
      });
      if (res.ok) {
        toast({ title: "Item removido" });
        fetchItems();
      }
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const filteredItems = items.filter(item => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    return true;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "products": return <Package className="w-4 h-4 text-emerald-400" />;
      case "shipping": return <Truck className="w-4 h-4 text-blue-400" />;
      case "policies": return <CreditCard className="w-4 h-4 text-purple-400" />;
      case "company_info": return <Clock className="w-4 h-4 text-amber-400" />;
      default: return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white font-semibold flex items-center gap-1 px-2.5 py-0.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Camada 1: Autoridade Máxima
              </Badge>
              <span className="text-xs text-muted-foreground">Imutável pela IA</span>
            </div>
            <h2 className="text-xl font-bold mt-1 text-foreground">
              Verdade Oficial da Loja — Catálogo, Preços e Regras
            </h2>
            <p className="text-xs text-muted-foreground max-w-2xl mt-0.5">
              Cadastre aqui todos os preços, regras de frete e prazos oficiais. A IA consulta esta tabela
              como autoridade absoluta e é <strong>estritamente proibida de inventar ou alterar</strong> esses dados.
            </p>
          </div>
          <Button onClick={openCreateModal} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Novo Item Oficial
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto, preço, frete, tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {["all", "products", "shipping", "policies", "company_info"].map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-8 capitalize"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === "all" ? "Todos" : cat === "products" ? "Produtos" : cat === "shipping" ? "Frete" : cat === "policies" ? "Políticas" : "Horários"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="border border-border/50 bg-card/60 hover:border-emerald-500/30 transition-all shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider flex items-center gap-1">
                    {getCategoryIcon(item.category)}
                    {item.category}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">{item.key}</span>
                </div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  {item.title}
                </CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditModal(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2.5">
              <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/20 p-2.5 rounded-lg border border-border/30 font-sans">
                {item.raw_text}
              </p>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {item.tags.map((t, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted/40">
                      #{t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Conhecimento Oficial" : "Novo Item de Conhecimento Oficial"}</DialogTitle>
            <DialogDescription className="text-xs">
              Este dado entrará imediatamente na Memória Base (Camada 1) e norteará todas as respostas da IA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="products">Produtos / Preços</SelectItem>
                    <SelectItem value="shipping">Frete e Entrega</SelectItem>
                    <SelectItem value="policies">Políticas de Pagamento</SelectItem>
                    <SelectItem value="company_info">Horários e Loja</SelectItem>
                    <SelectItem value="faq">Dúvidas Frequentes (FAQ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chave Identificadora (slug)</Label>
                <Input
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="ex: prod_churrasqueira"
                  className="h-9 text-xs font-mono"
                  disabled={Boolean(editingItem)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Título Oficial</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="ex: Churrasqueira Trio Pré-Moldada"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Texto Oficial Canônico (Instrução Direta para a IA)</Label>
              <Textarea
                value={formRawText}
                onChange={(e) => setFormRawText(e.target.value)}
                placeholder="Descreva exatamente preços, prazos, descontos e condições. A IA usará este texto como verdade absoluta."
                rows={4}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tags de Busca (separadas por vírgula)</Label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="churrasqueira, trio, fogao, preco, lazer"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving} onClick={handleSave}>
              {saving ? "Salvando..." : "Salvar Conhecimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default OfficialKnowledgeManager;
