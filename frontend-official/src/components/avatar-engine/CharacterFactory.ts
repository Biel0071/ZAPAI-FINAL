/**
 * ZAI CRM Enterprise — Character Factory & Equipment System
 * Builds modular agents, applies Store Visual DNA inheritance, equips/unequips items,
 * and ensures that agents belonging to the same store share brand DNA without being clones.
 */

import {
  AgentAvatarConfig,
  StoreVisualDNA,
  StoreBranding,
  DEFAULT_AVATAR_PRESETS,
  HAIRSTYLES_MALE,
  HAIRSTYLES_FEMALE,
  HAIR_COLORS,
  SKIN_TONES,
  FACE_TYPES,
  WORK_OBJECTS,
  POSTURES,
  AVATAR_STYLES,
  resolveHairColorForHair,
} from "./AvatarDefinition";
import {
  buildSlotUpdate,
  findCatalogItem,
  inferGenderFromConfig,
  normalizeAvatarComposition,
} from "./avatar3d/slotCatalog";

const RENDERER_HAIR_ALIASES: Record<string, string> = {
  female_ponytail_brunette: "hair_01",
  female_straight_glasses: "hair_07",
  female_wavy_blonde: "hair_03",
  female_curly_updo: "hair_04",
  female_long_wavy_coffee: "hair_03",
  female_pink_cap: "hair_01",
  female_short_business: "hair_02",
  female_peace_brunette: "hair_01",
  female_silver_waves: "hair_03",
  female_blue_wavy: "hair_10",
  female_hardhat_brunette: "hair_01",
  male_short_fade: "hair_05",
  male_spiky: "hair_08",
  male_textured_crop: "hair_05",
  male_cap_hair: "hair_05",
  male_curly_brown: "hair_09",
  male_anime_silver: "hair_15",
  male_afro_curls: "hair_06",
  male_professor_beard: "hair_16",
  male_dark_shades: "hair_18",
  male_red_hoodie: "hair_17",
  male_slick_exec: "hair_18",
};

const RENDERER_OUTFIT_ALIASES: Record<string, string> = {
  polo_zai_black: "outfit_01",
  polo_zai_white: "outfit_07",
  upper_polo: "outfit_01",
  shirt_formal_blue: "outfit_02",
  shirt_business_white: "outfit_02",
  upper_shirt: "outfit_02",
  tshirt_casual_dark: "outfit_03",
  hoodie_zai_black: "outfit_04",
  upper_hoodie: "outfit_03",
  blazer_executive_dark: "outfit_05",
  blazer_emerald_trim: "outfit_05",
  upper_blazer: "outfit_05",
  vest_operations: "outfit_06",
  vest_hivis_safety: "outfit_06",
  upper_vest: "outfit_06",
  casual_tee_charcoal: "outfit_07",
  upper_tee: "outfit_07",
  bomber_jacket_tech: "outfit_08",
  jacket_exec_dark: "outfit_08",
  upper_bomber: "outfit_08",
  uniform_tech_navy: "outfit_04",
  delivery_cargo_set: "outfit_10",
  upper_uniform_jacket: "outfit_04",
};

const RENDERER_FACE_ALIASES: Record<string, string> = {
  face_friendly_smile: "face_01",
  face_confident_smirk: "face_02",
  face_glasses_round: "face_01",
  face_glasses_square: "face_02",
  face_dark_sunglasses: "face_06",
  face_beard_mustache: "face_05",
  face_stubble_clean: "face_05",
  face_wink_cheerful: "face_03",
  face_focused_analyst: "face_05",
  face_calm_support: "face_01",
};

const RENDERER_STYLE_ALIASES: Record<string, string> = {
  sales: "style_vendas",
  corporate: "style_corporativo",
  atendimento: "style_atendimento",
  operational: "style_operacional",
  tech: "style_tech",
  casual: "style_casual",
  premium: "style_premium",
  style_executivo: "style_corporativo",
};

/** Normalizes stored catalog identifiers for the renderer without changing persisted avatar data. */
export function normalizeAvatarForRenderer(avatar: Partial<AgentAvatarConfig>): Partial<AgentAvatarConfig> {
  const legacyFace = avatar.face || avatar.eyes;
  const configuredOutfit = avatar.outfit || avatar.clothing || avatar.upperBody;
  const resolvedHair = RENDERER_HAIR_ALIASES[avatar.hair || ""] || avatar.hair || "";
  const inferredGender = inferGenderFromConfig(avatar);
  const isMale = inferredGender === "male";
  const finalHair = /^hair_(0[1-9]|1[0-8])$/.test(resolvedHair)
    ? resolvedHair
    : isMale
    ? "hair_05"
    : "hair_01";
  const resolvedFace = RENDERER_FACE_ALIASES[legacyFace || ""] || legacyFace || "";
  const resolvedOutfit = RENDERER_OUTFIT_ALIASES[configuredOutfit || ""] || configuredOutfit || "";
  const isFemale = !isMale;

  const comp = normalizeAvatarComposition({
    ...avatar,
    body: avatar.body || inferredGender,
    base: avatar.base || (isMale ? "male" : "female"),
  });

  const hairColor =
    avatar.compositionVersion && avatar.compositionVersion >= 2 && avatar.hairColor
      ? avatar.hairColor
      : resolveHairColorForHair(avatar.hair || finalHair, avatar.hairColor, isFemale);

  return {
    ...comp,
    ...avatar,
    compositionVersion: avatar.compositionVersion,
    body: avatar.body || comp.body,
    base: avatar.base || comp.base,
    baseSpriteId: avatar.baseSpriteId || resolveBaseSpriteForAvatar({ ...avatar, hair: finalHair }),
    hair: finalHair,
    hairColor,
    face: /^face_0[1-8]$/.test(resolvedFace) ? resolvedFace : "face_01",
    outfit: /^outfit_(0[1-9]|10)$/.test(resolvedOutfit) ? resolvedOutfit : "outfit_01",
    upperBody: comp.upperBody,
    lowerBody: comp.lowerBody,
    footwear: comp.footwear,
    style: RENDERER_STYLE_ALIASES[avatar.style || ""] || avatar.style || "style_vendas",
    accessories: comp.accessories,
  };
}

/**
 * Builds a default Store Visual DNA for any store
 */
export function buildStoreVisualDNA(store: any): StoreVisualDNA {
  const storeId = String(store?.id || "store-default");
  const storeName = String(store?.name || "ZAI Store").trim();
  const themeColor = String(store?.theme_color || store?.themeColor || "#10b981");

  const existingSettings = store?.settings || {};
  if (existingSettings.storeVisualDNA) {
    return {
      ...existingSettings.storeVisualDNA,
      storeId,
      storeName,
    };
  }

  return {
    storeId,
    storeName,
    primaryColor: themeColor,
    secondaryColor: "#0f172a",
    accentColor: themeColor === "#10b981" ? "#00f090" : themeColor,
    logo: storeName.split(" ")[0]?.toUpperCase() || "ZAI",
    defaultClothing: "polo_zai_black",
    defaultAccessories: ["headset_zai_green", "badge_zai_lanyard"],
    defaultBadge: true,
    defaultShoes: "sneakers_zai_green",
    visualStyle: "pixel_isometric",
  };
}

/**
 * Maps modular layer configurations to the catalog sprite (1-33)
 */
export function resolveSpriteForAvatar(avatar: Partial<AgentAvatarConfig>, forceRecompute: boolean = false): string {
  const inferred = inferGenderFromConfig(avatar);
  const gender = inferred === "male" ? "male" : "female";

  if (!forceRecompute && avatar.catalogSpriteId) {
    if (gender === "female" && avatar.catalogSpriteId.startsWith("sprite_r1_")) {
      return avatar.catalogSpriteId.replace(/^sprite_r1_/, "sprite_r2_");
    }
    if (gender === "male" && avatar.catalogSpriteId.startsWith("sprite_r2_")) {
      return avatar.catalogSpriteId.replace(/^sprite_r2_/, "sprite_r1_");
    }
    return avatar.catalogSpriteId;
  }

  const hair = avatar.hair || "";
  const object = avatar.workObject || "";
  const glasses = avatar.glasses || "none";
  const outfit = avatar.outfit || avatar.clothing || avatar.upperBody || "";
  const face = avatar.face || "";
  const style = avatar.style || "";

  // 1. Check Row 3 Operational Work Objects & Uniforms
  if (object === "boxes_delivery" || object === "prop_boxes" || outfit === "outfit_10") return "sprite_r3_c1";
  if (object === "laptop_zai" || object === "prop_laptop") return "sprite_r3_c5";
  if (outfit === "vest_hivis_safety" || outfit === "outfit_06" || outfit === "upper_vest" || style === "style_operacional") return "sprite_r3_c2";
  if (outfit === "outfit_04" || outfit === "uniform_technical" || outfit === "upper_uniform_jacket") return "sprite_r3_c3";
  if (outfit === "outfit_09") return "sprite_r3_c11";
  if (avatar.accessories?.headwear === "hardhat_zai_white" || avatar.accessories?.headwear === "headwear_hardhat") {
    return gender === "male" ? "sprite_r3_c7" : "sprite_r3_c8";
  }
  if (object === "coffee_cup" || object === "prop_coffee") return gender === "male" ? "sprite_r1_c5" : "sprite_r2_c5";
  if (object === "peace_sign") return gender === "male" ? "sprite_r1_c8" : "sprite_r2_c8";
  if (object === "thumbs_up") return gender === "male" ? "sprite_r1_c7" : "sprite_r2_c7";

  // 2. Female matches (Row 2)
  if (gender === "female") {
    if (face === "face_07" || glasses === "glasses_square_exec" || glasses === "eyewear_executive" || avatar.accessories?.glasses === "glasses_square_exec") return "sprite_r2_c2";
    if (face === "face_08" || glasses === "sunglasses_wayfarer" || glasses === "eyewear_wayfarer" || avatar.accessories?.glasses === "sunglasses_wayfarer" || avatar.glasses?.includes("sunglasses")) return "sprite_r2_c6";

    if (outfit === "outfit_05" || outfit === "upper_blazer" || outfit.includes("blazer")) return "sprite_r2_c8";
    if (outfit === "outfit_02" || outfit === "upper_shirt" || outfit === "shirt_formal_blue") return "sprite_r2_c2";
    if (outfit === "outfit_08" || outfit === "upper_bomber") return "sprite_r2_c10";
    if (avatar.accessories?.headwear?.includes("cap") || outfit === "outfit_03" || outfit === "upper_hoodie") return "sprite_r2_c6";

    if (hair === "hair_11") return "sprite_r2_c6";
    if (hair === "hair_12") return "sprite_r2_c9";
    if (hair === "hair_13") return "sprite_r3_c8";
    if (hair === "hair_14") return "sprite_r2_c6";
    if (hair === "hair_15") return "sprite_r2_c9";
    if (hair === "hair_16") return "sprite_r2_c7";
    if (hair === "hair_17") return "sprite_r2_c6";
    if (hair === "hair_18") return "sprite_r2_c2";
    if (hair === "hair_07" || hair.includes("straight")) return "sprite_r2_c2";
    if (hair === "hair_03" || hair === "hair_08" || hair.includes("wavy") || hair.includes("blonde")) return "sprite_r2_c3";
    if (hair === "hair_04" || hair === "hair_09" || hair.includes("curly") || hair.includes("updo")) return "sprite_r2_c4";
    if (hair === "hair_02" || hair === "hair_06" || hair.includes("short") || hair.includes("business") || hair.includes("afro")) return "sprite_r2_c7";
    if (hair.includes("silver")) return "sprite_r2_c9";
    if (hair === "hair_10" || hair.includes("blue")) return "sprite_r2_c10";
    if (hair === "hair_01" || hair.includes("ponytail")) return "sprite_r2_c1";

    if (object === "tablet_zai" || object === "prop_tablet" || avatar.accessories?.tablet === "tablet_zai") return "sprite_r2_c8";

    if (face === "face_04") return "sprite_r2_c3";
    if (face === "face_03" || style === "style_vendas" || style === "style_corporativo") return "sprite_r2_c8";
    if (face === "face_02") return "sprite_r2_c4";
    if (face === "face_05") return "sprite_r2_c2";
    if (face === "face_06") return "sprite_r2_c7";

    return "sprite_r2_c1";
  }

  // 3. Male matches (Row 1)
  if (face === "face_07" || hair.includes("beard") || avatar.facialHair === "full_beard" || glasses === "glasses_square_exec" || glasses === "eyewear_executive" || avatar.accessories?.glasses === "glasses_square_exec") return "sprite_r1_c8";
  if (face === "face_08" || glasses === "sunglasses_wayfarer" || glasses === "eyewear_wayfarer" || avatar.accessories?.glasses === "sunglasses_wayfarer" || avatar.glasses?.includes("sunglasses")) return "sprite_r1_c9";

  if (outfit === "outfit_05" || outfit === "upper_blazer" || outfit.includes("blazer") || outfit.includes("suit")) return "sprite_r1_c6";
  if (outfit === "outfit_02" || outfit === "upper_shirt" || outfit === "shirt_formal_blue" || outfit === "shirt_business_white") return "sprite_r1_c8";
  if (outfit === "outfit_08" || outfit === "upper_bomber" || outfit.includes("bomber")) return "sprite_r1_c11";
  if (avatar.accessories?.headwear?.includes("cap") || outfit === "outfit_03" || outfit === "upper_hoodie") return "sprite_r1_c4";

  if (hair === "hair_11") return "sprite_r1_c4";
  if (hair === "hair_12") return "sprite_r1_c6";
  if (hair === "hair_13") return "sprite_r3_c7";
  if (hair === "hair_14") return "sprite_r1_c4";
  if (hair === "hair_15") return "sprite_r1_c6";
  if (hair === "hair_16") return "sprite_r1_c8";
  if (hair === "hair_17") return "sprite_r1_c10";
  if (hair === "hair_18") return "sprite_r1_c9";
  if (hair === "hair_07" || hair.includes("straight")) return "sprite_r1_c2";
  if (hair === "hair_08" || hair.includes("spiky") || hair.includes("blonde")) return "sprite_r1_c3";
  if (hair === "hair_09" || hair.includes("curly")) return "sprite_r1_c5";
  if (hair === "hair_10" || hair.includes("silver") || hair.includes("anime")) return "sprite_r1_c6";
  if (hair === "hair_06" || hair.includes("afro") || outfit === "outfit_07") return "sprite_r1_c7";
  if (hair.includes("red")) return "sprite_r1_c10";
  if (hair === "hair_05" || hair === "hair_01" || hair.includes("fade") || hair.includes("short")) return "sprite_r1_c1";

  if (object === "tablet_zai" || object === "prop_tablet") return "sprite_r1_c2";

  if (face === "face_04") return "sprite_r1_c6";
  if (face === "face_03") return "sprite_r1_c3";
  if (face === "face_02") return "sprite_r1_c2";
  if (face === "face_05") return "sprite_r1_c7";
  if (face === "face_06") return "sprite_r1_c4";

  return "sprite_r1_c1";
}

/** Resolves the stable face/body base while excluding the independently rendered hairstyle. */
export function resolveBaseSpriteForAvatar(avatar: Partial<AgentAvatarConfig>): string {
  return resolveSpriteForAvatar({
    ...avatar,
    hair: "",
    catalogSpriteId: undefined,
    baseSpriteId: undefined,
  }, true);
}

/**
 * Applies a style or uniform slot preset: updates ONLY palette colors, trim accent,
 * style tag, and posture WITHOUT overwriting hair, face, clothing, or accessories.
 */
export function applyStylePreset(
  current: AgentAvatarConfig,
  styleId: string,
): AgentAvatarConfig {
  const normalizedId = styleId.toLowerCase();
  const style = AVATAR_STYLES.find(
    (s) =>
      s.id === styleId ||
      s.name.toLowerCase() === normalizedId ||
      (normalizedId.includes("executivo") && s.id === "style_corporativo"),
  );
  const catalogStyle = findCatalogItem(style?.id || styleId);
  const primaryColor = style?.preset?.color || catalogStyle?.palette?.primary || current.branding.primaryColor;
  const accentColor = catalogStyle?.palette?.accent || current.branding.accentColor;
  const posture = style?.preset?.posture || catalogStyle?.palette?.posture || current.personalityVisual.posture;
  const resolvedStyleId = style?.id || catalogStyle?.id || current.style;

  if (!style && !catalogStyle) return current;

  const updated: AgentAvatarConfig = {
    ...current,
    style: resolvedStyleId,
    personalityVisual: {
      ...current.personalityVisual,
      posture,
    },
    branding: {
      ...current.branding,
      primaryColor,
      accentColor,
    },
  };

  updated.baseSpriteId = resolveSpriteForAvatar(updated, true);
  updated.catalogSpriteId = updated.baseSpriteId;
  return updated;
}

/**
 * Creates a complete Agent Avatar respecting the Store Visual DNA
 * while providing unique individual characteristics (No clones).
 */
export function createAgentAvatar(params: {
  agentId: string;
  name?: string;
  role?: string;
  storeId?: string;
  storeDNA?: StoreVisualDNA;
  gender?: "male" | "female" | "robot";
  individualOverrides?: Partial<AgentAvatarConfig>;
}): AgentAvatarConfig {
  const {
    agentId,
    name = "Atendente",
    role = "Vendas",
    storeId = "store-default",
    storeDNA,
    gender,
    individualOverrides = {},
  } = params;

  const normalizedKey = agentId.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const basePreset = DEFAULT_AVATAR_PRESETS[normalizedKey] || {};
  const inferredGender = gender || inferGenderFromConfig({ agentId, ...({ name } as any), ...basePreset });

  const branding: StoreBranding = {
    storeName: storeDNA?.storeName || "ZAI CRM",
    primaryColor: storeDNA?.primaryColor || "#10b981",
    secondaryColor: storeDNA?.secondaryColor || "#0f172a",
    accentColor: storeDNA?.accentColor || "#00f090",
    logo: storeDNA?.logo || "ZAI",
    showLogoOnChest: true,
    showLogoOnBadge: storeDNA?.defaultBadge !== false,
    showLogoOnCap: true,
    showLogoOnObject: true,
  };

  const isFemale = inferredGender !== "male";
  const defaultHair = inferredGender === "robot" ? "none" : isFemale ? "female_ponytail_brunette" : "male_short_fade";
  const defaultHairColor = isFemale ? "auburn" : "black";

  const accessoriesMap: Record<string, string> = {};
  if (storeDNA?.defaultAccessories) {
    storeDNA.defaultAccessories.forEach((acc) => {
      if (acc.includes("headset")) accessoriesMap.headset = acc;
      if (acc.includes("badge")) accessoriesMap.badge = acc;
      if (acc.includes("cap")) accessoriesMap.headwear = acc;
    });
  } else {
    accessoriesMap.headset = "headset_zai_green";
    accessoriesMap.badge = "badge_zai_lanyard";
  }

  let defaultWorkObject = "tablet_zai";
  if (role.toLowerCase().includes("técnico") || role.toLowerCase().includes("suporte")) {
    defaultWorkObject = "tablet_zai";
  } else if (role.toLowerCase().includes("logística") || role.toLowerCase().includes("estoque")) {
    defaultWorkObject = "boxes_delivery";
  } else if (role.toLowerCase().includes("orçamento") || role.toLowerCase().includes("financeiro")) {
    defaultWorkObject = "clipboard_sales";
  }

  const avatarConfig: AgentAvatarConfig = {
    id: `avatar-${agentId}`,
    agentId,
    storeId,
    body: inferredGender,
    base: inferredGender === "male" ? "male" : "female",
    skin: basePreset.skin || (isFemale ? "peach" : "tan"),
    hair: basePreset.hair || defaultHair,
    hairColor: basePreset.hairColor || defaultHairColor,
    eyes: basePreset.eyes || "face_friendly_smile",
    eyebrows: "natural",
    facialHair: isFemale ? "none" : (basePreset.facialHair || "none"),
    glasses: basePreset.glasses || "none",
    headset: accessoriesMap.headset || "headset_zai_green",
    clothing: storeDNA?.defaultClothing || basePreset.clothing || "polo_zai_black",
    pants: basePreset.pants || "cargo_black",
    shoes: storeDNA?.defaultShoes || basePreset.shoes || "sneakers_zai_green",
    accessories: {
      ...accessoriesMap,
      ...(basePreset.accessories || {}),
      ...(individualOverrides.accessories || {}),
    },
    workObject: basePreset.workObject || defaultWorkObject,
    badge: storeDNA?.defaultBadge !== false,
    branding,
    animationState: "WORKING",
    personalityVisual: {
      posture: isFemale ? "sales" : "tech",
      expression: "friendly_smile",
      preferredObject: defaultWorkObject,
      animationStyle: "smooth",
      ...(basePreset.personalityVisual || {}),
      ...(individualOverrides.personalityVisual || {}),
    },
    ...individualOverrides,
  };

  avatarConfig.baseSpriteId = resolveBaseSpriteForAvatar(avatarConfig);
  avatarConfig.catalogSpriteId = avatarConfig.baseSpriteId;

  return avatarConfig;
}

/**
 * Equipment helper: equips an item immutably without overwriting unrelated sub-slots
 */
export function equipItem(
  avatar: AgentAvatarConfig,
  slot: "headset" | "glasses" | "headwear" | "badge" | "backpack" | "workObject" | "clothing",
  item: string,
): AgentAvatarConfig {
  const updatedAccessories = { ...(typeof avatar.accessories === "object" && !Array.isArray(avatar.accessories) ? avatar.accessories : {}) };

  if (slot === "clothing") {
    const updated = buildSlotUpdate(avatar, "upper_body_slot", item);
    return {
      ...avatar,
      clothing: item,
      outfit: item,
      upperBody: updated.upperBody,
      baseSpriteId: resolveBaseSpriteForAvatar({ ...avatar, clothing: item }),
      catalogSpriteId: resolveBaseSpriteForAvatar({ ...avatar, clothing: item }),
    };
  }

  if (slot === "workObject") {
    const updated = buildSlotUpdate(avatar, "prop", item);
    return {
      ...avatar,
      workObject: item,
      accessories: { ...updatedAccessories, prop: updated.accessorySubSlots.prop },
      baseSpriteId: resolveBaseSpriteForAvatar({ ...avatar, workObject: item }),
      catalogSpriteId: resolveBaseSpriteForAvatar({ ...avatar, workObject: item }),
    };
  }

  if (slot === "glasses") {
    return {
      ...avatar,
      glasses: item,
      accessories: { ...updatedAccessories, glasses: item, eyewear: item },
      baseSpriteId: resolveBaseSpriteForAvatar({ ...avatar, glasses: item }),
      catalogSpriteId: resolveBaseSpriteForAvatar({ ...avatar, glasses: item }),
    };
  }

  if (slot === "headset") {
    return {
      ...avatar,
      headset: item,
      accessories: { ...updatedAccessories, headset: item },
    };
  }

  if (slot === "badge") {
    return {
      ...avatar,
      badge: item !== "none",
      accessories: { ...updatedAccessories, badge: item },
    };
  }

  updatedAccessories[slot] = item;
  if (slot === "backpack") {
    updatedAccessories.back = item;
  }
  return {
    ...avatar,
    accessories: updatedAccessories,
  };
}

/**
 * Equipment helper: unequips an item slot immutably without disturbing other sub-slots
 */
export function unequipItem(
  avatar: AgentAvatarConfig,
  slot: "headset" | "glasses" | "headwear" | "badge" | "backpack" | "workObject",
): AgentAvatarConfig {
  const updatedAccessories = { ...(typeof avatar.accessories === "object" && !Array.isArray(avatar.accessories) ? avatar.accessories : {}) };
  delete updatedAccessories[slot];
  if (slot === "glasses") delete updatedAccessories.eyewear;
  if (slot === "backpack") delete updatedAccessories.back;
  if (slot === "workObject") delete updatedAccessories.prop;

  return {
    ...avatar,
    accessories: updatedAccessories,
    glasses: slot === "glasses" ? "none" : avatar.glasses,
    headset: slot === "headset" ? "none" : avatar.headset,
    badge: slot === "badge" ? false : avatar.badge,
    workObject: slot === "workObject" ? "hands_in_pockets" : avatar.workObject,
    baseSpriteId: resolveBaseSpriteForAvatar({
      ...avatar,
      glasses: slot === "glasses" ? "none" : avatar.glasses,
      workObject: slot === "workObject" ? "hands_in_pockets" : avatar.workObject,
    }),
    catalogSpriteId: resolveBaseSpriteForAvatar({
      ...avatar,
      glasses: slot === "glasses" ? "none" : avatar.glasses,
      workObject: slot === "workObject" ? "hands_in_pockets" : avatar.workObject,
    }),
  };
}

/**
 * Randomizes an avatar while preserving the Store's DNA (uniform & branding)
 */
export function randomizeAvatar(current: AgentAvatarConfig, storeDNA?: StoreVisualDNA): AgentAvatarConfig {
  const isFemale = current.body !== "male";
  const hairPool = isFemale ? HAIRSTYLES_FEMALE : HAIRSTYLES_MALE;
  const randomHair = hairPool[Math.floor(Math.random() * hairPool.length)].id;
  const randomHairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].id;
  const randomSkin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)].id;
  const randomFace = FACE_TYPES[Math.floor(Math.random() * FACE_TYPES.length)].id;
  const randomWorkObject = WORK_OBJECTS[Math.floor(Math.random() * WORK_OBJECTS.length)].id;
  const randomPosture = POSTURES[Math.floor(Math.random() * POSTURES.length)].id;

  const randomized: AgentAvatarConfig = {
    ...current,
    skin: randomSkin,
    hair: randomHair,
    hairColor: randomHairColor,
    eyes: randomFace,
    workObject: randomWorkObject,
    personalityVisual: {
      ...current.personalityVisual,
      posture: randomPosture,
      preferredObject: randomWorkObject,
    },
    clothing: storeDNA?.defaultClothing || current.clothing,
    branding: {
      ...current.branding,
      primaryColor: storeDNA?.primaryColor || current.branding.primaryColor,
      storeName: storeDNA?.storeName || current.branding.storeName,
    },
  };

  randomized.baseSpriteId = resolveBaseSpriteForAvatar(randomized);
  randomized.catalogSpriteId = randomized.baseSpriteId;
  return randomized;
}

export { normalizeAvatarComposition, buildSlotUpdate };
