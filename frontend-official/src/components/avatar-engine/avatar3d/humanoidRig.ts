import * as THREE from "three";
import {
  CHEST_LOCAL_Y,
  FOREARM_LENGTH,
  getHumanoidDimensions,
  HEAD_LOCAL_Y,
  NECK_LOCAL_Y,
  PELVIS_Y,
  SHIN_LENGTH,
  SHOULDER_LOCAL_Y,
  SPINE_LOCAL_Y,
  THIGH_LENGTH,
  UPPER_ARM_LENGTH,
} from "./anatomy";
import { group } from "./materials";
import type { AccessorySubSlot, AvatarSlotType } from "./slotCatalog";

export interface HumanoidSkeleton {
  root: THREE.Group;
  turntable: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftClavicle: THREE.Group;
  leftUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  leftHand: THREE.Group;
  rightClavicle: THREE.Group;
  rightUpperArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  leftThigh: THREE.Group;
  leftShin: THREE.Group;
  leftAnkle: THREE.Group;
  leftFoot: THREE.Group;
  rightThigh: THREE.Group;
  rightShin: THREE.Group;
  rightAnkle: THREE.Group;
  rightFoot: THREE.Group;
}

export interface ArticulatedHand {
  palm: THREE.Object3D;
  thumb: THREE.Group;
  indexFinger: THREE.Group;
  middleFinger: THREE.Group;
  ringFinger: THREE.Group;
  pinkyFinger: THREE.Group;
  setPose: (mode: "rest" | "hold" | "peace", peaceFactor?: number) => void;
}

export interface FaceRigControls {
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  leftUpperLid: THREE.Mesh;
  rightUpperLid: THREE.Mesh;
  leftLowerLid: THREE.Mesh;
  rightLowerLid: THREE.Mesh;
  leftBrow: THREE.Group;
  rightBrow: THREE.Group;
  upperLip: THREE.Mesh;
  lowerLip: THREE.Mesh;
  mouthCavity: THREE.Mesh;
  setExpressionState: (params: {
    blinkLeft: number;
    blinkRight: number;
    browLift: number;
    browTilt: number;
    smile: number;
    mouthOpen: number;
  }) => void;
}

export interface SlotMounts {
  hair_slot: THREE.Group;
  face_slot: THREE.Group;
  upper_body_slot: THREE.Group;
  lower_body_slot: THREE.Group;
  footwear_slot: THREE.Group;
  accessory_slot: THREE.Group;
  uniform_slot: THREE.Group;
  sleeves: {
    leftUpper: THREE.Group;
    leftForearm: THREE.Group;
    rightUpper: THREE.Group;
    rightForearm: THREE.Group;
  };
  legs: {
    leftThigh: THREE.Group;
    leftShin: THREE.Group;
    rightThigh: THREE.Group;
    rightShin: THREE.Group;
  };
  feet: {
    left: THREE.Group;
    right: THREE.Group;
  };
  accessories: {
    eyewear: THREE.Group;
    headwear: THREE.Group;
    headset: THREE.Group;
    badge: THREE.Group;
    wrist: THREE.Group;
    propLeft: THREE.Group;
    propRight: THREE.Group;
    propLaptop: THREE.Group;
    propBoth: THREE.Group;
    back: THREE.Group;
  };
}

export function clearMountGroup(target: THREE.Group): void {
  const children = [...target.children];
  for (const child of children) {
    child.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((mat) => {
          if (mat && mat.userData?.ownedMaterial) {
            mat.dispose();
          }
        });
      }
    });
    target.remove(child);
  }
}

export function getSlotMountGroups(
  mounts: SlotMounts,
  slot: AvatarSlotType,
): THREE.Group[] {
  switch (slot) {
    case "hair_slot":
      return [mounts.hair_slot];
    case "face_slot":
      return [mounts.face_slot];
    case "upper_body_slot":
      return [
        mounts.upper_body_slot,
        mounts.sleeves.leftUpper,
        mounts.sleeves.leftForearm,
        mounts.sleeves.rightUpper,
        mounts.sleeves.rightForearm,
      ];
    case "lower_body_slot":
      return [
        mounts.lower_body_slot,
        mounts.legs.leftThigh,
        mounts.legs.leftShin,
        mounts.legs.rightThigh,
        mounts.legs.rightShin,
      ];
    case "footwear_slot":
      return [mounts.footwear_slot, mounts.feet.left, mounts.feet.right];
    case "uniform_slot":
    case "style_slot":
      return [mounts.uniform_slot];
    case "accessory_slot":
      return [
        mounts.accessory_slot,
        mounts.accessories.eyewear,
        mounts.accessories.headwear,
        mounts.accessories.headset,
        mounts.accessories.badge,
        mounts.accessories.wrist,
        mounts.accessories.propLeft,
        mounts.accessories.propRight,
        mounts.accessories.propLaptop,
        mounts.accessories.propBoth,
        mounts.accessories.back,
      ];
  }
}

export function getAccessorySubSlotMounts(
  mounts: SlotMounts,
  subSlot: AccessorySubSlot,
): THREE.Group[] {
  switch (subSlot) {
    case "eyewear":
      return [mounts.accessories.eyewear];
    case "headwear":
      return [mounts.accessories.headwear];
    case "headset":
      return [mounts.accessories.headset];
    case "badge":
      return [mounts.accessories.badge];
    case "wrist":
      return [mounts.accessories.wrist];
    case "prop":
      return [
        mounts.accessories.propLeft,
        mounts.accessories.propRight,
        mounts.accessories.propLaptop,
        mounts.accessories.propBoth,
      ];
    case "back":
      return [mounts.accessories.back];
  }
}

export function createHumanoidSkeleton(female: boolean): {
  skeleton: HumanoidSkeleton;
  mounts: SlotMounts;
} {
  const dims = getHumanoidDimensions(female);
  const root = group("humanoid-root");
  const turntable = group("turntable");
  root.add(turntable);

  // Pelvis parents BOTH spine and thighs (eliminates hip/waist detachment in walk!)
  const pelvis = group("pelvis", [0, PELVIS_Y, 0]);
  turntable.add(pelvis);

  const spine = group("spine", [0, SPINE_LOCAL_Y, 0]);
  const chest = group("chest", [0, CHEST_LOCAL_Y, 0]);
  const neck = group("neck", [0, NECK_LOCAL_Y, 0]);
  const head = group("head", [0, HEAD_LOCAL_Y, 0]);
  head.scale.setScalar(dims.headScale);

  pelvis.add(spine);
  spine.add(chest);
  chest.add(neck);
  neck.add(head);

  const clavicleOffset = dims.clavicleSpan * 0.42;
  const upperArmOffset = Math.max(0.036, dims.shoulderHalfWidth - clavicleOffset);

  const leftClavicle = group("leftClavicle", [-clavicleOffset, SHOULDER_LOCAL_Y, 0]);
  const leftUpperArm = group("leftUpperArm", [-upperArmOffset, -0.008, 0]);
  const leftForearm = group("leftForearm", [0, -UPPER_ARM_LENGTH, 0]);
  const leftHand = group("leftHand", [0, -FOREARM_LENGTH, 0]);
  chest.add(leftClavicle);
  leftClavicle.add(leftUpperArm);
  leftUpperArm.add(leftForearm);
  leftForearm.add(leftHand);

  const rightClavicle = group("rightClavicle", [clavicleOffset, SHOULDER_LOCAL_Y, 0]);
  const rightUpperArm = group("rightUpperArm", [upperArmOffset, -0.008, 0]);
  const rightForearm = group("rightForearm", [0, -UPPER_ARM_LENGTH, 0]);
  const rightHand = group("rightHand", [0, -FOREARM_LENGTH, 0]);
  chest.add(rightClavicle);
  rightClavicle.add(rightUpperArm);
  rightUpperArm.add(rightForearm);
  rightForearm.add(rightHand);

  const leftThigh = group("leftThigh", [-dims.hipX, 0, 0]);
  const leftShin = group("leftShin", [0, -THIGH_LENGTH, 0]);
  const leftAnkle = group("leftAnkle", [0, -SHIN_LENGTH, 0]);
  const leftFoot = group("leftFoot", [0, 0, 0]);
  pelvis.add(leftThigh);
  leftThigh.add(leftShin);
  leftShin.add(leftAnkle);
  leftAnkle.add(leftFoot);

  const rightThigh = group("rightThigh", [dims.hipX, 0, 0]);
  const rightShin = group("rightShin", [0, -THIGH_LENGTH, 0]);
  const rightAnkle = group("rightAnkle", [0, -SHIN_LENGTH, 0]);
  const rightFoot = group("rightFoot", [0, 0, 0]);
  pelvis.add(rightThigh);
  rightThigh.add(rightShin);
  rightShin.add(rightAnkle);
  rightAnkle.add(rightFoot);

  // Attachable slot mount groups
  const hair_slot = group("hair_slot");
  const face_slot = group("face_slot");
  head.add(hair_slot, face_slot);

  const upper_body_slot = group("upper_body_slot");
  const uniform_slot = group("uniform_slot");
  chest.add(upper_body_slot, uniform_slot);

  const leftUpperSleeve = group("upper_sleeve_left");
  const leftForearmSleeve = group("forearm_sleeve_left");
  const rightUpperSleeve = group("upper_sleeve_right");
  const rightForearmSleeve = group("forearm_sleeve_right");
  leftUpperArm.add(leftUpperSleeve);
  leftForearm.add(leftForearmSleeve);
  rightUpperArm.add(rightUpperSleeve);
  rightForearm.add(rightForearmSleeve);

  const lower_body_slot = group("lower_body_slot");
  pelvis.add(lower_body_slot);
  const leftThighLower = group("lower_thigh_left");
  const leftShinLower = group("lower_shin_left");
  const rightThighLower = group("lower_thigh_right");
  const rightShinLower = group("lower_shin_right");
  leftThigh.add(leftThighLower);
  leftShin.add(leftShinLower);
  rightThigh.add(rightThighLower);
  rightShin.add(rightShinLower);

  const footwear_slot = group("footwear_slot");
  pelvis.add(footwear_slot);
  const leftFootMount = group("footwear_left");
  const rightFootMount = group("footwear_right");
  leftFoot.add(leftFootMount);
  rightFoot.add(rightFootMount);

  const accessory_slot = group("accessory_slot");
  chest.add(accessory_slot);
  const eyewear = group("acc_mount_eyewear");
  const headwear = group("acc_mount_headwear");
  const headset = group("acc_mount_headset");
  head.add(eyewear, headwear, headset);

  const badge = group("acc_mount_badge");
  const back = group("acc_mount_back");
  const propBoth = group("acc_mount_prop_both");
  chest.add(badge, back, propBoth);

  const wrist = group("acc_mount_wrist");
  const propLaptop = group("acc_mount_prop_laptop");
  leftForearm.add(wrist, propLaptop);

  const propLeft = group("acc_mount_prop_left");
  leftHand.add(propLeft);

  const propRight = group("acc_mount_prop_right");
  rightHand.add(propRight);

  return {
    skeleton: {
      root,
      turntable,
      pelvis,
      spine,
      chest,
      neck,
      head,
      leftClavicle,
      leftUpperArm,
      leftForearm,
      leftHand,
      rightClavicle,
      rightUpperArm,
      rightForearm,
      rightHand,
      leftThigh,
      leftShin,
      leftAnkle,
      leftFoot,
      rightThigh,
      rightShin,
      rightAnkle,
      rightFoot,
    },
    mounts: {
      hair_slot,
      face_slot,
      upper_body_slot,
      lower_body_slot,
      footwear_slot,
      accessory_slot,
      uniform_slot,
      sleeves: {
        leftUpper: leftUpperSleeve,
        leftForearm: leftForearmSleeve,
        rightUpper: rightUpperSleeve,
        rightForearm: rightForearmSleeve,
      },
      legs: {
        leftThigh: leftThighLower,
        leftShin: leftShinLower,
        rightThigh: rightThighLower,
        rightShin: rightShinLower,
      },
      feet: {
        left: leftFootMount,
        right: rightFootMount,
      },
      accessories: {
        eyewear,
        headwear,
        headset,
        badge,
        wrist,
        propLeft,
        propRight,
        propLaptop,
        propBoth,
        back,
      },
    },
  };
}
