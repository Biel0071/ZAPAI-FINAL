import * as THREE from "three";

import type { Expression3D } from "./look3d";

export type BlinkFrame = "open" | "closed";
export type MouthFrame = "rest" | "open";

export type FaceTextureSpec = {
  expression: Expression3D;
  female: boolean;
  iris: string;
  brow: string;
  blush: string;
  hideEyes?: boolean;
  includeBrows?: boolean;
  blinkFrame?: BlinkFrame;
  mouthFrame?: MouthFrame;
};

const SIZE = 1024;
// Balanced commercial chibi eye & feature placement within the front facial patch
const LEFT_EYE_X = 308;
const RIGHT_EYE_X = 716;
const EYE_Y = 468;

function mixHex(hex: string, target: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(target), amount);
  return `#${c.getHexString()}`;
}

function drawEye(ctx: CanvasRenderingContext2D, cx: number, spec: FaceTextureSpec) {
  const cy = EYE_Y;
  const isLeft = cx < SIZE / 2;
  const dir = isLeft ? -1 : 1;

  // Almond-oval stylized proportion (expressive scale for full-body & portrait clarity)
  const rx = 98;
  const ry = spec.female ? 114 : 100;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, dir * 0.04, 0, Math.PI * 2);
  ctx.clip();

  // Warm natural sclera
  ctx.fillStyle = "#faf8f4";
  ctx.fillRect(cx - rx - 8, cy - ry - 8, rx * 2 + 16, ry * 2 + 16);

  // Subtle top upper-lid cast shadow across sclera & iris
  const topShadow = ctx.createLinearGradient(0, cy - ry, 0, cy + 20);
  topShadow.addColorStop(0, "rgba(18, 22, 36, 0.24)");
  topShadow.addColorStop(1, "rgba(18, 22, 36, 0)");
  ctx.fillStyle = topShadow;
  ctx.fillRect(cx - rx - 4, cy - ry - 4, rx * 2 + 8, ry + 24);

  // Centered symmetrical iris + limbal ring
  const ix = cx - dir * 3;
  const iy = cy + 5;
  const irx = 72;
  const iry = spec.female ? 88 : 78;

  // Outer limbal ring for crisp commercial depth
  ctx.fillStyle = mixHex(spec.iris, "#090b10", 0.72);
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx + 5, iry + 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Layered iris gradient
  const irisGrad = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
  irisGrad.addColorStop(0, mixHex(spec.iris, "#0f172a", 0.58));
  irisGrad.addColorStop(0.45, spec.iris);
  irisGrad.addColorStop(1, mixHex(spec.iris, "#fef08a", 0.36));

  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft lower iris reflected glow
  ctx.strokeStyle = mixHex(spec.iris, "#fef3c7", 0.58);
  ctx.globalAlpha = 0.58;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(ix, iy + 22, 42, Math.PI * 0.16, Math.PI * 0.84);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Deep aligned pupil
  ctx.fillStyle = "#0b0d14";
  ctx.beginPath();
  ctx.ellipse(ix, iy, 31, spec.female ? 38 : 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dual specular studio catchlights (aligned identically between left & right eyes!)
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(ix - 21, iy - 26, 19, 22, -0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.ellipse(ix + 19, iy + 24, 9, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();

  // Upper lash line ONLY (no dark bottom circle ring — avoids "fake glasses" silhouette!)
  ctx.strokeStyle = "#221612";
  ctx.lineCap = "round";
  ctx.lineWidth = spec.female ? 16 : 12.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, rx + 2, ry - 2, dir * 0.04, Math.PI * 1.09, Math.PI * 1.91);
  ctx.stroke();

  if (spec.female) {
    const outerX = cx + dir * (rx + 1);
    const outerY = cy - 20;
    ctx.lineWidth = 9.5;
    ctx.beginPath();
    ctx.moveTo(outerX - dir * 9, outerY);
    ctx.quadraticCurveTo(outerX + dir * 12, outerY - 6, outerX + dir * 20, outerY - 17);
    ctx.stroke();
  }

  // Subtle eyelid fold & delicate bottom shadow
  ctx.strokeStyle = "rgba(138, 75, 44, 0.34)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 12, rx * 0.78, ry * 0.92, 0, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();

  ctx.strokeStyle = "rgba(138, 75, 44, 0.22)";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, rx * 0.68, ry * 0.9, 0, Math.PI * 0.24, Math.PI * 0.76);
  ctx.stroke();
}

function closedHappyEye(ctx: CanvasRenderingContext2D, cx: number, spec: FaceTextureSpec) {
  const cy = EYE_Y + 10;
  const dir = cx < SIZE / 2 ? -1 : 1;
  ctx.strokeStyle = "#221612";
  ctx.lineWidth = spec.female ? 15 : 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 76, cy + 12);
  ctx.quadraticCurveTo(cx, cy - 40, cx + 76, cy + 12);
  ctx.stroke();

  if (spec.female) {
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 72, cy + 7);
    ctx.lineTo(cx + dir * 88, cy - 10);
    ctx.stroke();
  }
}

function drawBrows(ctx: CanvasRenderingContext2D, spec: FaceTextureSpec) {
  ctx.strokeStyle = spec.brow;
  ctx.lineWidth = spec.female ? 11 : 15;
  ctx.lineCap = "round";
  const tilt = spec.expression === "focused" ? 11 : spec.expression === "confident" ? -8 : 0;
  for (const [x, dir] of [[LEFT_EYE_X, -1], [RIGHT_EYE_X, 1]] as const) {
    const outerLift = spec.expression === "confident" && dir > 0 ? -12 : 0;
    ctx.beginPath();
    ctx.moveTo(x - 54, 376 + (dir < 0 ? tilt : -tilt));
    ctx.quadraticCurveTo(x, 352 + outerLift, x + 54, 376 + (dir > 0 ? tilt + outerLift : -tilt));
    ctx.stroke();
  }
}

function drawBlush(ctx: CanvasRenderingContext2D, color: string, female: boolean) {
  const alpha = female ? 0.44 : 0.18;
  for (const cx of [242, 782]) {
    const cy = 608;
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 92);
    const c = new THREE.Color(color);
    const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    grad.addColorStop(0.55, `rgba(${rgb}, ${alpha * 0.42})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.28, 0.58);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, spec: FaceTextureSpec) {
  const my = 748;
  const openMouth =
    spec.mouthFrame === "open" || spec.expression === "open_smile" || spec.expression === "wink";

  ctx.strokeStyle = spec.female ? "#9f3943" : "#7c423b";
  ctx.lineWidth = spec.female ? 9.5 : 8.5;
  ctx.lineCap = "round";

  if (openMouth) {
    ctx.fillStyle = "#881b2f";
    ctx.beginPath();
    ctx.moveTo(458, my - 4);
    ctx.quadraticCurveTo(512, my + 60, 566, my - 4);
    ctx.quadraticCurveTo(512, my + 9, 458, my - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Soft upper teeth gleam & warm tongue
    ctx.fillStyle = "#fff8f5";
    ctx.beginPath();
    ctx.moveTo(469, my + 1);
    ctx.quadraticCurveTo(512, my + 13, 555, my + 1);
    ctx.quadraticCurveTo(512, my + 6, 469, my + 1);
    ctx.fill();

    ctx.fillStyle = "#e16278";
    ctx.beginPath();
    ctx.ellipse(512, my + 26, 23, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (spec.expression === "confident") {
    ctx.beginPath();
    ctx.moveTo(464, my + 5);
    ctx.quadraticCurveTo(518, my + 24, 562, my - 7);
    ctx.stroke();
    return;
  }

  const curve = spec.expression === "focused" ? 10 : spec.expression === "calm" ? 18 : 30;
  ctx.beginPath();
  ctx.moveTo(458, my);
  ctx.quadraticCurveTo(512, my + curve, 566, my);
  ctx.stroke();

  if (spec.female) {
    ctx.fillStyle = "rgba(216, 112, 124, 0.4)";
    ctx.beginPath();
    ctx.ellipse(512, my + curve * 0.62, 30, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createFaceTexture(spec: FaceTextureSpec): THREE.CanvasTexture | null {
  if (typeof document === "undefined" || (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent))) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  if (spec.includeBrows !== false) {
    drawBrows(ctx, spec);
  }
  if (!spec.hideEyes) {
    if (spec.blinkFrame === "closed") {
      closedHappyEye(ctx, LEFT_EYE_X, spec);
      closedHappyEye(ctx, RIGHT_EYE_X, spec);
    } else {
      drawEye(ctx, LEFT_EYE_X, spec);
      if (spec.expression === "wink") closedHappyEye(ctx, RIGHT_EYE_X, spec);
      else drawEye(ctx, RIGHT_EYE_X, spec);
    }
  }
  drawBlush(ctx, spec.blush, spec.female);
  drawMouth(ctx, spec);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
