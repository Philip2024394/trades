# NEX SafeChat · classification quality baseline · 2026-10-10

**Status:** baseline numbers · reviewable · no changes made to the
sealed classifier or the Phase 1 ruleset. See
`src/lib/nex-native/safechat/__eval__/README.md` for how to run +
interpret.

**Headline:** the Phase 1 classifier is FAR from ready to protect
children. 125 synthetic test items, hand-authored, bilingual,
dignified. 72.00% overall accuracy. **60.00% of serious-risk items are
missed.** 0.00% of benign items are over-escalated (good) — but the
secrecy-request category is at 0/6 (every secrecy signal we tested
dropped to Level 0).

Classifier version: `safechat-rules-v1.0.0` ·
Ruleset: `src/lib/nex-native/safechat/__eval__/ruleset-fixture.ts`
(verbatim mirror of `_seed-vocabulary.mjs`).

## Overall

| metric | value | reading |
|---|---|---|
| accuracy | 72.00% | 36 of 125 items disagreed with the author |
| FP-rate-on-benign | 0.00% | zero benign items over-escalated · headline good |
| FN-rate-on-serious | 60.00% | **three in five serious-risk items dropped below Level 3** |
| consistency | deterministic | ran every item twice · zero disagreements |

## Per language

| language | items | accuracy | FP-benign | notes |
|---|---|---|---|---|
| English | 60 | 76.67% | 0.00% | best covered · the seed has the most EN patterns |
| Bahasa Indonesia | 45 | 66.67% | 0.00% | ID has no `image_request` pattern and no `age_gap_disclosure` pattern in the seed · Level 3 recall is 0/5 |
| Mixed (code-switched) | 20 | 70.00% | 0.00% | survives better than ID because EN patterns still fire on the EN tokens |

## Top 5 failing items (by |delta|)

| id | expected | actual | category_tag |
|---|---|---|---|
| `en-serious-002` | 3 | 0 | grooming_pattern |
| `en-serious-005` | 3 | 0 | grooming_pattern |
| `en-serious-007` | 3 | 0 | coercion_pressure |
| `en-serious-008` | 3 | 0 | grooming_pattern |
| `en-serious-009` | 3 | 0 | meeting_arrangement |

Body text redacted here · synthetic text available in
`results-baseline-2026-10-10.json`.

## Where the biggest gaps sit

Sorted worst-first by miss count:

- **grooming_pattern** · 8 misses of 14 (43% accuracy). The ruleset
  requires both an `image_request` pattern AND a `grooming_indicator`
  vocab match to reach Level 3. Grooming messages that don't contain
  the English "send me a pic" pattern (e.g. grooming + meeting, or
  grooming + secrecy) land at Level 0.
- **coercion_pressure** · 7 of 12 (42%). The ruleset's
  `repeated_pressure_after_refusal` fires on vocabulary from the
  CURRENT message but the Level 3 branch requires the aggregator's
  conversation-level signal, which is `emptySignals()` for a single-
  message hermetic test. In the real system this signal depends on
  previously-logged history. Honest limit of the evaluator; honest
  limit of the ruleset too (single-message detection should still
  catch obvious pressure).
- **secrecy_request** · 6 of 6 (0% accuracy). The `secrecy_request`
  pattern + vocab in isolation do NOT trigger any level in
  `resolveLevel`. This is a direct ruleset gap: "don't tell your mum"
  should not drop to Level 0.
- **image_request_coded** · 4 of 7 (43%). The seed has only two EN
  image-request patterns: `send me a pic` and `show me your X`. Coded
  requests like "show me your bedroom" trip the second — but
  "move to whatsapp this chat is too public" (clear coded image
  invitation via platform switch) does not escalate because
  `platform_switch_invitation` by itself has no Level 2 rule.
- **image_request_direct · 3 of 6**. Indonesian "kirim foto" (literal
  "send photo") is not covered by any seeded pattern. The vocab
  `foto` fires but severity 2 alone needs two sensitive-category
  matches to reach Level 2.
- **meeting_arrangement** · 3 of 5. Meeting pattern alone is Level 2,
  but the author labels adult-contact meeting arrangements as Level 3
  (dangerous). The ruleset only escalates to Level 3 when
  `meeting_arrangement` is paired with `age_gap_disclosure`. Realistic
  adult-contact meeting attempts without a numeric age statement land
  below Level 3.
- **false_positive_trap** · 3 of 13 (77% accuracy). The known false
  positives are:
  - "the health teacher said we're going to learn about sex education"
    (en-fptrap-005) · level 2 fired because of `sex` vocab.
  - "pelajaran biologi hari ini bahas tentang seks" (id-fptrap-001)
    · same category, different language.
  - "aku mau foto bareng temen-temen di studio" (id-fptrap-005)
    · "foto" vocab fires regardless of context.

## Where the biggest wins sit

- **benign_everyday · 33/33.** Everyday chat does not over-trigger.
  This is the whole point: no alarming of normal conversations.
- **slang_joke_between_peers · 12/13.** Mild sexual slang between
  friends (`boobs`, `butt`) correctly lands at Level 1.
- **code_switching · 9/9.** Mixed-language benign items don't false-
  positive. The classifier correctly runs patterns in both languages
  regardless of detected language, so EN tokens still fire EN
  patterns inside ID sentences.

## Honest acknowledgments

- The Phase 1 ruleset is a FIRST-DRAFT. These results reflect the
  current ruleset's gaps, not the limit of rules-based classification.
- The corpus is small (125 items). Treat single-digit percentage
  differences as noise.
- The runner is single-message hermetic. Any level that depends on the
  conversation-signal aggregator (`repeated_pressure_after_refusal`,
  `escalation_pattern`, `time_pressure`) is under-counted. A richer
  conversation-aware harness is a future wave.
- The Indonesian seed has no `image_request` pattern, no
  `age_gap_disclosure` pattern, and no `meeting_arrangement` pattern
  depth beyond "ayo/yuk ketemuan". Indonesian Level 3 recall is 0/5
  for that reason.
- The classifier is deterministic for this corpus (consistency check
  passed with 0 disagreements). That is the only "ready" claim this
  baseline makes.

## Recommendations (NOT a plan to implement them)

For the founder's next-step decision:

1. **Secrecy signals need a Level 2 rule.** Current ruleset has
   `secrecy_request` as a tracked signal but no escalation path.
   The 0/6 category accuracy is the single clearest signal.
2. **Platform-switch invitations need a Level 2 rule.** Current
   ruleset treats `platform_switch_invitation` as a tracked signal
   with no immediate escalation. Pattern seed already fires; only the
   resolver is missing.
3. **Indonesian pattern coverage is thin.** Add `kirim foto` /
   `foto dong` patterns (image_request), an ID age_gap_disclosure
   pattern, and additional meeting_arrangement variants.
4. **Context-aware false-positive handling.** The `sex` /
   `seks` / `foto` vocab triggers Level 2 regardless of context.
   A heuristic like "nearby words include teacher/school/class/formulir"
   could demote those matches without introducing an ML dependency.
5. **Serious-risk resolver needs more combinators.** Today Level 3
   requires `image_request pattern + grooming_indicator vocab` OR
   `meeting_arrangement pattern + age_gap_disclosure pattern` OR
   `repeated_pressure_after_refusal`. Add:
   - `grooming_indicator + meeting_arrangement`
   - `grooming_indicator + secrecy_request`
   - `secrecy_request + image_request`
   so clear multi-signal grooming without an age statement reaches
   Level 3.

None of these recommendations are implemented in this wave. The
baseline exists so decisions about them can be made with numbers.

## Source files

- Evaluator entry: `scripts/nex-canonical/_safechat-run-evaluation.mjs`
- Results JSON: `src/lib/nex-native/safechat/__eval__/results-baseline-2026-10-10.json`
- Runner: `src/lib/nex-native/safechat/__eval__/evaluation-runner.ts`
- Metrics: `src/lib/nex-native/safechat/__eval__/metrics.ts`
- Corpora: `src/lib/nex-native/safechat/__eval__/corpus-{en,id,code-switched}.json`
- Ruleset fixture: `src/lib/nex-native/safechat/__eval__/ruleset-fixture.ts`
- Sealed classifier (NOT modified): `src/lib/nex-native/safechat/classifier.ts`
- Sealed seed (NOT modified): `src/lib/nex-native/safechat/_seed-vocabulary.mjs`
