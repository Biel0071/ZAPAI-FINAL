import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  ALL_SLOT_CATALOG_ITEMS,
  buildSlotUpdate,
  normalizeAvatarComposition,
  SLOT_FACE_ITEMS,
  SLOT_FOOTWEAR_ITEMS,
  SLOT_HAIR_ITEMS,
  SLOT_LOWER_BODY_ITEMS,
  SLOT_UPPER_BODY_ITEMS,
} from "../slotCatalog";
import { resolveAvatarLook3D } from "../look3d";
import { buildHumanoidCharacter } from "../buildChibi";
import {
  ALL_AVATAR_ANIM_STATES,
  AvatarAnimationFSM,
  resolveAnimStateFromProps,
} from "../animationStateMachine";
import { ZaiAvatarRenderer } from "../../ZaiAvatarRenderer";
import { AvatarItemPreview } from "../../AvatarItemPreview";

function collectNames(root: THREE.Object3D): string[] {
  const out: string[] = [];
  root.traverse((n) => {
    if (n.name) out.push(n.name);
  });
  return out;
}

describe("Step 5 — Modular 3D Humanoid Rig, Slot Catalog, Animation FSM & Fallbacks", () => {
  it("ensures catalog completeness across every slot item", () => {
    expect(SLOT_HAIR_ITEMS).toHaveLength(18);
    expect(SLOT_FACE_ITEMS).toHaveLength(8);
    expect(SLOT_UPPER_BODY_ITEMS).toHaveLength(8);
    expect(SLOT_LOWER_BODY_ITEMS).toHaveLength(5);
    expect(SLOT_FOOTWEAR_ITEMS).toHaveLength(5);

    for (const item of ALL_SLOT_CATALOG_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.slot).toBeTruthy();
      expect(item.assetBuilderId).toBeTruthy();
      expect(item.materialPreset).toBeTruthy();
      expect(item.mountPoint).toBeTruthy();
      expect(item.version).toBeTruthy();
      expect(item.available).toBe(true);
      expect(Array.isArray(item.compatibleAnimations)).toBe(true);
      expect(item.compatibleAnimations.length).toBeGreaterThan(0);
      expect(item.compatibility.genders.length).toBeGreaterThan(0);
      expect(item.thumbnailSpec.focus).toBeTruthy();
    }
  });

  it("never forces hairColor, headwear, eyewear, skin, or beard when selecting hair_01..18 or face_01..08", () => {
    let comp = normalizeAvatarComposition({
      agentId: "custom",
      body: "male",
      base: "male",
      skin: "bronze",
      hair: "hair_05",
      hairColor: "emerald",
      facialHair: "none",
      face: "face_01",
      glasses: "none",
    });

    // Selecting hair_11, hair_13, hair_14, hair_16, hair_18 must preserve hairColor, headwear=none, glasses=none, facialHair=none
    for (const hairId of ["hair_03", "hair_11", "hair_13", "hair_14", "hair_16", "hair_18"]) {
      comp = buildSlotUpdate(comp, "hair_slot", hairId);
      expect(comp.hair).toBe(hairId);
      expect(comp.hairColor).toBe("emerald");
      expect(comp.facialHair).toBe("none");
      expect(comp.accessorySubSlots.headwear).toBe("none");
      expect(comp.accessorySubSlots.eyewear).toBe("none");
      const look = resolveAvatarLook3D(comp);
      expect(look.headwear).toBe("none");
      expect(look.beard).toBe(false);
      expect(look.accessories.glasses).toBe(false);
    }

    // Selecting face_04, face_06, face_07, face_08 must NOT overwrite skin, glasses, sunglasses, or beard
    for (const faceId of ["face_04", "face_06", "face_07", "face_08"]) {
      comp = buildSlotUpdate(comp, "face_slot", faceId);
      expect(comp.face).toBe(faceId);
      expect(comp.skin).toBe("bronze");
      expect(comp.facialHair).toBe("none");
      expect(comp.accessorySubSlots.eyewear).toBe("none");
      const look = resolveAvatarLook3D(comp);
      expect(look.accessories.glasses).toBe(false);
      expect(look.accessories.sunglasses).toBe(false);
      expect(look.beard).toBe(false);
    }
  });

  it("replaces each slot independently without altering unrelated slots, morphs, or sub-slots", () => {
    let comp = normalizeAvatarComposition({
      agentId: "rafael",
      body: "male",
      skin: "tan",
      hair: "hair_05",
      hairColor: "dark_brown",
      face: "face_01",
      facialHair: "short_beard",
      upperBody: "upper_polo",
      lowerBody: "lower_chinos",
      footwear: "shoe_sneaker",
    });

    // Equip multiple independent accessory sub-slots
    comp = buildSlotUpdate(comp, "eyewear", "eyewear_executive");
    comp = buildSlotUpdate(comp, "headset", "headset_pro");
    comp = buildSlotUpdate(comp, "badge", "badge_lanyard");
    comp = buildSlotUpdate(comp, "wrist", "wrist_smartwatch");
    comp = buildSlotUpdate(comp, "prop", "prop_coffee");
    comp = buildSlotUpdate(comp, "back", "back_backpack");

    expect(comp.accessorySubSlots).toEqual({
      eyewear: "eyewear_executive",
      headwear: "none",
      headset: "headset_pro",
      badge: "badge_lanyard",
      wrist: "wrist_smartwatch",
      prop: "prop_coffee",
      back: "back_backpack",
    });

    // Swap upper_body_slot -> lowerBody, footwear, hair, face, accessories untouched
    comp = buildSlotUpdate(comp, "upper_body_slot", "upper_blazer");
    expect(comp.upperBody).toBe("upper_blazer");
    expect(comp.lowerBody).toBe("lower_chinos");
    expect(comp.footwear).toBe("shoe_sneaker");
    expect(comp.hair).toBe("hair_05");
    expect(comp.accessorySubSlots.eyewear).toBe("eyewear_executive");
    expect(comp.accessorySubSlots.wrist).toBe("wrist_smartwatch");

    // Swap lower_body_slot & footwear_slot independently
    comp = buildSlotUpdate(comp, "lower_body_slot", "lower_slacks");
    comp = buildSlotUpdate(comp, "footwear_slot", "shoe_oxford");
    expect(comp.upperBody).toBe("upper_blazer");
    expect(comp.lowerBody).toBe("lower_slacks");
    expect(comp.footwear).toBe("shoe_oxford");

    // Swap hairColor independently -> hair style remains hair_05
    comp = buildSlotUpdate(comp, "hairColor", "platinum");
    expect(comp.hair).toBe("hair_05");
    expect(comp.hairColor).toBe("platinum");

    // Swap gender morph -> proportions change without resetting any equipped items!
    comp = buildSlotUpdate(comp, "gender", "female");
    expect(comp.body).toBe("female");
    expect(comp.hair).toBe("hair_05");
    expect(comp.hairColor).toBe("platinum");
    expect(comp.upperBody).toBe("upper_blazer");
    expect(comp.lowerBody).toBe("lower_slacks");
    expect(comp.footwear).toBe("shoe_oxford");
    expect(comp.facialHair).toBe("short_beard");
    expect(comp.accessorySubSlots.headset).toBe("headset_pro");

    // Swap uniform_slot / style_slot -> only updates palette/posture without overwriting garments/hair/face/accessories
    comp = buildSlotUpdate(comp, "uniform_slot", "uniform_corporate_sky");
    expect(comp.branding.primaryColor).toBe("#0ea5e9");
    expect(comp.upperBody).toBe("upper_blazer");
    expect(comp.hair).toBe("hair_05");
    expect(comp.face).toBe("face_01");
    expect(comp.accessorySubSlots.badge).toBe("badge_lanyard");
  });

  it("swaps 3D slot mount groups in place without rebuilding the humanoid skeleton", () => {
    const initial = normalizeAvatarComposition({
      agentId: "camila",
      body: "female",
      hair: "hair_01",
      face: "face_01",
      upperBody: "upper_polo",
      lowerBody: "lower_chinos",
      footwear: "shoe_sneaker",
    });
    const char = buildHumanoidCharacter(resolveAvatarLook3D(initial));

    const skeletonPelvisRef = char.rig.skeleton.pelvis;
    const skeletonHeadRef = char.rig.skeleton.head;
    const faceMountRef = char.rig.mounts.face_slot;
    const upperChildRef = char.rig.mounts.upper_body_slot.children[0];

    // Swap ONLY hair_slot in place
    const nextHair = buildSlotUpdate(initial, "hair_slot", "hair_04");
    char.swapSlot("hair_slot", resolveAvatarLook3D(nextHair));

    expect(char.rig.skeleton.pelvis).toBe(skeletonPelvisRef);
    expect(char.rig.skeleton.head).toBe(skeletonHeadRef);
    expect(char.rig.mounts.face_slot).toBe(faceMountRef);
    expect(char.rig.mounts.upper_body_slot.children[0]).toBe(upperChildRef);
    expect(collectNames(char.rig.mounts.hair_slot)).toContain("hair-bun");

    // Verify 3D face features exist inside face_slot (real 3D eyeballs, irises, pupils, eyelids, brows, lips)
    const faceParts = collectNames(char.rig.mounts.face_slot);
    expect(faceParts).toEqual(
      expect.arrayContaining([
        "eyeball--1",
        "eyeball-1",
        "iris--1",
        "pupil--1",
        "upper-eyelid--1",
        "upper-eyelid-1",
        "eyebrow-left",
        "eyebrow-right",
        "upper-lip",
        "lower-lip",
      ]),
    );

    // Swap ONLY eyewear sub-slot without touching headset/badge
    const withGear = buildSlotUpdate(
      buildSlotUpdate(nextHair, "headset", "headset_pro"),
      "eyewear",
      "eyewear_executive",
    );
    char.swapAccessorySubSlot("headset", resolveAvatarLook3D(withGear));
    char.swapAccessorySubSlot("eyewear", resolveAvatarLook3D(withGear));
    expect(collectNames(char.rig.mounts.accessories.headset)).toContain("acc-headset");
    expect(collectNames(char.rig.mounts.accessories.eyewear)).toContain("acc-glasses");

    char.dispose();
  });

  it("parents both spine and thighs under pelvis so torso and legs move cohesively during walk", () => {
    const comp = normalizeAvatarComposition({ agentId: "carlos", body: "male" });
    const char = buildHumanoidCharacter(resolveAvatarLook3D(comp));
    const sk = char.rig.skeleton;

    // Verify exact hierarchical skeleton
    expect(sk.root.children).toContain(sk.turntable);
    expect(sk.turntable.children).toContain(sk.pelvis);
    expect(sk.pelvis.children).toEqual(expect.arrayContaining([sk.spine, sk.leftThigh, sk.rightThigh]));
    expect(sk.spine.children).toContain(sk.chest);
    expect(sk.chest.children).toEqual(expect.arrayContaining([sk.neck, sk.leftClavicle, sk.rightClavicle]));
    expect(sk.neck.children).toContain(sk.head);
    expect(sk.leftClavicle.children).toContain(sk.leftUpperArm);
    expect(sk.leftUpperArm.children).toContain(sk.leftForearm);
    expect(sk.leftForearm.children).toContain(sk.leftHand);
    expect(sk.leftThigh.children).toContain(sk.leftShin);
    expect(sk.leftShin.children).toContain(sk.leftAnkle);
    expect(sk.leftAnkle.children).toContain(sk.leftFoot);

    const fsm = new AvatarAnimationFSM("walk");
    fsm.bindRig(char.rig);

    const restPelvisY = sk.pelvis.position.y;
    fsm.update(0.25, char.rig, char.hold);
    sk.root.updateMatrixWorld(true);

    const pelvisWorld = new THREE.Vector3();
    const spineWorld = new THREE.Vector3();
    const chestWorld = new THREE.Vector3();
    const leftThighWorld = new THREE.Vector3();
    sk.pelvis.getWorldPosition(pelvisWorld);
    sk.spine.getWorldPosition(spineWorld);
    sk.chest.getWorldPosition(chestWorld);
    sk.leftThigh.getWorldPosition(leftThighWorld);

    // Pelvis delta shifts both upper torso (spine -> chest) and thighs cohesively (zero waist detachment)
    const pelvisDelta = sk.pelvis.position.y - restPelvisY;
    expect(Math.abs(pelvisDelta)).toBeGreaterThan(0.001);
    expect(spineWorld.distanceTo(pelvisWorld)).toBeCloseTo(sk.spine.position.y, 4);
    expect(chestWorld.distanceTo(spineWorld)).toBeCloseTo(sk.chest.position.y, 4);
    expect(leftThighWorld.y).toBeCloseTo(pelvisWorld.y, 2);

    // Stride has opposite legs & opposite arms
    expect(Math.sign(sk.leftThigh.rotation.x)).not.toBe(Math.sign(sk.rightThigh.rotation.x));
    expect(Math.sign(sk.leftUpperArm.rotation.x)).not.toBe(Math.sign(sk.rightUpperArm.rotation.x));
    expect(sk.leftShin.rotation.x).toBeGreaterThanOrEqual(0);
    expect(sk.rightShin.rotation.x).toBeGreaterThanOrEqual(0);

    char.dispose();
  });

  it("supports mutually exclusive Animation FSM transitions across all 10 states, stows coffee during wave, and folds fingers cleanly in pose_peace", () => {
    let comp = normalizeAvatarComposition({ agentId: "camila", body: "female" });
    comp = buildSlotUpdate(comp, "prop", "prop_coffee");
    const char = buildHumanoidCharacter(resolveAvatarLook3D(comp));
    const fsm = new AvatarAnimationFSM("idle");
    fsm.bindRig(char.rig);

    // Verify prop mapper & all 10 states execute cleanly
    expect(resolveAnimStateFromProps("idle", "THINKING")).toBe("thinking");
    expect(resolveAnimStateFromProps("idle", "TYPING")).toBe("typing");
    expect(resolveAnimStateFromProps("idle", "TALKING")).toBe("attending");
    expect(resolveAnimStateFromProps("idle", "SUCCESS")).toBe("celebrating");
    expect(resolveAnimStateFromProps("idle", "ERROR")).toBe("error");
    expect(resolveAnimStateFromProps("idle", "OFFLINE")).toBe("disconnected");

    for (const state of ALL_AVATAR_ANIM_STATES) {
      fsm.setState(state);
      expect(fsm.getState()).toBe(state);
      for (let i = 0; i < 6; i += 1) {
        fsm.update(0.05, char.rig, char.hold);
      }
    }

    // Wave stows right-hand coffee cup so it's never waved upside down
    fsm.setState("wave");
    for (let i = 0; i < 12; i += 1) fsm.update(0.05, char.rig, char.hold);
    expect(char.rig.mounts.accessories.propRight.visible).toBe(false);
    expect(char.rig.skeleton.rightUpperArm.rotation.z).toBeGreaterThan(1.5);

    // Returning to idle restores right-hand coffee cup cleanly
    fsm.setState("idle");
    for (let i = 0; i < 20; i += 1) fsm.update(0.05, char.rig, char.hold);
    expect(char.rig.mounts.accessories.propRight.visible).toBe(true);

    // pose_peace folds ring/pinky/thumb while extending index & middle fingers without duplicate floating fingers
    fsm.setState("pose", "pose_peace");
    for (let i = 0; i < 15; i += 1) fsm.update(0.05, char.rig, char.hold);
    const rh = char.rig.rightHandControls;
    expect(rh.ringFinger.rotation.x).toBeGreaterThan(1.0);
    expect(rh.pinkyFinger.rotation.x).toBeGreaterThan(1.0);
    expect(Math.abs(rh.indexFinger.rotation.x)).toBeLessThan(0.2);
    expect(collectNames(char.rig.skeleton.rightHand).filter((n) => n === "hand-peace")).toHaveLength(0);

    // Disconnected closes eyelids significantly
    fsm.setState("disconnected");
    for (let i = 0; i < 15; i += 1) fsm.update(0.05, char.rig, char.hold);
    expect(fsm.getSnapshot().blinkLeft).toBeGreaterThan(0.6);

    char.dispose();
  });

  it("renders high-res 3D snapshot when present and accurate male vector fallback for João Silva (never female sprite)", () => {
    // 1. Saved 3D snapshot takes precedence on cards
    const withSnapshot = renderToStaticMarkup(
      React.createElement(ZaiAvatarRenderer, {
        avatar: {
          agentId: "joao-silva",
          body: "male",
          snapshotDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
        },
        size: "md",
      }),
    );
    expect(withSnapshot).toContain('data-avatar-snapshot="true"');
    expect(withSnapshot).toContain("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");

    // 2. Fallback without snapshot infers João Silva as male and never shows female pixel sprite
    const joaoFallback = renderToStaticMarkup(
      React.createElement(ZaiAvatarRenderer, {
        avatar: { agentId: "joao-silva", name: "João Silva" } as Partial<import("../../AvatarDefinition").AgentAvatarConfig> & { name: string },
        size: "md",
      }),
    );
    expect(joaoFallback).toContain('data-avatar-gender="male"');
    expect(joaoFallback).not.toContain('opacity="1" href="/assets/avatar_factory/catalog/sprite_r2_');
    expect(joaoFallback).toContain("layer-lower-body");

    // 3. AvatarItemPreview renders distinct category-specific previews in jsdom without crashing
    const lowerPreview = renderToStaticMarkup(
      React.createElement(AvatarItemPreview, { itemId: "lower_cargo", focus: "lower_body", title: "Cargo" }),
    );
    const shoePreview = renderToStaticMarkup(
      React.createElement(AvatarItemPreview, { itemId: "shoe_oxford", focus: "footwear", title: "Oxford" }),
    );
    expect(lowerPreview).not.toBe(shoePreview);
    expect(lowerPreview).toContain('data-avatar-preview-item="lower_cargo"');
    expect(shoePreview).toContain('data-avatar-preview-item="shoe_oxford"');
  });
});
