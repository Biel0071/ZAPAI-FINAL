import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function FollowUp() {
  return (
    <div className="min-h-screen">
      <Header title="Follow Up Automático" subtitle="Reativação inteligente de conversas paradas" />
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Regras de Follow Up</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3 md:col-span-2"><Label>Ativar Follow Up</Label><Switch defaultChecked /></div>
            <div className="space-y-2"><Label>Quantidade de mensagens</Label><Input defaultValue="3" /></div>
            <div className="space-y-2"><Label>Tempo para verificar conversa (min)</Label><Input defaultValue="30" /></div>
            <div className="space-y-2"><Label>Intervalo entre mensagens (min)</Label><Input defaultValue="60" /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Respeitar horário comercial</Label><Switch defaultChecked /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
