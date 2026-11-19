import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/core/services/apiService";
import { useAdminAuth } from "@/state/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type User = { id: number; username: string; email: string | null; role: string; blocked?: boolean };
const moduleLabels = { inbox: "Inbox/chat", contacts: "Contatos", campaigns: "Campanhas" } as const;

export default function CompanyTeam({ adminHeaders }: { adminHeaders?: Record<string, string> } = {}) {
  const { role } = useAdminAuth();
  const isMaster = role === "master";
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Record<number, Record<string, boolean | undefined>>>({});
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [result, modulePermissions] = await Promise.all([apiService.getAdminUsers(), apiService.getCompanyUserModulePermissions(adminHeaders)]);
    setUsers(result as User[]);
    setPermissions(Object.fromEntries((result as User[]).map((user) => [user.id, Object.fromEntries(modulePermissions.filter((item) => item.user_id === user.id).map((item) => [item.module, item.enabled]))])));
  }, [adminHeaders]);

  useEffect(() => { void reload().catch((error) => toast.error(error.message || "Falha ao carregar equipe.")); }, [reload]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); await reload(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  };

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      await apiService.createAdminUser({ username: username.trim(), email: email.trim() || undefined, password, role: newRole });
      setUsername(""); setEmail(""); setPassword(""); setNewRole("user");
      toast.success("Usuário criado nesta empresa.");
    });
  }

  return <div className="space-y-5 p-4 sm:p-6">
    <section className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
      <h2 className="font-semibold">Equipe da empresa</h2>
      {!users.length && <p className="text-sm text-muted-foreground">Nenhum outro usuário encontrado.</p>}
      {users.map((user) => <div key={user.id} className="space-y-3 border-t border-border/50 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{user.username} · {user.email || "sem e-mail"} · {user.role}{user.blocked ? " · bloqueado" : ""}</span>{user.role !== "master_admin" && <Button size="sm" variant="outline" disabled={busy} onClick={() => window.confirm(`Excluir ${user.username} desta empresa?`) && void run(() => apiService.deleteAdminUser(user.id))}>Remover</Button>}</div>
        <div className="flex flex-wrap gap-2">{(Object.keys(moduleLabels) as Array<keyof typeof moduleLabels>).map((module) => {
          const enabled = permissions[user.id]?.[module];
          return <Button key={module} size="sm" variant="outline" disabled={busy} aria-pressed={enabled !== false} title={enabled === undefined ? "Herdado do pacote da empresa" : enabled ? "Permitido para este usuário" : "Bloqueado para este usuário"} onClick={() => void run(() => apiService.setUserModulePermission(user.id, module, enabled === false, adminHeaders))}>{moduleLabels[module]}: {enabled === undefined ? "pacote" : enabled ? "liberado" : "bloqueado"}</Button>;
        })}</div>
      </div>)}
    </section>

    <form onSubmit={(event) => void createUser(event)} className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
      <h2 className="font-semibold">Adicionar à equipe</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="team-username">Login</Label><Input id="team-username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
        <div className="space-y-1.5"><Label htmlFor="team-email">E-mail</Label><Input id="team-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="team-password">Senha inicial</Label><Input id="team-password" type="password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
        {isMaster && <div className="space-y-1.5"><Label htmlFor="team-role">Papel</Label><select id="team-role" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newRole} onChange={(event) => setNewRole(event.target.value)}><option value="user">Usuário</option><option value="admin">Administrador da empresa</option></select></div>}
      </div>
      <Button type="submit" disabled={busy || password.length < 12}>Criar usuário</Button>
      <p className="text-xs text-muted-foreground">O acesso fica limitado à empresa selecionada. Permissões individuais só reduzem os módulos concedidos pelo pacote.</p>
    </form>
  </div>;
}
