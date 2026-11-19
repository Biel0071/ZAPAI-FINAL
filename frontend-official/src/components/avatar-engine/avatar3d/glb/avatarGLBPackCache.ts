/**
 * ZAI Avatar Engine 2.0 — Singleton Async Loader & Cache for the 4 modular GLB packs.
 * Concurrent consumers (Stage + Thumbnail previews) share one single HTTP load batch.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface AvatarGLBPacks {
  rigTemplate: THREE.Object3D;
  animations: Record<string, THREE.AnimationClip>;
  catalogNodes: Record<string, THREE.Object3D>;
  boneInverses: Record<string, THREE.Matrix4>;
}

const PACK_BASE = "/models/zai-avatar";
const PACK_URLS = {
  rig: `${PACK_BASE}/rig_and_anims.glb`,
  bodies: `${PACK_BASE}/bodies_and_heads.glb`,
  wardrobe: `${PACK_BASE}/wardrobe_modular.glb`,
  hairAcc: `${PACK_BASE}/hair_and_accessories.glb`,
} as const;

let cachedPacks: AvatarGLBPacks | null = null;
let loadingPromise: Promise<AvatarGLBPacks> | null = null;

function indexSceneNodes(
  scene: THREE.Object3D,
  catalogNodes: Record<string, THREE.Object3D>,
  boneInverses: Record<string, THREE.Matrix4>,
): void {
  scene.traverse((obj) => {
    if (obj.name && obj.name !== "Scene" && obj.name !== "Rig" && obj.name !== "Rig_Anchor") {
      // Only register top-level part nodes (direct children of Scene or Rig parent, not primitive sub-meshes *_1, *_2)
      const isDirectPart =
        obj.parent === scene || obj.parent?.name === "Rig" || obj.parent?.name === "Scene";
      if (isDirectPart && !catalogNodes[obj.name]) {
        catalogNodes[obj.name] = obj;
      }
    }
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      const sk = (obj as THREE.SkinnedMesh).skeleton;
      if (sk) {
        sk.bones.forEach((b, i) => {
          if (b.name && !boneInverses[b.name] && sk.boneInverses[i]) {
            boneInverses[b.name] = sk.boneInverses[i].clone();
          }
        });
      }
    }
  });
}

function loadGLB(loader: GLTFLoader, url: string) {
  return new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations || [] }),
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(`Failed loading ${url}`)),
    );
  });
}

export async function preloadAvatarGLBPacks(): Promise<AvatarGLBPacks> {
  if (cachedPacks) return cachedPacks;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const loader = new GLTFLoader();
    const [rigGltf, bodiesGltf, wardrobeGltf, hairAccGltf] = await Promise.all([
      loadGLB(loader, PACK_URLS.rig),
      loadGLB(loader, PACK_URLS.bodies),
      loadGLB(loader, PACK_URLS.wardrobe),
      loadGLB(loader, PACK_URLS.hairAcc),
    ]);

    const catalogNodes: Record<string, THREE.Object3D> = {};
    const boneInverses: Record<string, THREE.Matrix4> = {};

    indexSceneNodes(bodiesGltf.scene, catalogNodes, boneInverses);
    indexSceneNodes(wardrobeGltf.scene, catalogNodes, boneInverses);
    indexSceneNodes(hairAccGltf.scene, catalogNodes, boneInverses);
    indexSceneNodes(rigGltf.scene, {}, boneInverses);

    // Hide Rig_Anchor permanently on template
    const anchor = rigGltf.scene.getObjectByName("Rig_Anchor");
    if (anchor) anchor.visible = false;

    const animations: Record<string, THREE.AnimationClip> = {};
    for (const clip of rigGltf.animations) {
      animations[clip.name] = clip;
    }

    const packs: AvatarGLBPacks = {
      rigTemplate: rigGltf.scene,
      animations,
      catalogNodes,
      boneInverses,
    };
    cachedPacks = packs;
    return packs;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

export function getLoadedAvatarGLBPacksSync(): AvatarGLBPacks | null {
  return cachedPacks;
}

export function setAvatarGLBPacksForTests(packs: AvatarGLBPacks | null): void {
  cachedPacks = packs;
  loadingPromise = null;
}
