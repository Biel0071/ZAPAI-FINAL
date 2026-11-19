import * as THREE from "three";
import type { AvatarLook3D, HairStyle3D } from "./look3d";
import { MaterialKit, group, mesh } from "./materials";
import { HEAD_CENTER_Y as C, HEAD_RADIUS as R } from "./anatomy";
import { ribbonLock } from "./strand";
import { clearMountGroup } from "./humanoidRig";

const TAU = Math.PI * 2;
const S = R / 0.5; // Proportional factor anchored to calibrated HEAD_RADIUS

type Pt = [number, number, number];
const pt = (x: number, dy: number, z: number): Pt => [x * S, C + dy * S, z * S];

function blendHair(base: string, hi: string, amount = 0.34): string {
  return `#${new THREE.Color(base).lerp(new THREE.Color(hi), amount).getHexString()}`;
}

export interface HairClearanceProfile {
  crownLift: number;
  sidePad: number;
  headsetSpread: number;
}

export function getHairClearanceProfile(style: HairStyle3D): HairClearanceProfile {
  switch (style) {
    case "afro":
      return { crownLift: 0.032, sidePad: 0.042, headsetSpread: 1.18 };
    case "curly":
    case "glamour_waves":
    case "cyber_wave":
      return { crownLift: 0.018, sidePad: 0.02, headsetSpread: 1.08 };
    case "spiky":
    case "anime_spiky":
    case "urban_flame":
      return { crownLift: 0.022, sidePad: 0.015, headsetSpread: 1.07 };
    case "short":
    case "tactical_crop":
    case "slick_back":
      return { crownLift: 0.01, sidePad: 0.008, headsetSpread: 1.03 };
    default:
      return { crownLift: 0.015, sidePad: 0.014, headsetSpread: 1.06 };
  }
}

/** Rounded closed cranial hair cap matching the exact chibi head proportions (`[1.085, 0.985, 1.01]`). */
function crownCap(kit: MaterialKit, color: string, tilt = -0.34, scaleRadius = 1.06, cover = 0.54): THREE.Mesh {
  const geo = new THREE.SphereGeometry(R * scaleRadius, 40, 26, 0, TAU, 0, Math.PI * cover);
  return mesh(geo, kit.hair(color, true), "hair-shell", [0, C + 0.006, -0.004], [1.085, 0.985, 1.005], [tilt, 0, 0]);
}

/** Smooth rounded nape cushion covering upper-back skull and behind the ears seamlessly. */
function napeMass(kit: MaterialKit, color: string): THREE.Mesh {
  const geo = new THREE.SphereGeometry(R * 1.05, 32, 18, Math.PI * 0.82, Math.PI * 1.36, Math.PI * 0.4, Math.PI * 0.42);
  return mesh(geo, kit.hair(color, true), "hair-nape", [0, C - 0.004, -0.008], [1.075, 0.98, 1.0]);
}

/** Volumetric layered back hair locks instead of an open hollow cylinder wall. */
function volumetricBackCascade(
  kit: MaterialKit,
  look: AvatarLook3D,
  dropY: number,
  flareZ: number,
  rows = 5,
): THREE.Mesh[] {
  const hiColor = blendHair(look.hairColor, look.hairHighlight);
  const locks: THREE.Mesh[] = [];
  for (let i = 0; i < rows; i += 1) {
    const frac = rows > 1 ? (i / (rows - 1)) * 2 - 1 : 0; // -1..1
    const angle = frac * 1.05; // span across back from left to right behind ears
    const xRoot = Math.sin(angle) * 0.38;
    const zRoot = -Math.cos(angle) * 0.41;
    const xMid = Math.sin(angle) * (0.44 + flareZ * 0.45);
    const zMid = -Math.cos(angle) * (0.46 + flareZ * 0.7);
    const xTip = Math.sin(angle) * (0.42 + flareZ * 0.6);
    const zTip = -Math.cos(angle) * (0.42 + flareZ * 0.55);

    locks.push(
      mesh(
        ribbonLock(
          [
            pt(xRoot, 0.22, zRoot),
            pt(xMid, -dropY * 0.42, zMid),
            pt(xTip, -dropY, zTip),
          ],
          0.165 * S,
          0.078 * S,
          0.32,
          18,
        ),
        kit.hair(i % 2 === 1 ? hiColor : look.hairColor),
        `hair-back-lock-${i}`,
      ),
    );
  }
  return locks;
}

function sideLocks(kit: MaterialKit, look: AvatarLook3D, lengthScale = 1): THREE.Mesh[] {
  const hiColor = blendHair(look.hairColor, look.hairHighlight, 0.28);
  return [-1, 1].map((side) =>
    mesh(
      ribbonLock(
        [
          pt(0.36 * side, 0.29, 0.25),
          pt(0.49 * side, 0.03, 0.24),
          pt(0.47 * side, -0.25 * lengthScale, 0.17),
          pt(0.36 * side, -0.49 * lengthScale, 0.11),
        ],
        0.092 * S,
        0.052 * S,
        0.22,
        18,
      ),
      kit.hair(side > 0 ? look.hairColor : hiColor),
      `hair-lock-${side}`,
    ),
  );
}

/** Framed soft part bangs seamlessly rooted into the crown shell. */
function curtainBangs(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  const hiColor = blendHair(look.hairColor, look.hairHighlight);
  const defs: Array<{ pts: Pt[]; w: number; t: number; hi?: boolean }> = [
    { pts: [pt(0, 0.44, 0.17), pt(-0.14, 0.34, 0.41), pt(-0.29, 0.14, 0.43), pt(-0.39, -0.04, 0.34)], w: 0.115, t: 0.05 },
    { pts: [pt(0.02, 0.44, 0.17), pt(0.16, 0.34, 0.41), pt(0.3, 0.14, 0.43), pt(0.4, -0.04, 0.34)], w: 0.115, t: 0.05 },
    { pts: [pt(-0.07, 0.46, 0.15), pt(-0.08, 0.33, 0.43), pt(-0.17, 0.15, 0.44)], w: 0.098, t: 0.046, hi: true },
    { pts: [pt(0.07, 0.46, 0.15), pt(0.09, 0.33, 0.43), pt(0.18, 0.15, 0.43)], w: 0.098, t: 0.046 },
    { pts: [pt(-0.23, 0.4, 0.14), pt(-0.36, 0.23, 0.36), pt(-0.44, -0.02, 0.28)], w: 0.105, t: 0.048 },
    { pts: [pt(0.23, 0.4, 0.14), pt(0.37, 0.23, 0.36), pt(0.45, -0.02, 0.28)], w: 0.105, t: 0.048, hi: true },
  ];
  return defs.map((d, i) =>
    mesh(
      ribbonLock(d.pts, d.w * S, d.t * S, 0.2, 16),
      kit.hair(d.hi ? hiColor : look.hairColor),
      `hair-bang-${i}`,
    ),
  );
}

function fullFringe(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  const hiColor = blendHair(look.hairColor, look.hairHighlight);
  const columns = [-0.38, -0.25, -0.12, 0.0, 0.12, 0.25, 0.38];
  return columns.map((x, i) => {
    const curveZ = Math.sqrt(Math.max(0.06, 0.235 - x * x * 0.45));
    const endY = 0.135 + (i === 3 ? 0.012 : (i % 2) * 0.012);
    return mesh(
      ribbonLock(
        [pt(x * 0.36, 0.47, 0.16), pt(x * 0.86, 0.35, curveZ * 0.95), pt(x, endY, curveZ)],
        0.108 * S,
        0.048 * S,
        0.32,
        16,
      ),
      kit.hair(i % 3 === 1 ? hiColor : look.hairColor),
      `hair-fringe-${i}`,
    );
  });
}

function shortFringe(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  const hiColor = blendHair(look.hairColor, look.hairHighlight);
  const tufts: Array<{ x: number; dx: number; y: number; w: number }> = [
    { x: -0.35, dx: -0.03, y: 0.19, w: 0.138 },
    { x: -0.23, dx: -0.02, y: 0.16, w: 0.14 },
    { x: -0.11, dx: -0.01, y: 0.15, w: 0.145 },
    { x: 0.0, dx: 0.025, y: 0.16, w: 0.145 },
    { x: 0.11, dx: 0.02, y: 0.15, w: 0.145 },
    { x: 0.23, dx: 0.02, y: 0.16, w: 0.14 },
    { x: 0.35, dx: 0.03, y: 0.19, w: 0.138 },
  ];
  return tufts.map((t, i) => {
    const z = Math.sqrt(Math.max(0.08, 0.24 - (t.x + t.dx) ** 2 * 0.45));
    return mesh(
      ribbonLock([pt(t.x * 0.32, 0.47, 0.15), pt(t.x * 0.85, 0.36, z * 0.96), pt(t.x + t.dx, t.y, z)], t.w * S, 0.048 * S, 0.24, 14),
      kit.hair(i % 3 === 1 ? hiColor : look.hairColor),
      `hair-short-${i}`,
    );
  });
}

function bobSideCurves(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  return [-1, 1].map((side) =>
    mesh(
      ribbonLock(
        [pt(0.38 * side, 0.31, 0.16), pt(0.53 * side, 0.03, 0.14), pt(0.51 * side, -0.22, 0.11), pt(0.36 * side, -0.39, 0.15)],
        0.142 * S,
        0.066 * S,
        0.34,
        18,
      ),
      kit.hair(look.hairColor),
      `hair-bob-side-${side}`,
    ),
  );
}

function sideVolume(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  const hiColor = blendHair(look.hairColor, look.hairHighlight);
  const strands: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    [0, 1].forEach((k) => {
      const x = (0.39 + k * 0.08) * side;
      const z = 0.08 - k * 0.15;
      strands.push(
        mesh(
          ribbonLock(
            [pt(x * 0.8, 0.38, z), pt(x * 1.12, 0.04, z), pt(x * 1.06, -0.3, z + 0.04), pt(x * 1.13, -0.62, z - 0.02), pt(x * 0.98, -0.84, z)],
            0.11 * S,
            0.056 * S,
            0.22,
            22,
          ),
          kit.hair(k === 1 ? hiColor : look.hairColor),
          `hair-volume-${side}-${k}`,
        ),
      );
    });
  }
  return strands;
}

function flowingTail(kit: MaterialKit, look: AvatarLook3D): THREE.Mesh[] {
  const hiColor = blendHair(look.hairColor, look.hairHighlight, 0.4);
  return [
    { pts: [pt(-0.03, 0.44, -0.34), pt(-0.2, 0.55, -0.5), pt(-0.32, 0.2, -0.56), pt(-0.28, -0.28, -0.44), pt(-0.2, -0.68, -0.32)], w: 0.165, t: 0.095, color: look.hairColor },
    { pts: [pt(-0.04, 0.46, -0.33), pt(-0.24, 0.58, -0.46), pt(-0.4, 0.24, -0.49), pt(-0.36, -0.22, -0.37), pt(-0.27, -0.62, -0.24)], w: 0.12, t: 0.075, color: hiColor },
    { pts: [pt(-0.01, 0.43, -0.35), pt(-0.12, 0.53, -0.54), pt(-0.22, 0.16, -0.62), pt(-0.18, -0.31, -0.5), pt(-0.11, -0.71, -0.37)], w: 0.125, t: 0.08, color: look.hairColor },
  ].map(({ pts, w, t, color }, i) =>
    mesh(ribbonLock(pts, w * S, t * S, 0.16, 22), kit.hair(color), `hair-ponytail-${i}`),
  );
}

function ring<T>(count: number, fn: (angle: number, index: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => fn((index / count) * TAU, index));
}

const STYLES: Record<HairStyle3D, (kit: MaterialKit, look: AvatarLook3D) => THREE.Object3D[]> = {
  none: () => [],
  short: (kit, look) => [
    crownCap(kit, look.hairColor, -0.22, 1.06, 0.56),
    napeMass(kit, look.hairColor),
    ...shortFringe(kit, look),
  ],
  tactical_crop: (kit, look) => [
    crownCap(kit, look.hairColor, -0.22, 1.048, 0.56),
    napeMass(kit, look.hairColor),
    ...shortFringe(kit, look).slice(1, 6),
  ],
  ponytail: (kit, look) => [
    crownCap(kit, look.hairColor),
    napeMass(kit, look.hairColor),
    ...curtainBangs(kit, look),
    ...sideLocks(kit, look, 0.8),
    mesh(new THREE.TorusGeometry(0.092 * S, 0.036 * S, 10, 18), kit.fabric(look.brand), "hair-tie", pt(-0.03, 0.44, -0.34), undefined, [0.85, -0.35, 0]),
    ...flowingTail(kit, look),
  ],
  bob: (kit, look) => [
    crownCap(kit, look.hairColor),
    napeMass(kit, look.hairColor),
    ...volumetricBackCascade(kit, look, 0.44, 0.06, 5),
    ...fullFringe(kit, look),
    ...bobSideCurves(kit, look),
  ],
  long: (kit, look) => [
    crownCap(kit, look.hairColor),
    napeMass(kit, look.hairColor),
    ...volumetricBackCascade(kit, look, 0.9, 0.16, 7),
    ...sideVolume(kit, look),
    ...curtainBangs(kit, look),
    ...sideLocks(kit, look, 1.05),
  ],
  long_bangs: (kit, look) => [
    crownCap(kit, look.hairColor),
    napeMass(kit, look.hairColor),
    ...volumetricBackCascade(kit, look, 0.9, 0.16, 7),
    ...sideVolume(kit, look),
    ...fullFringe(kit, look),
    ...sideLocks(kit, look, 1.05),
  ],
  cyber_wave: (kit, look) => [
    crownCap(kit, look.hairColor),
    napeMass(kit, look.hairColor),
    ...volumetricBackCascade(kit, look, 0.92, 0.16, 7),
    ...curtainBangs(kit, look),
    ...sideVolume(kit, look),
  ],
  layered_long: (kit, look) => [
    crownCap(kit, look.hairColor),
    napeMass(kit, look.hairColor),
    ...volumetricBackCascade(kit, look, 0.82, 0.12, 7),
    ...curtainBangs(kit, look),
    ...sideLocks(kit, look, 1.08),
  ],
  glamour_waves: (kit, look) => [
    crownCap(kit, look.hairColor),
    napeMass(kit, look.hairColor),
    ...volumetricBackCascade(kit, look, 0.9, 0.16, 7),
    ...sideVolume(kit, look),
    ...curtainBangs(kit, look),
  ],
  long_tucked: (kit, look) => [
    crownCap(kit, look.hairColor, -0.32, 1.058, 0.53),
    napeMass(kit, look.hairColor),
    ...volumetricBackCascade(kit, look, 0.85, 0.12, 7),
    ...curtainBangs(kit, look).slice(0, 4),
  ],
  bun: (kit, look) => [
    crownCap(kit, look.hairColor),
    napeMass(kit, look.hairColor),
    ...curtainBangs(kit, look),
    ...sideLocks(kit, look, 0.72),
    mesh(new THREE.TorusGeometry(0.135 * S, 0.032 * S, 8, 18), kit.fabric(look.brand), "hair-bun-band", pt(0, 0.48, -0.09), undefined, [0.7, 0, 0]),
    mesh(new THREE.SphereGeometry(0.22 * S, 20, 16), kit.hair(look.hairColor), "hair-bun", pt(0, 0.56, -0.1)),
  ],
  afro: (kit, look) => {
    const hiColor = blendHair(look.hairColor, look.hairHighlight);
    return [
      mesh(new THREE.SphereGeometry(R * 1.32, 32, 20, 0, TAU, 0, Math.PI * 0.6), kit.hair(look.hairColor, true), "hair-shell", pt(0, 0.08, -0.04), [1.08, 1.02, 1.0], [-0.38, 0, 0]),
      ...ring(14, (angle, i) =>
        mesh(
          new THREE.SphereGeometry(0.185 * S, 12, 10),
          kit.hair(i % 3 === 0 ? hiColor : look.hairColor),
          `hair-puff-${i}`,
          pt(Math.sin(angle) * 0.58, 0.25 + Math.cos(angle * 2) * 0.08, -0.06 + Math.cos(angle) * 0.24),
        ),
      ),
      ...ring(8, (angle, i) =>
        mesh(
          new THREE.SphereGeometry(0.175 * S, 12, 10),
          kit.hair(i % 2 === 0 ? look.hairColor : hiColor),
          `hair-puff-top-${i}`,
          pt(Math.sin(angle) * 0.36, 0.48 + Math.cos(angle) * 0.04, -0.05 + Math.cos(angle) * 0.18),
        ),
      ),
    ];
  },
  spiky: (kit, look) => {
    const hiColor = blendHair(look.hairColor, look.hairHighlight);
    return [
      crownCap(kit, look.hairColor, -0.36, 1.058, 0.55),
      napeMass(kit, look.hairColor),
      ...shortFringe(kit, look),
      ...ring(10, (angle, i) => {
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        const tier = i % 2 === 0 ? 0.58 : 0.48;
        const rMid = i % 2 === 0 ? 0.33 : 0.43;
        const rTip = i % 2 === 0 ? 0.5 : 0.58;
        return mesh(
          ribbonLock([pt(s * 0.14, 0.3, c * 0.14 - 0.04), pt(s * rMid, tier * 0.88, c * rMid - 0.05), pt(s * rTip, tier, c * rTip - 0.08)], 0.13 * S, 0.062 * S, 0.16, 14),
          kit.hair(i % 3 === 1 ? hiColor : look.hairColor),
          `hair-spike-${i}`,
        );
      }),
    ];
  },
  anime_spiky: (kit, look) => {
    const hiColor = blendHair(look.hairColor, look.hairHighlight);
    return [
      crownCap(kit, look.hairColor, -0.36, 1.058, 0.55),
      napeMass(kit, look.hairColor),
      ...curtainBangs(kit, look).slice(0, 4),
      ...ring(12, (angle, i) => {
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        return mesh(
          ribbonLock([pt(s * 0.16, 0.32, c * 0.16), pt(s * 0.42, 0.52, c * 0.36), pt(s * 0.62, 0.62, c * 0.46)], 0.115 * S, 0.055 * S, 0.12, 14),
          kit.hair(i % 2 === 0 ? hiColor : look.hairColor),
          `hair-spike-${i}`,
        );
      }),
    ];
  },
  urban_flame: (kit, look) => {
    const hiColor = blendHair(look.hairColor, look.hairHighlight);
    return [
      crownCap(kit, look.hairColor, -0.36, 1.058, 0.55),
      napeMass(kit, look.hairColor),
      ...shortFringe(kit, look),
      ...ring(8, (angle, i) => {
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        return mesh(
          ribbonLock([pt(s * 0.14, 0.34, c * 0.12), pt(s * 0.34, 0.58, c * 0.25 + 0.06), pt(s * 0.46, 0.68, c * 0.32 + 0.1)], 0.125 * S, 0.06 * S, 0.15, 14),
          kit.hair(i % 2 === 1 ? hiColor : look.hairColor),
          `hair-spike-${i}`,
        );
      }),
    ];
  },
  curly: (kit, look) => {
    const hiColor = blendHair(look.hairColor, look.hairHighlight);
    return [
      crownCap(kit, look.hairColor, -0.36, 1.058, 0.55),
      napeMass(kit, look.hairColor),
      ...shortFringe(kit, look),
      ...ring(16, (angle, i) =>
        mesh(
          new THREE.SphereGeometry(0.11 * S, 12, 10),
          kit.hair(i % 3 === 1 ? hiColor : look.hairColor),
          `hair-curl-${i}`,
          pt(Math.sin(angle) * 0.5, 0.16 + (i % 2) * 0.13, Math.cos(angle) * 0.42 - 0.1),
        ),
      ),
    ];
  },
  slick_back: (kit, look) => [
    crownCap(kit, look.hairColor, -0.44, 1.058, 0.55),
    napeMass(kit, look.hairColor),
    mesh(ribbonLock([pt(0, 0.42, 0.32), pt(0, 0.5, 0.08), pt(0, 0.42, -0.24)], 0.17 * S, 0.056 * S, 0.7, 14), kit.hair(look.hairColor), "hair-crest"),
    mesh(new THREE.SphereGeometry(0.25 * S, 20, 14), kit.hair(look.hairColor), "hair-back", pt(0, 0.02, -0.34), [1.28, 0.9, 0.72]),
  ],
  medium_side: (kit, look) => {
    const hiColor = blendHair(look.hairColor, look.hairHighlight);
    return [
      crownCap(kit, look.hairColor, -0.36, 1.058, 0.55),
      napeMass(kit, look.hairColor),
      mesh(ribbonLock([pt(-0.08, 0.44, 0.22), pt(0.16, 0.34, 0.4), pt(0.36, 0.14, 0.34)], 0.145 * S, 0.052 * S, 0.28, 16), kit.hair(look.hairColor), "hair-sweep"),
      mesh(ribbonLock([pt(-0.18, 0.42, 0.18), pt(-0.35, 0.23, 0.35), pt(-0.42, 0.04, 0.28)], 0.105 * S, 0.044 * S, 0.25, 14), kit.hair(hiColor), "hair-sweep-side"),
      ...volumetricBackCascade(kit, look, 0.34, 0.04, 5),
    ];
  },
};

const HIDDEN_UNDER_HAT = /hair-(spike|bun|puff|curl|tie|bun-band|crest)/;

export function buildHair(look: AvatarLook3D, kit: MaterialKit): THREE.Group {
  const hair = group(`hair-style-${look.hairStyle}`);
  const builder = STYLES[look.hairStyle] || STYLES.short;
  const parts = builder(kit, look).filter((part) => look.headwear === "none" || !HIDDEN_UNDER_HAT.test(part.name));
  hair.add(...parts);
  return hair;
}

export function buildHairSlot(
  look: AvatarLook3D,
  kit: MaterialKit,
  targetMount: THREE.Group,
): void {
  clearMountGroup(targetMount);
  const built = buildHair(look, kit);
  targetMount.add(built);
}
