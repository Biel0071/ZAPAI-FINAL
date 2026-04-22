import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function MessageTimers() {
  return (
    <div className="min-h-screen">
      <Header title="Timers de Mensagem" subtitle="Humanização do tempo de resposta da IA" />
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Configuração de Delays</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Delay por caractere (ms)</Label><Input defaultValue="35" /></div>
            <div className="space-y-2"><Label>Delay máximo (ms)</Label><Input defaultValue="2500" /></div>
            <div className="space-y-2"><Label>Tempo para responder (s)</Label><Input defaultValue="3" /></div>
            <div className="space-y-2"><Label>Aguardar nova mensagem (s)</Label><Input defaultValue="8" /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Simular digitando</Label><Switch defaultChecked /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Simular gravando áudio</Label><Switch /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
