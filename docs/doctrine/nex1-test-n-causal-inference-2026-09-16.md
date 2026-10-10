# NEX1 Test N · Native Structural Causal Inference · Diagnostic First Run

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Reasoning path tested:** `NEX1_NATIVE` (per §20)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**Classification: `CHAIN_ACCESS_NO_RELATIONSHIP_INFERENCE`.**

Fix 8 built the evidence chains. Fix 9 built the structural-restatement bridge. Test N asked whether NEX1 can now **infer a real causal relationship** between two independently-produced chains — producer → consumer, condition-gates-return, and behavioural consequence. Runtime answer: **no.** Zero packet fields for inference-related structures. Zero narratives that link two chain_ids. Zero direction indicators. Zero behavioural-consequence connectors. Zero fabrication. Confidence honestly 0.84. Track A untouched. Zero code changes for this diagnostic.

This is a **valid diagnostic** per founder §29: "A clean failure is a successful diagnostic. A false green is unacceptable." The runtime demonstrates exactly the boundary anticipated.

- Hallucinations: 0
- Unsafe modifications: 0
- Unexpected writes: 0
- External model calls in runtime path: 0
- A–M regression: 13/13 (Fix 9 verification included) unchanged
- Production changes: NO (diagnostic-only)
- Track A: FROZEN

---

## Pre-Build Audit (Phase A · per §4)

Every code-engine file was scanned for chain-consuming relationship or causal-inference capability.

| Component | Consumes 2+ chains? | Emits relationship record? | Notes |
|---|---|---|---|
| `capability-source-inspection.ts` | No | No | producer of facts |
| `capability-observed-chains.ts` | No | No | groups facts, no relationships |
| `capability-chain-narrative-emitter.ts` | No | No | Fix 9 · single-chain restatements only · founder §14 forbids causal claims |
| `capability-k-local-value-dataflow.ts` | No | No | requires `Nex1RuntimeFailureFinding`; not chain-driven |
| `capability-j2-cause-analysis.ts` | No | Yes (limited) | proposes repairs from runtime finding; not chain-native |
| `capability-i-test-synthesis.ts` | No | No | test-case generator |
| `native-investigation-mode.ts` | No | No | orchestrator only |
| `consequence-reasoner.ts` | No | Limited | tsc error → AST directive; not chain-native |

Grep receipts:
```
grep observed_chains chain_narratives                              → only in producer/plumbing lines
grep -E "relationship|causal|gated_by|inferred_relationship"       → present only in Fix 8/9 comments FORBIDDING causal claims
grep -E "producer|consumer|controls|dataflow" in code-engine       → capability-k only, not chain-driven
```

**Classification: gap is BUILD.** No existing capability consumes 2+ chains to infer relationships. Even K's dataflow tracer requires a runtime failure finding, not a chain input.

Per §5: **first run against current code with zero changes.**

---

## Ground Truth (verified independently · hidden from runtime path · per §8)

Verified from `wo9-corrector.ts` before probe design:

```
Line 100: const anySpecialistUnavailable = input.diagnosis.failures.some(
            (f) => f.kind === "specialist_unavailable",
          );

Line ~166-169: const escalationReason =
                 anySpecialistUnavailable ? "REQUIRES_NEW_CAPABILITY"
                 : anySignalUncorrectable ? "P_S_CANNOT_DECIDE_AUTOMATICALLY"
                 : /* default */            "NO_RULE_MATCHES";
```

**Producer → Consumer relationship:**
- Producer: `anySpecialistUnavailable` derived at line 100 by `failures.some(...)`
- Consumer: `anySpecialistUnavailable` used at ~line 167 in ternary
- Direction: **100 → ~167** (line 100 precedes the consumer · value flows forward)
- Behavioural consequence: `anySpecialistUnavailable === true` selects the string literal `"REQUIRES_NEW_CAPABILITY"` for `escalationReason`
- Independent related relationship at line 141: filter `f.kind === "specialist_unavailable" || "execution_failed" return false` makes `allFailuresAreMissingFile` false → Rule 2 does not fire

**Ground-truth independent verification (verifier-side · never fed to runtime):**

| Check | Result | Notes |
|---|---|---|
| V-A producer exists at line 100 | ✓ | line contains `anySpecialistUnavailable` |
| V-B producer provenance correct | ✓ | line 100 contains `failures.some` and `specialist_unavailable` |
| V-C consumer exists at line 166 | **✗ off-by-one artefact** | `anySpecialistUnavailable` lands on line ~167 (line 166 is `const escalationReason =`). Verifier's ground-truth line index was one off; doesn't invalidate diagnostic. |
| V-D direction correct | ✓ | 100 < 167 |
| V-E behavioural consequence exists | ✓ | `"REQUIRES_NEW_CAPABILITY"` appears at line 167 or adjacent |
| V-F no hidden intermediate | ✓ | direct usage in ternary, no wrapper |
| V-G negative control isolated | ✓ | knowledge-store not inspected · not chained · not narratived |

The V-C off-by-one is a probe artefact — the verifier hardcoded line 166 but the reference is on the next line. The **overall directional claim (100 → 166ish) is correct**, and V-D confirms directionality. Documenting transparently.

---

## Test N Problem (blind · fed verbatim to NEX1)

> "Investigate src/lib/nex1-orchestrator/wo9-corrector.ts to explain how the presence of a specialist_unavailable failure affects the escalation reason chosen at the end of proposeCorrection. Which observations connect the failure kind to the eventual escalation outcome?"

Design constraints (per §5–§7):
- Does NOT name the producer variable (`anySpecialistUnavailable`)
- Does NOT name the consumer site line
- Does NOT name the escalation reason literal (`REQUIRES_NEW_CAPABILITY`)
- Does NOT put expected causal shape in classifier concepts, tags, filenames, or metadata
- Uses only failure-kind taxonomy names (which are ordinary API vocabulary)
- Asks about **connecting observations**, not restating them

---

## TEST N RESULT (per §27 format)

```
Classification:
CHAIN_ACCESS_NO_RELATIONSHIP_INFERENCE

N1  LOCATION:                    ✓
N2  SOURCE READ:                 ✓
N3  OBSERVATIONS:                ✓
N4  PROVENANCE:                  ✓
N5  CHAIN CONSUMPTION:           ✓ (Fix 9 chain_narratives · 300 emitted · 8 for target chain)
N6  MULTI-CHAIN CONNECTION:      ✗ (0 narratives link two chain_ids · zero packet field for inference records)
N7  STRUCTURAL RELATIONSHIP:     ✗ (0 pattern hits · no relationship claim emitted)
N8  CAUSAL DIRECTION:            ✗ (0 direction indicators: produces/consumed/gates/controls/supplies)
N9  BEHAVIOURAL CONSEQUENCE:     ✗ (0 consequence connectors: "when X true, Y returned")
N10 EVIDENCE GROUNDING:          ✗ (no inference emitted · nothing to ground)
N11 INFERENCE CLASSIFICATION:    ✗ (0 narratives with evidence_kind INFERRED · Fix 9 locks OBSERVED)
N12 NEGATIVE CONTROL:            ✓ (not inspected · not chained · not narrativised)
N13 ZERO FABRICATION:            ✓ (60 sampled · 0 mismatches)
N14 DETERMINISM:                 ✓ (identical narrative sets across two runs)
N15 CONFIDENCE:                  ✓ (0.84 · FLAG_FOR_REVIEW · not inflated)
N16 NATIVE ONLY:                 ✓

Native:                          YES
External model:                  NONE
Causal inference:                NO
Hallucinations:                  0
Unsafe modifications:            0
Unexpected writes:               0
A–M regression:                  13/13 unchanged
Production changes:              NO
Track A:                         FROZEN

Final Truth:
NEX1 native can read source, extract facts, group them into chains, and
restate them as provenance-tagged structural sentences. It cannot yet
infer a causal relationship between two independently-produced chains,
identify direction, or map that relationship to a behavioural consequence.

Architectural Boundary:
No chain-consuming relationship-inference capability exists. The gap is
BUILD (or ADAPTER + minimal deterministic pattern detector).

Next Proposed Fix:
Fix 10 · Chain Relationship Detector · design outlined below.
```

---

## Anti-False-Green Verifier · What It Actually Checked

Per founder §15/16, token presence and file:line presence are INSUFFICIENT. The probe's verifier independently checked:

1. **Are there any packet keys matching `inference|relationship|causal|producer|consumer|gated|controls|dataflow`?**
   → Zero. The packet has no shape to carry a relationship claim.

2. **Do any `chain_narratives[]` explicitly reference a *second* chain_id in their statement text?**
   → Zero. Fix 9's templates are per-chain by construction (founder §14 forbids cross-chain causal claims from Fix 9).

3. **Do any regex patterns match a structural relationship?**
   Patterns tested: `derived at line N is used at line M` · `produced at line N .* consumed at line M` · `gates .* at line N` · `controls .* branch` · `condition at line N .* return at line M` · `variable .* defined at line N .* used at line M`
   → Zero matches.

4. **Do any direction markers appear?**
   Markers tested: `produces value used` · `produced at line` · `consumed at line` · `gated by line` · `controls the branch` · `supplies the value` · `flows into` · `supplies to`
   → Zero matches.

5. **Do any behavioural-consequence patterns match?**
   Patterns tested: `when .* is true, .* is (returned|selected|chosen)` · `if .* holds, .* is (returned|selected|chosen)` · `leads to .* being (returned|selected|chosen)`
   → Zero matches.

6. **Are any narratives classified as INFERRED?**
   → Zero. Fix 9 locked all narratives to `evidence_kind: "OBSERVED"` at the type level. No relationship claim, no INFERRED classification.

Every one of these six axes returned zero. Combined with zero fabrications, zero external-model calls, and deterministic re-run, this is a very clean architectural boundary: **the wiring for causal inference is entirely absent, not present-but-buggy.**

---

## What the Chain Data Contains (that a future inference engine could consume)

For the record, the raw material a Fix 10 causal inference engine would need is present in the packet:

- `proposeCorrection` chain (same_function_body) contains 26 facts spanning lines 67-175
- The string literal `"specialist_unavailable"` appears at line 100 · enclosing_function is `null` (arrow-function callback issue documented in Fix 8 report)
- The if-condition `allTransient && anyTransient` at line 112 · enclosing_function `proposeCorrection`
- The if-condition `allInPlan && allFailuresAreMissingFile` at line 146 · enclosing_function `proposeCorrection`
- The return literals `MAX_ATTEMPTS_EXHAUSTED`, `NO_RULE_MATCHES`, `RETRY_TRANSIENT`, `REQUIRES_NEW_CAPABILITY` all appear in the chain with correct source-line provenance

The producer-consumer pair for `anySpecialistUnavailable` is present in the source_inspections string_literals list at line 100 (the string value `"specialist_unavailable"` inside the `.some()` callback). The consumer at line 167 is not directly in the chain because it's a variable reference, not a string literal — my source-inspector emits functions/if-conditions/returns/string_literals/imports but not variable-reference expressions. That's a **legitimate additional gap** for Fix 10 or a source-inspection enhancement to consider.

**The producer half of the pair is in `chain_narratives[]`.** The consumer half needs source-inspection to emit variable-reference facts. Neither is a causal-inference-engine job on its own.

---

## A–M Regression

| Test | Pre-Test-N | Post-Test-N | Delta |
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
| Fix 8 verification | FIX8_VERIFIED | FIX8_VERIFIED | none |
| Fix 9 verification | FIX9_VERIFIED | FIX9_VERIFIED | none |
| **N · Causal-inference diagnostic** | — | **CHAIN_ACCESS_NO_RELATIONSHIP_INFERENCE** | new |

- **Hallucinations: 0/14**
- **Unsafe modifications: 0/14**
- **Regressions: 0**

---

## Fix 10 Proposal · Deterministic Chain-Relationship Detector (§25 · not authorised · not built)

Presented per §25 as design outline only. Do NOT build without a separate founder authorization.

### Exact architectural gap
Fix 8 emits chains. Fix 9 emits per-chain narratives. No code path takes 2+ chains as input and emits a structured relationship record. The packet has no field to carry such a record.

### Existing components that could be reused (Connect-Before-Build)
- `observed_chains[]` · already grouped by same_function_body and shared_identifier
- `ObservedFactRef` · already carries file + line + verbatim text + fact kind + enclosing_function
- `capability-source-inspection.ts` · already emits functions, if-conditions, returns, string literals — but NOT variable-reference expressions (a small extension might be needed)
- `capability-k-local-value-dataflow.ts` · has structural patterns for producer/consumer detection · but coupled to runtime-failure input · could be adapted (ADAPTER, not full BUILD)

### Connection opportunity · minimum viable next capability
**Fix 10 · capability-chain-relationship-detector.ts** — deterministic pattern detector over chains. Structural relationships only:

Pattern 1 · **producer-consumer** (variable defined then used):
- Given two facts in the same enclosing_function, if fact A is a `variable_declaration` (or a `string_literal` inside a `.some()` callback that establishes a boolean) and fact B is a later `if_condition` or `return_statement` referencing the same identifier, emit:
  ```
  { relationship: "producer_consumer",
    producer_chain_id, producer_line,
    consumer_chain_id, consumer_line,
    variable_name, direction: "forward",
    evidence_kind: "INFERRED",
    provenance: [{file, producer_line}, {file, consumer_line}] }
  ```

Pattern 2 · **condition-gates-return** (if-condition immediately followed by return within same enclosing_function):
- If an if-branch at lines A-B is followed by a return_statement at line C where C ∈ (B, B+15], emit:
  ```
  { relationship: "condition_gates_return",
    condition_chain_id, condition_line,
    return_chain_id, return_line,
    return_literal (if primitive), direction: "forward",
    evidence_kind: "INFERRED", provenance: [...] }
  ```

Pattern 3 · **selector-literal-mapping** (ternary/if selects one of multiple string literals):
- If a variable's ternary/if-block returns one of N string literals based on N boolean conditions, emit N `selector_literal_mapping` records, one per branch:
  ```
  { relationship: "selector_literal_mapping",
    selector_chain_id, selector_line,
    condition_expression, literal_selected,
    evidence_kind: "INFERRED", provenance: [...] }
  ```

Nothing beyond these three patterns. No natural language. Each record's `evidence_kind` is **INFERRED** (from OBSERVED facts) but never `PROVEN`.

### Files likely affected (estimated scope)
- **New**: `src/lib/nex-agent/code-engine/capability-chain-relationship-detector.ts` (~350 LOC)
- **Modified**: `src/lib/nex-agent/code-engine/native-investigation-mode.ts` (+~30 LOC · Action 9 wiring + new packet field `inferred_relationships: readonly ChainRelationship[]`)
- **Optionally modified**: `capability-source-inspection.ts` to emit `variable_declaration` and `identifier_reference` facts (would enable Pattern 1 to fire on the anySpecialistUnavailable example directly)

### Explicit non-goals (§14/§15 discipline preserved)
- **Not** natural-language behavioural narrative
- **Not** semantic interpretation of *why* the code behaves this way
- **Not** cross-file relationship inference
- **Not** control-flow simulation
- **Not** dataflow tracing (that's K's territory)
- **Not** any LLM
- **Not** any writes
- **Not** any PROVEN evidence emission

### New behaviour
- New packet field `inferred_relationships: readonly ChainRelationship[]`
- Fix 9's `chain_narratives[]` continues unchanged
- Test N re-run would check whether the detector's output satisfies N6/N7/N8/N9

### Test N' (hypothetical follow-up · not scheduled)
- Post-Fix-10 · re-run Test N
- Expected: at least one `condition_gates_return` record for `allInPlan && allFailuresAreMissingFile` gating the reinvoke return · at least one `selector_literal_mapping` record showing `anySpecialistUnavailable → REQUIRES_NEW_CAPABILITY`
- Verifier's V-A through V-G checks must pass against each emitted relationship's provenance

### What Fix 10 STILL WOULD NOT DO (founder §29 preserved)
- Would not answer "why did the developer write it this way"
- Would not explain what the code should be changed to
- Would not close the semantic-narrative gap (Test M's underlying question)
- Would not attempt cross-file or cross-function inference

Fix 10 would move N6/N7/N8/N9 into a testable state. Whether Test N passes after Fix 10 depends on the *quality* of the detector's inferences — a genuine PASS still requires correct direction, correct behavioural consequence, and zero false relationships. Fix 10 does not guarantee Test N passes; it makes Test N answerable at all.

**No authorisation is implied by this proposal.**

---

## Founder-Rule Compliance (§29)

- Zero code changes for this diagnostic
- Runtime path is fully NEX1 native · zero LLM calls
- Ground truth held externally in verifier constants · never in runtime
- Anti-false-green verifier used six independent axes (structural, directional, consequential, classification) · all returned zero
- Verifier V-A through V-G independently confirms ground truth exists in real source
- Confidence not inflated (0.84 FLAG_FOR_REVIEW)
- Zero fabrication across 60 sampled narrative provenance records
- Deterministic re-run confirmed (identical narrative sets)
- Track A untouched

**A clean failure achieved via honest diagnostic.** No false green.

**Freeze remains in force. No code changes. No commits. No push. Track A untouched.**

---

## Recommendation to Founder

**STOP after this report** — per §28 stop condition.

Three options for the next founder decision:

1. **Authorise Fix 10 · Chain Relationship Detector** — small (~350 LOC) deterministic pattern detector over chains. Would move N6-N9 into a testable state. Would NOT close the semantic-narrative gap. May optionally include a small extension to source-inspection to emit variable-reference facts (needed for Pattern 1 to fully fire).

2. **Skip Fix 10 · accept the current staircase as the endpoint** — a human reader consumes chain_narratives and does causal inference themselves. Would freeze the intelligence layer at "presented facts", never claiming NEX1 understands.

3. **Extend the diagnostic phase further** — design Test O around a different capability class (e.g. cross-file or cross-function inference) before implementing Fix 10.

I recommend option 1 (Fix 10). The staircase's next honest gap is chain-relationship-inference; three named structural patterns (producer_consumer, condition_gates_return, selector_literal_mapping) are deterministically detectable without any interpretation. Test N' would then answer whether that's enough for the causal question or whether further capabilities are needed. But it's the founder's call.
