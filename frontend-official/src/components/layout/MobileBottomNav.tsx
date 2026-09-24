import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChatCircleDots,
  Users,
  Megaphone,
  SquaresFour,
  Sparkle,
  List,
} from "@phosphor-icons/react";
import { useAppStore } from "@/stores/appStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileTabItem {
  id: string;
  label: string;
  icon: any;
  path?: string;
  isAction?: boolean;
  action?: () => void;
  badge?: number;
}

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const isMobileChatOpen = useAppStore((state) => state.isMobileChatOpen);
  const conversations = useAppStore((state) => state.conversations);

  // Calculate total unread messages across all active conversations
  const unreadCount = useMemo(() => {
    if (!Array.isArray(conversations)) return 0;
    return conversations.reduce((acc, conv) => {
      const count = Number(conv?.unreadCount ?? conv?.unread ?? 0);
      return acc + (count > 0 ? count : 0);
    }, 0);
  }, [conversations]);

  // When inside an active chat in Inbox, hide bottom bar so the keyboard and composer have 100% space
  const isInboxChatOpen = location.pathname.startsWith("/inbox") && isMobileChatOpen;

  if (!isMobile || isInboxChatOpen) {
    return null;
  }

  const handleOpenMenu = () => {
    if (typeof window !== "undefined") {
      try {
        if ("vibrate" in navigator) {
          navigator.vibrate(10);
        }
      } catch {}
      window.dispatchEvent(new CustomEvent("zapflow:open-mobile-menu"));
    }
  };

  const tabs: MobileTabItem[] = [
    {
      id: "inbox",
      label: "Inbox",
      icon: ChatCircleDots,
      path: "/inbox",
      badge: unreadCount,
    },
    {
      id: "contacts",
      label: "Contatos",
      icon: Users,
      path: "/contacts",
    },
    {
      id: "campaigns",
      label: "Campanhas",
      icon: Megaphone,
      path: "/campaigns",
    },
    {
      id: "dashboard",
      label: "Painel",
      icon: SquaresFour,
      path: "/dashboard",
    },
    {
      id: "ai",
      label: "IA",
      icon: Sparkle,
      path: "/ai",
    },
    {
      id: "more",
      label: "Mais",
      icon: List,
      isAction: true,
      action: handleOpenMenu,
    },
  ];

  return (
    <nav
      aria-label="Navegação móvel"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.35)] transition-all duration-200 select-none"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
      }}
    >
      <div className="grid grid-cols-6 items-center px-1 pt-1.5 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.isAction) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={tab.action}
                className="flex flex-col items-center justify-center py-1 px-0.5 min-h-[46px] rounded-xl text-muted-foreground/80 hover:text-foreground active:scale-95 transition-all group focus:outline-none"
                aria-label="Abrir menu do aplicativo"
              >
                <div className="relative flex items-center justify-center h-6 w-6">
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <span className="text-[10px] font-medium leading-tight mt-0.5 text-muted-foreground group-hover:text-foreground truncate max-w-full">
                  {tab.label}
                </span>
              </button>
            );
          }

          const isActive = location.pathname.startsWith(tab.path!);

          return (
            <NavLink
              key={tab.id}
              to={tab.path!}
              className={({ isActive: active }) =>
                cn(
                  "relative flex flex-col items-center justify-center py-1 px-0.5 min-h-[46px] rounded-xl transition-all active:scale-95 group focus:outline-none",
                  active
                    ? "text-primary font-bold"
                    : "text-muted-foreground/80 hover:text-foreground font-medium"
                )
              }
            >
              <div className="relative flex items-center justify-center h-6 w-6">
                <Icon
                  weight={isActive ? "fill" : "regular"}
                  className={cn(
                    "h-5 w-5 transition-transform duration-150",
                    isActive ? "scale-110 text-emerald-400" : "text-muted-foreground/80 group-hover:text-foreground"
                  )}
                />

                {/* Unread badge for Inbox */}
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white shadow-sm ring-2 ring-card animate-fade-in">
                    {tab.badge! > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "text-[10px] leading-tight mt-0.5 truncate max-w-full tracking-tight",
                  isActive ? "text-emerald-400 font-bold" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {tab.label}
              </span>

              {/* Active Indicator dot */}
              {isActive && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
