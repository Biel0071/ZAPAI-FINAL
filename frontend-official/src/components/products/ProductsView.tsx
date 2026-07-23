import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, MagnifyingGlass, FilePdf, Tag, Truck, Plus, CheckCircle } from "@phosphor-icons/react";
import { apiService } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  promotions?: string;
  images?: string[];
  documents?: { name: string; url: string }[];
  condition?: string;
  shipping?: string;
}

export function ProductsView() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const res = await apiService.getProducts({
          category: selectedCategory || undefined,
          search: search || undefined,
        });
        setProducts(res?.data || []);
      } catch {
        toast({ title: "Produtos", description: "Carregando catálogo de produtos da base..." });
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [search, selectedCategory, toast]);

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
            <ShoppingBag className="text-primary" size={28} weight="duotone" /> Catálogo Comercial de Produtos
          </h2>
          <p className="text-xs text-muted-foreground">
            Produtos e serviços reais integrados com inteligência comercial, propostas e estoque.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto por nome, código ou descrição..."
              className="pl-9 h-9 w-64 text-xs rounded-xl bg-card border-border/80"
            />
          </div>

          <Button size="sm" className="rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex gap-1">
            <Plus size={16} /> Novo Produto
          </Button>
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <span className="font-bold text-muted-foreground uppercase text-[10px]">Categorias:</span>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-xl font-medium transition-all ${
              selectedCategory === null ? "bg-primary text-primary-foreground font-bold shadow-sm" : "bg-card border border-border/60 hover:text-foreground"
            }`}
          >
            Todas ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl font-medium transition-all ${
                selectedCategory === cat ? "bg-primary text-primary-foreground font-bold shadow-sm" : "bg-card border border-border/60 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground animate-pulse">
          Carregando catálogo de produtos reais do banco de dados...
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground bg-card border border-border/60 rounded-2xl">
          Nenhum produto cadastrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <Card key={p.id} className="rounded-2xl border-border/80 bg-card hover:border-primary/50 transition-all duration-200 flex flex-col justify-between">
              <CardContent className="p-5 space-y-4">
                {/* Product Header */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary mb-1">
                      {p.category}
                    </Badge>
                    <h3 className="font-bold text-base text-foreground leading-tight">{p.name}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">Cód: {p.code}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-black text-lg text-emerald-400">
                      R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">Estoque: {p.stock} un</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{p.description}</p>

                {/* Promotions & Details */}
                {p.promotions && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-1.5 font-medium">
                    <Tag size={14} className="text-amber-400" />
                    <span>{p.promotions}</span>
                  </div>
                )}

                {/* Logistics */}
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                  <span className="flex items-center gap-1">
                    <Truck size={12} className="text-primary" /> {p.shipping || "Frete sob consulta"}
                  </span>
                  <span>• Condição: {p.condition || "Novo"}</span>
                </div>

                {/* Attached PDF Specs */}
                {p.documents && p.documents.length > 0 && (
                  <div className="space-y-1 pt-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground block">Ficha Técnica PDF</span>
                    {p.documents.map((doc, idx) => (
                      <a
                        key={idx}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                      >
                        <FilePdf size={14} className="text-red-400" /> {doc.name}
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
