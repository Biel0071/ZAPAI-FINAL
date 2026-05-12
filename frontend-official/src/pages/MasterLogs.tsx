import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { loadMasterLogs, type MasterLogRow } from "@/services/adminMasterService";

export default function MasterLogs() {
  const [rows, setRows] = useState<MasterLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const next = await loadMasterLogs();
        if (!mounted) return;
        setRows(Array.isArray(next) ? next : []);
        setError(null);
      } catch {
        if (!mounted) return;
        setRows([]);
        setError("Não foi possível carregar os logs agora.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void run();
    }, 45_000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Header title="Logs" subtitle="Observabilidade do backend oficial" runtimeState="running" />
      <div className="page-container section-stack">
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display">Logs recentes</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0">
            {error ? <p className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
            <Table>
              <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Serviço</TableHead><TableHead>Nível</TableHead><TableHead>Mensagem</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`log-skeleton-${index}`}>
                      <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem logs reais disponíveis.</TableCell></TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.timestamp}</TableCell>
                      <TableCell>{row.service}</TableCell>
                      <TableCell>{row.level}</TableCell>
                      <TableCell>{row.message}</TableCell>
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