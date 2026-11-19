/**
 * ZAI Avatar Engine 2.0 — Reversible Engine Router Component.
 * Uses ZaiAvatarGLB (KayKit Rig + Blender Sculpted Modular GLBs) when feature flag is "glb",
 * and falls back instantaneously to procedural ZaiAvatar3D when flag is "procedural" (rollback safe).
 */

import React, { useMemo } from "react";
import { getActiveAvatarEngine } from "./avatarEngineFlag";
import type { ZaiAvatar3DProps } from "./ZaiAvatar3D";

const LazyZaiAvatarGLB = React.lazy(() => import("./glb/ZaiAvatarGLB"));
const LazyZaiAvatarProcedural = React.lazy(() => import("./ZaiAvatar3D"));

export function ZaiAvatarStage(props: ZaiAvatar3DProps) {
  const engine = useMemo(() => getActiveAvatarEngine(), []);

  if (engine === "procedural") {
    return (
      <React.Suspense fallback={props.fallback ?? null}>
        <LazyZaiAvatarProcedural {...props} />
      </React.Suspense>
    );
  }

  return (
    <React.Suspense fallback={props.fallback ?? null}>
      <LazyZaiAvatarGLB
        {...props}
        fallback={
          <React.Suspense fallback={props.fallback ?? null}>
            <LazyZaiAvatarProcedural {...props} />
          </React.Suspense>
        }
      />
    </React.Suspense>
  );
}

export default ZaiAvatarStage;
