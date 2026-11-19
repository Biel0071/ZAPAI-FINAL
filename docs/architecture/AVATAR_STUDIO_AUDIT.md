# Avatar Studio & 3D Character Audit (`ZAI Enterprise`)

**Date:** 2026-11-18  
**Scope:** `frontend-official/src/components/avatar-engine/**`, `AttendantsPage.tsx`, `AvatarEditorModal.tsx`, and per-attendant persistence (`aiAgentService.js`, `migrations/038`, `053`).

---

## 1. Current Dual-Engine Architecture & Structural Flaws

1. **Divergent 3D Stage vs. 2D Sprite Cards:**
   - `ZaiAvatar3D.tsx` renders Three.js geometry **only** inside the Avatar Studio stage.
   - Outside the stage (`AttendantItemCard.tsx`, `AttendantsPage.tsx:2947,3174`, `EvolutionTab.tsx`, `AvatarItemPreview.tsx`), the UI falls back to `ZaiAvatarRenderer.tsx`, which hardcodes `const angle = 0` (`line 280`) and displays baked PNG sprites (`sprite_r*_c*_clean.png`), leaving `bodyImg` unused (`line 351`). As a result, male agents (`João Silva`) and multiple outfits display identical 2D female pixel sprites in cards and thumbnails.
2. **Disconnected 3D Skeleton (`buildBody.ts` + `animateChibi.ts`):**
   - `leg-left` and `leg-right` attach directly to `rig.root` (`buildBody.ts:224-226`), whereas `animateChibi.ts:12` lifts `rig.body.position.y` during `walk`, detaching torso from hips on every step.
   - Arms (`arm-left`, `arm-right`) and legs lack clavicle, elbow, wrist, thigh/knee, and ankle articulation.
   - Facial features (`faceTexture.ts`) are drawn as a 2D `CanvasTexture` decal surrounded by thick black inverted-hull outlines (`outline.ts`), contributing to a flat 2D sticker appearance.

---

## 2. Root Causes of Cross-Slot Contamination

1. **Hair Changes Overwrite Hair Color, Headwear, Beard & Eyewear:**
   - `AvatarDefinition.ts:275-329` (`HAIR_ID_TO_COLOR`) ignores `avatar.hairColor` whenever `hair_01..hair_18` is selected.
   - `look3d.ts:64-124` couples `hair_11`/`hair_14` -> forced cap, `hair_13` -> hardhat, `hair_16` -> beard, `hair_18` -> glasses.
2. **Face Changes Overwrite Eyewear, Beard & Skin Tone:**
   - `look3d.ts:109-121` forces `glasses + beard` on `face_07` and `sunglasses` (wiping `glasses`) on `face_08`; `avatarLook.ts:90-93` ties skin tone to `face_04`/`face_06` when unspecified.
3. **Gender Toggle Resets Hair & Face:**
   - `AttendantsPage.tsx:1513-1554` and `AvatarEditorModal.tsx:281-300` reset `hair` and `face` when toggling `Fem` / `Masc`.
4. **Shared Scalar Accessory Fields & Unmapped Items:**
   - `acc_05`, `acc_08`, `acc_09`, `acc_10` overwrite a single `avatar.workObject` string; `acc_04` and `acc_07` overwrite `avatar.glasses`.
   - `CLOTHING_STYLES`, `WORK_OBJECTS`, and `ACCESSORIES` items such as `smartwatch_neon`, `badge_clip_chest`, `earbud_minimal`, `smartphone_chat`, and `clipboard_sales` lack 3D rig builders.
   - Outfit had no separate `upper_body_slot`, `lower_body_slot`, `footwear_slot`, and `uniform_slot`.
5. **Broken Thumbnails (`AvatarItemPreview.tsx`):**
   - Ignores `spriteRef` visually and maps only `acc_02..acc_06`; `outfit_01..10` (except `05`/`06`) and `acc_07..12` render identical previews.

---

## 3. Animation, Spin & Camera Defects (`animateChibi.ts` & `ZaiAvatar3D.tsx`)

- **Stateless clock (`clock.elapsedTime`)**: No animation state machine or blend transitions.
- **`Acenar 3D` (`wave`)**: Lifts right arm to `2.15 rad` even when holding `coffee_cup` (inverting the cup overhead); silently no-ops with `boxes`.
- **`Posar 3D` (`pose`)**: Sets `rig.peace.visible = true` (`line 27`) without hiding `rightHand` sphere, causing duplicate fingers protruding from the spherical palm.
- **`Giro Contínuo`**: Both `AttendantsPage.tsx:673-687` and `AvatarEditorModal.tsx:151-169` pass `controlled={true}` to `ZaiAvatar3D` and mutate React state via 25fps `requestAnimationFrame` loops, causing unnecessary React re-renders and lag.
- **Zero Camera Controls**: Fixed camera `(0, 1.42, 5.85)` with no drag orbit, scroll zoom, or preset framing.
- **Disconnected Operational States**: `thinking`, `typing`, `attending`, `celebrating`, `error`, and `disconnected` never animate inside `ZaiAvatar3D`.

---

## 4. Target Modular 3D Architecture

- Articulated humanoid skeleton (`root -> turntable -> pelvis -> { spine -> chest -> neck -> head, clavicles -> upperArms -> forearms -> hands }, thighs -> shins -> ankles -> feet`) with 3D sculpted head, 3D eyes/irises/eyelids, 3D brows, and 3D mouth inside `face_slot`.
- Strictly isolated slots: `hair_slot`, `face_slot`, `upper_body_slot`, `lower_body_slot`, `footwear_slot`, `accessory_slot` (`headwear`, `eyewear`, `headset`, `badge`, `wrist`, `prop`, `back`), `uniform_slot`, and `style_slot` + independent `hairColor`, `skinTone`, `gender`.
- Finite State Machine (`AvatarAnimationFSM`) guaranteeing mutually exclusive skeletal control across `idle`, `walk`, `wave`, `pose`, `thinking`, `typing`, `attending`, `celebrating`, `error`, and `disconnected`, plus WebGL-native turntable spin and interactive orbit/zoom camera.
- Versioned avatar persistence per `(company_id, agent_key)` plus saved 3D portrait snapshots (`snapshotDataUrl`) rendered across attendant cards and drawers.
