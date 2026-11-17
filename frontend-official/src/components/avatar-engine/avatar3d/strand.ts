import * as THREE from "three";

type Point = [number, number, number];

export function taperedStrand(points: Point[], radius: number, tip = 0.18, segments = 24): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const radial = 10;
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    curve.getPointAt(u, center);
    const factor = 1 - (1 - tip) * u * u;
    for (let j = 0; j <= radial; j += 1) {
      const index = i * (radial + 1) + j;
      vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(factor).add(center);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}