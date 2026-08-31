// src/lib/nexapp/frameLights.ts · Philip 2026-08-29 BATCH 3 (prep).
//
// NEX FRAME LIGHT SYSTEM · state model + API surface only.
//
// This module is INFRASTRUCTURE-ONLY. No visual rendering has been added
// yet. The current `hud-frame-v12.png` and its baked-in orange pixels
// remain fully visible and unchanged. NexHudFrame does not consume this
// module yet · consumers will be wired in a follow-up batch.
//
// Purpose · establish the shape of the light-control API so that the
// future implementation is a pure additive change:
//   1. Swap hud-frame-v12.png → hud-frame-v13-nolights.png (external asset work)
//   2. Add CSS overlay layers to NexHudFrame per region
//   3. Wire NexAppShell to derive a FrameLightMap from progression signals
//   4. Bind overlay opacity/animation to FrameLightState per region
//
// Not touched by this file:
//   · NexHudFrame · NexAppShell · NexVoiceOrb · NexSideDrawer · NexRoomDrawer
//   · hud-frame-v12.png · any frame geometry
//   · Existing header light bar / kebab dots (still CSS-drawn in NexHudFrame)
//
// Doctrine anchors:
//   · SHIP MODE / batch workflow · feedback_ship_mode_batch_workflow_2026_08_29
//   · Master frame lock · project_nex_master_frame_locked_asset_2026_08_28

// ── Addressable regions ────────────────────────────────────────────────────
//
// Six independently-controllable illumination areas of the NEX phone frame.
// Each maps to a specific baked-pixel zone in hud-frame-v12.png. Pixel
// coordinates for each region will be measured from the actual asset when
// overlay rendering is implemented in a follow-up batch.
//
//   rail    · 5 rail-button rim glows on the right side of the bezel
//   footer  · centre orange bar in the footer strip (below composer)
//   corners · bottom-left + bottom-right accent points at the base
//   edge    · left-side vertical stripe glow along the bezel
//   header  · top-centre orange bar (currently a CSS-drawn <div> in NexHudFrame)
//   kebab   · 3-dot lights below the rail (currently CSS-drawn in NexHudFrame)

export type FrameLightRegion =
  | "rail"
  | "footer"
  | "corners"
  | "edge"
  | "header"
  | "kebab";

// ── Illumination state per region ──────────────────────────────────────────
//
//   off    · fully dark · no glow, no visible baked pixels (requires v13 asset)
//   dim    · faint ambient · barely visible · signals "asleep / waiting"
//   on     · steady bright · fully active illumination
//   pulse  · animated breathing · signals "listening / thinking / processing"

export type FrameLightState = "off" | "dim" | "on" | "pulse";

// ── Complete illumination map · one state per region ───────────────────────

export type FrameLightMap = Record<FrameLightRegion, FrameLightState>;

// ── Default light state · matches CURRENT visual output ────────────────────
//
// All regions "on" because hud-frame-v12.png has all baked orange pixels
// permanently visible. When overlays land + v13 asset swaps in, this
// default will still produce the same visual (overlays render at full
// brightness). Consumers can safely use FRAME_LIGHT_DEFAULT without any
// visible change until progression logic is wired.

export const FRAME_LIGHT_DEFAULT: FrameLightMap = {
  rail:    "on",
  footer:  "on",
  corners: "on",
  edge:    "on",
  header:  "on",
  kebab:   "on",
};

// ── Progression signals · consumed by computeFrameLights ───────────────────
//
// Shape reserved for the future onboarding-progression implementation.
// Sources of these signals (already present in the codebase, no new
// wiring yet · see BATCH 3 audit):
//
//   hasIdentity      · useNexIdentity() status === "ready"
//                      (localStorage["nex.identity"] hydrated with name +
//                      phoneNumber + publicNexId)
//   profileComplete  · provider_profile row exists for learner_ref with
//                      full_name + price_per_service_idr (or the future
//                      user-profile equivalent)

export interface FrameLightSignals {
  hasIdentity: boolean;
  profileComplete: boolean;
}

// ── Pure derivation function · signature reserved for future logic ─────────
//
// Currently returns FRAME_LIGHT_DEFAULT regardless of input · preserves
// the current visual (all baked lights visible) until the progression
// implementation lands. Signature ready for the future batch:
//
//   State 1 · new user           → minimal lights (header + a few rail)
//   State 2 · account created    → partial lights (add footer + more rail)
//   State 3 · profile completed  → full illumination · optional subtle pulse
//
// Pure function · no side effects · safe to call anywhere · deterministic.

export function computeFrameLights(_signals: FrameLightSignals = {
  hasIdentity: false,
  profileComplete: false,
}): FrameLightMap {
  return { ...FRAME_LIGHT_DEFAULT };
}
