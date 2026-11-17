import * as THREE from "three";

import type { Expression3D } from "./look3d";

type FaceSpec = { expression: Expression3D; female: boolean; iris: string; brow: string; blush: string; hideEyes: boolean };

const SIZE = 512;

function eye(ctx: CanvasRenderingContext2D, cx: number, spec: FaceSpec) {
  const cy = 250;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 66, 82, 0, 0, Math.PI * 2);
  ctx.fill();
  const iris = ctx.createLinearGradient(0, cy - 50, 0, cy + 50);
  iris.addColorStop(0, "#120a08");
  iris.addColorStop(1, spec.iris);
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 60, 76, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0c0a09";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 30, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx - 20, cy - 26, 15, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 20, cy + 30, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1c1917";
  ctx.lineCap = "round";
  ctx.lineWidth = spec.female ? 11 : 8;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 68, 84, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  if (spec.female) {
    const dir = cx < SIZE / 2 ? -1 : 1;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx + 52 * dir, cy - 40);
    ctx.lineTo(cx + 74 * dir, cy - 60);
    ctx.stroke();
  }
}

function closedEye(ctx: CanvasRenderingContext2D, cx: number) {
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 52, 262);
  ctx.quadraticCurveTo(cx, 212, cx + 52, 262);
  ctx.stroke();
}

function brows(ctx: CanvasRenderingContext2D, spec: FaceSpec) {
  ctx.strokeStyle = spec.brow;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  const lift = spec.expression === "confident" || spec.expression === "focused" ? 10 : 0;
  for (const [x, dir] of [[156, -1], [356, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 40, 150 + (dir < 0 ? lift : 0));
    ctx.quadraticCurveTo(x, 132, x + 40, 150 + (dir > 0 ? lift : 0));
    ctx.stroke();
  }
}

function mouth(ctx: CanvasRenderingContext2D, expression: Expression3D) {
  ctx.strokeStyle = "#7f1d1d";
  ctx.fillStyle = "#b91c1c";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  if (expression === "open_smile" || expression === "wink") {
    ctx.beginPath();
    ctx.moveTo(226, 366);
    ctx.quadraticCurveTo(256, 410, 286, 366);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.ellipse(256, 388, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const curve = expression === "focused" ? 4 : expression === "calm" ? 12 : 22;
  ctx.beginPath();
  ctx.moveTo(230, 370);
  ctx.quadraticCurveTo(256, 370 + curve, 282, 370);
  ctx.stroke();
}

function blush(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45;
  for (const x of [118, 394]) {
    ctx.beginPath();
    ctx.ellipse(x, 330, 40, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  for (const x of [118, 394]) {
    for (const dx of [-14, 0, 14]) {
      ctx.beginPath();
      ctx.moveTo(x + dx - 4, 338);
      ctx.lineTo(x + dx + 4, 322);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function createFaceTexture(spec: FaceSpec): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  brows(ctx, spec);
  if (!spec.hideEyes) {
    eye(ctx, 156, spec);
    if (spec.expression === "wink") closedEye(ctx, 356);
    else eye(ctx, 356, spec);
  }
  blush(ctx, spec.blush);
  ctx.fillStyle = "#c2410c";
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(256, 318, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  mouth(ctx, spec.expression);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}