# NEX1 · Fix 8 → Fix 14 Boundary Isolation · 2026-09-19

**AUTHORISED DIAGNOSTIC ONLY · READ-ONLY · NO PRODUCTION MODIFICATION**

## A · Status

**`FIX 11 (CHAIN-RELATIONSHIP-COMPOSER) CAUSALLY ISOLATED AS THE FIRST PERSISTENT DROP POINT FOR DECLARATION-STYLE TARGETS · FIX 12/13/14 NOT RESPONSIBLE`**

The pipeline's Fix 8→11 layer was source-verified to be a **structural-chain composer** designed for root-cause analysis — not a declaration-locator. It requires multi-relationship chains where one relationship's `endpoint_B` exactly matches another's `endpoint_A`. Files whose declarations do not participate in such chains produce zero compositions and are therefore invisible to every stage from Fix 12 onwards.

## B · Experiment boundary

Diagnostic-only. Zero production files modified. One new read-only test file at `src/lib/nex-cap/nex1-fix12-13-14-isolation.test.ts` invokes existing `runNativeInvestigation` and extracts intermediate stage evidence from packet fields the pipeline already emits.

## C · Correct pipeline (source-verified · founder correction accepted)

```
Walker (candidate_files)
   ↓
Fix 8   · observed_chains          · detects return + condition-gate + producer/consumer per file
   ↓
Fix 9   · chain_narratives         · human-readable per-chain descriptions
   ↓
Fix 10  · inferred_relationships   · pairs endpoints across chains
   ↓
Fix 11  · composed_arguments       · CHAINS relationships where endpoint_B == endpoint_A
   ↓
Fix 12  · root_cause_candidates    · first endpoint of each composition = candidate
   ↓
Fix 13  · hypothesis_evaluations   · classifies evidence as supporting/contradicting/etc
   ↓
Fix 14  · candidate_comparisons    · pairwise comparisons
   ↓
Q7      · candidate_rankings       · groups by source_file, ranks by evidence tuple
   ↓
Q8      · candidate_selection      · one selection per source_file (SELECTED / TIE / etc)
```

The Stage 1 walker's declaration-aware ranking never influences this downstream pipeline · Fix 12 consumes `ComposedArgument[]` from Fix 11, not walker `candidate_files`.

## D · Per-stage target-appearance evidence

Six cases traced. `total` = items emitted by the stage · `target` = items referencing the expected declaration file.

### Q1 · assessFear · capability-fear.ts

| Stage | total | target | verdict |
|---|---|---|---|
| Walker | 20 | 1 ✓ | present |
| Fix 8 · observed_chains | 126 | 40 ✓ | present |
| Fix 9 · chain_narratives | 300 | 175 ✓ | present |
| Fix 10 · inferred_relationships | 150 | 35 ✓ | present |
| **Fix 11 · composed_arguments** | **20** | **0 ✗** | **FIRST PERSISTENT DROP** |
| Fix 12+ | 20 → 2 | 0 | invisible downstream |

### Q2 · runNativeInvestigation · native-investigation-mode.ts

| Stage | total | target | verdict |
|---|---|---|---|
| Walker | 20 | 1 ✓ | present |
| Fix 8 · observed_chains | 126 | 40 ✓ | present |
| Fix 9 · chain_narratives | 300 | 162 ✓ | present |
| Fix 10 · inferred_relationships | 151 | 36 ✓ | present |
| Fix 11 · composed_arguments | 25 | 20 ✓ | **SURVIVES** |
| Fix 12 · root_cause_candidates | 25 | 15 ✓ | present |
| Fix 13 · hypothesis_evaluations | 25 | 5 ✓ | present |
| Q7 · candidate_rankings | 3 | 1 ✓ | present |
| Q8 · candidate_selection | 3 | 1 ✓ | **TIE** |

Q2 is the ONLY case among the six where the target survives Fix 11. It reaches Q7 · Q8 emits TIE (5 candidates within target scope tie on evidence).

### A1a · toForwardSlash · capability-specification-driven-loop.ts

| Stage | total | target | verdict |
|---|---|---|---|
| Walker | 20 | 1 ✓ | present |
| Fix 8 · observed_chains | 128 | 40 ✓ | present |
| Fix 9 · chain_narratives | 300 | 0 ✗ | transiently absent |
| Fix 10 · inferred_relationships | 199 | 29 ✓ | reappears |
| **Fix 11 · composed_arguments** | **50** | **0 ✗** | **PERSISTENT DROP** |

### A2a · recordEvidence · adversarial-corpus.ts (exported function)

| Stage | total | target | verdict |
|---|---|---|---|
| Walker | 20 | 1 ✓ | present |
| Fix 8 · observed_chains | 83 | 24 ✓ | present |
| Fix 9 · chain_narratives | 300 | 85 ✓ | present |
| Fix 10 · inferred_relationships | 46 | 10 ✓ | present |
| **Fix 11 · composed_arguments** | **2** | **0 ✗** | **PERSISTENT DROP** |

### A2b · recordEvidence · nex1-decision-trail.ts (class method)

| Stage | total | target | verdict |
|---|---|---|---|
| Walker | 20 | 1 ✓ | present |
| Fix 8 · observed_chains | 83 | 13 ✓ | present |
| Fix 9 · chain_narratives | 300 | 58 ✓ | present |
| Fix 10 · inferred_relationships | 46 | 3 ✓ | present |
| **Fix 11 · composed_arguments** | **2** | **0 ✗** | **PERSISTENT DROP** |

## E · Source-verified explanation of the Fix 11 filter

From `capability-chain-relationship-composer.ts:22-40`:

> "Consumes `InferredRelationship[]` · never source content directly. Builds a deterministic index of relationships keyed by endpoint_A signature (source_file + start_line + end_line + fact_kind). For each relationship R_i, finds all R_j where R_j.endpoint_A matches R_i.endpoint_B · that pair is a valid 1-hop composition."

> "No endpoint weakening · shared endpoint requires exact match on (source_file, start_line, end_line, fact_kind)."

**Fix 11 emits a `ComposedArgument` only when relationships CHAIN together via shared endpoints.**

For `capability-fear.ts`: Fix 10 produced 35 relationships involving this file · Fix 11 emitted 0 compositions from those 35. The relationships do not form chains where R.endpoint_B == R'.endpoint_A. `assessFear` is a switch/if-cascade returning early: each `if (condition) return VALUE` is a **self-contained `condition_gates_return`** without a `producer_consumer` feeding its condition. No 1-hop chain forms.

For `native-investigation-mode.ts` (Q2): the function's body has `producer_consumer` relationships (variable computed from function argument) feeding INTO `condition_gates_return` relationships (that variable checked in a conditional that returns). This produces chained compositions → Fix 11 emits 20 of them.

## F · Founder question 6 answer

**"Whether the existing Fix 12/13/14 behaviour was deliberately designed for a narrower investigation class."**

**YES.** Source-verified. The pipeline Fix 8 → Fix 9 → Fix 10 → Fix 11 → Fix 12 was **explicitly designed for STRUCTURAL ROOT-CAUSE ANALYSIS**. From the source comment blocks:

- Fix 11 comment (line 8-13): *"Given independently verified Stage-10 structural relationships, NEX1 can traverse connected relationships and construct a provenance-preserved multi-relationship structural argument. Stage 11 establishes composition. The next stage determines whether NEX1 can turn composition into behavioural/causal meaning."*
- Fix 12 comment (line 8-13): *"NEX1 must be able to consume verified Stage-11 compositions and generate explicitly labelled root-cause hypotheses with provenance and alternatives."*

Both stages consume/produce root-cause artefacts. **They were not built for `where is X declared?` queries.** They were built for `what value does X return, and why did that value depend on this other value?` queries.

## G · Causal classification per case

Founder's five suspected causes:

| Cause | Q1 | Q2 | A1a | A2a | A2b |
|---|---|---|---|---|---|
| Structural-pattern requirements (composition chains) | ✅ | — | ✅ | ✅ | ✅ |
| Candidate construction | — | — | — | — | — |
| Evidence evaluation | — | — | — | — | — |
| Filtering | — | — | — | — | — |
| Other existing rule | — | — | — | — | — |

All 4 dropped cases share the same cause: **Fix 11 structural-composition requirement cannot represent files whose relationships do not chain via shared endpoints.** This is exactly the "structural-pattern requirements" cause the founder listed first.

Q2 avoids the drop because its target file happens to have the chained `producer_consumer → condition_gates_return` structural shape.

## H · Q7/Q8 NOT causally involved for the dropped cases

Q7 and Q8 receive 0 evaluations for the dropped target scope · they cannot rank or select a scope they never received. My earlier Stage-1.5 diagnostic classified Q7 as "NOT RESPONSIBLE" · this diagnostic confirms the same conclusion with per-stage evidence.

## I · Ambiguity findings

- **A1 · toForwardSlash · 3 legitimate declarations:**
  - `capability-verification-case-generator.ts` · dropped at Fix 11 (present through Fix 10)
  - `capability-m-file-memory/seed-from-content.ts` · survived to Q7 (from earlier Q7-isolation trace)
  - `capability-specification-driven-loop.ts` · dropped at Fix 11 (A1a in this experiment)
  
  **2 of 3 legitimate declarations dropped by Fix 11 · 1 survived.** Ambiguity is not preserved through the pipeline — Fix 11's chain requirement is essentially a random filter for declaration cases.

- **A2 · recordEvidence · 2 legitimate declarations:**
  - `adversarial-corpus.ts` (function) · dropped at Fix 11
  - `nex1-decision-trail.ts` (method) · dropped at Fix 11
  
  **Both legitimate declarations dropped by Fix 11.** Q7 saw only false-positive `capability-repo-world-model.ts`.

## J · Determinism

The `runNativeInvestigation` invocation is deterministic (proven in earlier gates). Rerunning this diagnostic would produce byte-identical stage counts (not re-verified here to preserve corpus stability · but consistent with all prior gate results).

## K · Falsification-friendly framing

Per proof standard:

- `PROVEN` · Fix 11 is the first persistent drop point for 4 of the 5 dropped-target cases
- `PROVEN` · Fix 11 requires exact-endpoint chaining · source-verified from `capability-chain-relationship-composer.ts:22-40`
- `PROVEN` · Q2 survives because its file has the specific chained shape Fix 11 requires
- `PROVEN` · Fix 12/13/14 are NOT causally responsible for the drop — they receive 0 items for the dropped scopes
- `HYPOTHESIS` · files whose declarations are pure conditional-return-cascades (like `assessFear`) do not produce the multi-hop chains Fix 11 requires
- `NOT PROVEN` · whether every declaration form falls outside Fix 11's chain shape · only 5 cases tested
- `NOT PROVEN` · whether a lightweight declaration-representation could bypass Fix 11 without disrupting the existing root-cause pipeline

## L · Design implication (observational · NOT authorised)

The founder's own observation is now source-verified:

> "Stage 1 has introduced declaration awareness at the repository-discovery layer, but the existing investigation pipeline may have been designed around relationship/structural chains rather than direct declaration lookup."

The evidence PROVES this. Fix 8-12 form a coherent root-cause-analysis chain. It is a **root-cause pipeline**, not a **declaration-lookup pipeline**. Trying to fix Fix 11 to accept isolated relationships would violate its founder-approved contract (line 39-40): *"No endpoint weakening · shared endpoint requires exact match."*

The correct architectural response — **NOT authorised without further founder gate** — would likely be a narrow declaration-bridge that runs in parallel to the root-cause pipeline: consume the Stage 1 declaration-aware candidates directly · emit `RankingScope` records that reach Q7 without going through Fix 8-11. But this is a design decision · not a diagnostic conclusion.

## M · Existing evidence still stands

Nothing in this diagnostic invalidates:
- Reachability repair · **PROVEN**
- Declaration detection/ranking at the walker · **PROVEN** for tested forms
- Q7 not responsible · **PROVEN**
- Code-engine regression · **2715/2715 unchanged**
- Learning/generalisation experience · **unchanged**

This diagnostic exposes ONE specific representation limitation in the existing root-cause pipeline · it does not disprove NEX's demonstrated coding capability.

## N · Change audit + authorisation boundary

```
Production files changed:                  0
Fix 11 source changed:                     0
Fix 12/13/14 source changed:               0
Q7/Q8 source changed:                      0
Walker source changed:                     0
Classifier source changed:                 0
Corpus changed:                            0
Historical provenance markers:             0 unchanged
LLM/agents/brains/daemons added:           0
Autonomous execution added:                0
Git commits:                               0
Remote pushes:                             0

New diagnostic test file (read-only):     +1 (nex1-fix12-13-14-isolation.test.ts)
New diagnostic receipt:                    +1 (data/nex1-stage1-diagnostic/fix-12-13-14-isolation-trace.json)
```

**No production repair performed.** Further authorization required for any repair to Fix 11 or for building a declaration-representation bridge that bypasses Fix 8-11.

## STOP

Await founder decision on:
- Option A · design a narrowly-scoped "declaration bridge" that consumes Stage 1 walker output and emits `RankingScope`s directly (bypassing Fix 8-11) · new capability · additive · no modification to Fix 11's contract
- Option B · accept the current limitation as an acknowledged design boundary of the root-cause pipeline · declaration lookup answered at the walker layer only · Q8 outputs remain TIE-when-ambiguous
- Option C · run further diagnostic to confirm no shape of declaration file can produce a Fix 11 composition (only 1/5 tested files did · maybe test more)
- Option D · alternative

DIAGNOSED. NOT REPAIRED.
