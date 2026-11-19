import { ReactNode, useEffect, useState } from "react";
import { apiService } from "@/core/services/apiService";
import { loadAdminAuthSession } from "@/core/lib/adminAuthSession";

type Module = "inbox" | "contacts" | "campaigns";

export function CompanyEntitlementGate({ module, children }: { module: Module; children: ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; allowed: boolean; message: string }>({
    loading: true,
    allowed: false,
    message: "",
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const session = loadAdminAuthSession();
        // Master administrators always have unrestricted access across all tenant modules
        if (session && ["master", "master_admin"].includes(String(session.role))) {
          if (alive) setState({ loading: false, allowed: true, message: "" });
          return;
        }

        const payload = await apiService.getCompanyEntitlements();
        const allowed =
          payload.legacyAccess ||
          (Array.isArray(payload.modules) && payload.modules.includes(module));

        if (alive) {
          setState({
            loading: false,
            allowed,
            message: allowed
              ? ""
              : "Este recurso não está incluído no pacote ativo da empresa.",
          });
        }
      } catch (error) {
        const session = loadAdminAuthSession();
        if (session && ["master", "master_admin"].includes(String(session.role))) {
          if (alive) setState({ loading: false, allowed: true, message: "" });
          return;
        }

        if (alive) {
          setState({
            loading: false,
            allowed: false,
            message:
              error instanceof Error
                ? error.message
                : "Falha ao validar o pacote da empresa.",
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [module]);

  if (state.loading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground" role="status">
        Validando recursos da empresa…
      </div>
    );
  }

  if (!state.allowed) {
    return (
      <main className="min-h-[50vh] p-6 flex items-center justify-center">
        <section className="max-w-lg rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="font-semibold text-lg">Recurso indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
