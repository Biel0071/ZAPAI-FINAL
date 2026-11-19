/**
 * ZAI Avatar Engine 2.0 — Real Rigged Modular GLB Three.js Stage Component.
 * Uses KayKit 41-bone skeleton + sculpted stylized heads (shape keys), spline hair,
 * tailored corporate wardrobe, independent accessories, and AnimationMixer clips.
 * Drop-in compatible with ZaiAvatar3DProps & ZaiAvatar3DHandle.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createContactShadowTexture } from "../materials";
import { supportsWebGL } from "../webglSupport";
import { preloadAvatarGLBPacks } from "./avatarGLBPackCache";
import { resolveGLBCompositionPlan } from "./avatarGLBMapping";
import { composeGLBAvatarCharacter, type ComposedGLBCharacter } from "./avatarGLBCompositor";
import type { CameraPreset, ZaiAvatar3DProps } from "../ZaiAvatar3D";

const DEG = Math.PI / 180;
const DEFAULT_SPIN_SPEED = 0.95;
const DRAG_YAW_SPEED = 0.011;
const DRAG_PITCH_SPEED = 0.008;
const PIXEL_SCALE = 0.45;

function shortestAngle(delta: number): number {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

function getGLBCameraTargetForPreset(preset: CameraPreset): {
  targetY: number;
  distance: number;
  pitch: number;
} {
  if (preset === "portrait") {
    return { targetY: 1.44, distance: 1.72, pitch: 0.04 };
  }
  return { targetY: 0.96, distance: 4.38, pitch: 0.09 };
}

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

export function ZaiAvatarGLB({
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
  const [loadFailed, setLoadFailed] = useState(false);

  const plan = useMemo(
    () =>
      resolveGLBCompositionPlan(avatar, {
        brandColor,
        movement3D,
        operationalState,
        poseId,
        spinContinuous,
      }),
    [avatar, brandColor, movement3D, operationalState, poseId, spinContinuous],
  );
  const planKey = useMemo(() => JSON.stringify(plan), [plan]);

  const effectiveCameraControls = enableCameraControls ?? !controlled;
  const effectiveSpin = spinContinuous || movement3D === "spin360";
  const initCam = getGLBCameraTargetForPreset(cameraPreset);

  const stateRef = useRef({
    plan,
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
    onReady,
    onSnapshotReady,
  });

  stateRef.current.plan = plan;
  stateRef.current.baseYaw = rotationY * DEG;
  stateRef.current.spinContinuous = effectiveSpin;
  stateRef.current.spinSpeed = spinSpeed;
  stateRef.current.spinPaused = spinPaused;
  stateRef.current.cameraControls = effectiveCameraControls;
  stateRef.current.onReady = onReady;
  stateRef.current.onSnapshotReady = onSnapshotReady;

  const runtimeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    stage: THREE.Group;
    character: ComposedGLBCharacter | null;
    rim: THREE.DirectionalLight;
    envMap: THREE.Texture | null;
    shadowTex: THREE.Texture | null;
    brandMats: THREE.MeshBasicMaterial[];
    captureSnapshot: (preset?: "full" | "portrait") => string | null;
  } | null>(null);

  useEffect(() => {
    const cfg = getGLBCameraTargetForPreset(cameraPreset);
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
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({
      antialias: !pixelArt,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(pixelArt ? PIXEL_SCALE : Math.min(window.devicePixelRatio || 1, 2));
    if (pixelArt) renderer.domElement.style.imageRendering = "pixelated";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const envMap = buildStudioEnvironment(renderer, plan.palette.accentHex);
    if (envMap) {
      scene.environment = envMap;
      if ("environmentIntensity" in scene) {
        (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.42;
      }
    }

    const hemi = new THREE.HemisphereLight("#fffaf4", "#1e293b", 1.32);
    const ambient = new THREE.AmbientLight("#f8fafc", 0.34);
    const key = new THREE.DirectionalLight("#fff8f0", 1.78);
    key.position.set(2.2, 3.6, 3.8);
    const fill = new THREE.DirectionalLight("#dbeafe", 0.90);
    fill.position.set(-2.8, 2.0, 2.6);
    const rim = new THREE.DirectionalLight(plan.palette.accentHex, 1.0);
    rim.position.set(-2.4, 2.4, -2.8);
    const frontSoft = new THREE.DirectionalLight("#fefefe", 0.55);
    frontSoft.position.set(0, 1.25, 3.5);
    scene.add(hemi, ambient, key, fill, rim, frontSoft);

    const ground = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 48),
      new THREE.MeshBasicMaterial({ color: "#061117", transparent: true, opacity: 0.82 }),
    );
    const outerRingMat = new THREE.MeshBasicMaterial({ color: plan.palette.accentHex, transparent: true, opacity: 0.72 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.59, 0.625, 64), outerRingMat);
    const innerRingMat = new THREE.MeshBasicMaterial({ color: plan.palette.accentHex, transparent: true, opacity: 0.28 });
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.40, 48), innerRingMat);

    const shadowTex = createContactShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      ...(shadowTex ? { map: shadowTex } : { color: "#020617" }),
      transparent: true,
      opacity: shadowTex ? 0.92 : 0.42,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 40), shadowMat);
    disc.rotation.x = ring.rotation.x = innerRing.rotation.x = shadow.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    innerRing.position.y = 0.0018;
    shadow.position.y = 0.0028;
    ground.add(disc, innerRing, ring, shadow);
    scene.add(ground);

    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 50);
    camera.position.set(0, initCam.targetY + Math.sin(initCam.pitch) * initCam.distance, Math.cos(initCam.pitch) * initCam.distance);
    camera.lookAt(0, initCam.targetY, 0);

    const stage = new THREE.Group();
    scene.add(stage);

    const captureSnapshot = (preset: "full" | "portrait" = "portrait"): string | null => {
      const rt = runtimeRef.current;
      if (!rt || !rt.character) return null;

      const prevPos = camera.position.clone();
      const prevQuat = camera.quaternion.clone();
      const prevStageRotY = stage.rotation.y;

      const snapCam = getGLBCameraTargetForPreset(preset);
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
      character: null,
      rim,
      envMap,
      shadowTex,
      brandMats: [outerRingMat, innerRingMat],
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
    const onUp = () => { dragging = false; };
    const onWheel = (event: WheelEvent) => {
      if (!stateRef.current.cameraControls) return;
      event.preventDefault();
      stateRef.current.cameraDistance = Math.max(1.3, Math.min(5.0, stateRef.current.cameraDistance + event.deltaY * 0.0022));
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
      const elapsed = clock.elapsedTime;
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
      camera.position.set(
        Math.sin(currentCamYaw) * horizDist,
        currentTargetY + Math.sin(currentCamPitch) * currentCamDist,
        Math.cos(currentCamYaw) * horizDist,
      );
      camera.lookAt(0, currentTargetY, 0);

      runtimeRef.current?.character?.updateAnimation(dt, elapsed);
      renderer.render(scene, camera);
    };
    tick();

    preloadAvatarGLBPacks()
      .then((packs) => {
        if (disposed || !runtimeRef.current) return;
        const char = composeGLBAvatarCharacter(packs, stateRef.current.plan);
        runtimeRef.current.stage.add(char.root);
        runtimeRef.current.character = char;

        stateRef.current.onReady?.({
          captureSnapshot,
          resetCamera: () => {
            const cfg = getGLBCameraTargetForPreset("reset");
            stateRef.current.cameraYaw = 0;
            stateRef.current.cameraPitch = cfg.pitch;
            stateRef.current.cameraDistance = cfg.distance;
            stateRef.current.targetY = cfg.targetY;
          },
          triggerState: (nextState, nextPose) => {
            const p = {
              ...stateRef.current.plan,
              animState: nextState,
              poseId: nextPose || stateRef.current.plan.poseId,
            };
            char.applyPlan(p);
          },
        });

        window.setTimeout(() => {
          if (disposed || !stateRef.current.onSnapshotReady) return;
          const snap = captureSnapshot("portrait");
          if (snap) stateRef.current.onSnapshotReady(snap);
        }, 120);
      })
      .catch(() => {
        if (!disposed) setLoadFailed(true);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      runtimeRef.current?.character?.dispose();
      runtimeRef.current = null;
      envMap?.dispose();
      shadowTex?.dispose();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          (Array.isArray(node.material) ? node.material : [node.material]).forEach((m) => m.dispose());
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

    rt.rim.color.set(plan.palette.accentHex);
    rt.brandMats.forEach((mat) => mat.color.set(plan.palette.accentHex));

    if (rt.character) {
      rt.character.applyPlan(plan);
      rt.character.updateAnimation(0.02, 0);
      if (stateRef.current.onSnapshotReady) {
        const timer = window.setTimeout(() => {
          const snap = rt.captureSnapshot("portrait");
          if (snap) stateRef.current.onSnapshotReady?.(snap);
        }, 120);
        return () => window.clearTimeout(timer);
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, unsupported]);

  if (unsupported || loadFailed) return <>{fallback ?? null}</>;

  return (
    <div
      ref={hostRef}
      className={className}
      data-avatar-engine="glb"
      data-avatar-renderer="3d"
      data-avatar-movement={movement3D}
      data-avatar-state={plan.animState}
      data-avatar-pose={plan.poseId}
      style={{
        width: "100%",
        height: "100%",
        cursor: effectiveCameraControls ? "grab" : "inherit",
        background: `radial-gradient(circle at 50% 45%, ${plan.palette.accentHex}22 0%, transparent 66%)`,
      }}
    />
  );
}

export default ZaiAvatarGLB;
