import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Bot } from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";

interface AgentConfiguration {
  key?: string;
  name?: string;
  role?: string;
  sector?: string;
  personality?: string;
  prompt?: string;
  rules?: string;
  memory?: unknown;
  tone?: string;
  responseStyle?: string;
  sessionIds?: string[];
  [field: string]: unknown;
}

interface AgentCustomizerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: AgentConfiguration;
  onSave?: (updatedAgent: AgentConfiguration) => Promise<void> | void;
}

export function AgentCustomizerModal({ open, onOpenChange, agent, onSave }: AgentCustomizerModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personality, setPersonality] = useState("");
  const [rules, setRules] = useState("");
  const [memory, setMemory] = useState("");
  const [tone, setTone] = useState("professional");
  const [responseStyle, setResponseStyle] = useState("short_natural");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    if (!open) return;
    setName(agent?.name || "");
    setRole(agent?.role || agent?.sector || "");
    setPersonality(agent?.personality || agent?.prompt || "");
    setRules(typeof agent?.rules === "string" ? agent.rules : "");
    setMemory(typeof agent?.memory === "string" ? agent.memory : "");
    setTone(agent?.tone || "professional");
    setResponseStyle(agent?.responseStyle || "short_natural");
  }, [agent, open]);

  const handleSave = async () => {
    if (pending.current) return;
    if (!agent?.key || !name.trim()) {
      toast({ title: "Informe o nome de um atendente selecionado", variant: "destructive" });
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      const updated = { ...agent, name: name.trim(), role: role.trim(), sector: role.trim(), personality, prompt: personality, rules, memory, tone, responseStyle };
      if (onSave) await onSave(updated);
      else {
        const result = await apiService.updateAIAgent(agent.key, updated);
        if (result.success === false) throw new Error("Não foi possível salvar o atendente.");
      }
      toast({ title: "Configuração salva", description: `As instruções de ${name.trim()} foram atualizadas.` });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Erro ao salvar configuração", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-emerald-400" />Configurar {agent?.name || "atendente"}</DialogTitle>
          <DialogDescription>Identidade e instruções usadas no atendimento. O avatar é editado no Avatar Studio; os dados da loja ficam no WhatsApp vinculado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {(agent?.sessionIds?.length || 0) > 1 && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Este atendente é usado em {agent?.sessionIds?.length} WhatsApps. Alterar suas instruções afeta todos esses números; os dados comerciais continuam vinculados a cada WhatsApp.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="agent-config-name">Nome</Label><Input id="agent-config-name" value={name} onChange={event => setName(event.target.value)} maxLength={100} /></div>
            <div className="space-y-1.5"><Label htmlFor="agent-config-role">Função</Label><Input id="agent-config-role" value={role} onChange={event => setRole(event.target.value)} maxLength={200} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="agent-config-personality">Instruções do atendente</Label><Textarea id="agent-config-personality" value={personality} onChange={event => setPersonality(event.target.value)} rows={5} placeholder="Como atender, orientar e encaminhar o cliente." /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="agent-config-tone">Tom</Label><select id="agent-config-tone" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={tone} onChange={event => setTone(event.target.value)}>{!['friendly', 'professional', 'consultative', 'casual'].includes(tone) && <option value={tone}>{tone}</option>}<option value="friendly">Amigável</option><option value="professional">Profissional</option><option value="consultative">Consultivo</option><option value="casual">Descontraído</option></select></div>
            <div className="space-y-1.5"><Label htmlFor="agent-config-style">Respostas</Label><select id="agent-config-style" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={responseStyle} onChange={event => setResponseStyle(event.target.value)}>{!['short_natural', 'clear_short', 'detailed'].includes(responseStyle) && <option value={responseStyle}>{responseStyle}</option>}<option value="short_natural">Curtas e naturais</option><option value="clear_short">Curtas e objetivas</option><option value="detailed">Detalhadas</option></select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="agent-config-rules">Regras e limites</Label><Textarea id="agent-config-rules" value={rules} onChange={event => setRules(event.target.value)} rows={3} placeholder="O que pode informar e quando encaminhar para uma pessoa." /></div>
          <div className="space-y-1.5"><Label htmlFor="agent-config-memory">Contexto permanente</Label><Textarea id="agent-config-memory" value={memory} onChange={event => setMemory(event.target.value)} rows={3} placeholder="Informações que o atendente deve considerar em todas as conversas." /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving} onClick={handleSave} className="bg-emerald-500 text-black hover:bg-emerald-400"><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Salvar Configuração"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
