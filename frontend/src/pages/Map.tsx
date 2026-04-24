import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, MapPin, Users, Database, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";

interface StateHeatmapEntry {
  state: string;
  ddds: string[];
  contactCount: number;
}

interface RegionSummary {
  region: string;
  states: string[];
  contactCount: number;
}

interface DddHeatmapEntry {
  ddd: string;
  state: string;
  region: string;
  contactCount: number;
}

interface ExecutiveOverviewData {
  coverage: {
    totalContacts: number;
    mappedContacts: number;
    unmappedContacts: number;
  };
  dddHeatmap: DddHeatmapEntry[];
  stateHeatmap: StateHeatmapEntry[];
  regionSummary: RegionSummary[];
  refreshedAt: string;
  partial: boolean;
}

function formatCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}

function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

export default function MapPage() {
  const [data, setData] = useState<ExecutiveOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/contacts', {
        headers: { 'x-tenant-id': 'default' }
      });
      if (!response.ok) throw new Error('Failed to load map data');
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  const coveragePercent = data && data.coverage.totalContacts > 0
    ? (data.coverage.mappedContacts / data.coverage.totalContacts) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mapa DDD</h1>
          <p className="text-muted-foreground mt-1">
            Distribuição por DDD, estado e região
          </p>
        </div>
        <Button onClick={refresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading && !data ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Carregando mapa de DDD...</p>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contatos Mapeados</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCount(data.coverage.mappedContacts)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatPercent(coveragePercent)} da base retornou DDD válido
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fora do Mapa</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCount(data.coverage.unmappedContacts)}</div>
                <p className="text-xs text-muted-foreground">
                  Grupos, newsletters e formatos inválidos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estados Ativos</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCount(data.stateHeatmap.length)}</div>
                <p className="text-xs text-muted-foreground">
                  Estados com pelo menos um DDD válido
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Regiões</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCount(data.regionSummary.length)}</div>
                <p className="text-xs text-muted-foreground">
                  Resumo pronto para dashboard
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Heatmap por Estado e DDD</CardTitle>
              <CardDescription>
                Distribuição geográfica dos contatos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.stateHeatmap.map((state) => (
                  <div key={state.state} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{state.state}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCount(state.contactCount)} contatos
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {state.ddds.map((ddd) => {
                        const dddData = data.dddHeatmap.find((d) => d.ddd === ddd);
                        return (
                          <div
                            key={ddd}
                            className="px-3 py-1 bg-secondary rounded-md text-sm"
                            title={`${dddData?.contactCount || 0} contatos`}
                          >
                            {ddd}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold mb-3">Resumo por Região</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.regionSummary.map((region) => (
                    <div
                      key={region.region}
                      className="p-3 bg-secondary/50 rounded-lg"
                    >
                      <div className="font-medium">{region.region}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCount(region.contactCount)} contatos • {region.states.length} estados
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
