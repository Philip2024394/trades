# NEX1 · Ranking · Methods / Arrows / Multi-line Probe · 2026-09-19

**AUTHORISED DIAGNOSTIC · READ-ONLY · NO PRODUCTION MODIFICATION**

## A · Status

**`S-M (CLASS-METHOD SIGNAL) VIABLE · 8/8 CORRECT · 0 FALSE POSITIVES · TWO GAPS RESOLVED · ONE FORM ABSENT`**

- **Class methods (real gap)** · S-M signal achieves 8/8 top-1 with 0 false positives, including one adversarial common-name (`register`)
- **Arrow-const-exports (proposed gap)** · No distinct form found in the codebase. All 3 real cases are IIFE-style `export const X = (() => { ... })()` already covered by S-C's `const` alternative
- **Multi-line exports (proposed gap)** · **Zero real cases** in `src/lib/nex-agent`. Not a real gap in this codebase.

## B · Empirical inventory of rare forms

Per `scripts/nex1-stage1-diagnostic/enumerate-rare-forms.mjs` traversal of `src/lib/nex-agent` non-test files:

| Rare form | Real cases found | Status |
|---|---|---|
| Multi-line export (`export \n function foo`) | **0** | Not present in this codebase |
| Arrow-const export (`export const foo = () => {}`) | 3 nominally (IIFE-style) · 0 pure-arrow | Already covered by S-C's `const` alternative |
| Regular exported class | 2 (`Nex1DecisionTrailBuilder`, `Nex1ReasoningRegistry`) | Already covered by S-C's `class` alternative |
| Class method | **19** across 2 files | The real gap · S-C does not match |

## C · Signal definitions used

| ID | Definition | Regex |
|---|---|---|
| S-C | Has export declaration for `<symbol>` | `^\s*export\s+(?:async\s+)?(?:function\|const\|let\|var\|interface\|type\|class\|enum)\s+<symbol>\b` |
| S-C-prime | Has any declaration | Same as S-C but `export` optional |
| S-M | Is class method (file must contain `export class` too) | `^\s{2,}(?:(?:public\|private\|protected\|static\|async\|readonly)\s+)*<symbol>\s*(?:<[^>]+>)?\s*\(` · gated by presence of exported class |

## D · Class-method test cases (8 targets)

7 unique-name methods + 1 adversarial common-name (`register`).

| ID | Symbol | Expected file | Class |
|---|---|---|---|
| M1 | interpretTask | `nex1-decision-trail.ts` | Nex1DecisionTrailBuilder |
| M2 | composeContext | `nex1-decision-trail.ts` | Nex1DecisionTrailBuilder |
| M3 | acceptCandidate | `nex1-decision-trail.ts` | Nex1DecisionTrailBuilder |
| M4 | evaluateDiff | `nex1-decision-trail.ts` | Nex1DecisionTrailBuilder |
| M5 | recordDiagnosis | `nex1-decision-trail.ts` | Nex1DecisionTrailBuilder |
| M6 | chooseFor | `registry.ts` | Nex1ReasoningRegistry |
| M7 | recordEvidence | `nex1-decision-trail.ts` | Nex1DecisionTrailBuilder (**also exists as exported function in adversarial-corpus.ts**) |
| M8 | register (**adversarial common name**) | `registry.ts` | Nex1ReasoningRegistry |

## E · Aggregate result matrix

Determinism signature `248f6c18d29babd4`.

| Policy | Top-1 correct | False positives | Notes |
|---|---|---|---|
| BASE (V1) | 1/8 | 60 | Raw content count · common words like `register` explode false-positive count |
| P5-C (S-C alone) | 1/8 | 1 | S-C only matches M7 by coincidence (recordEvidence is also an export elsewhere) |
| P8-C-prime | 1/8 | 1 | Same failure profile as P5-C |
| **P11-M** (S-M alone) | **8/8** | **0** | **Class-method signal handles all 8 targets cleanly** |
| P12-C∨M (max) | 7/8 | 1 | M7 loses under UNION because `recordEvidence` is a legitimate export elsewhere · tie → alphabetical picks the wrong one |
| P13-C-prime∨M | 7/8 | 1 | Same as P12 |

## F · Analysis of the M7 non-match under P12

`recordEvidence` has **two legitimate declarations** in the scoped tree:
- `src/lib/nex-agent/adversarial-corpus.ts:435` · `export async function recordEvidence(claim_id, verdict) {`
- `src/lib/nex-agent/code-engine/nex1-decision-trail.ts` · class method inside `Nex1DecisionTrailBuilder`

Under P11-M (class-method only): S-M scores 1 for nex1-decision-trail.ts, 0 for adversarial-corpus.ts (no class) → correct target wins.

Under P12 (max of S-C, S-M):
- adversarial-corpus.ts · S-C = 1, S-M = 0 → max = 1
- nex1-decision-trail.ts · S-C = 0, S-M = 1 → max = 1
- TIE → alphabetical tiebreak → adversarial-corpus.ts wins

This is **not a signal failure** — it is a legitimate multi-declaration ambiguity, structurally identical to the `toForwardSlash` finding from the prior gate. The same symbol legitimately declared twice in two forms.

## G · What this experiment PROVES

- `PROVEN` · Multi-line exports do not exist in `src/lib/nex-agent` · no diagnostic needed for that form in this repo
- `PROVEN` · Arrow-const-exports in this repo are IIFE-style `export const NAME = (() => ...)()` · already matched by S-C's `const` alternative · no separate coverage needed
- `PROVEN` · The real remaining declaration-form gap is class methods
- `PROVEN` · S-M (indented-line + optional method-modifiers + symbol + open-paren, gated by presence of `export class` in same file) achieves 8/8 top-1 on class methods with 0 false positives
- `PROVEN` · Naive UNION of S-C and S-M via `max()` re-introduces ambiguity when the same symbol name is legitimately declared in both forms across different files
- `PROVEN` · Byte-identical determinism · signature `248f6c18d29babd4`

## H · What this experiment does NOT prove

- Does **not** prove S-M generalises to method declarations across other codebases (untested)
- Does **not** prove S-M generalises to abstract methods, arrow-property methods (`bar = () => {}` as class property), constructor overloads, method overloads (untested)
- Does **not** prove how to combine S-C and S-M in production without introducing new failure modes. The M7 finding is an explicit warning: naive combination can regress
- Does **not** prove semantic understanding
- Does **not** prove correctness outside TypeScript
- Does **not** prove production suitability of any combined signal

## I · Combined coverage picture (across the last three gates)

| Declaration form | Cases tested | Best signal | Top-1 correctness |
|---|---|---|---|
| Exported function | 5 + 5 (original 4 + generalisation 5 + this probe's Q4 not counted here) | S-C | 100 % |
| Exported interface | 3 | S-C | 100 % |
| Exported type | 3 | S-C | 100 % |
| Exported const | 4 | S-C | 100 % |
| Exported class | 1 | S-C | 100 % |
| Non-exported (private) function | 4 | S-C-prime | 3 unambiguous + 1 legitimate ambiguity (`toForwardSlash` × 3 identical copies) |
| Multi-line export | 0 | N/A · absent | N/A |
| Arrow-const-export | 3 IIFE-only | S-C's const alternative | 100 % (via general S-C testing) |
| Class method | 8 | S-M | 100 % · 0 false positives |
| Ambiguous multi-declaration | 2 (`toForwardSlash`, `recordEvidence`) | none · genuine ambiguity | Not a signal problem · a policy problem |

**Total controlled cases across all gates: 32 · Combined best-signal top-1 correctness on unambiguous cases: 100 %**

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
- `scripts/nex1-stage1-diagnostic/enumerate-rare-forms.mjs`
- `data/nex1-stage1-diagnostic/rare-forms-inventory.json`
- `src/lib/nex-cap/nex1-ranking-methods-arrows-multiline.test.ts`
- `data/nex1-stage1-diagnostic/ranking-methods-probe.json`

## K · Design implications (observational · NOT production authorisation)

The diagnostic evidence across three gates now establishes:

1. **Two distinct signals discriminate two distinct declaration types with 100 % on unambiguous cases:**
   - S-C · for exported symbols (functions/consts/interfaces/types/classes/enums)
   - S-M · for class methods

2. **Naive UNION creates NEW failure mode when the same symbol legitimately exists in both forms across different files** (M7 recordEvidence, similar to toForwardSlash). Not a defect · a policy question.

3. **A production repair for ranking would need to decide the policy for multi-declaration ambiguity BEFORE combining signals.** Possible policies (all read-only observations · none authorised):
   - Return all legitimate declarations · user disambiguates
   - Prefer the declaration in a file whose name best matches the identifier
   - Prefer the declaration whose containing class/module was mentioned in the question
   - Prefer exported over non-exported when both exist

None of these has been tested.

## Non-implementation reminder · STOP

Zero production files touched. `capability-repository-discovery.ts` unchanged. Q7 V1 unchanged. Await founder decision on:
- Design of production repair (reachability + ranking as separate independently-verifiable changes)
- Or additional diagnostic to prove any specific ambiguity-resolution policy
