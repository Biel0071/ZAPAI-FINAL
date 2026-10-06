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
} from "./AvatarDefinition";
import {
  createAgentAvatar,
  equipItem,
  unequipItem,
  randomizeAvatar,
  buildStoreVisualDNA,
  resolveSpriteForAvatar,
} from "./CharacterFactory";
import { ZaiAvatarRenderer } from "./ZaiAvatarRenderer";
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
} from "@phosphor-icons/react";

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

  // Re-sync when agent changes
  useEffect(() => {
    if (open && agent) {
      setAvatar(normalizeAvatarConfig(agent.avatarConfig, agent, store, storeDNA));
    }
  }, [open, agent, store, storeDNA]);

  // Gender-based hair catalog
  const availableHairstyles = avatar.body === "male" ? HAIRSTYLES_MALE : HAIRSTYLES_FEMALE;

  const handleGenderChange = (newGender: "male" | "female") => {
    const newHair = newGender === "male" ? "male_short_fade" : "female_ponytail_brunette";
    setAvatar((prev) => ({
      ...prev,
      body: newGender,
      hair: newHair,
      catalogSpriteId: resolveSpriteForAvatar({ ...prev, body: newGender, hair: newHair }, true),
    }));
  };

  const selectCatalogLook = (item: { id: string; spriteRef?: string }) => {
    setAvatar((prev) => ({
      ...prev,
      hair: item.id,
      catalogSpriteId: item.spriteRef || resolveSpriteForAvatar({ ...prev, hair: item.id, catalogSpriteId: undefined }, true),
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
    setAvatar((prev) => ({
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
    }));
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
      const spriteId = avatar.catalogSpriteId || resolveSpriteForAvatar(avatar, true);
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-border/70 shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/50 bg-card/60">
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
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[480px] max-h-[75vh]">
          
          {/* LEFT: Live Avatar Preview & State Controller */}
          <div className="md:col-span-5 bg-gradient-to-b from-card/80 via-card/40 to-background p-6 border-r border-border/50 flex flex-col items-center justify-between relative overflow-hidden">
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
            </div>

            {/* Center: Interactive Real-time Avatar Renderer (Expanded & Scaled Up) */}
            <div className="relative my-auto flex-1 flex flex-col items-center justify-center py-6 w-full">
              <div className="w-full h-[340px] transition-transform duration-300 drop-shadow-2xl">
                <ZaiAvatarRenderer
                  avatar={avatar}
                  state={previewState}
                  size="workspace"
                  showAura={true}
                  showStatusBadge={true}
                  showBrandingLayer={true}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Layer Customization Tabs */}
          <div className="md:col-span-7 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="p-3 border-b border-border/50 bg-card/30">
                <TabsList className="grid grid-cols-5 w-full bg-background/60 p-1">
                  <TabsTrigger value="appearance" className="text-xs flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>Corpo</span>
                  </TabsTrigger>
                  <TabsTrigger value="hair" className="text-xs flex items-center gap-1">
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Cabelo</span>
                  </TabsTrigger>
                  <TabsTrigger value="clothing" className="text-xs flex items-center gap-1">
                    <TShirt className="w-3.5 h-3.5" />
                    <span>Roupas</span>
                  </TabsTrigger>
                  <TabsTrigger value="accessories" className="text-xs flex items-center gap-1">
                    <Eyeglasses className="w-3.5 h-3.5" />
                    <span>Acessórios</span>
                  </TabsTrigger>
                  <TabsTrigger value="branding" className="text-xs flex items-center gap-1">
                    <Storefront className="w-3.5 h-3.5" />
                    <span>Loja DNA</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Scrollable Content for Tabs */}
              <div className="flex-1 p-5 overflow-y-auto max-h-[420px] space-y-5">
                
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
                        <User className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="text-xs font-bold">Feminino</div>
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
                        <User className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="text-xs font-bold">Masculino</div>
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

                  {/* Lista de Cortes */}
                  <div>
                    <Label className="text-xs font-bold text-foreground mb-2 block">
                      Cortes Disponíveis ({availableHairstyles.length} modelos)
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
                            catalogSpriteId: h.spriteRef || resolveSpriteForAvatar({ ...prev, hair: h.id, catalogSpriteId: undefined }, true),
                          }))}
                          className={cn(
                            "p-3 rounded-xl border text-left transition-all",
                            avatar.hair === h.id
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-border hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {h.spriteRef && <img src={`/assets/avatar_factory/catalog/${h.spriteRef}_clean.png`} alt="" className="h-12 w-8 object-contain" style={{ imageRendering: "pixelated" }} />}
                            <div><div className="text-xs font-bold text-foreground">{h.name}</div><div className="text-[10px] text-muted-foreground">{h.description}</div></div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* 3. ROUPAS (Uniformes & Vestuário) */}
                <TabsContent value="clothing" className="mt-0 space-y-4">
                  <Label className="text-xs font-bold text-foreground block">
                    Modelos completos e uniformes do catálogo
                  </Label>
                  <p className="text-xs text-muted-foreground">Escolha um visual completo ou traje corporativo do atendente.</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {availableHairstyles.map((c) => (
                      <button
                        key={c.id}
                        data-avatar-item={c.id}
                        type="button"
                        onClick={() => selectCatalogLook(c)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          avatar.hair === c.id
                            ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                            : "border-border hover:border-border/80 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {c.spriteRef && <img src={`/assets/avatar_factory/catalog/${c.spriteRef}_clean.png`} alt="" className="h-14 w-9 object-contain" style={{ imageRendering: "pixelated" }} />}
                          <div><div className="text-xs font-bold text-foreground">{c.name}</div><div className="text-[10px] text-muted-foreground">Visual completo · {c.description}</div></div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-border/50">
                    <Label className="text-xs font-bold text-foreground block mb-2">
                      Uniformes & Trajes Corporativos ({CLOTHING_STYLES.length} opções)
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {CLOTHING_STYLES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setAvatar((prev) => {
                              const updated = { ...prev, clothing: c.id };
                              return {
                                ...updated,
                                catalogSpriteId: c.spriteRef || resolveSpriteForAvatar(updated, true),
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
                          <div className="text-xs font-bold text-foreground">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">{c.description}</div>
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
                    <div className="grid grid-cols-3 gap-2">
                      {ACCESSORIES.filter((a) => a.category === "headset").map((acc) => {
                        const isEquipped = avatar.headset === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => handleEquipToggle("headset", acc.id)}
                            className={cn(
                              "p-2.5 rounded-xl border text-left transition-all",
                              isEquipped
                                ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                                : "border-border hover:border-border/80 text-muted-foreground"
                            )}
                          >
                            <div className="text-xs font-bold text-foreground">{acc.name}</div>
                            <div className="text-[9px] text-muted-foreground mt-0.5">{isEquipped ? "Equipado ✓" : "Equipar"}</div>
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
                    <div className="grid grid-cols-3 gap-2">
                      {ACCESSORIES.filter((a) => a.category === "glasses" || a.category === "headwear").map((acc) => {
                        const isEquipped = avatar.glasses === acc.id || avatar.accessories.headwear === acc.id;
                        const slot = acc.category === "glasses" ? "glasses" : "headwear";
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => handleEquipToggle(slot, acc.id)}
                            className={cn(
                              "p-2.5 rounded-xl border text-left transition-all",
                              isEquipped
                                ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                                : "border-border hover:border-border/80 text-muted-foreground"
                            )}
                          >
                            <div className="text-xs font-bold text-foreground">{acc.name}</div>
                            <div className="text-[9px] text-muted-foreground mt-0.5">{isEquipped ? "Equipado ✓" : "Equipar"}</div>
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
                    <div className="grid grid-cols-2 gap-2">
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
                          <div className="text-xs font-bold text-foreground">{obj.name}</div>
                          <div className="text-[10px] text-muted-foreground">{obj.description}</div>
                        </button>
                      ))}
                    </div>
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
        <DialogFooter className="p-4 border-t border-border/50 bg-card/60 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Prévia do visual</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-md"
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
