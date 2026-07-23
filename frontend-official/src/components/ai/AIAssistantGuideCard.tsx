import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Lightbulb, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ROUTE_GUIDANCE: Record<string, { title: string; tip: string; shortcut?: string }> = {
  "/inbox": {
    title: "Dica de IA no Inbox",
    tip: "Use o atalho de Resposta Rápida (/) ou acione o fluxo automatizado para responder dúvidas frequentes sem digitação manual.",
    shortcut: "Pressione / para Respostas Rápidas",
  },
  "/operations": {
    title: "Guia da Operação",
    tip: "Monitore o limite de SLA e o tempo médio de resposta. Transfira conversas atrasadas para a IA assumir automaticamente.",
    shortcut: "SLA Alvo: < 2 minutos",
  },
  "/analytics": {
    title: "Inteligência BI",
    tip: "Exporte relatórios de conversão e acompanhe a taxa de resolução humana vs IA para identificar gargalos operacionais.",
    shortcut: "Filtro por Período: Hoje / 7 dias / 30 dias",
  },
  "/ai": {
    title: "Central de IA",
    tip: "Configure o tom de voz do atendente virtual e adicione dados no conhecimento RAG para respostas mais precisas.",
    shortcut: "Teste de Voz & Prompt no Studio",
  },
  "/campaigns": {
    title: "Guia de Campanhas",
    tip: "Programe disparos com intervalos aleatórios e filtro de público para evitar bloqueios no WhatsApp.",
    shortcut: "Limite recomendado: 50 msgs/lote",
  },
  "/flows": {
    title: "Automação de Fluxos",
    tip: "Crie nós de decisão condicional para qualificar leads antes de transferir para o time comercial.",
    shortcut: "Arraste elementos no canvas",
  },
  "/memory": {
    title: "Memória da IA",
    tip: "Consulte resumos e histórico acumulado de preferências de cada lead extraídos automaticamente pelas conversas.",
    shortcut: "Busca semântica ativada",
  },
};

export function AIAssistantGuideCard() {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const guide = ROUTE_GUIDANCE[location.pathname];
  if (!guide || dismissed) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950/60 via-card to-slate-900 border border-emerald-500/30 p-3.5 px-4 rounded-xl shadow-lg animate-fade-in flex items-center justify-between gap-4 text-xs">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
          <Lightbulb className="h-4 w-4 animate-pulse" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{guide.title}</span>
            {guide.shortcut && (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
                {guide.shortcut}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-[11px] mt-0.5 max-w-2xl">{guide.tip}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          onClick={() => setDismissed(true)}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
