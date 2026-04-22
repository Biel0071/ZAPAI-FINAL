import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function Groups() {
  return (
    <div className="min-h-screen">
      <Header title="Grupos" subtitle="Comportamento da IA em grupos do WhatsApp" />
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display">Regras para grupos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Responder menção</Label><Switch defaultChecked /></div>
            <div className="space-y-2"><Label>Responder palavra-chave</Label><Input placeholder="Ex: suporte, preço, plano" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Prompt diferente para grupos</Label><Textarea className="min-h-[160px]" /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
