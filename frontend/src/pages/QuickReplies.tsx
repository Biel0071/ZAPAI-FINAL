import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface QuickReply {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
}

export default function QuickRepliesPage() {
  const [items, setItems] = useState<QuickReply[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("geral");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/quick-replies", {
        headers: { "x-tenant-id": "default" }
      });
      if (!response.ok) throw new Error("Failed to load quick replies");
      const data = await response.json();
      setItems(data || []);
    } catch (error) {
      console.error("Failed to load quick replies:", error);
      toast.error("Falha ao carregar respostas rápidas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setCategory("geral");
    setContent("");
    setOpen(true);
  }

  function openEdit(item: QuickReply) {
    setEditing(item);
    setTitle(item.title);
    setCategory(item.category);
    setContent(item.content);
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { title, category, content, tags: [] };

    try {
      const url = editing ? `/api/quick-replies/${editing.id}` : "/api/quick-replies";
      const method = editing ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": "default"
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save quick reply");

      setOpen(false);
      await load();
      toast.success(editing ? "Resposta atualizada" : "Resposta criada");
    } catch (error) {
      console.error("Failed to save quick reply:", error);
      toast.error("Falha ao salvar resposta rápida");
    }
  }

  async function remove(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta resposta rápida?")) return;

    try {
      const response = await fetch(`/api/quick-replies/${id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": "default" }
      });

      if (!response.ok) throw new Error("Failed to delete quick reply");

      await load();
      toast.success("Resposta excluída");
    } catch (error) {
      console.error("Failed to delete quick reply:", error);
      toast.error("Falha ao excluir resposta rápida");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Respostas Rápidas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas respostas predefinidas para agilizar o atendimento
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Resposta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}
              </DialogTitle>
              <DialogDescription>
                Crie uma resposta predefinida para usar rapidamente nas conversas
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Boas-vindas"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: geral"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Digite a resposta..."
                  rows={4}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Respostas Cadastradas</CardTitle>
          <CardDescription>
            {items.length} {items.length === 1 ? "resposta" : "respostas"} encontrada{items.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma resposta rápida cadastrada</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.category} • {item.content}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
