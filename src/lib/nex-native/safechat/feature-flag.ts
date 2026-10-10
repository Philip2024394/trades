// src/lib/nex-native/safechat/feature-flag.ts
//
// NEX SafeChat Phase 1 · feature flags.
//
// Doctrine:
//   · Phase 1 is INSTRUMENTATION ONLY · the only observable effect is
//     that classifications are being written to a server-side log.
//   · isSafeChatPhase1LoggingEnabled defaults to OFF (sealed 2026-10-10
//     Privacy Audit). Any environment that has not explicitly authorised
//     SafeChat Phase 1 logging must not be writing classification
//     records. Flipping default OFF ensures a dev who pulls the repo
//     and starts the server does not accumulate real-user classification
//     data without explicit opt-in. The flag must be set to the literal
//     string "true" to turn logging on.
//   · isSafeChatUserFacingEnabled defaults to OFF · Phase 2+ · must be
//     flipped by explicit founder authorisation. Phase 1 code must
//     NEVER read this flag · it exists only as a documented sentinel.

/** Phase 1 instrumentation. Defaults to OFF.
 *  Only `NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED="true"` enables the hook.
 *
 *  Default-OFF rationale (sealed 2026-10-10 Privacy Audit):
 *  Any environment that has not explicitly authorised SafeChat Phase 1
 *  logging must not be writing classification records. Flipping default
 *  OFF ensures a dev who pulls the repo and starts the server does not
 *  accumulate real-user classification data without explicit opt-in.
 *  Explicit opt-in is required for every environment · dev, staging,
 *  prod · and SHOULD be paired with the audit variable
 *  `NEX_SAFECHAT_AUTHORISED_BY=<name>` (checked by the flag-audit
 *  script).  */
export function isSafeChatPhase1LoggingEnabled(): boolean {
  return process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED === "true";
}

/** Phase 2+ · user-facing warnings / parent alerts / restrictions.
 *  DEFAULT OFF. Setting `NEX_SAFECHAT_USER_FACING_ENABLED="true"` is
 *  reserved for a later wave after founder sign-off. Phase 1 code
 *  MUST NOT consume this flag · if a Phase 1 call-site needs it the
 *  wave is being scoped wrong. */
export function isSafeChatUserFacingEnabled(): boolean {
  return process.env.NEX_SAFECHAT_USER_FACING_ENABLED === "true";
}
