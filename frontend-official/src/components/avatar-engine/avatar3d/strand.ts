import * as THREE from "three";
import { HEAD_CENTER_Y } from "./anatomy";

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

/**
 * Builds a closed, convex sculpted hair lock oriented outward from the scalp center
 * with a plush outer ridge and smooth root-to-tip taper (zero paper-thin plates or open holes).
 */
export function ribbonLock(
  points: Point[],
  halfWidth: number,
  halfThickness: number,
  tip = 0.12,
  segments = 24,
  radialSegs = 14,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const headCenter = new THREE.Vector3(0, HEAD_CENTER_Y, 0);
  const fallbackUp = new THREE.Vector3(0, 1, 0);
  const fallbackFwd = new THREE.Vector3(0, 0, 1);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const center = new THREE.Vector3();

  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    curve.getPointAt(u, center);
    curve.getTangentAt(u, tangent).normalize();

    radial.copy(center).sub(headCenter);
    radial.addScaledVector(tangent, -radial.dot(tangent));
    if (radial.lengthSq() < 1e-4) {
      radial.copy(Math.abs(tangent.dot(fallbackFwd)) < 0.9 ? fallbackFwd : fallbackUp);
      radial.addScaledVector(tangent, -radial.dot(tangent));
    }
    normal.copy(radial).normalize();
    binormal.crossVectors(normal, tangent).normalize();

    const rootEase = Math.sin(Math.min(1, u / 0.14) * (Math.PI / 2));
    const widthProfile = (0.58 + 0.42 * rootEase) * (1 - (1 - tip) * Math.pow(u, 1.75));
    const thickProfile = (0.64 + 0.36 * rootEase) * (1 - (1 - tip * 1.15) * Math.pow(u, 1.65));
    const w = halfWidth * widthProfile;
    const h = halfThickness * thickProfile;

    for (let j = 0; j <= radialSegs; j += 1) {
      const theta = (j / radialSegs) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      // Asymmetric crescent cross-section: gently fuller on outer side (sinT > 0), nestled inner side
      const outerBoost = sinT > 0 ? 1.25 : 0.72;
      const px = center.x + binormal.x * cosT * w + normal.x * sinT * h * outerBoost;
      const py = center.y + binormal.y * cosT * w + normal.y * sinT * h * outerBoost;
      const pz = center.z + binormal.z * cosT * w + normal.z * sinT * h * outerBoost;
      positions.push(px, py, pz);
      uvs.push(j / radialSegs, u);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radialSegs; j += 1) {
      const a = i * stride + j;
      const d = i * stride + (j + 1);
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      indices.push(a, d, c);
      indices.push(a, c, b);
    }
  }

  // Cap root and tip center vertices so geometry is watertight from every angle
  const rootStart = curve.getPointAt(0, new THREE.Vector3());
  const rootIdx = positions.length / 3;
  positions.push(rootStart.x, rootStart.y, rootStart.z);
  uvs.push(0.5, 0);
  for (let j = 0; j < radialSegs; j += 1) {
    indices.push(rootIdx, j + 1, j);
  }

  const tipEnd = curve.getPointAt(1, new THREE.Vector3());
  const tipIdx = positions.length / 3;
  positions.push(tipEnd.x, tipEnd.y, tipEnd.z);
  uvs.push(0.5, 1);
  const lastRow = segments * stride;
  for (let j = 0; j < radialSegs; j += 1) {
    indices.push(tipIdx, lastRow + j, lastRow + j + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
