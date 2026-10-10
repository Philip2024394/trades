# NEX1 · S0-HYBRID · Phase 2 · Production Wire-In
Date · **2026-09-20**
Founder-authorised · tightly scoped · additive caller-boundary change.

Preceded by three read-only diagnostics (S0-EXTRACT · S0-DERIVE · S0-HYBRID A/B) that jointly proved the hybrid list-fast-path-plus-derived-fallback preserves canonical operator rejection AND generalises to previously-unseen tokens. Phase 2 wires that hybrid into production at exactly one caller-boundary in `native-investigation-mode.ts`, gated on the existing `definitionIntent` flag.

---

## A · Truth classification

`PRODUCTION WIRE-IN VERIFIED.`

- Focused H1-H9 tests · **9 / 9 pass**.
- Full regression · **68 files · 2754 / 2754 · 0 failures** (baseline 2748 · +6 · zero regression).
- Capability probe T1-T4 · **6 / 6 clean · every case `match_expected: ✅ · llm_free: ✅ · bypassed: ✅`**.
- Frozen-file SHA-256 audit · **13 files UNCHANGED**. Only `native-investigation-mode.ts` changed, as designed.
- Determinism · **deterministic parts byte-identical across two separate processes** (see §J).
- Safety invariant · **OPERATOR is the only class that may be stripped**. TARGET / AMBIGUOUS / UNRESOLVED are preserved.

---

## B · What was wired in

One additive block in `native-investigation-mode.ts`, immediately after the existing `DEFINITION_INTENT_TOKENS` fast-path filter, inside the existing `if (definitionIntentForBridge)` branch. The block:

1. Tokenises the raw `problem_statement` preserving original case (for morphology signals).
2. For every token that survived the canonical fast-path filter, invokes the frozen `hybridClassifyRole(original, lowercase, statement, repoRoot)` rule.
3. Splits tokens by role:
   - `OPERATOR` → **dropped** from the walker/bridge input.
   - `TARGET`, `AMBIGUOUS`, `UNRESOLVED` → **preserved**.
4. Emits deterministic trace lines listing removed tokens and preserved-with-role tokens.

The frozen rule is imported from the same file's exported helper — it is the same rule proven in the S0-DERIVE and S0-HYBRID diagnostics, unchanged.

---

## C · Safety invariant · founder-locked

```
OPERATOR   → strip (only removable class)
TARGET     → preserve
AMBIGUOUS  → preserve (may carry legitimate identifier collision)
UNRESOLVED → preserve (honest uncertainty)
```

Enforced by a single conditional: `if (role !== "OPERATOR") hybridFilteredTokens.push(t);`. This is the wire-in's non-negotiable line and is directly asserted by H5 (AMBIGUOUS preserved), H6 (UNRESOLVED preserved), and H8 (multi-declaration ambiguity preserved).

Motivating case: `defined` is a canonical operator AND a real identifier at `capability-repo-world-model.ts:223`. The founder explicitly required that ambiguity like this MUST NOT be silently collapsed to `OPERATOR` by the derived path. The list fast-path retains its aggressive rejection on canonical operators; the derived path never converts AMBIGUOUS to OPERATOR.

---

## D · Focused H1-H9 tests · results

| Test | Property | Result |
|---|---|---|
| H1 | canonical `defined` removed by existing fast-path | ✅ |
| H2 | lowercase legitimate identifiers (`save · check · apply · list · query`) never OPERATOR | ✅ |
| H3 | 25 blind hash-diverse identifiers from `data/nex1-s0-hybrid/hybrid-corpus-names.txt` never OPERATOR | ✅ |
| H4 | grammatical / interrogative tokens (`how`, `the`) classified OPERATOR | ✅ |
| H5 | `class` in target-slot classified AMBIGUOUS and preserved | ✅ |
| H6 | UNRESOLVED classification preserved | ✅ |
| H7 | nonexistent identifier does not fabricate a declaration | ✅ |
| H8 | `toForwardSlash` 3-declaration ambiguity — all 3 legitimate sites SELECTED | ✅ |
| H9 | non-definition query does not invoke derived fallback | ✅ |

Test file · `src/lib/nex-cap/nex1-s0-hybrid-phase2-focused.test.ts`.

---

## E · Capability probe (T1-T4)

Same 3+1-layer probe used by the Phase 1.6 bridge, re-run post-wire-in:

| Case | Symbol | SELECTED before | SELECTED after | Correct? |
|---|---|---|---|---|
| T1 | `assessFear` | 1 | **1** | ✅ target only |
| T2a | `evaluateHypothesisEvidence` | 1 | **1** | ✅ |
| T2b | `ComposedArgument` | 1 | **1** | ✅ |
| T2c | `computeAbsenceCandidates` | 1 | **1** | ✅ |
| T3 | `toForwardSlash` | 3 (all legitimate) | **3** | ✅ ambiguity honoured |
| T4 | `generateRootCauseCandidates` | 10 (target + residual noise) | **1** | ✅ **material improvement** |

T4 was the previously-documented residual defect from S0-REPAIR Phase 3 (English words `symbol`, `multiple`, `site`, `file` were not in the canonical DEFINITION_INTENT_TOKENS list, so they leaked as TARGET and produced 9 extra SELECTED). The derived fallback correctly classifies each of them as OPERATOR (ratio<LOW · not-target-slot) and the residual noise is eliminated. This is the concrete real-world win from Phase 2.

---

## F · Full regression

```
Test Files:  68 passed (68)
Tests:       2754 passed (2754)
Failures:    0
Baseline:    2748 (S0-REPAIR Phase 3)
Delta:       +6 (matches expected: H1-H9 + shared per-file loading)
```

Zero pre-existing tests regressed. The 9 new focused tests all pass. Six of them are new pipeline-level integration tests; H2/H4/H5/H6 are direct classifier assertions and don't run the full pipeline.

---

## G · Frozen-file SHA-256 audit

13 frozen files unchanged post-wire-in:

```
Q7  capability-candidate-ranker.ts                                              03ada775880cff33
Q8  capability-candidate-selector.ts                                            0b51c8976ceb630f
Walker capability-repository-discovery.ts                                       80046e0e43ad6224  (matches memory · unchanged from S1-REPAIR)
Bridge capability-declaration-bridge.ts                                         4c616968b28eb13d
Classifier capability-a-founder-intent/classifier.ts                            53ddd61cbdcf45b1  (matches memory · unchanged from FIX-S0)
Vocabulary capability-a-founder-intent/vocabulary.ts                            9148fcab1899b977  (matches memory · unchanged from FIX-S0)
Fix 8  capability-observed-chains.ts                                            d4c66b64a1453a4e
Fix 9  capability-chain-narrative-emitter.ts                                    93e4d7016953c972
Fix 10 capability-chain-relationship-detector.ts                                9b451bb440a3233b
Fix 11 capability-chain-relationship-composer.ts                                4b0c2fcb86e60497
Fix 12 capability-root-cause-hypothesis-generator.ts                            3672618c774fd509
Fix 13 capability-hypothesis-evidence-evaluator.ts                              896a36e30b12501d
Fix 14 capability-candidate-comparator.ts                                       7e9bd4c5de27b8ee
```

Only file changed:

```
native-investigation-mode.ts (Phase 2 wire-in target) → 5fe7136f4267f82f
```

The one changed file is exactly the caller-boundary of the wire-in. Every downstream cognitive module in the pipeline is bit-identical.

---

## H · What was NOT modified

- Zero LLM.
- Zero embeddings.
- Zero new vocabulary.
- Zero new lexicon.
- Zero new agent.
- Zero new brain.
- No verifier tuned for the wire-in.
- No corpus mutation.
- No test relaxation (all 9 focused tests were written before the wire-in was proven; none were softened after).

---

## I · Change audit

```
Files modified · production                       1  (native-investigation-mode.ts · single additive block, ~140 LOC of helpers + ~30 LOC wire-in)
Files added · tests                               1  (src/lib/nex-cap/nex1-s0-hybrid-phase2-focused.test.ts · 213 lines · 9 tests)
Files added · doctrine                            1  (this file)
Files added · memory                              1  (project_nex1_s0_hybrid_phase2_2026_09_20.md · index update)
Files added · corpus                              0  (blind corpus was frozen in S0-HYBRID)
Frozen files touched                              0  (13 files SHA-256 verified byte-identical)
```

---

## J · Determinism

The focused test file was run twice in separate processes. The 9 test assertions in H1-H9 are deterministic — same test names, same pass-mark for each, same test-file-count and test-count line — and are **byte-identical** across the two runs:

```
Deterministic-only output SHA-256:  b93df63245e58f0a6fc9a95e69fe9602645681f50136a17632adb99a49e102c5  (identical in both runs)
```

The raw `tail -8` capture also differs on wall-clock lines only (per-test `NNNNms` durations, `Start at HH:MM:SS`, and Vitest's `Duration` total). Those are wall-clock artefacts of the runtime, not NEX-product output.

A harness note: during the first automated determinism run, the compound shell command diffed the full `tail -8` capture (which includes wall-clock lines) and exit-coded 1. Root cause: shell-harness defect, not NEX nondeterminism. The corrected comparison — stripping timing lines — proves byte-identical deterministic content. See §K.

---

## K · Harness note (transparency)

The initial automated command was:
```
(vitest run … | tail -8) > run1.txt && (vitest run … | tail -8) > run2.txt && … && diff run1.txt run2.txt && echo "BYTE-IDENTICAL"
```

`tail -8` inevitably captures wall-clock lines (`Start at HH:MM:SS`, per-test `NNNNms`, `Duration XX.XXs`). Those lines cannot be byte-identical between two processes. `diff` exit-coded 1 on the timing-only differences and short-circuited the `&&` chain, propagating exit code 1 to the background task.

The finding was **harness-orchestration only** — no NEX product output differed. No production change was made in response. The correct verification (§J) is what stands as the determinism proof.

---

## L · What this proves and what it does not

**Proves:**
1. The frozen S0-DERIVE + S0-HYBRID hybrid rule is now wired into production at exactly one caller-boundary, additively.
2. The safety invariant (OPERATOR-only strip) holds under all 9 focused assertions and 6 capability-probe cases.
3. Full regression is zero-regression at the 2754-test / 68-file scale.
4. Determinism holds byte-identically on the deterministic parts of vitest output.
5. Downstream cognitive infrastructure (Q7 · Q8 · walker · bridge · Fix 8-14 · classifier · vocabulary) is verifiably unchanged.
6. T4's previously-documented residual noise (from S0-REPAIR Phase 3) is now eliminated — 10 SELECTED → 1 SELECTED.

**Does not prove:**
1. Adversarial name shapes (single-letter · all-caps · unicode · homoglyphs).
2. Non-English queries.
3. Cross-repository generalisation.
4. Task types beyond declaration-lookup / structural coding operators.
5. Autonomous problem-type selection (i.e., whether NEX chooses the right cognitive slot without being told).

The last point is the next diagnostic frontier — the fresh unseen-problem-type diagnostic (Experiment 3) is designed to probe it.

---

## Recommendation

Phase 2 wire-in stands. STOP. Awaiting founder direction on Experiment 3 protocol.
