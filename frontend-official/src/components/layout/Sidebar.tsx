import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { type AppUserRole, useUserRole } from "@/hooks/useUserRole";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

type SidebarNavItem = {
  icon: any;
  label: string;
  path: string;
  minRole?: AppUserRole;
};

const crmItems: SidebarNavItem[] = [
  { icon: SquaresFour, label: "Dashboard", path: "/dashboard", minRole: "user" },
  { icon: ChatCircleDots, label: "Conversas", path: "/inbox", minRole: "user" },
  { icon: Users, label: "Leads", path: "/contacts", minRole: "user" },
  { icon: Megaphone, label: "Campanhas", path: "/campaigns", minRole: "user" },
  { icon: TreeStructure, label: "Fluxos", path: "/flows", minRole: "user" },
  { icon: AddressBook, label: "Contatos", path: "/contacts", minRole: "user" },
  { icon: Robot, label: "IA", path: "/ai", minRole: "user" },
  { icon: ChartLineUp, label: "Relatórios", path: "/analytics", minRole: "user" },
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

  const sidebarWidth = useMemo(() => (collapsed ? 72 : 260), [collapsed]);

  const renderNavItem = (item: SidebarNavItem, compact: boolean, keyPrefix: string) => {
    const targetPathname = item.path.split("?")[0];
    const isSystemAlias = item.path.startsWith("/system/");
    const isActive = isSystemAlias
      ? location.pathname === targetPathname
      : location.pathname === targetPathname;

    return (
      <NavLink
        key={`${keyPrefix}:${item.label}:${item.path}`}
        to={item.path}
        className={cn("sidebar-item group relative", isActive && "sidebar-item-active bg-primary/[0.08]", compact && "justify-center px-2")}
      >
        <item.icon
          weight={isActive ? "fill" : "regular"}
          className={cn(
            "w-[18px] h-[18px] flex-shrink-0 transition-colors",
            isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground",
          )}
        />
        <AnimatePresence>
          {!compact && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn("text-[13px] font-medium whitespace-nowrap", isActive && "text-sidebar-foreground")}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </NavLink>
    );
  };

  const sidebarBody = (compact: boolean, mobileMode: boolean) => (
    <aside
      className="h-full w-full z-50 flex flex-col"
      style={{
        background: "var(--gradient-sidebar)",
        boxShadow: "inset -1px 0 0 hsl(var(--sidebar-border)), 0 20px 40px -30px hsl(0 0% 0% / 0.9)",
      }}
    >
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-sidebar-border/60">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Lightning weight="fill" className="w-4 h-4 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!compact && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
              <h1 className="font-display text-[15px] font-bold text-sidebar-foreground leading-tight">ZAPFLOW AI</h1>
              <div className="mt-1 flex items-center gap-1.5">
                <p className="text-[10px] text-sidebar-muted leading-none">CRM Enterprise</p>
                {!isLoading && (
                  <Badge variant="outline" className="h-4 rounded-sm border-sidebar-border/80 bg-muted/20 px-1.5 text-[9px] uppercase tracking-wide text-sidebar-foreground">
                    {role}
                  </Badge>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-2 overflow-y-auto scrollbar-thin">
        {!compact && <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted/60">CRM</p>}
        <div className="space-y-0.5">{visibleCrmItems.map((item) => renderNavItem(item, compact, "crm"))}</div>

        {shouldShowSystemMenu && (
          <Collapsible open={systemOpen} onOpenChange={setSystemOpen}>
            {!compact && (
              <CollapsibleTrigger className="mt-3 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted/70 hover:bg-sidebar-accent/40">
                <span>Sistema</span>
                {systemOpen ? <CaretUp className="h-3.5 w-3.5" /> : <CaretDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
            )}
            <CollapsibleContent className="space-y-0.5">
              {visibleSystemItems.map((item) => renderNavItem(item, compact, "system"))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>

      <div className="px-2 py-3 border-t border-sidebar-border/60 space-y-0.5">
        {visibleBottomItems.map((item) => renderNavItem(item, compact, "bottom"))}

        {!mobileMode && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn("sidebar-item w-full mt-1", compact && "justify-center px-2")}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <CaretRight className="w-4 h-4 text-sidebar-muted" />
            ) : (
              <>
                <CaretLeft className="w-4 h-4 text-sidebar-muted" />
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
            className="fixed left-3 top-3 z-[60] h-10 w-10 border-border bg-card/90 backdrop-blur"
            aria-label="Abrir menu"
          >
            <List className="h-5 w-5" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[88dvh] p-0 border-border bg-sidebar">{sidebarBody(false, true)}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col overflow-hidden"
    >
      {sidebarBody(collapsed, false)}
    </motion.aside>
  );
}
