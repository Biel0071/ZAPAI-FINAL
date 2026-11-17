import * as THREE from "three";
import type { AvatarLook3D } from "./look3d";
import type { ChibiRig } from "./buildBody";
import { MaterialKit, group, mesh } from "./materials";
import { ARM_LENGTH, HEAD_CENTER_Y as C } from "./anatomy";

export type HoldPose = { left: boolean; right: boolean; both: boolean };

const DARK = "#111827";
const CARDBOARD = "#c08a4d";

function headset(kit: MaterialKit, brand: string): THREE.Group {
  const set = group("acc-headset");
  set.add(mesh(new THREE.TorusGeometry(0.56, 0.03, 8, 32, Math.PI), kit.toon(DARK), "headset-band", [0, C, 0]));
  for (const side of [-1, 1]) {
    set.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 20), kit.toon(DARK), `headset-cup-${side}`, [0.54 * side, C - 0.02, 0], undefined, [0, 0, Math.PI / 2]));
    set.add(mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 20), kit.glow(brand), `headset-ring-${side}`, [0.585 * side, C - 0.02, 0], undefined, [0, Math.PI / 2, 0]));
  }
  set.add(mesh(new THREE.CapsuleGeometry(0.015, 0.3, 4, 8), kit.toon(DARK), "headset-mic", [-0.4, C - 0.2, 0.3], undefined, [0.4, -0.9, 1.1]));
  return set;
}

function glasses(kit: MaterialKit, sunglasses: boolean): THREE.Group {
  const set = group(sunglasses ? "acc-sunglasses" : "acc-glasses");
  for (const side of [-1, 1]) {
    set.add(sunglasses
      ? mesh(new THREE.BoxGeometry(0.17, 0.1, 0.02), kit.toon(DARK), `lens-${side}`, [0.165 * side, C - 0.01, 0.49])
      : mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 24), kit.toon(DARK), `lens-${side}`, [0.17 * side, C - 0.01, 0.49]));
  }
  set.add(mesh(new THREE.BoxGeometry(0.1, 0.018, 0.018), kit.toon(DARK), "bridge", [0, C, 0.5]));
  return set;
}

function badge(kit: MaterialKit, brand: string): THREE.Group {
  const set = group("acc-badge");
  for (const side of [-1, 1]) set.add(mesh(new THREE.BoxGeometry(0.018, 0.3, 0.012), kit.toon(brand), `lanyard-${side}`, [0.07 * side, 1.12, 0.2], undefined, [0, 0, -0.2 * side]));
  set.add(mesh(new THREE.BoxGeometry(0.12, 0.16, 0.015), kit.toon("#f8fafc"), "badge-card", [0, 0.94, 0.215]));
  set.add(mesh(new THREE.BoxGeometry(0.12, 0.035, 0.017), kit.toon(brand), "badge-stripe", [0, 1.0, 0.216]));
  return set;
}

export function buildAccessories(look: AvatarLook3D, kit: MaterialKit, rig: ChibiRig): HoldPose {
  const acc = look.accessories;
  if (acc.headset) rig.head.add(headset(kit, look.brand));
  if (acc.glasses || acc.sunglasses) rig.head.add(glasses(kit, acc.sunglasses));
  if (acc.badge) rig.body.add(badge(kit, look.brand));
  if (acc.backpack) {
    const pack = group("acc-backpack");
    pack.add(mesh(new THREE.CapsuleGeometry(0.2, 0.22, 6, 14), kit.toon(DARK), "backpack-body", [0, 0.98, -0.3], [1, 1, 0.55]));
    pack.add(mesh(new THREE.BoxGeometry(0.28, 0.03, 0.04), kit.toon(look.brand), "backpack-stripe", [0, 1.02, -0.4]));
    rig.body.add(pack);
  }
  if (acc.watch) rig.leftArm.add(mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 18), kit.toon(DARK), "acc-watch", [0, -ARM_LENGTH + 0.05, 0], undefined, [Math.PI / 2, 0, 0]));
  if (acc.boxes) {
    const boxes = group("acc-boxes", [0, 0.92, 0.38]);
    boxes.add(mesh(new THREE.BoxGeometry(0.5, 0.26, 0.3), kit.toon(CARDBOARD), "box-bottom", [0, 0, 0]));
    boxes.add(mesh(new THREE.BoxGeometry(0.4, 0.2, 0.26), kit.toon(CARDBOARD), "box-top", [0, 0.23, 0]));
    boxes.add(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.31), kit.toon(look.brand), "box-tape", [0, 0.02, 0]));
    rig.body.add(boxes);
    return { left: false, right: false, both: true };
  }
  const hold: HoldPose = { left: false, right: false, both: false };
  if (acc.tablet) {
    rig.leftHand.add(mesh(new THREE.BoxGeometry(0.3, 0.4, 0.03), kit.toon(DARK), "acc-tablet", [0.05, -0.05, 0.12], undefined, [-1.1, 0, 0.2]));
    rig.leftHand.add(mesh(new THREE.BoxGeometry(0.26, 0.34, 0.005), kit.glow(look.brand, 0.85), "acc-tablet-screen", [0.05, -0.04, 0.135], undefined, [-1.1, 0, 0.2]));
    hold.left = true;
  }
  if (acc.laptop) {
    rig.leftArm.add(mesh(new THREE.BoxGeometry(0.04, 0.32, 0.42), kit.toon("#94a3b8"), "acc-laptop", [-0.09, -0.2, 0]));
  }
  if (acc.coffee) {
    rig.rightHand.add(mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.18, 16), kit.toon("#f8fafc"), "acc-coffee", [0, 0.02, 0.09]));
    rig.rightHand.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), kit.toon(look.brand), "acc-coffee-lid", [0, 0.12, 0.09]));
    hold.right = true;
  }
  return hold;
}