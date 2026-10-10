# NEX SafeChat · v2 corpus and ruleset v1.0.0-vs-v1.1.0 comparison

**Date (estimate):** 2026-10-10
**Scope:** Hermetic classification quality evaluation. Instrumentation
only. No user-facing claim about safety readiness is made in this
document.

## What landed

A separately versioned synthetic evaluation corpus (v2) was authored to
complement the sealed 125-item v1 baseline (which is preserved
unchanged for regression comparability). The v2 corpus was then scored
against two rulesets:

- `safechat-rules-v1.0.0` · the frozen Phase 1 baseline.
- `safechat-rules-v1.1.0` · the revised category-module composer
  landed by the parallel R-RULES agent.

Both runs are hermetic (no DB, no feature flag, no body-text logging).

## V2 corpus · item counts

Totals produced by hand-authored JSON files in
`src/lib/nex-native/safechat/__eval__/`:

| File | Items | L0 | L1 | L2 | L3 |
|---|---:|---:|---:|---:|---:|
| `corpus-v2-en.json` | 120 | 38 | 27 | 30 | 25 |
| `corpus-v2-id.json` | 70 | 28 | 10 | 20 | 12 |
| `corpus-v2-code-switched.json` | 49 | 18 | 8 | 13 | 10 |
| `corpus-v2-multi-message.json` | 62 | 8 | 9 | 7 | 38 |
| `corpus-v2-benign-lookalikes.json` | 47 | 37 | 10 | 0 | 0 |
| **Total** | **348** | **129** | **64** | **70** | **85** |

Multi-message items carry a `priorMessages: PriorClassification[]`
array that the runner injects into `deriveSignals` directly (no DB).

Per-language distribution (classifier `language` field): `en`=191,
`id`=106, `mixed`=51.

Authoring rules observed: synthetic text, no first names of real
people, dignified non-graphic descriptions even at Level 3,
10-50-word items.

## Headline numbers · v1 corpus (regression anchor · 125 items)

| Metric | Baseline v1.0.0 | Revised v1.1.0 | Delta |
|---|---:|---:|---:|
| Overall accuracy | 72.00% | 74.40% | +2.40% |
| FP rate on benign | 0.00% | 7.84% | +7.84% |
| FN rate on serious | 60.00% | 50.00% | -10.00% |
| Serious-risk recall | 8/20 | 10/20 | +2 |
| Improvements | — | — | 9 |
| Regressions | — | — | 6 |

The baseline accuracy on v1 corpus (72.00%) matches the sealed
pre-wave anchor exactly. No regression in the baseline measurement
itself.

## Headline numbers · v2 corpus (348 items)

| Metric | Baseline v1.0.0 | Revised v1.1.0 | Delta |
|---|---:|---:|---:|
| Overall accuracy | 52.59% | 62.07% | +9.48% |
| FP rate on benign | 0.00% | 1.55% | +1.55% |
| FN rate on serious | 88.24% | 60.00% | -28.24% |
| Serious-risk recall | 10/85 | 34/85 | +24 |
| Improvements | — | — | 37 |
| Regressions | — | — | 4 |

Per-language accuracy on v2:

| Language | Baseline | Revised | Delta |
|---|---:|---:|---:|
| en | 56.54% | 62.83% | +6.29% |
| id | 46.23% | 59.43% | +13.20% |
| mixed | 50.98% | 64.71% | +13.73% |

## Serious-risk recall · exact numerators and denominators

- V1 corpus · baseline **8/20** · revised **10/20**
- V2 corpus · baseline **10/85** · revised **34/85**

85 is the full v2 Level-3 denominator (25 EN + 12 ID + 10 mixed + 38
multi-message serious items). The revised ruleset caught **24
additional serious-risk items** on v2. Fifty-one items remain missed.
Multi-message serious-risk scenarios drive most of the remaining miss:
even with the aggregator wired, repeated_pressure_after_refusal only
fires when a prior history contains BOTH `coercion_indicator`
vocabulary and an `image_request` pattern, in that order, from the
same conversation — many of the authored serious-risk scenarios lack
one of the two prior signals.

## Per-category accuracy table (v2 corpus · selected tags)

| category_tag | n | baseline | revised | delta |
|---|---:|---:|---:|---:|
| `grooming_pattern` | 14 | 35.7% | 92.9% | +57.2% |
| `grooming_pattern_full` | 3 | 0.0% | 100.0% | +100.0% |
| `grooming_pattern_secrecy` | 1 | 0.0% | 100.0% | +100.0% |
| `grooming_pattern_cumulative` | 7 | 28.6% | 57.1% | +28.5% |
| `grooming_pattern_multiple_indicators` | 3 | 0.0% | 33.3% | +33.3% |
| `grooming_with_meeting` | 2 | 0.0% | 50.0% | +50.0% |
| `image_request` | 16 | 43.8% | 87.5% | +43.8% |
| `image_request_with_pressure` | 3 | 33.3% | 100.0% | +66.7% |
| `image_request_with_secrecy` | 1 | 0.0% | 100.0% | +100.0% |
| `gift_offer_with_image_request` | 2 | 50.0% | 100.0% | +50.0% |
| `platform_switch_then_meeting` (multi-msg) | 8 | 0.0% | 100.0% | +100.0% |
| `escalating_severity_pattern` (multi-msg) | 7 | 0.0% | 14.3% | +14.3% |
| `repeated_request_after_refusal` (multi-msg) | 12 | 0.0% | 50.0% | +50.0% |
| `mild_sexual_slang_peer` | 17 | 88.2% | 88.2% | 0.0% |
| `benign_everyday` | 62 | 100.0% | 100.0% | 0.0% |
| `surprise_party_secrecy` (benign lookalike) | 9 | 77.8% | 66.7% | -11.1% |
| `age_gap_disclosure_meeting` | 4 | 50.0% | 0.0% | -50.0% |
| `mild_drug_reference` | 13 | 0.0% | 0.0% | 0.0% |
| `mild_violence_reference` | 8 | 0.0% | 0.0% | 0.0% |

## Regressions (items the revised ruleset got wrong that the baseline got right · v2 corpus)

| id | category_tag | expected | baseline | revised |
|---|---|---:|---:|---:|
| `v2-en-serious-013` | `age_gap_disclosure_meeting` | 3 | 3 | 2 |
| `v2-en-benign-lookalike-010` | `surprise_party_secrecy` | 0 | 0 | 1 |
| `v2-id-benign-lookalike-008` | `ordinary_privacy` | 0 | 0 | 1 |
| `v2-mix-serious-004` | `age_gap_disclosure_meeting` | 3 | 3 | 2 |

Two regressions sit on `age_gap_disclosure_meeting` scenarios where
baseline fired via the sealed pattern pair (age_gap_disclosure +
meeting_arrangement) at Level 3; the revised composer kept Level 2 on
those two items. Two sit on benign lookalikes where secrecy phrasing
leaked a Level-1 escalation. See the comparison JSON for full detail.

## Honest limitations

- **Sample size is still small.** 85 serious-risk items in v2 is
  substantially more than v1's 15, but still a small sample.
  Confidence intervals around the serious-risk recall deltas are wide;
  the +24 improvement should not be read as a reliable production-ready
  number.
- **False-positive rate is measured against synthetic benign
  lookalikes authored by us.** Real-world benign conversations
  (particularly medical, educational, and family-safety chats) may
  not match our author distribution. The 1.55% FP rate on v2 and 7.84%
  FP rate on v1 are honest numbers for the authored corpus, not for
  production traffic.
- **Code-switching coverage is uneven.** The 49-item code-switched
  corpus flags cross-language gaps but is not large enough to make
  strong claims about Indonesian teen bilingual chat.
- **Multi-message scenarios inject synthesised prior-classification
  shapes.** The `priorMessages` arrays are hand-authored to describe
  what the aggregator WOULD have seen if those messages had been
  classified. Real production history has drift (unclassified
  messages, DB-side timing effects) that this corpus does not model.
- **Benign lookalikes include puberty / medical / sex-ed items whose
  Level-1 vs Level-0 placement is a judgment call.** Several items
  marked expected=1 are documented as FP candidates in `notes`.
- **The classifier never blocks a message.** Phase 1 is
  INSTRUMENTATION ONLY. These numbers measure how well a logging
  system would ANNOTATE conversations; they do NOT measure how well a
  blocking system would ACT on them. Those are different problems.
- **Determinism was verified**: 348/348 items ran identically across
  consecutive runs (`consistency.duplicateRunDeltaCount === 0`).
- **Regression suite still green**: 317/317 SafeChat vitest tests pass
  across all 18 safechat files after this wave's additions.
- **Privacy / retention / authorisation / message-delivery behaviour
  were not changed** by this wave. Those paths are tested elsewhere
  (`privacy-audit.test.ts`, `retention-sweep.test.ts`,
  `_hook.test.ts`, `classification-logger.test.ts`) and continue to
  pass.

**Aggregate accuracy is not a safety readiness signal.** A 62.07% v2
accuracy with a 1.55% FP-benign rate and 60% FN-serious rate means we
STILL miss 51 of 85 authored serious-risk scenarios. Do not interpret
these numbers as "the classifier is production-ready for serious
risk" — they are the honest state of a rules + vocabulary + patterns
system on a hand-authored synthetic corpus.

## Open questions for the founder

1. **Threshold tuning for `age_gap_disclosure_meeting`.** The revised
   composer treats this at Level 2 while the baseline treated it at
   Level 3. Which is right?
2. **Benign-lookalike handling for secrecy phrases.** The v1.1.0
   composer escalates `jangan bilang` + surprise-party context to
   Level 1. Should this stay as a documented sensitivity or should the
   ruleset get a contextual benign-override list?
3. **Coverage gaps for Indonesian meeting arrangements without
   `ayo/yuk ketemuan` prefix.** Multiple serious-risk ID items are
   missed because the current regex requires the `ayo|yuk` prefix.
   Expand the pattern or add vocabulary coverage?
4. **Priority for a third language (Malay / Tagalog / Vietnamese) vs.
   deeper EN+ID coverage.** The DB CHECK on `nex_account.locale`
   currently blocks anything beyond `id`/`en` so this is also a
   migration decision.
5. **Multi-message escalation threshold.** The composer only elevates
   to Level 3 on `escalating_severity_pattern` 1/7 of the time on the
   authored scenarios. Should the escalation signal weigh more, or
   are those scenarios genuinely at Level 2?

## File references

Result JSONs committed to `src/lib/nex-native/safechat/__eval__/`:

- `results-baseline-2026-10-10.json` · v1.0.0 × v1 corpus (sealed anchor)
- `results-v1-revised-v1-1-0-2026-10-10.json` · v1.1.0 × v1 corpus
- `results-v2-baseline-v1-0-0-2026-10-10.json` · v1.0.0 × v2 corpus
- `results-v2-revised-v1-1-0-2026-10-10.json` · v1.1.0 × v2 corpus
- `comparison-v1-v1-0-0-vs-v1-1-0-2026-10-10.json` · v1 corpus comparison
- `comparison-v1-0-0-vs-v1-1-0-2026-10-10.json` · v2 corpus comparison

Orchestration:
`scripts/nex-canonical/_safechat-run-comparison.mjs`.
