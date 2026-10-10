# NEX1 · Ranking-Generalisation Experiment · 2026-09-19

**AUTHORISED DIAGNOSTIC · READ-ONLY · NO PRODUCTION MODIFICATION**

## A · Status

**`S-C GENERALISES WITHIN TYPESCRIPT · 19/20 · 1 CASE IS AMBIGUOUS (not a signal failure)`**

More precise breakdown:
- Exported declarations · **16/16 = 100 %** correct top-1 via S-C alone
- Non-exported (private) declarations · **3/4 = 75 %** via S-C prime (which permits non-exported forms)
- Single non-match is a **legitimate 3-way ambiguity**, not a signal defect

## B · Sample composition

20 targets independently selected via deterministic hash-diverse picker from all top-level declarations under `src/lib/nex-agent/**/*.ts` (excluding `*.test.ts` and `_*` test-mode helpers · restricted to name-length ≥ 4).

| Kind | Count |
|---|---|
| Exported function | 5 |
| Exported interface | 3 |
| Exported type | 3 |
| Exported const | 4 |
| Exported class | 1 |
| Non-exported function | 4 |
| **Total** | **20** |

Full sample in `data/nex1-stage1-diagnostic/generalisation-sample.json`.

## C · Aggregate results by policy

Reproduction hash: `f7705719cd096749` (deterministic across the run).

| Policy | Overall | Exported (16) | Private (4) |
|---|---|---|---|
| BASE (current V1) | 13/20 | 10/16 (62.5 %) | 3/4 (75 %) |
| **P5-C** (S-C alone) | **19/20 (95 %)** | **16/16 (100 %)** | 3/4 (75 %) |
| P7-C+A (10·S-C + 3·S-A) | 19/20 | 16/16 | 3/4 |
| **P8-C-prime** (any-declaration) | **19/20 (95 %)** | **16/16 (100 %)** | 3/4 (75 %) |
| P9-C-prime+A | 19/20 | 16/16 | 3/4 |
| P10-C-prime−B | 19/20 | 16/16 | 3/4 |

Every S-C-based policy achieves 100 % on exported declarations across all kinds tested.

## D · Per-case detail (20 rows)

Legend · `✓` = target file becomes top-1 · `✗` = does not

| # | Kind | Name | Reached | BASE rank | P5-C | P9-C'+A |
|---|---|---|---|---|---|---|
| 1 | function | splitTextAndCode | ✓ | 1 | ✓ | ✓ |
| 2 | function | quickImport | ✓ | 0 | ✓ | ✓ |
| 3 | function | finaliseReport | ✓ | 1 | ✓ | ✓ |
| 4 | function | recordMentorReview | ✓ | 0 | ✓ | ✓ |
| 5 | function | openThread | ✓ | 1 | ✓ | ✓ |
| 6 | interface | FastPathDecision | ✓ | 0 | ✓ | ✓ |
| 7 | interface | MissingEvidence | ✓ | 0 | ✓ | ✓ |
| 8 | interface | RegisterAgentInput | ✓ | 0 | ✓ | ✓ |
| 9 | type | Nex1MatchKind | ✓ | 0 | ✓ | ✓ |
| 10 | type | BindingKindHint | ✓ | 0 | ✓ | ✓ |
| 11 | type | ChangeVerb | ✓ | 0 | ✓ | ✓ |
| 12 | const | ENGLISH_QUANTIFIERS | ✓ | 0 | ✓ | ✓ |
| 13 | const | REFLECTION_AWARE_PREDICTION_VERSION | ✓ | 0 | ✓ | ✓ |
| 14 | const | mb_fix_confidence | ✓ | 1 | ✓ | ✓ |
| 15 | const | TASK_PROJECT_BINDING_VERSION | ✓ | 1 | ✓ | ✓ |
| 16 | class | Nex1ReasoningRegistry | ✓ | 2 | ✓ | ✓ |
| 17 | function (private) | evaluateFunctionCall | ✓ | 0 | ✓ | ✓ |
| 18 | function (private) | toForwardSlash | ✓ | 1 | ✗ | ✗ |
| 19 | function (private) | getState | ✓ | 0 | ✓ | ✓ |
| 20 | function (private) | getAgentDbPath | ✓ | 0 | ✓ | ✓ |

## E · Analysis of the single non-match

`toForwardSlash` — private helper — is defined identically in **three** files:

```
src/lib/nex-agent/code-engine/capability-m-file-memory/seed-from-content.ts:80
    function toForwardSlash(p: string): string {

src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts:113
    function toForwardSlash(p: string): string {

src/lib/nex-agent/code-engine/capability-verification-case-generator.ts:102
    function toForwardSlash(p: string): string {
```

S-C correctly identifies **all three** as declarations. The picker's arbitrarily-chosen "expected_file" was `capability-verification-case-generator.ts`, but `seed-from-content.ts` and `capability-specification-driven-loop.ts` are equally valid answers. Alphabetical tiebreak (baked into the walker's ordering) picked `seed-from-content.ts` first.

This is **not a signal failure** — this is a legitimate ambiguity in the ground truth. If the question "where is `toForwardSlash` defined?" is answered by any of the three files, S-C is correct.

## F · What this experiment PROVES

- `PROVEN` · S-C (regex `^\s*export\s+(function|const|let|var|interface|type|class|enum)\s+<symbol>\b`) top-ranks exported declarations across **all 5 kinds tested** (function, interface, type, const, class) at 16/16 = 100 %.
- `PROVEN` · S-C-prime (allowing non-`export` prefix) top-ranks private functions at 3/3 unambiguous cases; the 4th case is a 3-way ambiguity where all 3 candidates are correct answers.
- `PROVEN` · Signal computes from candidate FILE CONTENT already loaded by the walker. Zero new evidence source. Zero LLM.
- `PROVEN` · Byte-identical determinism across the run (signature `f7705719cd096749`).
- `PROVEN` · Current BASE ranker gets 13/20 = 65 %. Adding S-C improves to 19/20 = 95 %. On exported declarations specifically: 10/16 → 16/16 (+37.5 pp).
- `PROVEN` · Target file was reachable in candidate set for 20/20 cases when scoped to `src/lib/nex-agent` at default cap 500 · reinforces prior reachability finding.

## G · What this experiment DOES NOT prove

- Does **not** prove S-C generalises beyond top-of-line single-line declarations. Multi-line `export\n(function|const|...) X` was not tested (rare in this codebase · would require a separate probe).
- Does **not** prove correctness for symbols that appear as class METHODS (`class Foo { bar() {} }`) — no such target was chosen.
- Does **not** prove correctness for symbols declared as arrow-function `export const foo = () => {}` — although this IS covered by S-C's `const` alternative, only 4 const cases were tested.
- Does **not** prove correctness outside TypeScript (Python, Rust, plain JS untested).
- Does **not** prove production suitability — no regression test against the 15+ existing coding-loop tests was run.
- Does **not** prove semantic understanding beyond declaration-location lookup.
- Does **not** prove AGI / general intelligence.
- Does **not** prove that the walker's default `src` + `docs/doctrine` scope is now correct at production scale · this experiment used the scoped `src/lib/nex-agent` prefix.

## H · First broken link · updated

| Layer | Status |
|---|---|
| Stage 0 · language → intent | ✅ PROVEN CLOSED |
| Reachability (S1-D) · whole-repo | ❌ Blocked · fix design pending |
| Reachability (S1-D) · scoped | ✅ PROVEN VIABLE for this repo |
| Identifier-aware discovery | ✅ PROVEN · 20/20 in candidate set |
| Declaration-vs-usage discrimination | ✅ PROVEN via S-C · 19/20 (95 %) · 100 % on exports |
| Current V1 ranking alignment | ❌ 13/20 (65 %) |
| TypeScript generalisation of S-C | ✅ PROVEN for declaration forms tested |
| Multi-line / method / arrow generalisation | ⏳ UNTESTED |
| Cross-language generalisation | ⏳ UNTESTED |
| Production reachability architecture | ⏳ DESIGN DECISION |
| Production ranking architecture | ⏳ DESIGN DECISION |
| Broader semantic correctness | ❌ UNPROVEN |
| AGI / general intelligence | ❌ UNPROVEN |

## I · Required next diagnostic (NOT authorised)

Two natural progressions · both diagnostic-only:

1. **Method / arrow / multi-line coverage** · construct a small controlled corpus of:
   - class-method declarations (`class Foo { bar() {} }`)
   - arrow-function `export const foo = () => {}` (some already covered as const)
   - multi-line declarations (`export\nfunction foo`)
   
   Falsify or confirm whether S-C's regex needs an extension.

2. **Cross-language falsification** · a small foreign-language codebase with known declaration sites (5-10 targets in Python/Rust). Falsify whether the declaration-signal assumption is TypeScript-specific.

Either would tighten the boundary of what S-C is proven to handle.

## J · Change audit

```
Production files changed:                  0
Production defaults changed:               0
HARD_MAX_FILES_SCANNED changed:            0
allowed_root_prefixes default changed:     0
Q7 policy changed:                         0
Q8 policy changed:                         0
Ranker source changed:                     0
Walker source changed:                     0
Tests changed:                             0
Corpus changed:                            0
Architecture changed:                      0
LLM calls added:                           0
Agents added:                              0
Brains added:                              0
Daemons added:                             0
Autonomous execution added:                0
Git changes:                               0
Remote pushes:                             0
```

Read-only additive artefacts (outside any production pipeline):
- `scripts/nex1-stage1-diagnostic/enumerate-declarations.mjs` (declaration enumerator · picker)
- `src/lib/nex-cap/nex1-ranking-generalisation-experiment.test.ts` (re-scoring harness)
- `data/nex1-stage1-diagnostic/generalisation-sample.json` (20-target sample)
- `data/nex1-stage1-diagnostic/ranking-generalisation-experiment.json` (full receipt · determinism signature `f7705719cd096749`)

## Non-implementation reminder · STOP

Production ranker at `capability-repository-discovery.ts:321` is UNCHANGED. Q7 V1 is UNCHANGED. Walker default `allowed_root_prefixes` is UNCHANGED at `["src","docs/doctrine"]`. Await founder decision on next step (method/arrow probe, cross-language probe, production repair design, or alternative).
