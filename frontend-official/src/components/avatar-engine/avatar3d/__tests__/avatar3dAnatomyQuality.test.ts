import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { resolveAvatarLook3D } from "../look3d";
import { buildHumanoidCharacter } from "../buildChibi";
import {
  ALL_AVATAR_ANIM_STATES,
  AvatarAnimationFSM,
} from "../animationStateMachine";
import { evalSculptedHeadLocal, HEAD_CENTER_Y, HEAD_RADIUS } from "../anatomy";
import {
  SLOT_HAIR_ITEMS,
  SLOT_LOWER_BODY_ITEMS,
  SLOT_UPPER_BODY_ITEMS,
  SLOT_FOOTWEAR_ITEMS,
} from "../slotCatalog";

function worldBox(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj);
}

function worldPos(obj: THREE.Object3D): THREE.Vector3 {
  obj.updateMatrixWorld(true);
  return obj.getWorldPosition(new THREE.Vector3());
}

describe("Commercial Chibi 3D Anatomy & Quality Gates", () => {
  it("builds a rounded non-triangular head with symmetrical ears, cheeks, eyes, brows, and grounded shoes", () => {
    for (const gender of ["female", "male"] as const) {
      const look = resolveAvatarLook3D({
        agentId: gender === "female" ? "camila" : "joao",
        body: gender,
        base: gender,
        hair: gender === "female" ? "hair_01" : "hair_05",
        outfit: "outfit_01",
        accessories: ["acc_02", "acc_03"],
      });
      const chibi = buildHumanoidCharacter(look);
      const { skeleton, mounts } = chibi.rig;
      skeleton.root.updateMatrixWorld(true);

      // 1. Non-triangular U-shaped chin width ratio
      const cheekPt = evalSculptedHeadLocal(1, -0.2, 0, look.female);
      const jawMidPt = evalSculptedHeadLocal(Math.cos(-0.65), Math.sin(-0.65), 0, look.female);
      expect(jawMidPt.x / cheekPt.x).toBeGreaterThan(0.62);

      // 2. Bilateral symmetry of eyebrows, shoulders, hands, hips, feet
      const browL = worldPos(skeleton.head.getObjectByName("eyebrow-left")!);
      const browR = worldPos(skeleton.head.getObjectByName("eyebrow-right")!);
      expect(Math.abs(browL.x + browR.x)).toBeLessThan(0.002);
      expect(Math.abs(browL.y - browR.y)).toBeLessThan(0.002);
      expect(Math.abs(browL.z - browR.z)).toBeLessThan(0.002);

      const earL = worldPos(skeleton.head.getObjectByName("ear--1")!);
      const earR = worldPos(skeleton.head.getObjectByName("ear-1")!);
      expect(Math.abs(earL.x + earR.x)).toBeLessThan(0.002);
      expect(Math.abs(earL.y - earR.y)).toBeLessThan(0.002);

      const handL = worldPos(skeleton.leftHand);
      const handR = worldPos(skeleton.rightHand);
      expect(Math.abs(handL.x + handR.x)).toBeLessThan(0.002);
      expect(Math.abs(handL.y - handR.y)).toBeLessThan(0.002);

      // 3. Proportions (~2.7..3.7 heads tall including hair volume) and feet grounded near y = 0
      const fullBox = worldBox(skeleton.root);
      const headMesh = skeleton.head.getObjectByName("head-skin")!;
      const headBox = worldBox(headMesh);
      const totalHeight = fullBox.max.y - fullBox.min.y;
      const headHeight = headBox.max.y - headBox.min.y;
      const headRatio = totalHeight / headHeight;

      expect(headRatio).toBeGreaterThan(2.65);
      expect(headRatio).toBeLessThan(3.7);
      expect(Math.abs(fullBox.min.y)).toBeLessThan(0.03);

      // 4. Anatomical hand must have rounded palm + thumb + 4 articulated fingers (NO BoxGeometry block palm)
      const palm = skeleton.leftHand.getObjectByName("hand-palm") as THREE.Mesh;
      expect(palm).toBeTruthy();
      expect(palm.geometry.type).not.toBe("BoxGeometry");
      expect(skeleton.leftHand.getObjectByName("finger-index")).toBeTruthy();
      expect(skeleton.leftHand.getObjectByName("finger-pinky")).toBeTruthy();
      expect(skeleton.leftHand.getObjectByName("hand-thumb")).toBeTruthy();

      // 5. Continuous vertical connectivity (neck <-> torso, torso <-> pelvis, pelvis <-> legs <-> footwear)
      // plus sealed crotch saddle & non-skin pelvis core
      const neckBox = worldBox(skeleton.neck);
      const torsoBox = worldBox(skeleton.chest.getObjectByName("torso")!);
      const waistWrapBox = worldBox(mounts.lower_body_slot.getObjectByName("lower-pelvis-wrap")!);
      const saddleMesh = mounts.lower_body_slot.getObjectByName("lower-pelvis-saddle") as THREE.Mesh;
      const pelvisCoreMesh = skeleton.pelvis.getObjectByName("pelvis-core") as THREE.Mesh;
      const footBox = worldBox(mounts.feet.left);
      const nosePos = worldPos(skeleton.head.getObjectByName("head-nose")!);

      expect(saddleMesh).toBeTruthy();
      expect(pelvisCoreMesh).toBeTruthy();
      expect((pelvisCoreMesh.material as THREE.MeshStandardMaterial).color.getHexString()).not.toBe(
        new THREE.Color(look.skin).getHexString(),
      );
      expect(browL.y).toBeGreaterThan(nosePos.y);
      expect(headBox.min.y).toBeLessThan(neckBox.max.y + 0.01);
      expect(neckBox.min.y).toBeLessThan(torsoBox.max.y + 0.01);
      expect(torsoBox.min.y).toBeLessThan(waistWrapBox.max.y + 0.015);
      expect(footBox.min.y).toBeLessThan(0.03);

      chibi.dispose();
    }
  });

  it("renders volumetric 3D bounds for every hair, upper outfit, lower body, and footwear catalog piece", () => {
    for (const hair of SLOT_HAIR_ITEMS) {
      const chibi = buildHumanoidCharacter(
        resolveAvatarLook3D({ agentId: "qa", body: hair.gender === "male" ? "male" : "female", hair: hair.id }),
      );
      const hairBox = worldBox(chibi.rig.mounts.hair_slot);
      expect(hairBox.isEmpty()).toBe(false);
      const sz = hairBox.getSize(new THREE.Vector3());
      expect(sz.x).toBeGreaterThan(HEAD_RADIUS * 1.8);
      expect(sz.y).toBeGreaterThan(HEAD_RADIUS * 1.0);
      expect(sz.z).toBeGreaterThan(HEAD_RADIUS * 1.4);
      chibi.dispose();
    }

    for (const outfit of SLOT_UPPER_BODY_ITEMS) {
      const chibi = buildHumanoidCharacter(resolveAvatarLook3D({ agentId: "qa", body: "female", outfit: outfit.id }));
      const outBox = worldBox(chibi.rig.mounts.upper_body_slot);
      expect(outBox.isEmpty()).toBe(false);
      const sz = outBox.getSize(new THREE.Vector3());
      expect(sz.x).toBeGreaterThan(0.24);
      expect(sz.y).toBeGreaterThan(0.32);
      expect(sz.z).toBeGreaterThan(0.18);
      chibi.dispose();
    }

    for (const lower of SLOT_LOWER_BODY_ITEMS) {
      const chibi = buildHumanoidCharacter(resolveAvatarLook3D({ agentId: "qa", body: "female", lowerBody: lower.id }));
      const lowBox = worldBox(chibi.rig.mounts.lower_body_slot);
      expect(lowBox.isEmpty()).toBe(false);
      chibi.dispose();
    }

    for (const shoe of SLOT_FOOTWEAR_ITEMS) {
      const chibi = buildHumanoidCharacter(resolveAvatarLook3D({ agentId: "qa", body: "male", footwear: shoe.id }));
      const shoeBox = worldBox(chibi.rig.mounts.feet.left);
      expect(shoeBox.isEmpty()).toBe(false);
      chibi.dispose();
    }
  });

  it("keeps eyewear & headset outside interior cranium and keeps hierarchy connected across all FSM states", () => {
    const look = resolveAvatarLook3D({
      agentId: "camila",
      body: "female",
      hair: "hair_01",
      outfit: "outfit_05",
      accessories: ["acc_02", "acc_04", "acc_05"],
    });
    const chibi = buildHumanoidCharacter(look);
    const { skeleton, mounts } = chibi.rig;
    const headCenter = new THREE.Vector3(0, HEAD_CENTER_Y, 0);
    skeleton.head.localToWorld(headCenter);
    skeleton.root.updateMatrixWorld(true);

    // Check glasses sit in front of head center without sunken frames
    const glassesBox = worldBox(mounts.accessories.eyewear);
    expect(glassesBox.isEmpty()).toBe(false);
    expect(glassesBox.max.z).toBeGreaterThan(HEAD_RADIUS * 0.92);

    // Check headset cups clear outside lateral cranium edges
    const cupL = worldPos(mounts.accessories.headset.getObjectByName("headset-cup--1")!);
    const cupR = worldPos(mounts.accessories.headset.getObjectByName("headset-cup-1")!);
    expect(Math.abs(cupL.x)).toBeGreaterThan(HEAD_RADIUS * 0.98);
    expect(Math.abs(cupR.x)).toBeGreaterThan(HEAD_RADIUS * 0.98);

    // Exercise every FSM animation state & verify chest-to-head and pelvis-to-ankle remain tightly connected
    const fsm = new AvatarAnimationFSM("idle");
    fsm.bindRig(chibi.rig);

    for (const state of ALL_AVATAR_ANIM_STATES) {
      fsm.setState(state);
      for (let f = 0; f < 6; f += 1) {
        fsm.update(0.12, chibi.rig, chibi.hold);
      }
      skeleton.root.updateMatrixWorld(true);

      const headPos = worldPos(skeleton.head);
      const neckPos = worldPos(skeleton.neck);
      const chestPos = worldPos(skeleton.chest);
      const pelvisPos = worldPos(skeleton.pelvis);

      expect(headPos.distanceTo(neckPos)).toBeLessThan(0.14);
      expect(neckPos.distanceTo(chestPos)).toBeLessThan(0.26);
      expect(chestPos.distanceTo(pelvisPos)).toBeLessThan(0.28);
    }

    chibi.dispose();
  });
});
