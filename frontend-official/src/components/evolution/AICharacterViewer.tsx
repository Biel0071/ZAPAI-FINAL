import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Eye,
  Shirt,
  Headphones,
  Image as ImageIcon,
  Sparkles,
  RotateCcw,
  Check,
  Save,
  Palette,
  User,
  Sliders,
  Store,
  Layers,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AttendantAvatar } from "./AttendantAvatar";

export interface AttendantConfig {
  hairColor?: string;
  hairStyle?: string;
  clothingColor?: string;
  clothingStyle?: string;
  accessories?: string[];
  scene?: string;
  gender?: "female" | "male";
  skinTone?: string;
}

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
  avatarUrl = "/assets/evolution/camila_avatar.png",
  config,
  onSaveConfig
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"visual" | "roupas" | "acessorios" | "cenario" | "animacoes">("visual");
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

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
      title: `Preset: ${preset.name}`,
      description: `Estilo ${preset.badge} aplicado! Clique em Salvar para vincular à loja.`,
    });
  };

  // 3D Isometric Transform States
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse Handlers for 3D Drag & Rotate
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".zai-character-controls, .zai-config-drawer")) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };

    setRotation((prev) => ({
      x: Math.max(-25, Math.min(25, prev.x - dy * 0.3)),
      y: Math.max(-45, Math.min(45, prev.y + dx * 0.4)),
    }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Wheel Zoom Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((prev) => Math.max(0.8, Math.min(1.35, prev + delta)));
  };

  // Reset Camera on Double Click
  const handleDoubleClick = () => {
    setRotation({ x: 0, y: 0 });
    setZoom(1);
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
        description: `Visual do atendente ${customName} atualizado para a loja ${storeName}!`,
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

  const hairStylesList = [
    { id: "ponytail", name: "Rabo de Cavalo" },
    { id: "short_fade", name: "Curto Degradê" },
    { id: "wavy_long", name: "Longo Ondulado" },
    { id: "buzz_cut", name: "Raspado Militar" },
    { id: "afro_puff", name: "Afro Volumoso" },
    { id: "undercut", name: "Topete Moderno" },
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

  const scenes = [
    { id: "escritorio_zai", name: "Escritório Dark ZAI" },
    { id: "balcao_loja", name: "Balcão de Vendas da Loja" },
    { id: "showroom", name: "Showroom Moderno" },
    { id: "corporate", name: "Sala Corporativa VIP" },
  ];

  return (
    <article className={`zai-card zai-character-card ${!isOnline ? "is-offline" : ""}`}>
      <div
        className="zai-character-stage relative"
        ref={containerRef}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {/* CHARACTER STATUS OVERLAY */}
        <div className="zai-character-status">
          <AttendantAvatar
            name={customName}
            themeColor={clothingColor}
            config={{ hairColor, clothingColor, accessories, scene, gender, skinTone }}
            avatarUrl={avatarUrl}
            size="md"
          />
          <div>
            <div className="zai-character-status-name flex items-center gap-1.5">
              <span>{customName}</span>
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: isOnline ? clothingColor : "#596574" }}
              />
            </div>
            <div className="zai-character-status-role">{customRole} · {storeName}</div>
            <div className={isOnline ? "text-emerald-400 font-bold text-[10px]" : "zai-status-offline"}>
              {isOnline ? "● Atendendo Clientes" : "Desativada"}
            </div>
          </div>
        </div>

        {/* OFFLINE / ONLINE TOGGLE */}
        <button
          type="button"
          onClick={() => onToggleOnline?.(!isOnline)}
          className={`zai-offline-toggle ${!isOnline ? "active" : ""}`}
          title="Alternar estado de atendimento da assistente"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isOnline ? clothingColor : "#596574" }}
          />
          <span>{isOnline ? "Online" : "Offline"}</span>
        </button>

        {/* 3D CHARACTER VIEWER STAGE */}
        <div className="zai-character-viewer" onMouseDown={handleMouseDown}>
          <div
            className="zai-character-3d"
            style={{
              transform: `scale(${zoom}) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              transformStyle: "preserve-3d",
            }}
          >
            {isOnline ? (
              /* ESTADO ATIVO: Atendente no escritório com as cores e adereços da loja */
              <div className="relative flex flex-col items-center justify-center w-full h-full p-2 select-none">
                {/* Background ambient lighting in store theme color */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none transition-all duration-500"
                  style={{
                    background: `radial-gradient(circle at center, ${clothingColor} 0%, transparent 65%)`
                  }}
                />

                {/* If default Camila and default office scene, render the classic pixel art */}
                {customName.toLowerCase().includes("camila") && scene === "escritorio_zai" && hairColor === "#4a2c11" && gender === "female" ? (
                  <div className="relative flex items-center justify-center w-full h-full p-2 select-none">
                    <img
                      src="/assets/evolution/camila_office_active.png"
                      alt={`${customName} Atendendo no Escritório ZAI`}
                      className="zai-character-art h-[92%] object-contain"
                      draggable={false}
                    />
                  </div>
                ) : (
                  /* High-res Modular Pixel Art Stage for any Custom Store Attendant */
                  <div className="relative w-64 h-72 sm:w-72 sm:h-80 flex items-center justify-center animate-fade-in">
                    <svg
                      viewBox="0 0 100 110"
                      className="w-full h-full drop-shadow-[0_16px_24px_rgba(0,0,0,0.6)]"
                      style={{ shapeRendering: "crispEdges" }}
                    >
                      {/* Shadow on floor */}
                      <ellipse cx="50" cy="98" rx="38" ry="9" fill="rgba(0,0,0,0.45)" />

                      {/* Desk base */}
                      <polygon points="12,83 88,83 95,94 5,94" fill="#1e293b" />
                      <rect x="15" y="85" width="8" height="16" fill="#0f172a" />
                      <rect x="77" y="85" width="8" height="16" fill="#0f172a" />

                      {/* Monitors on desk */}
                      <rect x="22" y="58" width="24" height="18" fill="#0f172a" rx="1.5" />
                      <rect x="24" y="60" width="20" height="14" fill="#020617" />
                      <rect x="26" y="63" width="16" height="2" fill={clothingColor} />
                      <rect x="26" y="67" width="11" height="2" fill="#38bdf8" />
                      <rect x="33" y="76" width="2.5" height="8" fill="#334155" />

                      <rect x="54" y="58" width="24" height="18" fill="#0f172a" rx="1.5" />
                      <rect x="56" y="60" width="20" height="14" fill="#020617" />
                      <rect x="58" y="63" width="16" height="2" fill="#22c55e" />
                      <rect x="58" y="67" width="9" height="2" fill={clothingColor} />
                      <rect x="65" y="76" width="2.5" height="8" fill="#334155" />

                      {/* Keyboard & Mousepad */}
                      <rect x="41" y="85" width="18" height="5" fill="#334155" rx="1" />

                      {/* Mascote Gatinho ZAI na mesa */}
                      {accessories.includes("gato") && (
                        <g>
                          <ellipse cx="20" cy="84" rx="4" ry="3" fill="#f59e0b" />
                          <circle cx="20" cy="79" r="2.8" fill="#f59e0b" />
                          <polygon points="18,78 19,75 20,78" fill="#d97706" />
                          <polygon points="20,78 21,75 22,78" fill="#d97706" />
                          <circle cx="19" cy="79" r="0.6" fill="#0f172a" />
                          <circle cx="21" cy="79" r="0.6" fill="#0f172a" />
                          <path d="M 24 84 Q 26 81 25 79" stroke="#d97706" strokeWidth="1" fill="none" />
                        </g>
                      )}

                      {/* Chair Backrest */}
                      <rect x="39" y="30" width="22" height="30" fill="#090d16" rx="4" />
                      <rect x="41" y="32" width="18" height="26" fill="#1e293b" rx="2" />

                      {/* Torso / Uniform with Custom Store Color */}
                      <rect x="37" y="44" width="26" height="24" fill={clothingColor} rx="3" />
                      
                      {/* Collar / Tie / Style */}
                      {clothingStyle === "social_executivo" ? (
                        <>
                          <polygon points="45,44 50,53 55,44" fill="#ffffff" />
                          <rect x="49" y="48" width="2" height="12" fill={clothingColor} />
                        </>
                      ) : clothingStyle === "polo_comercial" ? (
                        <>
                          <polygon points="46,44 50,49 54,44" fill="#ffffff" />
                          <circle cx="50" cy="51" r="0.8" fill="#ffffff" />
                        </>
                      ) : (
                        <>
                          <polygon points="44,44 50,51 56,44" fill="#ffffff" />
                          <rect x="46" y="48" width="8" height="3.5" fill={clothingColor} />
                        </>
                      )}

                      {/* Store Crachá / Badge */}
                      {accessories.includes("cracha") && (
                        <g>
                          <rect x="54" y="52" width="6.5" height="5.5" fill="#ffffff" rx="1" />
                          <rect x="55" y="53" width="4.5" height="1.8" fill={clothingColor} />
                          <rect x="55" y="55.5" width="4.5" height="1" fill="#475569" />
                        </g>
                      )}

                      {/* Arms & Hands typing on keyboard */}
                      <rect x="32" y="46" width="6.5" height="16" fill={clothingColor} rx="2" />
                      <rect x="61.5" y="46" width="6.5" height="16" fill={clothingColor} rx="2" />
                      <rect x="36" y="60" width="8.5" height="5.5" fill={skinTone} rx="1" />
                      <rect x="55.5" y="60" width="8.5" height="5.5" fill={skinTone} rx="1" />

                      {/* Head / Face */}
                      <rect x="40.5" y="24" width="19" height="18" fill={skinTone} rx="3" />

                      {/* Eyes */}
                      <rect x="43.5" y="31" width="3" height="4" fill="#0f172a" />
                      <rect x="44.5" y="31" width="1" height="2" fill="#ffffff" />
                      <rect x="53.5" y="31" width="3" height="4" fill="#0f172a" />
                      <rect x="54.5" y="31" width="1" height="2" fill="#ffffff" />

                      {/* Glasses */}
                      {accessories.includes("oculos") && (
                        <g>
                          <rect x="42.5" y="30" width="5.5" height="5.5" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                          <rect x="52.5" y="30" width="5.5" height="5.5" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                          <line x1="48" y1="32" x2="52.5" y2="32" stroke="#e2e8f0" strokeWidth="0.8" />
                        </g>
                      )}

                      {/* Smile */}
                      <rect x="47" y="37" width="6" height="2" fill="#991b1b" rx="1" />

                      {/* Hair Style */}
                      {hairStyle === "ponytail" ? (
                        <>
                          <rect x="38.5" y="19" width="23" height="8" fill={hairColor} rx="3" />
                          <rect x="36.5" y="23" width="5" height="18" fill={hairColor} rx="2" />
                          <rect x="58.5" y="23" width="5" height="18" fill={hairColor} rx="2" />
                          <circle cx="59" cy="18" r="4" fill={hairColor} />
                        </>
                      ) : hairStyle === "short_fade" ? (
                        <>
                          <rect x="39" y="19" width="22" height="8" fill={hairColor} rx="3" />
                          <rect x="38" y="23" width="3.5" height="7" fill={hairColor} />
                          <rect x="58.5" y="23" width="3.5" height="7" fill={hairColor} />
                        </>
                      ) : hairStyle === "wavy_long" ? (
                        <>
                          <rect x="38.5" y="18" width="23" height="9" fill={hairColor} rx="3" />
                          <rect x="36" y="22" width="6" height="22" fill={hairColor} rx="3" />
                          <rect x="58" y="22" width="6" height="22" fill={hairColor} rx="3" />
                        </>
                      ) : hairStyle === "buzz_cut" ? (
                        <>
                          <rect x="39.5" y="21" width="21" height="5" fill={hairColor} rx="2" />
                        </>
                      ) : hairStyle === "afro_puff" ? (
                        <>
                          <circle cx="50" cy="22" r="13" fill={hairColor} />
                          <rect x="40.5" y="24" width="19" height="18" fill={skinTone} rx="3" />
                        </>
                      ) : (
                        <>
                          <rect x="39" y="18" width="22" height="9" fill={hairColor} rx="3" />
                          <polygon points="46,18 50,13 54,18" fill={hairColor} />
                          <rect x="38" y="23" width="3.5" height="8" fill={hairColor} />
                          <rect x="58.5" y="23" width="3.5" height="8" fill={hairColor} />
                        </>
                      )}

                      {/* Headset de Vendas */}
                      {accessories.includes("headset") && (
                        <g>
                          <path d="M 36.5 28 A 14 14 0 0 1 63.5 28" fill="none" stroke="#0f172a" strokeWidth="2.2" />
                          <rect x="35" y="26" width="3.5" height="6.5" fill={clothingColor} rx="1" />
                          <rect x="61.5" y="26" width="3.5" height="6.5" fill={clothingColor} rx="1" />
                          <path d="M 36.5 32 Q 39 40 45.5 39" fill="none" stroke="#0f172a" strokeWidth="1.3" />
                          <circle cx="46.5" cy="39" r="1.6" fill={clothingColor} />
                        </g>
                      )}
                    </svg>
                  </div>
                )}

                <div className="text-[11px] font-bold text-white mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: clothingColor }} />
                  <span>{customName} atendendo pela {storeName}</span>
                </div>
              </div>
            ) : (
              /* ESTADO DESATIVADO: Em pé na plataforma */
              <div className="relative flex flex-col items-center justify-center w-full h-full p-4 select-none">
                <div className="relative w-44 h-48 flex items-center justify-center">
                  <svg
                    viewBox="0 0 80 90"
                    className="w-full h-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]"
                    style={{ shapeRendering: "crispEdges" }}
                  >
                    <ellipse cx="40" cy="84" rx="28" ry="7" fill="rgba(0,0,0,0.4)" />
                    <rect x="30" y="74" width="8" height="7" fill="#0f172a" rx="1.5" />
                    <rect x="42" y="74" width="8" height="7" fill="#0f172a" rx="1.5" />
                    <rect x="31" y="54" width="7" height="22" fill="#1e293b" />
                    <rect x="42" y="54" width="7" height="22" fill="#1e293b" />
                    <rect x="28" y="34" width="24" height="22" fill={clothingColor} rx="3" />
                    <rect x="23" y="36" width="5.5" height="16" fill={clothingColor} rx="1.5" />
                    <rect x="51.5" y="36" width="5.5" height="16" fill={clothingColor} rx="1.5" />
                    <rect x="31" y="18" width="18" height="17" fill={skinTone} rx="3" />
                    <rect x="34" y="23" width="2.5" height="3.5" fill="#0f172a" />
                    <rect x="43.5" y="23" width="2.5" height="3.5" fill="#0f172a" />
                    
                    {/* Hair */}
                    <rect x="30" y="14" width="20" height="7" fill={hairColor} rx="2.5" />
                  </svg>
                </div>
                <div
                  className="zai-character-platform"
                  style={{ borderColor: clothingColor, boxShadow: `0 0 35px ${clothingColor}44` }}
                />
                <p className="text-[11px] text-muted-foreground/80 mt-2 font-medium">
                  {customName} em espera. Ative o botão acima para entrar no escritório.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* STATUS PILL (BOTTOM CENTER) - Only when offline */}
        {!isOnline && (
          <div className="zai-status-pill-bottom">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Em espera</span>
          </div>
        )}

        {/* CHARACTER CONTROLS (VERTICAL LEFT) */}
        <div className="zai-character-controls">
          <button
            type="button"
            onClick={() => handleTabClick("visual")}
            className={`zai-character-control ${activeTab === "visual" && showConfigPanel ? "active" : ""}`}
            title="Visual do Atendente (Gênero, Cabelo, Pele)"
          >
            <Eye className="w-4 h-4" />
            <span>Visual</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick("roupas")}
            className={`zai-character-control ${activeTab === "roupas" && showConfigPanel ? "active" : ""}`}
            title="Cores da Loja e Uniforme"
          >
            <Shirt className="w-4 h-4" />
            <span>Roupas</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick("acessorios")}
            className={`zai-character-control ${activeTab === "acessorios" && showConfigPanel ? "active" : ""}`}
            title="Headset, Crachá e Óculos"
          >
            <Headphones className="w-4 h-4" />
            <span>Acessórios</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick("cenario")}
            className={`zai-character-control ${activeTab === "cenario" && showConfigPanel ? "active" : ""}`}
            title="Cenário do Escritório da Loja"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Cenário</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick("animacoes")}
            className={`zai-character-control ${activeTab === "animacoes" && showConfigPanel ? "active" : ""}`}
            title="Modelos Prontos e Presets"
          >
            <Sparkles className="w-4 h-4" />
            <span>Presets</span>
          </button>
        </div>

        {/* INTERACTIVE CUSTOMIZATION PANEL / DRAWER */}
        {showConfigPanel && (
          <div className="zai-config-drawer absolute top-12 left-16 z-30 w-72 bg-[#0d131f]/95 border border-border/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-fade-in text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-bold text-white flex items-center gap-1.5 capitalize">
                <Palette className="w-3.5 h-3.5 text-emerald-400" />
                Personalizar: {activeTab}
              </span>
              <button
                type="button"
                onClick={() => setShowConfigPanel(false)}
                className="text-muted-foreground hover:text-white text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TAB: VISUAL */}
            {activeTab === "visual" && (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Nome do Atendente</label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ex: Camila, Vitória, Lucas..."
                    className="h-8 text-xs bg-[#080c14] border-border/60 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Função / Papel</label>
                  <Input
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Ex: Especialista em Vendas..."
                    className="h-8 text-xs bg-[#080c14] border-border/60 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Gênero / Estilo</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGender("female")}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        gender === "female" ? "bg-emerald-500/20 border-emerald-500 text-white font-bold" : "border-border/50 text-muted-foreground"
                      }`}
                    >
                      Feminino
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender("male")}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        gender === "male" ? "bg-emerald-500/20 border-emerald-500 text-white font-bold" : "border-border/50 text-muted-foreground"
                      }`}
                    >
                      Masculino
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Tom de Pele</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {skinTones.map((st) => (
                      <button
                        key={st.hex}
                        type="button"
                        onClick={() => setSkinTone(st.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          skinTone === st.hex ? "scale-110 border-white shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: st.hex }}
                        title={st.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Estilo de Cabelo</label>
                  <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto pr-1">
                    {hairStylesList.map((hs) => (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={() => setHairStyle(hs.id)}
                        className={`p-1.5 rounded-lg border text-left text-[10px] truncate transition-all ${
                          hairStyle === hs.id ? "bg-emerald-500/20 border-emerald-500 text-white font-bold" : "border-border/40 text-muted-foreground hover:bg-muted/10"
                        }`}
                      >
                        {hs.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Cor do Cabelo</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {hairColors.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setHairColor(c.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          hairColor === c.hex ? "scale-110 border-white shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ROUPAS */}
            {activeTab === "roupas" && (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Cor do Uniforme (Identidade da Loja)</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {uniformColors.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setClothingColor(c.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          clothingColor === c.hex ? "scale-110 border-white shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Estilo de Vestimenta</label>
                  <div className="space-y-1">
                    {[
                      { id: "uniforme_loja", label: "Uniforme Oficial com Crachá" },
                      { id: "social_executivo", label: "Social Executivo com Blazer" },
                      { id: "polo_comercial", label: "Camisa Polo de Vendas" },
                      { id: "avental_balcao", label: "Avental de Atendimento / Balcão" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setClothingStyle(st.id)}
                        className={`w-full text-left p-2 rounded-lg border transition-all text-[11px] ${
                          clothingStyle === st.id ? "bg-emerald-500/20 border-emerald-500 text-white font-bold" : "border-border/40 text-muted-foreground hover:bg-muted/10"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ACESSÓRIOS */}
            {activeTab === "acessorios" && (
              <div className="space-y-2">
                <label className="text-[11px] text-muted-foreground font-semibold">Acessórios de Trabalho</label>
                <div className="space-y-1.5">
                  {[
                    { id: "headset", label: "Headset Profissional de Atendimento" },
                    { id: "cracha", label: `Crachá Oficial da Loja (${storeName})` },
                    { id: "oculos", label: "Óculos de Grau" },
                    { id: "gato", label: "Mascote / Pet da Loja (Gatinho ZAI)" },
                  ].map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccessory(acc.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all text-[11px] ${
                        accessories.includes(acc.id)
                          ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                          : "border-border/40 text-muted-foreground hover:bg-muted/10"
                      }`}
                    >
                      <span>{acc.label}</span>
                      {accessories.includes(acc.id) && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: CENÁRIO */}
            {activeTab === "cenario" && (
              <div className="space-y-2">
                <label className="text-[11px] text-muted-foreground font-semibold">Ambiente do Palco de Vendas</label>
                <div className="space-y-1.5">
                  {scenes.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setScene(sc.id)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-[11px] ${
                        scene === sc.id
                          ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                          : "border-border/40 text-muted-foreground hover:bg-muted/10"
                      }`}
                    >
                      {sc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: PRESETS & ANIMAÇÕES */}
            {activeTab === "animacoes" && (
              <div className="space-y-2">
                <label className="text-[11px] text-muted-foreground font-semibold">Modelos & Presets de Atendentes</label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {ATTENDANT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-[11px] flex items-center justify-between ${
                        customName.toLowerCase() === p.name.toLowerCase()
                          ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                          : "border-border/40 text-muted-foreground hover:bg-muted/10 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>{p.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                            {p.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{p.role}</div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-medium">Aplicar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SAVE BUTTON */}
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Salvando..." : "Salvar no Perfil da Loja"}</span>
              </button>
            </div>
          </div>
        )}

        {/* RESET CAMERA & DRAG HINT PILL */}
        <div className="zai-character-hint flex items-center gap-2">
          <span>🖱 Arraste para girar · Scroll para zoom</span>
          {(rotation.x !== 0 || rotation.y !== 0 || zoom !== 1) && (
            <button
              type="button"
              onClick={handleDoubleClick}
              className="ml-1 p-0.5 hover:text-emerald-400 transition-colors"
              title="Resetar Câmera"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
