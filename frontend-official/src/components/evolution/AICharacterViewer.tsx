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
  RotateCcw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/state/hooks/use-toast";
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
  avatarUrl?: string;
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
  avatarUrl,
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

  return (
    <article className="relative w-full h-[310px] bg-[#0c121d] rounded-2xl border border-white/10 shadow-2xl overflow-hidden select-none">
      
            {/* 1:1 AUTHENTIC 16-BIT HABBO STAGE BASE IMAGE */}
      <div className="relative w-full h-full">
        
        {/* MAIN AREA: DYNAMIC SCENE (Sitting vs Standing) */}
        <div className="relative w-full h-full overflow-hidden transition-all duration-500">
          <img
            src={isOnline ? "/assets/evolution/habbo_office_working.png" : "/assets/evolution/habbo_standing_box.png"}
            alt={isOnline ? "Habbo Atendente Sentada" : "Habbo Atendente em Pé"}
            className={`w-full h-full object-cover transition-all duration-500 ${
              isOnline ? "filter-none brightness-100" : "brightness-[0.8] saturate-[0.7]"
            }`}
            style={{ imageRendering: "pixelated" }}
          />

          {/* DYNAMIC STORE OVERLAY TINT */}
          <div
            className="absolute inset-0 pointer-events-none opacity-15 mix-blend-color transition-colors duration-500"
            style={{ backgroundColor: clothingColor }}
          />

          {/* INTERACTIVE TOGGLE BUTTON */}
          <button
            type="button"
            onClick={() => onToggleOnline?.(!isOnline)}
            title={isOnline ? "Prévia visual: mostrar em pé" : "Prévia visual: mostrar sentado"}
            aria-label={isOnline ? "Mostrar personagem em pé na prévia" : "Mostrar personagem sentado na prévia"}
            className={`absolute top-2.5 right-2.5 z-20 w-[76px] h-6 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1 text-[9px] font-bold border backdrop-blur-md ${
              isOnline
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "bg-black/60 text-slate-300 border-white/20 hover:bg-black/80"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? "bg-emerald-400" : "bg-slate-400"
              }`}
            />
            <span>{isOnline ? "Sentada" : "Em pé"}</span>
          </button>

          {/* CUSTOM ATTENDANT BADGE OVERLAY (When customized) */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2 bg-[#090e17]/90 backdrop-blur-md border border-white/10 px-2.5 py-1.5 rounded-xl shadow-lg max-w-[65%]">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-500/50 flex-shrink-0 bg-black">
              <img
                src={avatarUrl || "/assets/evolution/habbo_avatar.png"}
                alt={customName}
                className="w-full h-full object-cover"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-white flex items-center gap-1 leading-tight truncate">
                {customName}
              </div>
              <div className="text-[9px] text-slate-400 font-medium leading-tight truncate">
                {customRole}
              </div>
              <div className="text-[9px] font-semibold flex items-center gap-1 mt-0.5 leading-tight truncate">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isOnline ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" : "bg-slate-400"
                  }`}
                />
                <span className={isOnline ? "text-emerald-400 font-bold" : "text-slate-400 font-medium"}>
                  {isOnline ? "Prévia · Sentada" : "Prévia · Em pé"}
                </span>
              </div>
            </div>
          </div>

          {/* VISIBLE CUSTOMIZATION ACTION PILL */}
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
