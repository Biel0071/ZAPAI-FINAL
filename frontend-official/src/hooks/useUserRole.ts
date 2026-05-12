import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  if (["master", "admin_master", "superadmin", "owner"].includes(normalized)) return "master";
  if (["admin", "administrator", "manager"].includes(normalized)) return "admin";
  return "user";
}

async function inferRoleFromBackend(accessToken: string, userEmail?: string | null): Promise<AppUserRole | null> {
  void accessToken;
  void userEmail;
  return null;
}

async function resolveSessionWithTimeout(timeoutMs = 3500) {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("session_timeout")), timeoutMs);
    }),
  ]);
}

function resolveRoleFromAdminSession(): AppUserRole | null {
  const adminSession = loadAdminAuthSession();
  if (!isAdminAuthSessionValid(adminSession)) return null;
  return normalizeRole(adminSession.role);
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

  const resolveSessionRole = useCallback(async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
    const adminRole = resolveRoleFromAdminSession();
    if (adminRole) {
      publishRoleSnapshot({ role: adminRole, isLoading: false });
      return;
    }

    const sessionRole =
      session?.user?.app_metadata?.role ??
      session?.user?.user_metadata?.role ??
      session?.user?.app_metadata?.profile;

    if (sessionRole) {
      publishRoleSnapshot({ role: normalizeRole(sessionRole), isLoading: false });
      return;
    }

    if (!session?.access_token) {
      publishRoleSnapshot({ role: "user", isLoading: false });
      return;
    }

    const backendRole = await inferRoleFromBackend(session.access_token, session.user?.email);
    publishRoleSnapshot({ role: backendRole ?? "user", isLoading: false });
  }, [publishRoleSnapshot]);

  useEffect(() => {
    roleListeners.add(syncLocalState);
    syncLocalState(roleSnapshot);

    if (!roleInitStarted) {
      roleInitStarted = true;

      void (async () => {
        try {
          publishRoleSnapshot({ role: roleSnapshot.role, isLoading: true });

          const adminRole = resolveRoleFromAdminSession();
          if (adminRole) {
            publishRoleSnapshot({ role: adminRole, isLoading: false });
            return;
          }

          const { data } = await resolveSessionWithTimeout();
          await resolveSessionRole(data.session);
        } catch {
          publishRoleSnapshot({ role: "user", isLoading: false });
        }
      })();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        const adminRole = resolveRoleFromAdminSession();
        if (adminRole) {
          publishRoleSnapshot({ role: adminRole, isLoading: false });
          return;
        }

        publishRoleSnapshot({ role: roleSnapshot.role, isLoading: true });
        void resolveSessionRole(session).catch(() => {
          publishRoleSnapshot({ role: "user", isLoading: false });
        });
      });

      void subscription;
    }

    return () => {
      roleListeners.delete(syncLocalState);
    };
  }, [publishRoleSnapshot, resolveSessionRole, syncLocalState]);

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
