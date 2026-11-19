import * as THREE from "three";
import { resolveAvatarLook3D } from "./look3d";
import { buildHumanoidCharacter } from "./buildChibi";
import { AvatarAnimationFSM } from "./animationStateMachine";
import { supportsWebGL } from "./webglSupport";
import type { AvatarPreviewFocus } from "../AvatarItemPreview";

const thumbCache = new Map<string, string>();
const SIZE = 96;

let sharedRenderer: THREE.WebGLRenderer | null = null;

function getOffscreenRenderer(): THREE.WebGLRenderer | null {
  if (typeof window === "undefined" || !supportsWebGL()) return null;
  if (sharedRenderer) return sharedRenderer;
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
    renderer.toneMappingExposure = 1.08;
    sharedRenderer = renderer;
    return sharedRenderer;
  } catch {
    return null;
  }
}

function getCameraFrameForFocus(focus: AvatarPreviewFocus, itemId: string): {
  pos: [number, number, number];
  target: [number, number, number];
} {
  if (focus === "hair" || focus === "face" || focus === "accessory-head" || itemId.startsWith("hair_") || itemId.startsWith("face_")) {
    return { pos: [0.3, 1.23, 1.46], target: [0, 1.17, 0] };
  }
  if (focus === "outfit" || focus === "upper_body" || itemId.startsWith("outfit_") || itemId.startsWith("upper_")) {
    return { pos: [0.26, 0.88, 1.18], target: [0, 0.82, 0] };
  }
  if (focus === "lower_body" || itemId.startsWith("lower_")) {
    return { pos: [0.22, 0.56, 1.15], target: [0, 0.44, 0] };
  }
  if (focus === "footwear" || itemId.startsWith("shoe_")) {
    return { pos: [0.28, 0.22, 0.72], target: [0, 0.08, 0.04] };
  }
  if (focus === "accessory-body" || focus === "accessories" || itemId.startsWith("acc_")) {
    return { pos: [0.28, 0.9, 1.42], target: [0, 0.85, 0] };
  }
  return { pos: [0.24, 0.86, 2.38], target: [0, 0.72, 0] };
}

export function renderCatalogItemThumbnail3D(params: {
  itemId: string;
  focus: AvatarPreviewFocus;
  gender?: string;
  hairColor?: string;
  skinTone?: string;
  accentColor?: string;
}): string | null {
  const { itemId, focus, gender = "female", hairColor, skinTone, accentColor = "#10b981" } = params;
  const cacheKey = `${itemId}|${focus}|${gender}|${hairColor || ""}|${skinTone || ""}|${accentColor}`;
  const existing = thumbCache.get(cacheKey);
  if (existing) return existing;

  const renderer = getOffscreenRenderer();
  if (!renderer) return null;

  const isMale = gender === "male";
  const baseAvatar: Record<string, unknown> = {
    agentId: "thumb_preview",
    body: isMale ? "male" : "female",
    base: isMale ? "male" : "female",
    skin: skinTone || "peach",
    hair: isMale ? "hair_05" : "hair_01",
    hairColor: hairColor || (isMale ? "black" : "auburn"),
    face: "face_01",
    outfit: "outfit_01",
    clothing: "outfit_01",
    lowerBody: "lower_chinos",
    footwear: "shoe_sneaker",
    accessories: [],
    headset: "none",
    glasses: "none",
    badge: false,
    workObject: "none",
    branding: { primaryColor: accentColor, accentColor },
  };

  if (itemId.startsWith("hair_")) {
    baseAvatar.hair = itemId;
  } else if (itemId.startsWith("face_")) {
    baseAvatar.face = itemId;
  } else if (itemId.startsWith("outfit_") || itemId.startsWith("upper_")) {
    baseAvatar.outfit = itemId;
    baseAvatar.clothing = itemId;
  } else if (itemId.startsWith("lower_")) {
    baseAvatar.lowerBody = itemId;
  } else if (itemId.startsWith("shoe_")) {
    baseAvatar.footwear = itemId;
  } else if (itemId.startsWith("acc_") && itemId !== "acc_01") {
    baseAvatar.accessories = [itemId];
    if (itemId === "acc_02") baseAvatar.headset = "acc_02";
    if (itemId === "acc_04" || itemId === "acc_07") baseAvatar.glasses = itemId;
    if (itemId === "acc_03") baseAvatar.badge = true;
    if (["acc_05", "acc_08", "acc_09", "acc_10"].includes(itemId)) baseAvatar.workObject = itemId;
  } else if (itemId.startsWith("style_") || itemId.startsWith("uniform_")) {
    baseAvatar.style = itemId;
    baseAvatar.uniform = itemId;
  }

  const look = resolveAvatarLook3D(baseAvatar as any, accentColor);
  const chibi = buildHumanoidCharacter(look);
  const fsm = new AvatarAnimationFSM("idle");
  fsm.bindRig(chibi.rig);
  fsm.update(0, chibi.rig, chibi.hold);

  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight("#fffaf4", "#1e293b", 1.35);
  const key = new THREE.DirectionalLight("#fff8f0", 1.85);
  key.position.set(1.8, 2.8, 3.2);
  const fill = new THREE.DirectionalLight("#bae6fd", 0.9);
  fill.position.set(-2.2, 1.5, 2.4);
  const rim = new THREE.DirectionalLight(accentColor, 1.0);
  rim.position.set(-1.8, 2.0, -2.5);
  scene.add(hemi, key, fill, rim, chibi.rig.root);

  const frame = getCameraFrameForFocus(focus, itemId);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
  camera.position.set(...frame.pos);
  camera.lookAt(...frame.target);
  camera.updateMatrixWorld();

  renderer.render(scene, camera);
  let dataUrl: string | null = null;
  try {
    dataUrl = renderer.domElement.toDataURL("image/png");
    if (dataUrl) thumbCache.set(cacheKey, dataUrl);
  } catch {
    dataUrl = null;
  }

  chibi.dispose();
  return dataUrl;
}
