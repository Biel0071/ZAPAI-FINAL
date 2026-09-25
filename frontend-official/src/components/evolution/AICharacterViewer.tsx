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
      if (config.clothingColor) setClothingColor(config.clothingColor);
      if (config.clothingStyle) setClothingStyle(config.clothingStyle);
      if (config.accessories) setAccessories(config.accessories);
      if (config.scene) setScene(config.scene);
      if (config.gender) setGender(config.gender);
      if (config.skinTone) setSkinTone(config.skinTone);
    }
  }, [config]);

  // 3D Isometric Transform States
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse Handlers for 3D Drag & Rotate
  const handleMouseDown = (e: React.MouseEvent) => {
    // If click inside control panel, don't drag camera
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
        hairStyle: "default",
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
  const hairColors = [
    { name: "Castanho Escuro", hex: "#4a2c11" },
    { name: "Preto", hex: "#1e293b" },
    { name: "Loiro Dourado", hex: "#d97706" },
    { name: "Ruivo Acobreado", hex: "#b91c1c" },
    { name: "Platinado", hex: "#94a3b8" },
  ];

  const uniformColors = [
    { name: "Cor da Loja", hex: themeColor || "#10b981" },
    { name: "Verde Esmeralda", hex: "#10b981" },
    { name: "Azul Corporativo", hex: "#2563eb" },
    { name: "Roxo Tech", hex: "#7c3aed" },
    { name: "Vinho Elegante", hex: "#991b1b" },
    { name: "Laranja Comercial", hex: "#ea580c" },
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
                {/* Cena de fundo sutil */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-15 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at center, ${clothingColor} 0%, transparent 70%)`
                  }}
                />

                {/* SVG Isometric Habbo/Pixel Art Character */}
                <div className="relative w-44 h-48 flex items-center justify-center">
                  <svg
                    viewBox="0 0 100 110"
                    className="w-full h-full drop-shadow-[0_12px_12px_rgba(0,0,0,0.5)]"
                    style={{ shapeRendering: "crispEdges" }}
                  >
                    {/* Shadow on floor */}
                    <ellipse cx="50" cy="98" rx="34" ry="8" fill="rgba(0,0,0,0.4)" />

                    {/* Desk base */}
                    <polygon points="15,85 85,85 92,94 8,94" fill="#1e293b" />
                    <rect x="18" y="87" width="6" height="14" fill="#0f172a" />
                    <rect x="76" y="87" width="6" height="14" fill="#0f172a" />

                    {/* Monitors on desk */}
                    <rect x="25" y="60" width="22" height="16" fill="#0f172a" rx="1" />
                    <rect x="27" y="62" width="18" height="12" fill="#020617" />
                    <rect x="29" y="64" width="14" height="2" fill={clothingColor} />
                    <rect x="29" y="68" width="10" height="2" fill="#38bdf8" />
                    <rect x="35" y="76" width="2" height="9" fill="#334155" />

                    <rect x="53" y="60" width="22" height="16" fill="#0f172a" rx="1" />
                    <rect x="55" y="62" width="18" height="12" fill="#020617" />
                    <rect x="57" y="64" width="14" height="2" fill="#22c55e" />
                    <rect x="57" y="68" width="8" height="2" fill="#a855f7" />
                    <rect x="63" y="76" width="2" height="9" fill="#334155" />

                    {/* Keyboard & Mousepad */}
                    <rect x="42" y="86" width="16" height="4" fill="#334155" rx="1" />

                    {/* Chair Backrest */}
                    <rect x="40" y="32" width="20" height="28" fill="#090d16" rx="4" />
                    <rect x="42" y="34" width="16" height="24" fill="#1e293b" rx="2" />

                    {/* Torso / Uniform with Custom Store Color */}
                    <rect x="38" y="44" width="24" height="24" fill={clothingColor} rx="3" />
                    
                    {/* Collar / Tie */}
                    {gender === "female" ? (
                      <>
                        <polygon points="44,44 50,52 56,44" fill="#ffffff" />
                        <rect x="46" y="48" width="8" height="4" fill={clothingColor} />
                      </>
                    ) : (
                      <>
                        <polygon points="46,44 50,50 54,44" fill="#ffffff" />
                        <rect x="49" y="48" width="2" height="12" fill="#dc2626" />
                      </>
                    )}

                    {/* Store Crachá / Badge */}
                    {accessories.includes("cracha") && (
                      <g>
                        <rect x="54" y="52" width="6" height="5" fill="#ffffff" rx="1" />
                        <rect x="55" y="53" width="4" height="1.5" fill={clothingColor} />
                        <rect x="55" y="55" width="4" height="1" fill="#475569" />
                      </g>
                    )}

                    {/* Arms & Hands typing on keyboard */}
                    <rect x="33" y="46" width="6" height="16" fill={clothingColor} rx="2" />
                    <rect x="61" y="46" width="6" height="16" fill={clothingColor} rx="2" />
                    <rect x="37" y="60" width="8" height="5" fill={skinTone} rx="1" />
                    <rect x="55" y="60" width="8" height="5" fill={skinTone} rx="1" />

                    {/* Head / Face */}
                    <rect x="41" y="24" width="18" height="18" fill={skinTone} rx="3" />

                    {/* Eyes */}
                    <rect x="44" y="31" width="3" height="4" fill="#0f172a" />
                    <rect x="45" y="31" width="1" height="2" fill="#ffffff" />
                    <rect x="53" y="31" width="3" height="4" fill="#0f172a" />
                    <rect x="54" y="31" width="1" height="2" fill="#ffffff" />

                    {/* Glasses */}
                    {accessories.includes("oculos") && (
                      <g>
                        <rect x="43" y="30" width="5" height="5" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                        <rect x="52" y="30" width="5" height="5" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                        <line x1="48" y1="32" x2="52" y2="32" stroke="#e2e8f0" strokeWidth="0.8" />
                      </g>
                    )}

                    {/* Smile */}
                    <rect x="47" y="37" width="6" height="2" fill="#991b1b" rx="1" />

                    {/* Hair */}
                    {gender === "female" ? (
                      <>
                        <rect x="39" y="20" width="22" height="7" fill={hairColor} rx="3" />
                        <rect x="37" y="24" width="5" height="18" fill={hairColor} rx="2" />
                        <rect x="58" y="24" width="5" height="18" fill={hairColor} rx="2" />
                      </>
                    ) : (
                      <>
                        <rect x="39" y="19" width="22" height="8" fill={hairColor} rx="3" />
                        <rect x="38" y="23" width="4" height="8" fill={hairColor} />
                        <rect x="58" y="23" width="4" height="8" fill={hairColor} />
                      </>
                    )}

                    {/* Headset de Vendas */}
                    {accessories.includes("headset") && (
                      <g>
                        <path d="M 37 28 A 13 13 0 0 1 63 28" fill="none" stroke="#0f172a" strokeWidth="2" />
                        <rect x="36" y="26" width="3" height="6" fill="#38bdf8" rx="1" />
                        <rect x="61" y="26" width="3" height="6" fill="#38bdf8" rx="1" />
                        <path d="M 37 32 Q 40 40 46 39" fill="none" stroke="#0f172a" strokeWidth="1.2" />
                        <circle cx="47" cy="39" r="1.5" fill="#38bdf8" />
                      </g>
                    )}
                  </svg>
                </div>

                <div className="text-[11px] font-bold text-white mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: clothingColor }} />
                  <span>{customName} atendendo pela {storeName}</span>
                </div>
              </div>
            ) : (
              /* ESTADO DESATIVADO: Em pé na plataforma */
              <div className="relative flex flex-col items-center justify-center w-full h-full p-4 select-none">
                <div className="relative w-36 h-40 flex items-center justify-center opacity-70">
                  <svg
                    viewBox="0 0 80 90"
                    className="w-full h-full"
                    style={{ shapeRendering: "crispEdges" }}
                  >
                    <ellipse cx="40" cy="84" rx="24" ry="6" fill="rgba(0,0,0,0.4)" />
                    <rect x="31" y="74" width="7" height="6" fill="#0f172a" rx="1" />
                    <rect x="42" y="74" width="7" height="6" fill="#0f172a" rx="1" />
                    <rect x="32" y="56" width="6" height="20" fill="#1e293b" />
                    <rect x="42" y="56" width="6" height="20" fill="#1e293b" />
                    <rect x="29" y="36" width="22" height="22" fill={clothingColor} rx="2" />
                    <rect x="24" y="38" width="5" height="15" fill={clothingColor} rx="1" />
                    <rect x="51" y="38" width="5" height="15" fill={clothingColor} rx="1" />
                    <rect x="32" y="19" width="16" height="16" fill={skinTone} rx="2" />
                    <rect x="35" y="24" width="2" height="3" fill="#0f172a" />
                    <rect x="43" y="24" width="2" height="3" fill="#0f172a" />
                    <rect x="31" y="15" width="18" height="6" fill={hairColor} rx="2" />
                  </svg>
                </div>
                <div className="zai-character-platform" />
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
            title="Visual do Atendente (Gênero, Cabelo, Rosto)"
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
            title="Comportamento e Atendimento"
          >
            <Sparkles className="w-4 h-4" />
            <span>Animações</span>
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

            {/* TAB: ANIMAÇÕES */}
            {activeTab === "animacoes" && (
              <div className="space-y-2">
                <label className="text-[11px] text-muted-foreground font-semibold">Estado do Atendimento</label>
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px]">
                    <strong>Atendimento Ativo:</strong> Atendente consulta catálogo e responde clientes em tempo real.
                  </div>
                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/40 text-muted-foreground text-[11px]">
                    <strong>Standby:</strong> Quando offline, fica em pé na plataforma isométrica.
                  </div>
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
