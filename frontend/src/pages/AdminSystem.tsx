import { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise, CheckCircle, CloudArrowDown, GitBranch, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  checkSystemUpdate,
  getSystemVersion,
  runSystemUpdate,
  type CheckUpdateResponse,
  type UpdateResponse,
  type VersionResponse,
} from '@/services/systemUpdateService';

function formatDate(value?: string | null) {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return date.toLocaleString('pt-BR');
}

function shortCommit(value?: string) {
  return String(value || '').slice(0, 8) || '-';
}

export default function AdminSystem() {
  const { toast } = useToast();
  const [version, setVersion] = useState<VersionResponse | null>(null);
  const [updateInfo, setUpdateInfo] = useState<CheckUpdateResponse | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadVersion = useCallback(async () => {
    try {
      setLoading(true);
      const payload = await getSystemVersion();
      setVersion(payload);
    } catch (error) {
      toast({
        title: 'Erro ao carregar versão',
        description: error instanceof Error ? error.message : 'Falha desconhecida',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleCheckUpdate = useCallback(async () => {
    try {
      setChecking(true);
      const payload = await checkSystemUpdate();
      setUpdateInfo(payload);
      toast({
        title: payload.updateAvailable ? 'Atualização disponível' : 'Sistema atualizado',
        description: payload.updateAvailable ? 'Existe uma nova versão no GitHub.' : 'Nenhuma atualização pendente.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao verificar atualização',
        description: error instanceof Error ? error.message : 'Falha desconhecida',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  }, [toast]);

  const handleUpdate = useCallback(async () => {
    try {
      setUpdating(true);
      setUpdateResult(null);
      const payload = await runSystemUpdate();
      setUpdateResult(payload);
      await loadVersion();
      toast({
        title: 'Sistema atualizado',
        description: `Versão atual: ${payload.version || 'atualizada'}`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao atualizar sistema',
        description: error instanceof Error ? error.message : 'Falha desconhecida',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  }, [loadVersion, toast]);

  useEffect(() => {
    void loadVersion();
  }, [loadVersion]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Admin · Sistema</h1>
        <p className="text-muted-foreground">Versionamento, atualização e deploy do sistema.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-5 w-5" /> Versão atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{loading ? '...' : version?.version || '-'}</p>
            <p className="text-sm text-muted-foreground">Ambiente: {version?.env || '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5" /> Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{version?.uptime || '-'}</p>
            <p className="text-sm text-muted-foreground">Backend online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowClockwise className="h-5 w-5" /> Última atualização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatDate(version?.lastUpdate)}</p>
            <p className="text-sm text-muted-foreground">Registrado em system_info</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atualização do sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCheckUpdate} disabled={checking || updating} variant="outline">
              {checking ? 'Verificando...' : 'Verificar atualização'}
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              <CloudArrowDown className="mr-2 h-4 w-4" />
              {updating ? 'Atualizando...' : 'Atualizar sistema'}
            </Button>
          </div>

          {updateInfo && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                {updateInfo.updateAvailable ? <WarningCircle className="h-5 w-5 text-warning" /> : <CheckCircle className="h-5 w-5 text-success" />}
                <Badge variant={updateInfo.updateAvailable ? 'secondary' : 'default'}>
                  {updateInfo.updateAvailable ? 'Atualização disponível' : 'Atualizado'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Local: {shortCommit(updateInfo.localCommit)}</p>
              <p className="text-sm text-muted-foreground">GitHub: {shortCommit(updateInfo.remoteCommit)}</p>
            </div>
          )}

          {updateResult?.output && (
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap">
              {updateResult.output}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
