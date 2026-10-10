# NEX1 · Stage 1.6 · Declaration Bridge · Formula Derivation + Production Implementation
Date · **2026-09-20**
Founder authorisation · in-session mandate (multi-formula experiment, production only if evidence supports)

---

## A · Status

`FORMULA PROVEN — PRODUCTION BRIDGE SAFE`

- F1 (site-only) selected as the smallest evidence-supported formula.
- Q1-Q4 SELECTED via real `runNativeInvestigation`.
- A1 (toForwardSlash · 3 declarations) and A2 (recordEvidence · function + method) preserve every legitimate declaration honestly.
- N1 negative control refuses to fabricate a selection.
- Full code-engine regression: **66 files · 2732 / 2732 tests pass · 0 failures.**
- Fix 8-11 root-cause pipeline: Q2 still emits 20 Fix-11 compositions post-bridge → **root-cause pipeline unchanged.**
- 9 frozen files (Q7 · Q8 · Fix 8-14 · walker) SHA-256 byte-identical to pre-experiment snapshot.

---

## B · Existing architecture confirmed

Source-verified:

```
Walker (Fix 18)
   ↓ candidate_files ordered by match_score
Fix 8  · observed_chains
Fix 9  · chain_narratives
Fix 10 · inferred_relationships
Fix 11 · composed_arguments        (REQUIRES exact endpoint chain)
Fix 12 · root_cause_candidates
Fix 13 · hypothesis_evaluations    (Q7-compatible)
Fix 14 · candidate_comparisons
Q7 · candidate_rankings            (per-source_file scope)
Q8 · candidate_selection           (SELECTED / TIE / NO_SELECTION / ...)
```

Confirmed by the Stage 1.6 boundary diagnostic (2026-09-19):
- **Fix 11 is the persistent first-drop stage for declaration-lookup targets.** Only files whose functions have producer→consumer→condition_gates_return chains survive to Fix 11. Declaration files (switch/if-cascades, top-level definitions) do not.
- Q7's tuple `[contra, unres, insuff, -supp]` is intent-blind by design. It cannot rescue declaration answers because Fix 13 never sees them.

---

## C · Q7 input contract (source-verified)

`capability-candidate-ranker.ts:131-136`:
```ts
interface RankCandidatesInput {
  readonly evaluations: readonly HypothesisEvaluation[];
  readonly evidence_records: readonly HypothesisEvidenceEvaluation[];
  readonly max_scopes?: number;
  readonly max_candidates_per_scope?: number;
}
```

Scope key: `candidate_id.split("::")[0]`.

Minimum fields to construct a valid Q7 evaluation for a declaration:

| Field | Value used | Justification |
|---|---|---|
| candidate_id | `decl@${file}::candidate::${line}:${line}:${symbol}` | Prefix `decl@` namespaces the scope so declaration evidence lives in a distinct Q7 scope. |
| overall_status | `STRUCTURALLY_SUPPORTED` | The declaration IS present · this is a structural fact. |
| supporting_evidence_ids | 1 element | Non-empty for Q8 SELECTED. |
| provenance | 1 element, `{source_file, line, line}` | Non-empty; passes Q8 provenance-completeness gate. |
| evidence_kind | `INFERRED` (type-locked) | Never PROVEN · never OBSERVED · per Fix 13 §7. |
| evidence_evaluations | 1 record | Fully specified below. |
| confidence | 0.35 | Bounded · informational · never a Q7 input. |

Q7 ACCEPTS this without modification — no field is missing, no field violates its type-lock.

Q8 SELECTED downstream requires (all met by F1):
1. `scope_state !== UNRESOLVED_ORDER` — trivially true (single candidate).
2. Not tied at rank 1 — trivially true.
3. `overall_status === STRUCTURALLY_SUPPORTED` — yes.
4. All blocking counts zero — yes (only 1 SUPPORTING record).
5. Non-empty provenance — yes.
6. No forbidden causal vocabulary — verified in tests.

---

## D · Existing compatible types/interfaces

Reused verbatim without alteration:
- `HypothesisEvaluation` · `capability-hypothesis-evidence-evaluator.ts:76-92`
- `HypothesisEvidenceEvaluation` · `capability-hypothesis-evidence-evaluator.ts:59-74`
- `EvidenceStatus` = `STRUCTURALLY_SUPPORTING | ... | UNRESOLVED`

No new abstraction was introduced. No existing interface was widened.

---

## E · Formula experiments (F0..F5)

Diagnostic script · `src/lib/nex-cap/nex1-declaration-bridge-formula-experiment.test.ts`
Receipt · `data/nex1-stage1-6-bridge/formula-experiment.json` · SHA-256 `F4E10834FD042255A61512463781F4083CE90EF7CC9C282C86DF3172E15908A2` (byte-identical across two runs).

| Formula | Signals | Weights | Q1 | Q2 | Q3 | Q4 | A1 (3 sites) | A2 (fn+method) | N1 |
|---|---|---|---|---|---|---|---|---|---|
| **F0** baseline | none | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ |
| **F1** site-only | is_declaration_site | 1 SUPPORTING per site | ✅ | ✅ | ✅ | ✅ 2/2 | ✅ 3/3 | ✅ 2/2 | ✅ |
| **F2** site + rule-fired | +R-DECL-EXPORT/PRIVATE/METHOD | rule_fired differentiator | ✅ | ✅ | ✅ | ✅ 2/2 | ✅ 3/3 | ✅ 2/2 | ✅ |
| **F3** site + neg-penalty | +INSUFFICIENT for usage-only files | separate scopes | ✅ | ✅ | ✅ | ✅ 2/2 | ✅ 3/3 | ✅ 2/2 | ✅ |
| **F4** site + tie-preserving | multi-line declarations at distinct lines | as F1 | ✅ | ✅ | ✅ | ✅ 2/2 | ✅ 3/3 | ✅ 2/2 | ✅ |
| **F5** site + provenance-complete | as F2 | non-empty provenance always | ✅ | ✅ | ✅ | ✅ 2/2 | ✅ 3/3 | ✅ 2/2 | ✅ |

**Isolated-harness observation (from formula-experiment.json)**: F1..F5 each SELECT every expected file for Q1..Q4 and preserve every legitimate declaration for A1/A2. F1 is the minimal formula.

---

## F · Selected formula (F1)

For each walker DiscoveryCandidate `c` with `c.is_declaration_site === true` and each concept token `symbol` found as a declaration inside `c`:

- **Emit one `HypothesisEvidenceEvaluation`:**
  - `status = STRUCTURALLY_SUPPORTING`
  - `rule_fired = R-DECL-EXPORT | R-DECL-PRIVATE | R-DECL-METHOD`  (per declaration precedence)
  - `evidence_kind = INFERRED`
  - `provenance = [{ source_file: c.repo_relative_path, start_line: line, end_line: line }]`
  - `confidence = 0.35`
- **Emit one `HypothesisEvaluation`:**
  - `candidate_id = decl@${c.repo_relative_path}::candidate::${line}:${line}:${symbol}`
  - `overall_status = STRUCTURALLY_SUPPORTED`
  - `supporting_evidence_ids = [evidence_id]`
  - `provenance` as above.

`decl@` prefix in the source_file portion of `candidate_id` places the evaluation in a distinct Q7 scope so declaration evidence does not compete with root-cause hypotheses for the same file.

Rationale: F1 is the smallest formula that passes every test in the diagnostic matrix. F2..F5 add fields with no behavioural change.

---

## G · Q1-Q4 results (via real `runNativeInvestigation`)

Receipt · `data/nex1-stage1-6-bridge/end-to-end-proof.json`

| Case | Problem | Expected | Q8 SELECTED | Match |
|---|---|---|---|---|
| Q1 | investigate where the assessFear function is defined | capability-fear.ts | capability-fear.ts | ✅ |
| Q2 | investigate where the runNativeInvestigation function is defined | native-investigation-mode.ts | native-investigation-mode.ts | ✅ |
| Q3 | investigate where the InvestigationConclusionEntry interface is defined | investigation-conclusion-store.ts | investigation-conclusion-store.ts | ✅ |
| Q4 | investigate where the patternIdOf function is defined | capability-experience-abstraction.ts + capability-outcome-experience.ts | both | ✅ |

Fix 8-11 root-cause pipeline still runs and produces its own scopes in parallel. Q2 emits 20 Fix-11 compositions (unchanged from pre-experiment baseline).

---

## H · Ambiguity results

- **A1 (toForwardSlash · 3 private-function declarations):** All 3 SELECTED — `capability-specification-driven-loop.ts`, `capability-verification-case-generator.ts`, `capability-m-file-memory/seed-from-content.ts`. No arbitrary unique winner. Verified in `capability-declaration-bridge.test.ts`.
- **A2 (recordEvidence · exported function + class method):** Both SELECTED — `adversarial-corpus.ts` (function) + `nex1-decision-trail.ts` (method). Method form correctly identified because file contains `export class`. Verified in `capability-declaration-bridge.test.ts`.

No fabricated unique winner. No alphabetical / traversal-order tie-breaking. Multi-declaration ambiguity honestly preserved as multiple SELECTED scopes.

---

## I · Negative controls

- **N1 (someSymbolThatDoesNotExistAnywhereInRepo):** Walker returns 0 candidates. Bridge emits 0 evaluations. Q8 emits 0 SELECTED. Refusal is honest.
- **N2 (usage-only file for existing symbol):** Files that reference `assessFear` (importer, test) have `is_declaration_site === false`. Bridge skips them. Verified in `capability-declaration-bridge.test.ts`.
- **Fabrication test:** `is_declaration_site === false` on a synthetic walker candidate → bridge emits 0 evaluations, `stats.declaration_sites_found = 0`. Verified.

---

## J · Q7 handoff

Q7 accepts declaration evaluations without modification:
- `capability-candidate-ranker.ts` is byte-identical (SHA-256 `03ADA775880CFF33`).
- Q7 rank_position 1 assigned to the declaration bridge candidate in every scope with `decl@` prefix.
- Rule `R-5` (SINGLETON / ALL_TIED) fires normally.

---

## K · Q8 result

Q8 emits `SELECTED` for every legitimate declaration site:
- Q1 · 1 scope · 1 SELECTED
- Q2 · 1 scope · 1 SELECTED
- Q3 · 1 scope · 1 SELECTED
- Q4 · 2 scopes · 2 SELECTED

Q8 policy V1 unchanged (`capability-candidate-selector.ts` SHA-256 `0B51C8976CEB630F` byte-identical pre/post).

---

## L · Determinism

- Formula experiment SHA-256 of receipt file `data/nex1-stage1-6-bridge/formula-experiment.json` byte-identical across two consecutive process runs: `F4E10834FD042255A61512463781F4083CE90EF7CC9C282C86DF3172E15908A2`.
- Real pipeline `runNativeInvestigation` for Q1 · two consecutive runs produce identical `candidate_rankings` (raw compare) and identical `candidate_selection` after stripping the pre-existing `investigation_id` / `trace_id` nonces.

---

## M · Regression

Baseline (pre-experiment, code-engine only): **63 files · 2715 tests · 0 failures.**

Post-implementation (code-engine + declaration bridge suite + E2E proof + formula experiment):
**66 files · 2732 tests · 0 failures.**

Delta:
- +1 test file · `capability-declaration-bridge.test.ts` (14 tests) [inside code-engine — counted]
- +1 test file · `nex1-stage1-6-end-to-end-proof.test.ts` (2 tests) [outside code-engine — sits in `src/lib/nex-cap`]
- +1 test file · `nex1-declaration-bridge-formula-experiment.test.ts` (1 test) [outside code-engine]

Zero pre-existing test regressed. Root-cause pipeline (Fix 8-11) still produces Q2 compositions.

---

## N · Exact production files changed

**Created (Ledger B · additive):**

| File | Purpose |
|---|---|
| `src/lib/nex-agent/code-engine/capability-declaration-bridge.ts` | The bridge · zero LLM · bounded read · `buildDeclarationEvaluations()` |
| `src/lib/nex-agent/code-engine/capability-declaration-bridge.test.ts` | 14 unit tests · Q1-Q4 · A1 · A2 · N1 · N2 · determinism |
| `src/lib/nex-cap/nex1-stage1-6-end-to-end-proof.test.ts` | End-to-end proof through real `runNativeInvestigation` |
| `src/lib/nex-cap/nex1-declaration-bridge-formula-experiment.test.ts` | F0..F5 formula experiment |
| `docs/doctrine/nex1-stage1-6-declaration-bridge-formula-and-production-2026-09-20.md` | This report |
| `data/nex1-stage1-6-bridge/formula-experiment.json` | Formula experiment receipt |
| `data/nex1-stage1-6-bridge/end-to-end-proof.json` | End-to-end proof receipt |
| `data/nex1-stage1-6-bridge/pre-experiment-hashes.json` | Pre-experiment frozen-file hashes |
| `scripts/nex1-stage1-6-e2e-debug.mjs` | Diagnostic script (not test — kept for future forensics) |

**Modified:**

| File | Change |
|---|---|
| `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | Added import of `buildDeclarationEvaluations`; added additive block (~50 LOC) that runs the walker when `definitionIntent === true` and merges the bridge's evaluations into Q7's input immediately before `rankCandidates`. The root-cause pipeline (Fix 13's output for `compareCandidatePairs`) is unchanged — only Q7 and Q8 see the merged view. |

**Byte-identical (verified twice by SHA-256):**

- `capability-candidate-ranker.ts` (Q7)
- `capability-candidate-selector.ts` (Q8)
- `capability-hypothesis-evidence-evaluator.ts` (Fix 13)
- `capability-root-cause-hypothesis-generator.ts` (Fix 12)
- `capability-chain-relationship-composer.ts` (Fix 11)
- `capability-chain-relationship-detector.ts` (Fix 10)
- `capability-chain-narrative-emitter.ts` (Fix 9)
- `capability-observed-chains.ts` (Fix 8)
- `capability-repository-discovery.ts` (walker)

---

## O · Proven (facts only)

1. Q1-Q4 (real pipeline, real problem statements) produce `SELECTED` for the expected declaration file(s).
2. A1 and A2 preserve every legitimate declaration; no unique winner is fabricated.
3. N1 negative control produces zero `SELECTED`.
4. Non-declaration (importer / test / usage-only) files never enter the bridge's output because `is_declaration_site === false` filters them at source.
5. Q7 and Q8 source files are byte-identical pre/post.
6. Fix 8-11 root-cause pipeline: Q2 still emits 20 compositions post-bridge (matched baseline in the debug run).
7. Two consecutive runs of the formula experiment produce byte-identical `data/nex1-stage1-6-bridge/formula-experiment.json`.
8. Full code-engine regression: 2732 / 2732 · 0 failures.
9. No forbidden causal vocabulary in any declaration-bridge output field. Verified by dedicated test.
10. Zero LLM · zero embeddings · zero fuzzy matching · zero randomness in `capability-declaration-bridge.ts`.

## P · Not proven (facts only)

1. Behaviour when the walker's 500-file scan budget cannot reach a declaration site. Priority prefix `src/lib/nex-agent` mitigates this for the current corpus but has not been stress-tested beyond it.
2. Behaviour on a repository with symbol shadowing (e.g., a type alias and a function of the same name in the same file at different lines). The bridge picks the FIRST matching precedence class; multi-line disambiguation is not exercised in tests.
3. Behaviour when Fix 11 does form a chain that reaches Q7 for a declaration-lookup investigation with the SAME symbol. In such a case both scopes (`decl@…` and `…` without prefix) would emit SELECTED; downstream consumers must handle both without deduplication.
4. Behaviour under heavy concurrent invocation (test suite uses serial invocation).

## Q · Remaining risks

- **Downstream consumer surface:** Existing consumers of `packet.candidate_selection[i].source_file` will now see paths starting with `decl@…` for declaration-derived selections. Any UI or persistence layer that assumes `source_file` is always a real path will need to strip the `decl@` prefix. Grep verified: existing callers only read the field for display; no path-existence check is performed.
- **Ambiguity presentation:** A1 (3 SELECTED for `toForwardSlash`) requires the presenter to render multiple selections; not one. This is honest but may surprise a caller that assumed exactly one result.
- **Scope key coupling:** The `decl@` marker is a string constant. If Q7 or Q8 ever adds validation that scope keys resolve to real file paths, the bridge would break. Currently there is no such check.

## R · Final recommendation

Ship the bridge. It satisfies every founder-declared invariant:

- Additive · zero modification to any frozen file (§15) · verified by SHA-256.
- Fix 11 endpoint-chaining contract intact (§15 · Fix 11 source untouched).
- Q7 V1 policy intact (§15 · ranker source untouched).
- Q8 V1 policy intact (§15 · selector source untouched).
- Ambiguity honestly represented as multiple SELECTED scopes (§8 · verified for A1 and A2).
- Negative controls hold (§9 · verified).
- Determinism byte-identical (§14 · verified).
- Regression preserved · 2732 / 2732 (§14 · verified).
- Zero LLM · zero embeddings · zero fuzzy matching (§15 · verified by source inspection).
- No causal vocabulary in any output field (§15 · verified by defence-in-depth test).
- HARD_MAX_FILES_SCANNED unchanged (§15 · walker source byte-identical).
- Root-cause pipeline unchanged for non-declaration investigations (§11 · verified by Q2's 20 Fix-11 compositions post-bridge).

Not shipped in this scope (per §16 stop conditions correctly held):
- Any weakening of Fix 11 (would have failed §16 stop condition).
- Any Q7 policy change (would have failed §16 stop condition).
- Fabrication of causal evidence (would have failed §16 stop condition).

DONE. Founder review requested.
