import { Bell, MagnifyingGlass, Moon, Plus, SignOut, User } from "@phosphor-icons/react";
import { useMemo } from "react";
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
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useApiRuntimeStatus } from "@/hooks/useApiRuntimeStatus";
import { useRuntime } from "@/providers/RuntimeProvider";
import { useAppStore } from "@/stores/appStore";

interface HeaderProps {
  title: string;
  subtitle?: string;
  runtimeState?: "offline" | "starting" | "running";
}

export function Header({ title, subtitle, runtimeState }: HeaderProps) {
  const { session, username, role, logout } = useAdminAuth();
  const { connectionState, latencyMs, isOnline } = useApiRuntimeStatus();
  const { connectedSessions } = useRuntime();
  const sessions = useAppStore((s) => s.sessions);

  const connectedSession = useMemo(() => sessions.find((s) => s.status === "connected"), [sessions]);
  const connectedPhone = useMemo(() => {
    const raw = connectedSession?.phone;
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length >= 12) {
      // BR format: +55 XX XXXXX-XXXX
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return `+${digits}`;
  }, [connectedSession]);

  const effectiveRuntimeState =
    runtimeState ?? (connectionState === "ONLINE" ? "running" : connectionState === "RECONNECTING" ? "starting" : "offline");

  const runtimeBadge =
    effectiveRuntimeState === "running"
      ? { dotClass: "bg-success", label: "Online" }
      : effectiveRuntimeState === "starting"
        ? { dotClass: "bg-warning animate-pulse", label: "Reconectando" }
        : effectiveRuntimeState === "offline"
          ? { dotClass: "bg-destructive", label: "Offline" }
          : null;

  const displayName = username ?? session?.username ?? "Admin";
  const displayRole = role === "master" ? "Master" : role === "admin" ? "Admin" : "Usuário";
  const displayTenant = session?.tenantId ?? session?.companyId ?? "Tenant padrão";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AD";

  const notifications = useMemo(
    () => [
      {
        title: isOnline ? "API operacional" : "API indisponível",
        detail: isOnline ? `Latência atual: ${latencyMs ?? "--"} ms` : "Frontend em modo de reconexão com o backend",
      },
      {
        title: "Sessão autenticada",
        detail: `${displayName} · ${displayRole}`,
      },
      {
        title: "Tenant ativo",
        detail: displayTenant,
      },
    ],
    [displayName, displayRole, displayTenant, isOnline, latencyMs],
  );

  return (
    <header className="border-b border-border/70 bg-card/60 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex h-14 items-center justify-between gap-2 px-4 pl-14 md:gap-3 md:px-6 md:pl-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-base font-semibold text-foreground md:text-lg">{title}</h1>
            {runtimeBadge && (
              <div className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-0.5 sm:flex">
                <span className={`h-1.5 w-1.5 rounded-full ${runtimeBadge.dotClass}`} />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {runtimeBadge.label}
                  {connectedPhone && effectiveRuntimeState === "running" ? ` · ${connectedPhone}` : ""}
                </span>
                {connectedSessions > 0 && (
                  <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-success/15 px-1 text-[10px] font-bold text-success">
                    {connectedSessions}
                  </span>
                )}
              </div>
            )}
          </div>
          {subtitle && <p className="hidden text-xs text-muted-foreground sm:line-clamp-1">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <div className="relative hidden lg:block">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar" className="w-52 h-8 pl-8 text-sm bg-background/80 border-border/60" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Tema escuro fixo"
            disabled
          >
            <Moon className="w-3.5 h-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 border-border/80 bg-popover/90 backdrop-blur-xl">
              <DropdownMenuLabel className="text-xs">Status operacional</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((item) => (
                <DropdownMenuItem key={item.title} className="flex flex-col items-start gap-0.5 py-2.5">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-[11px] text-muted-foreground">{item.detail}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="gap-1.5 h-8 hidden md:inline-flex text-xs shadow-glow">
            <Plus weight="bold" className="w-3.5 h-3.5" />
            Nova Conversa
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-1.5 h-8">
                <Avatar className="w-7 h-7">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden xl:block text-left">
                  <p className="text-xs font-medium leading-tight">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{displayTenant}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border-border/80 bg-popover/90 backdrop-blur-xl">
              <DropdownMenuLabel className="text-xs">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm">
                <User className="w-3.5 h-3.5 mr-2" />
                {displayRole}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm" disabled>
                Tenant: {displayTenant}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm text-destructive" onClick={logout}>
                <SignOut className="w-3.5 h-3.5 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
