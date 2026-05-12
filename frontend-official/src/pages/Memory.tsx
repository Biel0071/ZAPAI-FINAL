import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/apiService";

export default function Memory() {
  const [enabled, setEnabled] = useState(false);
  const [rememberLastOrder, setRememberLastOrder] = useState(false);
  const [rememberPreferences, setRememberPreferences] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void apiService
      .getMemorySettings()
      .then((data) => {
        if (!active) return;
        setEnabled(Boolean(data.enabled));
        setRememberLastOrder(Boolean(data.rememberLastOrder));
        setRememberPreferences(Boolean(data.rememberPreferences));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.saveMemorySettings({ enabled, rememberLastOrder, rememberPreferences });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Memory" subtitle="Configuração de memória operacional" />
      <div className="page-container section-stack">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Memória em produção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <Label htmlFor="memory-enabled">Memória global</Label>
              <Switch id="memory-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={loading || saving} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <Label htmlFor="memory-last-order">Lembrar último pedido</Label>
              <Switch id="memory-last-order" checked={rememberLastOrder} onCheckedChange={setRememberLastOrder} disabled={loading || saving} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <Label htmlFor="memory-preferences">Lembrar preferências</Label>
              <Switch id="memory-preferences" checked={rememberPreferences} onCheckedChange={setRememberPreferences} disabled={loading || saving} />
            </div>
            <Button onClick={() => void handleSave()} disabled={loading || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}