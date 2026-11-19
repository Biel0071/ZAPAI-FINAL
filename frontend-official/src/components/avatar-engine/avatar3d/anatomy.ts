import * as THREE from "three";

// Stylized Commercial Chibi Proportions (~3.35–3.5 heads tall, harmonious volume)
export const HEAD_RADIUS = 0.248;
export const HEAD_CENTER_Y = 0.21;

export const ANKLE_Y = 0.066;
export const SHIN_LENGTH = 0.24;
export const THIGH_LENGTH = 0.248;
export const HIP_Y = ANKLE_Y + SHIN_LENGTH + THIGH_LENGTH; // 0.554
export const HIP_X = 0.088;

export const PELVIS_Y = HIP_Y; // 0.554
export const SPINE_LOCAL_Y = 0.062;
export const CHEST_LOCAL_Y = 0.15;
export const NECK_LOCAL_Y = 0.225;
export const HEAD_LOCAL_Y = 0.066;

export const NECK_Y = PELVIS_Y + SPINE_LOCAL_Y + CHEST_LOCAL_Y + NECK_LOCAL_Y; // ~0.991
export const SHOULDER_LOCAL_Y = 0.205;
export const SHOULDER_Y = PELVIS_Y + SPINE_LOCAL_Y + CHEST_LOCAL_Y + SHOULDER_LOCAL_Y; // ~0.971
export const SHOULDER_X = 0.172;

export const CLAVICLE_LEN = 0.062;
export const UPPER_ARM_LENGTH = 0.198;
export const FOREARM_LENGTH = 0.178;
export const ARM_LENGTH = UPPER_ARM_LENGTH + FOREARM_LENGTH;
export const LEG_LENGTH = THIGH_LENGTH + SHIN_LENGTH;

export const SHOE_SOLE_HEIGHT = 0.036;
export const SHOE_SOLE_LOCAL_Y = -ANKLE_Y + SHOE_SOLE_HEIGHT / 2;

export interface HumanoidDimensions {
  shoulderHalfWidth: number;
  chestRadiusX: number;
  chestRadiusZ: number;
  waistRadiusX: number;
  waistRadiusZ: number;
  hipRadiusX: number;
  hipRadiusZ: number;
  hipX: number;
  clavicleSpan: number;
  upperArmRadius: number;
  forearmRadius: number;
  thighRadius: number;
  shinRadius: number;
  neckRadius: number;
  headScale: number;
}

export function getHumanoidDimensions(female: boolean): HumanoidDimensions {
  if (female) {
    return {
      shoulderHalfWidth: 0.158,
      chestRadiusX: 0.144,
      chestRadiusZ: 0.11,
      waistRadiusX: 0.122,
      waistRadiusZ: 0.095,
      hipRadiusX: 0.156,
      hipRadiusZ: 0.12,
      hipX: 0.086,
      clavicleSpan: 0.056,
      upperArmRadius: 0.047,
      forearmRadius: 0.041,
      thighRadius: 0.074,
      shinRadius: 0.058,
      neckRadius: 0.052,
      headScale: 1.0,
    };
  }
  return {
    shoulderHalfWidth: 0.184,
    chestRadiusX: 0.166,
    chestRadiusZ: 0.12,
    waistRadiusX: 0.144,
    waistRadiusZ: 0.106,
    hipRadiusX: 0.156,
    hipRadiusZ: 0.116,
    hipX: 0.092,
    clavicleSpan: 0.064,
    upperArmRadius: 0.054,
    forearmRadius: 0.046,
    thighRadius: 0.078,
    shinRadius: 0.062,
    neckRadius: 0.058,
    headScale: 1.01,
  };
}

/**
 * Evaluates a point in head-local coordinates from a unit-sphere direction (ux, uy, uz)
 * with smooth rounded chibi cheeks and a gentle U-shaped jawline (zero triangular taper).
 */
export function evalSculptedHeadLocal(
  ux: number,
  uy: number,
  uz: number,
  female: boolean,
): THREE.Vector3 {
  const r = HEAD_RADIUS;
  // Base slightly wider rounded cranium ratio with compact chibi lower jaw
  let x = ux * r * (female ? 1.045 : 1.055);
  let y = uy * r * (uy < 0 ? 0.87 : 0.95);
  let z = uz * r * 0.96;

  // Soft chibi cheek roundness around lower-mid face
  const cheekBand = Math.exp(-Math.pow((uy + 0.2) / 0.34, 2));
  x *= 1 + cheekBand * (female ? 0.048 : 0.036);

  if (uz > 0.15) {
    // Gentle forward cheek plumpness
    const apple = cheekBand * Math.exp(-Math.pow((Math.abs(ux) - 0.44) / 0.3, 2));
    z += apple * 0.011;
    // Slight temple & brow-ridge smoothing on the male silhouette
    if (!female && uy > 0.05 && uy < 0.35 && uz > 0.65) {
      z += 0.004 * Math.exp(-Math.pow(ux / 0.45, 2));
    }
  }

  // Smooth U-shaped lower jawline (quadratic ease, never triangular)
  if (uy < -0.24) {
    const t = Math.min(1, (-uy - 0.24) / 0.76);
    const smoothJaw = 1 - (female ? 0.13 : 0.09) * t * t;
    x *= smoothJaw;
    if (uz > 0) {
      const chinFill = Math.exp(-Math.pow(ux / 0.52, 2));
      z += t * (1 - t * 0.4) * 0.006 * chinFill;
    }
  }

  return new THREE.Vector3(x, HEAD_CENTER_Y + y, z);
}
