import * as THREE from "three";
import type { AvatarLook3D } from "./look3d";
import type { ChibiRig } from "./buildBody";
import { MaterialKit, group, mesh } from "./materials";
import {
  evalSculptedHeadLocal,
  FOREARM_LENGTH,
  getHumanoidDimensions,
  HEAD_CENTER_Y as C,
  HEAD_RADIUS as R,
} from "./anatomy";
import { clearMountGroup, getAccessorySubSlotMounts, type SlotMounts } from "./humanoidRig";
import { getHairClearanceProfile } from "./buildHair";
import type { AccessorySubSlot } from "./slotCatalog";

export type HoldPose = { left: boolean; right: boolean; both: boolean };

const DARK = "#111827";
const CARDBOARD = "#c08a4d";

function buildHeadsetMesh(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  const { accessories, brand, hairStyle, female } = look;
  if (!accessories.headset && !accessories.earbud) return null;

  const earRef = evalSculptedHeadLocal(0.97, -0.2, -0.14, female);
  const crownRef = evalSculptedHeadLocal(0, 0.98, 0, female);
  const clearance = getHairClearanceProfile(hairStyle);

  if (accessories.earbud) {
    const bud = group("acc-earbud");
    bud.add(
      mesh(new THREE.SphereGeometry(0.014, 10, 10), kit.metal("#0f172a"), "earbud-body", [-earRef.x - 0.01, earRef.y, earRef.z + 0.01]),
      mesh(new THREE.SphereGeometry(0.0055, 8, 8), kit.led(brand, 1, 1.1), "earbud-led", [-earRef.x - 0.018, earRef.y, earRef.z + 0.016]),
      mesh(new THREE.CapsuleGeometry(0.0038, 0.02, 4, 6), kit.metal("#1e293b"), "earbud-stem", [-earRef.x - 0.01, earRef.y - 0.018, earRef.z + 0.018], undefined, [0.3, 0, 0]),
    );
    return bud;
  }

  const set = group("acc-headset");
  const bandRadiusX = earRef.x + 0.018 + clearance.sidePad;
  const bandTopY = crownRef.y + clearance.crownLift + 0.016;
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-bandRadiusX, earRef.y + 0.02, earRef.z),
    new THREE.Vector3(-bandRadiusX * 0.85, bandTopY * 0.88, earRef.z * 0.5),
    new THREE.Vector3(0, bandTopY, -0.005),
    new THREE.Vector3(bandRadiusX * 0.85, bandTopY * 0.88, earRef.z * 0.5),
    new THREE.Vector3(bandRadiusX, earRef.y + 0.02, earRef.z),
  ]);
  set.add(mesh(new THREE.TubeGeometry(archCurve, 28, 0.013, 10, false), kit.fabric(DARK, false, 0.45), "headset-band"));

  for (const side of [-1, 1]) {
    const cupX = bandRadiusX * side;
    set.add(
      mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.03, 20),
        kit.fabric(DARK, false, 0.45),
        `headset-cup-${side}`,
        [cupX, earRef.y, earRef.z],
        undefined,
        [0, 0, Math.PI / 2],
      ),
      mesh(
        new THREE.TorusGeometry(0.032, 0.006, 8, 20),
        kit.led(brand, 1, 0.95),
        `headset-ring-${side}`,
        [cupX + 0.018 * side, earRef.y, earRef.z],
        undefined,
        [0, Math.PI / 2, 0],
      ),
    );
  }

  // Boom mic arcing cleanly near left cheek beside corner of mouth (never crossing over lips)
  const micAnchor = evalSculptedHeadLocal(-0.24, -0.46, Math.sqrt(1 - 0.24 * 0.24 - 0.46 * 0.46), female);
  const micTipPos: [number, number, number] = [micAnchor.x - 0.016, micAnchor.y - 0.008, micAnchor.z + 0.022];
  const micCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-bandRadiusX, earRef.y - 0.02, earRef.z + 0.012),
    new THREE.Vector3(-bandRadiusX * 0.8, earRef.y - 0.068, R * 0.64),
    new THREE.Vector3(micTipPos[0], micTipPos[1], micTipPos[2]),
  ]);
  set.add(
    mesh(new THREE.TubeGeometry(micCurve, 14, 0.0045, 8, false), kit.metal("#334155"), "headset-mic"),
    mesh(new THREE.SphereGeometry(0.0082, 8, 8), kit.led(brand, 1, 0.8), "headset-mic-tip", micTipPos),
  );
  return set;
}

function buildEyewearMesh(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  const { accessories, female } = look;
  if (!accessories.glasses && !accessories.sunglasses) return null;

  const sunglasses = accessories.sunglasses;
  const set = group(sunglasses ? "acc-sunglasses" : "acc-glasses");

  // Sample exact sculpted surface at chibi eye & ear positions so lenses frame symmetrical irises cleanly
  const eyeZ = Math.sqrt(1 - 0.27 * 0.27 - 0.21 * 0.21);
  const lensAnchorL = evalSculptedHeadLocal(-0.27, -0.21, eyeZ, female);
  const lensAnchorR = evalSculptedHeadLocal(0.27, -0.21, eyeZ, female);
  const bridgeAnchor = evalSculptedHeadLocal(0, -0.17, Math.sqrt(1 - 0.17 * 0.17), female);
  const earAnchor = evalSculptedHeadLocal(0.96, -0.2, -0.12, female);

  const frameMat = kit.metal(sunglasses ? "#09090b" : "#334155", 0.28, 0.72);
  const lensMat = sunglasses ? kit.glass("#020617", 0.86) : kit.glass("#e0f2fe", 0.22);

  for (const [side, anchor] of [[-1, lensAnchorL], [1, lensAnchorR]] as const) {
    const lx = anchor.x;
    const ly = anchor.y;
    const lz = anchor.z + 0.017;
    if (sunglasses) {
      set.add(
        mesh(new THREE.BoxGeometry(0.076, 0.048, 0.009), frameMat, `frame-${side}`, [lx, ly, lz], undefined, [0, -0.18 * side, 0]),
        mesh(new THREE.BoxGeometry(0.066, 0.04, 0.011), lensMat, `lens-${side}`, [lx, ly, lz + 0.001], undefined, [0, -0.18 * side, 0]),
      );
    } else {
      set.add(
        mesh(new THREE.TorusGeometry(0.038, 0.0038, 8, 24), frameMat, `frame-${side}`, [lx, ly, lz], [1.16, 0.96, 1], [0, -0.18 * side, 0]),
        mesh(new THREE.CircleGeometry(0.036, 20), lensMat, `lens-${side}`, [lx, ly, lz + 0.001], [1.14, 0.94, 1], [0, -0.18 * side, 0]),
      );
    }

    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(lx + 0.038 * side, ly + 0.004, lz),
      new THREE.Vector3(earAnchor.x * side + 0.008 * side, ly + 0.004, 0.05),
      new THREE.Vector3(earAnchor.x * side + 0.006 * side, earAnchor.y + 0.004, earAnchor.z),
    ]);
    set.add(mesh(new THREE.TubeGeometry(templeCurve, 10, 0.0032, 6, false), frameMat, `temple-${side}`));
  }

  set.add(mesh(new THREE.BoxGeometry(0.028, 0.0055, 0.007), frameMat, "bridge", [0, bridgeAnchor.y + 0.002, bridgeAnchor.z + 0.016]));
  return set;
}

function buildHeadwearMesh(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  if (look.headwear === "cap") {
    const cap = group("headwear-cap");
    const crownGeo = new THREE.SphereGeometry(R * 1.13, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.48);
    cap.add(
      mesh(crownGeo, kit.fabric(look.brand, true, 0.72), "cap-crown", [0, C + 0.015, -0.005], [1.08, 0.99, 1.01], [-0.14, 0, 0]),
      mesh(new THREE.CylinderGeometry(0.155, 0.16, 0.013, 22, 1, false, -Math.PI / 2, Math.PI), kit.fabric("#0f172a", false, 0.68), "cap-brim", [0, C + 0.088, R * 0.85], [1, 1, 1.12], [0.16, 0, 0]),
      mesh(new THREE.SphereGeometry(0.015, 10, 8), kit.fabric("#0f172a"), "cap-button", [0, C + R * 1.09, -0.022]),
    );
    return cap;
  }
  if (look.headwear === "hardhat") {
    const hat = group("headwear-hardhat");
    hat.add(
      mesh(new THREE.SphereGeometry(R * 1.15, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), kit.fabric("#f8fafc", true, 0.34), "hardhat-shell", [0, C + 0.056, -0.008], [1.07, 0.92, 1.02]),
      mesh(new THREE.TorusGeometry(R * 1.15, 0.016, 8, 30), kit.fabric("#e2e8f0", false, 0.36), "hardhat-rim", [0, C + 0.056, -0.008], [1.05, 1.04, 1], [Math.PI / 2 - 0.1, 0, 0]),
      mesh(new THREE.CapsuleGeometry(0.016, 0.22, 6, 10), kit.fabric(look.brand, false, 0.4), "hardhat-ridge", [0, C + R * 1.16, -0.008], undefined, [Math.PI / 2, 0, 0]),
    );
    return hat;
  }
  return null;
}

function buildBadgeMesh(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  const { accessories, brand, female } = look;
  const dims = getHumanoidDimensions(female);
  const chestZ = dims.chestRadiusZ;

  if (accessories.badgeClip) {
    const clip = group("acc-badge-clip");
    clip.add(
      mesh(new THREE.BoxGeometry(0.054, 0.03, 0.008), kit.metal("#e2e8f0"), "badge-clip-plate", [0.068, 0.118, chestZ * 1.05], undefined, [0, 0.32, 0]),
      mesh(new THREE.BoxGeometry(0.054, 0.008, 0.009), kit.led(brand, 1, 0.4), "badge-clip-bar", [0.068, 0.13, chestZ * 1.052], undefined, [0, 0.32, 0]),
    );
    return clip;
  }

  if (!accessories.badge) return null;
  const set = group("acc-badge");
  for (const side of [-1, 1]) {
    set.add(
      mesh(
        new THREE.BoxGeometry(0.01, 0.145, 0.006),
        kit.fabric(brand, false, 0.55),
        `lanyard-${side}`,
        [0.036 * side, 0.155, chestZ * 0.96],
        undefined,
        [0.14, 0, -0.22 * side],
      ),
    );
  }
  set.add(
    mesh(new THREE.BoxGeometry(0.054, 0.074, 0.008), kit.fabric("#f8fafc", false, 0.36), "badge-card", [0, 0.052, chestZ * 1.06]),
    mesh(new THREE.BoxGeometry(0.054, 0.016, 0.009), kit.fabric(brand, false, 0.45), "badge-stripe", [0, 0.08, chestZ * 1.062]),
  );
  return set;
}

function buildBackpackMesh(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  if (!look.accessories.backpack) return null;
  const dims = getHumanoidDimensions(look.female);
  const pack = group("acc-backpack");
  const zBack = -(dims.chestRadiusZ + 0.052);
  pack.add(
    mesh(new THREE.CapsuleGeometry(0.105, 0.115, 6, 14), kit.fabric(DARK, false, 0.78), "backpack-body", [0, 0.068, zBack], [1.05, 1, 0.6]),
    mesh(new THREE.BoxGeometry(0.15, 0.016, 0.018), kit.led(look.brand, 1, 0.45), "backpack-stripe", [0, 0.095, zBack - 0.06]),
  );
  for (const side of [-1, 1]) {
    pack.add(
      mesh(new THREE.BoxGeometry(0.02, 0.21, 0.012), kit.fabric("#1e293b"), `backpack-strap-${side}`, [0.09 * side, 0.095, 0.01]),
    );
  }
  return pack;
}

function buildWristMesh(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  if (!look.accessories.watch) return null;
  const dims = getHumanoidDimensions(look.female);
  const watch = group("acc-watch", [0, -FOREARM_LENGTH + 0.028, 0]);
  watch.add(
    mesh(new THREE.TorusGeometry(dims.forearmRadius * 1.08, 0.0095, 8, 16), kit.metal(DARK, 0.3, 0.7), "watch-band", [0, 0, 0], undefined, [Math.PI / 2, 0, 0]),
    mesh(new THREE.BoxGeometry(0.022, 0.02, 0.012), kit.metal("#1e293b"), "watch-case", [0, 0, dims.forearmRadius * 1.06]),
    mesh(new THREE.BoxGeometry(0.017, 0.015, 0.004), kit.led(look.brand, 1, 0.9), "watch-screen", [0, 0, dims.forearmRadius * 1.12]),
  );
  return watch;
}

export function computeHoldPose(look: AvatarLook3D): HoldPose {
  const acc = look.accessories;
  if (acc.boxes) return { left: false, right: false, both: true };
  return {
    left: Boolean(acc.tablet || acc.clipboard || acc.laptop),
    right: Boolean(acc.coffee || acc.smartphone),
    both: false,
  };
}

function populatePropSubSlot(look: AvatarLook3D, kit: MaterialKit, mounts: SlotMounts): HoldPose {
  const acc = look.accessories;
  const dims = getHumanoidDimensions(look.female);

  if (acc.boxes) {
    const boxes = group("acc-boxes", [0, -0.02, dims.chestRadiusZ + 0.15]);
    boxes.add(
      mesh(new THREE.BoxGeometry(0.25, 0.135, 0.165), kit.fabric(CARDBOARD, false, 0.88), "box-bottom"),
      mesh(new THREE.BoxGeometry(0.195, 0.095, 0.135), kit.fabric(CARDBOARD, false, 0.88), "box-top", [0, 0.115, 0]),
      mesh(new THREE.BoxGeometry(0.252, 0.016, 0.168), kit.fabric(look.brand, false, 0.5), "box-tape", [0, 0.01, 0]),
    );
    mounts.accessories.propBoth.add(boxes);
    return { left: false, right: false, both: true };
  }

  const hold: HoldPose = { left: false, right: false, both: false };

  if (acc.tablet) {
    const tablet = group("acc-tablet-group", [0.02, -0.026, 0.072]);
    tablet.rotation.set(-0.95, 0, 0.18);
    tablet.add(
      mesh(new THREE.BoxGeometry(0.145, 0.19, 0.012), kit.metal(DARK, 0.35, 0.65), "acc-tablet"),
      mesh(new THREE.BoxGeometry(0.128, 0.165, 0.004), kit.led(look.brand, 0.9, 0.85), "acc-tablet-screen", [0, 0, 0.007]),
    );
    mounts.accessories.propLeft.add(tablet);
    hold.left = true;
  } else if (acc.clipboard) {
    const board = group("acc-clipboard-group", [0.02, -0.026, 0.07]);
    board.rotation.set(-0.88, 0, 0.14);
    board.add(
      mesh(new THREE.BoxGeometry(0.14, 0.195, 0.012), kit.fabric("#78350f", false, 0.7), "acc-clipboard"),
      mesh(new THREE.BoxGeometry(0.115, 0.16, 0.004), kit.fabric("#f8fafc", false, 0.8), "acc-clipboard-paper", [0, -0.008, 0.007]),
      mesh(new THREE.BoxGeometry(0.046, 0.016, 0.011), kit.metal("#cbd5e1"), "acc-clipboard-clip", [0, 0.082, 0.009]),
    );
    mounts.accessories.propLeft.add(board);
    hold.left = true;
  } else if (acc.laptop) {
    const laptop = group("acc-laptop-group", [-0.042, -FOREARM_LENGTH * 0.5, 0.028]);
    laptop.add(
      mesh(new THREE.BoxGeometry(0.022, 0.165, 0.22), kit.metal("#94a3b8", 0.28, 0.8), "acc-laptop"),
      mesh(new THREE.BoxGeometry(0.006, 0.032, 0.032), kit.led(look.brand, 1, 0.75), "acc-laptop-logo", [-0.013, 0, 0]),
    );
    mounts.accessories.propLaptop.add(laptop);
    hold.left = true;
  }

  if (acc.coffee) {
    const coffee = group("acc-coffee-group", [0, -0.018, 0.042]);
    coffee.add(
      mesh(new THREE.CylinderGeometry(0.033, 0.026, 0.09, 16), kit.fabric("#f8fafc", false, 0.35), "acc-coffee"),
      mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.016, 16), kit.fabric(look.brand, false, 0.45), "acc-coffee-lid", [0, 0.05, 0]),
      mesh(new THREE.CylinderGeometry(0.031, 0.028, 0.032, 16), kit.fabric(look.brand, false, 0.75), "acc-coffee-sleeve", [0, 0.004, 0]),
    );
    mounts.accessories.propRight.add(coffee);
    hold.right = true;
  } else if (acc.smartphone) {
    const phone = group("acc-smartphone-group", [0, -0.018, 0.042]);
    phone.rotation.set(-0.75, 0, -0.1);
    phone.add(
      mesh(new THREE.BoxGeometry(0.054, 0.1, 0.008), kit.metal("#0f172a"), "acc-smartphone"),
      mesh(new THREE.BoxGeometry(0.046, 0.088, 0.003), kit.led("#22c55e", 0.92, 0.8), "acc-smartphone-screen", [0, 0, 0.0045]),
    );
    mounts.accessories.propRight.add(phone);
    hold.right = true;
  }

  return hold;
}

export function buildAccessorySubSlot(
  subSlot: AccessorySubSlot,
  look: AvatarLook3D,
  kit: MaterialKit,
  mounts: SlotMounts,
): void {
  const targets = getAccessorySubSlotMounts(mounts, subSlot);
  targets.forEach(clearMountGroup);

  switch (subSlot) {
    case "eyewear": {
      const built = buildEyewearMesh(look, kit);
      if (built) mounts.accessories.eyewear.add(built);
      break;
    }
    case "headwear": {
      const built = buildHeadwearMesh(look, kit);
      if (built) mounts.accessories.headwear.add(built);
      break;
    }
    case "headset": {
      const built = buildHeadsetMesh(look, kit);
      if (built) mounts.accessories.headset.add(built);
      break;
    }
    case "badge": {
      const built = buildBadgeMesh(look, kit);
      if (built) mounts.accessories.badge.add(built);
      break;
    }
    case "wrist": {
      const built = buildWristMesh(look, kit);
      if (built) mounts.accessories.wrist.add(built);
      break;
    }
    case "back": {
      const built = buildBackpackMesh(look, kit);
      if (built) mounts.accessories.back.add(built);
      break;
    }
    case "prop": {
      populatePropSubSlot(look, kit, mounts);
      break;
    }
  }
}

export function buildAccessories(
  look: AvatarLook3D,
  kit: MaterialKit,
  rig: ChibiRig,
): HoldPose {
  const mounts = rig.mounts;
  const subSlots: AccessorySubSlot[] = ["eyewear", "headwear", "headset", "badge", "wrist", "back", "prop"];
  subSlots.forEach((s) => buildAccessorySubSlot(s, look, kit, mounts));
  return computeHoldPose(look);
}
