import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { AgentAvatarConfig } from "../AvatarDefinition";
import { resolveAvatarLook3D } from "./look3d";
import { buildChibi, type Chibi } from "./buildChibi";
import { animateChibi, type Movement3D } from "./animateChibi";
import { supportsWebGL } from "./webglSupport";

type Props = {
  avatar: Partial<AgentAvatarConfig>;
  rotationY?: number;
  movement3D?: Movement3D;
  brandColor?: string;
  className?: string;
  fallback?: ReactNode;
  controlled?: boolean;
  pixelArt?: boolean;
};

const DEG = Math.PI / 180;
const SPIN_SPEED = 1.1;
const DRAG_SPEED = 0.012;
const PIXEL_SCALE = 0.45;

function shortestAngle(delta: number): number {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}


function createStage(brand: string) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#e0f2fe", "#0f172a", 1.6));
  const key = new THREE.DirectionalLight("#ffffff", 2.2);
  key.position.set(2.5, 4, 3.5);
  const rim = new THREE.DirectionalLight(brand, 1.4);
  rim.position.set(-3, 2.5, -2.5);
  scene.add(key, rim);

  const ground = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ color: "#0b1f1a", transparent: true, opacity: 0.85 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.78, 64), new THREE.MeshBasicMaterial({ color: brand, transparent: true, opacity: 0.7 }));
  disc.rotation.x = ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  ground.add(disc, ring);
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.55, 5.9);
  camera.lookAt(0, 1.3, 0);

  const stage = new THREE.Group();
  scene.add(stage);
  return { scene, camera, stage, ground };
}

export default function ZaiAvatar3D({ avatar, rotationY = 0, movement3D = "idle", brandColor, className, fallback, controlled = false, pixelArt = true }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [unsupported] = useState(() => typeof window === "undefined" || !supportsWebGL());
  const look = useMemo(() => resolveAvatarLook3D(avatar, brandColor), [avatar, brandColor]);
  const lookKey = useMemo(() => JSON.stringify(look), [look]);

  const state = useRef({ movement: movement3D, baseYaw: rotationY * DEG, dragYaw: 0, spinYaw: 0, controlled });
  state.current.movement = movement3D;
  state.current.baseYaw = rotationY * DEG;
  state.current.controlled = controlled;

  const runtime = useRef<{ stage: THREE.Group; chibi: Chibi | null; brand: string } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (unsupported || !host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: !pixelArt, alpha: true });
    renderer.setPixelRatio(pixelArt ? PIXEL_SCALE : Math.min(window.devicePixelRatio || 1, 2));
    if (pixelArt) renderer.domElement.style.imageRendering = "pixelated";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const { scene, camera, stage } = createStage(look.brand);
    runtime.current = { stage, chibi: null, brand: look.brand };

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
    const onDown = (event: PointerEvent) => {
      if (state.current.controlled) return;
      dragging = true;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      state.current.dragYaw += (event.clientX - lastX) * DRAG_SPEED;
      lastX = event.clientX;
    };
    const onUp = () => { dragging = false; };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);

    const clock = new THREE.Clock();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      const current = state.current;
      if (!current.controlled && current.movement === "spin360" && !dragging) current.spinYaw += dt * SPIN_SPEED;
      const target = current.baseYaw + current.dragYaw + current.spinYaw;
      stage.rotation.y += shortestAngle(target - stage.rotation.y) * Math.min(1, dt * 10);
      const chibi = runtime.current?.chibi;
      if (chibi) animateChibi(chibi.rig, chibi.hold, current.movement, t);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      runtime.current?.chibi?.dispose();
      runtime.current = null;
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Stage is created once per mount; brand changes rebuild only the character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsupported]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    current.chibi?.rig.root.removeFromParent();
    current.chibi?.dispose();
    const chibi = buildChibi(look);
    current.stage.add(chibi.rig.root);
    current.chibi = chibi;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, unsupported]);

  if (unsupported) return <>{fallback ?? null}</>;
  return <div ref={hostRef} className={className} data-avatar-renderer="3d" data-avatar-movement={movement3D} style={{ width: "100%", height: "100%", cursor: controlled ? "inherit" : "grab" }} />;
}