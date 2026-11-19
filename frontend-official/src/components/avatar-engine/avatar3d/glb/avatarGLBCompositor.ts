/**
 * ZAI Avatar Engine 2.0 — Modular Three.js GLB Compositor + AnimationMixer Controller.
 * Attaches independent skinned slot meshes to ONE persistent cloned Rig skeleton.
 * Swapping Hair, Face/Morphs, Upper, Lower, Footwear, or any Accessory sub-slot
 * ONLY swaps that exact slot mount without rebuilding the skeleton or disturbing other slots!
 */

import * as THREE from "three";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AvatarGLBPacks } from "./avatarGLBPackCache";
import type { GLBCompositionPlan, GLBMorphWeights } from "./avatarGLBMapping";

export type GLBSlotKey =
  | "head"
  | "hair"
  | "facialHair"
  | "upper"
  | "limbs"
  | "peaceHand"
  | "lower"
  | "bareLegs"
  | "shoe"
  | "acc_eyewear"
  | "acc_headwear"
  | "acc_headset"
  | "acc_badge"
  | "acc_wrist"
  | "acc_prop"
  | "acc_back";

interface MountedSlotState {
  nodeName: string | null;
  object: THREE.Object3D | null;
}

function disposeSlotObject(obj: THREE.Object3D | null): void {
  if (!obj) return;
  obj.parent?.remove(obj);
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        // Dispose cloned per-slot material instances (geometries stay shared cleanly across pack cache)
        m.dispose();
      }
    }
  });
}

function rebindAndStyleSubtree(
  node: THREE.Object3D,
  bonesByName: Record<string, THREE.Bone>,
  boneInverses: Record<string, THREE.Matrix4>,
  plan: GLBCompositionPlan,
): THREE.SkinnedMesh[] {
  const morphMeshes: THREE.SkinnedMesh[] = [];
  node.traverse((child) => {
    const sm = child as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) {
      const oldSkel = sm.skeleton;
      const newBones = oldSkel.bones.map((b) => bonesByName[b.name] || b);
      const newInverses = oldSkel.bones.map((b, i) =>
        boneInverses[b.name] ? boneInverses[b.name].clone() : oldSkel.boneInverses[i]?.clone() || new THREE.Matrix4(),
      );
      sm.bind(new THREE.Skeleton(newBones, newInverses), new THREE.Matrix4());
      sm.frustumCulled = false;
      sm.castShadow = true;
      sm.receiveShadow = true;

      if (sm.morphTargetDictionary && sm.morphTargetInfluences) {
        morphMeshes.push(sm);
      }
    }

    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      const srcMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clonedMats = srcMats.map((m) => m.clone());
      mesh.material = Array.isArray(mesh.material) ? clonedMats : clonedMats[0];
    }
  });

  applyMaterialPaletteToSubtree(node, plan);
  return morphMeshes;
}

export function applyMaterialPaletteToSubtree(node: THREE.Object3D, plan: GLBCompositionPlan): void {
  const { palette } = plan;
  node.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const rawMat of mats) {
      const mat = rawMat as THREE.MeshStandardMaterial;
      const name = mat.name || "";
      if (!mat.color) continue;

      if (name.includes("Mat_Skin")) {
        mat.color.set(palette.skinHex);
      } else if (name.includes("Mat_Blush")) {
        mat.color.set(palette.blushHex);
      } else if (name.includes("Mat_Lip")) {
        mat.color.set(palette.lipHex);
      } else if (name.includes("Mat_Iris")) {
        mat.color.set(palette.irisHex);
      } else if (name.includes("Mat_Hair_Main")) {
        mat.color.set(palette.hairHex);
      } else if (name.includes("Mat_Hair_Accent")) {
        mat.color.set(palette.hairAccentHex);
      } else if (name.includes("Mat_FacialHair")) {
        mat.color.set(palette.facialHairHex);
      } else if (name.includes("Mat_Garment_Primary")) {
        mat.color.set(palette.primaryHex);
      } else if (name.includes("Mat_Garment_Secondary")) {
        mat.color.set(palette.secondaryHex);
      } else if (name.includes("Mat_Garment_Accent") || name.includes("Mat_Acc_Brand")) {
        mat.color.set(palette.accentHex);
      } else if (name.includes("Mat_Garment_Inner")) {
        mat.color.set(palette.innerHex);
      }
      mat.needsUpdate = true;
    }
  });
}

export interface ComposedGLBCharacter {
  root: THREE.Group;
  rigRoot: THREE.Object3D;
  bonesByName: Record<string, THREE.Bone>;
  slots: Record<GLBSlotKey, MountedSlotState>;
  mixer: THREE.AnimationMixer;
  currentPlan: GLBCompositionPlan;
  applyPlan: (nextPlan: GLBCompositionPlan) => void;
  updateAnimation: (deltaSec: number, elapsedSec: number) => void;
  getAttachedSlotNodeNames: () => Record<GLBSlotKey, string | null>;
  dispose: () => void;
}

const ALL_SLOT_KEYS: GLBSlotKey[] = [
  "head",
  "hair",
  "facialHair",
  "upper",
  "limbs",
  "peaceHand",
  "lower",
  "bareLegs",
  "shoe",
  "acc_eyewear",
  "acc_headwear",
  "acc_headset",
  "acc_badge",
  "acc_wrist",
  "acc_prop",
  "acc_back",
];

function extractSlotNodeMap(plan: GLBCompositionPlan): Record<GLBSlotKey, string | null> {
  return {
    head: plan.headNode,
    hair: plan.hairNode,
    facialHair: plan.facialHairNode,
    upper: plan.upperNode,
    limbs: plan.limbsNode,
    peaceHand: null,
    lower: plan.lowerNode,
    bareLegs: plan.bareLegsNode,
    shoe: plan.shoeNode,
    acc_eyewear: plan.accessories.eyewear,
    acc_headwear: plan.accessories.headwear,
    acc_headset: plan.accessories.headset,
    acc_badge: plan.accessories.badge,
    acc_wrist: plan.accessories.wrist,
    acc_prop: plan.accessories.prop,
    acc_back: plan.accessories.back,
  };
}

export function composeGLBAvatarCharacter(
  packs: AvatarGLBPacks,
  initialPlan: GLBCompositionPlan,
): ComposedGLBCharacter {
  const root = new THREE.Group();
  root.name = "zai-avatar-glb-root";

  const rigClone = cloneSkinnedScene(packs.rigTemplate);
  rigClone.name = "zai-avatar-glb-rig";
  root.add(rigClone);

  const anchor = rigClone.getObjectByName("Rig_Anchor");
  if (anchor) anchor.visible = false;

  const bonesByName: Record<string, THREE.Bone> = {};
  rigClone.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      bonesByName[o.name] = o as THREE.Bone;
    }
  });

  const rigParent = bonesByName.root?.parent || rigClone;
  const mixer = new THREE.AnimationMixer(rigClone);

  const slots = {} as Record<GLBSlotKey, MountedSlotState>;
  for (const key of ALL_SLOT_KEYS) {
    slots[key] = { nodeName: null, object: null };
  }

  let headMorphMeshes: THREE.SkinnedMesh[] = [];
  let activeAction: THREE.AnimationAction | null = null;
  let activeClipName = "";
  let blinkClock = 0;

  const swapSingleSlot = (slotKey: GLBSlotKey, nextNodeName: string | null, plan: GLBCompositionPlan) => {
    const slotState = slots[slotKey];
    if (slotState.nodeName === nextNodeName && slotState.object) {
      applyMaterialPaletteToSubtree(slotState.object, plan);
      return;
    }

    if (slotState.object) {
      disposeSlotObject(slotState.object);
      slotState.object = null;
      slotState.nodeName = null;
    }

    if (!nextNodeName) return;

    const src = packs.catalogNodes[nextNodeName];
    if (!src) return;

    const clonedPart = src.clone(true);
    clonedPart.name = `slot:${slotKey}:${nextNodeName}`;
    const morphs = rebindAndStyleSubtree(clonedPart, bonesByName, packs.boneInverses, plan);
    rigParent.add(clonedPart);

    slotState.nodeName = nextNodeName;
    slotState.object = clonedPart;

    if (slotKey === "head") {
      headMorphMeshes = morphs;
    }
  };

  const applyClipTransition = (clipName: string) => {
    if (clipName === activeClipName && activeAction) return;
    const clip = packs.animations[clipName] || packs.animations.Idle;
    if (!clip) return;

    const nextAction = mixer.clipAction(clip);
    nextAction.reset();
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.play();

    if (activeAction && activeAction !== nextAction) {
      activeAction.crossFadeTo(nextAction, 0.22, true);
    }

    activeAction = nextAction;
    activeClipName = clipName;
  };

  let currentPlan = initialPlan;

  const applyPlan = (nextPlan: GLBCompositionPlan) => {
    currentPlan = nextPlan;
    const targetMap = extractSlotNodeMap(nextPlan);
    for (const key of ALL_SLOT_KEYS) {
      swapSingleSlot(key, targetMap[key], nextPlan);
    }

    // Hide normal right hand visual sub-meshes ONLY if peaceHand is swapped in cleanly
    // (Hands/Arms currently bake both hands into one mesh, so peaceHand overlaps slightly cleanly or future split; ensure visible)
    applyClipTransition(nextPlan.clipName);
  };

  const applyMorphTargets = (elapsedSec: number) => {
    const m: GLBMorphWeights = { ...currentPlan.morphWeights };

    // Natural eye blink every ~3.4s when eyes aren't sleeping or winking
    if (!currentPlan.isSleeping && m.expr_wink < 0.5) {
      const cycle = blinkClock % 3.6;
      if (cycle > 3.44) {
        const p = Math.sin(((cycle - 3.44) / 0.16) * Math.PI);
        m.expr_blink = Math.max(m.expr_blink, Math.max(0, p));
      }
    }

    // Natural conversational lip sync when attending/speaking
    if (currentPlan.isSpeaking) {
      const waveA = Math.max(0, Math.sin(elapsedSec * 12.5)) * 0.72;
      const waveO = Math.max(0, Math.sin(elapsedSec * 8.3 + 1.4)) * 0.55;
      m.expr_talk_a = waveA;
      m.expr_talk_o = waveO;
    }

    for (const sm of headMorphMeshes) {
      const dict = sm.morphTargetDictionary;
      const inf = sm.morphTargetInfluences;
      if (!dict || !inf) continue;
      for (const [k, v] of Object.entries(m)) {
        const idx = dict[k];
        if (idx !== undefined) {
          inf[idx] = v;
        }
      }
    }
  };

  // Initialize character immediately
  applyPlan(initialPlan);
  mixer.update(0.02);
  applyMorphTargets(0);

  const updateAnimation = (deltaSec: number, elapsedSec: number) => {
    const dt = Math.min(Math.max(deltaSec, 0), 0.1);
    blinkClock += dt;
    mixer.update(dt);
    applyMorphTargets(elapsedSec);
  };

  const getAttachedSlotNodeNames = (): Record<GLBSlotKey, string | null> => {
    const out = {} as Record<GLBSlotKey, string | null>;
    for (const k of ALL_SLOT_KEYS) {
      out[k] = slots[k].nodeName;
    }
    return out;
  };

  const dispose = () => {
    mixer.stopAllAction();
    for (const k of ALL_SLOT_KEYS) {
      disposeSlotObject(slots[k].object);
      slots[k].object = null;
      slots[k].nodeName = null;
    }
    root.removeFromParent();
  };

  return {
    root,
    rigRoot: rigClone,
    bonesByName,
    slots,
    mixer,
    currentPlan,
    applyPlan,
    updateAnimation,
    getAttachedSlotNodeNames,
    dispose,
  };
}
