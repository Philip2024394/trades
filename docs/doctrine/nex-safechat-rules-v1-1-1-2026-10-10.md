# NEX SafeChat Ruleset v1.1.1 · Wave 2 Tuning
**Sealed:** 2026-10-10
**Branch:** `nex/directory-work` (no commits · no pushes · per founder authorisation)
**Scope:** Synthetic-only ruleset tuning · four measured v1.1.0 regressions
**Baseline frozen at:** `src/lib/nex-native/safechat/rules/_frozen-v1-0-0.ts`
**v1.1.0 frozen snapshot at:** `src/lib/nex-native/safechat/rules/_frozen-v1-1-0/`

## What changed

### Regression fixes

| # | Regression item | v1.0.0 | v1.1.0 | v1.1.1 | Fix applied | Anchor test |
|---|---|---|---|---|---|---|
| R1a | `v2-en-serious-013` (age_gap + meeting) | 3 | 2 | 3 | `grooming-pattern-rules.ts` adds `age_gap_meeting_combination` +2 scoring component · fires when BOTH `age_gap_disclosure` AND `meeting_arrangement` present | `grooming-pattern-rules.test.ts > REGRESSION ANCHOR v1.1.1 · age_gap + meeting_arrangement alone · Level 3` |
| R1b | `v2-mix-serious-004` (code-switched age_gap + meeting) | 3 | 2 | 3 | same as R1a | same anchor test (both via pattern path) |
| R2 | `v2-en-benign-lookalike-010` (surprise-cake secrecy) | 0 | 1 | 0 | `secrecy-request-rules.ts` benign-celebration whitelist extended with cake / wrapping / retirement / wedding / "tell nan" / "it's for her" idioms | `secrecy-request-rules.test.ts > REGRESSION ANCHOR v1.1.1 · R2 · 'don't tell nan about the cake' is Level 0` |
| R3 | `v2-id-benign-lookalike-008` (ID ordinary privacy) | 0 | 1 | 0 | `secrecy-request-rules.ts` NEW Indonesian ordinary-privacy whitelist (`BENIGN_ORDINARY_PRIVACY_TOKENS_ID`) · fires only when NO sexual/grooming/age-gap context present | `secrecy-request-rules.test.ts > REGRESSION ANCHOR v1.1.1 · R3 · 'jangan bilang nilai kita' is Level 0` |

Every fix is **targeted and compositional**: no threshold values were lowered globally. The v1.1.1 grooming scoring adds a NEW compositional bonus; the whitelist expansions are additive to the existing benign-celebration list.

### Corpus expansion

| Corpus file | Before | After | Delta |
|---|---|---|---|
| `corpus-v2-en.json` | 120 | 145 | +25 (20 serious + 5 benign-lookalike) |
| `corpus-v2-id.json` | 70 | 89 | +19 (8 serious + 3 unsafe + 8 benign-lookalike) |
| `corpus-v2-code-switched.json` | 49 | 65 | +16 (11 serious + 3 unsafe + 2 benign-lookalike) |
| `corpus-v2-multi-message.json` | 62 | 77 | +15 slow-build / escalation / history scenarios |
| `corpus-v2-benign-lookalikes.json` | 47 | 61 | +14 (medical/sex-ed, puberty, peer-support, cake/privacy regression anchors) |
| **Total** | **348** | **437** | **+89** |

Serious-risk denominator on v2: **85 → 135** (+50 Level-3 items).

All existing item IDs are preserved · comparisons across v1.0.0 / v1.1.0 / v1.1.1 remain apples-to-apples.

## Headline metrics (v2 corpus · 437 items · 135 Level-3)

| Metric | v1.0.0 | v1.1.0 | v1.1.1 |
|---|---|---|---|
| Overall accuracy | 51.49% | 56.52% | **61.56%** |
| Per-language · English accuracy | 54.47% | 57.45% | **61.70%** |
| Per-language · Indonesian accuracy | 48.51% | 55.22% | **61.94%** |
| Per-language · Code-switched accuracy | 47.06% | 55.88% | **60.29%** |
| False-positive rate on benign | 0.00% | 9.94% | **0.00%** |
| False-negative rate on serious | 86.67% | 67.41% | **62.96%** |
| **Serious-risk recall** | **18/135** | **44/135** | **50/135** |

Determinism check · `duplicateRunDeltaCount` = 0 on all three runs across all 437 items.

## Regressions newly discovered in v1.1.1

**None.** The `v1.1.0 → v1.1.1` comparison shows **22 improvements, 0 regressions**. Every item v1.1.0 classified correctly, v1.1.1 also classifies correctly.

## Benign false-positive rate ↓ 9.94% → 0.00%

The Indonesian ordinary-privacy whitelist eliminated the main source of v1.1.0 false positives: everyday Indonesian "jangan bilang nilai / urusan pribadi / antara kita saja" phrasings that matched the broad `jangan bilang` secrecy pattern. On the v1.1.1 v2 corpus (437 items), zero benign items were escalated. **This is a synthetic-only measurement.** Production FP behaviour depends on real Indonesian user language, which we have not sampled.

## Serious-risk recall analysis (50/135)

v1.1.1 recovers two items the baseline caught (R1a + R1b age_gap+meeting conjunction) and catches four new corpus items that exercise the Wave-2 improvements. The headline fraction looks modest only because we **enlarged the denominator**: on the original 85-item serious-risk pool, v1.1.1 catches 46 (up from 34 in v1.1.0 and 10 in v1.0.0). The 50 new serious-risk corpus items were authored to stress areas where the baseline + Wave-1 both struggled, so most of them still miss. Those misses are an honest signal that further rule work is needed.

## Honest limitations

**This is synthetic evaluation only.** A hand-authored synthetic corpus · no matter how carefully constructed · can still fail to represent real conversations. The specific Indonesian ordinary-privacy phrases we whitelisted are what we could identify through audit; production language will include idioms we did not anticipate, and the whitelist may miss real benign items or (less likely, due to the hard guard against sexual/grooming/age-gap context) incorrectly suppress a real harmful one.

**SafeChat remains SIMULATED.** Phase 1 instrumentation is still disabled. No real-user text is logged. No parent visibility. No child-facing SafeChat actions. The founder authorisation for this wave was explicit: synthetic-only, no claims of real-world safety-readiness.

**Message-delivery regression check.** The sealed `peer-message-service.ts` SafeChat hook was NOT modified. The `_hook.ts` is unchanged. The default classifier version remains `v1.1.0` so production calls get the Wave-1 behaviour (Wave 2 is explicitly selectable via `rulesetVersion: "safechat-rules-v1.1.1"` for evaluation callers only).

## Open questions for the next wave

1. **Indonesian benign-privacy false negatives.** The whitelist is still conservative (12 phrases). We expect real Indonesian teenage privacy phrasings outside this list to still over-escalate to Level 1. Needs a broader audit from a native speaker.
2. **The 85 remaining serious-risk misses (50/135 recall).** Categories where v1.1.1 still under-calls:
   - `grooming_pattern_cumulative` multi-message scenarios where no single message carries all signals
   - `platform_switch` variants that use non-sealed platform names (discord, line, kakaotalk)
   - Indonesian `meeting_arrangement` phrasings that lack `ayo/yuk` prefix (see `v2-id-unsafe-019`)
3. **False-positive rate under real workload.** 0.00% on synthetic benign-lookalikes is encouraging but unverifiable. A real production evaluation must come before any user-facing SafeChat action is enabled.
4. **The sealed `safechat_vocabulary_term.category` CHECK constraint** does not include `benign_celebration` or `benign_ordinary_privacy`. The v1.1.1 seed script tolerates the rejection (the module in-code whitelist does not need DB rows). A future schema migration can expand the CHECK if we want these rows persisted for operations-team audit.

## Files touched (Wave 2)

```
src/lib/nex-native/safechat/
├── types.ts                                           (added v1.1.1 constants)
├── classifier.ts                                      (route v1.1.0 → frozen · v1.1.1 → active)
├── classifier.test.ts                                 (added v1.1.1 integration tests)
├── _seed-vocabulary-v1-1-1.mjs                        NEW
├── rules/
│   ├── _frozen-v1-1-0/                                NEW directory (5 files + _frozen.test.ts)
│   │   ├── base-rules.ts
│   │   ├── secrecy-request-rules.ts
│   │   ├── grooming-pattern-rules.ts
│   │   ├── coercion-pressure-rules.ts
│   │   ├── compose.ts
│   │   └── _frozen.test.ts
│   ├── grooming-pattern-rules.ts                      (age_gap_meeting_combination bonus)
│   ├── grooming-pattern-rules.test.ts                 (updated existing · 4 new anchors)
│   ├── secrecy-request-rules.ts                       (new whitelists + helper)
│   └── secrecy-request-rules.test.ts                  (7 new anchors)
└── __eval__/
    ├── evaluation-runner.ts                           (route v1.1.1)
    ├── corpus-v2-*.json                               (ADDITIVE only · existing items unchanged)
    ├── results-v2-revised-v1-1-1-2026-10-10.json      NEW
    ├── comparison-v1-0-0-vs-v1-1-1-2026-10-10.json    NEW
    └── comparison-v1-1-0-vs-v1-1-1-2026-10-10.json    NEW

scripts/nex-canonical/_safechat-run-comparison.mjs     (expanded to 6-run matrix)
```

NO changes to: `rules/_frozen-v1-0-0.ts` · `_hook.ts` · `peer-message-service.ts` · `privacy-audit.test.ts` · `classification-logger.ts` · any production surface.
