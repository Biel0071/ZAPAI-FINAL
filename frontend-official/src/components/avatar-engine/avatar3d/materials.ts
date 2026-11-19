import * as THREE from "three";

function canCreate2DCanvas(): boolean {
  return (
    typeof document !== "undefined" &&
    !(typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent))
  );
}

function makeFabricBumpTexture(): THREE.CanvasTexture | null {
  if (!canCreate2DCanvas()) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      const parity = ((x + y) >> 2) & 1;
      ctx.fillStyle = parity ? "#929292" : "#6e6e6e";
      ctx.fillRect(x, y, 2, 3);
      ctx.fillStyle = parity ? "#747474" : "#8c8c8c";
      ctx.fillRect(x + 2, y + 1, 2, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function makeRibBumpTexture(): THREE.CanvasTexture | null {
  if (!canCreate2DCanvas()) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  for (let x = 0; x < 64; x += 4) {
    ctx.fillStyle = "#9e9e9e";
    ctx.fillRect(x, 0, 2, 64);
    ctx.fillStyle = "#626262";
    ctx.fillRect(x + 2, 0, 2, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 4);
  return tex;
}

function makeHairBumpTexture(): THREE.CanvasTexture | null {
  if (!canCreate2DCanvas()) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 2) {
    const shade = 112 + ((x * 29) % 38);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, 0, 1, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture | null {
  if (!canCreate2DCanvas()) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
  grad.addColorStop(0, "rgba(2, 6, 23, 0.72)");
  grad.addColorStop(0.45, "rgba(2, 6, 23, 0.36)");
  grad.addColorStop(0.78, "rgba(2, 6, 23, 0.08)");
  grad.addColorStop(1, "rgba(2, 6, 23, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class MaterialKit {
  private cache = new Map<string, THREE.Material>();
  private textures: THREE.Texture[] = [];
  private fabricBump: THREE.CanvasTexture | null | undefined;
  private ribBump: THREE.CanvasTexture | null | undefined;
  private hairBump: THREE.CanvasTexture | null | undefined;

  track<T extends THREE.Texture>(texture: T): T {
    this.textures.push(texture);
    return texture;
  }

  private getFabricBump(): THREE.CanvasTexture | null {
    if (this.fabricBump === undefined) {
      this.fabricBump = makeFabricBumpTexture();
      if (this.fabricBump) this.textures.push(this.fabricBump);
    }
    return this.fabricBump;
  }

  private getRibBump(): THREE.CanvasTexture | null {
    if (this.ribBump === undefined) {
      this.ribBump = makeRibBumpTexture();
      if (this.ribBump) this.textures.push(this.ribBump);
    }
    return this.ribBump;
  }

  private getHairBump(): THREE.CanvasTexture | null {
    if (this.hairBump === undefined) {
      this.hairBump = makeHairBumpTexture();
      if (this.hairBump) this.textures.push(this.hairBump);
    }
    return this.hairBump;
  }

  skin(color: string, doubleSide = false): THREE.MeshStandardMaterial {
    const key = `skin:${color}:${doubleSide ? 1 : 0}`;
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      const warmSubsurface = new THREE.Color(color).lerp(new THREE.Color("#f58b6e"), 0.28);
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.68,
        metalness: 0.0,
        emissive: warmSubsurface,
        emissiveIntensity: 0.06,
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  hair(color: string, doubleSide = false): THREE.MeshStandardMaterial {
    const key = `hair:${color}:${doubleSide ? 1 : 0}`;
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      const bump = this.getHairBump();
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.48,
        metalness: 0.04,
        emissive: color,
        emissiveIntensity: 0.03,
        ...(bump ? { bumpMap: bump, bumpScale: 0.0025 } : {}),
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  fabric(color: string, doubleSide = false, roughness = 0.84): THREE.MeshStandardMaterial {
    const key = `fabric:${color}:${doubleSide ? 1 : 0}:${roughness}`;
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      const bump = this.getFabricBump();
      material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: 0.02,
        ...(bump && roughness >= 0.55 ? { bumpMap: bump, bumpScale: 0.0032 } : {}),
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  knit(color: string, doubleSide = false): THREE.MeshStandardMaterial {
    const key = `knit:${color}:${doubleSide ? 1 : 0}`;
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      const bump = this.getRibBump();
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
        metalness: 0.01,
        ...(bump ? { bumpMap: bump, bumpScale: 0.0042 } : {}),
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  metal(color: string, roughness = 0.24, metalness = 0.82): THREE.MeshStandardMaterial {
    const key = `metal:${color}:${roughness}:${metalness}`;
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  glass(color: string, opacity = 0.32): THREE.MeshStandardMaterial {
    const key = `glass:${color}:${opacity}`;
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.12,
        metalness: 0.16,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  led(color: string, opacity = 1, intensity = 0.9): THREE.MeshStandardMaterial {
    const key = `led:${color}:${opacity}:${intensity}`;
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 0.25,
        metalness: 0.08,
        transparent: opacity < 1,
        opacity,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  eyeSclera(): THREE.MeshStandardMaterial {
    const key = "eye:sclera";
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: "#fbfaf7",
        roughness: 0.22,
        metalness: 0.0,
        emissive: "#fffbf5",
        emissiveIntensity: 0.06,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  eyeIris(color: string): THREE.MeshStandardMaterial {
    const key = `eye:iris:${color}`;
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.18,
        metalness: 0.04,
        emissive: color,
        emissiveIntensity: 0.12,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  eyePupil(): THREE.MeshStandardMaterial {
    const key = "eye:pupil";
    let material = this.cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: "#090b10",
        roughness: 0.14,
        metalness: 0.04,
      });
      this.cache.set(key, material);
    }
    return material;
  }

  // Backward-compatible studio aliases using refined MeshStandardMaterial
  skinToon(color: string): THREE.MeshStandardMaterial {
    return this.skin(color);
  }

  hairToon(color: string, doubleSide = false): THREE.MeshStandardMaterial {
    return this.hair(color, doubleSide);
  }

  toon(color: string): THREE.MeshStandardMaterial {
    return this.fabric(color, false, 0.72);
  }

  toonDouble(color: string): THREE.MeshStandardMaterial {
    return this.fabric(color, true, 0.72);
  }

  glow(color: string, opacity = 1): THREE.MeshStandardMaterial {
    return this.led(color, opacity, 0.85);
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
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

export function group(name: string, position: [number, number, number] = [0, 0, 0]): THREE.Group {
  const result = new THREE.Group();
  result.name = name;
  result.position.set(...position);
  return result;
}
