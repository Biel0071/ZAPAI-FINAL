import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Gear,
  CaretLeft,
  CaretRight,
  Lightning,
  List,
  SquaresFour,
  ChatCircleDots,
  AddressBook,
  TreeStructure,
  Robot,
  ChartLineUp,
  Megaphone,
  Users,
  Database,
  Pulse,
  HardDrives,
  Queue,
  ShieldCheck,
  TrendUp,
  Cpu,
  Broadcast,
  FileText,
  CaretDown,
  CaretUp,
  Sparkle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { type AppUserRole, useUserRole } from "@/hooks/useUserRole";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

type SidebarNavItem = {
  icon: any;
  label: string;
  path: string;
  minRole?: AppUserRole;
  badge?: string;
};

const crmItems: SidebarNavItem[] = [
  { icon: SquaresFour, label: "Dashboard", path: "/dashboard", minRole: "user" },
  { icon: ChatCircleDots, label: "Conversas", path: "/inbox", minRole: "user" },
  { icon: AddressBook, label: "Conexões", path: "/connections", minRole: "user" },
  { icon: Users, label: "Leads CRM / Contatos", path: "/contacts", minRole: "user" },
  { icon: Megaphone, label: "Campanhas", path: "/campaigns", minRole: "user" },
  { icon: Robot, label: "IA / Automação", path: "/ai", minRole: "user" },
  { icon: ChartLineUp, label: "Analytics", path: "/analytics", minRole: "user" },
];

const systemItems: SidebarNavItem[] = [
  { icon: HardDrives, label: "Cluster", path: "/nodes", minRole: "master" },
  { icon: Pulse, label: "Runtime", path: "/system/runtime", minRole: "admin" },
  { icon: Cpu, label: "Performance", path: "/system/performance", minRole: "admin" },
  { icon: Broadcast, label: "WebSocket", path: "/system/websocket", minRole: "admin" },
  { icon: Database, label: "Banco", path: "/system/database", minRole: "admin" },
  { icon: Queue, label: "Files", path: "/system/files", minRole: "admin" },
  { icon: Pulse, label: "Health", path: "/system/health", minRole: "admin" },
  { icon: ChartLineUp, label: "Métricas", path: "/system/metrics", minRole: "admin" },
  { icon: TrendUp, label: "Deployments", path: "/deployments", minRole: "master" },
  { icon: FileText, label: "Logs", path: "/logs", minRole: "master" },
];

const bottomItems: SidebarNavItem[] = [
  { icon: ShieldCheck, label: "Usuários", path: "/users", minRole: "master" },
  { icon: Gear, label: "Configurações", path: "/settings", minRole: "user" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(true);
  const location = useLocation();
  const isMobile = useIsMobile();
  const { role, isLoading, roleLevel } = useUserRole();

  const visibleCrmItems = useMemo(
    () => crmItems.filter((item) => roleLevel[role] >= roleLevel[item.minRole ?? "user"]),
    [role, roleLevel],
  );

  const visibleSystemItems = useMemo(
    () => systemItems.filter((item) => roleLevel[role] >= roleLevel[item.minRole ?? "admin"]),
    [role, roleLevel],
  );

  const visibleBottomItems = useMemo(
    () => bottomItems.filter((item) => roleLevel[role] >= roleLevel[item.minRole ?? "user"]),
    [role, roleLevel],
  );

  const shouldShowSystemMenu = roleLevel[role] >= roleLevel.admin && visibleSystemItems.length > 0;

  useEffect(() => {
    if (!isMobile) {
      window.dispatchEvent(new CustomEvent<boolean>(SIDEBAR_COLLAPSE_EVENT, { detail: collapsed }));
    }
  }, [collapsed, isMobile]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebarWidth = useMemo(() => (collapsed ? 88 : 288), [collapsed]);

  const renderNavItem = (item: SidebarNavItem, compact: boolean, keyPrefix: string) => {
    const targetPathname = item.path.split("?")[0];
    const isActive = location.pathname === targetPathname;

    return (
      <NavLink
        key={`${keyPrefix}:${item.label}:${item.path}`}
        to={item.path}
        className={cn(
          "sidebar-item group relative min-h-[46px]",
          isActive && "sidebar-item-active",
          compact && "justify-center px-2.5",
        )}
      >
        <item.icon
          weight={isActive ? "fill" : "regular"}
          className={cn(
            "h-[18px] w-[18px] flex-shrink-0 transition-colors",
            isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground",
          )}
        />
        {!compact && (
          <>
            <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium", isActive && "text-sidebar-foreground")}>
              {item.label}
            </span>
            {item.badge && (
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[9px] uppercase tracking-wide",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </NavLink>
    );
  };

  const sidebarBody = (compact: boolean, mobileMode: boolean) => (
    <aside
      className="z-50 flex h-full w-full flex-col"
      style={{
        background: "var(--gradient-sidebar)",
        boxShadow: "inset -1px 0 0 hsl(var(--sidebar-border)), 0 20px 40px -30px hsl(0 0% 0% / 0.9)",
      }}
    >
      <div className="border-b border-sidebar-border/60 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/15 shadow-glow">
            <Lightning weight="fill" className="h-5 w-5 text-primary" />
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-[15px] font-bold leading-tight text-sidebar-foreground">ZAPFLOW AI</h1>
                <Sparkle weight="fill" className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-sidebar-muted">CRM Enterprise</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-sidebar-border/80 bg-muted/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-sidebar-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  VSTABLE
                </span>
                {!isLoading && (
                  <Badge variant="outline" className="h-6 rounded-full border-sidebar-border/80 bg-muted/20 px-2.5 text-[10px] uppercase tracking-wide text-sidebar-foreground">
                    {role}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


      <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {!compact && <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-muted/60">CRM</p>}
        <div className="space-y-1">{visibleCrmItems.map((item) => renderNavItem(item, compact, "crm"))}</div>

        {shouldShowSystemMenu && (
          <Collapsible open={systemOpen} onOpenChange={setSystemOpen}>
            {!compact && (
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-muted/70 hover:bg-sidebar-accent/40">
                <span>Sistema</span>
                {systemOpen ? <CaretUp className="h-3.5 w-3.5" /> : <CaretDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
            )}
            <CollapsibleContent className="space-y-1">
              {visibleSystemItems.map((item) => renderNavItem(item, compact, "system"))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border/60 px-3 py-3">
        {visibleBottomItems.map((item) => renderNavItem(item, compact, "bottom"))}

        {!mobileMode && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn("sidebar-item mt-1 w-full", compact && "justify-center px-2.5")}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <CaretRight className="h-4 w-4 text-sidebar-muted" />
            ) : (
              <>
                <CaretLeft className="h-4 w-4 text-sidebar-muted" />
                <span className="text-[13px] text-sidebar-muted">Recolher</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed left-3 top-3 z-[60] h-10 w-10 rounded-2xl border-border bg-card/90 backdrop-blur"
            aria-label="Abrir menu"
          >
            <List className="h-5 w-5" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[88dvh] border-border bg-sidebar p-0">{sidebarBody(false, true)}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden transition-[width] duration-200 ease-in-out"
      style={{ width: sidebarWidth }}
    >
      {sidebarBody(collapsed, false)}
    </aside>
  );
}
