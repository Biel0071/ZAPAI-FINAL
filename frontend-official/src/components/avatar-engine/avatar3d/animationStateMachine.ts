import type { AnimationState } from "../AvatarDefinition";
import type { ChibiRig } from "./buildBody";
import type { HoldPose } from "./buildAccessories";
import type { PoseId } from "./slotCatalog";

export type Movement3D = "idle" | "walk" | "wave" | "pose" | "spin360";

export type AvatarAnimState =
  | "idle"
  | "walk"
  | "wave"
  | "pose"
  | "thinking"
  | "typing"
  | "attending"
  | "celebrating"
  | "error"
  | "disconnected";

export const ALL_AVATAR_ANIM_STATES: AvatarAnimState[] = [
  "idle",
  "walk",
  "wave",
  "pose",
  "thinking",
  "typing",
  "attending",
  "celebrating",
  "error",
  "disconnected",
];

interface JointTargets {
  pelvisY: number;
  pelvisRotX: number;
  pelvisRotY: number;
  pelvisRotZ: number;
  spineRotX: number;
  spineRotY: number;
  spineRotZ: number;
  chestRotX: number;
  chestRotY: number;
  chestRotZ: number;
  neckRotX: number;
  neckRotY: number;
  headRotX: number;
  headRotY: number;
  headRotZ: number;

  leftClavicleZ: number;
  rightClavicleZ: number;

  leftUpperArmX: number;
  leftUpperArmY: number;
  leftUpperArmZ: number;
  leftForearmX: number;
  leftForearmZ: number;
  leftHandX: number;
  leftHandY: number;
  leftHandZ: number;

  rightUpperArmX: number;
  rightUpperArmY: number;
  rightUpperArmZ: number;
  rightForearmX: number;
  rightForearmZ: number;
  rightHandX: number;
  rightHandY: number;
  rightHandZ: number;

  leftThighX: number;
  leftThighZ: number;
  leftShinX: number;
  leftAnkleX: number;

  rightThighX: number;
  rightThighZ: number;
  rightShinX: number;
  rightAnkleX: number;

  peaceFactor: number;
  rightPropStow: number; // 1 = stowed/hidden (e.g. during wave), 0 = visible
  blinkLeft: number;
  blinkRight: number;
  browLift: number;
  browTilt: number;
  smile: number;
  mouthOpen: number;
}

function createZeroPose(): JointTargets {
  return {
    pelvisY: 0,
    pelvisRotX: 0,
    pelvisRotY: 0,
    pelvisRotZ: 0,
    spineRotX: 0,
    spineRotY: 0,
    spineRotZ: 0,
    chestRotX: 0,
    chestRotY: 0,
    chestRotZ: 0,
    neckRotX: 0,
    neckRotY: 0,
    headRotX: 0,
    headRotY: 0,
    headRotZ: 0,

    leftClavicleZ: 0,
    rightClavicleZ: 0,

    leftUpperArmX: 0.03,
    leftUpperArmY: 0,
    leftUpperArmZ: -0.14,
    leftForearmX: -0.16,
    leftForearmZ: 0.04,
    leftHandX: 0,
    leftHandY: 0,
    leftHandZ: 0,

    rightUpperArmX: 0.03,
    rightUpperArmY: 0,
    rightUpperArmZ: 0.14,
    rightForearmX: -0.16,
    rightForearmZ: -0.04,
    rightHandX: 0,
    rightHandY: 0,
    rightHandZ: 0,

    leftThighX: 0,
    leftThighZ: -0.02,
    leftShinX: 0.03,
    leftAnkleX: -0.02,

    rightThighX: 0,
    rightThighZ: 0.02,
    rightShinX: 0.03,
    rightAnkleX: -0.02,

    peaceFactor: 0,
    rightPropStow: 0,
    blinkLeft: 0,
    blinkRight: 0,
    browLift: 0,
    browTilt: 0,
    smile: 0,
    mouthOpen: 0,
  };
}

export function resolveAnimStateFromProps(
  movement3D?: Movement3D,
  operationalState?: AnimationState | string,
): AvatarAnimState {
  if (movement3D === "walk") return "walk";
  if (movement3D === "wave") return "wave";
  if (movement3D === "pose") return "pose";

  const op = String(operationalState || "").toUpperCase();
  if (op === "WALKING") return "walk";
  if (op === "THINKING") return "thinking";
  if (op === "TYPING" || op === "WORKING") return "typing";
  if (op === "TALKING") return "attending";
  if (op === "SUCCESS") return "celebrating";
  if (op === "ERROR" || op === "ALERT") return "error";
  if (op === "OFFLINE") return "disconnected";
  return "idle";
}

export class AvatarAnimationFSM {
  private currentState: AvatarAnimState = "idle";
  private previousState: AvatarAnimState | null = null;
  private poseId: PoseId = "pose_executive";
  private stateElapsed = 0;
  private totalTime = 0;
  private blinkTimer = 0;
  private nextBlinkAt = 3.4;
  private basePelvisY = 0;
  private current: JointTargets = createZeroPose();

  constructor(initialState: AvatarAnimState = "idle", poseId: PoseId = "pose_executive") {
    this.currentState = initialState;
    this.poseId = poseId;
  }

  getState(): AvatarAnimState {
    return this.currentState;
  }

  getPreviousState(): AvatarAnimState | null {
    return this.previousState;
  }

  getPoseId(): PoseId {
    return this.poseId;
  }

  getSnapshot(): Readonly<JointTargets> {
    return { ...this.current };
  }

  setState(next: AvatarAnimState, poseId?: PoseId): void {
    if (poseId) {
      this.poseId = poseId;
    }
    if (next === this.currentState) return;
    this.previousState = this.currentState;
    this.currentState = next;
    this.stateElapsed = 0;
  }

  setPoseId(poseId: PoseId): void {
    this.poseId = poseId;
  }

  bindRig(rig: ChibiRig): void {
    this.basePelvisY = rig.skeleton.pelvis.position.y;
  }

  private computeTargetPose(hold: HoldPose): JointTargets {
    const t = this.totalTime;
    const st = this.stateElapsed;
    const target = createZeroPose();

    // Natural blink every ~3.4s
    let blink = 0;
    if (this.currentState !== "disconnected") {
      const blinkProgress = this.blinkTimer - this.nextBlinkAt;
      if (blinkProgress >= 0 && blinkProgress <= 0.16) {
        blink = Math.sin((blinkProgress / 0.16) * Math.PI);
      }
    }
    target.blinkLeft = blink;
    target.blinkRight = blink;

    switch (this.currentState) {
      case "idle": {
        const breathe = Math.sin(t * 2.1);
        target.pelvisY = breathe * 0.004;
        target.chestRotX = breathe * 0.014;
        target.headRotY = Math.sin(t * 0.7) * 0.045;
        target.headRotZ = Math.sin(t * 0.55) * 0.022;
        target.leftUpperArmZ = -0.16 - breathe * 0.01;
        target.rightUpperArmZ = 0.16 + breathe * 0.01;
        target.leftForearmX = -0.18;
        target.rightForearmX = -0.18;
        break;
      }

      case "walk": {
        const phase = st * 5.6;
        const s = Math.sin(phase);
        const c = Math.cos(phase);
        target.pelvisY = Math.abs(s) * 0.026 - 0.008;
        target.pelvisRotY = s * 0.065;
        target.pelvisRotZ = -s * 0.025;
        target.spineRotX = 0.045;
        target.chestRotY = -s * 0.055;
        target.headRotY = s * 0.02;

        // Alternating stride: negative X is forward (+Z)
        target.leftThighX = -s * 0.42;
        target.rightThighX = s * 0.42;
        target.leftShinX = Math.max(0.05, c * 0.48 + 0.14);
        target.rightShinX = Math.max(0.05, -c * 0.48 + 0.14);
        target.leftAnkleX = s * 0.16;
        target.rightAnkleX = -s * 0.16;

        // Opposite arm + clavicle swing
        target.leftClavicleZ = -s * 0.035;
        target.rightClavicleZ = -s * 0.035;
        target.leftUpperArmX = s * 0.34;
        target.rightUpperArmX = -s * 0.34;
        target.leftForearmX = -0.22 - Math.max(0, s) * 0.2;
        target.rightForearmX = -0.22 - Math.max(0, -s) * 0.2;
        target.leftUpperArmZ = -0.13;
        target.rightUpperArmZ = 0.13;
        break;
      }

      case "wave": {
        // Stow right-hand prop so coffee cup / smartphone is never waved upside down
        target.rightPropStow = 1;
        target.pelvisY = Math.sin(t * 2.4) * 0.005;
        target.spineRotZ = -0.04;
        target.headRotZ = -0.07;
        target.headRotY = -0.06;
        target.rightClavicleZ = 0.16;
        target.rightUpperArmX = -0.38;
        target.rightUpperArmY = 0.12;
        target.rightUpperArmZ = 2.08;
        target.rightForearmX = -0.22;
        target.rightForearmZ = 0.65 + Math.sin(st * 7.2) * 0.32;
        target.rightHandZ = Math.sin(st * 7.2) * 0.22;
        target.leftUpperArmZ = -0.16;
        target.leftForearmX = -0.25;
        target.smile = 0.35;
        target.browLift = 0.004;
        break;
      }

      case "pose": {
        if (this.poseId === "pose_peace") {
          target.rightPropStow = 1;
          target.pelvisRotY = 0.1;
          target.pelvisRotZ = -0.03;
          target.chestRotY = -0.08;
          target.headRotZ = -0.08;
          target.headRotY = 0.06;
          target.rightUpperArmX = -0.76;
          target.rightUpperArmY = 0.04;
          target.rightUpperArmZ = 0.44;
          target.rightForearmX = -1.36;
          target.rightForearmZ = -0.12;
          target.rightHandY = -0.32;
          target.rightHandZ = 0.14;
          target.peaceFactor = 1;
          // Left arm on hip
          target.leftUpperArmX = 0.08;
          target.leftUpperArmZ = -0.44;
          target.leftForearmX = -0.85;
          target.leftForearmZ = 0.52;
          target.smile = 0.45;
          target.browLift = 0.004;
        } else if (this.poseId === "pose_consultative") {
          target.spineRotX = 0.06;
          target.headRotZ = 0.03;
          target.leftUpperArmX = -0.45;
          target.leftUpperArmZ = -0.28;
          target.leftForearmX = -0.82;
          target.leftHandY = 0.4;
          target.rightUpperArmX = -0.45;
          target.rightUpperArmZ = 0.28;
          target.rightForearmX = -0.82;
          target.rightHandY = -0.4;
          target.smile = 0.3;
          target.browLift = 0.003;
        } else if (this.poseId === "pose_hero") {
          target.pelvisY = 0.01;
          target.leftThighZ = -0.08;
          target.rightThighZ = 0.08;
          target.chestRotX = -0.04;
          target.leftUpperArmX = 0.08;
          target.leftUpperArmZ = -0.48;
          target.leftForearmX = -0.92;
          target.leftForearmZ = 0.6;
          target.rightUpperArmX = 0.08;
          target.rightUpperArmZ = 0.48;
          target.rightForearmX = -0.92;
          target.rightForearmZ = -0.6;
          target.smile = 0.35;
          target.browTilt = -0.04;
        } else {
          // pose_executive
          target.pelvisRotY = 0.14;
          target.chestRotY = -0.06;
          target.headRotY = -0.06;
          target.leftUpperArmX = 0.05;
          target.leftUpperArmZ = -0.38;
          target.leftForearmX = -0.88;
          target.leftForearmZ = 0.48;
          target.rightUpperArmX = -0.15;
          target.rightUpperArmZ = 0.16;
          target.rightForearmX = -0.42;
          target.smile = 0.25;
        }
        break;
      }

      case "thinking": {
        target.pelvisRotZ = 0.025;
        target.spineRotX = 0.03;
        target.headRotX = -0.08;
        target.headRotY = -0.14 + Math.sin(t * 1.1) * 0.04;
        target.headRotZ = 0.09;
        // Left arm folded across torso supporting right elbow
        target.leftUpperArmX = -0.42;
        target.leftUpperArmZ = -0.14;
        target.leftForearmX = -1.25;
        target.leftForearmZ = 0.72;
        // Right hand near chin
        target.rightUpperArmX = -0.62;
        target.rightUpperArmZ = 0.24;
        target.rightForearmX = -1.72;
        target.rightForearmZ = -0.48;
        target.rightPropStow = 1;
        target.browTilt = 0.12;
        target.smile = -0.25;
        break;
      }

      case "typing": {
        const tapL = Math.sin(t * 15) * 0.08;
        const tapR = Math.cos(t * 15) * 0.08;
        target.spineRotX = 0.09;
        target.headRotX = 0.12;
        target.leftUpperArmX = -0.56;
        target.leftUpperArmZ = -0.12;
        target.leftForearmX = -1.08 + tapL;
        target.leftForearmZ = 0.18;
        target.leftHandX = tapL * 1.4;
        target.rightUpperArmX = -0.56;
        target.rightUpperArmZ = 0.12;
        target.rightForearmX = -1.08 + tapR;
        target.rightForearmZ = -0.18;
        target.rightHandX = tapR * 1.4;
        target.browTilt = 0.06;
        break;
      }

      case "attending": {
        const talk = Math.sin(t * 3.8);
        const mouthWave = (Math.sin(t * 11.5) * 0.5 + 0.5) * 0.35;
        target.spineRotX = 0.04;
        target.headRotY = Math.sin(t * 1.8) * 0.07;
        target.headRotX = Math.sin(t * 3.2) * 0.035;
        target.leftUpperArmX = -0.35 + talk * 0.08;
        target.leftUpperArmZ = -0.22;
        target.leftForearmX = -0.82 + talk * 0.14;
        target.leftHandY = 0.32;
        target.rightUpperArmX = -0.35 - talk * 0.08;
        target.rightUpperArmZ = 0.22;
        target.rightForearmX = -0.82 - talk * 0.14;
        target.rightHandY = -0.32;
        target.smile = 0.25;
        target.mouthOpen = mouthWave;
        break;
      }

      case "celebrating": {
        const bounce = Math.abs(Math.sin(st * 5.8));
        target.pelvisY = bounce * 0.05;
        target.chestRotX = -0.06;
        target.headRotX = -0.06;
        target.leftClavicleZ = -0.22;
        target.rightClavicleZ = 0.22;
        target.leftUpperArmX = -0.25;
        target.leftUpperArmZ = -2.35 + Math.sin(st * 8) * 0.12;
        target.leftForearmX = -0.35;
        target.leftForearmZ = -0.3;
        target.rightUpperArmX = -0.25;
        target.rightUpperArmZ = 2.35 - Math.sin(st * 8) * 0.12;
        target.rightForearmX = -0.35;
        target.rightForearmZ = 0.3;
        target.rightPropStow = 1;
        target.smile = 0.5;
        target.mouthOpen = 0.45;
        target.browLift = 0.006;
        break;
      }

      case "error": {
        target.pelvisY = -0.012;
        target.spineRotX = -0.05;
        target.headRotX = 0.06;
        target.headRotZ = 0.11 + Math.sin(st * 6) * 0.02;
        target.leftClavicleZ = -0.14;
        target.rightClavicleZ = 0.14;
        target.leftUpperArmX = -0.32;
        target.leftUpperArmZ = -0.24;
        target.leftForearmX = -0.78;
        target.rightUpperArmX = -0.68;
        target.rightUpperArmZ = 0.32;
        target.rightForearmX = -1.35;
        target.rightPropStow = 1;
        target.browTilt = 0.16;
        target.browLift = 0.002;
        target.smile = -0.45;
        target.mouthOpen = 0.18;
        break;
      }

      case "disconnected": {
        target.pelvisY = -0.015;
        target.spineRotX = 0.08;
        target.neckRotX = 0.12;
        target.headRotX = 0.22;
        target.leftClavicleZ = 0.08;
        target.rightClavicleZ = -0.08;
        target.leftUpperArmX = 0.06;
        target.leftUpperArmZ = -0.07;
        target.leftForearmX = -0.08;
        target.rightUpperArmX = 0.06;
        target.rightUpperArmZ = 0.07;
        target.rightForearmX = -0.08;
        target.blinkLeft = 0.82;
        target.blinkRight = 0.82;
        target.smile = -0.2;
        target.browLift = -0.002;
        break;
      }
    }

    // Respect held props in idle/walk/attending/pose_executive when not stowed
    if (
      target.rightPropStow < 0.5 &&
      this.currentState !== "typing" &&
      this.currentState !== "disconnected"
    ) {
      if (hold.both) {
        target.leftUpperArmX = -0.72;
        target.leftUpperArmZ = -0.08;
        target.leftForearmX = -0.95;
        target.leftForearmZ = 0.18;
        target.rightUpperArmX = -0.72;
        target.rightUpperArmZ = 0.08;
        target.rightForearmX = -0.95;
        target.rightForearmZ = -0.18;
      } else {
        if (hold.left) {
          target.leftUpperArmX = -0.48;
          target.leftUpperArmZ = -0.12;
          target.leftForearmX = -1.02;
        }
        if (hold.right) {
          target.rightUpperArmX = -0.48;
          target.rightUpperArmZ = 0.12;
          target.rightForearmX = -1.02;
        }
      }
    }

    return target;
  }

  update(dt: number, rig: ChibiRig, hold: HoldPose): void {
    const safeDt = Math.min(Math.max(dt, 0), 0.1);
    this.totalTime += safeDt;
    this.stateElapsed += safeDt;

    this.blinkTimer += safeDt;
    if (this.blinkTimer > this.nextBlinkAt + 0.25) {
      this.blinkTimer = 0;
      this.nextBlinkAt = 2.8 + ((this.totalTime * 1.7) % 2.1);
    }

    const target = this.computeTargetPose(hold);
    const alpha = safeDt === 0 ? 1 : 1 - Math.exp(-11 * safeDt);

    const keys = Object.keys(this.current) as Array<keyof JointTargets>;
    for (const k of keys) {
      this.current[k] += (target[k] - this.current[k]) * alpha;
    }

    this.applyToRig(rig, hold);
  }

  private applyToRig(rig: ChibiRig, hold: HoldPose): void {
    const s = rig.skeleton;
    const p = this.current;

    const basePelvis = this.basePelvisY || s.pelvis.position.y;
    if (!this.basePelvisY) this.basePelvisY = s.pelvis.position.y;

    s.pelvis.position.y = basePelvis + p.pelvisY;
    s.pelvis.rotation.set(p.pelvisRotX, p.pelvisRotY, p.pelvisRotZ);
    s.spine.rotation.set(p.spineRotX, p.spineRotY, p.spineRotZ);
    s.chest.rotation.set(p.chestRotX, p.chestRotY, p.chestRotZ);
    s.neck.rotation.set(p.neckRotX, p.neckRotY, 0);
    s.head.rotation.set(p.headRotX, p.headRotY, p.headRotZ);

    s.leftClavicle.rotation.z = p.leftClavicleZ;
    s.rightClavicle.rotation.z = p.rightClavicleZ;

    s.leftUpperArm.rotation.set(p.leftUpperArmX, p.leftUpperArmY, p.leftUpperArmZ);
    s.leftForearm.rotation.set(p.leftForearmX, 0, p.leftForearmZ);
    s.leftHand.rotation.set(p.leftHandX, p.leftHandY, p.leftHandZ);

    s.rightUpperArm.rotation.set(p.rightUpperArmX, p.rightUpperArmY, p.rightUpperArmZ);
    s.rightForearm.rotation.set(p.rightForearmX, 0, p.rightForearmZ);
    s.rightHand.rotation.set(p.rightHandX, p.rightHandY, p.rightHandZ);

    s.leftThigh.rotation.set(p.leftThighX, 0, p.leftThighZ);
    s.leftShin.rotation.set(p.leftShinX, 0, 0);
    s.leftAnkle.rotation.set(p.leftAnkleX, 0, 0);

    s.rightThigh.rotation.set(p.rightThighX, 0, p.rightThighZ);
    s.rightShin.rotation.set(p.rightShinX, 0, 0);
    s.rightAnkle.rotation.set(p.rightAnkleX, 0, 0);

    // Stow right-hand prop cleanly during wave/peace/thinking/celebrating/error
    const stowRight = p.rightPropStow > 0.35;
    rig.mounts.accessories.propRight.visible = !stowRight;
    rig.mounts.accessories.propBoth.visible = !stowRight;

    // Articulated hands & V-sign fingers (no floating duplicate fingers!)
    if (p.peaceFactor > 0.08) {
      rig.rightHandControls.setPose("peace", p.peaceFactor);
    } else if (hold.right && !stowRight) {
      rig.rightHandControls.setPose("hold", 0);
    } else {
      rig.rightHandControls.setPose("rest", 0);
    }

    if (hold.left || hold.both) {
      rig.leftHandControls.setPose("hold", 0);
    } else {
      rig.leftHandControls.setPose("rest", 0);
    }

    // 3D Eyelids, eyebrows, and sculpted lips
    rig.faceControls.setExpressionState({
      blinkLeft: p.blinkLeft,
      blinkRight: p.blinkRight,
      browLift: p.browLift,
      browTilt: p.browTilt,
      smile: p.smile,
      mouthOpen: p.mouthOpen,
    });
  }
}
