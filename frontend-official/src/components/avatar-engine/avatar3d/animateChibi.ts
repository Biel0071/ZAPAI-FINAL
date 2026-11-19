import type { ChibiRig } from "./buildBody";
import type { HoldPose } from "./buildAccessories";
import {
  AvatarAnimationFSM,
  resolveAnimStateFromProps,
  type Movement3D,
} from "./animationStateMachine";

export type { Movement3D };

const defaultFsm = new AvatarAnimationFSM("idle");

export function animateChibi(
  rig: ChibiRig,
  hold: HoldPose,
  movement: Movement3D,
  _t: number,
  dt = 1 / 60,
): void {
  const target = resolveAnimStateFromProps(movement);
  defaultFsm.bindRig(rig);
  defaultFsm.setState(target);
  defaultFsm.update(dt, rig, hold);
}
