import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function HumanAlert() {
  return (
    <div className="min-h-screen">
      <Header title="Alerta de Atendimento Humano" subtitle="Fallback automático quando o cliente pedir humano" />
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display">Ações automáticas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Enviar alerta para equipe</Label><Switch defaultChecked /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Pausar IA automaticamente</Label><Switch defaultChecked /></div>
            <div className="space-y-2"><Label>Resumo da conversa enviado ao atendente</Label><Textarea className="min-h-[140px]" placeholder="Template do resumo enviado para o humano" /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
