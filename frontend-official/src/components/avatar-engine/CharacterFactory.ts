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
  CLOTHING_STYLES,
  ACCESSORIES,
  WORK_OBJECTS,
  POSTURES,
} from "./AvatarDefinition";

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
  if (!forceRecompute && avatar.catalogSpriteId) {
    return avatar.catalogSpriteId;
  }

  const gender = avatar.body || "female";
  const hair = avatar.hair || "";
  const object = avatar.workObject || "";
  const glasses = avatar.glasses || "none";

  // Check work objects first (Row 3)
  if (object === "boxes_delivery") return "sprite_r3_c1";
  if (object === "laptop_zai") return "sprite_r3_c5";
  if (avatar.clothing === "vest_hivis_safety") return "sprite_r3_c2";
  if (avatar.accessories?.headwear === "hardhat_zai_white") return "sprite_r3_c8";
  if (object === "coffee_cup") return "sprite_r2_c5";
  if (object === "peace_sign") return "sprite_r2_c8";
  if (object === "thumbs_up") return "sprite_r1_c7";

  // Female matches (Row 2)
  if (gender === "female") {
    if (hair.includes("ponytail")) return "sprite_r2_c1";
    if (glasses !== "none" || hair.includes("glasses")) return "sprite_r2_c2";
    if (hair.includes("blonde")) return "sprite_r2_c3";
    if (hair.includes("curly")) return "sprite_r2_c4";
    if (avatar.accessories?.headwear?.includes("cap")) return "sprite_r2_c6";
    if (hair.includes("short") || hair.includes("business")) return "sprite_r2_c7";
    if (hair.includes("silver")) return "sprite_r2_c9";
    if (hair.includes("blue")) return "sprite_r2_c10";
    return "sprite_r2_c1";
  }

  // Male matches (Row 1)
  if (hair.includes("fade") || hair.includes("short")) return "sprite_r1_c1";
  if (glasses !== "none" || hair.includes("glasses")) return "sprite_r1_c2";
  if (hair.includes("blonde")) return "sprite_r1_c3";
  if (avatar.accessories?.headwear?.includes("cap")) return "sprite_r1_c4";
  if (hair.includes("curly")) return "sprite_r1_c5";
  if (hair.includes("silver") || hair.includes("anime")) return "sprite_r1_c6";
  if (hair.includes("afro")) return "sprite_r1_c7";
  if (hair.includes("beard") || avatar.facialHair === "full_beard") return "sprite_r1_c8";
  if (avatar.glasses?.includes("sunglasses")) return "sprite_r1_c9";
  if (hair.includes("red")) return "sprite_r1_c10";

  return "sprite_r1_c1";
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
    gender = "female",
    individualOverrides = {},
  } = params;

  // Retrieve base preset if exists (e.g. Camila, Rafael)
  const normalizedKey = agentId.toLowerCase();
  const basePreset = DEFAULT_AVATAR_PRESETS[normalizedKey] || {};

  // Store branding inherited
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

  // Determine gender and hair
  const isFemale = gender === "female" || (!gender && (name.toLowerCase().includes("camila") || name.toLowerCase().includes("julia")));
  const defaultHair = isFemale ? "female_ponytail_brunette" : "male_short_fade";
  const defaultHairColor = isFemale ? "auburn" : "black";

  // Build accessories map from store DNA
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

  // Work object adapted to role
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
    body: gender,
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

  // Resolve matching sprite
  avatarConfig.catalogSpriteId = resolveSpriteForAvatar(avatarConfig);

  return avatarConfig;
}

/**
 * Equipment helper: equips an item immutably
 */
export function equipItem(
  avatar: AgentAvatarConfig,
  slot: "headset" | "glasses" | "headwear" | "badge" | "backpack" | "workObject" | "clothing",
  item: string
): AgentAvatarConfig {
  const updatedAccessories = { ...avatar.accessories };
  
  if (slot === "clothing") {
    return {
      ...avatar,
      clothing: item,
      catalogSpriteId: resolveSpriteForAvatar({ ...avatar, clothing: item, catalogSpriteId: undefined }, true),
    };
  }

  if (slot === "workObject") {
    return {
      ...avatar,
      workObject: item,
      catalogSpriteId: resolveSpriteForAvatar({ ...avatar, workObject: item, catalogSpriteId: undefined }, true),
    };
  }

  if (slot === "glasses") {
    return {
      ...avatar,
      glasses: item,
      accessories: { ...updatedAccessories, glasses: item },
      catalogSpriteId: resolveSpriteForAvatar({ ...avatar, glasses: item, catalogSpriteId: undefined }, true),
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
  return {
    ...avatar,
    accessories: updatedAccessories,
  };
}

/**
 * Equipment helper: unequips an item slot immutably
 */
export function unequipItem(
  avatar: AgentAvatarConfig,
  slot: "headset" | "glasses" | "headwear" | "badge" | "backpack" | "workObject"
): AgentAvatarConfig {
  const updatedAccessories = { ...avatar.accessories };
  delete updatedAccessories[slot];

  return {
    ...avatar,
    accessories: updatedAccessories,
    glasses: slot === "glasses" ? "none" : avatar.glasses,
    headset: slot === "headset" ? "none" : avatar.headset,
    badge: slot === "badge" ? false : avatar.badge,
    workObject: slot === "workObject" ? "hands_in_pockets" : avatar.workObject,
    catalogSpriteId: resolveSpriteForAvatar(
      {
        ...avatar,
        glasses: slot === "glasses" ? "none" : avatar.glasses,
        workObject: slot === "workObject" ? "hands_in_pockets" : avatar.workObject,
        catalogSpriteId: undefined,
      },
      true
    ),
  };
}

/**
 * Randomizes an avatar while preserving the Store's DNA (uniform & branding)
 */
export function randomizeAvatar(current: AgentAvatarConfig, storeDNA?: StoreVisualDNA): AgentAvatarConfig {
  const isFemale = current.body === "female";
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
    // Preserve store uniform and branding
    clothing: storeDNA?.defaultClothing || current.clothing,
    branding: {
      ...current.branding,
      primaryColor: storeDNA?.primaryColor || current.branding.primaryColor,
      storeName: storeDNA?.storeName || current.branding.storeName,
    },
  };

  randomized.catalogSpriteId = resolveSpriteForAvatar({ ...randomized, catalogSpriteId: undefined }, true);
  return randomized;
}
