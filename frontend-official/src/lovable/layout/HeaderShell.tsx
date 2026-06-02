import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { Bell, MagnifyingGlass, Moon, Plus, User, ArrowClockwise } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
}: HeaderShellProps) {
  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-border/70 bg-card/60 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 pl-14 md:gap-4 md:px-6 md:pl-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar" className="h-8 w-52 rounded-xl border-border/60 bg-background/80 pl-9 text-sm" />
          </div>
          {runtimeTone === "online" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500/90 font-medium select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          ) : runtimeTone === "warning" || runtimeTone === "syncing" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-500/90 font-medium select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Iniciando
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-rose-500/90 font-medium select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Offline
            </span>
          )}
          {connectionOffline ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 rounded-xl border-warning/40 bg-warning/10 px-2.5 text-[10px] font-semibold hover:bg-warning/15"
              onClick={onReconnect}
            >
              <ArrowClockwise className="h-3 w-3" />
              Reconectar
            </Button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
                <Bell className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 border-border/80 bg-popover/90 backdrop-blur-xl">
              <DropdownMenuLabel className="text-xs">Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="py-2.5 text-sm text-muted-foreground" disabled>
                Sem eventos operacionais recentes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {actions ? (
            <div className="hidden items-center gap-2 md:flex">{actions}</div>
          ) : (
            <Button size="sm" className="hidden h-8 gap-1.5 rounded-xl text-xs shadow-glow md:inline-flex">
              <Plus weight="bold" className="h-3.5 w-3.5" />
              Nova Conversa
            </Button>
          )}

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
                <span className="text-xs font-semibold text-muted-foreground">
                  {(username || "ZA").slice(0, 2).toUpperCase()}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border-border/80 bg-popover/90 backdrop-blur-xl">
              <DropdownMenuLabel className="text-xs">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm" onClick={onNavigateProfile}>
                <User className="mr-2 h-3.5 w-3.5" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm">Configurações</DropdownMenuItem>
              <DropdownMenuItem className="text-sm">Equipe</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm text-destructive" onClick={onLogout}>
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
