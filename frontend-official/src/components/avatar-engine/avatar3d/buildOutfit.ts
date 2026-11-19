import * as THREE from "three";
import type { AvatarLook3D } from "./look3d";
import { MaterialKit, group, mesh } from "./materials";
import { taperedStrand } from "./strand";
import { FOREARM_LENGTH, getHumanoidDimensions, UPPER_ARM_LENGTH } from "./anatomy";
import { clearMountGroup, type SlotMounts } from "./humanoidRig";

function torsoProfileRadius(female: boolean, y: number): number {
  const dims = getHumanoidDimensions(female);
  if (y <= -0.155) return dims.hipRadiusX * 0.88;
  if (y <= -0.055) {
    return dims.hipRadiusX * 0.88 + ((dims.waistRadiusX * 0.99 - dims.hipRadiusX * 0.88) * (y + 0.155)) / 0.1;
  }
  if (y <= 0.025) {
    return dims.waistRadiusX * 0.99 + ((dims.waistRadiusX * 1.03 - dims.waistRadiusX * 0.99) * (y + 0.055)) / 0.08;
  }
  if (y <= 0.12) {
    return dims.waistRadiusX * 1.03 + ((dims.chestRadiusX * 0.98 - dims.waistRadiusX * 1.03) * (y - 0.025)) / 0.095;
  }
  if (y <= 0.165) {
    return dims.chestRadiusX * 0.98 + ((dims.chestRadiusX * 1.01 - dims.chestRadiusX * 0.98) * (y - 0.12)) / 0.045;
  }
  if (y <= 0.21) {
    return dims.chestRadiusX * 1.01 + ((dims.shoulderHalfWidth * 0.86 - dims.chestRadiusX * 1.01) * (y - 0.165)) / 0.045;
  }
  return (
    dims.shoulderHalfWidth * 0.86 +
    ((dims.neckRadius * 1.24 - dims.shoulderHalfWidth * 0.86) * Math.min(1, (y - 0.21) / 0.028))
  );
}

function chestPanel(
  female: boolean,
  offset: number,
  yMin: number,
  yMax: number,
  thetaStart: number,
  thetaLength: number,
): THREE.BufferGeometry {
  const dims = getHumanoidDimensions(female);
  const steps = 8;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const y = yMin + ((yMax - yMin) * i) / steps;
    points.push(new THREE.Vector2(torsoProfileRadius(female, y) + offset, y));
  }
  const geo = new THREE.LatheGeometry(points, 32, thetaStart, thetaLength);
  geo.scale(1, 1, dims.chestRadiusZ / dims.chestRadiusX);
  geo.computeVertexNormals();
  return geo;
}

function ribbedNeckCollar(kit: MaterialKit, color: string, radius = 0.068): THREE.Mesh {
  return mesh(
    new THREE.TorusGeometry(radius, 0.012, 10, 28),
    kit.knit(color, false),
    "collar",
    [0, 0.23, 0.006],
    [1, 1, 0.86],
    [Math.PI / 2 + 0.08, 0, 0],
  );
}

function buildFoldedCollar(kit: MaterialKit, color: string, cz: number): THREE.Group {
  const g = group("folded-collar");
  const mat = kit.fabric(color, true, 0.72);
  g.add(
    mesh(
      new THREE.TorusGeometry(0.068, 0.013, 10, 26, Math.PI * 1.48),
      mat,
      "collar-ring",
      [0, 0.232, 0.004],
      [1, 0.95, 0.86],
      [Math.PI / 2 + 0.08, 0, Math.PI * 0.26],
    ),
  );
  for (const side of [-1, 1]) {
    g.add(
      mesh(
        new THREE.BoxGeometry(0.032, 0.022, 0.008),
        mat,
        `collar-flap-${side}`,
        [0.025 * side, 0.224, cz * 0.68],
        undefined,
        [-0.25, 0.42 * side, -0.35 * side],
      ),
    );
  }
  return g;
}

export function buildOutfit(look: AvatarLook3D, kit: MaterialKit): THREE.Group {
  const { outfit, brand, female } = look;
  const dims = getHumanoidDimensions(female);
  const details = group(`outfit-${outfit.kind}`);
  const bodyMat = kit.fabric(outfit.body, true, outfit.kind === "bomber" ? 0.48 : 0.78);
  const trimMat = kit.fabric(outfit.trim, true, 0.62);
  const ribMat = kit.knit(outfit.body);
  const trimRibMat = kit.knit(outfit.trim);

  // Full textured torso base wrapping shoulders -> waist -> hip hem smoothly
  const shellColor = outfit.kind === "vest" ? (outfit.inner || "#1f2937") : outfit.body;
  const shellMat = kit.fabric(shellColor, true, outfit.kind === "bomber" ? 0.5 : 0.78);
  details.add(mesh(chestPanel(female, 0.006, -0.17, 0.236, 0, Math.PI * 2), shellMat, "outfit-shell"));

  // Contoured lower waistband / garment hem for crisp tailored finish
  if (outfit.kind !== "shirt") {
    details.add(mesh(chestPanel(female, 0.009, -0.172, -0.145, 0, Math.PI * 2), outfit.kind === "bomber" ? trimRibMat : ribMat, "outfit-hem"));
  }

  switch (outfit.kind) {
    case "polo":
      details.add(
        buildFoldedCollar(kit, outfit.trim, dims.chestRadiusZ),
        mesh(chestPanel(female, 0.01, 0.115, 0.228, -0.13, 0.26), trimMat, "placket"),
        ...[0.19, 0.155, 0.125].map((by, idx) =>
          mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 10), kit.metal("#e2e8f0", 0.35, 0.4), `polo-btn-${idx}`, [0, by, dims.chestRadiusZ * 1.05], undefined, [Math.PI / 2, 0, 0]),
        ),
      );
      break;

    case "shirt":
      details.add(
        buildFoldedCollar(kit, "#f1f5f9", dims.chestRadiusZ),
        mesh(chestPanel(female, 0.009, -0.15, 0.228, -0.055, 0.11), kit.fabric("#e2e8f0", true), "shirt-placket"),
        mesh(chestPanel(female, 0.011, 0.075, 0.135, 0.38, 0.28), kit.fabric("#e2e8f0", true), "shirt-chest-pocket"),
        mesh(
          taperedStrand([[0, 0.222, dims.chestRadiusZ * 0.65], [0, 0.11, dims.chestRadiusZ * 1.05], [0, -0.04, dims.chestRadiusZ * 1.02]], 0.017, 0.56, 12),
          trimMat,
          "tie",
        ),
        mesh(new THREE.SphereGeometry(0.018, 12, 10), trimMat, "tie-knot", [0, 0.22, dims.chestRadiusZ * 0.68], [1, 0.85, 0.7]),
      );
      break;

    case "hoodie":
      details.add(
        mesh(new THREE.TorusGeometry(0.088, 0.032, 12, 26), bodyMat, "hood", [0, 0.242, -0.045], [1.05, 1, 0.88], [Math.PI / 2.35, 0, 0]),
        mesh(chestPanel(female, 0.011, -0.145, 0.226, -0.035, 0.07), kit.metal("#94a3b8", 0.35, 0.65), "zipper"),
        mesh(chestPanel(female, 0.014, -0.145, -0.035, -0.56, 1.12), bodyMat, "pocket"),
        mesh(chestPanel(female, 0.015, -0.145, -0.13, -0.56, 1.12), trimRibMat, "pocket-trim"),
        ...[-1, 1].map((side) =>
          mesh(
            taperedStrand([[0.028 * side, 0.218, dims.chestRadiusZ * 0.72], [0.032 * side, 0.125, dims.chestRadiusZ * 1.04]], 0.0055, 0.85, 8),
            kit.fabric("#e5e7eb"),
            `drawstring-${side}`,
          ),
        ),
      );
      break;

    case "uniform":
      details.add(
        buildFoldedCollar(kit, outfit.body, dims.chestRadiusZ),
        mesh(chestPanel(female, 0.01, -0.155, 0.226, -0.045, 0.09), kit.fabric("#334155", true), "uniform-placket"),
        ...[0.15, 0.075, 0.0].map((by, idx) =>
          mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.004, 10), kit.metal("#cbd5e1", 0.35, 0.45), `uniform-btn-${idx}`, [0, by, dims.chestRadiusZ * 1.06], undefined, [Math.PI / 2, 0, 0]),
        ),
        ...[-1, 1].map((side) =>
          mesh(
            chestPanel(female, 0.012, 0.072, 0.14, 0.35 * side - 0.16, 0.32),
            kit.fabric("#162d4c", true),
            `pocket-${side}`,
          ),
        ),
        ...[-1, 1].map((side) =>
          mesh(
            chestPanel(female, 0.0135, 0.13, 0.146, 0.35 * side - 0.165, 0.33),
            trimMat,
            `pocket-flap-${side}`,
          ),
        ),
        ...[-1, 1].map((side) =>
          mesh(new THREE.BoxGeometry(0.045, 0.008, 0.022), trimMat, `epaulet-${side}`, [(dims.shoulderHalfWidth * 0.72) * side, 0.208, 0], undefined, [0, 0, -0.22 * side]),
        ),
      );
      break;

    case "jacket": {
      const lapelMat = kit.fabric("#263042", true, 0.68);
      details.add(
        // Crisp contrast inner tailored shirt inside open V-neck blazer
        mesh(chestPanel(female, 0.008, -0.16, 0.23, -0.28, 0.56), kit.fabric("#f1f5f9", true), "inner-tee"),
        // Thick structured outer blazer coat overlapping waist cleanly
        mesh(chestPanel(female, 0.014, -0.165, 0.228, 0.22, Math.PI * 2 - 0.44), bodyMat, "jacket-shell"),
        mesh(chestPanel(female, 0.014, -0.165, 0.025, -0.24, 0.48), bodyMat, "jacket-lower-front"),
        mesh(
          new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 10),
          kit.metal("#cbd5e1", 0.35, 0.45),
          "jacket-btn",
          [0, 0.01, dims.chestRadiusZ * 1.06],
          undefined,
          [Math.PI / 2, 0, 0],
        ),
        buildFoldedCollar(kit, "#263042", dims.chestRadiusZ),
        // Structured charcoal notched lapels + subtle brand piping
        ...[-1, 1].map((side) =>
          mesh(
            taperedStrand(
              [
                [0.028 * side, 0.222, dims.chestRadiusZ * 0.72],
                [0.04 * side, 0.11, dims.chestRadiusZ * 1.07],
                [0.028 * side, 0.015, dims.chestRadiusZ * 1.03],
              ],
              0.015,
              0.84,
              14,
            ),
            lapelMat,
            `lapel-${side}`,
          ),
        ),
        mesh(
          new THREE.BoxGeometry(0.018, 0.007, 0.006),
          trimMat,
          "lapel-accent-pin",
          [0.056, 0.145, dims.chestRadiusZ * 1.075],
          undefined,
          [0, 0.3, -0.15],
        ),
        ...[-1, 1].map((side) =>
          mesh(
            chestPanel(female, 0.016, -0.105, -0.086, 0.42 * side - 0.16, 0.32),
            lapelMat,
            `welt-pocket-${side}`,
          ),
        ),
      );
      break;
    }

    case "vest":
      details.add(
        mesh(chestPanel(female, 0.013, -0.16, 0.224, 0.18, Math.PI * 2 - 0.36), bodyMat, "vest-shell"),
        mesh(chestPanel(female, 0.014, -0.16, 0.224, -0.18, 0.36), kit.fabric("#0f172a", true), "vest-zip-guard"),
        ...[0.0, 0.105].map((y, i) =>
          mesh(
            chestPanel(female, 0.017, y - 0.013, y + 0.013, 0.16, Math.PI * 2 - 0.32),
            kit.led(outfit.trim, 1, 0.24),
            `reflective-${i}`,
          ),
        ),
      );
      break;

    case "tee":
      details.add(
        ribbedNeckCollar(kit, outfit.trim, 0.064),
        mesh(chestPanel(female, 0.009, 0.11, 0.145, 0.3, 0.3), kit.fabric(brand, true), "chest-logo"),
      );
      break;

    case "bomber":
      details.add(
        ribbedNeckCollar(kit, outfit.trim, 0.07),
        mesh(chestPanel(female, 0.011, -0.15, 0.226, -0.035, 0.07), kit.metal("#cbd5e1", 0.32, 0.72), "zipper"),
        mesh(chestPanel(female, 0.014, -0.165, -0.135, 0, Math.PI * 2), trimRibMat, "rib-waist"),
      );
      break;
  }

  return details;
}

export function buildUpperBodySlot(
  look: AvatarLook3D,
  kit: MaterialKit,
  mounts: SlotMounts,
): void {
  clearMountGroup(mounts.upper_body_slot);
  clearMountGroup(mounts.sleeves.leftUpper);
  clearMountGroup(mounts.sleeves.leftForearm);
  clearMountGroup(mounts.sleeves.rightUpper);
  clearMountGroup(mounts.sleeves.rightForearm);

  mounts.upper_body_slot.add(buildOutfit(look, kit));

  const dims = getHumanoidDimensions(look.female);
  const { outfit } = look;
  const sleeveColor = outfit.kind === "vest" ? (outfit.inner || "#1f2937") : outfit.body;
  const sleeveMat = kit.fabric(sleeveColor, false, outfit.kind === "bomber" ? 0.5 : 0.78);
  const trimMat = kit.fabric(outfit.trim, false, 0.62);
  const ribTrimMat = outfit.kind === "jacket" ? kit.knit("#263042") : kit.knit(outfit.trim);
  const striped = outfit.kind === "hoodie" || outfit.kind === "bomber";

  for (const [side, upperMount, foreMount] of [
    [-1, mounts.sleeves.leftUpper, mounts.sleeves.leftForearm],
    [1, mounts.sleeves.rightUpper, mounts.sleeves.rightForearm],
  ] as const) {
    if (outfit.longSleeves) {
      upperMount.add(
        mesh(new THREE.SphereGeometry(dims.upperArmRadius * 1.15, 16, 12), sleeveMat, `sleeve-cap-${side}`),
        mesh(new THREE.CapsuleGeometry(dims.upperArmRadius * 1.13, UPPER_ARM_LENGTH - 0.035, 8, 16), sleeveMat, `sleeve-upper-${side}`, [0, -UPPER_ARM_LENGTH / 2, 0]),
      );
      foreMount.add(
        mesh(new THREE.SphereGeometry(dims.upperArmRadius * 1.02, 14, 10), sleeveMat, `sleeve-elbow-${side}`),
        mesh(new THREE.CapsuleGeometry(dims.forearmRadius * 1.1, FOREARM_LENGTH - 0.04, 8, 16), sleeveMat, `sleeve-fore-${side}`, [0, -FOREARM_LENGTH / 2, 0]),
        mesh(new THREE.TorusGeometry(dims.forearmRadius * 1.08, 0.0085, 8, 18), ribTrimMat, `sleeve-cuff-${side}`, [0, -FOREARM_LENGTH + 0.02, 0], undefined, [Math.PI / 2, 0, 0]),
      );
      if (outfit.kind === "jacket" || outfit.kind === "shirt") {
        foreMount.add(
          mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.006, 8), kit.metal("#e2e8f0"), `sleeve-cuff-btn-${side}`, [dims.forearmRadius * 1.06 * side, -FOREARM_LENGTH + 0.032, 0], undefined, [0, 0, Math.PI / 2]),
        );
      }
      if (striped) {
        [-0.06, -0.095].forEach((y, i) => {
          upperMount.add(
            mesh(new THREE.TorusGeometry(dims.upperArmRadius * 1.14, 0.0055, 6, 16), trimMat, `sleeve-stripe-${side}-${i}`, [0, y, 0], undefined, [Math.PI / 2, 0, 0]),
          );
        });
      }
    } else {
      const shortLen = UPPER_ARM_LENGTH * 0.48;
      upperMount.add(
        mesh(new THREE.SphereGeometry(dims.upperArmRadius * 1.16, 16, 12), sleeveMat, `sleeve-cap-${side}`),
        mesh(new THREE.CylinderGeometry(dims.upperArmRadius * 1.16, dims.upperArmRadius * 1.12, shortLen, 18), sleeveMat, `sleeve-short-${side}`, [0, -shortLen / 2, 0]),
        mesh(new THREE.TorusGeometry(dims.upperArmRadius * 1.13, 0.007, 6, 18), ribTrimMat, `sleeve-trim-${side}`, [0, -shortLen, 0], undefined, [Math.PI / 2, 0, 0]),
      );
    }
  }
}

export function buildUniformSlot(
  look: AvatarLook3D,
  kit: MaterialKit,
  mounts: SlotMounts,
): void {
  clearMountGroup(mounts.uniform_slot);
  const uniformGroup = group(`uniform-${look.uniformId}`);
  const accentMat = kit.led(look.brand, 1, 0.35);

  uniformGroup.add(
    mesh(chestPanel(look.female, 0.016, 0.115, 0.138, 0.34, 0.24), accentMat, "chest-emblem"),
    mesh(
      new THREE.BoxGeometry(0.034, 0.016, 0.006),
      kit.metal("#e2e8f0"),
      "uniform-pin-plate",
      [0.072, 0.128, getHumanoidDimensions(look.female).chestRadiusZ * 1.06],
      undefined,
      [0, 0.42, 0],
    ),
  );
  mounts.uniform_slot.add(uniformGroup);
}
