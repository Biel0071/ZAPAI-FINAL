import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  House,
  ChatCircleDots,
  Robot,
  TreeStructure,
  AddressBook,
  Megaphone,
  Gear,
  CaretLeft,
  CaretRight,
  Lightning,
  WhatsappLogo,
  List,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { apiService } from "@/services/apiService";
import { INBOX_UNREAD_EVENT, getInboxUnreadTotal } from "@/lib/inboxUnread";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

type SidebarNavItem = {
  icon: any;
  label: string;
  path: string;
};

function isNavItemActive(currentPathname: string, currentSearch: string, itemPath: string) {
  if (!itemPath.includes("?")) {
    return currentPathname === itemPath;
  }

  const [pathname, search = ""] = itemPath.split("?");
  const currentParams = new URLSearchParams(currentSearch);
  const targetParams = new URLSearchParams(search);

  if (currentPathname !== pathname) {
    return false;
  }

  for (const [key, value] of targetParams.entries()) {
    if (currentParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}

const navItems: SidebarNavItem[] = [
  { icon: House, label: "Dashboard", path: "/" },
  { icon: ChatCircleDots, label: "Inbox", path: "/inbox" },
  { icon: WhatsappLogo, label: "Conexões", path: "/connections" },
  { icon: AddressBook, label: "Contacts", path: "/contacts" },
  { icon: TreeStructure, label: "Flows", path: "/flows" },
  { icon: Robot, label: "AI Config", path: "/ai" },
  { icon: Megaphone, label: "Campaigns", path: "/campaigns" },
  { icon: Lightning, label: "Diagnostics", path: "/diagnostics" },
];

const bottomItems: SidebarNavItem[] = [{ icon: Gear, label: "Settings", path: "/settings" }];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inboxUnreadTotal, setInboxUnreadTotal] = useState(0);
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const conversations = await apiService.getConversations();
        setInboxUnreadTotal(getInboxUnreadTotal(conversations));
      } catch {
        setInboxUnreadTotal(0);
      }
    };

    const handleUnreadEvent = (event: Event) => {
      const customEvent = event as CustomEvent<number>;
      setInboxUnreadTotal(customEvent.detail ?? 0);
    };

    window.addEventListener(INBOX_UNREAD_EVENT, handleUnreadEvent);
    void loadUnread();

    return () => {
      window.removeEventListener(INBOX_UNREAD_EVENT, handleUnreadEvent);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      window.dispatchEvent(new CustomEvent<boolean>(SIDEBAR_COLLAPSE_EVENT, { detail: collapsed }));
    }
  }, [collapsed, isMobile]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebarWidth = useMemo(() => (collapsed ? 72 : 240), [collapsed]);

  const renderNavItem = (item: SidebarNavItem, compact: boolean) => {
    const isActive = isNavItemActive(location.pathname, location.search, item.path);
    const isInboxItem = item.path === "/inbox";

    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={cn(
          "sidebar-item group relative",
          isActive && "sidebar-item-active",
          compact && "justify-center px-2"
        )}
      >
        <item.icon
          weight={isActive ? "fill" : "regular"}
          className={cn(
            "w-[18px] h-[18px] flex-shrink-0 transition-colors",
            isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground"
          )}
        />
        <AnimatePresence>
          {!compact && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[13px] font-medium whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {isInboxItem && inboxUnreadTotal > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "h-[18px] min-w-[18px] px-1 justify-center text-[10px] font-semibold bg-primary text-primary-foreground",
              compact ? "absolute -top-0.5 -right-0.5" : "ml-auto"
            )}
          >
            {inboxUnreadTotal > 99 ? "99+" : inboxUnreadTotal}
          </Badge>
        )}
      </NavLink>
    );
  };

  const sidebarBody = (compact: boolean, mobileMode: boolean) => (
    <aside
      className="h-full w-full z-50 flex flex-col"
      style={{ background: "var(--gradient-sidebar)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-sidebar-border/60">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Lightning weight="fill" className="w-4 h-4 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!compact && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <h1 className="font-display text-[15px] font-bold text-sidebar-foreground leading-tight">
                ZapAI CRM
              </h1>
              <p className="text-[10px] text-sidebar-muted leading-none">
                Automação Inteligente
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {!compact && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted/60 px-3 mb-2">
            Menu
          </p>
        )}
        {navItems.map((item) => renderNavItem(item, compact))}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-sidebar-border/60 space-y-0.5">
        {bottomItems.map((item) => renderNavItem(item, compact))}

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
                <span className="text-[13px] text-sidebar-muted">Collapse</span>
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
        <DrawerContent className="h-[88dvh] p-0 border-border bg-sidebar">
          {sidebarBody(false, true)}
        </DrawerContent>
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
