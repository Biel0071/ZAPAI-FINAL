import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  UploadSimple,
  Trash,
  ShoppingBag,
  Spinner,
  Image as ImageIcon,
  Check,
  Tag,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";
import { apiService } from "@/core/services/apiService";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";

export interface EditableProduct {
  id?: string;
  name: string;
  code?: string;
  price: number | string;
  description?: string;
  category?: string;
  stock?: number | string;
  images?: string[];
  image?: string;
  condition?: string;
  shipping?: string;
  whatsapp_url?: string;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: EditableProduct | null;
  onSaved?: (savedProduct: any) => void;
  onDeleted?: (deletedId: string) => void;
}

const COMMON_CATEGORIES = [
  "Caixas d'Água",
  "Cimento & Argamassa",
  "Agregados & Areia",
  "Tijolos & Blocos",
  "Churrasqueiras & Lazer",
  "Coberturas & Telhas",
  "Tintas & Acabamento",
  "Geral",
];

export function ProductFormModal({
  isOpen,
  onClose,
  product,
  onSaved,
  onDeleted,
}: ProductFormModalProps) {
  const isEditing = Boolean(product?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Geral");
  const [stock, setStock] = useState("10");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setCode(product.code || "");
      setPrice(String(product.price ?? ""));
      setDescription(product.description || "");
      setCategory(product.category || "Geral");
      setStock(String(product.stock ?? "10"));
      const currentImg =
        (Array.isArray(product.images) && product.images[0]) ||
        product.image ||
        "";
      setImageUrl(currentImg);
    } else {
      setName("");
      setCode("");
      setPrice("");
      setDescription("");
      setCategory("Geral");
      setStock("10");
      setImageUrl("");
    }
  }, [product, isOpen]);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await apiService.uploadProductImage(file);
      if (res?.success && res.url) {
        setImageUrl(res.url);
        toast.success("Foto do produto carregada com sucesso!");
      }
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + (err?.message || "Tente novamente"));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.warning("Informe o nome do produto.");
      return;
    }

    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum) || priceNum < 0) {
      toast.warning("Informe um preço válido.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: cleanName,
        code: code.trim(),
        price: priceNum,
        description: description.trim(),
        category: category.trim() || "Geral",
        stock: parseInt(stock, 10) || 10,
        images: imageUrl ? [imageUrl] : ["/assets/catalog/areia_m3.png"],
      };

      let result;
      if (isEditing && product?.id) {
        result = await apiService.updateProduct(product.id, payload);
        toast.success(`"${cleanName}" atualizado com sucesso!`);
      } else {
        result = await apiService.createProduct(payload);
        toast.success(`"${cleanName}" criado no catálogo com sucesso!`);
      }

      if (onSaved) onSaved(result?.data || payload);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao salvar produto: " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product?.id) return;
    if (!confirm(`Deseja realmente excluir o produto "${name}" do catálogo?`)) return;

    try {
      setDeleting(true);
      await apiService.deleteProduct(product.id);
      toast.success("Produto removido do catálogo.");
      if (onDeleted) onDeleted(product.id);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao excluir produto: " + (err?.message || ""));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-[#111b21] text-[#e9edef] border-[#2a3942] p-0 overflow-hidden shadow-2xl rounded-2xl">
        <DialogHeader className="px-5 py-4 bg-[#202c33] border-b border-[#2a3942]">
          <DialogTitle className="text-base font-bold text-[#e9edef] flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-400" weight="fill" />
            <span>{isEditing ? "Editar item do catálogo" : "Adicionar novo item"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8696a0]">
            {isEditing
              ? "Altere a foto, preço e detalhes oficiais do produto sincronizado com o WhatsApp Web."
              : "Cadastre um novo produto com foto e preço real para envio instantâneo no chat."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Foto do Produto */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
              Foto do Produto
            </Label>
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "relative h-24 w-24 rounded-xl border-2 border-dashed border-[#2a3942] bg-[#202c33] overflow-hidden flex items-center justify-center shrink-0 cursor-pointer group hover:border-emerald-500/60 transition-colors",
                  uploadingImage && "opacity-60"
                )}
                onClick={() => fileInputRef.current?.click()}
                title="Clique para escolher uma imagem do computador"
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/assets/catalog/areia_m3.png";
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#8696a0] p-2 text-center">
                    <ImageIcon className="h-6 w-6 text-[#8696a0]" />
                    <span className="text-[10px] mt-1">Adicionar foto</span>
                  </div>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Spinner className="h-5 w-5 animate-spin text-emerald-400" />
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="h-8 text-xs font-semibold border-[#2a3942] bg-[#202c33] text-[#e9edef] hover:bg-[#2a3942] gap-1.5 rounded-lg"
                >
                  <UploadSimple className="h-4 w-4 text-emerald-400" />
                  <span>{imageUrl ? "Trocar foto" : "Carregar foto"}</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                <p className="text-[11px] text-[#8696a0] leading-tight">
                  PNG, JPG ou WebP de até 15MB. A imagem será exibida nos cards enviados no WhatsApp.
                </p>
              </div>
            </div>
          </div>

          {/* Nome do Produto */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
              Nome do produto *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: CAIXA - 5000L ou AREIA - M³"
              className="bg-[#202c33] border-[#2a3942] text-[#e9edef] rounded-xl h-10 text-sm focus:border-emerald-500"
            />
          </div>

          {/* Preço e Código SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
                Preço (R$) *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-[#8696a0] font-bold">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                  className="pl-9 bg-[#202c33] border-[#2a3942] text-[#e9edef] rounded-xl h-10 text-sm font-semibold focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
                Código / SKU
              </Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: CX-5000"
                className="bg-[#202c33] border-[#2a3942] text-[#e9edef] rounded-xl h-10 text-sm focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Categoria / Coleção */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
              Coleção / Categoria
            </Label>
            <div className="flex gap-1.5 flex-wrap mb-1.5">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                    category === cat
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold"
                      : "border-[#2a3942] bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Digite ou escolha uma categoria"
              className="bg-[#202c33] border-[#2a3942] text-[#e9edef] rounded-xl h-9 text-xs focus:border-emerald-500"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
              Descrição do produto
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva detalhes, especificações, dimensões ou condições de entrega..."
              rows={3}
              className="bg-[#202c33] border-[#2a3942] text-[#e9edef] rounded-xl text-xs focus:border-emerald-500 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="px-5 py-3.5 bg-[#202c33] border-t border-[#2a3942] flex items-center justify-between sm:justify-between">
          {isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1 rounded-xl h-9"
            >
              {deleting ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Trash className="h-3.5 w-3.5" />}
              <span>Excluir</span>
            </Button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[#8696a0] hover:text-[#e9edef] text-xs rounded-xl h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || uploadingImage}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs px-4 rounded-xl h-9 gap-1.5 shadow-md"
            >
              {saving ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" weight="bold" />}
              <span>{isEditing ? "Salvar alterações" : "Adicionar item"}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
