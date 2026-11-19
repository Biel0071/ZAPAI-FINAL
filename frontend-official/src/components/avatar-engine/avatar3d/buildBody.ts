import * as THREE from "three";
import type { AvatarLook3D } from "./look3d";
import { MaterialKit, group, mesh } from "./materials";
import {
  evalSculptedHeadLocal,
  FOREARM_LENGTH,
  getHumanoidDimensions,
  HEAD_CENTER_Y,
  HEAD_RADIUS,
  SHIN_LENGTH,
  SHOE_SOLE_HEIGHT,
  SHOE_SOLE_LOCAL_Y,
  THIGH_LENGTH,
  UPPER_ARM_LENGTH,
} from "./anatomy";
import {
  clearMountGroup,
  createHumanoidSkeleton,
  type ArticulatedHand,
  type FaceRigControls,
  type HumanoidSkeleton,
  type SlotMounts,
} from "./humanoidRig";
import { createFaceTexture } from "./faceTexture";

export type ChibiRig = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftHand: THREE.Object3D;
  rightHand: THREE.Object3D;
  peace: THREE.Object3D;
  skeleton: HumanoidSkeleton;
  mounts: SlotMounts;
  faceControls: FaceRigControls;
  leftHandControls: ArticulatedHand;
  rightHandControls: ArticulatedHand;
};

/** Reconstructs the head sphere onto the rounded commercial chibi surface (`evalSculptedHeadLocal`). */
function sculptHumanoidHeadGeometry(female: boolean): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(HEAD_RADIUS, 48, 36);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const target = evalSculptedHeadLocal(x / len, y / len, z / len, female);
    // Offset relative to HEAD_CENTER_Y because head mesh itself is placed at [0, HEAD_CENTER_Y, 0]
    pos.setXYZ(i, target.x, target.y - HEAD_CENTER_Y, target.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Curvilinear frontal decal geometry hugging the exact sculpted face surface without floating or Z-fighting. */
function buildConformalFacePatchGeometry(female: boolean): THREE.BufferGeometry {
  const segU = 30;
  const segV = 26;
  const azMin = -0.72;
  const azMax = 0.72;
  const elMin = -0.82;
  const elMax = 0.3;
  const offset = 0.0024;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= segV; j += 1) {
    const vFrac = j / segV;
    const el = elMin + (elMax - elMin) * vFrac;
    const cosEl = Math.cos(el);
    const sinEl = Math.sin(el);

    for (let i = 0; i <= segU; i += 1) {
      const uFrac = i / segU;
      const az = azMin + (azMax - azMin) * uFrac;
      const ux = cosEl * Math.sin(az);
      const uy = sinEl;
      const uz = cosEl * Math.cos(az);

      const p = evalSculptedHeadLocal(ux, uy, uz, female);
      // Offset along outward normal approx (ux, uy, uz)
      positions.push(p.x + ux * offset, p.y + uy * offset, p.z + uz * offset);
      uvs.push(uFrac, vFrac);
    }
  }

  const stride = segU + 1;
  for (let j = 0; j < segV; j += 1) {
    for (let i = 0; i < segU; i += 1) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Smooth continuous anatomical torso core bridging hip -> waist -> chest -> trapezius neck collar. */
function buildTorsoCore(female: boolean, kit: MaterialKit, look: AvatarLook3D): THREE.Group {
  const dims = getHumanoidDimensions(female);
  const torso = group("torso-core");

  const profile = [
    new THREE.Vector2(0.01, -0.175),
    new THREE.Vector2(dims.hipRadiusX * 0.88, -0.155),
    new THREE.Vector2(dims.waistRadiusX * 0.99, -0.055),
    new THREE.Vector2(dims.waistRadiusX * 1.03, 0.025),
    new THREE.Vector2(dims.chestRadiusX * 0.98, 0.12),
    new THREE.Vector2(dims.chestRadiusX * 1.01, 0.165),
    new THREE.Vector2(dims.shoulderHalfWidth * 0.86, 0.21),
    new THREE.Vector2(dims.neckRadius * 1.24, 0.238),
    new THREE.Vector2(0.01, 0.246),
  ];
  const geo = new THREE.LatheGeometry(profile, 36);
  const zRatio = dims.chestRadiusZ / dims.chestRadiusX;
  geo.scale(1, 1, zRatio);
  geo.computeVertexNormals();

  const torsoMat = kit.fabric(
    look.outfit.kind === "vest" ? look.outfit.inner || look.outfit.body : look.outfit.body,
    false,
    0.8,
  );
  torso.add(mesh(geo, torsoMat, "torso", [0, 0, 0]));

  if (female) {
    const bustGeo = new THREE.SphereGeometry(0.058, 18, 14);
    bustGeo.scale(1.14, 0.9, 0.72);
    for (const side of [-1, 1]) {
      torso.add(mesh(bustGeo.clone(), torsoMat, `torso-bust-${side}`, [0.052 * side, 0.125, 0.056]));
    }
    bustGeo.dispose();
  }

  return torso;
}

/** Anatomical contoured hand with rounded metacarpal palm, thenar pad, articulated thumb & tapered fingers (NO boxes). */
function buildArticulatedHand(side: number, skinColor: string, kit: MaterialKit): {
  handGroup: THREE.Group;
  controls: ArticulatedHand;
} {
  const handGroup = group(side < 0 ? "hand-left" : "hand-right");
  const skinMat = kit.skin(skinColor);

  // Rounded cushioned palm instead of a sharp BoxGeometry block
  const palmGeo = new THREE.SphereGeometry(0.027, 16, 12);
  palmGeo.scale(0.92, 1.04, 0.56);
  const palm = mesh(palmGeo, skinMat, "hand-palm", [0, -0.022, 0]);
  handGroup.add(palm);

  // Wrist & thenar heel cushion
  handGroup.add(
    mesh(new THREE.SphereGeometry(0.019, 12, 10), skinMat, "hand-wrist-cap", [0, -0.002, 0], [1.0, 0.78, 0.76]),
  );

  // Thumb pivot resting cleanly on inner/anterior palm pad
  const thumb = group("hand-thumb", [-0.021 * side, -0.017, 0.007]);
  thumb.add(mesh(new THREE.CapsuleGeometry(0.0068, 0.019, 5, 10), skinMat, "thumb-seg", [0, -0.012, 0]));
  handGroup.add(thumb);

  const makeFinger = (name: string, xOffset: number, len: number) => {
    const pivot = group(name, [xOffset * side, -0.044, 0]);
    const prox = mesh(new THREE.CapsuleGeometry(0.0056, len * 0.48, 5, 10), skinMat, `${name}-prox`, [0, -len * 0.27, 0]);
    const dist = mesh(
      new THREE.CapsuleGeometry(0.0046, len * 0.4, 5, 10),
      skinMat,
      `${name}-dist`,
      [0, -len * 0.66, 0.0025],
      undefined,
      [0.2, 0, 0],
    );
    pivot.add(prox, dist);
    handGroup.add(pivot);
    return pivot;
  };

  const indexFinger = makeFinger("finger-index", -0.014, 0.036);
  const middleFinger = makeFinger("finger-middle", -0.0045, 0.039);
  const ringFinger = makeFinger("finger-ring", 0.0055, 0.036);
  const pinkyFinger = makeFinger("finger-pinky", 0.0145, 0.03);

  const setPose = (mode: "rest" | "hold" | "peace", peaceFactor = 0) => {
    if (mode === "peace" || peaceFactor > 0.05) {
      const p = mode === "peace" ? Math.max(peaceFactor, 1) : peaceFactor;
      const restCurl = 0.24 * (1 - p);
      indexFinger.rotation.set(-0.08 * (1 - p), 0, -0.24 * p * side);
      middleFinger.rotation.set(-0.08 * (1 - p), 0, 0.24 * p * side);
      ringFinger.rotation.set(restCurl + 1.38 * p, 0, 0);
      pinkyFinger.rotation.set(restCurl + 1.45 * p, 0, 0);
      thumb.rotation.set(0.58 * p, 0, 0.35 * side * (1 - p) - 0.64 * side * p);
      return;
    }

    if (mode === "hold") {
      indexFinger.rotation.set(0.75, 0, 0);
      middleFinger.rotation.set(0.82, 0, 0);
      ringFinger.rotation.set(0.85, 0, 0);
      pinkyFinger.rotation.set(0.82, 0, 0);
      thumb.rotation.set(0.36, 0, -0.34 * side);
      return;
    }

    indexFinger.rotation.set(0.24, 0, 0);
    middleFinger.rotation.set(0.3, 0, 0);
    ringFinger.rotation.set(0.36, 0, 0);
    pinkyFinger.rotation.set(0.4, 0, 0);
    thumb.rotation.set(0.16, 0, 0.32 * side);
  };

  setPose("rest", 0);
  return {
    handGroup,
    controls: { palm, thumb, indexFinger, middleFinger, ringFinger, pinkyFinger, setPose },
  };
}

/** Delicate sculpted button nose & ear pinna positioned on the exact chibi head surface. */
function buildSculptedNoseAndEars(head: THREE.Group, look: AvatarLook3D, kit: MaterialKit): void {
  const skinMat = kit.skin(look.skin);
  const shadowSkinMat = kit.skin(look.skinShadow);

  // Subtle single chibi nose seated cleanly below eye line
  const noseBase = evalSculptedHeadLocal(0, -0.36, Math.sqrt(1 - 0.36 * 0.36), look.female);
  const nose = group("head-nose", [noseBase.x, noseBase.y, noseBase.z - 0.002]);
  const noseGeo = new THREE.SphereGeometry(0.0155, 16, 12);
  noseGeo.scale(1.02, 0.88, 1.08);
  nose.add(mesh(noseGeo, skinMat, "nose-tip", [0, 0, 0.008]));
  head.add(nose);

  // Rounded C-shaped ears flush against sides of head at eye level
  for (const side of [-1, 1]) {
    const ux = 0.97 * side;
    const uy = -0.2;
    const uz = -0.16;
    const len = Math.hypot(ux, uy, uz);
    const earPos = evalSculptedHeadLocal(ux / len, uy / len, uz / len, look.female);
    const ear = group(`ear-${side}`, [earPos.x - 0.004 * side, earPos.y, earPos.z]);
    ear.rotation.y = 0.24 * side;
    ear.add(
      mesh(new THREE.SphereGeometry(0.032, 16, 14), skinMat, `ear-pinna-${side}`, [0, 0, 0], [0.48, 1.08, 0.78]),
      mesh(new THREE.SphereGeometry(0.02, 12, 10), shadowSkinMat, `ear-concha-${side}`, [0.006 * side, -0.001, 0.004], [0.36, 0.78, 0.52]),
    );
    head.add(ear);
  }
}

function build3DFacialHair(look: AvatarLook3D, kit: MaterialKit): THREE.Group | null {
  if (look.facialHair === "none") return null;
  const beard = group("facial-hair");
  const beardMat = kit.hair(look.hairColor);
  const browZ = (ux: number, uy: number) => {
    const uz = Math.sqrt(Math.max(0.04, 1 - ux * ux - uy * uy));
    return evalSculptedHeadLocal(ux, uy, uz, look.female);
  };

  if (look.facialHair === "stubble") {
    const chinLeft = browZ(-0.42, -0.52);
    const chinBot = browZ(0, -0.74);
    const chinRight = browZ(0.42, -0.52);
    const curve = new THREE.CatmullRomCurve3([chinLeft, chinBot, chinRight]);
    beard.add(mesh(new THREE.TubeGeometry(curve, 18, 0.015, 8, false), kit.fabric(look.hairColor, true, 0.92), "beard-stubble"));
    return beard;
  }

  if (look.facialHair === "goatee") {
    const lipTop = browZ(0, -0.44);
    const chinBot = browZ(0, -0.74);
    beard.add(
      mesh(new THREE.CapsuleGeometry(0.009, 0.056, 4, 10), beardMat, "beard-mustache", [0, lipTop.y, lipTop.z + 0.005], [1, 1, 0.65], [0, 0, Math.PI / 2]),
      mesh(new THREE.SphereGeometry(0.032, 14, 10), beardMat, "beard-chin", [0, chinBot.y, chinBot.z + 0.002], [1.05, 1.1, 0.68]),
    );
    return beard;
  }

  const fullness = look.facialHair === "full_beard" ? 1.0 : 0.74;
  const jawCurve = new THREE.CatmullRomCurve3([
    browZ(-0.62, -0.3),
    browZ(-0.44, -0.58),
    browZ(0, -0.74),
    browZ(0.44, -0.58),
    browZ(0.62, -0.3),
  ]);
  const lipTop = browZ(0, -0.44);
  const chinBot = browZ(0, -0.74);
  beard.add(
    mesh(new THREE.TubeGeometry(jawCurve, 24, 0.022 * fullness, 10, false), beardMat, "beard-jaw"),
    mesh(new THREE.CapsuleGeometry(0.01 * fullness, 0.062, 4, 10), beardMat, "beard-mustache", [0, lipTop.y, lipTop.z + 0.006], [1, 1, 0.7], [0, 0, Math.PI / 2]),
  );
  if (look.facialHair === "full_beard") {
    beard.add(mesh(new THREE.SphereGeometry(0.048, 16, 12), beardMat, "beard-chin-full", [0, chinBot.y + 0.008, chinBot.z - 0.004], [1.22, 1.02, 0.74]));
  }
  return beard;
}

export function buildFaceSlot(
  look: AvatarLook3D,
  kit: MaterialKit,
  targetMount: THREE.Group,
): FaceRigControls {
  clearMountGroup(targetMount);
  const face = group("face");
  const browMat = kit.hair(look.hairColor);

  // Build conformal surface textures for open / blink / talk states
  const openTex = createFaceTexture({
    expression: look.expression,
    female: look.female,
    iris: look.iris,
    brow: look.hairColor,
    blush: look.blush,
    includeBrows: false,
    blinkFrame: "open",
    mouthFrame: "rest",
  });

  let closedTex: THREE.CanvasTexture | null = null;
  let talkTex: THREE.CanvasTexture | null = null;
  let faceDecalMat: THREE.MeshStandardMaterial | null = null;

  if (openTex) {
    closedTex = createFaceTexture({
      expression: look.expression,
      female: look.female,
      iris: look.iris,
      brow: look.hairColor,
      blush: look.blush,
      includeBrows: false,
      blinkFrame: "closed",
      mouthFrame: "rest",
    });
    talkTex = createFaceTexture({
      expression: look.expression,
      female: look.female,
      iris: look.iris,
      brow: look.hairColor,
      blush: look.blush,
      includeBrows: false,
      blinkFrame: "open",
      mouthFrame: "open",
    });
    kit.track(openTex);
    if (closedTex) kit.track(closedTex);
    if (talkTex) kit.track(talkTex);

    faceDecalMat = new THREE.MeshStandardMaterial({
      map: openTex,
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.42,
      metalness: 0.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    faceDecalMat.userData.ownedMaterial = true;
    const decalMesh = mesh(buildConformalFacePatchGeometry(look.female), faceDecalMat, "face-decal-shell");
    decalMesh.castShadow = false;
    decalMesh.receiveShadow = false;
    face.add(decalMesh);
  }

  // Symmetrical sleek 3D curved eyebrows contoured right along the sculpted forehead
  const surfacePoint = (ux: number, uy: number, radialPush = 0.005) => {
    const uz = Math.sqrt(Math.max(0.05, 1 - ux * ux - uy * uy));
    const pt = evalSculptedHeadLocal(ux, uy, uz, look.female);
    pt.x += ux * radialPush;
    pt.y += uy * radialPush;
    pt.z += uz * radialPush;
    return pt;
  };

  const buildBrow = (side: number) => {
    const pStart = surfacePoint(0.14 * side, -0.005);
    const pMid = surfacePoint(0.28 * side, 0.024);
    const pEnd = surfacePoint(0.42 * side, -0.012);
    const centerPos = pMid.clone();
    const brow = group(side < 0 ? "eyebrow-left" : "eyebrow-right", [centerPos.x, centerPos.y, centerPos.z]);
    const localCurve = new THREE.CatmullRomCurve3([
      pStart.clone().sub(centerPos),
      new THREE.Vector3(0, 0, 0),
      pEnd.clone().sub(centerPos),
    ]);
    brow.add(
      mesh(
        new THREE.TubeGeometry(localCurve, 12, look.female ? 0.0055 : 0.0078, 8, false),
        browMat,
        `brow-mesh-${side}`,
      ),
    );
    face.add(brow);
    return { brow, baseY: centerPos.y };
  };

  const leftBrowObj = buildBrow(-1);
  const rightBrowObj = buildBrow(1);

  // Subtle semantic fallback eye/lid/lip nodes (only visible when canvas texture is unavailable in jsdom)
  const makeHiddenFallbackGroup = (side: number) => {
    const eyeGroup = group(side < 0 ? "eye-left" : "eye-right", [0.068 * side, HEAD_CENTER_Y + 0.004, HEAD_RADIUS * 0.9]);
    const lidMat = kit.skin(look.skinShadow);
    const upperLid = mesh(new THREE.SphereGeometry(0.022, 8, 6), lidMat, `upper-eyelid-${side}`);
    const lowerLid = mesh(new THREE.SphereGeometry(0.02, 8, 6), lidMat, `lower-eyelid-${side}`);
    eyeGroup.visible = !openTex;
    if (!openTex) {
      const sclera = mesh(new THREE.SphereGeometry(0.024, 12, 10), kit.eyeSclera(), `eyeball-${side}`, [0, 0, 0], [1, 1.05, 0.55]);
      const iris = mesh(new THREE.SphereGeometry(0.015, 12, 10), kit.eyeIris(look.iris), `iris-${side}`, [0, 0, 0.009], [1, 1.08, 0.45]);
      const pupil = mesh(new THREE.SphereGeometry(0.007, 10, 8), kit.eyePupil(), `pupil-${side}`, [0, 0, 0.012], [1, 1.08, 0.4]);
      upperLid.visible = false;
      lowerLid.visible = false;
      eyeGroup.add(sclera, iris, pupil, upperLid, lowerLid);
    }
    face.add(eyeGroup);
    return { eyeGroup, upperLid, lowerLid };
  };

  const leftEye = makeHiddenFallbackGroup(-1);
  const rightEye = makeHiddenFallbackGroup(1);

  const lipColor = look.female ? "#c46b6b" : "#9d5b54";
  const lipMat = kit.skin(lipColor);
  const upperLip = mesh(new THREE.CapsuleGeometry(0.005, 0.028, 4, 8), lipMat, "upper-lip", [0, HEAD_CENTER_Y - 0.068, HEAD_RADIUS * 0.89], undefined, [0, 0, Math.PI / 2]);
  const lowerLip = mesh(new THREE.CapsuleGeometry(0.005, 0.024, 4, 8), lipMat, "lower-lip", [0, HEAD_CENTER_Y - 0.075, HEAD_RADIUS * 0.89], undefined, [0, 0, Math.PI / 2]);
  const mouthCavity = mesh(new THREE.SphereGeometry(0.014, 10, 8), kit.fabric("#5a1824"), "mouth-cavity", [0, HEAD_CENTER_Y - 0.072, HEAD_RADIUS * 0.88]);
  upperLip.visible = !openTex;
  lowerLip.visible = !openTex;
  mouthCavity.visible = false;
  face.add(upperLip, lowerLip, mouthCavity);

  const beard = build3DFacialHair(look, kit);
  if (beard) face.add(beard);

  targetMount.add(face);

  const baseExpr = (() => {
    switch (look.expression) {
      case "confident":
        return { browLift: 0.003, browTilt: -0.07, smile: 0.45, open: 0 };
      case "wink":
        return { browLift: 0.004, browTilt: 0.04, smile: 0.8, open: 0.2 };
      case "open_smile":
        return { browLift: 0.005, browTilt: 0.05, smile: 0.9, open: 0.45 };
      case "calm":
        return { browLift: 0, browTilt: 0, smile: 0.2, open: 0 };
      case "focused":
        return { browLift: -0.003, browTilt: 0.14, smile: 0.15, open: 0 };
      case "executive":
        return { browLift: 0.001, browTilt: -0.04, smile: 0.3, open: 0 };
      case "charismatic":
        return { browLift: 0.003, browTilt: -0.06, smile: 0.6, open: 0.1 };
      case "smile":
      default:
        return { browLift: 0.002, browTilt: 0.03, smile: 0.6, open: 0 };
    }
  })();

  let currentActiveMap: THREE.Texture | null = openTex;

  const setExpressionState: FaceRigControls["setExpressionState"] = ({
    blinkLeft,
    blinkRight,
    browLift,
    browTilt,
    mouthOpen,
  }) => {
    const isBlinking = Math.max(blinkLeft, blinkRight) > 0.45;
    const isSpeaking = baseExpr.open + mouthOpen > 0.32;

    if (faceDecalMat && openTex) {
      const nextMap = isBlinking && closedTex
        ? closedTex
        : isSpeaking && talkTex
        ? talkTex
        : openTex;
      if (nextMap !== currentActiveMap) {
        faceDecalMat.map = nextMap;
        faceDecalMat.needsUpdate = true;
        currentActiveMap = nextMap;
      }
    }

    const totalLift = baseExpr.browLift + browLift;
    const totalTilt = baseExpr.browTilt + browTilt;
    leftBrowObj.brow.position.y = leftBrowObj.baseY + totalLift;
    rightBrowObj.brow.position.y = rightBrowObj.baseY + totalLift + (look.expression === "confident" ? 0.004 : 0);
    leftBrowObj.brow.rotation.z = -totalTilt;
    rightBrowObj.brow.rotation.z = totalTilt;
  };

  setExpressionState({
    blinkLeft: 0,
    blinkRight: 0,
    browLift: 0,
    browTilt: 0,
    smile: 0,
    mouthOpen: 0,
  });

  return {
    leftEye: leftEye.eyeGroup,
    rightEye: rightEye.eyeGroup,
    leftUpperLid: leftEye.upperLid,
    rightUpperLid: rightEye.upperLid,
    leftLowerLid: leftEye.lowerLid,
    rightLowerLid: rightEye.lowerLid,
    leftBrow: leftBrowObj.brow,
    rightBrow: rightBrowObj.brow,
    upperLip,
    lowerLip,
    mouthCavity,
    setExpressionState,
  };
}

/** Tapered leg geometry from hip to knee and knee to ankle for cohesive lower-body silhouette. */
function makeLegSegmentGeo(topR: number, botR: number, length: number): THREE.BufferGeometry {
  const botExt = Math.min(botR * 0.4, 0.022);
  const topExt = Math.min(topR * 0.4, 0.022);
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.002, -botExt),
    new THREE.Vector2(botR * 0.72, -botExt * 0.55),
    new THREE.Vector2(botR, 0),
    new THREE.Vector2(topR * 0.94 + botR * 0.06, length * 0.52),
    new THREE.Vector2(topR, length),
    new THREE.Vector2(topR * 0.72, length + topExt * 0.55),
    new THREE.Vector2(0.002, length + topExt),
  ];
  const geo = new THREE.LatheGeometry(pts, 22);
  geo.translate(0, -length, 0);
  geo.computeVertexNormals();
  return geo;
}

export function buildLowerBodySlot(
  look: AvatarLook3D,
  kit: MaterialKit,
  mounts: SlotMounts,
): void {
  clearMountGroup(mounts.lower_body_slot);
  clearMountGroup(mounts.legs.leftThigh);
  clearMountGroup(mounts.legs.leftShin);
  clearMountGroup(mounts.legs.rightThigh);
  clearMountGroup(mounts.legs.rightShin);

  const dims = getHumanoidDimensions(look.female);
  const { lowerBody } = look;
  const pantMat = kit.fabric(lowerBody.color, false, 0.84);
  const accentMat = kit.fabric(lowerBody.accent, false, 0.68);

  // Pelvis waistband & contoured hip/crotch garment wrap (covers pelvis completely without hip/crotch skin leakage)
  const waistGeo = new THREE.CylinderGeometry(dims.waistRadiusX * 1.06, dims.hipRadiusX * 1.12, 0.168, 28);
  waistGeo.scale(1, 1, (dims.hipRadiusZ / dims.hipRadiusX) * 1.07);
  waistGeo.computeVertexNormals();
  mounts.lower_body_slot.add(mesh(waistGeo, pantMat, "lower-pelvis-wrap", [0, 0.006, 0]));
  mounts.lower_body_slot.add(
    mesh(
      new THREE.SphereGeometry(dims.hipRadiusX * 1.05, 22, 16),
      pantMat,
      "lower-pelvis-saddle",
      [0, -0.015, 0],
      [1, 0.82, (dims.hipRadiusZ / dims.hipRadiusX) * 1.05],
    ),
  );

  // Tailored belt + metal buckle
  const beltMat = lowerBody.kind === "skirt_exec" ? kit.fabric("#27272a", false, 0.52) : accentMat;
  const beltGeo = new THREE.CylinderGeometry(dims.waistRadiusX * 1.08, dims.waistRadiusX * 1.08, 0.022, 28);
  beltGeo.scale(1, 1, (dims.waistRadiusZ / dims.waistRadiusX) * 1.08);
  mounts.lower_body_slot.add(mesh(beltGeo, beltMat, "lower-belt", [0, 0.062, 0]));
  mounts.lower_body_slot.add(
    mesh(new THREE.BoxGeometry(0.032, 0.025, 0.012), kit.metal("#cbd5e1"), "lower-buckle", [0, 0.062, dims.waistRadiusZ * 1.08]),
  );

  if (lowerBody.kind === "skirt_exec") {
    // Ordered strictly bottom-to-top so LatheGeometry generates outward-facing front normals
    const skirtProfile = [
      new THREE.Vector2(0.01, -0.22),
      new THREE.Vector2(dims.hipRadiusX * 1.08, -0.22),
      new THREE.Vector2(dims.hipRadiusX * 1.15, -0.212),
      new THREE.Vector2(dims.hipRadiusX * 1.17, -0.13),
      new THREE.Vector2(dims.hipRadiusX * 1.12, -0.02),
      new THREE.Vector2(dims.waistRadiusX * 1.05, 0.06),
    ];
    const skirtGeo = new THREE.LatheGeometry(skirtProfile, 32);
    skirtGeo.scale(1, 1, (dims.hipRadiusZ / dims.hipRadiusX) * 1.06);
    skirtGeo.computeVertexNormals();
    mounts.lower_body_slot.add(mesh(skirtGeo, pantMat, "lower-skirt", [0, 0, 0]));
    return;
  }

  const thighTop = dims.thighRadius * (lowerBody.kind === "cargo" ? 1.14 : lowerBody.kind === "jogger" ? 1.11 : 1.07);
  const kneeR = dims.shinRadius * 1.13;
  const ankleR = dims.shinRadius * (lowerBody.kind === "jogger" ? 0.96 : 1.04);

  const thighGeo = makeLegSegmentGeo(thighTop, kneeR, THIGH_LENGTH);
  const shinGeo = makeLegSegmentGeo(kneeR * 0.98, ankleR, SHIN_LENGTH);

  for (const [side, thighMount, shinMount] of [
    [-1, mounts.legs.leftThigh, mounts.legs.leftShin],
    [1, mounts.legs.rightThigh, mounts.legs.rightShin],
  ] as const) {
    thighMount.add(
      mesh(new THREE.SphereGeometry(thighTop * 0.98, 16, 12), pantMat, `trouser-hip-cap-${side}`, [0, 0.002, 0]),
      mesh(thighGeo.clone(), pantMat, `trouser-thigh-${side}`),
    );
    if (lowerBody.kind === "cargo") {
      thighMount.add(
        mesh(
          new THREE.BoxGeometry(0.032, 0.085, 0.068),
          accentMat,
          `cargo-pocket-${side}`,
          [thighTop * 0.88 * side, -THIGH_LENGTH * 0.56, 0.008],
        ),
      );
    }
    shinMount.add(
      mesh(new THREE.SphereGeometry(kneeR * 0.98, 14, 12), pantMat, `trouser-knee-cap-${side}`),
      mesh(shinGeo.clone(), pantMat, `trouser-shin-${side}`),
    );
    if (lowerBody.kind === "jogger") {
      shinMount.add(
        mesh(
          new THREE.TorusGeometry(ankleR * 1.02, 0.011, 8, 18),
          kit.knit(lowerBody.accent),
          `jogger-cuff-${side}`,
          [0, -SHIN_LENGTH + 0.018, 0],
          undefined,
          [Math.PI / 2, 0, 0],
        ),
      );
    }
  }
  thighGeo.dispose();
  shinGeo.dispose();
}

export function buildFootwearSlot(
  look: AvatarLook3D,
  kit: MaterialKit,
  mounts: SlotMounts,
): void {
  clearMountGroup(mounts.footwear_slot);
  clearMountGroup(mounts.feet.left);
  clearMountGroup(mounts.feet.right);

  const { footwear } = look;
  const upperMat = kit.fabric(footwear.upper, false, footwear.kind === "oxford" ? 0.34 : 0.62);
  const soleMat = kit.fabric(footwear.sole, false, 0.72);
  const accentMat = kit.fabric(footwear.accent, false, 0.45);

  for (const [side, footMount] of [
    [-1, mounts.feet.left],
    [1, mounts.feet.right],
  ] as const) {
    const soleY = SHOE_SOLE_LOCAL_Y;
    // Cushioned sole grounded evenly at y = 0
    const soleGeo = new THREE.CylinderGeometry(0.062, 0.066, SHOE_SOLE_HEIGHT, 24);
    soleGeo.scale(0.94, 1, 1.56);
    soleGeo.computeVertexNormals();
    footMount.add(mesh(soleGeo, soleMat, "shoe-sole", [0, soleY, 0.028]));

    // Contoured dome vamp + padded collar wrapping ankle bone cleanly
    const upperGeo = new THREE.SphereGeometry(0.06, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6);
    upperGeo.scale(0.92, 0.9, 1.5);
    upperGeo.computeVertexNormals();
    footMount.add(mesh(upperGeo, upperMat, "shoe", [0, soleY + 0.014, 0.028]));

    footMount.add(
      mesh(
        new THREE.CylinderGeometry(0.048, 0.052, 0.048, 16),
        upperMat,
        `shoe-collar-wrap-${side}`,
        [0, soleY + 0.046, -0.004],
      ),
    );

    if (footwear.kind === "sneaker") {
      const toeGeo = new THREE.SphereGeometry(0.046, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
      toeGeo.scale(0.94, 0.58, 1.05);
      footMount.add(mesh(toeGeo, soleMat, "shoe-toe", [0, soleY + 0.013, 0.08]));
      footMount.add(mesh(new THREE.BoxGeometry(0.082, 0.012, 0.045), accentMat, `shoe-stripe-${side}`, [0, soleY + 0.032, 0.024]));
    } else if (footwear.kind === "boot" || footwear.kind === "safety") {
      footMount.add(mesh(new THREE.CylinderGeometry(0.054, 0.056, 0.075, 16), upperMat, `shoe-cuff-${side}`, [0, soleY + 0.06, -0.004]));
      footMount.add(mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 18), accentMat, `shoe-collar-${side}`, [0, soleY + 0.095, -0.004], undefined, [Math.PI / 2, 0, 0]));
    } else if (footwear.kind === "oxford") {
      footMount.add(mesh(new THREE.BoxGeometry(0.024, 0.01, 0.024), accentMat, `shoe-lace-${side}`, [0, soleY + 0.052, 0.038]));
    }
  }
}

export function buildBody(look: AvatarLook3D, kit: MaterialKit): ChibiRig {
  const { skeleton, mounts } = createHumanoidSkeleton(look.female);
  const dims = getHumanoidDimensions(look.female);
  const skinMat = kit.skin(look.skin);

  // Pelvis core uses dark neutral brief fabric so lower garment seams never expose skin
  const pelvisCoreGeo = new THREE.SphereGeometry(dims.hipRadiusX * 0.94, 24, 16);
  pelvisCoreGeo.scale(1, 0.68, dims.hipRadiusZ / dims.hipRadiusX);
  skeleton.pelvis.add(mesh(pelvisCoreGeo, kit.fabric(look.lowerBody.color || "#111827", false, 0.84), "pelvis-core", [0, 0.01, 0]));

  // Torso core on chest
  const torsoCore = buildTorsoCore(look.female, kit, look);
  skeleton.chest.add(torsoCore);

  // Flared curved trapezius + neck connecting head naturally into chest without detached cylinder step
  const neckProfile = [
    new THREE.Vector2(dims.neckRadius * 1.48, -0.022),
    new THREE.Vector2(dims.neckRadius * 1.1, 0.012),
    new THREE.Vector2(dims.neckRadius * 0.94, 0.052),
    new THREE.Vector2(dims.neckRadius * 0.92, 0.092),
  ];
  const neckGeo = new THREE.LatheGeometry(neckProfile, 24);
  neckGeo.computeVertexNormals();
  skeleton.neck.add(mesh(neckGeo, skinMat, "neck-mesh", [0, 0, 0]));

  // Sculpted Rounded Chibi Head
  const headGeo = sculptHumanoidHeadGeometry(look.female);
  skeleton.head.add(mesh(headGeo, skinMat, "head-skin", [0, HEAD_CENTER_Y, 0]));
  buildSculptedNoseAndEars(skeleton.head, look, kit);

  // Tapered anatomical arms with seamless rounded joint caps (eliminates dark crease ring at elbow)
  const armTopR = dims.upperArmRadius * 1.05;
  const armElbowR = dims.upperArmRadius * 0.90;
  const armWristR = dims.forearmRadius * 0.78;
  const upperArmGeo = makeLegSegmentGeo(armTopR, armElbowR, UPPER_ARM_LENGTH);
  const forearmGeo = makeLegSegmentGeo(armElbowR, armWristR, FOREARM_LENGTH);

  const buildArmMeshes = (
    side: number,
    upperArm: THREE.Group,
    forearm: THREE.Group,
    handBone: THREE.Group,
  ): ArticulatedHand => {
    upperArm.add(
      mesh(new THREE.SphereGeometry(armTopR, 16, 12), skinMat, `shoulder-joint-${side}`, [0, 0, 0]),
      mesh(upperArmGeo.clone(), skinMat, `upper-arm-mesh-${side}`),
    );
    forearm.add(
      mesh(new THREE.SphereGeometry(armElbowR, 16, 12), skinMat, `elbow-joint-${side}`, [0, 0, 0]),
      mesh(forearmGeo.clone(), skinMat, `forearm-mesh-${side}`),
    );
    const { handGroup, controls } = buildArticulatedHand(side, look.skin, kit);
    handBone.add(handGroup);
    return controls;
  };

  const leftHandControls = buildArmMeshes(-1, skeleton.leftUpperArm, skeleton.leftForearm, skeleton.leftHand);
  const rightHandControls = buildArmMeshes(1, skeleton.rightUpperArm, skeleton.rightForearm, skeleton.rightHand);
  upperArmGeo.dispose();
  forearmGeo.dispose();

  // Base anatomical legs underneath trousers or visible below skirts
  const skinThighGeo = makeLegSegmentGeo(dims.thighRadius * 0.96, dims.shinRadius * 1.02, THIGH_LENGTH);
  const skinShinGeo = makeLegSegmentGeo(dims.shinRadius * 1.0, dims.shinRadius * 0.78, SHIN_LENGTH);

  for (const [side, thigh, shin, ankle] of [
    [-1, skeleton.leftThigh, skeleton.leftShin, skeleton.leftAnkle],
    [1, skeleton.rightThigh, skeleton.rightShin, skeleton.rightAnkle],
  ] as const) {
    thigh.add(
      mesh(new THREE.SphereGeometry(dims.thighRadius * 0.96, 14, 12), skinMat, `hip-joint-${side}`),
      mesh(skinThighGeo.clone(), skinMat, `thigh-skin-${side}`),
    );
    shin.add(
      mesh(new THREE.SphereGeometry(dims.shinRadius * 1.01, 12, 10), skinMat, `knee-joint-${side}`),
      mesh(skinShinGeo.clone(), skinMat, `shin-skin-${side}`),
    );
    ankle.add(mesh(new THREE.SphereGeometry(dims.shinRadius * 0.72, 10, 8), skinMat, `ankle-joint-${side}`));
  }
  skinThighGeo.dispose();
  skinShinGeo.dispose();

  const faceControls = buildFaceSlot(look, kit, mounts.face_slot);
  buildLowerBodySlot(look, kit, mounts);
  buildFootwearSlot(look, kit, mounts);

  return {
    root: skeleton.root,
    body: skeleton.chest,
    head: skeleton.head,
    leftArm: skeleton.leftUpperArm,
    rightArm: skeleton.rightUpperArm,
    leftLeg: skeleton.leftThigh,
    rightLeg: skeleton.rightThigh,
    leftHand: skeleton.leftHand,
    rightHand: skeleton.rightHand,
    peace: skeleton.rightHand,
    skeleton,
    mounts,
    faceControls,
    leftHandControls,
    rightHandControls,
  };
}
