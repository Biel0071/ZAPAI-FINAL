import type { ChibiRig } from "./buildBody";
import type { HoldPose } from "./buildAccessories";

export type Movement3D = "idle" | "walk" | "wave" | "pose" | "spin360";

const ARM_REST_Z = 0.12;

export function animateChibi(rig: ChibiRig, hold: HoldPose, movement: Movement3D, t: number): void {
  const walking = movement === "walk";
  const step = Math.sin(t * 6);

  rig.body.position.y = walking ? Math.abs(step) * 0.04 : Math.sin(t * 2) * 0.012;
  rig.head.rotation.set(0, 0, Math.sin(t * 1.3) * 0.03);
  rig.leftLeg.rotation.x = walking ? step * 0.5 : 0;
  rig.rightLeg.rotation.x = walking ? -step * 0.5 : 0;

  rig.leftArm.rotation.set(walking ? -step * 0.4 : 0, 0, -ARM_REST_Z);
  rig.rightArm.rotation.set(walking ? step * 0.4 : 0, 0, ARM_REST_Z);

  if (hold.both) {
    rig.leftArm.rotation.set(-1.25, 0, -0.05);
    rig.rightArm.rotation.set(-1.25, 0, 0.05);
  }
  if (hold.left) rig.leftArm.rotation.set(-0.95, 0, -0.1);
  if (hold.right) rig.rightArm.rotation.set(-0.95, 0, 0.1);

  if (movement === "wave") {
    rig.rightArm.rotation.set(0, 0, 2.5 + Math.sin(t * 8) * 0.28);
    rig.head.rotation.z = -0.08;
  }
  if (movement === "pose") {
    if (!hold.left && !hold.both) rig.leftArm.rotation.set(0.1, 0, -0.75);
    rig.rightArm.rotation.set(0, 0, 2.3);
    rig.head.rotation.set(0.05, 0.15, -0.1);
  }
}