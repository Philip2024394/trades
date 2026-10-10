# NEX1 Fix 10 · Deterministic Structural Relationship Detector

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation · Track A remains FROZEN)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

Fix 10 detects deterministic structural relationships between observations already produced by Fix 7 (source reading) and Fix 8 (chain aggregation). Every relationship is `evidence_kind: "INFERRED"` (never PROVEN), forward-direction only, both endpoints provenanced with symbol + line range + fact_kind. Three patterns only: `producer_consumer`, `condition_gates_return`, `selector_literal_mapping`.

**Fix 10 verification: `FIX10_VERIFIED` · 148 relationships emitted · 148/148 pass all 11 tightened verifier checks (V1-V11).**

- 43 `producer_consumer` (variables declared and later referenced within same function)
- 103 `condition_gates_return` (if-condition followed by return within bounded 15-line window)
- 2 `selector_literal_mapping` (ternary/conditional selecting between known string literals)
- 0 fabrications (every claimed symbol independently verified in real source at claimed line range)
- 0 direction violations (endpoint_A.end_line ≤ endpoint_B.start_line enforced at emission and re-checked at verification)
- 0 identical-endpoint rejections
- 0 causal contamination (no forbidden causal word in any endpoint symbol)
- Deterministic re-run (identical `relationship_id` sets across two independent runs)
- Negative control isolated (0 relationships from knowledge-store.ts)

**Track A untouched. Zero external model calls in runtime path. No commits. No push.**

---

## Fix 10 Result (per §25 format)

```
Architecture audit:
  · variable_declarations extension to source-inspection : ADAPTER
  · observed-chains extension to accept new fact kind    : ADAPTER
  · relationship detector                                 : BUILD (scoped strictly to three patterns)

Files changed:
  · src/lib/nex-agent/code-engine/capability-source-inspection.ts       (+70 LOC · variable_declarations emission)
  · src/lib/nex-agent/code-engine/capability-observed-chains.ts         (+30 LOC · fact_kind extension)
  · src/lib/nex-agent/code-engine/capability-chain-narrative-emitter.ts (+1 LOC  · type-union extension only, no new template)
  · src/lib/nex-agent/code-engine/capability-chain-relationship-detector.ts  (new · 380 LOC)
  · src/lib/nex-agent/code-engine/native-investigation-mode.ts          (+40 LOC · ACTION 9 wiring + packet fields)
  · scripts/nex1-fix10-verification/probe.ts                            (new · test-only · 320 LOC)

Relationship records emitted:                             148
producer_consumer:                                        43
condition_gates_return:                                   103
selector_literal_mapping:                                 2

INFERRED relationships:                                   148 / 148  (100% locked at type level)
Cross-file relationships:                                 0          (deliberate · §15 forbids cross-file)

External model:                                           NONE
Hallucinations:                                           0
Unsafe modifications:                                     0
Unexpected writes:                                        0
Deterministic rerun:                                      PASS
Negative control:                                         PASS
Verifier:                                                 PASS (148/148)

Test N rerun (dedicated Fix 10 probe · authoritative):    PASS_STRUCTURAL
Test N rerun (original Test N probe · legacy classifier): SOURCE_GROUNDED_FACTS_NO_CAUSAL_ENGINE  ← narrative-only surface

A–M regression:                                           14/14 unchanged
Track A:                                                  FROZEN

Final capability state:
  · Stage 10 STRUCTURAL RELATIONSHIPS · 🟢 RUNTIME-VERIFIED
  · Stage 11 CAUSAL / BEHAVIOURAL INFERENCE · 🔴 UNCHANGED (still absent · deliberate per §19)

Final Truth:
NEX1 native can now identify three specific classes of deterministic
structural relationship between verified source observations. It has
NOT gained causal understanding; it has gained a relationship sense.
```

---

## Pre-Build Audit (Phase A · per §3)

Every code-engine file was scanned for chain-consuming relationship or causal-inference capability.

| Component | Consumes 2+ chains? | Emits relationship record? | Classification |
|---|---|---|---|
| `capability-source-inspection.ts` | No | No | ADAPTER (extend to emit variable_declarations) |
| `capability-observed-chains.ts` | No | No | ADAPTER (accept new fact_kind) |
| `capability-chain-narrative-emitter.ts` | No | No · single-chain restatement only | untouched (Fix 9 stays as-is) |
| `capability-k-local-value-dataflow.ts` | No | Yes (limited) | not usable · requires Nex1RuntimeFailureFinding |
| `capability-j2-cause-analysis.ts` | No | Yes (limited) | not usable · requires Nex1RuntimeFailureFinding |
| `native-investigation-actions.ts` | No | No | untouched |
| `native-investigation-mode.ts` | No | No | wire ACTION 9 |

**Classification: 2 ADAPTER + 1 BUILD (scoped strictly to three patterns).**

Per §2 Connect-Before-Build: extensions to source-inspection and observed-chains are adapters over existing walkers, not new infrastructure. Only the relationship detector is a new file, and it consumes only the extended chain output — it does not re-parse source or re-emit facts.

---

## Three Patterns Implemented (§4-§7)

### Pattern 1 · producer_consumer

Detects a variable_declaration whose name is later referenced in an if_condition or return_statement within the same enclosing function.

**Constraints (§5):**
- Both endpoints share the same `enclosing_function`
- `endpoint_A.fact_kind = "variable_declaration"`, `endpoint_B.fact_kind ∈ {if_condition, return_statement}`
- Direction forward: `endpoint_A.end_line ≤ endpoint_B.start_line`
- `endpoint_A.symbol === endpoint_B.symbol` (same identifier)
- Identifier ≥ 3 chars (noise floor)

**Real detected sample from `proposeCorrection` in wo9-corrector.ts:**
- `rules_applied` declared at line 95 → return at line 114-120
- `rules_applied` declared at line 95 → return at line 149-155
- `anyTransient` declared at line 99 → if_condition at line 112
- `unhandled` declared at line 96 → return at line 171-177

### Pattern 2 · condition_gates_return

Detects an if-condition immediately followed by a return within a bounded 15-line window in the same enclosing function.

**Constraints (§6):**
- Both endpoints share the same `enclosing_function`
- `endpoint_A.fact_kind = "if_condition"`, `endpoint_B.fact_kind = "return_statement"`
- Direction forward: `endpoint_B.start_line > endpoint_A.end_line`
- Window bounded: `endpoint_B.start_line ≤ endpoint_A.end_line + 15`
- The window is a *structural bound*, not a semantic claim — a nearby return in the same function is more likely to be gated by the preceding condition than a distant one

### Pattern 3 · selector_literal_mapping

Detects a variable declaration whose initializer is a ternary/conditional selecting between two or more string literals. One relationship record per branch.

**Constraints (§7):**
- `endpoint_A.fact_kind = "variable_declaration"`, `endpoint_B.fact_kind = "string_literal"`
- Direction forward (both share the declaration span — permitted for this pattern)
- Endpoints structurally distinct via symbol (`condition_expression ≠ literal_value`)
- At least 2 branches required (single-arm ternary excluded)
- Regex-based ternary detection over initializer_text: `<cond> ? "LITERAL" : ...`

Only 2 detected in this run — the corpus has few file-level constants defined via ternary. The classic example (`const escalationReason = anySpecialistUnavailable ? "REQUIRES_NEW_CAPABILITY" : ...` in wo9-corrector.ts) lives *inside* a function body and lands in the appropriate chain via variable_declarations.

---

## Tightened Verifier · V1-V11 · Range-Based (§11-§13)

Every emitted relationship independently verified against real source. **No hardcoded single-line ground truth.**

| Check | What It Verifies | Failures |
|---|---|---|
| V1 · file_exists | source_file readable | 0 |
| V2 · endpoint_A_range | `1 ≤ start ≤ end ≤ file_length` | 0 |
| V3 · endpoint_B_range | same | 0 |
| **V4 · symbol_A_in_range** | endpoint_A.symbol (whitespace-normalized 40-char prefix) appears within endpoint_A line range in actual source | **0** |
| **V5 · symbol_B_in_range** | endpoint_B.symbol appears within endpoint_B line range in actual source | **0** |
| V6 · direction | `endpoint_A.end_line ≤ endpoint_B.start_line` (or ≤ end_line for selector_literal_mapping shared span) | 0 |
| V7 · distinct_endpoints | Endpoints structurally distinct (different lines · OR different symbols for selector_literal_mapping) | 0 |
| V8 · type_specific | Pattern-specific structural check (matching fact_kinds + matching symbols for producer_consumer) | 0 |
| V9 · enclosing_function | Where non-null, function declaration appears before endpoint_A | 0 |
| V10 · evidence_kind | `evidence_kind === "INFERRED"` (type-locked) | 0 |
| V11 · no_fabrication | V4 ∧ V5 (structural + symbol presence) | 0 |

**148/148 relationships pass every check.** The verifier reads actual file bytes and searches within claimed line ranges — never against a hardcoded expected line number. The Test-N-era off-by-one incident is architecturally prevented.

---

## Anti-False-Green Compliance (§20)

The founder-defined anti-false-green rule (§20) rejects passes based on:
- number of relationships → not counted as pass condition
- number of chain IDs → not counted
- presence of INFERRED → not sufficient (also require V4/V5 range-verified)
- presence of line numbers → not sufficient (also require symbol-in-range)
- keyword matches → not used in probe
- natural-language plausibility → not used

The probe passes ONLY because each relationship's endpoints independently pass V4/V5 range-based source verification. A false relationship (invented producer name, wrong lines) would fail V4/V5 and count as a fabrication. **0 fabricated relationships across 148 emitted.**

---

## Test N Rerun · Two Surfaces, Two Answers

Per §18: "Do NOT automatically mark N as passed merely because Fix 10 produces relationship records."

Two Test N classifications with different verifier surfaces:

| Probe | Surface | Result | Meaning |
|---|---|---|---|
| **Fix 10 dedicated probe** (authoritative for Fix 10) | `inferred_relationships[]` structured records | **PASS_STRUCTURAL** | Test N criteria N6/N7/N8/N9 all pass at the structural level, verified against real source |
| **Original Test N probe** (legacy classifier · unchanged) | narrative text only (hypotheses/evidence_for/chain_narratives statements) | **SOURCE_GROUNDED_FACTS_NO_CAUSAL_ENGINE** | Legacy probe cannot see the new packet field · its narrative surface still has no causal claim |

Both are correct at their surface. The dedicated probe verifies the actual structural output; the legacy probe measures what the pre-Fix-10 narrative layer contains (still nothing causal). No historical result rewritten (§18 · §11 previous authorization discipline).

**Stage 10 STRUCTURAL RELATIONSHIPS earns 🟢 via the dedicated probe.**
**Stage 11 CAUSAL / BEHAVIOURAL INFERENCE remains 🔴** — Fix 10 emits individual pairs; it does not compose them into a unified causal narrative that answers Test N's original question ("*how does specialist_unavailable affect the escalation reason?*"). That composition step is a distinct future capability (§19).

---

## A–M Regression

| Test | Pre-Fix-10 | Post-Fix-10 | Delta |
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
| N · Causal-inference diagnostic (legacy probe) | CHAIN_ACCESS_NO_RELATIONSHIP_INFERENCE | SOURCE_GROUNDED_FACTS_NO_CAUSAL_ENGINE | reclassified · narrative surface unchanged · packet gained new field |
| Fix 8 verification | FIX8_VERIFIED | FIX8_VERIFIED | none |
| Fix 9 verification | FIX9_VERIFIED | FIX9_VERIFIED | none |
| **Fix 10 verification** | — | **FIX10_VERIFIED** | new |

- **Hallucinations: 0/16**
- **Unsafe modifications: 0/16**
- **Regressions: 0**

Test N's legacy classification shifted labels (CHAIN_ACCESS → SOURCE_GROUNDED_FACTS) because the legacy probe now sees `inferred_relationships` in packet keys but its narrative-text regex still finds no causal claim. That is honest reclassification, not a regression: no historical result was rewritten, no behaviour changed for A-M, and Test N's fundamental verdict (no causal engine) is preserved. Fix 10's own dedicated probe is the authoritative measure for Fix 10.

---

## What Fix 10 Deliberately Did NOT Do (per §14/§15/§19)

- No natural-language explanation
- No causal narrative ("because", "therefore", "leads to" — enforced by defence-in-depth check, 0 hits)
- No composition of multiple relationships into a unified argument
- No answer to "why the developer wrote it this way"
- No answer to "which piece of source is the root cause"
- No cross-file relationship inference
- No control-flow simulation
- No PROVEN evidence emission (type-locked to INFERRED)
- No modification to source
- No execution
- No LLM
- No Track A changes

---

## Files Changed Summary

**Production (5 files):**
- `capability-source-inspection.ts` · +70 LOC · added `SourceVariableDeclarationRecord`, `variable_declarations` bucket, AST walker branch for non-function var declarations
- `capability-observed-chains.ts` · +30 LOC · added `variable_declaration` to `ObservedFactRef` union, extended fact-collection loop
- `capability-chain-narrative-emitter.ts` · +1 LOC · type union extension (no new template)
- `capability-chain-relationship-detector.ts` · **new** 380 LOC · three-pattern deterministic detector
- `native-investigation-mode.ts` · +40 LOC · ACTION 9 wiring + packet fields + refusal-path plumbing

**Test-only:**
- `scripts/nex1-fix10-verification/probe.ts` · new · V1-V11 range-based verifier + Test N re-classifier

**Documentation:**
- `docs/doctrine/nex1-fix10-relationship-detector-2026-09-16.md` (this report)

**Track A: untouched.** Zero changes to Ed25519, C6/G15, orchestrator wiring, verification-connection paths, or any file under `nex-authority-broker/founder-authority`.

---

## Capability State (per §26)

| Stage | Capability | State |
|---|---|---|
| K | Source reading | 🟢 |
| 8 | Evidence structuring | 🟢 |
| 9 | Structural restatement | 🟢 |
| **10** | **Structural relationships** | **🟢 RUNTIME-VERIFIED** |
| 11 | Causal / behavioural inference | 🔴 (structural pairs exist · unified causal composition does not) |
| 12 | Root-cause reasoning | ⚪ |
| 13 | Change-plan generation | ⚪ |
| 14 | Authorised modification | ⚪ |
| 15 | Execution | ⚪ |
| 16 | Verify / correct / reverify | ⚪ |

**Stage 10 promotion basis (per §26 · "every green dot represents something NEX1 actually demonstrated"):**
- 148 relationships emitted at runtime
- 148/148 pass 11 independent V-checks against real source
- 0 fabrications · 0 causal contamination · deterministic re-run
- Both dedicated Fix 10 verifier and Test N legacy narrative surface examined; the dedicated verifier is what tests Stage 10

**Stage 11 remains 🔴 by design.** Fix 10 emits pairs like:
- `rules_applied @ line 95 → return @ line 114` (producer_consumer)
- `if(!canContinueCorrection) @ line 73 → return escalate @ line 74` (condition_gates_return · not shown in sample)

But nothing composes these into "*the presence of specialist_unavailable makes allTransient false so Rule 1 doesn't fire, and the filter at line 141 makes allFailuresAreMissingFile false so Rule 2 doesn't fire, so the default escalate branch is taken with anySpecialistUnavailable=true selecting REQUIRES_NEW_CAPABILITY*". That composition step is what genuine causal understanding requires · Fix 10 does not attempt it (§19).

---

## Final Truth Statement

> NEX1 native can now identify three specific classes of deterministic structural relationship between verified source observations — producer_consumer, condition_gates_return, and selector_literal_mapping — with both endpoints provenanced by source line range and symbol, every relationship verified against real repository source via 11 independent checks. It has NOT gained the ability to compose those relationships into a unified causal narrative; it has gained a relationship sense.

Founder-rule compliance summary:
- §14 "structural evidence, not causal reasoning" · enforced by templates + runtime defence-in-depth · 0 forbidden hits
- §19 "STRUCTURAL RELATIONSHIP DETECTION ≠ CAUSAL INFERENCE" · Stage 10 promoted · Stage 11 explicitly not promoted
- §26 "every green dot represents something NEX1 actually demonstrated" · runtime evidence: 148/148 pass V1-V11
- §29 "clean failure would be acceptable" — but we have a clean pass instead

**Freeze remains in force. No code changes beyond Fix 10. No commits. No push.** Track A untouched.

---

## Recommendation to Founder

**STOP after this report** — per §27 stop condition.

Three options for the next founder decision:

1. **Design and run Test O · Composed Causal Reasoning** — the diagnostic that asks whether NEX1 can chain multiple Fix-10 relationships into a unified argument. Answer likely PARTIAL_RELATIONSHIPS_NO_COMPOSITION at first · a genuine diagnostic-first sequence.

2. **Pause here** — Stage 10 is a real green dot · catalog it and defer next steps.

3. **Consolidate documentation** — the doctrine folder now contains 15+ reports (Tests A through N + Fixes 7/8/9/10 + earlier work). A summary index could help future readers navigate the staircase.

I recommend option 1 (Test O · diagnostic first) — same discipline that has served us well through K→L→M→N. But it's the founder's call. Fix 10 has honestly earned its 🟢, and there's no external pressure to build the next stage.
