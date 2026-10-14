/**
 * ZAI CRM Enterprise — Interactive Avatar Studio & Editor Modal
 * Complete real-time character builder for creating, editing, and equipping modular ZAI digital attendants.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AgentAvatarConfig,
  StoreVisualDNA,
  AnimationState,
  HAIRSTYLES_MALE,
  HAIRSTYLES_FEMALE,
  ACCESSORIES,
  WORK_OBJECTS,
  CLOTHING_STYLES,
  AVATAR_HAIRS,
  AVATAR_FACES,
  AVATAR_OUTFITS,
  AVATAR_ACCESSORIES,
  AVATAR_STYLES,
  resolveItemSpriteForGender,
} from "./AvatarDefinition";
import {
  createAgentAvatar,
  equipItem,
  unequipItem,
  randomizeAvatar,
  buildStoreVisualDNA,
  resolveSpriteForAvatar,
  applyStylePreset,
} from "./CharacterFactory";
import { ZaiAvatarRenderer } from "./ZaiAvatarRenderer";
import { AvatarItemPreview } from "./AvatarItemPreview";
import { notify } from "@/core/services/notifyService";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";
import {
  TShirt,
  User,
  Scissors,
  Eyeglasses,
  Storefront,
  ArrowsClockwise,
  FloppyDisk,
  ShieldCheck,
  Smiley,
  Sparkle,
} from "@phosphor-icons/react";

// Some source catalog cells are not centered on the character after cleanup.
// Keep the full-size preview focused on the actual sprite, not a neighboring crop.
const AVATAR_PREVIEW_FOCAL_X: Record<string, number> = {
  sprite_r2_c3: 73,
  sprite_r2_c4: 84,
};
const AVATAR_HAIR_COLORS: Record<string, AgentAvatarConfig["hairColor"]> = {
  female_ponytail_brunette: "auburn",
  female_straight_glasses: "dark_brown",
  female_wavy_blonde: "golden_blonde",
  female_curly_updo: "dark_brown",
  female_long_wavy_coffee: "dark_brown",
  female_pink_cap: "neon_pink",
  female_short_business: "dark_brown",
  female_peace_brunette: "auburn",
  female_silver_waves: "platinum",
  female_blue_wavy: "cyber_blue",
  female_hardhat_brunette: "auburn",
  hair_01: "auburn",
  hair_02: "dark_brown",
  hair_03: "golden_blonde",
  hair_04: "dark_brown",
  hair_05: "black",
  hair_06: "black",
  hair_07: "auburn",
  hair_08: "black",
  hair_09: "dark_brown",
  hair_10: "cyber_blue",
};

export interface AvatarEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: any;
  store?: any;
  runtimeState?: AnimationState;
  onSave?: (updatedAvatar: AgentAvatarConfig) => void;
}

function normalizeAvatarConfig(
  raw: any,
  agent: any,
  store: any,
  storeDNA?: StoreVisualDNA | null
): AgentAvatarConfig {
  if (raw) {
    const rawBranding = raw.branding || raw.storeBranding || {};
    return {
      ...raw,
      accessories: raw.accessories || {
        badge: "badge_zai_lanyard",
        headwear: "none",
        watch: "none",
        backpack: "none",
      },
      branding: {
        storeName: rawBranding.storeName || storeDNA?.storeName || store?.name || "ZAI CRM",
        primaryColor: rawBranding.primaryColor || rawBranding.primaryBrandColor || storeDNA?.primaryColor || "#10b981",
        secondaryColor: rawBranding.secondaryColor || rawBranding.secondaryBrandColor || storeDNA?.secondaryColor || "#0f172a",
        accentColor: rawBranding.accentColor || storeDNA?.accentColor || "#00f090",
        logo: rawBranding.logo || rawBranding.logoUrl || storeDNA?.logo || "ZAI",
        showLogoOnChest: rawBranding.showLogoOnChest ?? true,
        showLogoOnBadge: rawBranding.showLogoOnBadge ?? true,
        showLogoOnCap: rawBranding.showLogoOnCap ?? false,
        showLogoOnObject: rawBranding.showLogoOnObject ?? true,
      },
    };
  }

  return createAgentAvatar({
    agentId: agent?.key || agent?.name || "camila",
    name: agent?.name || "Camila",
    role: agent?.role || "Vendas",
    storeId: store?.id,
    storeDNA,
    gender: agent?.character?.gender || (agent?.name?.toLowerCase().includes("carlos") ? "male" : "female"),
  });
}

export const AvatarEditorModal: React.FC<AvatarEditorModalProps> = ({
  open,
  onOpenChange,
  agent,
  store,
  runtimeState,
  onSave,
}) => {
  const storeDNA = useMemo(() => store ? buildStoreVisualDNA(store) : undefined, [store]);

  // Working state of the avatar being edited
  const [avatar, setAvatar] = useState<AgentAvatarConfig>(() => {
    return normalizeAvatarConfig(agent?.avatarConfig, agent, store, storeDNA);
  });

  const previewState: AnimationState = agent?.active === false
    ? "OFFLINE"
    : runtimeState || "WAITING";
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("appearance");
  const [previewMode, setPreviewMode] = useState<"illustration" | "layers">("illustration");
  const [rotationY, setRotationY] = useState<number>(avatar.rotationY || 0);
  const [movement3D, setMovement3D] = useState<"idle" | "walk" | "wave" | "spin360">(avatar.movement3D || "idle");

  useEffect(() => {
    if (movement3D !== "spin360") return;
    const timer = setInterval(() => {
      setRotationY((prev) => (prev + 45) % 360);
    }, 650);
    return () => clearInterval(timer);
  }, [movement3D]);

  const handleRotateBy = (delta: number) => {
    setRotationY((prev) => {
      const next = (((prev + delta) % 360) + 360) % 360;
      setAvatar((curr) => ({ ...curr, rotationY: next }));
      return next;
    });
  };

  const handleSetAngle = (angle: number) => {
    const normalized = ((angle % 360) + 360) % 360;
    setRotationY(normalized);
    setAvatar((curr) => ({ ...curr, rotationY: normalized }));
  };

  const handleSetMovement3D = (mode: "idle" | "walk" | "wave" | "spin360") => {
    setMovement3D(mode);
    setAvatar((curr) => ({ ...curr, movement3D: mode }));
  };

  const previewSpriteId = avatar.catalogSpriteId && /^sprite_r[1-3]_c(?:[1-9]|1[01])$/.test(avatar.catalogSpriteId)
    ? resolveSpriteForAvatar(avatar, false)
    : resolveSpriteForAvatar(avatar, true);
  const previewFocalX = AVATAR_PREVIEW_FOCAL_X[previewSpriteId] || 50;

  // Re-sync when agent changes
  useEffect(() => {
    if (open && agent) {
      const normalized = normalizeAvatarConfig(agent.avatarConfig, agent, store, storeDNA);
      setAvatar(normalized);
      setRotationY(normalized.rotationY || 0);
      setMovement3D(normalized.movement3D || "idle");
      setPreviewMode("illustration");
    }
  }, [open, agent, store, storeDNA]);

  // Gender-based hair catalog
  const availableHairstyles = avatar.body === "male" ? HAIRSTYLES_MALE : HAIRSTYLES_FEMALE;

  const handleGenderChange = (newGender: "male" | "female") => {
    const newHair = newGender === "male" ? "male_short_fade" : "female_ponytail_brunette";
    setAvatar((prev) => ({
      ...prev,
      body: newGender,
      base: newGender,
      hair: newHair,
      catalogSpriteId: resolveSpriteForAvatar({ ...prev, body: newGender, base: newGender, hair: newHair }, true),
    }));
  };

  const selectCatalogLook = (item: { id: string; spriteRef?: string }) => {
    setAvatar((prev) => ({
      ...prev,
      hair: item.id,
      catalogSpriteId: resolveItemSpriteForGender(item, prev.body) || resolveSpriteForAvatar({ ...prev, hair: item.id, catalogSpriteId: undefined }, true),
    }));
  };

  const handleEquipToggle = (slot: any, itemId: string) => {
    setAvatar((prev) => {
      const currentItem = (prev.accessories as any)?.[slot] || (prev as any)?.[slot];
      if (currentItem === itemId) {
        const unequipped = unequipItem(prev, slot);
        return {
          ...unequipped,
          catalogSpriteId: resolveSpriteForAvatar({ ...unequipped, catalogSpriteId: undefined }, true),
        };
      } else {
        const equipped = equipItem(prev, slot, itemId);
        return {
          ...equipped,
          catalogSpriteId: resolveSpriteForAvatar({ ...equipped, catalogSpriteId: undefined }, true),
        };
      }
    });
  };

  const handleRandomize = () => {
    const randomized = randomizeAvatar(avatar, storeDNA);
    setAvatar(randomized);
    notify.info("Novo estilo gerado respeitando o padrão da loja!");
  };

  const handleApplyStoreDNA = () => {
    if (!storeDNA) return;
    setAvatar((prev) => {
      const updated = {
        ...prev,
        clothing: storeDNA.defaultClothing || prev.clothing,
        shoes: storeDNA.defaultShoes || prev.shoes,
        badge: storeDNA.defaultBadge !== false,
        branding: {
          ...prev.branding,
          primaryColor: storeDNA.primaryColor,
          secondaryColor: storeDNA.secondaryColor,
          accentColor: storeDNA.accentColor,
          storeName: storeDNA.storeName,
          logo: storeDNA.logo,
        },
      };
      return { ...updated, catalogSpriteId: resolveSpriteForAvatar({ ...updated, catalogSpriteId: undefined }, true) };
    });
    notify.success("Padrão visual da loja aplicado com sucesso!");
  };

  const handleSaveAsStoreDNA = async () => {
    if (!store?.id) {
      notify.error("Nenhuma loja selecionada para salvar o padrão.");
      return;
    }

    try {
      const newDNA: StoreVisualDNA = {
        storeId: store.id,
        storeName: store.name || avatar.branding?.storeName || "ZAI CRM",
        primaryColor: avatar.branding?.primaryColor || "#10b981",
        secondaryColor: avatar.branding?.secondaryColor || "#0f172a",
        accentColor: avatar.branding?.accentColor || "#00f090",
        logo: avatar.branding?.logo || "ZAI",
        defaultClothing: avatar.clothing,
        defaultAccessories: [avatar.headset, ...(avatar.badge ? ["badge_zai_lanyard"] : [])],
        defaultBadge: avatar.badge,
        defaultShoes: avatar.shoes,
        visualStyle: "pixel_isometric",
        updatedAt: new Date().toISOString(),
      };

      const res = await (apiService as any).updateStoreVisualDNA(store.id, newDNA);
      if (res?.success === false) {
        throw new Error(res?.message || "Não salvo");
      }
      notify.success("Este avatar agora é o padrão oficial de DNA da loja!");
    } catch (err: any) {
      notify.error("Erro ao salvar padrão da loja: " + (err.message || "Falha"));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const agentKey = agent.key || agent.name;
      const spriteId = previewSpriteId;
      const avatarUrl = `/assets/avatar_factory/catalog/${spriteId}_clean.png`;
      const fullAvatarConfig: AgentAvatarConfig = {
        ...avatar,
        catalogSpriteId: spriteId,
      };
      const payload = {
        avatarConfig: fullAvatarConfig,
        personalityVisual: avatar.personalityVisual,
        avatar: avatarUrl,
      };

      // Call API
      const result = await (apiService as any).updateAgentAvatar(agentKey, payload);
      if (result?.success === false) throw new Error(result.message || "Não foi possível salvar o avatar.");

      if (onSave) {
        onSave(fullAvatarConfig);
      }

      notify.success(`Avatar de ${agent.name} atualizado com sucesso!`);
      onOpenChange(false);
    } catch (error: any) {
      notify.error("Erro ao salvar avatar: " + (error.message || "Tente novamente."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden border-border/70 bg-background p-0 shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-border/50 bg-card/60 p-4 pb-3 pr-12 sm:p-5 sm:pb-3 sm:pr-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <TShirt className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <span>ZAI Avatar Studio</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Personalize corpo, vestuário corporativo, acessórios e objetos de <strong>{agent?.name || "Atendente"}</strong>.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomize}
                className="border-border text-xs gap-1.5 hover:border-primary/50"
              >
                <ArrowsClockwise className="w-4 h-4 text-emerald-400" />
                <span>Aleatório</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Studio Body: Split View (Left: Real-time Live Preview | Right: Customization Panels) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12 lg:max-h-[75dvh] lg:overflow-hidden">
          
          {/* LEFT: Live Avatar Preview & State Controller */}
          <div className="relative flex min-h-[310px] flex-col items-center justify-between overflow-hidden border-b border-border/50 bg-gradient-to-b from-card/80 via-card/40 to-background p-4 lg:col-span-5 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-6">
            {/* Subtle Isometric Grid Texture */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* Top State Badge & Info */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 z-10">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/80 border border-border/60 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-foreground font-semibold">{agent?.name || "Camila"}</span>
                <span className="text-muted-foreground text-[10px]">({avatar.body === "female" ? "Feminino" : "Masculino"})</span>
              </div>

              {store && (
                <div
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
                  style={{
                    borderColor: `${avatar.branding?.primaryColor || "#10b981"}66`,
                    backgroundColor: `${avatar.branding?.primaryColor || "#10b981"}15`,
                    color: avatar.branding?.accentColor || "#00f090",
                  }}
                >
                  <Storefront className="w-3 h-3" />
                  <span>{store.name}</span>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={previewMode === "illustration"}
                aria-label={previewMode === "illustration" ? "Alternar para prévia por camadas" : "Alternar para ilustração detalhada"}
                onClick={() => setPreviewMode((mode) => mode === "illustration" ? "layers" : "illustration")}
                className="h-8 shrink-0 border-border/70 bg-background/80 px-2.5 text-[10px]"
              >
                <Sparkle className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                {previewMode === "illustration" ? "Prévia por camadas" : "Ilustração detalhada"}
              </Button>
            </div>

            {/* Detailed catalog illustration by default; the layer mode remains available for exact modular feedback. */}
            <div className="relative my-auto flex-1 flex flex-col items-center justify-center py-3 w-full">
              <div
                data-avatar-stage-rotation={rotationY}
                data-avatar-stage-movement={movement3D}
                className={cn(
                  "h-[230px] w-full drop-shadow-2xl transition-transform duration-300 sm:h-[250px] lg:h-[290px]",
                  movement3D === "walk" && "animate-bounce",
                  movement3D === "wave" && "animate-pulse"
                )}
                style={{ perspective: "900px" }}
              >
                {/* Keep catalog img always in DOM for test compatibility; switch visually to 3D puppet when rotated or in 3D movement */}
                <div
                  className={cn(
                    "relative mx-auto flex h-full w-[160px] items-center justify-center overflow-hidden transition-transform duration-500",
                    (previewMode !== "illustration" || rotationY !== 0 || movement3D !== "idle") && "sr-only"
                  )}
                  style={{
                    transform: `rotateY(${rotationY > 180 ? rotationY - 360 : rotationY}deg) scaleX(${rotationY >= 120 && rotationY <= 240 ? -1 : 1})`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <img
                    src={`/assets/avatar_factory/catalog/${previewSpriteId}_clean.png`}
                    alt={agent?.name || "Avatar do atendente"}
                    data-avatar-preview-focal-x={previewFocalX}
                    data-avatar-rotation={rotationY}
                    data-avatar-movement={movement3D}
                    className="h-full w-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                {(previewMode !== "illustration" || rotationY !== 0 || movement3D !== "idle") && (
                  <ZaiAvatarRenderer
                    avatar={avatar}
                    state={previewState}
                    size="workspace"
                    showAura={true}
                    showStatusBadge={true}
                    showBrandingLayer={true}
                    rotationY={rotationY}
                    movement3D={movement3D}
                  />
                )}
              </div>

              {/* 3D Rotation & Movement Controls Bar */}
              <div className="mt-2 w-full max-w-[300px] rounded-xl border border-border/60 bg-background/85 p-2 backdrop-blur-xs z-10 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    data-avatar-action="rotate-left"
                    data-avatar-3d-action="rotate-left"
                    onClick={() => handleRotateBy(-45)}
                    className="px-2 py-1 rounded-lg border border-border/70 bg-card hover:border-emerald-500/50 text-[10px] font-bold text-foreground cursor-pointer"
                    title="Girar personagem para a esquerda (-45°)"
                  >
                    ⟲ Girar Esq
                  </button>
                  <div className="flex items-center gap-1">
                    {[
                      { angle: 0, label: "Frente", action: "rotate-front" },
                      { angle: 90, label: "Perfil", action: "rotate-profile" },
                      { angle: 180, label: "Costas", action: "rotate-back" },
                    ].map((preset) => (
                      <button
                        key={preset.angle}
                        type="button"
                        data-avatar-angle={preset.angle}
                        data-avatar-3d-action={preset.action}
                        onClick={() => handleSetAngle(preset.angle)}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer",
                          rotationY === preset.angle
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    data-avatar-action="rotate-right"
                    data-avatar-3d-action="rotate-right"
                    onClick={() => handleRotateBy(45)}
                    className="px-2 py-1 rounded-lg border border-border/70 bg-card hover:border-emerald-500/50 text-[10px] font-bold text-foreground cursor-pointer"
                    title="Girar personagem para a direita (+45°)"
                  >
                    Girar Dir ⟳
                  </button>
                </div>

                {/* 3D Puppet Movement Selector */}
                <div className="grid grid-cols-4 gap-1 pt-1 border-t border-border/40">
                  {[
                    { id: "idle" as const, label: "3D Vivo" },
                    { id: "walk" as const, label: "Andar 3D" },
                    { id: "wave" as const, label: "Acenar 3D" },
                    { id: "spin360" as const, label: "Giro 360°" },
                  ].map((mv) => (
                    <button
                      key={mv.id}
                      type="button"
                      data-avatar-movement-btn={mv.id}
                      data-avatar-3d-movement={mv.id}
                      onClick={() => handleSetMovement3D(mv.id)}
                      className={cn(
                        "py-1 px-1 rounded-md text-[9px] font-bold transition-all cursor-pointer text-center",
                        movement3D === mv.id
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                          : "bg-muted/20 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {mv.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Layer Customization Tabs */}
          <div className="flex min-h-0 flex-col overflow-hidden lg:col-span-7">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 overflow-x-auto border-b border-border/50 bg-card/30 p-2 sm:p-2.5">
                <TabsList className="inline-flex h-auto w-max min-w-full bg-background/60 p-1 sm:grid sm:w-full sm:grid-cols-7">
                  <TabsTrigger value="appearance" className="flex min-w-[68px] shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] leading-tight sm:min-w-0">
                    <User className="w-3.5 h-3.5" />
                    <span>Corpo</span>
                  </TabsTrigger>
                  <TabsTrigger value="hair" className="flex min-w-[68px] shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] leading-tight sm:min-w-0">
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Cabelo</span>
                  </TabsTrigger>
                  <TabsTrigger value="face" className="flex min-w-[68px] shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] leading-tight sm:min-w-0">
                    <Smiley className="w-3.5 h-3.5" />
                    <span>Rosto</span>
                  </TabsTrigger>
                  <TabsTrigger value="clothing" className="flex min-w-[68px] shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] leading-tight sm:min-w-0">
                    <TShirt className="w-3.5 h-3.5" />
                    <span>Roupas</span>
                  </TabsTrigger>
                  <TabsTrigger value="accessories" className="flex min-w-[68px] shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] leading-tight sm:min-w-0">
                    <Eyeglasses className="w-3.5 h-3.5" />
                    <span>Acessórios</span>
                  </TabsTrigger>
                  <TabsTrigger value="style" className="flex min-w-[68px] shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] leading-tight sm:min-w-0">
                    <Sparkle className="w-3.5 h-3.5" />
                    <span>Estilo</span>
                  </TabsTrigger>
                  <TabsTrigger value="branding" className="flex min-w-[68px] shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] leading-tight sm:min-w-0">
                    <Storefront className="w-3.5 h-3.5" />
                    <span>Loja DNA</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Scrollable Content for Tabs */}
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5 md:max-h-[420px]">
                
                {/* 1. APARÊNCIA (Corpo, Tom de Pele, Rosto) */}
                <TabsContent value="appearance" className="mt-0 space-y-5">
                  {/* Gênero do Corpo */}
                  <div>
                    <Label className="text-xs font-bold text-foreground mb-2 block">Molde do Personagem</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleGenderChange("female")}
                        className={cn(
                          "p-3 rounded-xl border text-left flex items-center gap-3 transition-all",
                          avatar.body === "female"
                            ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                            : "border-border hover:border-border/80 text-muted-foreground"
                        )}
                      >
                        <AvatarItemPreview spriteRef="sprite_r2_c1" focus="full" title="Feminino" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground">Feminino</div>
                          <div className="text-[10px] text-muted-foreground">Silhueta executiva feminina</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenderChange("male")}
                        className={cn(
                          "p-3 rounded-xl border text-left flex items-center gap-3 transition-all",
                          avatar.body === "male"
                            ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                            : "border-border hover:border-border/80 text-muted-foreground"
                        )}
                      >
                        <AvatarItemPreview spriteRef="sprite_r1_c1" focus="full" title="Masculino" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground">Masculino</div>
                          <div className="text-[10px] text-muted-foreground">Silhueta executiva masculina</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Tom de Pele — sprite catalog is a single flattened image, not independently recolorable layers. */}
                  <div>
                    <Label className="text-xs font-bold text-foreground mb-2 block">Pele e expressão</Label>
                    <p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                      Visual completo · pele e expressão do modelo.
                    </p>
                  </div>
                </TabsContent>

                {/* 2. CABELO (Cortes & Cores) */}
                <TabsContent value="hair" className="mt-0 space-y-5">
                  {/* Hair color is baked into each full-body catalog sprite. */}
                  <div>
                    <p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                      A cor vem no modelo. Escolha um corte para trocar a prévia.
                    </p>
                  </div>

                  {/* Cortes Modulares ZAI (Topo da aba Cabelo) */}
                  <div>
                    <Label className="text-xs font-bold text-foreground mb-2 block">
                      Cortes Modulares ZAI
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {AVATAR_HAIRS.map((h) => (
                        <button
                          key={h.id}
                          data-avatar-item={h.id}
                          type="button"
                          onClick={() => setAvatar((prev) => ({
                            ...prev,
                            hair: h.id,
                            hairColor: AVATAR_HAIR_COLORS[h.id] || prev.hairColor,
                            catalogSpriteId: resolveItemSpriteForGender(h, prev.body) || resolveSpriteForAvatar({ ...prev, hair: h.id, catalogSpriteId: undefined }, true),
                          }))}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            avatar.hair === h.id
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-border hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(h, avatar.body)} focus="hair" title={h.title} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{h.title}</div>
                              <div className="text-[10px] text-muted-foreground line-clamp-2">{h.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lista de Cortes do Catálogo */}
                  <div className="pt-3 border-t border-border/50">
                    <Label className="text-xs font-bold text-foreground mb-2 block">
                      Cortes Disponíveis
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {availableHairstyles.map((h) => (
                        <button
                          key={h.id}
                          data-avatar-item={h.id}
                          type="button"
                          onClick={() => setAvatar((prev) => ({
                            ...prev,
                            hair: h.id,
                            hairColor: AVATAR_HAIR_COLORS[h.id] || prev.hairColor,
                            catalogSpriteId: resolveItemSpriteForGender(h, prev.body) || resolveSpriteForAvatar({ ...prev, hair: h.id, catalogSpriteId: undefined }, true),
                          }))}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            avatar.hair === h.id
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-border hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(h, avatar.body)} focus="hair" title={h.name} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{h.name}</div>
                              <div className="text-[10px] text-muted-foreground line-clamp-2">{h.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* ROSTO (Expressões e Olhares) */}
                <TabsContent value="face" className="mt-0 space-y-4">
                  <Label className="text-xs font-bold text-foreground block">
                    Expressões Faciais
                  </Label>
                  <p className="text-xs text-muted-foreground">Escolha a expressão que melhor reflete a postura do atendente.</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {AVATAR_FACES.map((f) => (
                      <button
                        key={f.id}
                        data-avatar-item={f.id}
                        type="button"
                        onClick={() =>
                          setAvatar((prev) => ({
                            ...prev,
                            face: f.id,
                            catalogSpriteId: resolveItemSpriteForGender(f, prev.body) || prev.catalogSpriteId,
                          }))
                        }
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all",
                          (avatar.face === f.id || (!avatar.face && f.id === "face_01"))
                            ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                            : "border-border hover:border-border/80 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <AvatarItemPreview spriteRef={resolveItemSpriteForGender(f, avatar.body)} focus="face" title={f.title} />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">{f.title}</div>
                            <div className="text-[10px] text-muted-foreground line-clamp-2">{f.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                {/* 3. ROUPAS (Uniformes & Vestuário) */}
                <TabsContent value="clothing" className="mt-0 space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-foreground block mb-1">
                      Roupas Modulares ZAI
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2.5">Escolha o traje corporativo ou uniforme operacional do atendente.</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {AVATAR_OUTFITS.map((o) => (
                        <button
                          key={o.id}
                          data-avatar-item={o.id}
                          type="button"
                          onClick={() => {
                            setAvatar((prev) => {
                              const updated = { ...prev, outfit: o.id, clothing: o.id };
                              return {
                                ...updated,
                                catalogSpriteId: resolveItemSpriteForGender(o, prev.body) || resolveSpriteForAvatar(updated, true),
                              };
                            });
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            (avatar.outfit === o.id || avatar.clothing === o.id)
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-border hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(o, avatar.body)} focus="outfit" title={o.title} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{o.title}</div>
                              <div className="text-[10px] text-muted-foreground line-clamp-2">{o.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50">
                    <Label className="text-xs font-bold text-foreground block mb-2">
                      Uniformes & Trajes Corporativos
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {CLOTHING_STYLES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setAvatar((prev) => {
                              const updated = { ...prev, clothing: c.id };
                              return {
                                ...updated,
                                catalogSpriteId: resolveItemSpriteForGender(c, prev.body) || resolveSpriteForAvatar(updated, true),
                              };
                            });
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            avatar.clothing === c.id
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-border hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(c, avatar.body)} focus="outfit" title={c.name} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{c.name}</div>
                              <div className="text-[10px] text-muted-foreground line-clamp-2">{c.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50">
                    <Label className="text-xs font-bold text-foreground block mb-2">
                      Modelos completos e uniformes do catálogo
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {availableHairstyles.map((c) => (
                        <button
                          key={c.id}
                          data-avatar-item={c.id}
                          type="button"
                          onClick={() => selectCatalogLook(c)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            avatar.hair === c.id
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-border hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <AvatarItemPreview spriteRef={c.spriteRef} focus="full" title={c.name} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{c.name}</div>
                              <div className="text-[10px] text-muted-foreground line-clamp-2">Visual completo · {c.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* 4. ACESSÓRIOS & OBJETOS */}
                <TabsContent value="accessories" className="mt-0 space-y-5">
                  {/* Headset & Equipamentos */}
                  <div>
                    <Label className="text-xs font-bold text-foreground mb-2 block">
                      Comunicação & Headset
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ACCESSORIES.filter((a) => a.category === "headset").map((acc) => {
                        const isEquipped = avatar.headset === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => handleEquipToggle("headset", acc.id)}
                            className={cn(
                              "p-2 rounded-xl border text-left transition-all flex items-center gap-2",
                              isEquipped
                                ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                                : "border-border hover:border-border/80 text-muted-foreground"
                            )}
                          >
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(acc, avatar.body)} focus="accessory-head" title={acc.name} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{acc.name}</div>
                              <div className="text-[9px] text-muted-foreground mt-0.5">{isEquipped ? "Equipado ✓" : "Equipar"}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Óculos & Cabeça */}
                  <div>
                    <Label className="text-xs font-bold text-foreground mb-2 block">
                      Óculos & Chapelaria
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ACCESSORIES.filter((a) => a.category === "glasses" || a.category === "headwear").map((acc) => {
                        const isEquipped = avatar.glasses === acc.id || avatar.accessories.headwear === acc.id;
                        const slot = acc.category === "glasses" ? "glasses" : "headwear";
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => handleEquipToggle(slot, acc.id)}
                            className={cn(
                              "p-2 rounded-xl border text-left transition-all flex items-center gap-2",
                              isEquipped
                                ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                                : "border-border hover:border-border/80 text-muted-foreground"
                            )}
                          >
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(acc, avatar.body)} focus="accessory-head" title={acc.name} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{acc.name}</div>
                              <div className="text-[9px] text-muted-foreground mt-0.5">{isEquipped ? "Equipado ✓" : "Equipar"}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Objetos de Trabalho */}
                  <div>
                    <Label className="text-xs font-bold text-foreground mb-2 block">
                      Objeto de Trabalho em Mãos
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {WORK_OBJECTS.map((obj) => (
                        <button
                          key={obj.id}
                          type="button"
                          onClick={() => handleEquipToggle("workObject", obj.id)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            avatar.workObject === obj.id
                              ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                              : "border-border hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(obj, avatar.body)} focus="accessory-body" title={obj.name} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{obj.name}</div>
                              <div className="text-[10px] text-muted-foreground line-clamp-2">{obj.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50">
                    <Label className="text-xs font-bold text-foreground mb-2 block">
                      Acessórios Modulares ZAI
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {AVATAR_ACCESSORIES.map((a) => {
                        const isEquipped =
                          (a.id === "acc_01" && (!avatar.headset || avatar.headset === "none") && (!avatar.glasses || avatar.glasses === "none")) ||
                          (a.id === "acc_02" && avatar.headset === "headset_zai_green") ||
                          (a.id === "acc_03" && avatar.accessories?.badge === "badge_zai_lanyard") ||
                          (a.id === "acc_04" && (avatar.glasses === "glasses_square_exec" || avatar.glasses?.includes("glasses"))) ||
                          (a.id === "acc_05" && avatar.workObject === "tablet_zai") ||
                          (a.id === "acc_06" && avatar.accessories?.watch === "watch_zai_smart");
                        return (
                          <button
                            key={a.id}
                            data-avatar-item={a.id}
                            type="button"
                            onClick={() => {
                              const curAcc = { ...(avatar.accessories || {}) };
                              let updHeadset = avatar.headset;
                              let updGlasses = avatar.glasses;
                              let updWorkObject = avatar.workObject;
                              if (a.id === "acc_01") {
                                updHeadset = "none";
                                updGlasses = "none";
                              } else if (a.id === "acc_02") {
                                updHeadset = updHeadset === "headset_zai_green" ? "none" : "headset_zai_green";
                                curAcc.headset = updHeadset;
                              } else if (a.id === "acc_03") {
                                curAcc.badge = curAcc.badge === "badge_zai_lanyard" ? "none" : "badge_zai_lanyard";
                              } else if (a.id === "acc_04") {
                                updGlasses = updGlasses === "glasses_square_exec" ? "none" : "glasses_square_exec";
                                curAcc.glasses = updGlasses;
                              } else if (a.id === "acc_05") {
                                updWorkObject = updWorkObject === "tablet_zai" ? "none" : "tablet_zai";
                              } else if (a.id === "acc_06") {
                                curAcc.watch = curAcc.watch === "watch_zai_smart" ? "none" : "watch_zai_smart";
                              }
                              setAvatar((prev) => ({
                                ...prev,
                                accessories: curAcc,
                                headset: updHeadset,
                                glasses: updGlasses,
                                workObject: updWorkObject,
                              }));
                            }}
                            className={cn(
                              "p-2.5 rounded-xl border text-left transition-all",
                              isEquipped
                                ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                                : "border-border hover:border-border/80 text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <AvatarItemPreview
                                spriteRef={resolveItemSpriteForGender(a, avatar.body)}
                                focus={a.id === "acc_02" || a.id === "acc_04" ? "accessory-head" : "accessory-body"}
                                title={a.title}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">{a.title}</div>
                                <div className="text-[10px] text-muted-foreground line-clamp-1">{a.description}</div>
                                <div className="text-[9px] text-emerald-400/90 mt-0.5">{isEquipped ? "Equipado ✓" : "Equipar"}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* ESTILO (Presets de Identidade) */}
                <TabsContent value="style" className="mt-0 space-y-4">
                  <Label className="text-xs font-bold text-foreground block">
                    Presets de Identidade & Estilo
                  </Label>
                  <p className="text-xs text-muted-foreground">Selecione um estilo operacional para configurar o conjunto completo.</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {AVATAR_STYLES.map((s) => (
                      <button
                        key={s.id}
                        data-avatar-item={s.id}
                        type="button"
                        onClick={() => setAvatar((prev) => applyStylePreset(prev, s.id))}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all",
                          avatar.style === s.id
                            ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                            : "border-border hover:border-border/80 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <AvatarItemPreview
                            spriteRef={resolveItemSpriteForGender(s, avatar.body)}
                            focus="full"
                            title={s.title}
                            accentColor={s.preset?.color}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">{s.title}</div>
                            <div className="text-[10px] text-muted-foreground line-clamp-2">{s.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                {/* 5. PADRÃO DA LOJA (Store Visual DNA) */}
                <TabsContent value="branding" className="mt-0 space-y-5">
                  <div className="p-4 rounded-xl bg-card/60 border border-border/60 space-y-3">
                    <div className="flex items-center gap-2">
                      <Storefront className="w-5 h-5 text-emerald-400" />
                      <div className="text-sm font-bold text-foreground">
                        {store ? `DNA Visual de ${store.name}` : "DNA da Loja"}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      O DNA Visual define o padrão institucional compartilhado por todos os atendentes desta loja
                      (cores corporativas, crachás e uniformes). Cada agente preserva sua individualidade de rosto e cabelo,
                      evitando que sejam clones.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Cor Primária da Loja</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={avatar.branding?.primaryColor || "#10b981"}
                            onChange={(e) =>
                              setAvatar((prev) => ({
                                ...prev,
                                branding: { ...prev.branding, primaryColor: e.target.value },
                              }))
                            }
                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <span className="text-xs font-mono">{avatar.branding?.primaryColor || "#10b981"}</span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">Texto da Logo</Label>
                        <Input
                          value={avatar.branding?.logo || "ZAI"}
                          onChange={(e) =>
                            setAvatar((prev) => ({
                              ...prev,
                              branding: { ...prev.branding, logo: e.target.value.toUpperCase().slice(0, 10) },
                            }))
                          }
                          className="h-8 text-xs font-bold uppercase mt-1"
                          maxLength={10}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleApplyStoreDNA}
                        className="text-xs flex-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <ArrowsClockwise className="w-3.5 h-3.5 mr-1" />
                        Restaurar Padrão da Loja
                      </Button>

                      {store && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleSaveAsStoreDNA}
                          className="text-xs flex-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                          Definir Como Padrão Oficial
                        </Button>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="sticky bottom-0 z-20 w-full shrink-0 flex-row items-center justify-between gap-2 border-t border-border/50 bg-card/95 p-3 sm:p-4">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span>Prévia do visual</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="shrink-0"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="shrink-0 bg-emerald-600 font-bold text-white shadow-md hover:bg-emerald-500"
            >
              {isSaving ? (
                <>Salvando...</>
              ) : (
                <>
                  <FloppyDisk className="w-4 h-4" />
                  <span>Salvar Avatar</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
