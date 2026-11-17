import * as THREE from "three";
import type { AvatarLook3D } from "./look3d";
import { MaterialKit, group, mesh } from "./materials";

const FRONT_Z = 0.2;

function box(kit: MaterialKit, color: string, name: string, size: [number, number, number], position: [number, number, number], rotation?: [number, number, number]) {
  return mesh(new THREE.BoxGeometry(...size), kit.toon(color), name, position, undefined, rotation);
}

function collar(kit: MaterialKit, color: string, name = "collar", radius = 0.13): THREE.Mesh {
  return mesh(new THREE.TorusGeometry(radius, 0.03, 8, 24), kit.toon(color), name, [0, 1.27, 0.02], [1, 1, 0.85], [Math.PI / 2, 0, 0]);
}

export function buildOutfit(look: AvatarLook3D, kit: MaterialKit): THREE.Group {
  const { outfit, brand } = look;
  const details = group(`outfit-${outfit.kind}`);
  switch (outfit.kind) {
    case "polo":
      details.add(collar(kit, outfit.trim), box(kit, outfit.trim, "placket", [0.05, 0.13, 0.01], [0, 1.16, FRONT_Z]));
      break;
    case "shirt":
      details.add(collar(kit, "#e2e8f0"), box(kit, outfit.trim, "tie", [0.07, 0.32, 0.02], [0, 1.04, FRONT_Z + 0.01]), box(kit, outfit.trim, "tie-knot", [0.08, 0.06, 0.03], [0, 1.22, FRONT_Z]));
      break;
    case "hoodie":
      details.add(
        mesh(new THREE.TorusGeometry(0.17, 0.07, 10, 24), kit.toon(outfit.body), "hood", [0, 1.28, -0.12], [1, 1, 0.8], [Math.PI / 2.4, 0, 0]),
        box(kit, outfit.trim, "zipper", [0.025, 0.5, 0.012], [0, 0.98, FRONT_Z + 0.005]),
        box(kit, outfit.body, "pocket", [0.32, 0.12, 0.03], [0, 0.78, FRONT_Z - 0.01]),
        ...[-1, 1].map((side) => mesh(new THREE.CapsuleGeometry(0.012, 0.16, 4, 8), kit.toon("#e5e7eb"), `drawstring-${side}`, [0.06 * side, 1.1, FRONT_Z + 0.02])),
      );
      break;
    case "uniform":
      details.add(collar(kit, outfit.body), ...[-1, 1].map((side) => box(kit, outfit.trim, `pocket-${side}`, [0.12, 0.1, 0.02], [0.11 * side, 1.06, FRONT_Z])));
      details.add(box(kit, outfit.trim, "chest-band", [0.5, 0.035, 0.36], [0, 0.88, 0]));
      break;
    case "jacket":
      details.add(box(kit, outfit.inner || "#f8fafc", "inner-tee", [0.16, 0.5, 0.02], [0, 0.98, FRONT_Z + 0.002]));
      details.add(...[-1, 1].map((side) => box(kit, outfit.trim, `lapel-${side}`, [0.035, 0.42, 0.02], [0.09 * side, 1.02, FRONT_Z + 0.008], [0, 0, 0.15 * side])));
      break;
    case "vest":
      details.add(...[-1, 1].map((side) => box(kit, outfit.body, `vest-panel-${side}`, [0.17, 0.56, 0.38], [0.14 * side, 0.96, 0])));
      details.add(...[0.86, 1.02].map((y, i) => box(kit, outfit.trim, `reflective-${i}`, [0.54, 0.035, 0.4], [0, y, 0])));
      break;
    case "tee":
      details.add(collar(kit, outfit.body, "collar", 0.11), box(kit, brand, "chest-logo", [0.14, 0.05, 0.01], [0, 1.08, FRONT_Z]));
      break;
    case "bomber":
      details.add(collar(kit, outfit.trim, "rib-collar", 0.14), box(kit, outfit.trim, "zipper", [0.02, 0.5, 0.012], [0, 0.98, FRONT_Z + 0.005]));
      details.add(mesh(new THREE.TorusGeometry(0.245, 0.03, 8, 28), kit.toon(outfit.trim), "rib-waist", [0, 0.7, 0], [1, 1, 0.8], [Math.PI / 2, 0, 0]));
      break;
  }
  return details;
}