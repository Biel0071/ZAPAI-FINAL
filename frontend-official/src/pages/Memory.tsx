import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";

export default function Memory() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [rememberLastOrder, setRememberLastOrder] = useState(false);
  const [rememberPreferences, setRememberPreferences] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getMemorySettings(true);
      setEnabled(Boolean(data.enabled));
      setRememberLastOrder(Boolean(data.rememberLastOrder));
      setRememberPreferences(Boolean(data.rememberPreferences));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar configurações de memória.";
      console.error("[Memory] Load error:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings, retryCount]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.saveMemorySettings({ enabled, rememberLastOrder, rememberPreferences });
      toast({ title: "Configurações de memória salvas com sucesso." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao salvar configurações.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header title="Memória Operacional" subtitle="Configuração de memória contextual da IA" />
      <div className="page-container section-stack">
        {error ? (
          <Card className="glass-card rounded-2xl border-destructive/30">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <span className="text-xl">⚠️</span>
              </div>
              <div className="space-y-1">
                <p className="font-display text-lg font-semibold text-foreground">Falha ao carregar memória</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={handleRetry}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card className="glass-card rounded-2xl">
            <CardContent className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
                  <div className="h-5 w-10 animate-pulse rounded-full bg-muted/50" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card rounded-2xl">
            <CardHeader>
              <CardTitle className="font-display">Memória contextual</CardTitle>
              <CardDescription>
                A memória permite que a IA lembre contexto de conversas anteriores para respostas mais personalizadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="memory-enabled" className="cursor-pointer font-medium">Memória global</Label>
                  <p className="text-xs text-muted-foreground">Ativa a memória contextual em todas as conversas</p>
                </div>
                <Switch id="memory-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="memory-last-order" className="cursor-pointer font-medium">Lembrar último pedido</Label>
                  <p className="text-xs text-muted-foreground">A IA lembrará do último pedido feito pelo cliente</p>
                </div>
                <Switch id="memory-last-order" checked={rememberLastOrder} onCheckedChange={setRememberLastOrder} disabled={saving || !enabled} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="memory-preferences" className="cursor-pointer font-medium">Lembrar preferências</Label>
                  <p className="text-xs text-muted-foreground">A IA lembrará das preferências e estilo do cliente</p>
                </div>
                <Switch id="memory-preferences" checked={rememberPreferences} onCheckedChange={setRememberPreferences} disabled={saving || !enabled} />
              </div>
              <div className="pt-2">
                <Button className="w-full rounded-xl shadow-glow sm:w-auto" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar configurações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}