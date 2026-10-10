# NEX1 Test M · Native Source Explanation · Diagnostic First Run

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Reasoning path tested:** `NEX1_NATIVE` (per §13)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**Classification: `CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS`.**

The Fix 8 evidence-chain infrastructure works — 171 chains built at runtime, 40 covering the target file, `proposeCorrection` chain present with 3/4 required facts. **No downstream code path consumes those chains** to produce a source-grounded behavioural explanation. The packet's narrative fields (`hypotheses`, `evidence_for`, `evidence_against`) still emit the pre-Fix-7 template heuristic on tag-matched top candidate only. Zero fabrication. Zero external model. Deterministic. Confidence honestly 0.84 · FLAG_FOR_REVIEW. Track A untouched. Zero production changes for this diagnostic (per §4).

Test M is a **valid diagnostic result**, not a build failure. Founder rule §19: "A clean 'NO · NEX1 cannot yet synthesize source evidence' is a successful Test M diagnostic if that is what the runtime actually demonstrates." The runtime demonstrates exactly this.

---

## Pre-Build Audit (Phase A · per §3)

Every code-engine file was scanned for consumers of `observed_chains[]` or any behavioural synthesis capability.

**Grep receipts:**
```
grep observed_chains src/lib/nex-agent/code-engine/
- capability-observed-chains.ts        (producer)
- native-investigation-mode.ts         (5 touchpoints)

grep observed_chains native-investigation-mode.ts
Line 150–151 · type declaration
Line 639     · ACTION 7 wiring (produces)
Line 651, 654, 655 · Action 7 trace/error handling
Line 853–854 · finalise pass-through (stores into packet)
Zero lines READ observed_chains for downstream processing.
```

**Files matching explain/explanation/behavioural/synthesize/synthesise:** 9 hits, all are:
- Test files (`*.test.ts`)
- `capability-i-test-synthesis.ts` — test-case generator (not source-explanation)
- `capability-i2-negative-proof.ts` — negative-proof generator (not source-explanation)
- `native-programming-loop.ts` — composition wrapper for test/repair loop, not chain synthesis
- `native-investigation-absence.ts` — absence-of-token reasoning, tag-based only
- `template-only.ts` (in adapters/) — deterministic template AST directive builder, not chain synthesis
- `index.ts` — exports index

**None** of these files consume `observed_chains[]` for behavioural narrative.

**Classification: gap is BUILD (no existing consumer of chain output for narrative purposes).**

Per §4: **diagnostic first, no code changes.**

---

## Test M Problem (blind · fed verbatim to NEX1)

Identical to Test L for clean pre/post comparison:

> "Investigate src/lib/nex1-orchestrator/wo9-corrector.ts to explain what happens when a correction cycle receives both a specialist_unavailable failure and a missing_target_file failure in the same iteration. Which decision branch is taken, and what determines the escalation reason?"

**Ground truth held externally in verifier only** — NOT passed into any runtime API:
- Correct decision branch: default escalate (fall-through)
- Correct escalation reason: `REQUIRES_NEW_CAPABILITY`
- Causal chain: Rule 1 doesn't fire (allTransient false) → Rule 2 doesn't fire (specialist_unavailable filter) → default escalate → REQUIRES_NEW_CAPABILITY (anySpecialistUnavailable=true)
- Supporting lines: 100, 108, 141, 166

---

## Test M Result — 13 Criteria

| # | Criterion | Result | Detail |
|---|---|---|---|
| **M1** | LOCATION | ✓ | Target file located (via classifier_file_ref + inspected in Action 6) |
| **M2** | SOURCE READ | ✓ | wo9-corrector.ts inspected · kind=ok · 11783 B read |
| **M3** | SOURCE OBSERVATIONS | ✓ | 92 facts extracted (11 fn + 12 if + 29 return + 40 str) |
| **M4** | PROVENANCE | ✓ | every fact has source_file + start_line + end_line |
| **M5** | CHAIN ACCESS | ✓ | 40 target-file chains including `same_function_body::proposeCorrection` |
| **M6** | MULTI-OBS CONNECTION | **✗** | 0 chain identifier tokens appear in narrative fields |
| **M7** | BEHAVIOURAL SYNTHESIS | **✗** | 0 of 15 behavioural connectors in narrative |
| **M8** | SOURCE GROUNDING | **✗** | narrative contains no file:line reference to target |
| **M9** | NEG CONTROL | ✓ | knowledge-store.ts not inspected, no chain built, not in narrative |
| **M10** | ZERO FABRICATION | ✓ | 0 mismatches across chain-fact verifier |
| **M11** | UNCERTAINTY DISCIPLINE | ✓ | confidence 0.84 (< 0.85) reflects unresolved synthesis |
| **M12** | DETERMINISTIC | ✓ | two independent runs · identical chain_id sets |
| **M13** | CONFIDENCE | ✓ | FLAG_FOR_REVIEW · not inflated to HIGH_95 or VERY_HIGH_99 |

**Overall: 10/13 pass · 3/13 fail (all three failures on the synthesis axis).**

---

## Packet Narrative (verbatim from probe output)

```
hypotheses:       ["Top candidate src/lib/nex-agent-runtime/cli-mcp-surface/__tests__/surface.test.ts matches 1/1 concept(s)"]
evidence_for:     ["file matches ALL extracted concepts: escalation"]
evidence_against: []
unknown_facts:    []                                    ← should have declared cannot-synthesize
recommended:      "top 3 candidates warrant closer inspection · confidence is GOOD but not HIGH"
```

Interpretation: the classifier extracted the concept `escalation` from the problem, matched it to a tangential test file that mentions that word, and the pre-Fix-7 template heuristic wrote a hypothesis about *that file* — not about wo9-corrector.ts, and not about the correction cascade. Meanwhile, `observed_chains[]` contains 40 chains for wo9-corrector.ts, including a `same_function_body::proposeCorrection` chain with 15+ facts covering lines 67 through 176. **Not one chain, not one fact, not one file:line reference reached the narrative.**

That is the boundary Test M exposes.

---

## Chain Sample Available But Unused

The chain that *should* have driven the explanation, present in `observed_chains[]` but unread:

```
chain_id:      wo9-corrector.ts::same_function_body::proposeCorrection
source_file:   wo9-corrector.ts
relationship:  same_function_body
group_key:     proposeCorrection
evidence_kind: OBSERVED
facts (ordered):
  · if_condition '!canContinueCorrection(...)'         line 73
  · return {ok:false, kind:"escalate...", MAX_ATTEMPTS_EXHAUSTED} line 74
  · if_condition '!input.diagnosis.has_failures'       line 84
  · return {ok:false, kind:"escalate...", NO_RULE_MATCHES}        line 85
  · if_condition 'allTransient && anyTransient'        line 112
  · return {ok:true, kind:"retry_same_plan", RETRY_TRANSIENT}     line 114
  · if_condition 'allInPlan && allFailuresAreMissingFile' line 146
  · return {ok:true, kind:"reinvoke_plan_missing_files"} line 149
  · return {ok:false, kind:"escalate...", escalationReason} line 171
```

Every ingredient the correct explanation would require is here, provenance-preserved, verified against source (Fix 8 verifier: 0 fabrications, deterministic re-run). The gap is the code path from `observed_chains[]` to `hypotheses[]`/`evidence_for[]`.

---

## Contamination & Native-Only Verification

- **Native path:** classifier + File Memory + dep-graph + source inspection + chain aggregation. All local. Zero LLM calls made from the runtime path.
- **External model contamination:** NONE. The runtime path invokes no external model. Any external model activity is in the harness (probe design, verifier, this report) and is explicitly outside the tested reasoning path per §13.
- **Ground truth contamination:** NONE. Ground truth lives only in the probe's verifier constants (`GROUND_TRUTH.correct_explanation_shape.*`). The problem statement fed to `runNativeInvestigation` contains no expected literals, no line numbers, no rule names, no expected escalation kind.
- **Original-problem echo:** Test L exposed this failure mode; the M6/M7/M8 verifier checks only source-derived narrative fields (hypotheses/evidence_for/evidence_against), never `original_problem`.

---

## A–L Regression

| Test | Pre-Test-M | Post-Test-M | Delta |
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
| J · Source-reading (historical) | LOCATED_ONLY_NO_SOURCE_ANALYSIS | (preserved) | preserved |
| K · Source-level | SOURCE_LEVEL_RUNTIME_VERIFIED | SOURCE_LEVEL_RUNTIME_VERIFIED | none |
| L · Source-explanation | SOURCE_READ_ONLY_NO_SYNTHESIS | SOURCE_READ_ONLY_NO_SYNTHESIS | none |
| Fix 8 verification | FIX8_VERIFIED | FIX8_VERIFIED | none |

Nothing regressed. Zero unexpected file writes. Zero external-model calls in the runtime path. Zero unsafe modifications.

---

## Fix 9 Proposal · Chain-Grounded Narrative Emitter (§17 · not authorised · not built)

Presented per §17 as design outline only. Do NOT build without a separate founder authorization.

### Exact architectural gap
The `observed_chains[]` packet field is populated but has no consumer that emits behavioural narrative into `hypotheses[]` / `evidence_for[]` / a new `explanations[]` field. The template heuristic at `native-investigation-mode.ts:593-604` runs before Action 6/7 and never sees the chains.

### Existing components that could be reused (Connect-Before-Build)
- `capability-observed-chains.ts` · already emits deterministic chains
- `ObservedFactRef` · already carries file + line + verbatim text + fact kind + enclosing_function
- Investigation packet infrastructure · already has type-safe narrative fields
- `InvestigationActionRecord<T>` with `evidence_kind` union (Fix 7)

### Connection opportunity · minimum viable next capability
**Fix 9 · capability-chain-narrative-emitter.ts** — deterministic template that walks each chain (or the highest-relevance chain) and emits STRUCTURED FACTUAL SENTENCES with strict grammar:

```
"In {file}:{start_line}, function `{function}` contains an if-condition {condition_text}."
"The condition is followed (line {return_line}) by a return of kind `{kind}`."
"The chain contains {N} facts spanning lines {min_line}-{max_line}."
```

Rules the emitter must follow (mirror founder Fix 8 discipline):
- No causal words: no "therefore/because/leads to/causes/implies/hence"
- No policy names: sentences reference identifiers only via verbatim source excerpts
- No interpretation: each sentence is a factual re-statement of a chain field
- Every sentence carries `source_file` + `line` provenance in text
- Emitter is bounded: max sentences per chain, max chains per file, max total

### Files likely affected (estimated scope)
- **New**: `src/lib/nex-agent/code-engine/capability-chain-narrative-emitter.ts` (~250 LOC)
- **Modified**: `src/lib/nex-agent/code-engine/native-investigation-mode.ts` (+~30 LOC · Action 8 wiring + new packet field `chain_narratives: readonly ChainNarrative[]`)

### New behaviour
Investigation packet gains `chain_narratives[]` — an array of structured sentences per chain, each with `text` and `provenance: {source_file, line}`. The `hypotheses[]` field can then optionally be populated by picking the top-N `chain_narratives` for the top target-file chain (or left as-is with a note).

### Explicit non-goals
- **Not** cross-chain causal inference
- **Not** natural-language behavioural argument
- **Not** "the function does X because Y"
- **Not** narrative for chains NOT already present in `observed_chains[]`
- **Not** any modification to source inspection or chain aggregation
- **Not** any bump in evidence_kind from OBSERVED

### Safety boundaries
- Read-only (never touches source files, never writes)
- No LLM
- Deterministic (same chains → same sentences)
- Bounded (max 5 chains × max 8 sentences = ≤40 sentences per investigation)
- Refuses on empty chains (emits nothing rather than fabricating)

### Regression plan
- All 12 existing regression probes must remain unchanged
- New Fix 9 verification probe: check that each emitted sentence contains at least one source_file + line reference AND that no sentence contains a prohibited causal word
- Fabrication check: every named identifier in a sentence must appear at the claimed line in the actual file

### New diagnostic required
- Test M' would check whether the chain-narrative emitter's output satisfies M6/M7/M8 · specifically whether multi-fact connection is now observable in narrative fields with source grounding

### What Fix 9 STILL WOULD NOT DO
- Not answer "why does the code behave this way" — just presents chain facts as English
- Not test M passing yet — the emitter alone doesn't prove NEX1 *reasons* about behaviour; a human reader still has to read the sentences and conclude

Fix 9 would move M6/M7/M8 into a testable state — not necessarily a passing state. The founder's staircase discipline suggests that even after Fix 9, the honest classification might be `PARTIAL_STRUCTURAL_NARRATIVE_NO_CAUSAL_SYNTHESIS`. Test N would then explore causal inference.

**No authorisation is implied by this proposal.**

---

## TEST M RESULT (per §18 format)

```
Classification:
CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS

M1:  ✓ LOCATION
M2:  ✓ SOURCE READ
M3:  ✓ SOURCE OBSERVATIONS
M4:  ✓ PROVENANCE
M5:  ✓ CHAIN ACCESS
M6:  ✗ MULTI-OBS CONNECTION
M7:  ✗ BEHAVIOURAL SYNTHESIS
M8:  ✗ SOURCE GROUNDING
M9:  ✓ NEG CONTROL
M10: ✓ ZERO FABRICATION
M11: ✓ UNCERTAINTY DISCIPLINE
M12: ✓ DETERMINISM
M13: ✓ CONFIDENCE (honest FLAG_FOR_REVIEW at 0.84)

Native: YES
External model: NONE
Hallucinations: 0
Unsafe modifications: 0
Regressions: 0
A–L regression: 12/12
Production changes: NO
Track A: FROZEN

Final Truth:
NEX1 native can locate, read, extract, provenance-preserve, and
deterministically chain source facts. It cannot yet consume its own
chains to produce a source-grounded behavioural explanation.

Next Proposed Capability (§17):
Fix 9 · Chain-Grounded Narrative Emitter · design outlined above.
Deterministic structural re-statement of chain facts into
provenance-tagged sentences. Not a causal reasoner. Founder-only
decision to authorize.
```

---

## Recommendation to Founder

**STOP after this report** — per §20 stop condition.

Test M established the exact next architectural boundary honestly. Three options:

1. **Authorise Fix 9 · Chain-Grounded Narrative Emitter** — small (~250 LOC) deterministic re-statement of chain facts as provenance-tagged sentences. Would move M6/M7/M8 into a testable state. Would NOT prove causal synthesis.

2. **Skip Fix 9 · design Test N (causal inference over chains) as a distinct diagnostic** — asks whether NEX1 can infer causal ordering between chain facts using structural signals only (same_function_body + line-ordering + control-flow adjacency). Would test the harder capability directly. Runs against current code (no synthesis emitter yet) but only claims PROVEN when the structural evidence establishes causality.

3. **Pause Track B here** — catalog M as boundary, defer.

I recommend option 1 (Fix 9) because it makes the chain-driven narrative *testable* at all — currently M6/M7/M8 will always fail because no code writes narrative from chains. But that recommendation is discipline-neutral: the *honest* diagnostic here is that NEX1 currently cannot explain. Option 2 would be equally valid if the founder wants to skip narrative and go straight to structural causal inference.

**Freeze remains in force. No code changes. No commits. No push. Track A untouched.**
