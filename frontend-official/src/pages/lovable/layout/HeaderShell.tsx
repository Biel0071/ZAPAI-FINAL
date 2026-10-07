import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { useTheme } from "next-themes";
import { Bell, MagnifyingGlass, Moon, Sun, Plus, User, ArrowClockwise, Info, Gear, Users, CheckCircle, Sparkle, ChatCircleDots } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/state/stores/appStore";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";

export interface HeaderShellProps {
  title: string;
  subtitle?: string;
  runtimeLabel?: string | null;
  runtimeTone?: "online" | "offline" | "syncing" | "warning";
  runtimePulse?: boolean;
  connectionOffline?: boolean;
  onReconnect?: () => void;
  actions?: ReactNode;
  username?: string | null;
  onLogout?: () => void;
  onNavigateProfile?: () => void;
  onNavigateSettings?: () => void;
  onNavigateTeam?: () => void;
}

export function HeaderShell({
  title,
  subtitle,
  runtimeLabel,
  runtimeTone = "offline",
  runtimePulse = false,
  connectionOffline = false,
  onReconnect,
  actions,
  username,
  onLogout,
  onNavigateProfile,
  onNavigateSettings,
  onNavigateTeam,
}: HeaderShellProps) {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const setActiveSessionId = useAppStore((state) => state.setActiveSessionId);
  const setIsNewChatDialogOpen = useAppStore((state) => state.setIsNewChatDialogOpen);
  const [unreadNotifications, setUnreadNotifications] = useState(true);
  const { toast } = useToast();
  const isDark = theme !== "light";

  const isAdminPage = ["/nodes", "/users", "/deployments", "/memory", "/logs", "/versions"].some(
    (path) => location.pathname.startsWith(path)
  );

  const notificationsList = [
    {
      id: "notif-1",
      title: "Painel Operacional da Conversa",
      desc: "Navegação segmentada ágil (Atendimento, Respostas, Arquivos, Histórico) e Dados do Cliente integrados.",
      tag: "Atualização",
      tagColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      time: "v2.8",
    },
    {
      id: "notif-2",
      title: "Modo Claro & Escuro Refinados",
      desc: "Alto contraste nos balões de chat, cartões de mídia, status e painéis enterprise.",
      tag: "Design",
      tagColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
      time: "Design",
    },
    {
      id: "notif-3",
      title: "WhatsApp & IA Ativos",
      desc: runtimeTone === "online"
        ? "Sessão conectada e sincronizando mensagens em tempo real via Baileys."
        : "Sistema monitorando o status das conexões Baileys e automações.",
      tag: "Status",
      tagColor: runtimeTone === "online" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      time: "Agora",
    },
    {
      id: "notif-4",
      title: "Responsividade Automática",
      desc: "Adaptação de viewport automática via CSS e gaveta lateral em dispositivos móveis.",
      tag: "Sistema",
      tagColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
      time: "Auto",
    },
  ];

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-border/70 bg-card/60 backdrop-blur-xl">
      <div className="flex h-header items-center justify-between gap-2 sm:gap-3 px-3 pl-14 md:gap-4 md:px-6 md:pl-6 max-w-full overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative shrink-0 hidden sm:block">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar" className="h-8 w-24 sm:w-32 md:w-36 lg:w-52 rounded-xl border-border/60 bg-background/80 pl-9 text-xs sm:text-sm transition-all" />
          </div>
          {runtimeTone === "online" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500/90 font-medium select-none shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="hidden sm:inline">Online</span>
            </span>
          ) : runtimeTone === "warning" || runtimeTone === "syncing" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-500/90 font-medium select-none shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="hidden sm:inline">Iniciando</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-rose-500/90 font-medium select-none shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors p-0.5 shrink-0 hidden sm:inline-flex" title="Informações do Sistema">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs bg-card border-border">
                <p className="font-semibold text-foreground mb-0.5">Status do Sistema ZAPFLOW AI</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Monitora em tempo real as conexões de WhatsApp Baileys, o banco PostgreSQL e os módulos de automação por IA.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {connectionOffline ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 rounded-xl border-warning/40 bg-warning/10 px-2 text-[10px] font-semibold hover:bg-warning/15 shrink-0"
              onClick={onReconnect}
            >
              <ArrowClockwise className="h-3 w-3" />
              <span className="hidden xs:inline">Reconectar</span>
            </Button>
          ) : null}
          {sessions && sessions.length > 0 && (
            <select
              aria-label="Filtrar por conexão"
              value={activeSessionId || "all"}
              onChange={(e) => setActiveSessionId(e.target.value === "all" ? null : e.target.value)}
              className="h-8 max-w-[110px] sm:max-w-[150px] md:max-w-[180px] lg:max-w-xs truncate rounded-xl border border-border/65 bg-background/80 px-2 text-xs font-semibold text-foreground/90 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary backdrop-blur-sm shrink-0"
            >
              <option value="all" className="bg-background text-foreground">Todas as Conexões</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id} className="bg-background text-foreground">
                  {session.name || session.id} ({session.status === "connected" ? "Online" : "Offline"})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          {/* Light / Dark Theme Switcher */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground transition-all"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Alternar para Tema Claro" : "Alternar para Tema Escuro"}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-500" />
            )}
          </Button>

          {/* Interactive Notifications Popover */}
          <DropdownMenu onOpenChange={(open) => { if (open) setUnreadNotifications(false); }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notificações"
                className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Notificações e Atualizações do Sistema"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 border-border/80 bg-popover/95 backdrop-blur-xl shadow-xl p-0">
              <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">Notificações</span>
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    v2.8
                  </span>
                </div>
                {unreadNotifications ? (
                  <button
                    type="button"
                    onClick={() => setUnreadNotifications(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Marcar como lidas
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Tudo atualizado</span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border/40 p-1">
                {notificationsList.map((item) => (
                  <div key={item.id} className="p-2.5 hover:bg-muted/40 rounded-lg transition-colors">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-foreground truncate">{item.title}</span>
                      <span className={cn("text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", item.tagColor)}>
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                    <span className="mt-1 block text-[10px] text-muted-foreground/60">{item.time}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border/60 bg-muted/20 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">
                  ZAPFLOW AI • Sistema Operacional e Conectado
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {actions ? (
            <div className="hidden items-center gap-2 md:flex">{actions}</div>
          ) : !isAdminPage ? (
            <Button
              size="sm"
              className="hidden h-8 gap-1.5 rounded-xl text-xs shadow-glow lg:inline-flex"
              onClick={() => setIsNewChatDialogOpen(true)}
            >
              <Plus weight="bold" className="h-3.5 w-3.5" />
              Nova Conversa
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="h-8 gap-2 px-1.5"
                title={`${username || "zapadmin"} - Workspace`}
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {(username || "ZA").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-muted-foreground hidden sm:inline max-w-[120px] truncate">
                  {username || "zapadmin"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border-border/80 bg-popover/90 backdrop-blur-xl">
              <DropdownMenuLabel className="text-xs">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm cursor-pointer" onClick={onNavigateProfile}>
                <User className="mr-2 h-3.5 w-3.5" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm cursor-pointer" onClick={onNavigateSettings}>
                <Gear className="mr-2 h-3.5 w-3.5" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm cursor-pointer" onClick={onNavigateTeam}>
                <Users className="mr-2 h-3.5 w-3.5" />
                Equipe
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm text-destructive cursor-pointer" onClick={onLogout}>
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
