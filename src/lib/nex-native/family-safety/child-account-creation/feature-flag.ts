// src/lib/nex-native/family-safety/child-account-creation/feature-flag.ts
//
// NEX Family Safety · Child Account Creation (CC-1) · feature flags.
// --------------------------------------------------------------------
// Three independent flags, each with its own default:
//
//   · isChildCreateUIEnabled()
//       Controls whether the parent-facing wizard surface is MOUNTED.
//       Defaults TRUE. Only the explicit literal "false" (any case)
//       disables it. This is deliberately open · surfaces may always be
//       previewed; only the live materialisation path is gated.
//
//   · isChildCreateLiveModeEnabled()
//       Gates the LIVE child-account materialisation path. Defaults
//       FALSE. ONLY the literal "true" (any case) enables it. When
//       OFF, `materialiseChildAccount` in the service layer transitions
//       the request to `awaiting_legal_clearance` INSTEAD of invoking
//       the sealed account-creation primitive. This matches founder
//       decision A (2026-10-10).
//
//   · isIdVerifierManualOverrideEnabled()
//       Enables the dev-only operator helper that flips a submission's
//       verification_outcome from 'pending' to 'verified' / 'rejected'.
//       Defaults FALSE. ONLY the literal "true" enables it. Used by
//       support flow / internal review only.
//
// Load-bearing anti-patterns:
//   · Do NOT invert the defaults. The UI flag defaults OPEN; the two
//     authorisation flags default CLOSED. Preview is free; action is not.
//   · Do NOT read these flags on the client. They are server-only.
//   · Do NOT add further flags here without a founder decision.

function readEnvFlag(name: string): string | undefined {
  // Keep this lookup lazy so test seams can mutate process.env between
  // calls without needing to re-import the module.
  const v = process.env[name];
  if (typeof v !== "string") return undefined;
  return v.trim();
}

/**
 * Whether the Child Account Creation wizard surface is mounted.
 *
 * Defaults TRUE. Only the explicit literal "false" (case-insensitive)
 * disables it. Any other value — including empty string or an unset
 * variable — keeps the surface mounted.
 */
export function isChildCreateUIEnabled(): boolean {
  const raw = readEnvFlag("NEX_FAMILY_SAFETY_CHILD_CREATE_UI_ENABLED");
  if (raw === undefined) return true;
  if (raw.toLowerCase() === "false") return false;
  return true;
}

/**
 * Whether live child-account materialisation is authorised.
 *
 * Defaults FALSE. ONLY the explicit literal "true" (case-insensitive)
 * enables it. Any other value — including undefined, empty string, or
 * "yes" / "1" — keeps the authorisation OFF.
 *
 * When OFF (the default), the service layer transitions a verified
 * creation request to `awaiting_legal_clearance` instead of invoking
 * the sealed account-creation primitive. The UI surfaces an honest
 * "awaiting Indonesian legal clearance" state.
 */
export function isChildCreateLiveModeEnabled(): boolean {
  const raw = readEnvFlag("NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE");
  if (raw === undefined) return false;
  return raw.toLowerCase() === "true";
}

/**
 * Whether the dev-only ID-verifier manual-override helper is enabled.
 *
 * Defaults FALSE. ONLY the explicit literal "true" (case-insensitive)
 * enables it. In the current wave the stub verifier adapter always
 * returns 'pending'; an operator may flip the row to 'verified' or
 * 'rejected' through a sealed admin flow only when this flag is ON.
 */
export function isIdVerifierManualOverrideEnabled(): boolean {
  const raw = readEnvFlag("NEX_FAMILY_SAFETY_ID_VERIFIER_MANUAL_OVERRIDE");
  if (raw === undefined) return false;
  return raw.toLowerCase() === "true";
}
