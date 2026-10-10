// src/lib/nex-native/emergency/feature-flag.ts
//
// NEX Emergency Help · feature flags.
//
// v1 defaults (sealed 2026-10-10 by F4):
//   · NEX_EMERGENCY_HELP_ENABLED             → ON by default · subsystem is live.
//   · NEX_EMERGENCY_LIVE_MODE                → OFF by default · all writes simulated.
//   · NEX_EMERGENCY_WIDER_COMMUNITY_ENABLED  → OFF by default · wider-community layer DISABLED.
//
// Doctrine:
//   · Flipping LIVE_MODE on without an explicit founder authorisation is
//     a deployment regression. Service layer refuses writes where
//     `simulated = false` until live mode is both enabled AND the caller
//     passes an explicit `simulated` value.
//   · `isWiderCommunityLayerEnabled` is a signalling flag the recipient
//     resolver reads at resolve-time; v1 pilot keeps it OFF and the
//     resolver reports `layer3Available: false`.

/** Master kill-switch for the Emergency Help subsystem.
 *  Defaults to ON. Set NEX_EMERGENCY_HELP_ENABLED="false" to disable. */
export function isEmergencyHelpEnabled(): boolean {
  return process.env.NEX_EMERGENCY_HELP_ENABLED !== "false";
}

/** v1 PILOT · live-mode is OFF by default. In v1 all writes MUST have
 *  `simulated = true`. Service layer rejects writes with
 *  `simulated = false` until this flag is explicitly flipped. */
export function isEmergencyLiveMode(): boolean {
  return process.env.NEX_EMERGENCY_LIVE_MODE === "true";
}

/** Layer 3 of the recipient resolver (wider community) is OFF by
 *  default. The resolver reports `layer3Available: false` until this
 *  flag is explicitly flipped. v1 pilot keeps this OFF. */
export function isWiderCommunityLayerEnabled(): boolean {
  return process.env.NEX_EMERGENCY_WIDER_COMMUNITY_ENABLED === "true";
}
