import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Scheduler() {
  return (
    <div className="min-h-screen">
      <Header title="Agendamento de Postagens" subtitle="Automatize mensagens em grupos com frequência" />
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display">Nova postagem agendada</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Grupo</Label><Input placeholder="Ex: Comunidade ZapAI" /></div>
            <div className="space-y-2"><Label>Frequência</Label><Input placeholder="Ex: Diária às 09:00" /></div>
            <div className="space-y-2"><Label>Tipo de mensagem</Label><Input placeholder="Ex: texto, imagem, vídeo" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Mensagem</Label><Textarea className="min-h-[140px]" /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
