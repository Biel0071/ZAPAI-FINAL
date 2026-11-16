import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  loadZaiAssistantAdminSettings,
  updateZaiAssistantGlobal,
  updateZaiAssistantUser,
  type ZaiAssistantAdminSettings,
} from "@/core/services/adminMasterService";

type ZaiAdminUser = ZaiAssistantAdminSettings["users"][number];

function fallback(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export default function MasterAdmins() {
  const [rows, setRows] = useState<ZaiAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const next = await loadZaiAssistantAdminSettings();
        if (!mounted) return;
        setRows(next.users);
        setGlobalEnabled(next.globalEnabled);
        setError(null);
      } catch {
        if (!mounted) return;
        setRows([]);
        setError("Não foi possível carregar os usuários administrativos agora.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleGlobal = async (enabled: boolean) => {
    setSavingGlobal(true);
    try {
      await updateZaiAssistantGlobal(enabled);
      setGlobalEnabled(enabled);
    } catch {
      setError("Não foi possível atualizar a ativação global do ZAI.");
    } finally {
      setSavingGlobal(false);
    }
  };

  const toggleUser = async (row: ZaiAdminUser, enabled: boolean) => {
    setSavingUserId(row.id);
    try {
      await updateZaiAssistantUser(row.id, enabled);
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, enabled } : item));
    } catch {
      setError(`Não foi possível atualizar o ZAI para ${row.name}.`);
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header title="Usuários e Assistente ZAI" subtitle="Ativações globais e por usuário" />
      <div className="page-container section-stack">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="font-display">Ativação do ZAI</CardTitle>
            <div className="flex items-center gap-3 text-sm">
              <span>Disponível globalmente</span>
              <Switch checked={globalEnabled} disabled={savingGlobal} onCheckedChange={(checked) => void toggleGlobal(checked)} aria-label="Ativar ZAI globalmente" />
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {error ? <p role="alert" className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
            <Table>
              <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Email</TableHead><TableHead>Empresa</TableHead><TableHead>Perfil</TableHead><TableHead>Painel ZAI</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`admin-skeleton-${index}`}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{fallback(row.email)}</TableCell>
                      <TableCell>{fallback(row.tenantId)}</TableCell>
                      <TableCell>{fallback(row.role)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={row.enabled}
                          disabled={savingUserId === row.id}
                          onCheckedChange={(checked) => void toggleUser(row, checked)}
                          aria-label={`Ativar painel ZAI para ${row.name}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
