import * as THREE from "three";
import type { AvatarLook3D } from "./look3d";
import { MaterialKit, group, mesh } from "./materials";
import { createFaceTexture } from "./faceTexture";
import { ARM_LENGTH, HEAD_CENTER_Y, HEAD_RADIUS, HIP_X, HIP_Y, LEG_LENGTH, NECK_Y, SHOULDER_X, SHOULDER_Y } from "./anatomy";

export type ChibiRig = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftHand: THREE.Object3D;
  rightHand: THREE.Object3D;
  peace: THREE.Object3D;
};

const PANTS = "#1f2937";
const HEAD_SCALE = 1.06;
const STRIPED = new Set(["hoodie", "bomber", "jacket"]);
const SHOE = "#f8fafc";

function buildFaceDecal(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  const texture = createFaceTexture({
    expression: look.expression,
    female: look.female,
    iris: look.iris,
    brow: look.hairColor,
    blush: look.blush,
    hideEyes: look.accessories.sunglasses,
  });
  if (!texture) return null;
  const face = group("face");
  const material = new THREE.MeshBasicMaterial({ map: kit.track(texture), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const geometry = new THREE.SphereGeometry(HEAD_RADIUS * 1.004, 48, 32, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.3, Math.PI * 0.46);
  const decal = mesh(geometry, material, "face-decal", [0, HEAD_CENTER_Y, 0], [1, 0.95, 0.92]);
  decal.userData.noOutline = true;
  face.add(decal);
  return face;
}

function buildFace(look: AvatarLook3D, kit: MaterialKit): THREE.Group {
  const decal = buildFaceDecal(look, kit);
  if (decal) return decal;
  const face = group("face");
  const eyeGeo = new THREE.SphereGeometry(0.072, 20, 16);
  const shineGeo = new THREE.SphereGeometry(0.022, 10, 8);
  for (const side of [-1, 1]) {
    face.add(mesh(eyeGeo, kit.toon("#1c1917"), `eye-${side}`, [0.17 * side, HEAD_CENTER_Y - 0.02, 0.44], [1, 1.35, 0.6]));
    face.add(mesh(shineGeo, kit.glow("#ffffff"), `eye-shine-${side}`, [0.17 * side + 0.025, HEAD_CENTER_Y + 0.03, 0.485]));
    face.add(mesh(new THREE.BoxGeometry(0.13, 0.025, 0.02), kit.toon(look.hairColor), `brow-${side}`, [0.17 * side, HEAD_CENTER_Y + 0.13, 0.455], undefined, [0, 0, -0.12 * side]));
    face.add(mesh(new THREE.CircleGeometry(0.06, 20), kit.glow(look.blush, 0.55), `blush-${side}`, [0.27 * side, HEAD_CENTER_Y - 0.13, 0.415], undefined, [0, 0.45 * side, 0]));
    if (look.female) face.add(mesh(new THREE.BoxGeometry(0.05, 0.018, 0.015), kit.toon("#1c1917"), `lash-${side}`, [0.23 * side, HEAD_CENTER_Y + 0.07, 0.44], undefined, [0, 0, 0.5 * side]));
  }
  face.add(mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 20, Math.PI), kit.toon("#7f1d1d"), "mouth", [0, HEAD_CENTER_Y - 0.17, 0.46], undefined, [0, 0, Math.PI]));
  return face;
}

function buildArm(side: number, look: AvatarLook3D, kit: MaterialKit): { arm: THREE.Group; hand: THREE.Object3D } {
  const arm = group(side < 0 ? "arm-left" : "arm-right", [SHOULDER_X * side, SHOULDER_Y, 0]);
  const sleeveColor = look.outfit.longSleeves ? look.outfit.body : look.skin;
  arm.add(mesh(new THREE.CapsuleGeometry(0.075, ARM_LENGTH - 0.1, 6, 14), kit.toon(sleeveColor), "arm-limb", [0, -ARM_LENGTH / 2, 0]));
  if (!look.outfit.longSleeves) {
    arm.add(mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.14, 16), kit.toon(look.outfit.body), "arm-sleeve", [0, -0.05, 0]));
  } else {
    arm.add(mesh(new THREE.TorusGeometry(0.072, 0.018, 8, 16), kit.toon(look.outfit.trim), "arm-cuff", [0, -ARM_LENGTH + 0.03, 0], undefined, [Math.PI / 2, 0, 0]));
    if (STRIPED.has(look.outfit.kind)) {
      [-0.1, -0.15].forEach((y, i) => arm.add(mesh(new THREE.TorusGeometry(0.079, 0.012, 6, 16), kit.toon(look.outfit.trim), `arm-stripe-${i}`, [0, y, 0], undefined, [Math.PI / 2, 0, 0])));
    }
  }
  const hand = mesh(new THREE.SphereGeometry(0.085, 16, 12), kit.toon(look.skin), "hand", [0, -ARM_LENGTH - 0.02, 0]);
  arm.add(hand);
  arm.rotation.z = 0.12 * side;
  return { arm, hand };
}

function buildPeace(look: AvatarLook3D, kit: MaterialKit): THREE.Group {
  const peace = group("hand-peace", [0, -ARM_LENGTH - 0.08, 0.02]);
  [-1, 1].forEach((side) => peace.add(mesh(new THREE.CapsuleGeometry(0.026, 0.1, 4, 8), kit.toon(look.skin), `finger-${side}`, [0.035 * side, -0.07, 0], undefined, [0, 0, 0.22 * side])));
  peace.visible = false;
  return peace;
}

function buildLeg(side: number, kit: MaterialKit): THREE.Group {
  const leg = group(side < 0 ? "leg-left" : "leg-right", [HIP_X * side, HIP_Y, 0]);
  leg.add(mesh(new THREE.CapsuleGeometry(0.1, LEG_LENGTH - 0.12, 6, 14), kit.toon(PANTS), "leg-limb", [0, -LEG_LENGTH / 2, 0]));
  leg.add(mesh(new THREE.BoxGeometry(0.06, 0.12, 0.1), kit.toon("#111827"), "leg-pocket", [0.1 * side, -LEG_LENGTH / 2 + 0.02, 0]));
  leg.add(mesh(new THREE.SphereGeometry(0.135, 18, 12), kit.toon("#475569"), "shoe", [0, -LEG_LENGTH - 0.1, 0.05], [1, 0.7, 1.45]));
  leg.add(mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.06, 20), kit.toon(SHOE), "shoe-sole", [0, -LEG_LENGTH - 0.17, 0.05], [1, 1, 1.45]));
  leg.add(mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), kit.toon("#10b981"), "shoe-laces", [0, -LEG_LENGTH - 0.03, 0.1]));
  return leg;
}

export function buildBody(look: AvatarLook3D, kit: MaterialKit): ChibiRig {
  const root = group("chibi");
  const body = group("body");
  root.add(body);

  body.add(mesh(new THREE.CapsuleGeometry(0.25, 0.3, 8, 20), kit.toon(look.outfit.kind === "vest" ? look.outfit.inner || look.outfit.body : look.outfit.body), "torso", [0, 0.93, 0], [1, 1, 0.78]));
  body.add(mesh(new THREE.CylinderGeometry(0.255, 0.24, 0.14, 20), kit.toon(PANTS), "waist", [0, 0.68, 0], [1, 1, 0.8]));
  body.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 14), kit.toon(look.skin), "neck", [0, NECK_Y - 0.04, 0]));

  const head = group("head", [0, NECK_Y, 0]);
  head.add(mesh(new THREE.SphereGeometry(HEAD_RADIUS, 40, 32), kit.toon(look.skin), "head-skin", [0, HEAD_CENTER_Y, 0], [1, 0.95, 0.92]));
  for (const side of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.09, 14, 10), kit.toon(look.skin), `ear-${side}`, [0.48 * side, HEAD_CENTER_Y - 0.04, 0], [0.6, 1, 0.8]));
  }
  head.add(buildFace(look, kit));
  head.scale.setScalar(HEAD_SCALE);
  body.add(head);

  const left = buildArm(-1, look, kit);
  const right = buildArm(1, look, kit);
  const peace = buildPeace(look, kit);
  right.arm.add(peace);
  body.add(left.arm, right.arm);

  const leftLeg = buildLeg(-1, kit);
  const rightLeg = buildLeg(1, kit);
  root.add(leftLeg, rightLeg);

  return { root, body, head, leftArm: left.arm, rightArm: right.arm, leftLeg, rightLeg, leftHand: left.hand, rightHand: right.hand, peace };
}