import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function MediaLibrary() {
  return (
    <div className="min-h-screen">
      <Header title="Mídia com IA" subtitle="Biblioteca de assets acionados automaticamente" />
      <div className="p-6 space-y-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display">Cadastrar mídia</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Tipo (imagem, vídeo, pdf, áudio)</Label><Input placeholder="Ex: imagem" /></div>
            <div className="space-y-2"><Label>Tags</Label><Input placeholder="Ex: oferta, produto, onboarding" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Descrição</Label><Textarea placeholder="Contexto de uso da mídia" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Gatilhos de uso pela IA</Label><Textarea placeholder="Ex: quando cliente pedir catálogo" /></div>
            <Button className="md:w-fit">Salvar mídia</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
