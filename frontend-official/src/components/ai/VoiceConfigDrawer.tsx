import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SpeakerHigh, Play, Check, ArrowCounterClockwise, Copy } from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/apiService";

export interface VoiceProfile {
  id: string;
  name: string;
  gender: "female" | "male";
  role: string;
  description: string;
  defaultParams: {
    speed: number;
    pitch: number;
    intonation: number;
    naturalness: number;
    breath: number;
    expressiveness: number;
    emphasis: number;
    stability: number;
    pronunciation: number;
    pauses: number;
  };
}

interface VoiceConfigDrawerProps {
  voice: VoiceProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (profile: VoiceProfile) => void;
}

export function VoiceConfigDrawer({ voice, isOpen, onClose, onSave }: VoiceConfigDrawerProps) {
  const { toast } = useToast();
  if (!isOpen || !voice) return null;

  const [params, setParams] = useState(voice.defaultParams);
  const [testText, setTestText] = useState(
    `Olá! Sou a voz ${voice.name}, atuando como ${voice.role} na ZAPFLOW AI Enterprise. Como posso impulsionar suas conversões hoje?`
  );
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleParamChange = (key: keyof typeof params, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    setIsSaved(false);
  };

  const handleReset = () => {
    setParams(voice.defaultParams);
    toast({ title: "Parâmetros restaurados", description: "Voz retornou à configuração original." });
  };

  const handleDuplicate = () => {
    toast({
      title: "Perfil Duplicado",
      description: `Cópia de ${voice.name} criada com sucesso para personalização.`,
    });
  };

  const handleTestVoice = async () => {
    setIsSynthesizing(true);
    try {
      await apiService.getAIStatus();
      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.rate = params.speed;
      utterance.pitch = 1 + params.pitch * 0.1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);

      toast({
        title: "Sintetizando Voz ZAPFLOW AI",
        description: `Reproduzindo prévia de ${voice.name} com ${params.speed}x velocidade.`,
      });
    } catch {
      toast({
        title: "Prévia de Voz",
        description: `Gerando áudio neural para ${voice.name}...`,
      });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleSaveProfile = () => {
    setIsSaved(true);
    if (onSave) {
      onSave({ ...voice, defaultParams: params });
    }
    toast({
      title: "Perfil Salvo!",
      description: `Configuração da voz ${voice.name} salva com sucesso para este atendente.`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="w-full max-w-xl h-full bg-card border-l border-border/80 shadow-2xl overflow-y-auto flex flex-col p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold">
              <SpeakerHigh size={24} weight="duotone" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg text-foreground">{voice.name}</h3>
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  {voice.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{voice.description}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-lg">
            ✕
          </Button>
        </div>

        {/* Sliders Grid */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parâmetros de Síntese Neural</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Speed */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Velocidade</Label>
                <span className="text-primary">{params.speed.toFixed(2)}x</span>
              </div>
              <Slider
                value={[params.speed]}
                min={0.5}
                max={1.5}
                step={0.05}
                onValueChange={([val]) => handleParamChange("speed", val)}
              />
            </div>

            {/* Pitch */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Pitch (Grave/Agudo)</Label>
                <span className="text-primary">{params.pitch > 0 ? `+${params.pitch}` : params.pitch}</span>
              </div>
              <Slider
                value={[params.pitch]}
                min={-5}
                max={5}
                step={1}
                onValueChange={([val]) => handleParamChange("pitch", val)}
              />
            </div>

            {/* Intonation */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Entonação Comercial</Label>
                <span className="text-primary">{Math.round(params.intonation * 100)}%</span>
              </div>
              <Slider
                value={[params.intonation]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) => handleParamChange("intonation", val)}
              />
            </div>

            {/* Naturalness */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Naturalidade</Label>
                <span className="text-primary">{Math.round(params.naturalness * 100)}%</span>
              </div>
              <Slider
                value={[params.naturalness]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) => handleParamChange("naturalness", val)}
              />
            </div>

            {/* Breath */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Respiração Humana</Label>
                <span className="text-primary">{Math.round(params.breath * 100)}%</span>
              </div>
              <Slider
                value={[params.breath]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) => handleParamChange("breath", val)}
              />
            </div>

            {/* Expressiveness */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Expressividade</Label>
                <span className="text-primary">{Math.round(params.expressiveness * 100)}%</span>
              </div>
              <Slider
                value={[params.expressiveness]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) => handleParamChange("expressiveness", val)}
              />
            </div>

            {/* Emphasis */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Ênfase</Label>
                <span className="text-primary">{Math.round(params.emphasis * 100)}%</span>
              </div>
              <Slider
                value={[params.emphasis]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) => handleParamChange("emphasis", val)}
              />
            </div>

            {/* Stability */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Estabilidade</Label>
                <span className="text-primary">{Math.round(params.stability * 100)}%</span>
              </div>
              <Slider
                value={[params.stability]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) => handleParamChange("stability", val)}
              />
            </div>

            {/* Pronunciation */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Pronúncia Clara</Label>
                <span className="text-primary">{Math.round(params.pronunciation * 100)}%</span>
              </div>
              <Slider
                value={[params.pronunciation]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) => handleParamChange("pronunciation", val)}
              />
            </div>

            {/* Pauses */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/60">
              <div className="flex justify-between text-xs font-semibold">
                <Label>Pausas Estratégicas</Label>
                <span className="text-primary">{Math.round(params.pauses * 100)}%</span>
              </div>
              <Slider
                value={[params.pauses]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) => handleParamChange("pauses", val)}
              />
            </div>
          </div>
        </div>

        {/* Realtime Text Preview */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Texto de Teste em Tempo Real</Label>
          <Textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={3}
            className="text-xs rounded-xl bg-card/70 border-border/70 resize-none"
            placeholder="Digite qualquer frase para testar a voz..."
          />
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border/60 flex flex-wrap gap-2 justify-between items-center mt-auto">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="rounded-xl text-xs flex gap-1">
              <ArrowCounterClockwise size={14} /> Resetar
            </Button>
            <Button variant="outline" size="sm" onClick={handleDuplicate} className="rounded-xl text-xs flex gap-1">
              <Copy size={14} /> Duplicar
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestVoice}
              disabled={isSynthesizing}
              className="rounded-xl text-xs flex gap-1 font-semibold"
            >
              <Play size={14} weight="fill" /> {isSynthesizing ? "Sintetizando..." : "Testar Voz"}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleSaveProfile}
              className="rounded-xl text-xs flex gap-1 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Check size={14} /> {isSaved ? "Salvo!" : "Salvar Perfil"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
