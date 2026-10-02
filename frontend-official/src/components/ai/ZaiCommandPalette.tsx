import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  Target,
  Sparkles,
  Brain,
  TrendingUp,
  Activity,
  MessageSquare,
  Settings,
  BookOpen,
  GitBranch,
  FileText,
  Search,
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "@/core/lib/utils";

export interface ZaiCommand {
  id: string;
  command: string;
  title: string;
  description: string;
  category: "Configuração" | "Evolução" | "Operação" | "Automação";
  icon: any;
  action: () => void;
}

interface ZaiCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecuteCommand: (commandId: string) => void;
}

export function ZaiCommandPalette({
  open,
  onOpenChange,
  onExecuteCommand,
}: ZaiCommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const COMMANDS: ZaiCommand[] = [
    {
      id: "objetivo",
      command: "/objetivo",
      title: "Definir Objetivos do Agente",
      description: "Configurar objetivo principal e sub-objetivos comerciais de atendimento.",
      category: "Configuração",
      icon: Target,
      action: () => onExecuteCommand("objetivo"),
    },
    {
      id: "planejar",
      command: "/planejar",
      title: "Planejar Playbooks & Estratégias",
      description: "Criar ou editar playbooks de negociação e superação de objeções.",
      category: "Automação",
      icon: GitBranch,
      action: () => onExecuteCommand("planejar"),
    },
    {
      id: "aprender",
      command: "/aprender",
      title: "Sincronizar Aprendizados Reais",
      description: "Minerar novos padrões das conversas humanas e aprovar sugestões.",
      category: "Evolução",
      icon: Brain,
      action: () => onExecuteCommand("aprender"),
    },
    {
      id: "melhorar",
      command: "/melhorar",
      title: "Oportunidades de Melhoria",
      description: "Analisar lacunas de conhecimento e perguntas não respondidas.",
      category: "Evolução",
      icon: Sparkles,
      action: () => onExecuteCommand("melhorar"),
    },
    {
      id: "analisar",
      command: "/analisar",
      title: "Análise Operacional & SLA",
      description: "Visualizar tempo médio de resposta, índice de produtividade e nós.",
      category: "Operação",
      icon: Activity,
      action: () => onExecuteCommand("analisar"),
    },
    {
      id: "testar",
      command: "/testar",
      title: "Testar Respostas do Assistente",
      description: "Simular diálogo ao vivo com Camila usando conhecimento oficial.",
      category: "Configuração",
      icon: MessageSquare,
      action: () => onExecuteCommand("testar"),
    },
    {
      id: "configurar",
      command: "/configurar",
      title: "Customizar Identidade & Personalidade",
      description: "Ajustar tom, formalidade, empatia e aparência do agente.",
      category: "Configuração",
      icon: Settings,
      action: () => onExecuteCommand("configurar"),
    },
    {
      id: "ensinar",
      command: "/ensinar",
      title: "Cadastrar Conhecimento Oficial",
      description: "Adicionar produtos, regras de frete, políticas de troca e FAQ.",
      category: "Configuração",
      icon: BookOpen,
      action: () => onExecuteCommand("ensinar"),
    },
    {
      id: "automacao",
      command: "/automacao",
      title: "Regras de Automação & Horários",
      description: "Configurar horários de atendimento e mensagens de ausência.",
      category: "Automação",
      icon: Zap,
      action: () => onExecuteCommand("automacao"),
    },
    {
      id: "logs",
      command: "/logs",
      title: "Auditoria & Logs de Execução",
      description: "Inspecionar pipeline de execução, latências e auditoria de IA.",
      category: "Operação",
      icon: FileText,
      action: () => onExecuteCommand("logs"),
    },
  ];

  const filteredCommands = COMMANDS.filter((cmd) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      cmd.command.toLowerCase().includes(q) ||
      cmd.title.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (cmd: ZaiCommand) => {
    cmd.action();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 gap-0 overflow-hidden bg-[#090e17]/95 border-emerald-500/40 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette ZAI</DialogTitle>
          <DialogDescription>Comandos rápidos do sistema operacional ZAI</DialogDescription>
        </DialogHeader>

        {/* SEARCH BAR */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60 bg-[#0c1420]/80">
          <Search className="h-5 w-5 text-emerald-400 shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
              } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
                e.preventDefault();
                handleSelect(filteredCommands[selectedIndex]);
              }
            }}
            placeholder="Digite um comando como /objetivo, /aprender, /melhorar..."
            className="border-0 bg-transparent focus-visible:ring-0 text-sm placeholder:text-muted-foreground p-0 h-9"
            autoFocus
          />
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-mono tracking-wider shrink-0">
            ESC para fechar
          </Badge>
        </div>

        {/* COMMANDS LIST */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhum comando encontrado para "{search}". Tente <span className="text-emerald-400 font-mono">/objetivo</span> ou <span className="text-emerald-400 font-mono">/aprender</span>.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer",
                    isSelected
                      ? "bg-emerald-500/15 border border-emerald-500/40 text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {cmd.command}
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate">
                          {cmd.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {cmd.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge variant="outline" className="text-[9px] uppercase border-border/60">
                      {cmd.category}
                    </Badge>
                    <ArrowRight
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isSelected ? "text-emerald-400 translate-x-0.5" : "text-muted-foreground opacity-40"
                      )}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 py-2 border-t border-border/50 bg-[#080d16] flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Navegue com ↑ ↓ e pressione Enter</span>
          <span className="font-mono text-[10px] text-emerald-400">ZAI Neural Engine</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
