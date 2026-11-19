/**
 * ZAI Avatar Engine 2.0 — Real-Model Applied Catalog Thumbnail Renderer.
 * Renders each Hair, Face, Upper, Lower, Footwear, Accessory, Uniform, and Style item
 * mounted directly on the actual rigged GLB character using ONE shared offscreen 96x96 WebGL context.
 */

import * as THREE from "three";
import { preloadAvatarGLBPacks, type AvatarGLBPacks } from "./avatarGLBPackCache";
import { resolveGLBCompositionPlan } from "./avatarGLBMapping";
import { composeGLBAvatarCharacter, type ComposedGLBCharacter } from "./avatarGLBCompositor";
import { supportsWebGL } from "../webglSupport";
import type { AvatarPreviewFocus } from "../../AvatarItemPreview";
import type { AgentAvatarConfig } from "../../AvatarDefinition";

const SIZE = 96;
const thumbCache = new Map<string, string>();
let offscreenRenderer: THREE.WebGLRenderer | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedChar: ComposedGLBCharacter | null = null;

function ensureOffscreenContext(packs: AvatarGLBPacks): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  character: ComposedGLBCharacter;
} | null {
  if (typeof window === "undefined" || !supportsWebGL()) return null;

  if (!offscreenRenderer) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(SIZE, SIZE, false);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      offscreenRenderer = renderer;
    } catch {
      return null;
    }
  }

  if (!sharedScene) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#fffaf4", "#1e293b", 1.45));
    const key = new THREE.DirectionalLight("#fff8f0", 1.9);
    key.position.set(2.0, 3.0, 3.5);
    const fill = new THREE.DirectionalLight("#bae6fd", 0.95);
    fill.position.set(-2.4, 1.8, 2.5);
    const rim = new THREE.DirectionalLight("#10b981", 1.0);
    rim.position.set(-1.8, 2.2, -2.8);
    scene.add(key, fill, rim);
    sharedScene = scene;
  }

  if (!sharedChar) {
    const basePlan = resolveGLBCompositionPlan({ agentId: "camila", body: "female" });
    sharedChar = composeGLBAvatarCharacter(packs, basePlan);
    sharedScene.add(sharedChar.root);
  }

  return { renderer: offscreenRenderer, scene: sharedScene, character: sharedChar };
}

function getGLBThumbCameraFrame(focus: AvatarPreviewFocus, itemId: string): {
  pos: [number, number, number];
  target: [number, number, number];
} {
  if (
    focus === "hair" ||
    focus === "face" ||
    focus === "accessory-head" ||
    itemId.startsWith("hair_") ||
    itemId.startsWith("face_") ||
    itemId.startsWith("eyewear_") ||
    itemId.startsWith("headwear_") ||
    itemId.startsWith("headset_") ||
    ["acc_02", "acc_04", "acc_07", "acc_12"].includes(itemId)
  ) {
    return { pos: [0.34, 1.54, 1.38], target: [0, 1.50, 0] };
  }
  if (
    focus === "outfit" ||
    focus === "upper_body" ||
    itemId.startsWith("outfit_") ||
    itemId.startsWith("upper_")
  ) {
    return { pos: [0.32, 0.94, 1.55], target: [0, 0.88, 0] };
  }
  if (focus === "lower_body" || itemId.startsWith("lower_")) {
    return { pos: [0.28, 0.44, 1.38], target: [0, 0.34, 0] };
  }
  if (focus === "footwear" || itemId.startsWith("shoe_")) {
    return { pos: [0.38, 0.22, 0.96], target: [0, 0.08, -0.05] };
  }
  if (
    focus === "accessory-body" ||
    focus === "accessories" ||
    itemId.startsWith("badge_") ||
    itemId.startsWith("wrist_") ||
    itemId.startsWith("prop_") ||
    itemId.startsWith("acc_")
  ) {
    if (itemId === "back_backpack" || itemId === "acc_11") {
      return { pos: [-0.45, 0.96, -1.65], target: [0, 0.88, 0] };
    }
    return { pos: [0.35, 0.95, 1.65], target: [0, 0.88, 0] };
  }
  return { pos: [0.34, 1.02, 3.35], target: [0, 0.92, 0] };
}

function buildThumbnailAvatarConfig(params: {
  itemId: string;
  gender?: string;
  hairColor?: string;
  skinTone?: string;
  accentColor?: string;
  baseAvatar?: Partial<AgentAvatarConfig> | null;
}): Partial<AgentAvatarConfig> {
  const { itemId, gender = "female", hairColor, skinTone, accentColor = "#10b981", baseAvatar } = params;
  const isMale = gender === "male";

  const avatar: Partial<AgentAvatarConfig> = {
    agentId: baseAvatar?.agentId || "thumb_preview",
    body: isMale ? "male" : "female",
    base: isMale ? "male" : "female",
    skin: (skinTone as AgentAvatarConfig["skin"]) || baseAvatar?.skin || (isMale ? "tan" : "peach"),
    hair: baseAvatar?.hair || (isMale ? "hair_05" : "hair_02"),
    hairColor: (hairColor as AgentAvatarConfig["hairColor"]) || baseAvatar?.hairColor || (isMale ? "black" : "dark_brown"),
    face: baseAvatar?.face || "face_01",
    facialHair: baseAvatar?.facialHair || "none",
    upperBody: baseAvatar?.upperBody || "upper_polo",
    lowerBody: baseAvatar?.lowerBody || "lower_chinos",
    footwear: baseAvatar?.footwear || "shoe_sneaker",
    accessories: [],
    headset: "none",
    glasses: "none",
    badge: false,
    workObject: "none",
    branding: {
      storeName: baseAvatar?.branding?.storeName || "ZAI CRM",
      primaryColor: accentColor,
      secondaryColor: "#0f172a",
      accentColor,
      logo: "ZAI",
    },
  };

  if (itemId.startsWith("hair_")) {
    avatar.hair = itemId;
  } else if (itemId.startsWith("face_")) {
    avatar.face = itemId;
  } else if (itemId.startsWith("outfit_") || itemId.startsWith("upper_")) {
    avatar.outfit = itemId;
    avatar.clothing = itemId;
    avatar.upperBody = itemId;
  } else if (itemId.startsWith("lower_")) {
    avatar.lowerBody = itemId;
    avatar.pants = itemId;
  } else if (itemId.startsWith("shoe_")) {
    avatar.footwear = itemId;
    avatar.shoes = itemId;
  } else if (itemId.startsWith("style_") || itemId.startsWith("uniform_")) {
    avatar.style = itemId;
    avatar.uniform = itemId;
  } else if (
    itemId !== "acc_01" &&
    (itemId.startsWith("acc_") ||
      itemId.startsWith("eyewear_") ||
      itemId.startsWith("headwear_") ||
      itemId.startsWith("headset_") ||
      itemId.startsWith("badge_") ||
      itemId.startsWith("wrist_") ||
      itemId.startsWith("prop_") ||
      itemId.startsWith("back_"))
  ) {
    avatar.accessories = [itemId];
  }

  return avatar;
}

export function getCachedCatalogItemThumbnailGLB(cacheKey: string): string | null {
  return thumbCache.get(cacheKey) || null;
}

export async function renderCatalogItemThumbnailGLBAsync(params: {
  itemId: string;
  focus: AvatarPreviewFocus;
  gender?: string;
  hairColor?: string;
  skinTone?: string;
  accentColor?: string;
  baseAvatar?: Partial<AgentAvatarConfig> | null;
}): Promise<string | null> {
  const { itemId, focus, gender = "female", hairColor, skinTone, accentColor = "#10b981", baseAvatar } = params;
  const cacheKey = `glb|${itemId}|${focus}|${gender}|${hairColor || ""}|${skinTone || ""}|${accentColor}`;
  const existing = thumbCache.get(cacheKey);
  if (existing) return existing;

  if (typeof window === "undefined" || !supportsWebGL()) return null;

  try {
    const packs = await preloadAvatarGLBPacks();
    const ctx = ensureOffscreenContext(packs);
    if (!ctx) return null;

    const previewConfig = buildThumbnailAvatarConfig({
      itemId,
      gender,
      hairColor,
      skinTone,
      accentColor,
      baseAvatar,
    });
    const plan = resolveGLBCompositionPlan(previewConfig, {
      brandColor: accentColor,
      movement3D: "idle",
      operationalState: "IDLE",
    });

    ctx.character.applyPlan(plan);
    ctx.character.updateAnimation(0.02, 0);
    ctx.character.root.updateMatrixWorld(true);

    const frame = getGLBThumbCameraFrame(focus, itemId);
    const camera = new THREE.PerspectiveCamera(27, 1, 0.05, 25);
    camera.position.set(...frame.pos);
    camera.lookAt(...frame.target);
    camera.updateMatrixWorld();

    ctx.renderer.render(ctx.scene, camera);
    const dataUrl = ctx.renderer.domElement.toDataURL("image/png");
    if (dataUrl) {
      thumbCache.set(cacheKey, dataUrl);
    }
    return dataUrl || null;
  } catch {
    return null;
  }
}
