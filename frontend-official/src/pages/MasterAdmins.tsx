import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadMasterAdmins, type MasterAdminRow } from "@/services/adminMasterService";

function fallback(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export default function MasterAdmins() {
  const [rows, setRows] = useState<MasterAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const next = await loadMasterAdmins();
        if (!mounted) return;
        setRows(Array.isArray(next) ? next : []);
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

  return (
    <div className="min-h-screen">
      <Header title="Admins" subtitle="Acessos administrativos do SaaS" runtimeState="running" />
      <div className="page-container section-stack">
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display">Admins</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0">
            {error ? <p className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Perfil</TableHead><TableHead>Status</TableHead><TableHead>Último acesso</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`admin-skeleton-${index}`}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem admins disponíveis.</TableCell></TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{fallback(row.email)}</TableCell>
                      <TableCell>{fallback(row.role)}</TableCell>
                      <TableCell>{fallback(row.status)}</TableCell>
                      <TableCell>{fallback(row.lastAccess)}</TableCell>
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