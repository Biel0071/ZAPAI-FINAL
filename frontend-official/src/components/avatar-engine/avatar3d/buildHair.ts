import * as THREE from "three";
import type { AvatarLook3D, HairStyle3D } from "./look3d";
import { MaterialKit, group, mesh } from "./materials";
import { HEAD_CENTER_Y as C } from "./anatomy";
import { taperedStrand } from "./strand";

const TAU = Math.PI * 2;

function shell(kit: MaterialKit, color: string, tilt = -0.35, radius = 0.535, cover = 0.5): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 40, 24, 0, TAU, 0, Math.PI * cover);
  return mesh(geo, kit.toonDouble(color), "hair-shell", [0, C, 0], [1, 0.97, 0.95], [tilt, 0, 0]);
}

function nape(kit: MaterialKit, color: string): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.53, 32, 12, Math.PI, Math.PI, Math.PI * 0.42, Math.PI * 0.3);
  return mesh(geo, kit.toonDouble(color), "hair-nape", [0, C, -0.01], [1.01, 0.97, 0.96]);
}

function sideLocks(kit: MaterialKit, color: string): THREE.Mesh[] {
  return [-1, 1].map((side) => mesh(
    taperedStrand([[0.36 * side, C + 0.32, 0.3], [0.47 * side, C + 0.02, 0.3], [0.45 * side, C - 0.3, 0.2], [0.4 * side, C - 0.52, 0.12]], 0.085, 0.25),
    kit.toon(color), `hair-lock-${side}`,
  ));
}

function bangs(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  const tips: Array<[number, number, number]> = [[-0.4, -0.12, 0.34], [-0.26, 0.1, 0.45], [-0.1, 0.2, 0.49], [0.14, 0.19, 0.49], [0.32, 0.04, 0.42]];
  return tips.map(([x, y, z], i) => mesh(
    taperedStrand([[x * 0.3, C + 0.46, 0.3], [x * 0.8, C + 0.4, 0.44], [x, C + y, z]], 0.06, 0.2, 16),
    kit.toon(i % 2 ? look.hairHighlight : look.hairColor), `hair-bang-${i}`,
  ));
}

function sideVolume(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  const strands: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    [0, 1, 2].forEach((k) => {
      const x = (0.4 + k * 0.06) * side;
      const z = 0.18 - k * 0.2;
      strands.push(mesh(
        taperedStrand([[x * 0.8, C + 0.42, z], [x * 1.12, C + 0.05, z], [x * 1.05, C - 0.35, z + 0.04], [x * 1.18, C - 0.7, z - 0.02], [x * 1.05, C - 0.98, z]], 0.1 - k * 0.012, 0.2, 28),
        kit.toon(k === 1 ? look.hairHighlight : look.hairColor), `hair-volume-${side}-${k}`,
      ));
    });
  }
  return strands;
}

function flowingTail(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  return [
    { dx: 0, r: 0.15, color: look.hairColor },
    { dx: -0.11, r: 0.1, color: look.hairHighlight },
    { dx: 0.12, r: 0.1, color: look.hairColor },
  ].map(({ dx, r, color }, i) => mesh(
    taperedStrand([[0, C + 0.42, -0.32], [dx * 0.5, C + 0.58, -0.62], [dx, C + 0.12, -0.8], [dx - 0.04, C - 0.45, -0.66], [dx + 0.06, C - 0.95, -0.5]], r, 0.12, 32),
    kit.toon(color), `hair-ponytail-${i}`,
  ));
}

function backCurtain(kit: MaterialKit, color: string, height: number, flare = 0.06): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.54, 0.54 + flare, height, 36, 1, true, Math.PI * 0.32, Math.PI * 1.36);
  return mesh(geo, kit.toonDouble(color), "hair-curtain", [0, C - height / 2 + 0.12, -0.02], [1, 1, 0.92]);
}

function fringe(kit: MaterialKit, color: string): THREE.Mesh {
  return mesh(new THREE.CapsuleGeometry(0.075, 0.5, 6, 16), kit.toon(color), "hair-fringe", [0, C + 0.24, 0.4], [1, 1, 0.55], [0, 0, Math.PI / 2]);
}

function ring<T>(count: number, fn: (angle: number, index: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => fn((index / count) * TAU, index));
}

const STYLES: Record<HairStyle3D, (kit: MaterialKit, look: AvatarLook3D) => THREE.Object3D[]> = {
  short: (kit, look) => [shell(kit, look.hairColor, -0.5, 0.52, 0.42), nape(kit, look.hairColor)],
  ponytail: (kit, look) => [
    shell(kit, look.hairColor),
    nape(kit, look.hairColor),
    ...sideLocks(kit, look.hairColor),
    ...bangs(kit, look),
    ...sideVolume(kit, look),
    mesh(new THREE.TorusGeometry(0.09, 0.035, 8, 16), kit.toon("#111827"), "hair-tie", [0, C + 0.42, -0.32], undefined, [0.9, 0, 0]),
    ...flowingTail(kit, look),
  ],
  bob: (kit, look) => [shell(kit, look.hairColor), backCurtain(kit, look.hairColor, 0.5), ...bangs(kit, look)],
  long: (kit, look) => [shell(kit, look.hairColor), backCurtain(kit, look.hairColor, 1.0, 0.1), ...sideLocks(kit, look.hairColor), ...bangs(kit, look)],
  long_bangs: (kit, look) => [shell(kit, look.hairColor), backCurtain(kit, look.hairColor, 1.0, 0.1), ...sideLocks(kit, look.hairColor), fringe(kit, look.hairColor)],
  bun: (kit, look) => [
    shell(kit, look.hairColor),
    nape(kit, look.hairColor),
    ...sideLocks(kit, look.hairColor),
    mesh(new THREE.SphereGeometry(0.2, 20, 16), kit.toon(look.hairColor), "hair-bun", [0, C + 0.46, -0.22]),
  ],
  afro: (kit, look) => [
    mesh(new THREE.SphereGeometry(0.68, 32, 20, 0, TAU, 0, Math.PI * 0.6), kit.toonDouble(look.hairColor), "hair-shell", [0, C + 0.02, -0.06], [1, 0.95, 0.95], [-0.55, 0, 0]),
    ...ring(10, (angle, i) => mesh(new THREE.SphereGeometry(0.17, 12, 10), kit.toon(look.hairColor), `hair-puff-${i}`, [Math.sin(angle) * 0.58, C + 0.3 + Math.cos(angle) * 0.12, -0.12 + Math.cos(angle) * 0.2])),
  ],
  spiky: (kit, look) => [
    shell(kit, look.hairColor, -0.3),
    nape(kit, look.hairColor),
    ...ring(7, (angle, i) => {
      const x = Math.sin(angle) * 0.28;
      const z = Math.cos(angle) * 0.28 - 0.05;
      return mesh(new THREE.ConeGeometry(0.11, 0.32, 10), kit.toon(i % 2 ? look.hairHighlight : look.hairColor), `hair-spike-${i}`, [x, C + 0.5, z], undefined, [-z * 1.4, 0, x * 1.4]);
    }),
  ],
  curly: (kit, look) => [
    shell(kit, look.hairColor),
    nape(kit, look.hairColor),
    ...ring(14, (angle, i) => mesh(new THREE.SphereGeometry(0.11, 12, 10), kit.toon(look.hairColor), `hair-curl-${i}`, [Math.sin(angle) * 0.5, C + 0.18 + (i % 2) * 0.12, Math.cos(angle) * 0.42 - 0.12])),
  ],
  slick_back: (kit, look) => [
    shell(kit, look.hairColor, -0.5, 0.53, 0.5),
    nape(kit, look.hairColor),
    mesh(new THREE.SphereGeometry(0.3, 20, 14), kit.toon(look.hairColor), "hair-back", [0, C + 0.02, -0.35], [1.4, 0.9, 0.7]),
  ],
  medium_side: (kit, look) => [
    shell(kit, look.hairColor),
    mesh(new THREE.SphereGeometry(0.24, 20, 14), kit.toon(look.hairColor), "hair-sweep", [0.18, C + 0.3, 0.3], [1.3, 0.5, 0.7], [0, 0, -0.3]),
    backCurtain(kit, look.hairColor, 0.38),
  ],
};

function buildBeard(kit: MaterialKit, color: string): THREE.Group {
  const beard = group("beard");
  beard.add(mesh(new THREE.TorusGeometry(0.3, 0.075, 10, 28, Math.PI), kit.toon(color), "beard-jaw", [0, C - 0.06, 0.34], [1, 1, 0.8], [0.35, 0, Math.PI]));
  beard.add(mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 10), kit.toon(color), "beard-mustache", [0, C - 0.12, 0.46], undefined, [0, 0, Math.PI / 2]));
  return beard;
}

function buildHeadwear(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  if (look.headwear === "cap") {
    const cap = group("headwear-cap");
    cap.add(mesh(new THREE.SphereGeometry(0.56, 32, 16, 0, TAU, 0, Math.PI * 0.46), kit.toonDouble(look.brand), "cap-crown", [0, C + 0.02, 0], [1, 0.95, 0.95], [-0.18, 0, 0]));
    cap.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 24, 1, false, -Math.PI / 2, Math.PI), kit.toon("#0f172a"), "cap-brim", [0, C + 0.18, 0.42], [1, 1, 1.1], [0.15, 0, 0]));
    return cap;
  }
  if (look.headwear === "hardhat") {
    const hat = group("headwear-hardhat");
    hat.add(mesh(new THREE.SphereGeometry(0.56, 32, 16, 0, TAU, 0, Math.PI * 0.5), kit.toonDouble("#f8fafc"), "hardhat-shell", [0, C + 0.2, -0.02], [1, 0.85, 1]));
    hat.add(mesh(new THREE.TorusGeometry(0.57, 0.04, 10, 36), kit.toon("#e2e8f0"), "hardhat-rim", [0, C + 0.2, -0.02], [1, 1.06, 1], [Math.PI / 2 - 0.12, 0, 0]));
    hat.add(mesh(new THREE.BoxGeometry(0.09, 0.05, 0.8), kit.toon(look.brand), "hardhat-ridge", [0, C + 0.68, -0.02]));
    return hat;
  }
  return null;
}

const HIDDEN_UNDER_HAT = /hair-(spike|bun|puff|curl|tie)/;

export function buildHair(look: AvatarLook3D, kit: MaterialKit): THREE.Group {
  const hair = group(`hair-style-${look.hairStyle}`);
  const parts = STYLES[look.hairStyle](kit, look).filter((part) => look.headwear === "none" || !HIDDEN_UNDER_HAT.test(part.name));
  hair.add(...parts);
  if (look.beard) hair.add(buildBeard(kit, look.hairColor));
  const headwear = buildHeadwear(look, kit);
  if (headwear) hair.add(headwear);
  return hair;
}