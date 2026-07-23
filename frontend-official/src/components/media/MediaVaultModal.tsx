import React, { useState } from "react";
import { Folder, Image as ImageIcon, Video, Mic, FileText, Download, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface MediaVaultItem {
  id: string;
  type: "image" | "video" | "audio" | "document" | "sticker";
  url: string;
  name: string;
  sender: string;
  date: string;
  size?: string;
}

interface MediaVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  items?: MediaVaultItem[];
}

export function MediaVaultModal({ isOpen, onClose, items = [] }: MediaVaultModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Folder className="h-4 w-4 text-emerald-400" /> Galeria de Mídias e Documentos do Atendimento
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Histórico completo de arquivos transmitidos e recebidos nesta conversa no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar mídias por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-background/60 p-1 rounded-lg border border-border/50">
              {["all", "image", "video", "audio", "document"].map((t) => (
                <Button
                  key={t}
                  onClick={() => setFilterType(t)}
                  variant={filterType === t ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 text-[10px] uppercase font-bold px-2 capitalize"
                >
                  {t === "all" ? "Todos" : t}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground text-xs">
                Nenhuma mídia encontrada com os filtros selecionados.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-background/80 p-2.5 rounded-xl border border-border/60 hover:border-emerald-500/40 transition-all space-y-2 group"
                >
                  <div className="h-24 bg-muted/40 rounded-lg flex items-center justify-center relative overflow-hidden">
                    {item.type === "image" && <ImageIcon className="h-8 w-8 text-emerald-400" />}
                    {item.type === "video" && <Video className="h-8 w-8 text-cyan-400" />}
                    {item.type === "audio" && <Mic className="h-8 w-8 text-purple-400" />}
                    {item.type === "document" && <FileText className="h-8 w-8 text-amber-400" />}

                    <a
                      href={item.url}
                      download={item.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Download className="h-5 w-5 text-emerald-400" />
                    </a>
                  </div>

                  <div>
                    <p className="font-bold text-foreground truncate text-[11px]">{item.name}</p>
                    <span className="text-[9px] text-muted-foreground block">{item.date} • {item.sender}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
