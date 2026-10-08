import React, { useState } from "react";
import { Link2, Sparkles, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export const AVAILABLE_QUICK_REPLY_TAGS = [
  { tag: "#nome", label: "Nome completo do cliente", group: "contact" },
  { tag: "#primeiroNome", label: "Primeiro nome do cliente", group: "contact" },
  { tag: "#numero", label: "Número de telefone / WhatsApp", group: "contact" },
  { tag: "#periodo-dia", label: "Período do dia (dia / tarde / noite)", group: "contact" },
  { tag: "#saudação", label: "Saudação dinâmica (Bom dia / Boa tarde / Boa noite)", group: "contact" },
  { tag: "#mencionar-todos", label: "Mencionar todos (@todos)", group: "contact" },
  { tag: "#sexo", label: "Gênero do contato", group: "contact" },
  { tag: "#data_nascimento", label: "Data de nascimento", group: "contact" },
  { tag: "#idioma", label: "Idioma de atendimento", group: "contact" },
  { tag: "#email", label: "E-mail do contato", group: "contact" },
  { tag: "#cidade", label: "Cidade", group: "contact" },
  { tag: "#estado", label: "Estado (UF)", group: "contact" },
  { tag: "#origem", label: "Origem do contato (Canal)", group: "contact" },
  { tag: "#data_entrada", label: "Data de primeiro contato", group: "contact" },
  { tag: "#data_saida", label: "Data de saída / fechamento", group: "contact" },
  { tag: "#valor_negocio", label: "Valor estimado do negócio", group: "contact" },
  { tag: "#empresa", label: "Nome da empresa / loja", group: "contact" },
  { tag: "#cargo", label: "Cargo ou função", group: "contact" },
  { tag: "#produtos_de_interesse", label: "Produtos de interesse", group: "contact" },
  { tag: "#observações", label: "Notas / observações do contato", group: "contact" },
];

interface QuickReplyTagsPickerProps {
  onSelectTag: (tag: string) => void;
  className?: string;
}

export function QuickReplyTagsPicker({ onSelectTag, className }: QuickReplyTagsPickerProps) {
  const [open, setOpen] = useState(false);

  const col1 = AVAILABLE_QUICK_REPLY_TAGS.slice(0, 6);
  const col2 = AVAILABLE_QUICK_REPLY_TAGS.slice(6);

  const handlePick = (tag: string) => {
    onSelectTag(tag);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Tags disponíveis para uso"
          className={
            className ||
            "inline-flex items-center gap-1 rounded-md bg-blue-600/90 hover:bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition-all hover:scale-105 active:scale-95"
          }
        >
          <span className="font-bold">#Tags</span>
          <Link2 className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[340px] sm:w-[380px] p-3 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-2xl z-50 animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-bold text-foreground">tags disponiveis para uso</span>
          </div>
          <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
            Perfil Contato
          </span>
        </div>

        {/* 2-column Tag List */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 max-h-[300px] overflow-y-auto pr-1 text-xs">
          {/* Column 1 */}
          <div className="space-y-0.5">
            {col1.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => handlePick(item.tag)}
                title={item.label}
                className="w-full text-left px-2 py-1 rounded-md text-foreground/90 hover:text-cyan-300 hover:bg-cyan-500/10 font-mono text-xs transition-colors flex items-center justify-between group"
              >
                <span className="font-semibold">{item.tag}</span>
              </button>
            ))}
          </div>

          {/* Column 2 */}
          <div className="space-y-0.5">
            {col2.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => handlePick(item.tag)}
                title={item.label}
                className="w-full text-left px-2 py-1 rounded-md text-foreground/90 hover:text-cyan-300 hover:bg-cyan-500/10 font-mono text-xs transition-colors flex items-center justify-between group"
              >
                <span className="font-semibold truncate">{item.tag}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Clique na tag para inserir no texto</span>
          <span className="text-cyan-400 font-semibold">Substituição automática</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
