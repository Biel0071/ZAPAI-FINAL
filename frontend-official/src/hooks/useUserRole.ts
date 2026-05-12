import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_AUTH_CHANGED_EVENT, isAdminAuthSessionValid, loadAdminAuthSession } from "@/lib/adminAuthSession";

export type AppUserRole = "user" | "admin" | "master";

type RoleSnapshot = {
  role: AppUserRole;
  isLoading: boolean;
};

const roleListeners = new Set<(snapshot: RoleSnapshot) => void>();
let roleSnapshot: RoleSnapshot = { role: "user", isLoading: true };
let roleInitStarted = false;

function normalizeRole(value: unknown): AppUserRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["master", "admin_master", "master_admin", "superadmin", "owner"].includes(normalized)) return "master";
  if (["admin", "administrator", "manager"].includes(normalized)) return "admin";
  return "user";
}

function resolveRoleFromAdminSession(): AppUserRole | null {
  const adminSession = loadAdminAuthSession();
  if (!isAdminAuthSessionValid(adminSession)) return null;
  return normalizeRole(adminSession.role);
}

async function resolveSupabaseSession(): Promise<{ session: unknown | null }> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("session_timeout")), 3500);
      }),
    ]);
    return { session: data?.session ?? null };
  } catch {
    return { session: null };
  }
}

export function useUserRole() {
  const [role, setRoleState] = useState<AppUserRole>(roleSnapshot.role);
  const [isLoading, setIsLoading] = useState(roleSnapshot.isLoading);

  const syncLocalState = useCallback((next: RoleSnapshot) => {
    setRoleState(next.role);
    setIsLoading(next.isLoading);
  }, []);

  const publishRoleSnapshot = useCallback((next: RoleSnapshot) => {
    roleSnapshot = next;
    roleListeners.forEach((listener) => listener(next));
  }, []);

  const setRole = useCallback((nextRole: AppUserRole) => {
    setRoleState(nextRole);
    publishRoleSnapshot({ role: nextRole, isLoading: false });
  }, [publishRoleSnapshot]);

  useEffect(() => {
    roleListeners.add(syncLocalState);
    syncLocalState(roleSnapshot);

    if (!roleInitStarted) {
      roleInitStarted = true;

      void (async () => {
        try {
          publishRoleSnapshot({ role: roleSnapshot.role, isLoading: true });

          // Priority 1: Check the admin auth session (backend JWT)
          const adminRole = resolveRoleFromAdminSession();
          if (adminRole) {
            publishRoleSnapshot({ role: adminRole, isLoading: false });
            return;
          }

          // Priority 2: Try Supabase session (if configured)
          const { session } = await resolveSupabaseSession();
          if (session && typeof session === "object") {
            const s = session as Record<string, unknown>;
            const user = s.user as Record<string, unknown> | null;
            const sessionRole =
              (user?.app_metadata as Record<string, unknown>)?.role ??
              (user?.user_metadata as Record<string, unknown>)?.role ??
              (user?.app_metadata as Record<string, unknown>)?.profile;

            if (sessionRole) {
              publishRoleSnapshot({ role: normalizeRole(sessionRole), isLoading: false });
              return;
            }
          }

          publishRoleSnapshot({ role: "user", isLoading: false });
        } catch {
          publishRoleSnapshot({ role: "user", isLoading: false });
        }
      })();
    }

    return () => {
      roleListeners.delete(syncLocalState);
    };
  }, [publishRoleSnapshot, syncLocalState]);

  useEffect(() => {
    const onAdminAuthChanged = () => {
      const adminRole = resolveRoleFromAdminSession();
      if (adminRole) {
        publishRoleSnapshot({ role: adminRole, isLoading: false });
      } else {
        publishRoleSnapshot({ role: "user", isLoading: false });
      }
    };

    window.addEventListener(ADMIN_AUTH_CHANGED_EVENT, onAdminAuthChanged);
    return () => window.removeEventListener(ADMIN_AUTH_CHANGED_EVENT, onAdminAuthChanged);
  }, [publishRoleSnapshot]);

  const roleLevel = useMemo(() => ({ user: 1, admin: 2, master: 3 } as const), []);

  return { role, isLoading, setRole, roleLevel };
}
