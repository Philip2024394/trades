// src/lib/nex-native/family-safety/feature-flag.ts
//
// NEX Family Safety · feature flags · authored 2026-10-10.
// --------------------------------------------------------
// Two independent flags:
//
//   · isFamilySafetyEnabled()
//       Controls whether the UI SURFACES are mounted (Settings entry,
//       /family-safety/* routes). Defaults TRUE in dev. Only the
//       explicit literal string "false" (any case) disables it.
//
//   · isFamilySafetyProductionAuthorised()
//       Controls whether PRODUCTION child-account activation + real
//       SafeChat logging + real pressure-signal HQ routing can
//       occur. Defaults FALSE. ONLY the literal string "true" (any
//       case) enables it. All Phase 1 UI must honour this flag and
//       keep the SIMULATED · PILOT badge visible when FALSE.
//
// Load-bearing anti-patterns:
//   · Do NOT invert the defaults · the UI flag defaults OPEN (users
//     see the surface) but the production-authorised flag defaults
//     CLOSED (nothing real happens). This asymmetry is intentional:
//     operators who want to preview the UX can leave both at their
//     defaults; operators who want to go live MUST set the second
//     flag explicitly.
//   · Do NOT read these flags on the client. They are server-only ·
//     a client importer must receive a boolean prop computed on the
//     server. The flags are not secret but they ARE server-truth.
//   · Do NOT add additional flags here without a founder decision.

function readEnvFlag(name: string): string | undefined {
  // Keep this lookup lazy so test seams can mutate process.env between
  // calls without needing to re-import the module.
  const v = process.env[name];
  if (typeof v !== "string") return undefined;
  return v.trim();
}

/**
 * Whether the Family Safety UI surface should be mounted.
 *
 * Defaults TRUE. Only the explicit literal "false" (case-insensitive)
 * disables it. Any other value — including empty string or an unset
 * variable — keeps the surface mounted.
 */
export function isFamilySafetyEnabled(): boolean {
  const raw = readEnvFlag("NEX_FAMILY_SAFETY_ENABLED");
  if (raw === undefined) return true;
  if (raw.toLowerCase() === "false") return false;
  return true;
}

/**
 * Whether real-world Family Safety behaviours (production child-
 * account activation, SafeChat logging, pressure-signal routing to
 * HQ) are permitted.
 *
 * Defaults FALSE. ONLY the explicit literal "true" (case-insensitive)
 * enables it. Any other value — including undefined, empty string, or
 * "yes" / "1" — keeps the authorisation OFF.
 *
 * Phase 1 code paths that are "simulated" MUST read this flag and
 * refuse to upgrade to live mode when it returns FALSE. The sealed
 * `simulated: true` DB defaults on `nex.family_link` /
 * `nex.account_age_attestation` are the authoritative DB-level
 * backstop · this flag is the UI/service-layer backstop.
 */
export function isFamilySafetyProductionAuthorised(): boolean {
  const raw = readEnvFlag("NEX_FAMILY_SAFETY_PRODUCTION_AUTHORISED");
  if (raw === undefined) return false;
  return raw.toLowerCase() === "true";
}
