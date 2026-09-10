import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bot,
  X,
  Minus,
  Maximize2,
  Minimize2,
  ChevronRight,
  Lightbulb,
  Keyboard,
  ShieldCheck,
  ArrowRight,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

const CONTEXTUAL_TIPS: Record<string, { title: string; tip: string; shortcut?: string; actionLabel?: string; actionPath?: string }> = {
  "/inbox": {
    title: "Inbox Pro",
    tip: "Pressione '/' no campo de mensagem para abrir o catálogo de Respostas Rápidas instantaneamente.",
    shortcut: "Atalho: /",
  },
  "/dashboard": {
    title: "Métricas em Tempo Real",
    tip: "A taxa de resolução automática da IA é calculada a partir das mensagens respondidas pelos agentes.",
    shortcut: "Atualização: 15s",
    actionLabel: "Ver Operações",
    actionPath: "/operations",
  },
  "/contacts": {
    title: "CRM de Contatos",
    tip: "Classifique leads por temperatura (Quente, Morno, Frio) para priorizar transferências e campanhas.",
    shortcut: "Filtros rápidos",
    actionLabel: "Disparar Campanha",
    actionPath: "/campaigns",
  },
  "/campaigns": {
    title: "Envios em Massa Seguros",
    tip: "Utilize intervalos aleatórios entre 15s e 45s por mensagem para manter a saúde do número conectada.",
    shortcut: "Anti-Ban Ativo",
  },
  "/ai": {
    title: "Estúdio Cognitivo",
    tip: "Ajuste a temperatura da IA entre 0.3 e 0.7 para respostas mais assertivas e comerciais.",
    shortcut: "RAG Ativo",
  },
  "/settings": {
    title: "Central de Configurações",
    tip: "Consulte a telemetria do cluster e integridade dos nós na aba Diagnóstico & Saúde.",
    shortcut: "Admin Hub",
  },
  "/operations": {
    title: "Gestão Operacional",
    tip: "Monitore o cumprimento do SLA alvo (< 2 min) e balanceie a carga entre operadores humanos e IA.",
    shortcut: "SLA Alvo: < 2 min",
  },
  "/memory": {
    title: "Memória Neural",
    tip: "A IA acumula contexto histórico de preferências de compra e histórico de pedidos dos leads.",
    shortcut: "PostgreSQL Vector",
  },
  "/connections": {
    title: "Conexões WhatsApp",
    tip: "Mantenha a sessão primária ativa com QR Code validado para tráfego contínuo.",
    shortcut: "Baileys Multi-Device",
  },
};

export function FloatingMascotAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem("zapflow_mascot_minimized") === "true";
    } catch {
      return false;
    }
  });
  const [userQuery, setUserQuery] = useState("");
  const [queryFeedback, setQueryFeedback] = useState<string | null>(null);

  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const sessions = useAppStore((state) => state.sessions);
  const isWhatsappConnected = useMemo(() => {
    return Array.isArray(sessions) && sessions.some((s) => s?.status === "connected");
  }, [sessions]);

  // If in mobile chat view with active conversation, hide floating widget to prevent blocking input
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const isInboxMobileChat = isMobile && location.pathname === "/inbox" && Boolean(activeConversationId);

  const currentTip = useMemo(() => {
    const matchedPath = Object.keys(CONTEXTUAL_TIPS).find((p) => location.pathname.startsWith(p));
    return matchedPath
      ? CONTEXTUAL_TIPS[matchedPath]
      : {
          title: "ZAPFLOW Assistant",
          tip: "Plataforma de inteligência WhatsApp pronta para acelerar suas vendas e atendimento.",
          shortcut: "ZAI Engine",
        };
  }, [location.pathname]);

  const handleToggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !isMinimized;
    setIsMinimized(nextVal);
    try {
      localStorage.setItem("zapflow_mascot_minimized", String(nextVal));
    } catch {}
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    const q = userQuery.toLowerCase();
    if (q.includes("inbox") || q.includes("chat") || q.includes("conversa")) {
      setQueryFeedback("O Inbox centraliza chats, transcrições de áudio e notas do lead no painel lateral.");
    } else if (q.includes("campanha") || q.includes("disparo") || q.includes("envio")) {
      setQueryFeedback("Disparos podem ser segmentados por tags ou leads em Campanhas > Novo Disparo.");
    } else if (q.includes("ia") || q.includes("agente") || q.includes("prompt")) {
      setQueryFeedback("Configurações de agentes e tom de voz estão disponíveis na aba IA & Automação.");
    } else if (q.includes("conexão") || q.includes("whatsapp") || q.includes("qr")) {
      setQueryFeedback(isWhatsappConnected ? "WhatsApp está 100% conectado e operacional!" : "Sua conexão precisa ser escaneada em Conexões.");
    } else {
      setQueryFeedback(`Dica inteligente: Experimente navegar pelo módulo ${currentTip.title} para automatizar tarefas.`);
    }
    setUserQuery("");
  };

  if (isInboxMobileChat) {
    return null;
  }

  return (
    <aside aria-label="Assistente Inteligente ZAI" className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 select-none">
      {/* EXPANDED ASSISTANT CARD */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={{ duration: 0.18 }}
            className="mb-3 w-[300px] sm:w-[340px] rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-muted/40">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground leading-tight flex items-center gap-1.5">
                    Assistente ZAI
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </h4>
                  <span className="text-[10px] text-muted-foreground">Copiloto Inteligente</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-lg"
                  onClick={() => setIsOpen(false)}
                  title="Recolher assistente"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-lg"
                  onClick={() => {
                    setIsOpen(false);
                    setIsMinimized(true);
                  }}
                  title="Minimizar para ícone discreto"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Content & Contextual Tip */}
            <div className="p-3.5 space-y-3 text-xs">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary flex items-center gap-1 text-[11px]">
                    <Lightbulb className="h-3 w-3" />
                    {currentTip.title}
                  </span>
                  {currentTip.shortcut && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-primary/30 text-primary bg-primary/10">
                      {currentTip.shortcut}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {currentTip.tip}
                </p>
                {currentTip.actionPath && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(currentTip.actionPath!);
                      setIsOpen(false);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline mt-1 pt-1"
                  >
                    {currentTip.actionLabel}
                    <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>

              {/* Dynamic Q&A / Search feedback */}
              {queryFeedback && (
                <div className="rounded-xl border border-border/70 bg-background/80 p-2.5 text-[11px] text-foreground/90 animate-fade-in">
                  <p className="font-medium">{queryFeedback}</p>
                </div>
              )}

              {/* Quick Prompt Input */}
              <form onSubmit={handleAsk} className="relative flex items-center">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Dúvida rápida sobre o Zapflow..."
                  className="h-8 pr-8 text-xs rounded-xl bg-background/70 border-border/70"
                />
                <button
                  type="submit"
                  aria-label="Enviar pergunta ao assistente"
                  className="absolute right-1.5 h-6 w-6 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Send className="h-3 w-3" />
                </button>
              </form>

              {/* Status footer */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 pt-1 border-t border-border/40">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  Conexão {isWhatsappConnected ? "Ativa" : "Pendente"}
                </span>
                <span>v4.0 Premium</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING TRIGGER BUBBLE (DISCREET & COMPACT) */}
      {!isOpen && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  if (isMinimized) {
                    setIsMinimized(false);
                  } else {
                    setIsOpen(true);
                  }
                }}
                className={cn(
                  "relative flex items-center justify-center transition-all duration-200 shadow-xl border cursor-pointer select-none",
                  isMinimized
                    ? "h-7 w-7 rounded-full bg-card/85 border-border/70 hover:border-primary/60 hover:scale-105"
                    : "h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-card/90 border-emerald-500/40 hover:border-emerald-500 hover:scale-105 shadow-[0_4px_20px_rgba(16,185,129,0.25)] backdrop-blur-md text-emerald-400"
                )}
                aria-label="Abrir Assistente ZAI"
              >
                {isMinimized ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs font-semibold bg-popover text-foreground border-border shadow-lg">
              {isMinimized ? "Assistente ZAI (Clique para expandir)" : "Assistente ZAI — Dicas & Atalhos"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </aside>
  );
}
