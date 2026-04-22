import { Bell, DownloadSimple, MagnifyingGlass, Moon, Plus, Sun, User } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePwaInstall } from "@/hooks/use-pwa-install";

interface HeaderProps {
  title: string;
  subtitle?: string;
  runtimeState?: "offline" | "starting" | "running";
}

export function Header({ title, subtitle, runtimeState }: HeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { canInstall, installPwa } = usePwaInstall();
  const isDark = resolvedTheme === "dark";

  const runtimeBadge =
    runtimeState === "running"
      ? { dotClass: "bg-success", label: "Online" }
      : runtimeState === "starting"
        ? { dotClass: "bg-warning animate-pulse", label: "Starting" }
        : runtimeState === "offline"
          ? { dotClass: "bg-destructive", label: "Offline" }
          : null;

  return (
    <header className="border-b border-border/60 bg-card/70 backdrop-blur-md sticky top-0 z-40">
      <div className="flex h-14 items-center justify-between gap-2 px-4 pl-14 md:gap-3 md:px-6 md:pl-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-base font-semibold text-foreground md:text-lg">{title}</h1>
            {runtimeBadge && (
              <div className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 sm:flex">
                <span className={`h-1.5 w-1.5 rounded-full ${runtimeBadge.dotClass}`} />
                <span className="text-[11px] font-medium text-muted-foreground">{runtimeBadge.label}</span>
              </div>
            )}
          </div>
          {subtitle && <p className="hidden text-xs text-muted-foreground sm:line-clamp-1">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <div className="relative hidden lg:block">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search..." className="w-52 h-8 pl-8 text-sm bg-background/80 border-border/60" />
          </div>

          {canInstall && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => { void installPwa(); }}
            >
              <DownloadSimple className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Install</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">3</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs">Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="text-sm font-medium">Nova mensagem de João Silva</span>
                <span className="text-[11px] text-muted-foreground">Há 2 minutos</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="text-sm font-medium">Sessão WhatsApp reconectada</span>
                <span className="text-[11px] text-muted-foreground">Há 15 minutos</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="text-sm font-medium">Meta de conversões atingida!</span>
                <span className="text-[11px] text-muted-foreground">Há 1 hora</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="gap-1.5 h-8 hidden md:inline-flex text-xs">
            <Plus weight="bold" className="w-3.5 h-3.5" />
            Nova Conversa
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-1.5 h-8">
                <Avatar className="w-7 h-7">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">AD</AvatarFallback>
                </Avatar>
                <div className="hidden xl:block text-left">
                  <p className="text-xs font-medium leading-tight">Admin</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Empresa Demo</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm">
                <User className="w-3.5 h-3.5 mr-2" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm">Configurações</DropdownMenuItem>
              <DropdownMenuItem className="text-sm">Equipe</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm text-destructive">Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
