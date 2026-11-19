import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  AVATAR_ACCESSORIES,
  AVATAR_FACES,
  AVATAR_HAIRS,
  AVATAR_OUTFITS,
  AVATAR_STYLES,
  buildSlotUpdate,
  SLOT_FOOTWEAR_ITEMS,
  SLOT_LOWER_BODY_ITEMS,
  SLOT_UNIFORM_ITEMS,
} from "../../AvatarDefinition";
import {
  getActiveAvatarEngine,
  normalizeAvatarEngineKind,
  setAvatarEnginePreference,
} from "../avatarEngineFlag";
import { resolveGLBCompositionPlan } from "../glb/avatarGLBMapping";
import type { AvatarGLBPacks } from "../glb/avatarGLBPackCache";
import { composeGLBAvatarCharacter } from "../glb/avatarGLBCompositor";

function makeSyntheticPacks(): AvatarGLBPacks {
  const rigRoot = new THREE.Group();
  rigRoot.name = "Rig";
  const rootBone = new THREE.Bone();
  rootBone.name = "root";
  const hipsBone = new THREE.Bone();
  hipsBone.name = "hips";
  const chestBone = new THREE.Bone();
  chestBone.name = "chest";
  const headBone = new THREE.Bone();
  headBone.name = "head";

  rootBone.add(hipsBone);
  hipsBone.add(chestBone);
  chestBone.add(headBone);
  rigRoot.add(rootBone);

  const templateBones = [rootBone, hipsBone, chestBone, headBone];
  const baseSkeleton = new THREE.Skeleton(templateBones);
  baseSkeleton.calculateInverses();

  const boneInverses: Record<string, THREE.Matrix4> = {};
  templateBones.forEach((b, idx) => {
    boneInverses[b.name] = baseSkeleton.boneInverses[idx].clone();
  });

  const makeSkinnedPart = (name: string, matName: string, withMorphs = false) => {
    const geom = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const posAttr = geom.getAttribute("position");
    const count = posAttr.count;
    const skinIdx = new Uint16Array(count * 4);
    const skinWt = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      skinWt[i * 4] = 1.0;
    }
    geom.setAttribute("skinIndex", new THREE.BufferAttribute(skinIdx, 4));
    geom.setAttribute("skinWeight", new THREE.BufferAttribute(skinWt, 4));

    const mat = new THREE.MeshStandardMaterial({ name: matName, color: "#ffffff" });
    const mesh = new THREE.SkinnedMesh(geom, mat);
    mesh.name = name;
    mesh.bind(new THREE.Skeleton(templateBones, templateBones.map((b) => boneInverses[b.name].clone())), new THREE.Matrix4());
    if (withMorphs) {
      mesh.morphTargetDictionary = {
        expr_smile: 0,
        expr_open_smile: 1,
        expr_smirk: 2,
        expr_focused: 3,
        expr_blink: 4,
        expr_wink: 5,
        expr_talk_a: 6,
        expr_talk_o: 7,
      };
      mesh.morphTargetInfluences = [0, 0, 0, 0, 0, 0, 0, 0];
    }
    return mesh;
  };

  const catalogNodes: Record<string, THREE.Object3D> = {
    Head_Female: makeSkinnedPart("Head_Female", "Mat_Skin_female", true),
    Head_Male: makeSkinnedPart("Head_Male", "Mat_Skin_male", true),
    Hair_ponytail: makeSkinnedPart("Hair_ponytail", "Mat_Hair_Main"),
    Hair_bob: makeSkinnedPart("Hair_bob", "Mat_Hair_Main"),
    Hair_long: makeSkinnedPart("Hair_long", "Mat_Hair_Main"),
    Hair_short: makeSkinnedPart("Hair_short", "Mat_Hair_Main"),
    Hair_under_cap: makeSkinnedPart("Hair_under_cap", "Mat_Hair_Main"),
    Upper_polo: makeSkinnedPart("Upper_polo", "Mat_Garment_Primary"),
    Upper_blazer: makeSkinnedPart("Upper_blazer", "Mat_Garment_Primary"),
    Arms_Skin_Short: makeSkinnedPart("Arms_Skin_Short", "Mat_Skin_ArmBase"),
    Hands_Skin_Only: makeSkinnedPart("Hands_Skin_Only", "Mat_Skin_ArmBase"),
    Arms_Skin_Short_Peace: makeSkinnedPart("Arms_Skin_Short_Peace", "Mat_Skin_ArmBase"),
    Hands_Skin_Only_Peace: makeSkinnedPart("Hands_Skin_Only_Peace", "Mat_Skin_ArmBase"),
    Lower_chinos: makeSkinnedPart("Lower_chinos", "Mat_Garment_Secondary"),
    Lower_skirt_exec: makeSkinnedPart("Lower_skirt_exec", "Mat_Garment_Secondary"),
    Legs_Skin_Bare: makeSkinnedPart("Legs_Skin_Bare", "Mat_Skin_ArmBase"),
    Shoe_sneaker: makeSkinnedPart("Shoe_sneaker", "Mat_Garment_Primary"),
    Shoe_oxford: makeSkinnedPart("Shoe_oxford", "Mat_Garment_Leather"),
    Acc_eyewear_executive: makeSkinnedPart("Acc_eyewear_executive", "Mat_Acc_Metal"),
    Acc_headwear_cap: makeSkinnedPart("Acc_headwear_cap", "Mat_Acc_Brand"),
    Acc_headset_pro: makeSkinnedPart("Acc_headset_pro", "Mat_Acc_Dark"),
    Acc_prop_coffee: makeSkinnedPart("Acc_prop_coffee", "Mat_Acc_Ceramic"),
  };

  const makeClip = (name: string) =>
    new THREE.AnimationClip(name, 1.0, [
      new THREE.QuaternionKeyframeTrack("head.quaternion", [0, 0.5, 1.0], [0, 0, 0, 1, 0, 0.05, 0, 1, 0, 0, 0, 1]),
    ]);

  return {
    rigTemplate: rigRoot,
    boneInverses,
    catalogNodes,
    animations: {
      Idle: makeClip("Idle"),
      Walk: makeClip("Walk"),
      Wave: makeClip("Wave"),
      Thinking: makeClip("Thinking"),
      Typing: makeClip("Typing"),
      Celebrating: makeClip("Celebrating"),
      Interact: makeClip("Interact"),
      Pose_Executive: makeClip("Pose_Executive"),
      Pose_Consultative: makeClip("Pose_Consultative"),
      Pose_Peace: makeClip("Pose_Peace"),
      Pose_Hero: makeClip("Pose_Hero"),
    },
  };
}

describe("Avatar Engine 2.0 — Feature Flag, Modular Mapping & Live Slot Isolation", () => {
  afterEach(() => {
    setAvatarEnginePreference(null);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
  });

  it("supports safe instant rollback between GLB and procedural engine via query/localStorage flag", () => {
    expect(getActiveAvatarEngine()).toBe("glb");
    expect(normalizeAvatarEngineKind("procedural")).toBe("procedural");
    expect(normalizeAvatarEngineKind("legacy")).toBe("procedural");
    expect(normalizeAvatarEngineKind("glb")).toBe("glb");

    setAvatarEnginePreference("procedural");
    expect(getActiveAvatarEngine()).toBe("procedural");

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/?avatarEngine=glb");
      expect(getActiveAvatarEngine()).toBe("glb");
      window.history.replaceState({}, "", "/?avatarEngine=procedural");
      expect(getActiveAvatarEngine()).toBe("procedural");
    }
  });

  it("maps every catalog item across all 8 modular categories without null or invalid nodes", () => {
    for (const h of AVATAR_HAIRS) {
      const fPlan = resolveGLBCompositionPlan({ body: "female", hair: h.id });
      const mPlan = resolveGLBCompositionPlan({ body: "male", hair: h.id });
      expect(fPlan.hairNode).toMatch(/^Hair_/);
      expect(mPlan.hairNode).toMatch(/^Hair_/);
      expect(fPlan.headNode).toBe("Head_Female");
      expect(mPlan.headNode).toBe("Head_Male");
    }
    for (const f of AVATAR_FACES) {
      const plan = resolveGLBCompositionPlan({ face: f.id });
      const totalMorph = Object.values(plan.morphWeights).reduce((acc, v) => acc + v, 0);
      expect(totalMorph).toBeGreaterThan(0.1);
    }
    for (const o of AVATAR_OUTFITS) {
      const plan = resolveGLBCompositionPlan({ outfit: o.id });
      expect(plan.upperNode).toMatch(/^Upper_/);
    }
    for (const l of SLOT_LOWER_BODY_ITEMS) {
      const plan = resolveGLBCompositionPlan({ lowerBody: l.id });
      expect(plan.lowerNode).toMatch(/^Lower_/);
      expect(Boolean(plan.bareLegsNode)).toBe(l.id === "lower_skirt_exec");
    }
    for (const s of SLOT_FOOTWEAR_ITEMS) {
      const plan = resolveGLBCompositionPlan({ footwear: s.id });
      expect(plan.shoeNode).toMatch(/^Shoe_/);
    }
    for (const u of SLOT_UNIFORM_ITEMS) {
      const plan = resolveGLBCompositionPlan({ uniform: u.id });
      expect(plan.palette.accentHex).toBeTruthy();
    }
    for (const st of AVATAR_STYLES) {
      const plan = resolveGLBCompositionPlan({ style: st.id });
      expect(plan.palette.accentHex).toBeTruthy();
    }
    for (const a of AVATAR_ACCESSORIES) {
      const plan = resolveGLBCompositionPlan({ accessories: [a.id] });
      expect(plan.upperNode).toBe("Upper_polo");
    }
  });

  it("swaps hair, wardrobe, and accessories independently inside the live rig without clobbering unrelated slots", () => {
    const packs = makeSyntheticPacks();
    let cfg = buildSlotUpdate({ agentId: "camila", body: "female", hair: "hair_02", upperBody: "upper_polo" }, "headset", "headset_pro");
    const char = composeGLBAvatarCharacter(packs, resolveGLBCompositionPlan(cfg));

    const initialRig = char.rigRoot;
    const initialHead = char.slots.head.object;
    const initialUpper = char.slots.upper.object;
    const initialHeadset = char.slots.acc_headset.object;
    const initialShoe = char.slots.shoe.object;

    // 1. Bind integrity check: bones belong to live cloned rig, NOT pack template!
    const headMesh = initialHead as THREE.SkinnedMesh;
    expect(headMesh.skeleton.bones.map((b) => b.name)).toContain("head");
    expect(headMesh.skeleton.getBoneByName("head")).toBe(char.bonesByName.head);

    // 2. Swap hair_slot -> ONLY hair replaces, head/upper/headset/shoe stay EXACT same object identity
    cfg = buildSlotUpdate(cfg, "hair_slot", "hair_03");
    char.applyPlan(resolveGLBCompositionPlan(cfg));
    expect(char.rigRoot).toBe(initialRig);
    expect(char.slots.head.object).toBe(initialHead);
    expect(char.slots.upper.object).toBe(initialUpper);
    expect(char.slots.acc_headset.object).toBe(initialHeadset);
    expect(char.slots.shoe.object).toBe(initialShoe);
    expect(char.slots.hair.nodeName).toBe("Hair_long");

    // 3. Equip eyewear -> ONLY eyewear mounts; hair, head, upper stay identical
    const longHairObj = char.slots.hair.object;
    cfg = buildSlotUpdate(cfg, "eyewear", "eyewear_executive");
    char.applyPlan(resolveGLBCompositionPlan(cfg));
    expect(char.slots.hair.object).toBe(longHairObj);
    expect(char.slots.acc_eyewear.nodeName).toBe("Acc_eyewear_executive");
    expect(char.slots.acc_headset.nodeName).toBe("Acc_headset_pro");

    // 4. Equip headwear -> swaps hair visually to Hair_under_cap without forgetting hair_03 in config!
    cfg = buildSlotUpdate(cfg, "headwear", "headwear_cap");
    char.applyPlan(resolveGLBCompositionPlan(cfg));
    expect(char.slots.hair.nodeName).toBe("Hair_under_cap");
    expect(cfg.hair).toBe("hair_03");

    // Unequip headwear -> restores Hair_long automatically!
    cfg = buildSlotUpdate(cfg, "headwear", "none");
    char.applyPlan(resolveGLBCompositionPlan(cfg));
    expect(char.slots.hair.nodeName).toBe("Hair_long");

    // 5. Wave & Pose_Peace stow coffee mug automatically and enable Peace right hand
    cfg = buildSlotUpdate(cfg, "prop", "prop_coffee");
    char.applyPlan(resolveGLBCompositionPlan(cfg, { movement3D: "idle" }));
    expect(char.slots.acc_prop.nodeName).toBe("Acc_prop_coffee");

    char.applyPlan(resolveGLBCompositionPlan(cfg, { movement3D: "wave" }));
    expect(char.slots.acc_prop.object).toBeNull();

    char.applyPlan(resolveGLBCompositionPlan(cfg, { movement3D: "pose", poseId: "pose_peace" }));
    expect(char.slots.limbs.nodeName).toBe("Arms_Skin_Short_Peace");
    expect(char.slots.acc_prop.object).toBeNull();

    // 6. Speaking / TALKING oscillates mouth talk morph targets smoothly
    char.applyPlan(resolveGLBCompositionPlan(cfg, { operationalState: "TALKING" }));
    char.updateAnimation(0.05, 0.25);
    const talkIdx = headMesh.morphTargetDictionary?.expr_talk_a ?? -1;
    expect(talkIdx).toBeGreaterThanOrEqual(0);
    expect(headMesh.morphTargetInfluences?.[talkIdx] ?? 0).toBeGreaterThan(0);

    // 7. Disconnected / OFFLINE closes eyelids cleanly
    char.applyPlan(resolveGLBCompositionPlan(cfg, { operationalState: "OFFLINE" }));
    char.updateAnimation(0.05, 0.5);
    const blinkIdx = headMesh.morphTargetDictionary?.expr_blink ?? -1;
    expect(headMesh.morphTargetInfluences?.[blinkIdx] ?? 0).toBeGreaterThan(0.9);

    char.dispose();
  });
});
