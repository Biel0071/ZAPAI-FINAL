import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { AgentAvatarConfig, AnimationState } from "../AvatarDefinition";
import { resolveAvatarLook3D, type AvatarLook3D } from "./look3d";
import { buildHumanoidCharacter, type Chibi } from "./buildChibi";
import {
  AvatarAnimationFSM,
  resolveAnimStateFromProps,
  type Movement3D,
} from "./animationStateMachine";
import { createContactShadowTexture } from "./materials";
import type { AccessorySubSlot, PoseId } from "./slotCatalog";
import { supportsWebGL } from "./webglSupport";

export type CameraPreset = "full" | "portrait" | "reset";
export type OperationalState = AnimationState | string;

export interface ZaiAvatar3DHandle {
  captureSnapshot: (preset?: "full" | "portrait") => string | null;
  resetCamera: () => void;
  triggerState: (state: ReturnType<AvatarAnimationFSM["getState"]>, poseId?: PoseId) => void;
}

export type ZaiAvatar3DProps = {
  avatar: Partial<AgentAvatarConfig>;
  rotationY?: number;
  movement3D?: Movement3D;
  operationalState?: OperationalState;
  poseId?: PoseId;
  brandColor?: string;
  spinContinuous?: boolean;
  spinSpeed?: number;
  spinPaused?: boolean;
  enableCameraControls?: boolean;
  cameraPreset?: CameraPreset;
  onReady?: (handle: ZaiAvatar3DHandle) => void;
  onSnapshotReady?: (dataUrl: string) => void;
  className?: string;
  fallback?: ReactNode;
  controlled?: boolean;
  pixelArt?: boolean;
};

const DEG = Math.PI / 180;
const DEFAULT_SPIN_SPEED = 0.95;
const DRAG_YAW_SPEED = 0.011;
const DRAG_PITCH_SPEED = 0.008;
const PIXEL_SCALE = 0.45;

function shortestAngle(delta: number): number {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

function getCameraTargetForPreset(preset: CameraPreset): {
  targetY: number;
  distance: number;
  pitch: number;
} {
  if (preset === "portrait") {
    return { targetY: 1.21, distance: 1.5, pitch: 0.04 };
  }
  return { targetY: 0.75, distance: 3.16, pitch: 0.11 };
}

/**
 * Generates a lightweight soft studio HDR-like environment cube via PMREMGenerator
 * so PBR skin, hair, and woven fabrics have cohesive reflections without harsh plastic hotspots.
 */
function buildStudioEnvironment(renderer: THREE.WebGLRenderer, brand: string): THREE.Texture | null {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color("#1e293b");

    const topPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ color: "#fffaf2", side: THREE.DoubleSide }),
    );
    topPanel.position.set(0, 4.5, 1.5);
    topPanel.rotation.x = Math.PI / 2;

    const keyPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: "#ffedd5", side: THREE.DoubleSide }),
    );
    keyPanel.position.set(4, 2.5, 3.5);
    keyPanel.lookAt(0, 0, 0);

    const fillPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: "#bae6fd", side: THREE.DoubleSide }),
    );
    fillPanel.position.set(-4, 2.0, 2.5);
    fillPanel.lookAt(0, 0, 0);

    const rimPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({ color: brand, side: THREE.DoubleSide }),
    );
    rimPanel.position.set(-2.5, 2.5, -4);
    rimPanel.lookAt(0, 0, 0);

    envScene.add(topPanel, keyPanel, fillPanel, rimPanel);
    const rt = pmrem.fromScene(envScene, 0.04);
    [topPanel, keyPanel, fillPanel, rimPanel].forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    pmrem.dispose();
    return rt.texture;
  } catch {
    return null;
  }
}

function createStage(renderer: THREE.WebGLRenderer, brand: string) {
  const scene = new THREE.Scene();
  const envMap = buildStudioEnvironment(renderer, brand);
  if (envMap) {
    scene.environment = envMap;
    if ("environmentIntensity" in scene) {
      (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.42;
    }
  }

  // Soft 3-point + hemisphere studio illumination
  const hemi = new THREE.HemisphereLight("#fffaf4", "#1e293b", 1.22);
  const ambient = new THREE.AmbientLight("#f8fafc", 0.35);

  const key = new THREE.DirectionalLight("#fff8f0", 1.72);
  key.position.set(2.2, 3.6, 3.8);

  const fill = new THREE.DirectionalLight("#dbeafe", 0.86);
  fill.position.set(-2.8, 2.0, 2.6);

  const rim = new THREE.DirectionalLight(brand, 1.05);
  rim.position.set(-2.4, 2.4, -2.8);

  const frontSoft = new THREE.DirectionalLight("#fefefe", 0.55);
  frontSoft.position.set(0, 1.1, 3.5);

  scene.add(hemi, ambient, key, fill, rim, frontSoft);

  const ground = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 48),
    new THREE.MeshBasicMaterial({ color: "#061117", transparent: true, opacity: 0.82 }),
  );
  const outerRingMat = new THREE.MeshBasicMaterial({ color: brand, transparent: true, opacity: 0.72 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.585, 64), outerRingMat);
  const innerRingMat = new THREE.MeshBasicMaterial({ color: brand, transparent: true, opacity: 0.28 });
  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.38, 48), innerRingMat);

  const shadowTex = createContactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    ...(shadowTex ? { map: shadowTex } : { color: "#020617" }),
    transparent: true,
    opacity: shadowTex ? 0.92 : 0.42,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), shadowMat);
  disc.rotation.x = ring.rotation.x = innerRing.rotation.x = shadow.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  innerRing.position.y = 0.0018;
  shadow.position.y = 0.0028;
  ground.add(disc, innerRing, ring, shadow);
  scene.add(ground);

  const initCam = getCameraTargetForPreset("full");
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, initCam.targetY + Math.sin(initCam.pitch) * initCam.distance, Math.cos(initCam.pitch) * initCam.distance);
  camera.lookAt(0, initCam.targetY, 0);

  const stage = new THREE.Group();
  scene.add(stage);

  return { scene, camera, stage, rim, envMap, shadowTex, brandMats: [outerRingMat, innerRingMat] };
}

function diffAndApplyLook(
  character: Chibi,
  prev: AvatarLook3D,
  next: AvatarLook3D,
): boolean {
  if (prev.female !== next.female || prev.skin !== next.skin) {
    return false;
  }

  const hairColorChanged = prev.hairColor !== next.hairColor || prev.hairHighlight !== next.hairHighlight;
  const brandChanged = prev.brand !== next.brand || prev.accent !== next.accent;

  if (prev.hairStyle !== next.hairStyle || hairColorChanged || prev.headwear !== next.headwear) {
    character.swapSlot("hair_slot", next);
  }
  if (
    prev.expression !== next.expression ||
    prev.iris !== next.iris ||
    prev.facialHair !== next.facialHair ||
    hairColorChanged
  ) {
    character.swapSlot("face_slot", next);
  }
  if (
    prev.outfit.kind !== next.outfit.kind ||
    prev.outfit.body !== next.outfit.body ||
    prev.outfit.trim !== next.outfit.trim ||
    prev.outfit.longSleeves !== next.outfit.longSleeves ||
    brandChanged
  ) {
    character.swapSlot("upper_body_slot", next);
  }
  if (
    prev.lowerBody.kind !== next.lowerBody.kind ||
    prev.lowerBody.color !== next.lowerBody.color ||
    prev.lowerBody.accent !== next.lowerBody.accent
  ) {
    character.swapSlot("lower_body_slot", next);
  }
  if (
    prev.footwear.kind !== next.footwear.kind ||
    prev.footwear.upper !== next.footwear.upper ||
    prev.footwear.accent !== next.footwear.accent
  ) {
    character.swapSlot("footwear_slot", next);
  }
  if (prev.uniformId !== next.uniformId || brandChanged) {
    character.swapSlot("uniform_slot", next);
  }

  const subSlots: AccessorySubSlot[] = ["eyewear", "headwear", "headset", "badge", "wrist", "prop", "back"];
  for (const sub of subSlots) {
    if (prev.accessorySubSlots[sub] !== next.accessorySubSlots[sub] || brandChanged) {
      character.swapAccessorySubSlot(sub, next);
    }
  }

  return true;
}

export function ZaiAvatar3D({
  avatar,
  rotationY = 0,
  movement3D = "idle",
  operationalState,
  poseId,
  brandColor,
  spinContinuous = false,
  spinSpeed = DEFAULT_SPIN_SPEED,
  spinPaused = false,
  enableCameraControls,
  cameraPreset = "full",
  onReady,
  onSnapshotReady,
  className,
  fallback,
  controlled = false,
  pixelArt = false,
}: ZaiAvatar3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [unsupported] = useState(() => typeof window === "undefined" || !supportsWebGL());

  const look = useMemo(() => resolveAvatarLook3D(avatar, brandColor), [avatar, brandColor]);
  const lookKey = useMemo(() => JSON.stringify(look), [look]);

  const effectiveCameraControls = enableCameraControls ?? !controlled;
  const effectiveSpin = spinContinuous || movement3D === "spin360";
  const effectivePoseId: PoseId = poseId || look.poseId || "pose_executive";
  const resolvedAnimState = resolveAnimStateFromProps(
    movement3D,
    operationalState ?? avatar.animationState,
  );

  const initCam = getCameraTargetForPreset(cameraPreset);
  const stateRef = useRef({
    animState: resolvedAnimState,
    poseId: effectivePoseId,
    baseYaw: rotationY * DEG,
    spinContinuous: effectiveSpin,
    spinSpeed,
    spinPaused,
    spinYaw: 0,
    cameraControls: effectiveCameraControls,
    cameraYaw: 0,
    cameraPitch: initCam.pitch,
    cameraDistance: initCam.distance,
    targetY: initCam.targetY,
    controlled,
    onSnapshotReady,
    onReady,
  });

  stateRef.current.animState = resolvedAnimState;
  stateRef.current.poseId = effectivePoseId;
  stateRef.current.baseYaw = rotationY * DEG;
  stateRef.current.spinContinuous = effectiveSpin;
  stateRef.current.spinSpeed = spinSpeed;
  stateRef.current.spinPaused = spinPaused;
  stateRef.current.cameraControls = effectiveCameraControls;
  stateRef.current.controlled = controlled;
  stateRef.current.onSnapshotReady = onSnapshotReady;
  stateRef.current.onReady = onReady;

  const runtimeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    stage: THREE.Group;
    chibi: Chibi | null;
    prevLook: AvatarLook3D | null;
    fsm: AvatarAnimationFSM;
    rim: THREE.DirectionalLight;
    envMap: THREE.Texture | null;
    shadowTex: THREE.Texture | null;
    brandMats: THREE.MeshBasicMaterial[];
    captureSnapshot: (preset?: "full" | "portrait") => string | null;
  } | null>(null);

  useEffect(() => {
    const cfg = getCameraTargetForPreset(cameraPreset);
    stateRef.current.targetY = cfg.targetY;
    stateRef.current.cameraDistance = cfg.distance;
    stateRef.current.cameraPitch = cfg.pitch;
    if (cameraPreset === "reset" || cameraPreset === "portrait") {
      stateRef.current.cameraYaw = 0;
    }
  }, [cameraPreset]);

  useEffect(() => {
    const host = hostRef.current;
    if (unsupported || !host) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: !pixelArt,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(pixelArt ? PIXEL_SCALE : Math.min(window.devicePixelRatio || 1, 2));
    if (pixelArt) renderer.domElement.style.imageRendering = "pixelated";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const { scene, camera, stage, rim, envMap, shadowTex, brandMats } = createStage(renderer, look.brand);
    const fsm = new AvatarAnimationFSM(stateRef.current.animState, stateRef.current.poseId);

    const captureSnapshot = (preset: "full" | "portrait" = "portrait"): string | null => {
      const rt = runtimeRef.current;
      if (!rt || !rt.chibi) return null;

      const prevPos = camera.position.clone();
      const prevQuat = camera.quaternion.clone();
      const prevStageRotY = stage.rotation.y;

      const snapCam = getCameraTargetForPreset(preset);
      stage.rotation.y = 0;
      camera.position.set(0, snapCam.targetY + Math.sin(snapCam.pitch) * snapCam.distance, Math.cos(snapCam.pitch) * snapCam.distance);
      camera.lookAt(0, snapCam.targetY, 0);
      camera.updateMatrixWorld();

      renderer.render(scene, camera);
      let dataUrl: string | null = null;
      try {
        dataUrl = renderer.domElement.toDataURL("image/png");
      } catch {
        dataUrl = null;
      }

      stage.rotation.y = prevStageRotY;
      camera.position.copy(prevPos);
      camera.quaternion.copy(prevQuat);
      camera.updateMatrixWorld();
      return dataUrl;
    };

    runtimeRef.current = {
      renderer,
      scene,
      camera,
      stage,
      chibi: null,
      prevLook: null,
      fsm,
      rim,
      envMap,
      shadowTex,
      brandMats,
      captureSnapshot,
    };

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (event: PointerEvent) => {
      if (!stateRef.current.cameraControls) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging || !stateRef.current.cameraControls) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      stateRef.current.cameraYaw += dx * DRAG_YAW_SPEED;
      stateRef.current.cameraPitch = Math.max(-0.32, Math.min(0.55, stateRef.current.cameraPitch + dy * DRAG_PITCH_SPEED));
    };

    const onUp = () => {
      dragging = false;
    };

    const onWheel = (event: WheelEvent) => {
      if (!stateRef.current.cameraControls) return;
      event.preventDefault();
      stateRef.current.cameraDistance = Math.max(
        1.25,
        Math.min(4.6, stateRef.current.cameraDistance + event.deltaY * 0.0022),
      );
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const clock = new THREE.Clock();
    let frame = 0;
    let currentCamDist = stateRef.current.cameraDistance;
    let currentCamPitch = stateRef.current.cameraPitch;
    let currentCamYaw = stateRef.current.cameraYaw;
    let currentTargetY = stateRef.current.targetY;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.08);
      const cur = stateRef.current;

      if (cur.spinContinuous && !cur.spinPaused && !dragging) {
        cur.spinYaw += dt * cur.spinSpeed;
      }
      const targetTurntableYaw = cur.baseYaw + cur.spinYaw;
      stage.rotation.y += shortestAngle(targetTurntableYaw - stage.rotation.y) * Math.min(1, dt * 10);

      const camLerp = Math.min(1, dt * 10);
      currentCamDist += (cur.cameraDistance - currentCamDist) * camLerp;
      currentCamPitch += (cur.cameraPitch - currentCamPitch) * camLerp;
      currentCamYaw += (cur.cameraYaw - currentCamYaw) * camLerp;
      currentTargetY += (cur.targetY - currentTargetY) * camLerp;

      const horizDist = Math.cos(currentCamPitch) * currentCamDist;
      const camX = Math.sin(currentCamYaw) * horizDist;
      const camZ = Math.cos(currentCamYaw) * horizDist;
      const camY = currentTargetY + Math.sin(currentCamPitch) * currentCamDist;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, currentTargetY, 0);

      const chibi = runtimeRef.current?.chibi;
      if (chibi) {
        fsm.setState(cur.animState, cur.poseId);
        fsm.update(dt, chibi.rig, chibi.hold);
      }

      renderer.render(scene, camera);
    };
    tick();

    stateRef.current.onReady?.({
      captureSnapshot,
      resetCamera: () => {
        const cfg = getCameraTargetForPreset("reset");
        stateRef.current.cameraYaw = 0;
        stateRef.current.cameraPitch = cfg.pitch;
        stateRef.current.cameraDistance = cfg.distance;
        stateRef.current.targetY = cfg.targetY;
      },
      triggerState: (nextState, nextPose) => {
        fsm.setState(nextState, nextPose);
      },
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      runtimeRef.current?.chibi?.dispose();
      runtimeRef.current = null;
      envMap?.dispose();
      shadowTex?.dispose();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsupported]);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    rt.rim.color.set(look.brand);
    rt.brandMats.forEach((mat) => mat.color.set(look.brand));

    let swappedInPlace = false;
    if (rt.chibi && rt.prevLook) {
      swappedInPlace = diffAndApplyLook(rt.chibi, rt.prevLook, look);
    }

    if (!swappedInPlace) {
      rt.chibi?.rig.root.removeFromParent();
      rt.chibi?.dispose();
      const nextChar = buildHumanoidCharacter(look);
      rt.stage.add(nextChar.rig.root);
      rt.chibi = nextChar;
      rt.fsm.bindRig(nextChar.rig);
    }

    rt.prevLook = look;

    if (!stateRef.current.onSnapshotReady) return;
    const timer = window.setTimeout(() => {
      const snap = rt.captureSnapshot("portrait");
      if (snap) stateRef.current.onSnapshotReady?.(snap);
    }, 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, unsupported]);

  if (unsupported) return <>{fallback ?? null}</>;
  return (
    <div
      ref={hostRef}
      className={className}
      data-avatar-renderer="3d"
      data-avatar-movement={movement3D}
      data-avatar-state={resolvedAnimState}
      data-avatar-pose={effectivePoseId}
      style={{
        width: "100%",
        height: "100%",
        cursor: effectiveCameraControls ? "grab" : "inherit",
        background: `radial-gradient(circle at 50% 45%, ${look.brand}22 0%, transparent 66%)`,
      }}
    />
  );
}

export default ZaiAvatar3D;
