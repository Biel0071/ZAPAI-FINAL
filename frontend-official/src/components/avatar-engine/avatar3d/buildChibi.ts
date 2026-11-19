import * as THREE from "three";
import type { AvatarLook3D } from "./look3d";
import { MaterialKit } from "./materials";
import {
  buildBody,
  buildFaceSlot,
  buildFootwearSlot,
  buildLowerBodySlot,
  type ChibiRig,
} from "./buildBody";
import { buildHairSlot } from "./buildHair";
import { buildUniformSlot, buildUpperBodySlot } from "./buildOutfit";
import {
  buildAccessories,
  buildAccessorySubSlot,
  computeHoldPose,
  type HoldPose,
} from "./buildAccessories";
import type { AccessorySubSlot, AvatarSlotType } from "./slotCatalog";

export type Chibi = {
  rig: ChibiRig;
  hold: HoldPose;
  kit: MaterialKit;
  swapSlot: (slot: AvatarSlotType, nextLook: AvatarLook3D) => void;
  swapAccessorySubSlot: (subSlot: AccessorySubSlot, nextLook: AvatarLook3D) => void;
  dispose: () => void;
};

export function buildHumanoidCharacter(look: AvatarLook3D): Chibi {
  const kit = new MaterialKit();
  const rig = buildBody(look, kit);
  buildHairSlot(look, kit, rig.mounts.hair_slot);
  buildUpperBodySlot(look, kit, rig.mounts);
  buildUniformSlot(look, kit, rig.mounts);
  const hold = buildAccessories(look, kit, rig);

  const character: Chibi = {
    rig,
    hold,
    kit,
    swapSlot: (slot, nextLook) => {
      switch (slot) {
        case "hair_slot":
          buildHairSlot(nextLook, kit, rig.mounts.hair_slot);
          break;
        case "face_slot":
          rig.faceControls = buildFaceSlot(nextLook, kit, rig.mounts.face_slot);
          break;
        case "upper_body_slot":
          buildUpperBodySlot(nextLook, kit, rig.mounts);
          break;
        case "lower_body_slot":
          buildLowerBodySlot(nextLook, kit, rig.mounts);
          break;
        case "footwear_slot":
          buildFootwearSlot(nextLook, kit, rig.mounts);
          break;
        case "uniform_slot":
        case "style_slot":
          buildUniformSlot(nextLook, kit, rig.mounts);
          break;
        case "accessory_slot": {
          const nextHold = buildAccessories(nextLook, kit, rig);
          character.hold = nextHold;
          buildHairSlot(nextLook, kit, rig.mounts.hair_slot);
          break;
        }
      }
    },
    swapAccessorySubSlot: (subSlot, nextLook) => {
      buildAccessorySubSlot(subSlot, nextLook, kit, rig.mounts);
      if (subSlot === "prop") {
        character.hold = computeHoldPose(nextLook);
      }
      if (subSlot === "headwear") {
        buildHairSlot(nextLook, kit, rig.mounts.hair_slot);
      }
    },
    dispose: () => {
      rig.root.traverse((node) => {
        if (node instanceof THREE.Mesh) node.geometry.dispose();
      });
      kit.dispose();
    },
  };

  return character;
}

export function buildChibi(look: AvatarLook3D): Chibi {
  return buildHumanoidCharacter(look);
}
