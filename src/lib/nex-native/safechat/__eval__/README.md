# NEX SafeChat · classification quality evaluation (`__eval__`)

Operational reference for the hermetic SafeChat classification quality
evaluator. See the baseline numbers in
[`results-baseline-2026-10-10.json`](./results-baseline-2026-10-10.json).

## What this is

A WORKING evaluation tool that scores the Phase 1 SafeChat classifier
against a hand-authored, bilingual, dignified test corpus. It produces
the numbers the founder asked for:

- Overall accuracy, per language (`en`, `id`, `mixed`).
- False-positive rate on benign conversations (how often it alarms
  conversations that are expected to be clean).
- False-negative rate on serious risk (how often it misses conversations
  expected to be serious_risk / level 3).
- Per-class precision / recall / F1.
- Per-category tally so the biggest gap clusters are visible.
- Consistency check: every item is classified twice. If the two runs
  disagree, the classifier is non-deterministic and that's a bug.

## Not what this is

- Not a gate. The script exits 0 regardless of the score. We are
  measuring, not blocking.
- Not production. The evaluator mirrors the production seed ruleset in
  memory (`ruleset-fixture.ts`) so it runs without a database. The real
  classifier reads the live `nex.safechat_vocabulary_term` /
  `nex.safechat_pattern` tables. If those tables ever drift from the
  seed, the drift is a different problem (handled elsewhere).
- Not a doctrine essay. For headline findings see
  `docs/doctrine/nex-safechat-classification-quality-baseline-2026-10-10.md`.

## File map

| File | Role |
|---|---|
| `corpus-en.json` | 60 hand-authored English items (benign, sensitive, unsafe, serious, false-positive traps) |
| `corpus-id.json` | 45 hand-authored Bahasa Indonesia items |
| `corpus-code-switched.json` | 20 hand-authored EN↔ID code-switched items |
| `ruleset-fixture.ts` | In-memory mirror of the Phase 1 starter seed (`_seed-vocabulary.mjs`) · must be kept in sync with the seed · drift corrupts the evaluation |
| `metrics.ts` | Pure confusion matrix + per-class precision/recall/F1 math |
| `metrics.test.ts` | 19 deterministic unit tests for `metrics.ts` |
| `evaluation-runner.ts` | Hermetic runner · calls the sealed classifier (`resolveLevel` + `computeConfidence` + `matchVocabulary` + `matchPatterns`) against the in-memory ruleset |
| `evaluation-runner.test.ts` | 20 unit tests for the runner |
| `results-baseline-2026-10-10.json` | The actual numbers from the baseline run · committed · reviewable |

The entry point lives at
`scripts/nex-canonical/_safechat-run-evaluation.mjs`.

## How to run

From the repo root:

```sh
node --conditions=react-server --import tsx scripts/nex-canonical/_safechat-run-evaluation.mjs
```

The two flags matter:

- `--conditions=react-server` routes the `server-only` marker to its
  empty branch so the classifier TypeScript modules can be imported in
  plain Node. In production, Next.js handles this via its own loader.
- `--import tsx` lets the plain-Node script execute `.ts` modules
  on-the-fly. The same pattern is used by `scripts/nex-conv/*`.

The script:

1. Loads the three corpora.
2. Runs the evaluation (every item twice — consistency check).
3. Writes the full report to `results-baseline-2026-10-10.json`.
4. Prints headline numbers to stdout.
5. Exits 0.

To iterate on the corpus (add items, tune expected levels), edit the
JSON files in-place and re-run.

## How to interpret the output

### Overall

- **`overall.accuracy`** · fraction of items where the classifier's
  predicted level matched the author's expected level. 1.0 is perfect.
- **`overall.falsePositiveRateOnBenign`** · of items the author
  labelled 0 (benign), the fraction the classifier escalated to >= 1.
  Lower is better. "Alarming grandparents and homework chats" is the
  thing this measures.
- **`overall.falseNegativeRateOnSerious`** · of items the author
  labelled 3 (serious_risk), the fraction the classifier dropped to
  <= 2. Lower is better. "Missing a grooming conversation" is the
  thing this measures.

### Per-language

Same metrics scoped to `en` / `id` / `mixed` items. Divergence between
languages identifies vocabulary coverage gaps.

### Per-category

A tally per `category_tag` (`grooming_pattern`, `coercion_pressure`,
etc.). The biggest category with the lowest accuracy is the biggest
place to invest ruleset work.

### Consistency

`duplicateRunDeltaCount` should always be 0. The classifier is a pure
function of the message + the seeded ruleset; a non-zero value here
would indicate real non-determinism and warrants investigation.

### Failing items

`failingItems` lists every item the classifier got wrong, with:

- the original corpus item (synthetic, dignified — see corpus authoring
  rules below),
- the actual predicted level,
- the `ruleMatches` that fired (category + signal name only — never
  message body text),
- the delta (actual - expected).

Sort by `|delta|` to find the worst misses first.

### Passing items

Compacted: `{id, expected_level, actualLevel}` only. Keeps the report
file reviewable.

## Corpus authoring rules

- Every item is synthetic. No real conversation, no real person's
  words.
- No first names of real people. No identifying detail.
- Items are brief (10–50 words typical).
- Even Level 3 cases describe grooming PATTERNS without lurid detail —
  dignified language throughout.
- `conversation_context` is a short English note about preceding
  messages when the classification depends on history (e.g. "recipient
  previously refused image request" → aggregator signal). It is NOT a
  full chat log.
- `category_tag` is drawn from the vocabulary in the task spec; new
  tags are fine but should be stable (the per-category table groups on
  them).

## Keeping `ruleset-fixture.ts` in sync with `_seed-vocabulary.mjs`

The fixture mirrors the Phase 1 seed exactly. If you change the seed
(after an ethics review), update the fixture in the same commit. A
drift between the two makes the evaluation score the WRONG classifier.

The simplest way to verify: diff the two files side by side. The
category / severity / language columns and the regex strings must
match character-for-character.

## When to re-run

- After ruleset changes (seed updated → fixture updated → re-run).
- After classifier changes (resolveLevel thresholds, confidence
  formula, etc.).
- When the corpus is expanded.
- Before deploying any policy change that depends on the current level
  distribution.

## Honest limits

- The ruleset is a FIRST-DRAFT. Baseline numbers reflect the current
  ruleset's gaps, not the limit of what rules-based classification can
  achieve.
- The corpus is small (~125 items). Numbers have real variance; treat
  single-digit percentage differences as noise.
- Code-switching coverage is early. The 20-item mixed corpus is enough
  to flag the biggest cross-language gaps, not enough to make strong
  claims about Indonesian teen chat.
- The runner uses `emptySignals()` for every item (no conversation
  history). That means tests of conversation-level signals
  (`repeated_pressure_after_refusal`, `escalation_pattern`) are
  measured only via their vocabulary/pattern proxies, not via the
  aggregator's historical cross-message logic. Items that expect
  Level 3 purely from a conversation signal will be under-classified
  here.
