import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  Brain,
  GitCommit,
  Flask,
} from "@phosphor-icons/react";
import { AIIcon } from "@/components/ai/AIIcon";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { type AppUserRole, useUserRole } from "@/hooks/useUserRole";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { useAppStore } from "@/stores/appStore";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

type SidebarNavItem = {
  icon: any;
  label: string;
  path: string;
  minRole?: AppUserRole;
  badge?: string;
  /** Feature em desenvolvimento: visível só p/ admin, exibida em cinza e não-clicável. */
  dev?: boolean;
};

const crmItems: SidebarNavItem[] = [
  { icon: SquaresFour, label: "Dashboard", path: "/dashboard", minRole: "user" },
  { icon: ChatCircleDots, label: "Inbox", path: "/inbox", minRole: "user", badge: "LIVE" },
  { icon: Broadcast, label: "Conexões", path: "/connections", minRole: "user" },
  { icon: Users, label: "Contatos", path: "/contacts", minRole: "user" },
  { icon: Megaphone, label: "Campanhas", path: "/campaigns", minRole: "user" },
  { icon: AIIcon, label: "IA & Automação", path: "/ai", minRole: "user" },
  { icon: Brain, label: "Memória IA", path: "/memory", minRole: "user" },
  { icon: TreeStructure, label: "Fluxos", path: "/flows", minRole: "admin", dev: true },
  { icon: Flask, label: "Central de Testes", path: "/tests", minRole: "admin", dev: true },
];

const adminItems: SidebarNavItem[] = [
  { icon: HardDrives, label: "Cluster", path: "/nodes", minRole: "user" },
  { icon: ShieldCheck, label: "Usuários", path: "/users", minRole: "user" },
  { icon: TrendUp, label: "Deployments", path: "/deployments", minRole: "user" },
  { icon: Cpu, label: "Memória", path: "/memory", minRole: "user" },
  { icon: GitCommit, label: "Versões", path: "/versions", minRole: "user" },
  { icon: FileText, label: "Logs", path: "/logs", minRole: "user" },
];

const bottomItems: SidebarNavItem[] = [
  { icon: Pulse, label: "Status & Saúde", path: "/diagnostics", minRole: "user" },
  { icon: Gear, label: "Configurações", path: "/settings", minRole: "user" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { role, isLoading, roleLevel } = useUserRole();
  const activeConversationId = useAppStore((state) => state.activeConversationId);

  useEffect(() => {
    if (isMobile) return;
    
    let lastWidth = window.innerWidth;
    
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth < 1024 && lastWidth >= 1024) {
        setCollapsed(true);
      }
      lastWidth = currentWidth;
    };
    
    if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  const visibleCrmItems = useMemo(
    () => crmItems.filter((item) => roleLevel[role] >= roleLevel[item.minRole ?? "user"]),
    [role, roleLevel],
  );

  const visibleAdminItems = useMemo(
    () => adminItems.filter((item) => roleLevel[role] >= roleLevel[item.minRole ?? "user"]),
    [role, roleLevel],
  );

  const visibleBottomItems = useMemo(
    () => bottomItems.filter((item) => roleLevel[role] >= roleLevel[item.minRole ?? "user"]),
    [role, roleLevel],
  );

  const shouldShowAdminMenu = roleLevel[role] >= roleLevel.user && visibleAdminItems.length > 0;

  useEffect(() => {
    if (!isMobile) {
      window.dispatchEvent(new CustomEvent<boolean>(SIDEBAR_COLLAPSE_EVENT, { detail: collapsed }));
    }
  }, [collapsed, isMobile]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const isAdminPath = adminItems.some((item) => location.pathname.startsWith(item.path));
    if (isAdminPath) {
      setAdminOpen(true);
    }
  }, [location.pathname]);

  const sidebarWidth = useMemo(() => (collapsed ? 88 : 288), [collapsed]);

  const renderNavItem = (item: SidebarNavItem, compact: boolean, keyPrefix: string) => {
    const targetPathname = item.path.split("?")[0];
    const isActive = location.pathname === targetPathname;

    // Itens em desenvolvimento: cinza, não-clicáveis, badge DEV. Só chegam aqui p/ admin+.
    if (item.dev) {
      return (
        <div
          key={`${keyPrefix}:${item.label}:${item.path}`}
          title="Em desenvolvimento — disponível apenas para administradores"
          aria-disabled="true"
          className={cn(
            "sidebar-item group relative min-h-[38px] cursor-not-allowed opacity-45",
            compact && "justify-center px-2.5",
          )}
        >
          <item.icon
            weight="regular"
            className="h-[14px] w-[14px] flex-shrink-0 text-sidebar-muted"
          />
          {!compact && (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-sidebar-muted">
                {item.label}
              </span>
              <Badge className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                DEV
              </Badge>
            </>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={`${keyPrefix}:${item.label}:${item.path}`}
        to={item.path}
        className={cn(
          "sidebar-item group relative min-h-[38px]",
          isActive && "sidebar-item-active",
          compact && "justify-center px-2.5",
        )}
      >
        <item.icon
          weight={isActive ? "fill" : "regular"}
          className={cn(
            "h-[14px] w-[14px] flex-shrink-0 transition-colors",
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
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide font-bold",
                  item.badge === "LIVE"
                    ? "bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 animate-pulse"
                    : "border border-border/70 bg-background/60 text-muted-foreground",
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

  const renderAiCollapsibleMenu = (item: SidebarNavItem, compact: boolean) => {
    if (compact) {
      return renderNavItem({ ...item, path: "/ai?tab=dashboard" }, compact, "crm");
    }

    const aiSubitems = [
      { label: "Dashboard", tab: "dashboard" },
      { label: "Atendentes", tab: "atendentes" },
      { label: "Provedores", tab: "provedores" },
      { label: "Conhecimento", tab: "conhecimento" },
      { label: "Operação", tab: "operacao" },
      { label: "Análises", tab: "analise" },
    ];

    const isSubActive = (tab: string) => {
      const searchParams = new URLSearchParams(location.search);
      return location.pathname === "/ai" && searchParams.get("tab") === tab;
    };

    const isAnyActive = location.pathname === "/ai";

    return (
      <Collapsible
        key="crm:ai-collapsible"
        open={aiMenuOpen || isAnyActive}
        onOpenChange={setAiMenuOpen}
        className="w-full space-y-1"
      >
        <CollapsibleTrigger
          className={cn(
            "sidebar-item group relative w-full min-h-[38px] flex items-center justify-between text-left",
            isAnyActive && "sidebar-item-active",
          )}
          onClick={(e) => {
            navigate("/ai?tab=dashboard");
          }}
        >
          <div className="flex items-center gap-3">
            <item.icon
              weight={isAnyActive ? "fill" : "regular"}
              className={cn(
                "h-[14px] w-[14px] flex-shrink-0 transition-colors",
                isAnyActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground",
              )}
            />
            <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium", isAnyActive && "text-sidebar-foreground")}>
              {item.label}
            </span>
          </div>
          {aiMenuOpen || isAnyActive ? <CaretUp className="h-3 w-3 text-sidebar-muted" /> : <CaretDown className="h-3 w-3 text-sidebar-muted" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 space-y-1 border-l border-sidebar-border/30 ml-3.5 mt-1">
          {aiSubitems.map((sub) => {
            const active = isSubActive(sub.tab);
            return (
              <NavLink
                key={`ai-sub:${sub.tab}`}
                to={`/ai?tab=${sub.tab}`}
                className={cn(
                  "flex h-8 items-center rounded-lg px-3 text-[12px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                  active && "bg-sidebar-accent/50 text-sidebar-foreground font-semibold",
                )}
              >
                {sub.label}
              </NavLink>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
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
      <div className="border-b border-sidebar-border/60 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 shadow-glow">
            <BrandLogo size={34} />
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-[15px] font-bold leading-tight text-sidebar-foreground">ZAPFLOW AI</h1>
                <Sparkle weight="fill" className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-sidebar-muted">CRM Enterprise</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
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


      <nav className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <div className="space-y-1">
          {visibleCrmItems.map((item) => {
            if (item.path === "/ai") {
              return renderAiCollapsibleMenu(item, compact);
            }
            return renderNavItem(item, compact, "crm");
          })}
        </div>

        {shouldShowAdminMenu && (
          compact ? (
            <div className="space-y-1">
              {visibleAdminItems.map((item) => renderNavItem(item, compact, "system"))}
            </div>
          ) : (
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-muted/70 hover:bg-sidebar-accent/40">
                <span>Administração</span>
                {adminOpen ? <CaretUp className="h-3.5 w-3.5" /> : <CaretDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1">
                {visibleAdminItems.map((item) => renderNavItem(item, compact, "system"))}
              </CollapsibleContent>
            </Collapsible>
          )
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
    const showTrigger = !(location.pathname === "/inbox" && activeConversationId);
    if (!showTrigger) return null;

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
