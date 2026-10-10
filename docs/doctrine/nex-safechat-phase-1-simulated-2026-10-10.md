# NEX SafeChat · Phase 1 (simulated detection) · 2026-10-10

Dates in this doctrine are ESTIMATES, not commitments.

## Scope (sealed · instrumentation only)

Phase 1 is PURE INSTRUMENTATION. Every peer plaintext message is passed
through a rules + vocabulary + patterns classifier and the result is
written to `nex.safechat_classification`. The only observable change
is that classifications are being written to a server-side log.

What Phase 1 does NOT do (and never will from this wave):
- restrict any message
- show a user-facing warning
- alert a parent, guardian, or any third party
- block, slow down, or alter the send path in any way

The classifier runs as a fire-and-forget hook on
`sendPeerMessage` (plaintext) in `src/lib/nex-native/peer-message-service.ts`.
Encrypted messages (`sendEncryptedPeerMessages` · Vault-adjacent chat flows)
are SKIPPED by design — SafeChat never operates on ciphertext.

## Capability ceiling

- Rules + vocabulary + patterns only.
- NO ML model (deferred to Phase 4+ after proper training-data +
  ethics review).
- NO third-party vendor (keeps the system structure-neutral and
  avoids vendor lock-in).
- Vocabulary database is multilingual + versioned + structure-neutral
  (no provider-specific identifiers in categories or signals).

## Vocabulary completeness

The Phase 1 vocabulary is **deliberately incomplete**:
- ~20 English terms + ~15 Bahasa Indonesia terms.
- 10 regex patterns covering image_request, secrecy_request,
  meeting_arrangement, platform_switch_invitation, and
  repeated_pressure_after_refusal.
- Seed script: `src/lib/nex-native/safechat/_seed-vocabulary.mjs`.

We ship a conservative starter set so the classifier produces
useful log entries for threshold tuning. Expansion requires an ethics
review (Phase 2+ wave) and must land as a separate migration.

## Load-bearing invariants

| Invariant | Enforcement | Test |
|---|---|---|
| `simulated=TRUE` at every write | Code constant `SAFECHAT_SIMULATED_PHASE_1` + logger param index 11 | `classification-logger.test.ts` |
| `visibility_to_guardian=FALSE` at every write | Code constant `SAFECHAT_VISIBILITY_TO_GUARDIAN_PHASE_1` + logger param index 10 | `classification-logger.test.ts` |
| Hook is non-blocking | `void safechatClassifyAndLog(...)` on `sendPeerMessage` happy path | `_hook.test.ts` |
| Hook swallows every error | `try/catch` in `_hook.ts` + `.catch(() => {})` at the call site | `_hook.test.ts` |
| Encrypted messages are skipped | Hook is only wired into `sendPeerMessage` (plaintext). `sendEncryptedPeerMessages` is untouched. | code review · grep |
| Feature flag disabled → no-op | `isSafeChatPhase1LoggingEnabled()` guards the hook call | `feature-flag.test.ts` |

## First-draft ruleset (resolveLevel)

Phase 1 ships with a conservative first-draft ruleset. Thresholds will
be tuned by reviewing the Phase 1 log — not shipped to users in this
wave.

- Level 0 (clean): no matches.
- Level 1 (sensitive): only `sexual_slang` severity 1 with no patterns.
- Level 2 (potentially_unsafe): `image_request` pattern OR
  `explicit_sexual` vocab OR >= 2 sensitive-category vocabulary matches
  OR `coercion_indicator` vocab.
- Level 3 (serious_risk): `image_request` + `grooming_indicator` OR
  `meeting_arrangement` + `age_gap_disclosure` OR the aggregator's
  `repeated_pressure_after_refusal` signal.

## Visibility to guardian (reserved)

`visibility_to_guardian` is a `boolean NOT NULL DEFAULT FALSE` column
on `nex.safechat_classification`. Phase 1 code ALWAYS sets this to
FALSE. Phase 3+ waves may flip it to TRUE only after:
1. explicit founder sign-off
2. a review surface + consent model
3. a dedicated ethics review

Phase 1 code must NEVER consume the Phase 2 feature flag
`NEX_SAFECHAT_USER_FACING_ENABLED` either (it exists as a documented
sentinel only).

## Database shape

Migration `199_nex_safechat_schema.sql` adds three append-only tables:
- `nex.safechat_classification` — classification log.
- `nex.safechat_vocabulary_term` — multilingual vocabulary database.
- `nex.safechat_pattern` — regex pattern database.

All three use `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`
and are session-identity gated to `nex_dev` via
`scripts/nex-canonical/_apply-migration-199.mjs`.

## Encrypted messages

The hook is wired ONLY into `sendPeerMessage` (plaintext).
`sendEncryptedPeerMessages` is a separate code path used by Vault-adjacent
chat flows; it is NOT hooked. If a future phase wants to classify
Vault-adjacent chat it will need a client-side classifier running
BEFORE encryption · that work is explicitly NOT in scope for Phase 1.

## Open questions (deferred to later waves)

- Ruleset validation methodology — how do we measure precision/recall
  without an annotated corpus?
- Threshold tuning cadence — weekly review of the log?
- When to add an ML model — Phase 4+? Only after we have an annotated
  Phase 1 corpus large enough to train honestly.
- Ethics review — guardian-visibility consent, local legal review per
  country, minor-vs-adult context, independent audit.
- Language expansion — adding Mandarin, Spanish, Portuguese requires
  more than vocabulary; the heuristic language detector in
  `classifier.ts` needs to grow too.

## Boundary with other agents

- Family Links foundations (FL) owns migration `198_*` and
  `src/lib/nex-native/family-links/*`.
- Emergency Help hardening (EH) owns existing `src/lib/nex-native/emergency/*`
  tests and Playwright additions.

Phase 1 does NOT touch either scope. The surgical hook into
`sendPeerMessage` is additive and non-blocking · it does not change
any existing return type or signature.
