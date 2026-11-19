import * as THREE from "three";

const OUTLINE_WIDTH = 0.015;
const MIN_RADIUS = 0.02;

/**
 * Adds a uniform BackSide cel-outline extruded along vertex normals in shader space
 * so off-origin meshes never shift forward toward the camera.
 */
export function applyOutline(root: THREE.Object3D, color = "#0b111e"): THREE.Material {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  material.customProgramCacheKey = () => "zai-cel-outline-v1";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOutlineWidth = { value: OUTLINE_WIDTH };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uOutlineWidth;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nif (length(normal) > 0.0001) transformed += normalize(normal) * uOutlineWidth;",
      );
  };

  const targets: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && !node.userData.noOutline && !(node.material instanceof THREE.MeshBasicMaterial)) {
      targets.push(node);
    }
  });
  for (const target of targets) {
    target.geometry.computeBoundingSphere();
    const radius = target.geometry.boundingSphere?.radius ?? 0;
    if (radius < MIN_RADIUS) continue;
    const outline = new THREE.Mesh(target.geometry, material);
    outline.name = `${target.name}-outline`;
    outline.userData.noOutline = true;
    target.add(outline);
  }
  return material;
}