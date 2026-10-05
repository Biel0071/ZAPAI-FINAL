import React, { useState, useRef, useEffect } from "react";
import {
  Eye,
  Shirt,
  Headphones,
  Image as ImageIcon,
  Sparkles,
  Check,
  Save,
  Palette,
  User,
  Sliders,
  Store,
  Layers,
  X,
  RotateCcw,
  Activity,
  AlertCircle,
  Brain,
  Clock,
  Send,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/state/hooks/use-toast";
import { AttendantAvatar } from "./AttendantAvatar";
import { cn } from "@/core/lib/utils";

export interface AttendantConfig {
  hairColor?: string;
  hairStyle?: string;
  clothingColor?: string;
  clothingStyle?: string;
  accessories?: string[];
  scene?: string;
  gender?: "female" | "male";
  skinTone?: string;
  avatarUrl?: string;
}

export type AgentRuntimeState =
  | "offline"
  | "idle"
  | "online"
  | "thinking"
  | "working"
  | "responding"
  | "learning"
  | "waiting"
  | "success"
  | "error";

export interface AICharacterViewerProps {
  agentName?: string;
  agentRole?: string;
  storeName?: string;
  themeColor?: string;
  isOnline: boolean;
  onToggleOnline?: (online: boolean) => void;
  avatarUrl?: string;
  config?: AttendantConfig;
  onSaveConfig?: (newConfig: AttendantConfig, newName?: string, newRole?: string) => Promise<void> | void;
  agentMode?: "camila" | "zaibot";
  onToggleMode?: (mode: "camila" | "zaibot") => void;
  runtimeState?: AgentRuntimeState;
  onRuntimeStateChange?: (state: AgentRuntimeState) => void;
}

export const ATTENDANT_PRESETS = [
  {
    id: "camila",
    name: "Camila",
    role: "Especialista em Vendas & Fechamento",
    gender: "female" as const,
    skinTone: "#e2b07e",
    hairStyle: "ponytail",
    hairColor: "#4a2c11",
    clothingStyle: "uniforme_loja",
    accessories: ["headset", "cracha"],
    scene: "escritorio_zai",
    badge: "Vendas Consultivas"
  },
  {
    id: "marcos",
    name: "Marcos",
    role: "Consultor Técnico em Obras & Construção",
    gender: "male" as const,
    skinTone: "#b97a48",
    hairStyle: "short_fade",
    hairColor: "#1e293b",
    clothingStyle: "polo_comercial",
    accessories: ["cracha", "oculos"],
    scene: "balcao_loja",
    badge: "Especialista Obras"
  },
  {
    id: "beatriz",
    name: "Beatriz",
    role: "Atendimento SAC, Dúvidas & Pós-Venda",
    gender: "female" as const,
    skinTone: "#7c4627",
    hairStyle: "afro_puff",
    hairColor: "#1e293b",
    clothingStyle: "social_executivo",
    accessories: ["headset", "cracha"],
    scene: "showroom",
    badge: "SAC Ágil"
  },
  {
    id: "gabriel",
    name: "Gabriel",
    role: "Orçamentista & Cálculo de Frete",
    gender: "male" as const,
    skinTone: "#fcd34d",
    hairStyle: "buzz_cut",
    hairColor: "#4a2c11",
    clothingStyle: "avental_balcao",
    accessories: ["cracha"],
    scene: "balcao_loja",
    badge: "Orçamentos & Balcão"
  },
  {
    id: "sofia",
    name: "Sofia",
    role: "Executiva Comercial & Contas B2B",
    gender: "female" as const,
    skinTone: "#f8d9b6",
    hairStyle: "wavy_long",
    hairColor: "#d97706",
    clothingStyle: "social_executivo",
    accessories: ["oculos", "cracha"],
    scene: "corporate",
    badge: "Vendas B2B"
  },
  {
    id: "lucas",
    name: "Lucas",
    role: "Vendedor Proativo & Catálogo",
    gender: "male" as const,
    skinTone: "#e2b07e",
    hairStyle: "undercut",
    hairColor: "#4a2c11",
    clothingStyle: "uniforme_loja",
    accessories: ["headset"],
    scene: "escritorio_zai",
    badge: "Catálogo & Vendas"
  },
];

export const AICharacterViewer: React.FC<AICharacterViewerProps> = ({
  agentName = "Camila",
  agentRole = "Assistente de Vendas",
  storeName = "Depósito Vista Alegre",
  themeColor = "#10b981",
  isOnline,
  onToggleOnline,
  avatarUrl,
  config,
  onSaveConfig,
  agentMode,
  onToggleMode,
  runtimeState,
  onRuntimeStateChange,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"visual" | "roupas" | "acessorios" | "cenario" | "animacoes">("visual");
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Runtime State Machine
  const [internalState, setInternalState] = useState<AgentRuntimeState | null>(null);

  useEffect(() => {
    setInternalState(null);
  }, [isOnline, runtimeState]);

  const effectiveState: AgentRuntimeState = internalState ?? (
    runtimeState ?? (isOnline ? "working" : "offline")
  );

  const handleSetPreviewState = (st: AgentRuntimeState) => {
    setInternalState(st);
    onRuntimeStateChange?.(st);
  };

  // Editable customization state
  const [customName, setCustomName] = useState<string>(agentName);
  const [customRole, setCustomRole] = useState<string>(agentRole);
  const [hairColor, setHairColor] = useState<string>(config?.hairColor || "#4a2c11");
  const [hairStyle, setHairStyle] = useState<string>(config?.hairStyle || "ponytail");
  const [clothingColor, setClothingColor] = useState<string>(config?.clothingColor || themeColor || "#10b981");
  const [clothingStyle, setClothingStyle] = useState<string>(config?.clothingStyle || "uniforme_loja");
  const [accessories, setAccessories] = useState<string[]>(config?.accessories || ["headset", "cracha"]);
  const [scene, setScene] = useState<string>(config?.scene || "escritorio_zai");
  const [gender, setGender] = useState<"female" | "male">(config?.gender || "female");
  const [skinTone, setSkinTone] = useState<string>(config?.skinTone || "#fcd34d");

  // Sync with prop changes
  useEffect(() => {
    setCustomName(agentName);
    setCustomRole(agentRole);
  }, [agentName, agentRole]);

  useEffect(() => {
    if (config) {
      if (config.hairColor) setHairColor(config.hairColor);
      if (config.hairStyle) setHairStyle(config.hairStyle);
      if (config.clothingColor) setClothingColor(config.clothingColor);
      if (config.clothingStyle) setClothingStyle(config.clothingStyle);
      if (config.accessories) setAccessories(config.accessories);
      if (config.scene) setScene(config.scene);
      if (config.gender) setGender(config.gender);
      if (config.skinTone) setSkinTone(config.skinTone);
    }
  }, [config]);

  const applyPreset = (preset: typeof ATTENDANT_PRESETS[0]) => {
    setCustomName(preset.name);
    setCustomRole(preset.role);
    setGender(preset.gender);
    setSkinTone(preset.skinTone);
    setHairStyle(preset.hairStyle);
    setHairColor(preset.hairColor);
    setClothingStyle(preset.clothingStyle);
    setAccessories(preset.accessories);
    setScene(preset.scene);
    toast({
      title: `Preset Selecionado: ${preset.name}`,
      description: `Estilo ${preset.badge} configurado. Clique em Salvar para vincular.`,
    });
  };

  const handleTabClick = (tab: "visual" | "roupas" | "acessorios" | "cenario" | "animacoes") => {
    setActiveTab(tab);
    setShowConfigPanel(true);
  };

  const toggleAccessory = (acc: string) => {
    setAccessories((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updatedConfig: AttendantConfig = {
        hairColor,
        hairStyle,
        clothingColor,
        clothingStyle,
        accessories,
        scene,
        gender,
        skinTone,
      };

      if (onSaveConfig) {
        await onSaveConfig(updatedConfig, customName, customRole);
      }
      toast({
        title: "Atendente Salvo",
        description: `Visual do atendente ${customName} atualizado para ${storeName}!`,
      });
      setShowConfigPanel(false);
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Não foi possível salvar o visual do atendente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Color options
  const skinTones = [
    { name: "Pêssego / Claro", hex: "#fcd34d" },
    { name: "Trigo / Moreno Claro", hex: "#e2b07e" },
    { name: "Canela / Moreno", hex: "#b97a48" },
    { name: "Chocolate / Negro", hex: "#7c4627" },
    { name: "Ébano / Negro Escuro", hex: "#522b15" },
  ];

  const hairColors = [
    { name: "Castanho Escuro", hex: "#4a2c11" },
    { name: "Preto Natural", hex: "#1e293b" },
    { name: "Loiro Dourado", hex: "#d97706" },
    { name: "Ruivo Acobreado", hex: "#b91c1c" },
    { name: "Grisalho / Platinado", hex: "#94a3b8" },
    { name: "Azul Cyber", hex: "#06b6d4" },
  ];

  const uniformColors = [
    { name: "Cor da Loja", hex: themeColor || "#10b981" },
    { name: "Verde Esmeralda", hex: "#10b981" },
    { name: "Azul Corporativo", hex: "#2563eb" },
    { name: "Roxo Tech", hex: "#7c3aed" },
    { name: "Laranja Comercial", hex: "#ea580c" },
    { name: "Vermelho Rubi", hex: "#dc2626" },
    { name: "Preto Executivo", hex: "#0f172a" },
  ];

  const [currentMode, setCurrentMode] = useState<"camila" | "zaibot">(
    agentMode || (agentName?.toLowerCase().includes("zaibot") ? "zaibot" : "camila")
  );

  useEffect(() => {
    if (agentMode) {
      setCurrentMode(agentMode);
    } else if (agentName?.toLowerCase().includes("zaibot")) {
      setCurrentMode("zaibot");
    } else {
      setCurrentMode("camila");
    }
  }, [agentMode, agentName]);

  const handleModeChange = (newMode: "camila" | "zaibot") => {
    setCurrentMode(newMode);
    onToggleMode?.(newMode);
  };

  const getAvatarForMode = () => {
    if (currentMode === "zaibot") return "/assets/mascot/zaibot_avatar.png";
    if (avatarUrl && !avatarUrl.includes("/assets/mascot/")) return avatarUrl;
    const n = (customName || agentName || "").toLowerCase();
    if (n.includes("joao") || n.includes("joão")) return "/assets/evolution/joao_avatar.png";
    if (n.includes("marina")) return "/assets/evolution/marina_avatar.png";
    if (n.includes("carlos")) return "/assets/evolution/carlos_avatar.png";
    if (n.includes("ana")) return "/assets/evolution/ana_avatar.png";
    return "/assets/evolution/camila_avatar.png";
  };

  // State visuals mapping
  const getZaibotImage = () => {
    switch (effectiveState) {
      case "working":
      case "online":
      case "responding":
        return "/assets/mascot/mascot_laptop_working.png";
      case "thinking":
      case "learning":
        return "/assets/mascot/mascot_mobile.png";
      case "success":
        return "/assets/mascot/mascot_celebrating.png";
      case "offline":
      case "idle":
      case "waiting":
      case "error":
      default:
        return "/assets/mascot/mascot_standing_thumbsup.png";
    }
  };

  const getCamilaImage = () => {
    switch (effectiveState) {
      case "offline":
      case "idle":
      case "waiting":
        return "/assets/evolution/habbo_standing_box.png";
      case "working":
      case "online":
      case "thinking":
      case "responding":
      case "learning":
      case "success":
      case "error":
      default:
        return "/assets/evolution/habbo_office_working.png";
    }
  };

  const getStateConfig = () => {
    switch (effectiveState) {
      case "working":
        return {
          label: "WORKING",
          desc: currentMode === "zaibot" ? "Trabalhando no Computador" : "Atendendo no WhatsApp",
          color: "bg-emerald-500",
          textColor: "text-emerald-400",
          border: "border-emerald-500/50",
          pulse: true,
        };
      case "thinking":
        return {
          label: "THINKING",
          desc: "Processando Raciocínio Neural...",
          color: "bg-cyan-400",
          textColor: "text-cyan-400",
          border: "border-cyan-500/50",
          pulse: true,
        };
      case "responding":
        return {
          label: "RESPONDING",
          desc: "Enviando Resposta ao Cliente...",
          color: "bg-emerald-400",
          textColor: "text-emerald-300",
          border: "border-emerald-400/50",
          pulse: true,
        };
      case "learning":
        return {
          label: "LEARNING",
          desc: "Absorvendo Novo Padrão...",
          color: "bg-purple-400",
          textColor: "text-purple-300",
          border: "border-purple-500/50",
          pulse: true,
        };
      case "success":
        return {
          label: "SUCCESS",
          desc: "Tarefa Concluída com Sucesso!",
          color: "bg-emerald-400",
          textColor: "text-emerald-300",
          border: "border-emerald-500/50",
          pulse: false,
        };
      case "waiting":
        return {
          label: "WAITING",
          desc: "Aguardando Retorno do Lead",
          color: "bg-amber-400",
          textColor: "text-amber-400",
          border: "border-amber-500/50",
          pulse: true,
        };
      case "error":
        return {
          label: "ERROR",
          desc: "Atenção: Oscilação ou Erro",
          color: "bg-red-500",
          textColor: "text-red-400",
          border: "border-red-500/50",
          pulse: true,
        };
      case "idle":
        return {
          label: "IDLE",
          desc: "Parado (Pronto para Atender)",
          color: "bg-emerald-500",
          textColor: "text-emerald-400",
          border: "border-emerald-500/30",
          pulse: false,
        };
      case "offline":
      default:
        return {
          label: "OFFLINE",
          desc: "Desativado / Fora de Expediente",
          color: "bg-slate-500",
          textColor: "text-slate-400",
          border: "border-slate-500/30",
          pulse: false,
        };
    }
  };

  const stateCfg = getStateConfig();

  return (
    <article className="relative w-full h-[370px] bg-[#0c121d] rounded-2xl border border-white/10 shadow-2xl overflow-hidden select-none">
      <div className="relative w-full h-full">
        {/* TOP CENTER AGENT MODE SWITCHER */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center p-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 shadow-lg">
          <button
            type="button"
            onClick={() => handleModeChange("camila")}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer",
              currentMode === "camila"
                ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                : "text-slate-300 hover:text-white"
            )}
          >
            {customName || "Camila"} (Humano)
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("zaibot")}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer",
              currentMode === "zaibot"
                ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                : "text-slate-300 hover:text-white"
            )}
          >
            ZAIBOT (Mascote 3D)
          </button>
        </div>

        {/* INTERACTIVE ONLINE / OFFLINE TOGGLE BUTTON */}
        <button
          type="button"
          onClick={() => {
            const next = effectiveState === "offline";
            onToggleOnline?.(next);
            handleSetPreviewState(next ? "working" : "offline");
          }}
          title={effectiveState !== "offline" ? "Agente ativo: clique para pausar" : "Agente pausado: clique para ativar"}
          aria-label={effectiveState !== "offline" ? "Pausar agente" : "Ativar agente"}
          className={cn(
            "absolute top-2.5 right-2.5 z-30 h-7 px-3 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[9px] font-bold border backdrop-blur-md",
            effectiveState !== "offline"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
              : "bg-black/60 text-slate-300 border-white/20 hover:bg-black/80"
          )}
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              effectiveState !== "offline" ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" : "bg-slate-400"
            )}
          />
          <span>{effectiveState !== "offline" ? "ONLINE" : "OFFLINE"}</span>
        </button>

        {/* AGENT BADGE (TOP LEFT) */}
        <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-2 bg-[#090e17]/90 backdrop-blur-md border border-white/10 px-2.5 py-1.5 rounded-xl shadow-lg max-w-[45%]">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-500/50 flex-shrink-0 bg-black">
            <img
              src={getAvatarForMode()}
              alt={currentMode === "zaibot" ? "ZAIBOT" : customName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-white flex items-center gap-1 leading-tight truncate">
              {currentMode === "zaibot" ? "ZAIBOT" : customName}
            </div>
            <div className="text-[9px] text-slate-400 font-medium leading-tight truncate">
              {currentMode === "zaibot" ? "Assistente Operacional ZAI" : customRole}
            </div>
          </div>
        </div>

        {/* SCENE DISPLAY */}
        {currentMode === "zaibot" ? (
          /* HIGH-TECH 3D ROBOT MASCOT LIVING LAB */
          <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-[#050912] via-[#0b1424] to-[#04070d]">
            {/* Tech grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b9810d_1px,transparent_1px),linear-gradient(to_bottom,#10b9810d_1px,transparent_1px)] bg-[size:28px_28px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Holographic rings for THINKING or LEARNING */}
            {(effectiveState === "thinking" || effectiveState === "learning") && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-72 rounded-full border border-cyan-400/30 animate-spin opacity-40 [animation-duration:8s]" />
                <div className="w-56 h-56 rounded-full border border-dashed border-emerald-400/40 animate-spin opacity-50 [animation-duration:12s]" />
              </div>
            )}

            {/* Floating Speech bubble for RESPONDING */}
            {effectiveState === "responding" && (
              <div className="absolute top-14 z-20 animate-bounce bg-emerald-500 text-black px-3 py-1 rounded-full text-[10px] font-black shadow-lg">
                💬 Respondendo ao cliente no WhatsApp...
              </div>
            )}

            {/* Mascot Image based on real runtime state */}
            <div
              onClick={() => {
                toast({
                  title: "ZAIBOT Online",
                  description: "Assistente Operacional ZAI monitorando processos e atendimentos.",
                });
              }}
              className="relative z-10 flex flex-col items-center justify-center h-full max-h-[310px] pt-4 cursor-pointer group"
            >
              <img
                src={getZaibotImage()}
                alt="ZAIBOT Mascote"
                className={cn(
                  "h-full max-h-[280px] object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.85)] transition-all duration-300 group-hover:scale-105",
                  effectiveState === "offline"
                    ? "brightness-[0.55] saturate-[0.3]"
                    : effectiveState === "idle"
                    ? "animate-pulse [animation-duration:3s]"
                    : "filter-none brightness-105"
                )}
              />
            </div>

            {/* Interactive Room Hotspots */}
            <div
              title="Terminal ZAI Neural — Executando automações"
              onClick={() => toast({ title: "Terminal ZAI Neural", description: "Processador operacional em tempo real ativo." })}
              className="absolute top-[35%] left-[18%] h-10 w-10 rounded-full cursor-pointer border border-cyan-400/30 bg-cyan-400/10 hover:bg-cyan-400/30 transition-all flex items-center justify-center"
            >
              <Brain className="h-4 w-4 text-cyan-400 animate-pulse" />
            </div>

            <div
              title="Monitor de Diagnóstico & Latência"
              onClick={() => toast({ title: "Diagnóstico ZAI", description: "Latência média de 45ms. Conexões operacionais." })}
              className="absolute top-[35%] right-[18%] h-10 w-10 rounded-full cursor-pointer border border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/30 transition-all flex items-center justify-center"
            >
              <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
            </div>

            {/* Bottom Left Status Beacon */}
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-[#090e17]/90 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 rounded-xl shadow-lg">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  stateCfg.color,
                  stateCfg.pulse && "animate-pulse shadow-[0_0_8px_#10b981]"
                )}
              />
              <span className="text-[10px] font-bold text-foreground">
                ZAIBOT • {stateCfg.desc}
              </span>
              <Badge className={cn("text-[9px] font-mono py-0 h-4 border", stateCfg.border, stateCfg.textColor, "bg-black/50")}>
                {stateCfg.label}
              </Badge>
            </div>
          </div>
        ) : (
          /* CAMILA & DIGITAL EMPLOYEES HUMAN CHARACTER STUDIO */
          <div className="relative w-full h-full flex items-stretch bg-[#080d16] overflow-hidden">
            {/* 1. LEFT VERTICAL TOOLBAR (Visual, Roupas, Acessórios, Cenário, Animações) */}
            <div className="z-20 flex flex-col justify-center gap-1.5 p-2 bg-[#060a12]/90 border-r border-white/10 shrink-0">
              {[
                { id: "visual" as const, label: "Visual", icon: User },
                { id: "roupas" as const, label: "Roupas", icon: Shirt },
                { id: "acessorios" as const, label: "Acessórios", icon: Headphones },
                { id: "cenario" as const, label: "Cenário", icon: Store },
                { id: "animacoes" as const, label: "Animações", icon: Sparkles },
              ].map((btn) => {
                const Icon = btn.icon;
                const isActive = activeTab === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => handleTabClick(btn.id)}
                    className={cn(
                      "w-13 sm:w-14 h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer border",
                      isActive
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                        : "bg-black/30 border-white/5 text-slate-400 hover:text-white hover:border-white/20"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-[8px] sm:text-[9px] font-semibold">{btn.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 2. CENTER: SINGLE LIVING CHARACTER WORKSPACE (STATE-DRIVEN, NO DUPLICATE) */}
            <div className="relative flex-1 h-full overflow-hidden flex items-center justify-center bg-[#070b13]">
              {(effectiveState === "working" ||
                effectiveState === "online" ||
                effectiveState === "responding" ||
                effectiveState === "thinking" ||
                effectiveState === "learning" ||
                effectiveState === "success") ? (
                /* ACTIVE STATE: CHARACTER WORKING AT PC ("no pc trabalhando") */
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <img
                    src="/assets/evolution/camila_office_active.png"
                    alt={`${customName} trabalhando no escritório`}
                    className="w-full h-full object-cover transition-all duration-500 brightness-100"
                    style={{ imageRendering: "pixelated" }}
                  />

                  {/* Tint overlay based on store theme */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-10 mix-blend-color transition-colors duration-500"
                    style={{ backgroundColor: clothingColor }}
                  />

                  {/* Speech bubble when responding */}
                  {effectiveState === "responding" && (
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 animate-bounce bg-emerald-500 text-black px-3.5 py-1 rounded-full text-[10px] font-black shadow-lg">
                      💬 {customName} respondendo ao cliente no WhatsApp...
                    </div>
                  )}

                  {/* Interactive Room Hotspots */}
                  <div
                    title="Terminal WhatsApp Ativo"
                    onClick={() =>
                      toast({
                        title: "Terminal WhatsApp",
                        description: `Conectado à fila de atendimento da loja. ${customName} ativa no WhatsApp.`,
                      })
                    }
                    className="absolute top-[48%] left-[45%] h-8 w-12 rounded cursor-pointer border border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/25 transition-colors"
                  />
                  <div
                    title="Logotipo Oficial ZAI Neon"
                    onClick={() =>
                      toast({
                        title: "ZAI CRM",
                        description: "Módulo de Atendimento Inteligente ZAI.",
                      })
                    }
                    className="absolute top-[32%] right-[32%] h-12 w-12 rounded cursor-pointer border border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors"
                  />

                  {/* Bottom pill: Atendendo agora */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                    <div className="px-3.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md flex items-center gap-2 shadow-lg bg-[#090e17]/90 text-emerald-400 border-emerald-500/40">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          stateCfg.color,
                          stateCfg.pulse && "animate-pulse shadow-[0_0_8px_#10b981]"
                        )}
                      />
                      <span>{customName} • Atendendo no computador (Online)</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* OFFLINE / IDLE STATE: CHARACTER STANDING WAITING ("em pé esperando caso sem fazer nada") */
                <div
                  className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#060a12] via-[#09101d] to-[#04070e] cursor-pointer group"
                  onClick={() => onToggleOnline?.(true)}
                  title="Clique para ativar o expediente de atendimento"
                >
                  {/* Tech Grid Background */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff07_1px,transparent_1px),linear-gradient(to_bottom,#ffffff07_1px,transparent_1px)] bg-[size:24px_24px]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

                  {/* Floor Pedestal & Ambient Glow */}
                  <div className="absolute bottom-10 w-44 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 blur-xs shadow-[0_0_30px_rgba(16,185,129,0.3)]" />

                  {/* Character Standing Prominently (Boneco Maior - Full Figure) */}
                  <div className="relative z-10 flex flex-col items-center justify-center h-full max-h-[300px] pt-2">
                    <img
                      src="/assets/evolution/camila_standing_offline.png"
                      alt={`${customName} em pé aguardando`}
                      className={cn(
                        "h-full max-h-[250px] w-auto object-contain transition-all duration-300 drop-shadow-[0_14px_28px_rgba(0,0,0,0.9)] group-hover:scale-105",
                        effectiveState === "idle"
                          ? "animate-pulse [animation-duration:3s] brightness-105"
                          : "brightness-95 contrast-105"
                      )}
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>

                  {/* Bottom pill: Em pé / Parada esperando sem fazer nada */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                    <div className="px-3.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md flex items-center gap-2 shadow-lg bg-black/85 text-slate-300 border-white/15 group-hover:border-emerald-500/50 group-hover:text-emerald-300 transition-colors">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          effectiveState === "idle" ? "bg-amber-400 animate-pulse" : "bg-slate-400"
                        )}
                      />
                      <span>
                        {effectiveState === "idle"
                          ? `${customName} • Em pé (Aguardando cliente)`
                          : `${customName} • Pausada (Em pé sem fazer nada) — Clique para Ativar`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATE MACHINE PREVIEW CONTROLS (BOTTOM CENTER / RIGHT) */}
        <div className="absolute top-11 right-2.5 z-20 flex items-center gap-1 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/10 text-[9px]">
          {(["offline", "idle", "working", "thinking", "responding", "learning", "success", "error"] as AgentRuntimeState[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleSetPreviewState(st)}
              className={cn(
                "px-1.5 py-0.5 rounded uppercase font-mono font-bold transition-all cursor-pointer",
                effectiveState === st
                  ? "bg-emerald-500 text-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/10"
              )}
            >
              {st}
            </button>
          ))}
        </div>

        {/* CUSTOMIZE STYLE BUTTON (BOTTOM RIGHT) */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleTabClick("visual")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#090e17]/90 hover:bg-[#090e17] text-white border border-white/20 hover:border-emerald-400/80 shadow-lg backdrop-blur-md text-[11px] font-semibold transition-all group cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
            <span>Personalizar Estilo</span>
          </button>
        </div>
      </div>

      {/* MODAL (DIALOG) CUSTOMIZATION DRAWER */}
      <Dialog open={showConfigPanel} onOpenChange={setShowConfigPanel}>
        <DialogContent className="sm:max-w-[425px] bg-[#0d131f]/95 backdrop-blur-xl border border-white/10 text-white shadow-2xl p-4 z-50">
          <DialogHeader className="border-b border-white/10 pb-3 mb-4">
            <DialogTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Sliders className="w-4 h-4" /> Personalizar Atendente
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto space-y-4 pr-1 max-h-[70vh]">
            
            {/* TAB SELECTOR */}
            <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("visual")}
                className={`py-1 rounded-lg transition-all ${
                  activeTab === "visual" ? "bg-emerald-500 text-black font-bold" : "text-slate-400"
                }`}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("roupas")}
                className={`py-1 rounded-lg transition-all ${
                  activeTab === "roupas" ? "bg-emerald-500 text-black font-bold" : "text-slate-400"
                }`}
              >
                Roupas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("acessorios")}
                className={`py-1 rounded-lg transition-all ${
                  activeTab === "acessorios" ? "bg-emerald-500 text-black font-bold" : "text-slate-400"
                }`}
              >
                Acessórios
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("animacoes")}
                className={`py-1 rounded-lg transition-all ${
                  activeTab === "animacoes" ? "bg-emerald-500 text-black font-bold" : "text-slate-400"
                }`}
              >
                Presets
              </button>
            </div>

            {/* TAB 1: VISUAL (Nome, Função, Pele, Cabelo) */}
            {activeTab === "visual" && (
              <div className="space-y-3 animate-fade-in text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                    Nome do Atendente
                  </label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-8 text-xs bg-black/40 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                    Cargo / Especialidade
                  </label>
                  <Input
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    className="h-8 text-xs bg-black/40 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1.5">
                    Tom de Pele
                  </label>
                  <div className="flex items-center gap-2">
                    {skinTones.map((st) => (
                      <button
                        key={st.hex}
                        type="button"
                        onClick={() => setSkinTone(st.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          skinTone === st.hex ? "border-emerald-400 scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: st.hex }}
                        title={st.name}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1.5">
                    Cor do Cabelo
                  </label>
                  <div className="flex items-center gap-2">
                    {hairColors.map((hc) => (
                      <button
                        key={hc.hex}
                        type="button"
                        onClick={() => setHairColor(hc.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          hairColor === hc.hex ? "border-emerald-400 scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: hc.hex }}
                        title={hc.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ROUPAS (Cores da Loja / Uniforme) */}
            {activeTab === "roupas" && (
              <div className="space-y-3 animate-fade-in text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1.5">
                    Cor Principal do Uniforme (Cor da Loja)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {uniformColors.map((uc) => (
                      <button
                        key={uc.hex}
                        type="button"
                        onClick={() => setClothingColor(uc.hex)}
                        className={`h-7 rounded-lg border flex items-center justify-center transition-all ${
                          clothingColor === uc.hex
                            ? "border-white scale-105 shadow-md"
                            : "border-white/10 hover:border-white/30"
                        }`}
                        style={{ backgroundColor: uc.hex }}
                        title={uc.name}
                      >
                        {clothingColor === uc.hex && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                    Estilo de Vestimenta
                  </label>
                  <select
                    value={clothingStyle}
                    onChange={(e) => setClothingStyle(e.target.value)}
                    className="w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-xs text-white"
                  >
                    <option value="uniforme_loja">Moletom ZAI & Uniforme Comercial</option>
                    <option value="polo_comercial">Camisa Polo Atendimento</option>
                    <option value="social_executivo">Social Corporativo</option>
                    <option value="avental_balcao">Avental Balcão & Depósito</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 3: ACESSÓRIOS */}
            {activeTab === "acessorios" && (
              <div className="space-y-2 animate-fade-in text-xs">
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Adereços do Atendente
                </label>
                {[
                  { id: "headset", label: "Headset Profissional de Vendas" },
                  { id: "cracha", label: "Crachá com Identidade da Loja" },
                  { id: "oculos", label: "Óculos de Grau / Comercial" },
                  { id: "gato", label: "Mascote Gatinho ZAI na Mesa" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleAccessory(item.id)}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                      accessories.includes(item.id)
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-black/30 border-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    {accessories.includes(item.id) && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}

            {/* TAB 4: PRESETS DE ATENDENTES PRONTOS */}
            {activeTab === "animacoes" && (
              <div className="space-y-2 animate-fade-in text-xs">
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Modelos Prontos por Especialidade
                </label>
                {ATTENDANT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`w-full p-2 rounded-xl border flex items-center justify-between transition-all ${
                      customName.toLowerCase() === p.name.toLowerCase()
                        ? "bg-emerald-500/20 border-emerald-400 text-white font-bold"
                        : "bg-black/30 border-white/5 text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="text-left">
                      <div className="text-xs font-semibold">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.badge}</div>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                      Aplicar
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SAVE BUTTON */}
          <div className="pt-3 border-t border-white/10 mt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-[0_4px_12px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Salvando..." : "Salvar Atendente na Loja"}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </article>
  );
};
