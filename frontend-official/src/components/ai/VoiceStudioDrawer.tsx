import React, { useState, useEffect } from "react";
import {
  X,
  Microphone,
  Play,
  Pause,
  Sliders,
  CheckCircle,
  ArrowClockwise,
  Copy,
  Sparkle,
  FloppyDisk,
  MusicNotes,
  Waveform,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { apiService } from "@/services/apiService";
import { notify } from "@/services/notifyService";

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

const OFFICIAL_VOICES: VoiceProfile[] = [
  {
    id: "zapflow-aurora",
    name: "ZAPFLOW Aurora",
    gender: "female",
    role: "Especialista Comercial",
    description: "Tom firme, elegante e consultivo. Alta persuasão para fechamentos B2B.",
    defaultParams: { speed: 1.0, pitch: 0, intonation: 85, naturalness: 95, breath: 40, expressiveness: 80, emphasis: 75, stability: 85, pronunciation: 95, pauses: 30 },
  },
  {
    id: "zapflow-luna",
    name: "ZAPFLOW Luna",
    gender: "female",
    role: "Jovem & Dinâmica",
    description: "Tom leve, moderno e enérgico. Excelente para varejo e engajamento rápido.",
    defaultParams: { speed: 1.1, pitch: 2, intonation: 90, naturalness: 90, breath: 50, expressiveness: 90, emphasis: 80, stability: 80, pronunciation: 90, pauses: 20 },
  },
  {
    id: "zapflow-sophia",
    name: "ZAPFLOW Sophia",
    gender: "female",
    role: "Executiva",
    description: "Tom formal, articulado e corporativo. Ideal para empresas de grande porte.",
    defaultParams: { speed: 0.95, pitch: -1, intonation: 80, naturalness: 98, breath: 30, expressiveness: 70, emphasis: 70, stability: 95, pronunciation: 98, pauses: 40 },
  },
  {
    id: "zapflow-maya",
    name: "ZAPFLOW Maya",
    gender: "female",
    role: "Acolhedora",
    description: "Tom empático, calmo e receptivo. Perfeito para pós-vendas e atendimento.",
    defaultParams: { speed: 0.95, pitch: 1, intonation: 85, naturalness: 96, breath: 60, expressiveness: 85, emphasis: 65, stability: 90, pronunciation: 95, pauses: 40 },
  },
  {
    id: "zapflow-orion",
    name: "ZAPFLOW Orion",
    gender: "male",
    role: "Consultor",
    description: "Tom equilibrado, seguro e didático. Alta confiabilidade comercial.",
    defaultParams: { speed: 1.0, pitch: 0, intonation: 85, naturalness: 95, breath: 40, expressiveness: 75, emphasis: 80, stability: 90, pronunciation: 95, pauses: 30 },
  },
  {
    id: "zapflow-atlas",
    name: "ZAPFLOW Atlas",
    gender: "male",
    role: "Executivo",
    description: "Tom grave, sério e de autoridade. Excelente para negociações corporativas.",
    defaultParams: { speed: 0.95, pitch: -3, intonation: 80, naturalness: 97, breath: 30, expressiveness: 70, emphasis: 85, stability: 95, pronunciation: 97, pauses: 40 },
  },
  {
    id: "zapflow-noah",
    name: "ZAPFLOW Noah",
    gender: "male",
    role: "Jovem",
    description: "Tom descontraído, amigável e conversacional. Ótimo para público jovem.",
    defaultParams: { speed: 1.05, pitch: 1, intonation: 90, naturalness: 92, breath: 50, expressiveness: 85, emphasis: 75, stability: 85, pronunciation: 92, pauses: 25 },
  },
  {
    id: "zapflow-titan",
    name: "ZAPFLOW Titan",
    gender: "male",
    role: "Premium",
    description: "Tom imponente, marcante e aveludado. Projetado para marcas de luxo e alto ticket.",
    defaultParams: { speed: 0.9, pitch: -4, intonation: 85, naturalness: 98, breath: 40, expressiveness: 80, emphasis: 90, stability: 98, pronunciation: 98, pauses: 50 },
  },
];

interface VoiceStudioDrawerProps {
  open: boolean;
  onClose: () => void;
  agentId?: string;
  currentVoiceId?: string;
  onSaveVoice?: (voiceId: string, params: any) => void;
}

export function VoiceStudioDrawer({ open, onClose, agentId, currentVoiceId, onSaveVoice }: VoiceStudioDrawerProps) {
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(() => {
    return OFFICIAL_VOICES.find((v) => v.id === currentVoiceId) || OFFICIAL_VOICES[0];
  });

  const [params, setParams] = useState({ ...selectedVoice.defaultParams });
  const [sampleText, setSampleText] = useState(
    `Olá! Eu sou a voz ${selectedVoice.name}, especialista ${selectedVoice.role}. Como posso ajudar suas vendas hoje no WhatsApp?`
  );
  const [testingAudio, setTestingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    const voice = OFFICIAL_VOICES.find((v) => v.id === currentVoiceId) || OFFICIAL_VOICES[0];
    setSelectedVoice(voice);
    setParams({ ...voice.defaultParams });
    setSampleText(
      `Olá! Eu sou a voz ${voice.name}, especialista ${voice.role}. Como posso ajudar suas vendas hoje no WhatsApp?`
    );
  }, [currentVoiceId]);

  const handleSelectVoice = (voice: VoiceProfile) => {
    setSelectedVoice(voice);
    setParams({ ...voice.defaultParams });
    setSampleText(
      `Olá! Eu sou a voz ${voice.name}, especialista ${voice.role}. Como posso ajudar suas vendas hoje no WhatsApp?`
    );
  };

  const handleTestVoice = async () => {
    setTestingAudio(true);
    try {
      notify.info(`Sintetizando preview da voz ${selectedVoice.name}...`);
      const res = await apiService.testVoiceSynthesis(selectedVoice.id, sampleText, params);
      if (res?.data) {
        setAudioUrl("synthetic-preview-active");
        notify.success("Preview de voz gerado com sucesso!");
      }
    } catch {
      notify.error("Falha ao sintetizar preview de voz.");
    } finally {
      setTestingAudio(false);
    }
  };

  const handleResetParams = () => {
    setParams({ ...selectedVoice.defaultParams });
    notify.info("Parâmetros vocais resetados para o padrão de fábrica.");
  };

  const handleSave = async () => {
    try {
      await apiService.saveVoiceProfile(agentId || "default", selectedVoice.id, params);
      if (onSaveVoice) {
        onSaveVoice(selectedVoice.id, params);
      }
      notify.success(`Perfil vocal ${selectedVoice.name} salvo com sucesso para o atendente!`);
      onClose();
    } catch {
      notify.error("Erro ao salvar perfil vocal.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="max-w-4xl border-border/80 bg-card/95 backdrop-blur-2xl rounded-3xl p-0 overflow-hidden shadow-2xl">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-card via-background to-card p-6 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Microphone className="h-5 w-5 animate-pulse" weight="fill" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">ZAPFLOW AI Voices Studio</h2>
              <p className="text-xs text-muted-foreground">Sintonia vocal fina e identidade das vozes neurais brasileiras</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
          {/* Voice Selector Grid (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Vozes Femininas (BR Neural)
              </span>
              <div className="grid grid-cols-1 gap-2">
                {OFFICIAL_VOICES.filter((v) => v.gender === "female").map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleSelectVoice(voice)}
                    className={`rounded-2xl border p-3 text-left transition-all flex items-center justify-between ${
                      selectedVoice.id === voice.id
                        ? "bg-primary/10 border-primary shadow-glow"
                        : "bg-background/40 border-border/60 hover:bg-card/75"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">{voice.name}</span>
                        <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
                          {voice.role}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{voice.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Vozes Masculinas (BR Neural)
              </span>
              <div className="grid grid-cols-1 gap-2">
                {OFFICIAL_VOICES.filter((v) => v.gender === "male").map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleSelectVoice(voice)}
                    className={`rounded-2xl border p-3 text-left transition-all flex items-center justify-between ${
                      selectedVoice.id === voice.id
                        ? "bg-primary/10 border-primary shadow-glow"
                        : "bg-background/40 border-border/60 hover:bg-card/75"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">{voice.name}</span>
                        <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
                          {voice.role}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{voice.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Voice Tuning Panel & Real-time Preview (7 Cols) */}
          <div className="lg:col-span-7 space-y-5 border-l border-border/40 pl-0 lg:pl-6">
            <Card className="rounded-2xl border-border/70 bg-card/60 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Ajustes de Sintonia Vocal — {selectedVoice.name}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg gap-1 text-muted-foreground hover:text-foreground" onClick={handleResetParams}>
                  <ArrowClockwise className="h-3 w-3" />
                  Resetar
                </Button>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Velocidade</span>
                    <strong className="text-foreground">{params.speed.toFixed(2)}x</strong>
                  </div>
                  <Slider value={[params.speed]} min={0.7} max={1.5} step={0.05} onValueChange={([v]) => setParams({ ...params, speed: v })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Pitch (Grave vs Agudo)</span>
                    <strong className="text-foreground">{params.pitch > 0 ? `+${params.pitch}` : params.pitch} semitões</strong>
                  </div>
                  <Slider value={[params.pitch]} min={-6} max={6} step={1} onValueChange={([v]) => setParams({ ...params, pitch: v })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Entonação Comercial</span>
                    <strong className="text-foreground">{params.intonation}%</strong>
                  </div>
                  <Slider value={[params.intonation]} min={50} max={100} step={5} onValueChange={([v]) => setParams({ ...params, intonation: v })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Naturalidade Neural</span>
                    <strong className="text-foreground">{params.naturalness}%</strong>
                  </div>
                  <Slider value={[params.naturalness]} min={50} max={100} step={5} onValueChange={([v]) => setParams({ ...params, naturalness: v })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Respiração Orgânica</span>
                    <strong className="text-foreground">{params.breath}%</strong>
                  </div>
                  <Slider value={[params.breath]} min={0} max={100} step={5} onValueChange={([v]) => setParams({ ...params, breath: v })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Expressividade &amp; Emoção</span>
                    <strong className="text-foreground">{params.expressiveness}%</strong>
                  </div>
                  <Slider value={[params.expressiveness]} min={30} max={100} step={5} onValueChange={([v]) => setParams({ ...params, expressiveness: v })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Estabilidade de Ritmo</span>
                    <strong className="text-foreground">{params.stability}%</strong>
                  </div>
                  <Slider value={[params.stability]} min={40} max={100} step={5} onValueChange={([v]) => setParams({ ...params, stability: v })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Pausas de Pontuação</span>
                    <strong className="text-foreground">{params.pauses} ms</strong>
                  </div>
                  <Slider value={[params.pauses]} min={10} max={100} step={5} onValueChange={([v]) => setParams({ ...params, pauses: v })} />
                </div>
              </div>
            </Card>

            {/* Test Sample Text Box */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Texto de Teste para Preview ao Vivo
              </label>
              <Textarea
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                rows={3}
                className="rounded-2xl bg-background/50 border-border/60 text-xs p-3"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                className="w-1/2 rounded-xl text-xs gap-2 border-primary/30 hover:bg-primary/10"
                onClick={() => void handleTestVoice()}
                disabled={testingAudio}
              >
                <Play className={`h-4 w-4 text-primary ${testingAudio ? "animate-pulse" : ""}`} />
                {testingAudio ? "Sintetizando..." : "Testar Voz ao Vivo"}
              </Button>

              <Button className="w-1/2 rounded-xl text-xs font-bold gap-2 shadow-glow" onClick={() => void handleSave()}>
                <FloppyDisk className="h-4 w-4" />
                Salvar Perfil Vocal
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
