# NEX SafeChat ruleset v1.1.0 · Ruleset Tuning Wave 1

- Author: SafeChat R-RULES agent
- Date: 2026-10-10
- Branch: `nex/directory-work`
- Classifier version: `safechat-rules-v1.1.0`
- Supersedes (for new callers): `safechat-rules-v1.0.0`
- Frozen baseline retained at `src/lib/nex-native/safechat/rules/_frozen-v1-0-0.ts`

## Why

The sealed Phase 1 baseline evaluation (results-baseline-2026-10-10.json)
showed three category gaps:

- `secrecy_request` · 0% accuracy (6/6 misses)
- `grooming_pattern` · 43% accuracy (6/14 misses)
- `coercion_pressure` · 42% accuracy (5/12 misses)

The founder authorised Wave 1 with explicit constraints:

- No lowering of thresholds for headline recall.
- Ordinary privacy, benign secrecy, and isolated slang must NOT be
  classified as serious risk without contextual evidence.
- Simulation only · do not touch the Vault / Bridge / encrypted-message
  path · do not persist raw message text.

## Architecture

The classifier is now a thin composer. Each category gets its own rule
module in `src/lib/nex-native/safechat/rules/`:

| category | file | approach |
|---|---|---|
| base (clean / isolated slang) | `base-rules.ts` | Preserves v1.0.0 Level 0/1 branches verbatim. |
| secrecy_request | `secrecy-request-rules.ts` | Context-aware: isolated → L1, with sexual signal → L2, with grooming/age-gap → L3, with benign-celebration framing → L0. |
| grooming_pattern | `grooming-pattern-rules.ts` | Transparent score function; score ≥ 6 → L3. |
| coercion_pressure | `coercion-pressure-rules.ts` | Reads conversation-level signals; L3 requires history. |

`compose.ts` composes module outputs: `finalLevel = max` across all
modules, plus a generic Level-2 branch that preserves v1.0.0 behaviour
for messages no category module escalates.

The frozen v1.0.0 implementation lives at `rules/_frozen-v1-0-0.ts` and
is used by callers that pass `rulesetVersion: "safechat-rules-v1.0.0"`.
It is DO-NOT-MODIFY.

## Decisions per category

### R1 · secrecy_request

| trigger | level | rationale |
|---|---|---|
| secrecy pattern/vocab + benign-celebration token (surprise, birthday, kejutan, ulang tahun …) | 0 | Founder guard: "Don't tell dad about the surprise party" must never escalate. |
| isolated secrecy, no other evidence | 1 | Ordinary teenage privacy worth logging, never escalated to L3 alone. |
| secrecy + any sexual signal in the message (vocab or image_request pattern) | 2 | Potentially unsafe pairing. |
| secrecy + prior sexual-topic history alone | 2 | Same signal density as above, from different direction. |
| secrecy + sexual signal + (grooming vocab OR age-gap pattern) in message | 3 | Load-bearing grooming-plus-secrecy pairing. |
| secrecy + prior pressure history + (prior age-gap OR prior platform switch) | 3 | Multi-message grooming context sealed via conversation signals. |

Benign-celebration tokens (short, deliberately conservative):
`surprise`, `surprise party`, `birthday`, `present`, `gift for mum`,
`gift for mom`, `gift for dad`, `party`, `christmas`, `anniversary`,
`kejutan`, `ulang tahun`, `hadiah`, `pesta`, `kado`.

### R2 · grooming_pattern

Score-based evaluation. Weights sealed in
`GROOMING_SCORE_WEIGHTS` + `GROOMING_LEVEL_THRESHOLDS`:

| component | weight |
|---|---|
| explicit_image_request | +3 |
| isolation_request | +3 |
| flattery_followed_by_request | +3 |
| trust_building_language (or grooming_indicator vocab) | +3 |
| secrecy_with_sexual_context | +3 |
| age_gap_disclosure | +2 |
| gift_offer_with_sexual_frame | +2 |
| platform_switch_invitation | +2 |
| meeting_arrangement with age/privacy context | +2 |

Thresholds:

| score | level |
|---|---|
| ≥ 6 | 3 (serious_risk) |
| 3–5 | 2 (potentially_unsafe) |
| 1–2 | 1 (sensitive) |
| 0 | 0 (clean) |

Trade-offs:

- Weight for `explicit_image_request` is `+3` so it ALONE lands in
  Level 2 (preserves v1.0.0 behaviour); a second indicator (grooming
  vocab, platform switch, age gap, isolation, flattery, trust-building)
  escalates to Level 3. This replaces the v1.0.0 "exact conjunction of
  image_request + grooming_indicator" rule with a more expressive one.
- `meeting_arrangement` alone scores 0 (ordinary chat). It only
  contributes when paired with an age / privacy / grooming anchor
  (same +2 condition the baseline required for Level 3).
- The score is NOT a probability. It is an auditable integer sum of
  concrete indicators.

### R3 · coercion_pressure

New conversation-level signals added to `ConversationSignals`
(all optional for back-compat with historical jsonb rows):

- `repeated_request_after_refusal` · boolean · true if a request-shaped
  message (image_request or meeting_arrangement) appears AFTER a
  `refusal_language` match in the window.
- `escalating_severity_pattern` · boolean · mirror of the existing
  `escalation_pattern` under the v1.1.0 naming.
- `pressure_density` · number · request-shaped messages per minute
  across the window (span clamped to ≥ 1 minute).
- `platform_switch_already_proposed` · boolean · mirror of
  `platform_switch_invitation`.
- `secrecy_already_requested` · boolean.
- `age_gap_already_disclosed` · boolean.

The `aggregateSignals` function now accepts an optional
`injectedHistory: readonly PriorClassification[]`. When provided, the
DB read is skipped. This lets the evaluation runner (R-CORPUS scope)
drive hermetic multi-message tests.

Coercion rules:

| trigger | level | notes |
|---|---|---|
| no history | n/a | Signal-based escalations are gated on `historyWindowCount > 0`. |
| `coercion_indicator` vocab in current message | 2 | Preserves v1.0.0 single-message behaviour. |
| `repeated_request_after_refusal` or legacy `repeated_pressure_after_refusal` | 3 | Load-bearing Level 3 branch. |
| `pressure_density > 1.0` AND in-message sexual signal | 3 | Threshold reviewable here. |
| `platform_switch_already_proposed` AND in-message meeting_arrangement | 3 | Coercion-with-switch pivot. |
| `escalating_severity_pattern` AND in-message sexual signal | 2 | Escalating series alone is not Level 3; needs an anchor. |

The density threshold of `1.0` request-shaped messages per minute is a
first-draft value. It is reviewable with Wave-2 corpus data when the
R-CORPUS stream completes.

## Privacy

Nothing in this ruleset changes the privacy invariants:

- No module ever emits body text in `contributingSignals` (regression-
  guarded by unit tests + the sealed privacy-audit suite).
- `classification-logger.ts::redactRuleMatchesForPersistence` still
  overwrites pattern `matchedText` with `[redacted]` before INSERT.
- The 19 privacy audit tests continue to pass.
- Phase 1 remains instrumentation-only: `simulated=TRUE`,
  `visibility_to_guardian=FALSE`.

## What this doctrine does NOT cover

- Corpus expansion (owned by R-CORPUS).
- Family Links consumer surface (owned by R-FL-Q).
- Any schema change to `nex.safechat_vocabulary_term` or
  `nex.safechat_pattern` beyond the signal_type CHECK extension needed
  by `_seed-vocabulary-v1-1-0.mjs`. The DB CHECK extension is deferred
  to the deploy pass that applies the migration · the seed script
  logs and skips rows the CHECK rejects rather than failing hard.

## Future tuning

- Review `pressure_density` threshold after Wave-2 corpus runs.
- Review the `BENIGN_CELEBRATION_TOKENS` list once the corpus has more
  benign-secrecy examples.
- Consider promoting `refusal_language` from pattern-only to a hybrid
  vocab+pattern once the corpus is wider.
- The composition rule is `max(level)` across modules · if two modules
  disagree on severity for the same input, this is the correct tie-
  breaker (higher-risk read wins). If this becomes a false-positive
  source later, we may introduce a `veto` output in a future wave.
