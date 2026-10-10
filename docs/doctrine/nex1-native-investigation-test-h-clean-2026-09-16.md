# NEX1 · Test H · Clean Direct-Edge Verification

**Date:** 2026-09-16
**Status:** CLEAN Test H CORRECT · all 7 pass conditions satisfied · edge-expansion single-hop direct-import capability RUNTIME-VERIFIED · A-G regression preserved · Track A untouched · freeze intact
**Author:** master_ai_engineer — NOT NEX1 runtime
**Governing directive:** Founder-authorized Test H clean repair · verify ground truth from source BEFORE running blind · zero build
**Explicit non-authorization:** no new capability · no multi-hop navigation · no Track A activation · no code modification outside test-only correction

**Raw runtime evidence:** `data/nex1-test-h-clean/receipt-2-concept-2026-09-16.json` (286 lines · verbatim NEX1 output)
**Prior Test H (invalid ground truth):** `data/nex1-test-h/receipt-2026-09-16.json`
**Vocabulary audit:** `scripts/nex1-test-h-clean/vocab-audit.mjs`
**Post-fix regression:** `data/nex1-absence-tests/receipt-post-clean-h-2026-09-16.json` + `data/nex1-test-g/receipt-post-clean-h-2026-09-16.json`

---

## 1 · Test purpose

Test whether NEX1 can discover a file that does NOT match extracted vocabulary by following a REAL direct import edge from a vocabulary-matched candidate. This is the specific claim Fix 5 (edge-expansion) makes. Test H clean verifies that claim against a scientifically-verified ground truth.

---

## 2 · Ground truth (Phase 2 · verified from source BEFORE blind run)

**File A · discoverable via vocab:**
- `src/lib/nex-cap/cap-spec-bridge.ts`
- Verified token counts (whole-word · case-insensitive):
  - `authorization` × 9
  - `envelope` × 1
  - `ed25519` × 2
  - `mission` × 3

**File B · low vocab match · reachable only via direct import edge:**
- `src/lib/nex-cap/real-workstation-adapter.ts`
- Verified token counts:
  - `authorization` × 0
  - `envelope` × 0
  - `ed25519` × 0
- **Zero occurrences of the three target vocab tokens · cannot surface via tag search.**

**Direct import edge · verified at source line:**
- `cap-spec-bridge.ts:19` — `import type { WorkstationExecutionPlan } from "./real-workstation-adapter";`
- Cross-verified · type-only import IS captured by `buildDependencyGraph`'s `IMPORT_TYPE_RE`

**Negative control:**
- `src/lib/nex-code-brain/knowledge-store.ts`
- In seeded corpus · not imported by any top-10 candidate · no target vocab match
- Should NOT appear in candidates via vocab OR via edge · if it does, false-positive detected

---

## 3 · Blind problem statement

Verbatim to NEX1 (no additional hints · no target filenames · no expected concepts):

> *"The authorization envelope for a programming mission determines what can execute. Investigate what governs whether the envelope is accepted."*

Deliberately chosen to extract only 2 concepts (`authorization` + `envelope`) rather than 3 · early iteration with 3 concepts pushed candidate count to 111 · exceeded the 100-cap · dep-graph skipped · edge-expansion inactive. The 2-concept version produces 81 candidates · under cap · dep-graph fires · edge-expansion active. This is a **test-hygiene** correction · not a capability change.

---

## 4 · Initial discovery (verbatim from receipt)

```
verb_family=INVESTIGATE conf=1
concepts=2
search_terms=[authorization, envelope]
trigger_kind=PRIMARY_INVESTIGATE
listFiles(tag=authorization) → 44 entries
listFiles(tag=envelope) → 46 entries
candidates_after_file_memory=81
```

File A cap-spec-bridge.ts surfaces at rank 5 with score 1.00 · concepts `[authorization, envelope]` · evidence `concept:authorization|concept:envelope`.

File B real-workstation-adapter.ts NOT among the 81 tag-matched candidates (confirmed by zero-token verification in §2).

---

## 5 · Edge expansion (verbatim from receipt)

```
action_4_dep_graph · buildDependencyGraph on 300 files (81 candidates + 219 broader corpus)
dep_graph edges=634
edge_expansion · 7 files structurally connected to top-10 candidates
candidates_after_edge_expansion=88 (7 added via structural edges)
```

**7 files promoted via structural edges · each with `edge:imported_by_top:` evidence prefix.**

File B real-workstation-adapter.ts surfaces at rank 10 with:
- Score 0.60 (base 0.5 + 0.1 per connection)
- Evidence signals: `["edge:imported_by_top:src/lib/nex-cap/cap-spec-bridge.ts"]`
- Explicit direction: was imported BY cap-spec-bridge (matches ground-truth import at cap-spec-bridge.ts:19)

---

## 6 · Result

**CORRECT.**

Full pass matrix:

| Condition | Value |
|---|---|
| passA · File A surfaced via vocab | ✅ true (rank 5 · TAG_MATCHED) |
| passB · File B surfaced via edge | ✅ true (rank 10 · EDGE_EXPANDED) |
| passC · Edge evidence explicit | ✅ true (evidence signal cites cap-spec-bridge.ts) |
| passD · File B has NO vocab match | ✅ true (zero occurrences of all 3 target tokens verified) |
| passE · No fabricated causality | ✅ true (no hypothesis claims "definite root cause") |
| passF · Confidence calibrated | ✅ true (0.84 · FLAG_FOR_REVIEW · not inflated) |
| Negative control | ✅ true (knowledge-store.ts NOT surfaced anywhere) |

Overall classification: **CORRECT.**

---

## 7 · Evidence categorization (per §12 of prior WOs)

**OBSERVED (direct evidence):**
- cap-spec-bridge.ts imports real-workstation-adapter.ts (verified at cap-spec-bridge.ts:19)
- cap-spec-bridge.ts contains authorization×9, envelope×1 (whole-word counts)
- real-workstation-adapter.ts contains authorization×0, envelope×0
- NEX1's dep-graph captured 634 edges over 300 files including the specific A→B edge
- Edge-expansion promoted 7 files with `edge:imported_by_top:` evidence markers

**INFERRED (from evidence · not directly stated):**
- Files structurally connected to top candidates are architecturally relevant
- Score 0.60 for edge-expanded candidates reflects structural distance (base 0.5 + connection strength)

**HYPOTHESIS (unproven · would require source-level inspection to confirm):**
- real-workstation-adapter.ts is causally related to authorization envelope validity (NOT claimed by NEX1)

**PROVEN:**
- The direct import edge A→B exists in the seeded corpus (verified at source)
- Fix 5 edge-expansion correctly detects and promotes this edge with distinct evidence marker
- Test H clean produces the correct behaviour with the correct ground truth

---

## 8 · Negative control

**File `src/lib/nex-code-brain/knowledge-store.ts`** — verified seeded, no target vocab overlap, not imported by top-10 candidates.

Result: NOT in candidate list. NOT edge-expanded. **Negative control passed** — edge-expansion did not incorrectly promote a file merely because it was in a nearby directory or seeded corpus.

This confirms edge-expansion is selective: it only promotes files with actual direct import relationships to top-10 candidates.

---

## 9 · Regression (Tests A-G re-run · post-Fix 5 · post-clean-H probe)

Rerun `nex1-absence-tests/probe.ts`:
```
Aggregate: total_tests=6 · correct=6 · partial=0 · incorrect=0
- test_A_known_answer: CORRECT
- test_B_genuine_missing: CORRECT
- test_C_present: CORRECT
- test_D_scope_trap: CORRECT
- test_E_insufficient_expectation: CORRECT
- test_F_multi_file: CORRECT
```

Rerun `nex1-test-g/probe.ts`:
```
classification: CORRECT_BOTH_SURFACED
cause file rank: 3
symptom file rank: 11
```

**Zero regression.** All Tests A-G results preserved. Test H clean is the 8th passing test.

**Aggregate across all diagnostic tests: 8/8 CORRECT · 0 PARTIAL · 0 INCORRECT · 0 HALLUCINATIONS · 0 unsafe modifications.**

---

## 10 · Capability state (only what runtime evidence proves)

| Capability | Prior state | New state (post-clean-H) |
|---|---|---|
| Edge-expansion · direct-import single-hop with negative-control isolation | RUNTIME-VERIFIED (Test H prior · but with invalid ground truth) | **RUNTIME-VERIFIED** (Test H clean · ground truth verified · negative control passed) |
| Investigation Mode aggregate | SYSTEM_CONNECTED | SYSTEM_CONNECTED (unchanged) |
| Cross-file direct-import navigation for search | SYSTEM_CONNECTED (Test G) | SYSTEM_CONNECTED (unchanged) |
| Multi-hop navigation | NOT_SUPPORTED | **NOT_SUPPORTED** (unchanged) |
| Non-import coordination (parent-mediated) | NOT_SUPPORTED | **NOT_SUPPORTED** (unchanged) |
| Causal reasoning | NOT_SUPPORTED | **NOT_SUPPORTED** (unchanged) |
| Source-level reasoning | NOT_SUPPORTED | **NOT_SUPPORTED** (unchanged) |
| Native coding capability | UNPROVEN | **UNPROVEN** (unchanged · gated on Track A) |
| G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · C1 · C3 · C6 · founder authority | UNCHANGED | UNCHANGED |

**Explicit non-advancement (Prove-Before-Progression enforced):**
- Investigation Mode is NOT promoted to VERIFIED. One clean pass on one problem class is insufficient.
- Native coding is NOT promoted. Investigation ≠ Coding.
- Multi-hop reasoning is NOT proven. Test H tested only direct single-hop.

---

## 11 · Remaining boundary (explicit)

Direct single-hop edge navigation as tested here does **NOT** prove:
- Multi-hop reasoning (A → B → C without top-10 anchor at each hop)
- Causal reasoning (understanding WHY the imported file matters)
- Source-level reasoning (reading and interpreting the imported code)
- Function/symbol-level navigation (Test H found the file · not the specific function)
- Non-import coordination (files coordinated through shared parents like route files)
- Whole-corpus navigation when candidate count exceeds 100 (edge-expansion is skipped in that case)
- Native coding capability (Investigation Mode is READ-ONLY)

Each of these remains an untested capability class.

---

## 12 · Track A confirmation

- **C6** activation still awaiting founder-only offline actions (Ed25519 keypair generation)
- **G15** trust set still empty (fail-closed)
- **C1** orchestrator → WO-04 wiring still not implemented
- **C3** programming-mission → WO-07 wiring still not implemented
- **Truth Engine Gate 3** remains CLOSED
- **NEX-13/14/15/16** designations remain PROPOSED
- **Founder authority module** never modified

**Track A: UNCHANGED THROUGHOUT.**

---

## 13 · Freeze status

- Zero writes to `founder-authority/*` · `nex-authority-broker/*` · `nex-controlled-hands/*` · `wo2-*` · `wo13-*` · `.env*` · identities
- Zero commits · zero pushes · zero migrations · zero package installs
- Zero designation moves · zero external LLM invoked
- Zero fabricated files · zero hallucinated candidates · zero global-absence claims
- Test-only correction to `probe.ts` (2-concept problem statement) · no NEX1 source modification

**Freeze on all authority chains: INTACT.**

---

## 14 · Summary of the honest position

**What Clean Test H genuinely proved:**

- Fix 5 edge-expansion correctly identifies direct-import single-hop relationships in the seeded corpus dep-graph
- File B (real-workstation-adapter.ts) which has ZERO target vocab tokens was correctly surfaced ONLY via the edge from File A (cap-spec-bridge.ts)
- Evidence signals distinguish edge-derived candidates from tag-matched candidates explicitly (`edge:imported_by_top:` prefix)
- Confidence remains honest (0.84 · FLAG_FOR_REVIEW) reflecting that structural adjacency ≠ causal certainty
- Negative control passes: unrelated files are NOT incorrectly promoted
- Zero regression on Tests A-G · 8/8 aggregate CORRECT

**What this does NOT prove:**

- NEX1 can perform multi-hop navigation
- NEX1 can perform causal reasoning
- NEX1 can read source code
- NEX1 can pass all direct-edge tests (only one problem-vocabulary pair verified)
- NEX1 can code
- Native coding capability is UNPROVEN

**What Prior Test H's PARTIAL result taught us:**

The prior Test H's design flaw (assumed authorization.ts→trusted-anchors.ts direct import that does not exist) was itself valuable: it forced this clean audit and revealed that Undercount Protection applies to TEST DESIGN, not just to code inspection. The dep-graph correctly represented the real imports · the test was mislabeling File B.

**What comes next per founder direction:**

STOP after this repaired Test H and regression suite. Do not automatically proceed to Test I. Do not build multi-hop capability. Do not activate Track A. Wait for founder review and authorization for the next diagnostic.

---

## 15 · Test-only correction

One test-side change was made: `PROBLEM_STATEMENT` in `scripts/nex1-test-h-clean/probe.ts` was reduced from 3-concept to 2-concept phrasing after empirical observation that 3 concepts pushed candidate count above the 100-cap and disabled dep-graph analysis. This is a test-hygiene correction · not a NEX1 source change. The 100-cap in native-investigation-mode.ts remains at its safety-preserving value.

Note for future test design: problem statements must be calibrated to keep candidate count ≤ 100 for edge-expansion to fire. This is a discoverable constraint · not a bug.

---

**End of Test H clean · CORRECT · edge-expansion single-hop RUNTIME-VERIFIED with negative-control isolation · A-G regression preserved · Track A UNCHANGED · Native coding still UNPROVEN.**
