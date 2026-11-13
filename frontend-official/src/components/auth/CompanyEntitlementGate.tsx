import { ReactNode, useEffect, useState } from "react";
import { API_BASE_URL } from "@/core/lib/backendConfig";
import { buildApiHeaders } from "@/core/lib/apiGuard";

type Module = "inbox" | "contacts" | "campaigns";

export function CompanyEntitlementGate({ module, children }: { module: Module; children: ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; allowed: boolean; message: string }>({ loading: true, allowed: false, message: "" });
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/company/entitlements`, { headers: await buildApiHeaders() });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível validar o pacote da empresa.");
        const allowed = Array.isArray(payload.modules) && payload.modules.includes(module);
        if (alive) setState({ loading: false, allowed, message: allowed ? "" : "Este recurso não está incluído no pacote ativo da empresa." });
      } catch (error) {
        if (alive) setState({ loading: false, allowed: false, message: error instanceof Error ? error.message : "Falha ao validar o pacote da empresa." });
      }
    })();
    return () => { alive = false; };
  }, [module]);

  if (state.loading) return <div className="p-8 text-center text-sm text-muted-foreground" role="status">Validando recursos da empresa…</div>;
  if (!state.allowed) return <main className="min-h-[50vh] p-6 flex items-center justify-center"><section className="max-w-lg rounded-2xl border border-border bg-card p-6 text-center"><h1 className="font-semibold">Recurso indisponível</h1><p className="mt-2 text-sm text-muted-foreground">{state.message}</p></section></main>;
  return <>{children}</>;
}
