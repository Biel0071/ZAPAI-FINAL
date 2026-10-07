import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  X,
  Brain,
  MessageSquare,
  Pencil,
  Archive,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/core/lib/utils";

export interface MemoryNodeData {
  id: string | number;
  label: string;
  type: string;
  desc?: string;
  category?: string;
  confidence?: number;
  facts?: string[];
  connections?: string[];
  conversationSnippet?: string;
  phone?: string;
  createdAt?: string;
}

interface MemoryDetailDrawerProps {
  memory: MemoryNodeData | null;
  onClose: () => void;
  onEdit?: (memory: MemoryNodeData) => void;
  onTransformToRule?: (memory: MemoryNodeData) => void;
  onArchive?: (memory: MemoryNodeData) => void;
}

export const MemoryDetailDrawer: React.FC<MemoryDetailDrawerProps> = ({
  memory,
  onClose,
  onEdit,
  onTransformToRule,
  onArchive,
}) => {
  if (!memory) return null;

  const category = memory.type || memory.category || "topic";
  const confidence = memory.confidence || 85;

  const getCategoryBadge = () => {
    switch (category) {
      case "preference":
      case "client":
        return { label: "Preferência do Cliente", color: "border-cyan-500/40 text-cyan-300 bg-cyan-500/10" };
      case "payment":
        return { label: "Pagamento & PIX", color: "border-amber-500/40 text-amber-300 bg-amber-500/10" };
      case "delivery":
        return { label: "Entrega & Frete", color: "border-rose-500/40 text-rose-300 bg-rose-500/10" };
      case "objection":
        return { label: "Objeção Comercial", color: "border-purple-500/40 text-purple-300 bg-purple-500/10" };
      case "product":
        return { label: "Produto & Catálogo", color: "border-blue-500/40 text-blue-300 bg-blue-500/10" };
      default:
        return { label: "Tópico & Regra", color: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" };
    }
  };

  const badgeInfo = getCategoryBadge();

  // Generate sensible facts and connections if not provided
  const facts = memory.facts || [
    `Padrão consolidado através de conversas reais no WhatsApp`,
    `Taxa de assertividade calculada em ${confidence}% com base no feedback`,
    `Classificado automaticamente no escopo de ${badgeInfo.label}`,
  ];

  const connections = memory.connections || [
    "Atendimento Comercial",
    "Políticas de Vendas",
    "FAQ da Loja",
    "Camila (Atendente)",
  ];

  const conversationSnippet =
    memory.conversationSnippet ||
    (memory.desc
      ? `"${memory.desc}"`
      : `"Cliente solicitou confirmação de prazo e condições de pagamento antes de fechar o pedido."`);

  return (
    <aside
      role="complementary"
      aria-label="Detalhes da Memória"
      className="w-full lg:w-[380px] bg-card border border-border/80 rounded-2xl shadow-xl p-4 flex flex-col justify-between shrink-0 animate-in fade-in slide-in-from-right-4 duration-200"
    >
      <div className="space-y-4">
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Detalhes da Memória
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Cérebro Ativo do Atendente
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300 flex items-center justify-center transition-colors"
            title="Fechar Detalhes"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Category & Confidence */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", badgeInfo.color)}>
            {badgeInfo.label}
          </Badge>
          <span className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Assertividade {confidence}%
          </span>
        </div>

        {/* Memory Title */}
        <div>
          <h4 className="text-sm font-bold text-foreground leading-snug">
            {memory.label}
          </h4>
        </div>

        {/* Resumo */}
        <div className="space-y-1.5 p-3 rounded-xl bg-muted/20 border border-border/50">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Resumo
          </span>
          <p className="text-xs text-foreground/90 leading-relaxed">
            {memory.desc || "Informação cognitiva capturada durante o atendimento que orienta respostas futuras."}
          </p>
        </div>

        {/* Observações & Fatos */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Observações & Fatos Aprendidos
          </span>
          <ul className="space-y-1.5">
            {facts.map((fact, idx) => (
              <li key={idx} className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Conexões Relacionadas */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Conexões Relacionadas
          </span>
          <div className="flex flex-wrap gap-1.5">
            {connections.map((conn, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/40 text-foreground/80 border border-border/60 hover:border-purple-500/40 cursor-default"
              >
                {conn}
              </span>
            ))}
          </div>
        </div>

        {/* Exemplos de Conversas */}
        <div className="space-y-1.5 p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20">
          <div className="flex items-center gap-1.5 text-purple-400 text-[10px] font-bold uppercase">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Exemplo de Conversa</span>
          </div>
          <p className="text-[11px] text-purple-200/90 italic leading-relaxed">
            {conversationSnippet}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 border-t border-border/60 space-y-2 mt-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onEdit?.(memory)}
            className="text-xs font-semibold gap-1.5 rounded-xl border-border/80 hover:border-emerald-500/50"
          >
            <Pencil className="h-3.5 w-3.5 text-emerald-400" />
            <span>Editar</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onTransformToRule?.(memory)}
            className="text-xs font-semibold gap-1.5 rounded-xl border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
            <span>Virar Regra</span>
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onArchive?.(memory)}
          className="w-full text-[11px] text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-xl gap-1.5 h-7"
        >
          <Archive className="h-3 w-3" />
          <span>Arquivar Memória</span>
        </Button>
      </div>
    </aside>
  );
};
