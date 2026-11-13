import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/core/lib/backendConfig";
import { buildApiHeaders } from "@/core/lib/apiGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Company = { id: string; name: string; status: string; zai_enabled: boolean; users_count: number; stores_count: number };
type Registration = { id: number; company_name: string; responsible_name: string; username: string; email: string; status: string };
type Plan = { id: number; name: string; modules: string[]; number_limit: number };
type License = { id: number; company_name: string; plan_name: string; expires_at: string | null; redeemed_at: string | null; revoked_at: string | null };
type ZaiUser = { id: number; tenantId: string; name: string; email: string | null; enabled: boolean };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await buildApiHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}), "Content-Type": "application/json" } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Falha na solicitação.");
  return payload as T;
}

export default function MasterCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [zaiGlobal, setZaiGlobal] = useState(true);
  const [zaiUsers, setZaiUsers] = useState<ZaiUser[]>([]);
  const [link, setLink] = useState("");
  const [issuedToken, setIssuedToken] = useState("");
  const [planName, setPlanName] = useState("");
  const [numberLimit, setNumberLimit] = useState("1");
  const [selectedModules, setSelectedModules] = useState<string[]>(["inbox"]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [c, r, p, l, z] = await Promise.all([
      request<{ companies: Company[] }>("/api/admin/master/companies"),
      request<{ requests: Registration[] }>("/api/admin/master/registration-requests"),
      request<{ plans: Plan[] }>("/api/admin/master/license-plans"),
      request<{ licenses: License[] }>("/api/admin/master/licenses"),
      request<{ globalEnabled: boolean; users: ZaiUser[] }>("/api/admin/master/zai-assistant"),
    ]);
    setCompanies(c.companies); setRegistrations(r.requests); setPlans(p.plans); setLicenses(l.licenses);
    setZaiGlobal(z.globalEnabled); setZaiUsers(z.users);
    if (!selectedCompany && c.companies[0]) setSelectedCompany(c.companies[0].id);
    if (!selectedPlan && p.plans[0]) setSelectedPlan(String(p.plans[0].id));
  }, [selectedCompany, selectedPlan]);

  useEffect(() => { void reload().catch((error) => toast.error(error.message)); }, [reload]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); await reload(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Falha na operação."); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5 p-4 sm:p-6">
    <section className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
      <h2 className="font-semibold">Ativações do Assistente ZAI</h2>
      <Button variant="outline" disabled={busy} onClick={() => void run(() => request("/api/admin/master/zai-assistant/global", { method: "PATCH", body: JSON.stringify({ enabled: !zaiGlobal }) }))}>ZAI global {zaiGlobal ? "ativo" : "inativo"}</Button>
      {zaiUsers.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-sm"><span>{user.name} · {user.email || user.tenantId}</span><Button size="sm" variant="outline" disabled={busy || !zaiGlobal} onClick={() => void run(() => request(`/api/admin/master/zai-assistant/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !user.enabled }) }))}>Painel {user.enabled ? "ativo" : "inativo"}</Button></div>)}
      <p className="text-xs text-muted-foreground">A análise contínua das sessões WhatsApp não depende destas ativações.</p>
    </section>
    <section className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
      <h2 className="font-semibold">Solicitações de cadastro</h2>
      <Button disabled={busy} onClick={() => void run(async () => { const result = await request<{ link: string }>("/api/admin/master/registration-links", { method: "POST", body: JSON.stringify({ validHours: 72 }) }); setLink(result.link); })}>Gerar link de cadastro</Button>
      {link && <div className="flex flex-col gap-2 sm:flex-row"><Input readOnly value={link} aria-label="Link seguro de cadastro" /><Button variant="outline" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copiado."))}>Copiar</Button></div>}
      {!registrations.length && <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>}
      {registrations.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-sm">
        <span>{item.company_name} · {item.responsible_name} · {item.email} · {item.status}</span>
        {item.status === "pending" && <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void run(() => request(`/api/admin/master/registration-requests/${item.id}/approve`, { method: "POST" }))}>Aprovar</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => request(`/api/admin/master/registration-requests/${item.id}/reject`, { method: "POST" }))}>Rejeitar</Button></div>}
      </div>)}
    </section>

    <section className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
      <h2 className="font-semibold">Empresas</h2>
      {companies.map((company) => <div key={company.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-sm">
        <span>{company.name} <span className="text-muted-foreground">· {company.users_count} usuários · {company.stores_count} lojas</span></span>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy || company.status !== "active"} onClick={() => { window.localStorage.setItem("zai_admin_company_context", company.id); window.location.assign("/settings?tab=perfil"); }}>Abrir conta</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => request(`/api/admin/master/companies/${encodeURIComponent(company.id)}/zai`, { method: "PATCH", body: JSON.stringify({ enabled: !company.zai_enabled }) }))}>ZAI {company.zai_enabled ? "ativo" : "inativo"}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => request(`/api/admin/master/companies/${encodeURIComponent(company.id)}/status`, { method: "PATCH", body: JSON.stringify({ status: company.status === "active" ? "suspended" : "active" }) }))}>{company.status === "active" ? "Suspender" : "Reativar"}</Button></div>
      </div>)}
    </section>

    <section className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
      <h2 className="font-semibold">Planos e licenças</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Nome do plano" aria-label="Nome do plano" />
        <Input type="number" min="0" value={numberLimit} onChange={(event) => setNumberLimit(event.target.value)} placeholder="Limite de números" aria-label="Limite de números WhatsApp" />
        <Button disabled={busy || !planName.trim()} onClick={() => void run(async () => { await request("/api/admin/master/license-plans", { method: "POST", body: JSON.stringify({ name: planName, modules: selectedModules, numberLimit: Number(numberLimit) }) }); setPlanName(""); })}>Criar plano</Button>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">{[["inbox", "Inbox/chat"], ["contacts", "Contatos"], ["campaigns", "Campanhas"]].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={selectedModules.includes(key)} onChange={(event) => setSelectedModules((old) => event.target.checked ? [...old, key] : old.filter((item) => item !== key))} />{label}</label>)}</div>
      <div className="grid gap-2 sm:grid-cols-4">
        <select className="h-10 rounded-lg border border-border bg-background px-3" value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)} aria-label="Empresa para licença"><option value="">Selecione empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
        <select className="h-10 rounded-lg border border-border bg-background px-3" value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)} aria-label="Plano para licença"><option value="">Selecione plano</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
        <Input type="datetime-local" value={licenseExpiresAt} onChange={(event) => setLicenseExpiresAt(event.target.value)} aria-label="Validade opcional da licença" />
        <Button disabled={busy || !selectedCompany || !selectedPlan} onClick={() => void run(async () => { const result = await request<{ token: string }>(`/api/admin/master/companies/${encodeURIComponent(selectedCompany)}/licenses`, { method: "POST", body: JSON.stringify({ planId: Number(selectedPlan), ...(licenseExpiresAt ? { expiresAt: new Date(licenseExpiresAt).toISOString() } : {}) }) }); setIssuedToken(result.token); })}>Emitir token</Button>
      </div>
      {issuedToken && <div className="flex flex-col gap-2 sm:flex-row"><Input readOnly value={issuedToken} aria-label="Token de licença" /><Button variant="outline" onClick={() => void navigator.clipboard.writeText(issuedToken).then(() => toast.success("Token copiado."))}>Copiar</Button></div>}
      <p className="text-xs text-muted-foreground">O token é exibido somente nesta emissão. O resgate acontece pela conta administradora da empresa.</p>
      {licenses.map((license) => <div key={license.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-sm"><span>{license.company_name} · {license.plan_name} · {license.revoked_at ? "revogada" : license.redeemed_at ? "resgatada" : "aguardando resgate"}{license.expires_at ? ` · vence ${new Date(license.expires_at).toLocaleDateString()}` : ""}</span>{!license.revoked_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => request(`/api/admin/master/licenses/${license.id}/revoke`, { method: "POST" }))}>Revogar</Button>}</div>)}
    </section>
  </div>;
}
