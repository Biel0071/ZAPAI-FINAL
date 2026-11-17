import * as THREE from "three";

let toonGradient: THREE.DataTexture | null = null;

function getToonGradient(): THREE.DataTexture {
  if (toonGradient) return toonGradient;
  const tones = new Uint8Array([90, 170, 255]);
  toonGradient = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
  toonGradient.minFilter = THREE.NearestFilter;
  toonGradient.magFilter = THREE.NearestFilter;
  toonGradient.needsUpdate = true;
  return toonGradient;
}

export class MaterialKit {
  private cache = new Map<string, THREE.Material>();
  private textures: THREE.Texture[] = [];

  track<T extends THREE.Texture>(texture: T): T {
    this.textures.push(texture);
    return texture;
  }

  toon(color: string): THREE.MeshToonMaterial {
    const key = `toon:${color}`;
    let material = this.cache.get(key) as THREE.MeshToonMaterial | undefined;
    if (!material) {
      material = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient() });
      this.cache.set(key, material);
    }
    return material;
  }

  toonDouble(color: string): THREE.MeshToonMaterial {
    const key = `toon2:${color}`;
    let material = this.cache.get(key) as THREE.MeshToonMaterial | undefined;
    if (!material) {
      material = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient(), side: THREE.DoubleSide });
      this.cache.set(key, material);
    }
    return material;
  }

  glow(color: string, opacity = 1): THREE.MeshBasicMaterial {
    const key = `glow:${color}:${opacity}`;
    let material = this.cache.get(key) as THREE.MeshBasicMaterial | undefined;
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
      this.cache.set(key, material);
    }
    return material;
  }

  dispose(): void {
    this.cache.forEach((material) => material.dispose());
    this.cache.clear();
    this.textures.forEach((texture) => texture.dispose());
    this.textures = [];
  }
}

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  position: [number, number, number] = [0, 0, 0],
  scale?: [number, number, number],
  rotation?: [number, number, number],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.position.set(...position);
  if (scale) result.scale.set(...scale);
  if (rotation) result.rotation.set(...rotation);
  return result;
}

export function group(name: string, position: [number, number, number] = [0, 0, 0]): THREE.Group {
  const result = new THREE.Group();
  result.name = name;
  result.position.set(...position);
  return result;
}