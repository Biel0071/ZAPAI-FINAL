import * as THREE from "three";

const OUTLINE_WORLD = 0.022;
const MIN_RADIUS = 0.025;

export function applyOutline(root: THREE.Object3D, color = "#0b1220"): THREE.Material {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const targets: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && !node.userData.noOutline && !(node.material instanceof THREE.MeshBasicMaterial)) targets.push(node);
  });
  for (const target of targets) {
    target.geometry.computeBoundingSphere();
    const radius = target.geometry.boundingSphere?.radius ?? 0;
    if (radius < MIN_RADIUS) continue;
    const outline = new THREE.Mesh(target.geometry, material);
    outline.name = `${target.name}-outline`;
    outline.userData.noOutline = true;
    outline.scale.setScalar(Math.min(1.3, 1 + OUTLINE_WORLD / radius));
    target.add(outline);
  }
  return material;
}