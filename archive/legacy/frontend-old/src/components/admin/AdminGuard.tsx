import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock } from "@phosphor-icons/react";
import { buildApiUrl } from "@/config/runtime";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const authCheckSeqRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const checkAdminAccess = async () => {
      const runSeq = ++authCheckSeqRef.current;
      if (!isMounted) return;
      setIsLoading(true);

      const applyIfLatest = (updater: () => void) => {
        if (!isMounted) return;
        if (runSeq !== authCheckSeqRef.current) return;
        updater();
      };

      try {
        const userRole = String(localStorage.getItem("user_role") || "").trim().toLowerCase();
        const localToken =
          String(localStorage.getItem("auth_token") || "").trim() ||
          String(localStorage.getItem("zapai_auth_token") || "").trim() ||
          String(localStorage.getItem("jwt_token") || "").trim();

        const isDevMode = import.meta.env.MODE === "development";

        if (userRole === "master_admin" || isDevMode) {
          applyIfLatest(() => {
            setIsAuthorized(true);
          });
          return;
        }

        if (!localToken) {
          applyIfLatest(() => {
            setIsAuthorized(false);
            navigate("/");
          });
          return;
        }

        const meResponse = await fetch(buildApiUrl("/api/auth/me"), {
          headers: {
            Authorization: `Bearer ${localToken}`,
            Accept: "application/json",
          },
        });

        if (!meResponse.ok) {
          applyIfLatest(() => {
            setIsAuthorized(false);
            navigate("/");
          });
          return;
        }

        const mePayload = (await meResponse.json()) as { user?: { role?: string } };
        const apiRole = String(mePayload?.user?.role || "").trim().toLowerCase();
        if (apiRole === "master_admin") {
          applyIfLatest(() => {
            setIsAuthorized(true);
          });
          return;
        }

        applyIfLatest(() => {
          setIsAuthorized(false);
          navigate("/");
        });
      } catch (error) {
        if (import.meta.env.MODE !== "production") console.error("Failed to check admin access:", error);
        applyIfLatest(() => {
          setIsAuthorized(false);
          navigate("/");
        });
      } finally {
        applyIfLatest(() => {
          setIsLoading(false);
        });
      }
    };

    void checkAdminAccess();

    const handleStorageOrFocus = () => {
      void checkAdminAccess();
    };

    window.addEventListener("storage", handleStorageOrFocus);
    window.addEventListener("focus", handleStorageOrFocus);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageOrFocus);
      window.removeEventListener("focus", handleStorageOrFocus);
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-display mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-4">
            Você não tem permissão para acessar esta página administrativa.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
