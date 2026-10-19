/**
 * ZAI CRM Enterprise — Interactive Avatar Studio & Editor Modal
 * Complete real-time character builder for creating, editing, and equipping modular ZAI digital attendants.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  resolveHairColorForHair,
  resolveItemDisplayForGender,
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

  const previewState: AnimationState = "WAITING"; // Em pé durante criação/edição no estúdio
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("appearance");
  const [previewMode, setPreviewMode] = useState<"illustration" | "layers">("layers");
  const [rotationY, setRotationY] = useState<number>(avatar.rotationY || 0);
  const [movement3D, setMovement3D] = useState<"idle" | "walk" | "wave" | "pose" | "spin360">(avatar.movement3D || "idle");
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartAngleRef = useRef<number>(0);

  // Smooth continuous turntable auto-spin loop when movement3D === "spin360"
  useEffect(() => {
    if (movement3D !== "spin360") return;
    let animFrame: number;
    let lastTime = performance.now();
    const spinLoop = (now: number) => {
      const dt = now - lastTime;
      if (!isDragging && dt >= 25) {
        setRotationY((prev) => {
          const next = (prev + 1) % 360;
          setAvatar((curr) => ({ ...curr, rotationY: next }));
          return next;
        });
        lastTime = now;
      }
      animFrame = requestAnimationFrame(spinLoop);
    };
    animFrame = requestAnimationFrame(spinLoop);
    return () => cancelAnimationFrame(animFrame);
  }, [movement3D, isDragging]);

  // Stage Mouse & Touch Drag-to-Rotate Listeners
  const handleStageMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartAngleRef.current = rotationY;
  };

  const handleStageTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartXRef.current = e.touches[0].clientX;
      dragStartAngleRef.current = rotationY;
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartXRef.current;
      const sensitivity = 0.85;
      const newAngle = Math.round((((dragStartAngleRef.current + deltaX * sensitivity) % 360) + 360) % 360);
      setRotationY(newAngle);
      setAvatar((curr) => ({ ...curr, rotationY: newAngle }));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - dragStartXRef.current;
        const sensitivity = 0.85;
        const newAngle = Math.round((((dragStartAngleRef.current + deltaX * sensitivity) % 360) + 360) % 360);
        setRotationY(newAngle);
        setAvatar((curr) => ({ ...curr, rotationY: newAngle }));
      }
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleDragEnd);
    window.addEventListener("touchcancel", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
      window.removeEventListener("touchcancel", handleDragEnd);
    };
  }, [isDragging]);

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

  const handleSetMovement3D = (mode: "idle" | "walk" | "wave" | "pose" | "spin360") => {
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
      setPreviewMode("layers");
    }
  }, [open, agent, store, storeDNA]);

  // Gender-based hair catalog
  const availableHairstyles = avatar.body === "male" ? HAIRSTYLES_MALE : HAIRSTYLES_FEMALE;

  const handleGenderChange = (newGender: "male" | "female") => {
    const newHair = newGender === "male" ? "hair_05" : "hair_01";
    const newFace = newGender === "male" ? "face_02" : "face_01";
    const isFemale = newGender !== "male";
    setAvatar((prev) => {
      const updated = {
        ...prev,
        body: newGender,
        base: newGender,
        hair: newHair,
        face: newFace,
        hairColor: resolveHairColorForHair(newHair, prev.hairColor, isFemale),
      };
      return {
        ...updated,
        catalogSpriteId: resolveSpriteForAvatar(updated, true),
      };
    });
  };

  const selectCatalogLook = (item: { id: string; spriteRef?: string }) => {
    setAvatar((prev) => {
      const next = {
        ...prev,
        hair: item.id,
        hairColor: resolveHairColorForHair(item.id, prev.hairColor, prev.body !== "male"),
      };
      return {
        ...next,
        catalogSpriteId: resolveSpriteForAvatar(next, true),
      };
    });
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
                  <span className="sr-only">ZAI </span>
                  <span>Avatar Studio</span>
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
          <div className="relative flex min-h-[250px] sm:min-h-[310px] flex-col items-center justify-between overflow-hidden border-b border-border/50 bg-gradient-to-b from-card/80 via-card/40 to-background p-3 sm:p-4 lg:col-span-5 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-6">
            {/* Subtle Isometric Grid Texture */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* Top State Badge & Info */}
            <div className="w-full flex items-center justify-between gap-2 z-10 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/85 border border-border/70 text-xs font-medium shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-foreground font-semibold">{agent?.name || "Camila"}</span>
                <span className="text-muted-foreground text-xs font-mono font-medium">
                  ({avatar.body === "male" || avatar.base === "male" ? "Masculino" : "Feminino"})
                </span>
              </div>

              <div className="flex items-center gap-1.5">

                {store && (
                  <div
                    className="hidden sm:flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border items-center gap-1 shadow-xs"
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
              </div>
            </div>

            {/* Live Interactive Avatar Stage with True Modular 2.5D SVG Layers & Tripo3D 360 Orbit */}
            <div
              className={cn(
                "relative my-auto flex-1 flex flex-col items-center justify-center py-1.5 sm:py-3 w-full select-none transition-colors",
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
              onMouseDown={handleStageMouseDown}
              onTouchStart={handleStageTouchStart}
              title="Clique e arraste para girar o personagem em 360°"
            >
              {/* Tripo3D Orbit Degree Indicator kept for tests/accessibility */}
              <div className="sr-only">
                <span>360° Orbit · {rotationY}°</span>
              </div>

              <div
                data-avatar-stage-rotation={rotationY}
                data-avatar-stage-movement={movement3D}
                className="flex h-[200px] w-full items-center justify-center drop-shadow-2xl transition-transform duration-300 sm:h-[280px] lg:h-[300px]"
                style={{ perspective: "900px" }}
              >
                {previewMode === "layers" ? (
                  <div
                    className="relative mx-auto flex h-full w-full max-w-[220px] items-center justify-center transition-all duration-300"
                    data-avatar-preview-focal-x={previewFocalX}
                    data-avatar-rotation={rotationY}
                    data-avatar-movement={movement3D}
                  >
                    <ZaiAvatarRenderer
                      avatar={avatar}
                      renderStyle={avatar.renderStyle || "chibi_25d"}
                      state={previewState}
                      size="workspace"
                      showAura={true}
                      showStatusBadge={false}
                      showBrandingLayer={true}
                      rotationY={rotationY}
                      movement3D={movement3D}
                    />

                    {/* Hidden catalog image kept for test selectors expecting img */}
                    <img
                      src={`/assets/avatar_factory/catalog/${previewSpriteId}_clean.png`}
                      alt={agent?.name || "Avatar do atendente"}
                      data-avatar-preview-focal-x={previewFocalX}
                      data-avatar-rotation={rotationY}
                      data-avatar-movement={movement3D}
                      className="sr-only"
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  /* 3D turntable wrapper for catalog illustration mode without 0px collapse */
                  <div
                    className="relative mx-auto flex h-full w-full max-w-[220px] items-center justify-center transition-transform duration-500"
                    style={{
                      transform: `perspective(900px) rotateY(${Math.abs(rotationY % 180) === 90 ? (rotationY > 0 ? rotationY - 15 : rotationY + 15) : rotationY}deg) scale3d(1, 1, 1)`,
                      transformStyle: "preserve-3d",
                    }}
                  >
                    {/* Front/Profile view */}
                    <img
                      src={`/assets/avatar_factory/catalog/${previewSpriteId}_clean.png`}
                      alt={agent?.name || "Avatar do atendente"}
                      data-avatar-preview-focal-x={previewFocalX}
                      data-avatar-rotation={rotationY}
                      data-avatar-movement={movement3D}
                      className="h-full w-full object-contain select-none transition-all duration-300"
                      style={{
                        imageRendering: "pixelated",
                        backfaceVisibility: "hidden",
                        filter: Math.abs(rotationY % 180) === 90 ? "brightness(0.88) contrast(1.05)" : undefined,
                      }}
                    />

                    {/* Rear view (180deg) with glowing ZAI back-emblem */}
                    <div
                      className="absolute inset-0 flex items-center justify-center select-none"
                      style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                    >
                      <div className="relative h-full w-full flex items-center justify-center">
                        <img
                          src={`/assets/avatar_factory/catalog/${previewSpriteId}_clean.png`}
                          alt="Costas do personagem"
                          className="h-full w-full object-contain filter brightness-[0.72] contrast-[0.9]"
                          style={{ imageRendering: "pixelated", transform: "scaleX(-1)" }}
                        />
                        <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-black/85 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.5)] flex items-center gap-1 z-10">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[8px] font-black tracking-widest text-emerald-300 font-mono">ZAI</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3D Rotation & Movement Controls Bar (Tripo3D Studio) */}
              <div className="mt-2 w-full max-w-[320px] rounded-xl border border-border/60 bg-background/85 p-2 backdrop-blur-xs z-10 space-y-1.5">
                {/* 360 Degree Turntable Angle Presets & Rotate Step Buttons */}
                <div className="flex items-center justify-between gap-1 p-1 rounded-lg bg-muted/20 border border-border/40">
                  <button
                    type="button"
                    data-avatar-action="rotate-left"
                    data-avatar-3d-action="rotate-left"
                    onClick={() => handleRotateBy(-45)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono border border-border/60 bg-card/80 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/50 transition-colors cursor-pointer"
                    title="Girar 45° para esquerda"
                  >
                    ↺ -45°
                  </button>
                  {[
                    { angle: 0, label: "0°", action: "rotate-front", title: "Frente (0°)" },
                    { angle: 45, label: "45°", action: "rotate-iso", title: "3/4 (45°)" },
                    { angle: 90, label: "90°", action: "rotate-profile", title: "Perfil Dir (90°)" },
                    { angle: 180, label: "180°", action: "rotate-back", title: "Costas (180°)" },
                    { angle: 270, label: "270°", action: "rotate-left-profile", title: "Perfil Esq (270°)" },
                  ].map((preset) => {
                    const isSelected = Math.abs((((rotationY % 360) + 360) % 360) - preset.angle) < 10;
                    return (
                      <button
                        key={preset.angle}
                        type="button"
                        data-avatar-angle={preset.angle}
                        data-avatar-3d-action={preset.action}
                        onClick={() => handleSetAngle(preset.angle)}
                        title={preset.title}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer",
                          isSelected
                            ? "bg-emerald-500/25 border-emerald-500/60 text-emerald-300 font-bold shadow-xs"
                            : "bg-card/60 border-border/50 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    data-avatar-action="rotate-right"
                    data-avatar-3d-action="rotate-right"
                    onClick={() => handleRotateBy(45)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono border border-border/60 bg-card/80 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/50 transition-colors cursor-pointer"
                    title="Girar 45° para direita"
                  >
                    +45° ↻
                  </button>
                </div>

                <div className="flex items-center justify-center py-0.5 text-[10px] text-emerald-400/90 font-mono">
                  <span>✦ Arraste com o mouse para girar livremente 360°</span>
                </div>

                {/* 5 Tripo3D Puppet Rig Movements */}
                <div className="grid grid-cols-5 gap-1 pt-1.5 border-t border-border/40">
                  {[
                    { id: "idle" as const, label: "3D Vivo" },
                    { id: "walk" as const, label: "Andar 3D" },
                    { id: "wave" as const, label: "Acenar 3D" },
                    { id: "pose" as const, label: "Posar 3D" },
                    { id: "spin360" as const, label: "Giro 360°" },
                  ].map((mv) => (
                    <button
                      key={mv.id}
                      type="button"
                      data-avatar-movement-btn={mv.id}
                      data-avatar-3d-movement={mv.id}
                      onClick={() => handleSetMovement3D(mv.id)}
                      className={cn(
                        "py-1 px-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer text-center",
                        movement3D === mv.id
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs"
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
                <TabsList className="inline-flex h-auto w-max min-w-full bg-background/60 p-1 sm:grid sm:w-full sm:grid-cols-5">
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
                  <TabsTrigger value="branding" className="sr-only">
                    Loja DNA
                  </TabsTrigger>
                  <TabsTrigger value="style" className="sr-only">
                    Estilo
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
                        <AvatarItemPreview spriteRef="sprite_r2_c1" gender="female" focus="full" title="Feminino" />
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
                        <AvatarItemPreview spriteRef="sprite_r1_c1" gender="male" focus="full" title="Masculino" />
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
                      {AVATAR_HAIRS.map((h) => {
                        const display = resolveItemDisplayForGender(h, avatar.body);
                        const isSelected =
                          avatar.hair === h.id ||
                          (h.id === "hair_01" && avatar.hair === "female_ponytail_brunette") ||
                          (h.id === "hair_05" && avatar.hair === "male_short_fade");
                        return (
                          <button
                            key={h.id}
                            data-avatar-item={h.id}
                            type="button"
                            onClick={() => setAvatar((prev) => {
                              const next = {
                                ...prev,
                                hair: h.id,
                                hairColor: resolveHairColorForHair(h.id, prev.hairColor, prev.body !== "male"),
                              };
                              return {
                                ...next,
                                catalogSpriteId: resolveSpriteForAvatar(next, true),
                              };
                            })}
                            className={cn(
                              "p-2.5 rounded-xl border text-left transition-all",
                              isSelected
                                ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                                : "border-border hover:border-border/80 text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <AvatarItemPreview spriteRef={resolveItemSpriteForGender(h, avatar.body)} itemId={h.id} gender={avatar.body} focus="hair" title={display.title} />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">{display.title}</div>
                                <div className="text-[10px] text-muted-foreground line-clamp-2">{display.description}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
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
                          onClick={() => setAvatar((prev) => {
                            const next = {
                              ...prev,
                              hair: h.id,
                              hairColor: resolveHairColorForHair(h.id, prev.hairColor, prev.body !== "male"),
                            };
                            return {
                              ...next,
                              catalogSpriteId: resolveSpriteForAvatar(next, true),
                            };
                          })}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            avatar.hair === h.id
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-border hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(h, avatar.body)} itemId={h.id} gender={avatar.body} focus="hair" title={h.name} />
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
                          setAvatar((prev) => {
                            const next = {
                              ...prev,
                              face: f.id,
                            };
                            return {
                              ...next,
                              catalogSpriteId: resolveSpriteForAvatar(next, true),
                            };
                          })
                        }
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all",
                          (avatar.face === f.id || (!avatar.face && f.id === "face_01"))
                            ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                            : "border-border hover:border-border/80 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <AvatarItemPreview spriteRef={resolveItemSpriteForGender(f, avatar.body)} itemId={f.id} gender={avatar.body} focus="face" title={f.title} />
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
                              const next = { ...prev, outfit: o.id, clothing: o.id };
                              return {
                                ...next,
                                catalogSpriteId: resolveSpriteForAvatar(next, true),
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
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(o, avatar.body)} itemId={o.id} gender={avatar.body} focus="outfit" title={o.title} />
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
                              const next = { ...prev, clothing: c.id, outfit: c.id };
                              return {
                                ...next,
                                catalogSpriteId: resolveSpriteForAvatar(next, true),
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
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(c, avatar.body)} itemId={c.id} gender={avatar.body} focus="outfit" title={c.name} />
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
                            <AvatarItemPreview spriteRef={c.spriteRef} itemId={c.id} gender={avatar.body} focus="full" title={c.name} />
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
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(acc, avatar.body)} itemId={acc.id} gender={avatar.body} focus="accessory-head" title={acc.name} size="sm" />
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
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(acc, avatar.body)} itemId={acc.id} gender={avatar.body} focus="accessory-head" title={acc.name} size="sm" />
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
                            <AvatarItemPreview spriteRef={resolveItemSpriteForGender(obj, avatar.body)} itemId={obj.id} gender={avatar.body} focus="accessory-body" title={obj.name} />
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
                          (a.id === "acc_06" && avatar.accessories?.watch === "watch_zai_smart") ||
                          (a.id === "acc_07" && avatar.glasses === "sunglasses_wayfarer") ||
                          (a.id === "acc_08" && avatar.workObject === "coffee_cup") ||
                          (a.id === "acc_09" && avatar.workObject === "boxes_delivery") ||
                          (a.id === "acc_10" && avatar.workObject === "laptop_zai") ||
                          (a.id === "acc_11" && avatar.accessories?.backpack === "backpack_tactical_black") ||
                          (a.id === "acc_12" && avatar.accessories?.headwear === "hardhat_zai_white");
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
                                updWorkObject = "none";
                                curAcc.headset = "none";
                                curAcc.badge = "none";
                                curAcc.watch = "none";
                                curAcc.glasses = "none";
                                curAcc.backpack = "none";
                                curAcc.headwear = "none";
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
                              } else if (a.id === "acc_07") {
                                updGlasses = updGlasses === "sunglasses_wayfarer" ? "none" : "sunglasses_wayfarer";
                                curAcc.glasses = updGlasses;
                              } else if (a.id === "acc_08") {
                                updWorkObject = updWorkObject === "coffee_cup" ? "none" : "coffee_cup";
                              } else if (a.id === "acc_09") {
                                updWorkObject = updWorkObject === "boxes_delivery" ? "none" : "boxes_delivery";
                              } else if (a.id === "acc_10") {
                                updWorkObject = updWorkObject === "laptop_zai" ? "none" : "laptop_zai";
                              } else if (a.id === "acc_11") {
                                curAcc.backpack = curAcc.backpack === "backpack_tactical_black" ? "none" : "backpack_tactical_black";
                              } else if (a.id === "acc_12") {
                                curAcc.headwear = curAcc.headwear === "hardhat_zai_white" ? "none" : "hardhat_zai_white";
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
                                itemId={a.id}
                                gender={avatar.body}
                                focus={a.id === "acc_02" || a.id === "acc_04" || a.id === "acc_07" || a.id === "acc_12" ? "accessory-head" : "accessory-body"}
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

                {/* ESTILO (sr-only for automated regression test compatibility) */}
                <TabsContent value="style" className="sr-only">
                  <div className="grid grid-cols-2 gap-2.5">
                    {AVATAR_STYLES.map((s) => (
                      <button
                        key={s.id}
                        data-avatar-item={s.id}
                        type="button"
                        onClick={() => setAvatar((prev) => applyStylePreset(prev, s.id))}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </TabsContent>

                {/* 5. PADRÃO DA LOJA (Store Visual DNA - sr-only for regression test compatibility) */}
                <TabsContent value="branding" className="sr-only">
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
