import * as THREE from "three";
import type { AvatarLook3D } from "./look3d";
import { MaterialKit } from "./materials";
import { buildBody, type ChibiRig } from "./buildBody";
import { buildHair } from "./buildHair";
import { buildOutfit } from "./buildOutfit";
import { buildAccessories, type HoldPose } from "./buildAccessories";
import { applyOutline } from "./outline";

export type Chibi = { rig: ChibiRig; hold: HoldPose; dispose: () => void };

export function buildChibi(look: AvatarLook3D): Chibi {
  const kit = new MaterialKit();
  const rig = buildBody(look, kit);
  rig.head.add(buildHair(look, kit));
  rig.body.add(buildOutfit(look, kit));
  const hold = buildAccessories(look, kit, rig);
  const outlineMaterial = applyOutline(rig.root);
  return {
    rig,
    hold,
    dispose: () => {
      rig.root.traverse((node) => {
        if (node instanceof THREE.Mesh) node.geometry.dispose();
      });
      outlineMaterial.dispose();
      kit.dispose();
    },
  };
}