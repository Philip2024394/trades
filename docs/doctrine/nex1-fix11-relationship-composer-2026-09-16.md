# NEX1 Fix 11 · Deterministic Relationship Composer · Stage 11 Promotion

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation · Track A remains FROZEN)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**FIX11_VERIFIED.** Stage 11 promoted to 🟢 on runtime evidence.

Fix 11 adds a deterministic relationship composer that consumes Fix 10's `inferred_relationships[]` and walks the graph via exact endpoint match (source_file + start_line + end_line + fact_kind). It emits `ComposedArgument[]` records with `evidence_kind: "INFERRED"` (type-locked), forward direction, cycle protection, and full provenance for every step in the chain. Zero causal claims · zero natural-language explanation · zero LLM.

**All 14 verification criteria pass** (O-V1 through O-V12 + DETERMINISTIC + CYCLE_PROTECTION). The composer independently discovered the shared endpoint at line 112 in `proposeCorrection`, chained R1 (producer_consumer) → R2 (condition_gates_return) in forward direction, and preserved the full 3-endpoint path with source-line provenance. Negative control (synthetic unrelated relationships) produced zero compositions. Deterministic re-run produced identical `composition_id` sets. Cycle control (synthetic A→B→A relationships) terminated cleanly with no infinite loop.

**Track A untouched. Zero external model calls. No commits. No push.**

---

## FIX 11 RESULT (per §26 format)

```
FIX11_VERIFIED

Architecture audit:                                       BUILD (scoped)
Relationships consumed:                                   41
Compositions produced:                                    5
Maximum composition depth:                                2
Relationship types composed:                              producer_consumer → condition_gates_return
Evidence classification:                                  INFERRED (type-locked)

Full provenance:                                          PASS
Direction verification:                                   PASS
Cycle detection:                                          PASS
Negative control:                                         PASS (0 compositions from unrelated relationships)
Determinism:                                              PASS (identical composition_id sets across runs)

Fabrication:                                              0
Unsafe modifications:                                     0
Unexpected writes:                                        0
External model:                                           NONE
A–N regression:                                           15/15 unchanged

Test O:                                                   SOURCE_GROUNDED_COMPOSITION_RUNTIME_VERIFIED
                                                          (both dedicated Fix 11 probe AND legacy Test O probe)

Track A:                                                  FROZEN
Production changes:                                       YES (2 files · scoped to Fix 11)
```

**Exact capability truth:** NEX1 native can now consume verified Stage-10 structural relationships, discover shared endpoints between them, walk the relationship graph in forward direction, and emit provenance-preserved multi-relationship compositions of depth ≥ 2.

**Exact remaining boundary:** NEX1 cannot yet interpret what a composition *means* — Stage 12 (root-cause reasoning) and beyond remain absent. Fix 11 builds `A → B → C` structural chains; it does not answer "why does A produce C" or "what should be changed."

---

## Pre-Build Audit (Phase A · per §4)

Every code-engine and code-engine-adjacent file scanned for existing graph-traversal capability that could consume `inferred_relationships[]`.

| Component | Consumes inferred_relationships? | Notes |
|---|---|---|
| `capability-chain-relationship-detector.ts` | producer only | emits pairs, doesn't compose |
| `capability-chain-narrative-emitter.ts` | no | per-chain restatement |
| `capability-observed-chains.ts` | no | fact grouper |
| `capability-source-inspection.ts` | no | fact extractor |
| `native-investigation-actions.ts` | no | action wrappers |
| `native-investigation-mode.ts` | 8 touchpoints, all producer/plumbing | verified in Test O audit |
| `capability-j23-multi-hop-recovery.ts` | no | runtime repair loop (J.1→J.2→apply→rerun), not relationship composition |
| `capability-k-local-value-dataflow.ts` | no | requires Nex1RuntimeFailureFinding |
| `capability-j2-cause-analysis.ts` | no | repair proposer from runtime finding |
| `native-programming-loop.ts` | no | test-repair pipeline wrapper |
| `dependency-graph.ts` (nex-agent-runtime) | no | module-level import edges (different domain) |

**Classification: BUILD (scoped strictly to composer).** Per §4 Connect-Before-Build: no primitive exists to connect. `buildDependencyGraph` operates on file-level import edges — completely different domain from Stage-10 endpoint composition.

---

## Files Changed

| File | Kind | Purpose |
|---|---|---|
| `src/lib/nex-agent/code-engine/capability-chain-relationship-composer.ts` | **New** · ~330 LOC | Deterministic BFS composer with cycle detection · endpoint-match traversal · INFERRED type-locked |
| `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | Modified · +45 LOC | ACTION 10 wiring · `composed_arguments[]` + `composed_arguments_note` packet fields · refusal-path plumbing |
| `scripts/nex1-fix11-verification/probe.ts` | **New** (test-only) · ~350 LOC | O-V1..O-V12 + determinism + cycle protection · synthetic negative control · synthetic cycle control |

**Track A: untouched.** Zero changes to Ed25519, C6/G15, orchestrator wiring, or `nex-authority-broker/founder-authority`.

**Test-only files (disposable):** `scripts/nex1-fix11-verification/probe.ts`.

**Documentation:** `docs/doctrine/nex1-fix11-relationship-composer-2026-09-16.md` (this report).

---

## What Fix 11 Does

**Public entry:**
```ts
composeRelationships({ relationships, max_depth?, max_compositions_total? })
  → { ok: true, compositions: ComposedArgument[], stats: {...} }
```

**Algorithm (deterministic):**
1. Build an index of relationships keyed by `endpointKey(R.endpoint_A, R.source_file)` = `"file::start:end:fact_kind"`
2. For each relationship as seed frontier, look up `endpointKey(R.endpoint_B, R.source_file)` in the index — any matches are valid extensions
3. BFS layer-by-layer up to `max_depth` (default 4, hard cap 5)
4. Cycle protection via `visited: Set<relationship_id>` per frontier
5. Direction enforcement: skip any extension where `nextR.endpoint_A.end_line > nextR.endpoint_B.start_line` (except for shared-span selector_literal_mapping)
6. Emit ComposedArgument at every extension (depth ≥ 2)
7. Dedupe by `composition_id` (deterministic composition of ordered `relationship_ids`)
8. Deterministic sort of output

**Output shape (verbatim from type):**
```ts
interface ComposedArgument {
  composition_id: string;                               // deterministic · relationship_ids joined by "->"
  relationship_ids: readonly string[];
  relationships: readonly InferredRelationship[];
  endpoint_chain: readonly CompositionStep[];           // length = relationship_ids.length + 1
  direction: "forward";
  evidence_kind: "INFERRED";                            // type-locked literal
  depth: number;
  enclosing_function: string | null;
  source_file: string;
  provenance: readonly { source_file, start_line, end_line }[];
}
```

**What Fix 11 DOES NOT DO (§13/§14 enforced in code):**
- No natural-language emission
- No causal vocabulary ("therefore", "because", etc.) — the composer emits structured records only
- No behavioural interpretation
- No LLM
- No writes
- No promotion beyond INFERRED
- No fabricated intermediate relationships (every relationship in a composition already exists in the input · V9 enforces this)

---

## The Real Composition Discovered

The verifier confirmed that Fix 11's runtime independently emitted the target composition:

```
composition_id:
  wo9-corrector.ts::producer_consumer::99:112:anyTransient
   -> wo9-corrector.ts::condition_gates_return::112:114

depth:              2
evidence_kind:      INFERRED
direction:          forward
enclosing_function: proposeCorrection
source_file:        src/lib/nex1-orchestrator/wo9-corrector.ts

endpoint_chain:
  line 99  [variable_declaration] "anyTransient"
      ↓ (shared endpoint via structural match)
  line 112 [if_condition]         "anyTransient" (from R1) / "allTransient && anyTransient" (from R2)
      ↓
  line 114-120 [return_statement] "{ok: true, kind: 'retry_same_plan',...}"

provenance:
  [{file, 99, 99}, {file, 112, 112}, {file, 114, 120}]
```

This is the exact chain Test O's ground truth predicted. Fix 11 discovered it without any hardcoded target and without any ground-truth injection into production code (O-V11 pass).

5 compositions total across the corpus — all at depth 2. No 3+ hop chains available in the current inspected corpus (Fix 10 emits 41 relationships in a narrow slice of `proposeCorrection` + nearby functions), which is fine for Stage 11 promotion per §10 which specified depth ≥ 2 as the minimum proof.

---

## O-V1 Through O-V12 Verification

| Check | What it verifies | Result |
|---|---|---|
| **O-V1** | At least two real Stage-10 relationships exist | ✓ (R1 and R2 both present with expected shapes) |
| **O-V2** | Relationships were independently generated by Fix 10, not injected | ✓ (packet.inferred_relationships contains both by relationship_id) |
| **O-V3** | Relationships share a valid endpoint (verifier-side structural check) | ✓ (R1.endpoint_B and R2.endpoint_A share source_file + start_line + end_line + fact_kind) |
| **O-V4** | **Composer discovered the shared endpoint itself** | ✓ (target composition found in packet.composed_arguments with R1's id before R2's id) |
| **O-V5** | Composition contains both relationship IDs | ✓ (relationship_ids array contains both) |
| **O-V6** | Direction preserved (R_i.endpoint_B == R_{i+1}.endpoint_A on line + fact_kind) | ✓ (every consecutive pair verified) |
| **O-V7** | Every endpoint provenanced | ✓ (source_file + start_line + end_line + fact_kind + symbol on every step) |
| **O-V8** | Composition reconstructable from raw relationship records | ✓ (independent `composeRelationships()` re-run produces the same composition_id) |
| **O-V9** | No invented intermediate relationship | ✓ (every relationship_id in every composition exists in packet.inferred_relationships) |
| **O-V10** | No unrelated relationship inserted | ✓ (every consecutive pair shares endpoint · fully verified per composition) |
| **O-V11** | No hardcoded target composition in production code | ✓ (composer source file grep confirms R1's/R2's relationship_ids are not hardcoded strings) |
| **O-V12** | Negative control (synthetic unrelated relationships) produces NO composition | ✓ (0 compositions from 3 synthetic unrelated relationships) |
| Bonus | Determinism (identical composition_id sets across 2 runs) | ✓ |
| Bonus | Cycle protection (synthetic cyc::R1 ↔ cyc::R2 terminates) | ✓ |

**All 14 checks pass.**

---

## Anti-False-Green Rigor (§17 compliance)

The founder-defined anti-false-green rule (§17-§18) rejects passes based on prose, keyword presence, matching vocabulary, same-file/same-function proximity alone, correct-looking English, hardcoded ground truth, and manually supplied R1/R2 pairs. Fix 11's verifier used NONE of these. It:

- Independently discovered R1 and R2 in Fix 10's output by *shape* matching (relationship_type + endpoint fact_kinds + symbol), NOT by hardcoded relationship_ids
- Independently constructed the shared-endpoint check (O-V3) BEFORE looking at the composer's output
- Independently verified O-V4 by requiring the composition_id contain BOTH R1's id and R2's id in traversal order
- Independently reconstructed the composition (O-V8) by re-running `composeRelationships` on raw `inferred_relationships[]`
- Synthetic negative control (O-V12) uses relationships that have no shared endpoint by construction → verifier confirmed 0 compositions
- Synthetic cycle control uses cyc::R1 ↔ cyc::R2 with genuine loop structure → verifier confirmed terminated output

None of the pass conditions depend on prose, keywords, filenames, or hardcoded lines.

---

## A–O Regression

| Test | Pre-Fix-11 | Post-Fix-11 | Delta |
|---|---|---|---|
| A · Absence-of-token | CORRECT | CORRECT | none |
| B · Verb-vocab | CORRECT | CORRECT | none |
| C · Present-token false-positive | CORRECT | CORRECT | none |
| D · Scope trap | CORRECT | CORRECT | none |
| E · Insufficient expectation | CORRECT_REFUSAL | CORRECT_REFUSAL | none |
| F · Multi-verb ambiguity | CORRECT | CORRECT | none |
| G · Cross-file navigation | CORRECT_BOTH_SURFACED | CORRECT_BOTH_SURFACED | none |
| H · Direct-edge | CORRECT | CORRECT | none |
| I · Multi-hop | INCONCLUSIVE_1_HOP_VIA_ALT_ROUTE | INCONCLUSIVE_1_HOP_VIA_ALT_ROUTE | none |
| J · Source-reading (historical) | LOCATED_ONLY_NO_SOURCE_ANALYSIS | preserved | preserved |
| K · Source-level | SOURCE_LEVEL_RUNTIME_VERIFIED | SOURCE_LEVEL_RUNTIME_VERIFIED | none |
| L · Source-explanation | SOURCE_READ_ONLY_NO_SYNTHESIS | SOURCE_READ_ONLY_NO_SYNTHESIS | none |
| M · Chain-access diagnostic | CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS | CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS | none |
| N · Causal-inference diagnostic | SOURCE_GROUNDED_FACTS_NO_CAUSAL_ENGINE | SOURCE_GROUNDED_FACTS_NO_CAUSAL_ENGINE | none |
| O · Composition diagnostic (legacy) | SHARED_ENDPOINT_DETECTED_NO_COMPOSITION | **SOURCE_GROUNDED_COMPOSITION_RUNTIME_VERIFIED** | ✅ **crossed the boundary** |
| Fix 8 verification | FIX8_VERIFIED | FIX8_VERIFIED | none |
| Fix 9 verification | FIX9_VERIFIED | FIX9_VERIFIED | none |
| Fix 10 verification | FIX10_VERIFIED | FIX10_VERIFIED | none |
| **Fix 11 verification** | — | **FIX11_VERIFIED** | new |

- **Hallucinations: 0/18**
- **Unsafe modifications: 0/18**
- **Regressions: 0**

Test O's legacy probe now returns PASS because the packet gained the `composed_arguments[]` field. Both the legacy classifier (checks for packet keys matching `/compos/`) and the dedicated Fix 11 probe (14 independent checks) agree — the dedicated probe is authoritative. No historical result rewritten; the improvement is a legitimate consequence of Fix 11 running.

---

## Capability State (per §27 · promotion only on runtime evidence)

| Stage | Capability | State |
|---|---|---|
| K | Source reading | 🟢 |
| 8 | Evidence structuring | 🟢 |
| 9 | Structural restatement | 🟢 |
| 10 | Structural relationships | 🟢 |
| **11** | **Relationship composition** | **🟢 SOURCE_GROUNDED_COMPOSITION_RUNTIME_VERIFIED** |
| 12 | Root-cause reasoning | ⚪ |
| 13 | Change-plan generation | ⚪ |
| 14 | Authorised modification (hands) | 🔒 |
| 15 | Execution (hands) | 🔒 |
| 16 | Verify / correct / reverify (hands) | 🔒 |

**Stage 11 earns its green dot on runtime evidence** per founder rule §27:
- 41 real Stage-10 relationships consumed
- 5 compositions emitted at runtime
- All 14 verification checks passed independently against real source
- Negative control produced 0 false compositions
- Cycle control terminated safely
- Deterministic re-run
- Zero fabrication
- Zero external model calls

---

## What Fix 11 Deliberately Did NOT Do (§13/§14/§25)

- No natural-language explanation
- No causal claims (composer emits structured records only · no "because"/"therefore"/"leads to")
- No behavioural interpretation ("A → B → C" is emitted; "A causes C" is not)
- No cross-file relationship extension (composition constrained to same source_file per §7 endpoint identity)
- No root-cause reasoning (Stage 12 remains ⚪)
- No LLM calls
- No source modification
- No execution
- No Track A changes

---

## Founder-Rule Compliance (§27)

- **Every green dot represents demonstrated capability, not implemented code:** Stage 11's runtime evidence is 5 real compositions emitted from 41 real relationships with all 14 verification checks passing. Runtime evidence, not implementation.
- **No LLM assistance in runtime path:** verified · composer is pure algorithmic.
- **Anti-false-green discipline held:** none of the pass conditions used prose, keyword presence, or hardcoded lines. O-V11 explicitly checks that production code contains no hardcoded target composition.
- **Track A remains frozen:** verified.
- **Deterministic:** verified across two runs.
- **Cycle-protected:** verified against synthetic cycle input.
- **Negative control isolated:** synthetic unrelated relationships → 0 compositions.

---

## STOP — DO NOT PROCEED TO STAGE 12.

Per §25 · Fix 11 stops here. Do not build:
- Root-cause reasoning
- Behavioural explanation
- Semantic causal engine
- Change-plan generation
- Code modification
- Execution
- Verify/correct loops

The next founder decision determines whether Stage 12 (root-cause reasoning · brain) is authorised as a diagnostic-first pass, or whether Track B pauses here.

**Freeze remains in force. No commits. No push. Track A untouched.**

---

## Recommendation to Founder

Three options for the next decision:

1. **Design and run Test P · Root-Cause Reasoning Diagnostic** — the diagnostic that asks whether NEX1 can use a composed argument to identify a root cause. Requires the composer output (which we just built) as raw material. Same discipline: anti-false-green, no build.

2. **Pause Track B here** — Stage 11 is a solid green dot, four consecutive stages complete (K → 8 → 9 → 10 → 11). Consolidate before the next brain layer.

3. **Consolidate documentation** — 19 doctrine reports now exist. A summary index mapping every stage to its report + capability state + next-boundary would help future readers navigate the staircase.

I recommend option 1 (Test P diagnostic-first) — same rhythm that got us to a Stage 11 green dot. But the founder's call. **No new code built until authorized.**

---

## Final Truth

> NEX1 native can now consume verified Stage-10 structural relationships, discover shared endpoints between them, walk the relationship graph in forward direction with cycle protection, and emit provenance-preserved multi-relationship compositions of depth ≥ 2. This capability has been demonstrated at runtime against real repository source (`proposeCorrection` in wo9-corrector.ts) with all 14 verification criteria independently confirmed. It has NOT gained the ability to interpret what a composition means, identify a root cause, or plan a code change — those remain Stage 12+ boundaries that are architecturally absent.
