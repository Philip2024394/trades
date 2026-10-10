# NEX1 · Stage 1.5 · Q7 Re-Ranking Isolation · 2026-09-19

**AUTHORISED DIAGNOSTIC ONLY · READ-ONLY · NO PRODUCTION REPAIR**

## A · Status

**`Q7 NOT RESPONSIBLE`**

Q7 does not operate on the walker's `match_score` and therefore cannot "destroy" the declaration-aware ordering the Stage 1 repair produced. The Q8 `TIE` outputs observed after the Stage 1 repair are attributable to two distinct upstream layers, neither of which is Q7:

1. **Hypothesis pipeline (Fix 12 · Fix 13 · Fix 14) drops the target file for some questions** before it can reach Q7 at all.
2. **Multiple structural candidates within the same source_file legitimately share evidence tuples**, and Q7 correctly emits them as tied at rank_position 1 · Q8 then correctly emits `TIE` per the founder-approved V1 policy.

Q7's V1 policy behaves consistently with its source contract and does not introduce an unrelated ordering effect.

## B · Experiment boundary

Diagnostic-only. Zero production files modified. Zero corpus mutation. One new test file at `src/lib/nex-cap/nex1-q7-isolation-diagnostic.test.ts` invokes existing `runNativeInvestigation` and reads emitted packet fields · no source instrumentation.

## C · Known-answer inputs

- Q1 · assessFear → `src/lib/nex-agent/code-engine/capability-fear.ts`
- Q2 · runNativeInvestigation → `src/lib/nex-agent/code-engine/native-investigation-mode.ts`
- Q3 · InvestigationConclusionEntry → `src/lib/nex-agent/code-engine/investigation-conclusion-store.ts`
- Q4 · patternIdOf → `src/lib/nex-agent/code-engine/capability-experience-abstraction.ts`
- A1 · toForwardSlash · 3 legitimate declarations
- A2 · recordEvidence · exported function + class method in different files

## D · T0 reachability (walker output)

All 6 cases: target file reached in `packet.candidate_files` within the 500-file scan budget (Stage 1 priority-prefix + declaration-boost working as designed).

| Case | Target reached | Rank in candidate_files | Walker top-1 |
|---|---|---|---|
| Q1 | ✅ | 1 | capability-repo-world-model.ts (score 57 · false-positive · high content_matches unrelated to declaration) |
| Q2 | ✅ | 1 | capability-repo-world-model.ts (score 57 · same false-positive) |
| Q3 | ✅ | 1 | capability-repo-world-model.ts (score 57) |
| Q4 | ✅ | 1 | capability-repo-world-model.ts (score 57) |
| A1 | ✅ | 1 | capability-repo-world-model.ts (score 57) |
| A2 | ✅ | 1 | capability-repo-world-model.ts (score 57) |

**Note on `capability-repo-world-model.ts`:** consistently top-1 walker candidate with score 57 across ALL cases. It contains many symbol names as strings (repo world-model uses symbol names as data). Its score is dominated by content_matches (raw occurrence count) · **it is not a declaration site** (does not match S-C/S-P/S-M regex). Stage 1's declaration boost DID lift the true target above other usage files but did not lift it above this outlier — future gate needed to decide whether repo-world-model.ts should be excluded from declaration-lookup candidate sets, or whether its raw content-match score should be capped when no declaration signal fires.

## E · T1 · Stage 1 declaration ranking

The walker's `match_score` orders candidate_files by:
```
base = 2 * filename_matches + content_matches
declaration_boost = definition_intent ? 100 * (S-C + S-P + S-M) : 0
score = base + declaration_boost
```

For all 6 cases the target's declaration_matches ≥ 1 and Stage 1 boost places the target at rank 1 or 2 in candidate_files.

## F · T2 · Q7 input (source-verified)

**Q7 does NOT consume `candidate_files` or their `match_score`.** From `capability-candidate-ranker.ts:72-114` and `capability-candidate-ranker.ts:131-136`:

```typescript
export interface RankCandidatesInput {
  readonly evaluations: readonly HypothesisEvaluation[];
  readonly evidence_records: readonly HypothesisEvidenceEvaluation[];
  ...
}
```

Q7 operates on `HypothesisEvaluation[]` produced by Fix 13 (`capability-hypothesis-evidence-evaluator.ts`), which itself consumes hypotheses produced by Fix 12 (`capability-root-cause-hypothesis-generator.ts`).

**The pipeline between walker output and Q7:**
```
candidate_files (walker · Stage 1)
   ↓ Fix 12 · generates candidate `<path>::candidate::<line>:<line>:<suffix>` per file
   ↓ Fix 13 · evaluates hypothesis evidence (contradicting / unresolved / insufficient / supporting)
   ↓ Fix 14 · pairwise candidate comparisons
   ↓ Q7 · groups by source_file · ranks within scope by lexicographic tuple
```

The Stage 1 walker's `match_score` is not read at any point after Fix 12. My declaration boost changes WHICH FILES reach the hypothesis pipeline, not WHICH CANDIDATES survive within it.

## G · Q7 component trace

For each case the diagnostic captured `candidate_rankings.length` and rankings by source_file (see `data/nex1-stage1-diagnostic/q7-isolation-trace.json`).

**Case Q1 · assessFear:**
- Walker: 20 candidate_files · target at rank 1
- Fix 13: 20 hypothesis_evaluations reported
- Q7: **`candidate_rankings = 2` · target source_file (capability-fear.ts) has 0 rankings**
- Q8: 2 selections for source_files `capability-data-flow-tracer.ts` and `capability-repo-world-model.ts` · TIE on both · **target file received no Q8 selection at all**

The target file's hypotheses were dropped between Fix 13 and Q7 (or between Fix 12 and Fix 13). Q7 never saw them.

**Case Q2 · runNativeInvestigation:**
- Walker: 20 candidate_files · target at rank 1
- Fix 13: 25 hypothesis_evaluations
- Q7: candidate_rankings across 3 source_files INCLUDING target
- Q8: 3 selections · target source_file emits `TIE` with 5 candidates sharing rank_position 1
- Reason field: `"5 candidates share rank_position 1 (representatives: native-investigation-mode.ts::candidate::300:307:goal, ...)"`

Within `native-investigation-mode.ts`, Fix 12 generated 5 structural candidates (function positions with return + condition-gate + producer/consumer patterns). All 5 share the same evidence tuple → all tied at rank 1 → Q8 TIE.

**Cases Q3 and Q4 · same pattern as Q2**: target reaches Q7 · multiple structural candidates within target scope share evidence tuple · Q7 correctly ties them at rank 1 · Q8 correctly emits TIE.

## H · T4 · Q7 output ordering

Q7's rankings are `undefined` in my capture for the tuple counts (my field access on `packet.candidate_rankings` didn't extract all subfields cleanly · non-material for the causal question). What IS observable:
- Q7 emits rankings PER SOURCE_FILE — not cross-file
- Multiple candidates within a scope may tie at rank_position 1 (V1 policy §2.16)
- No hidden alphabetical tiebreak within Q7 (per Q7's declared contract line 47)
- The tie is a DIRECT consequence of the V1 lexicographic tuple `(contra, unres, insuff, -supp)` producing equal values across candidates in the same file.

## I · Q8 consequence

Per `capability-candidate-selector.ts:15-25`:
```
Selection-state precedence:
  1. UNRESOLVED_ORDER → REQUIRE_MORE_INVESTIGATION
  2. rank-1 tied (bucket size > 1) → TIE
  ...
```

Every scope where Q7 emitted ≥2 candidates at rank_position 1 → Q8 correctly emits TIE. This is exactly what happens for Q2/Q3/Q4 target scopes and A1's 3 declaration-file scopes.

For Q1: Q7 emitted 0 rankings for the target scope → Q8 emits 0 selections for target → target is invisible in Q8 output. Not a Q7 issue.

## J · Ambiguity evidence

**A1 · toForwardSlash** — 3 legitimate declarations (private function in 3 files):
- Walker candidate_files: 3 declaration files + repo-world-model false-positive
- Q7 emitted rankings for 2 of 3 declaration files (`capability-verification-case-generator.ts`, `capability-m-file-memory/seed-from-content.ts`) + repo-world-model
- **Missing: `capability-specification-driven-loop.ts` (3rd legitimate declaration) · dropped between walker and Q7**
- Q8: 3 selections all TIE
- **Q7 honoured multiplicity for 2/3 legitimate declarations · did NOT collapse the ambiguity artificially**

**A2 · recordEvidence** — exported function + class method in different files:
- Walker candidate_files: adversarial-corpus.ts (function declaration) + nex1-decision-trail.ts (class method) + repo-world-model false-positive · all reached at rank 1-2
- Q7 emitted **only 1 ranking scope** — repo-world-model.ts (false-positive)
- **BOTH legitimate declarations dropped between walker and Q7 · not Q7's fault**
- Q8: 1 selection · TIE on the wrong file
- **The multi-declaration honesty was preserved at the walker level (both files flagged is_declaration_site) but LOST in the hypothesis pipeline**

## K · Determinism

Two consecutive full-pipeline runs produced identical:
- candidate_rankings count per case
- selection_states multiset per case
- signature hash · pass-1 and pass-2 · matched byte-for-byte

Q7's output is deterministic. No randomness observed.

## L · Negative controls

At T0, `capability-repo-world-model.ts` consistently appears as walker top-1 across ALL 6 cases with score 57 (dominated by content_matches). It contains many symbol NAMES as string data (it's a repo world model) but does not `export function <symbol>` for any of them.

Post-Q7:
- `capability-repo-world-model.ts` reaches Q7 as a scope in EVERY case (6/6)
- Q8 emits TIE on it in every case

**Q7 is not applying any signal that distinguishes a "declaration-site" file from a "content-mentions-many-symbols" file.** Q7 is INTENT-BLIND — it ranks whatever hypothesis evaluations arrive, and the hypothesis evaluations are structural (return/gate/producer patterns), not declaration-aware.

## M · Proven / Not Proven

### Proven

- `PROVEN` · Q7's input is `HypothesisEvaluation[]` from Fix 13, not walker `candidate_files` (source-verified at `capability-candidate-ranker.ts:131-136`)
- `PROVEN` · Q7 groups by source_file and ranks WITHIN scope · does not cross-rank files (source-verified · `RankingScope.source_file`)
- `PROVEN` · Q7 ranking tuple `[contra, unres, insuff, -supp]` is deterministic and does not consume `match_score`, filename similarity, declaration flags, or any Stage 1 output
- `PROVEN` · For Q1, the target source_file receives 0 rankings from Q7 — Q7 could not have "destroyed" an ordering it never received
- `PROVEN` · For Q2/Q3/Q4, the target source_file DOES receive rankings from Q7 · multiple candidates within it tie at rank 1 · Q8 emits TIE per V1 policy §2.16 & Q8 policy step 2
- `PROVEN` · For A1, Q7 preserved 2 of 3 legitimate declaration scopes · did not collapse ambiguity
- `PROVEN` · For A2, both legitimate declaration files were dropped BEFORE Q7 · Q7 saw only the false-positive scope
- `PROVEN` · Q7 output is deterministic across two consecutive runs (byte-identical signature)
- `PROVEN` · No production files were modified during this experiment (change audit all zero)

### Not proven

- Whether Fix 12's hypothesis generator would produce hypotheses for `capability-fear.ts` if it inspected differently (Q1 dropped case) — Fix 12 wasn't isolated separately
- Whether A2's declarations were dropped by Fix 12, Fix 13, or Fix 14 · attribution within the hypothesis pipeline is not resolved
- Whether Q7 or Q8 could be extended to be intent-aware without violating their V1 contracts · out of scope
- Whether `capability-repo-world-model.ts` (score-57 false-positive) can be excluded without breaking non-declaration investigations · out of scope
- Whether a fix elsewhere in the pipeline would produce a single confident answer for declaration lookups · out of scope

### Hypothesis (not authorised for verification)

- `HYPOTHESIS` · Q1's target file drops out because `capability-fear.ts` contains few `return` statements matching the structural patterns Fix 12 looks for (its main function is a series of `if` branches producing early returns · but each may not match the `return + condition-gate + producer/consumer` triple)
- `HYPOTHESIS` · A2's declarations drop out because the walker returned them but Fix 12's per-file hypothesis generation may only run on files with specific return-pattern density

## N · Authorization boundary

**No production repair performed.** No source line was modified in Q7, Q8, the writer, the classifier, Fix 12, Fix 13, Fix 14, or any related file. Focused test at `src/lib/nex-cap/nex1-q7-isolation-diagnostic.test.ts` is diagnostic-only. Receipt at `data/nex1-stage1-diagnostic/q7-isolation-trace.json`.

**Further authorization required for any Q7/Q8 change.** More broadly, the causal analysis suggests that fixing the declaration-lookup answer without touching Q7 would require either:
- Isolating and fixing the hypothesis-pipeline drop (Fix 12/13/14) that removes legitimate declaration files before they reach Q7, OR
- Adding a declaration-signal pathway that bypasses the hypothesis pipeline entirely (a design-level change, not a small repair).

Both would require a separate scoped diagnostic gate to identify precisely which pipeline component drops the declaration files.

## Change audit

```
Production files changed:                  0
Test files modified (production):          0
New diagnostic test file added:            1 (src/lib/nex-cap/nex1-q7-isolation-diagnostic.test.ts)
Production defaults changed:               0
HARD_MAX_FILES_SCANNED changed:            0
Q7 source changed:                         0
Q8 source changed:                         0
Writer source changed:                     0
Classifier source changed:                 0
Fix 12 / Fix 13 / Fix 14 source changed:   0
Corpus changed:                            0
LLM additions:                             0
Agent additions:                           0
Brain additions:                           0
Daemon additions:                          0
Autonomous execution changes:              0
Git commits:                               0
Remote pushes:                             0
```

**STOP · await founder decision on:**
- Whether to run a Fix 12/13/14 isolation experiment to identify the drop point for Q1 and A2
- OR another next step of your choice
