# NEX1 Test P · Native Root-Cause Reasoning Diagnostic

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Reasoning path tested:** `NEX1_NATIVE` (per §15)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**Classification: `COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING`** — clean architectural boundary. Fix 11 emits verified structural compositions (`anyTransient@99 → if_condition@112 → return@114`), but **no code path consumes them** for hypothesis generation, behavioural mapping, or root-cause reasoning. The `packet.hypotheses[]` field remains the pre-Fix-7 template heuristic on tag-matched top-file (still emitting tangential test-file names like `work-map-api.test.ts` completely unrelated to the actual question). Zero packet fields matching `root_cause | hypothesis_scor | alternative_hypothesis | candidate_causes`. Zero structured hypothesis records.

**This is a valid diagnostic result per §31: If NEX1 doesn't know, expose the boundary. Never manufacture the green dot.**

- Hallucinations: 0
- Unsafe modifications: 0
- Unexpected writes: 0
- External model: NONE
- A–O regression: 16/16 unchanged
- Production changes: NO
- Track A: FROZEN

---

## Pre-Build Audit (Phase A · per §5)

Every code-engine file scanned for existing root-cause reasoning capability, hypothesis generation over compositions, or consumers of `composed_arguments[]`.

**Grep receipts:**
```
grep composed_arguments|ComposedArgument                     → 2 files only:
  · capability-chain-relationship-composer.ts (producer)
  · native-investigation-mode.ts (packet plumbing · 8 touchpoints, none read)

grep root_cause|rootCause|hypothesis_scor|alternative_hypothesis|candidate_causes → 0 matches
```

Every capability inventoried:
| Component | Consumes composed_arguments? | Emits hypothesis / candidate cause? |
|---|---|---|
| `capability-source-inspection.ts` | no | no |
| `capability-observed-chains.ts` | no | no |
| `capability-chain-narrative-emitter.ts` | no | no (single-chain restatement only) |
| `capability-chain-relationship-detector.ts` | no | no (pair emission only) |
| `capability-chain-relationship-composer.ts` | **producer only** | no |
| `native-investigation-actions.ts` | no | no |
| `native-investigation-mode.ts` | no (plumbing only) | `hypotheses[]` populated by pre-Fix-7 template heuristic on tag-matched top file |
| `capability-j-runtime-diagnosis.ts` | no | irrelevant · requires vitest text |
| `capability-j2-cause-analysis.ts` | no | irrelevant · requires runtime failure finding |
| `capability-k-local-value-dataflow.ts` | no | irrelevant · requires runtime failure finding |
| `native-programming-loop.ts` | no | no |
| `consequence-reasoner.ts` | no | no · tsc → AST directive |

**Classification: gap is BUILD.** No existing capability emits a structured hypothesis over `composed_arguments[]` with supporting evidence citations.

Per §6: **first run against current code with zero changes.**

---

## Ground Truth (verified independently · hidden from runtime path · per §8)

Scenario: `proposeCorrection` in `wo9-corrector.ts`. When all failures are transient, the retry-same-plan return at line 114 fires with rule literal `RETRY_TRANSIENT`.

**Root cause of the retry outcome (verified from source):**
- Symptom: return at line 114 · kind `retry_same_plan` · rule `RETRY_TRANSIENT`
- Deciding condition: line 112 · `allTransient && anyTransient` · gates the return
- Root cause producer: line 99 · `const anyTransient = input.diagnosis.any_transient`
- Alternative candidates a proper hypothesis generator would consider:
  - Line 108-111 · `allTransient` derivation (also a producer, later than anyTransient)
  - `input.diagnosis.any_transient` upstream parameter (a caller-supplied value)
- Composition available (verified by Fix 11): `producer_consumer(99→112)` + `condition_gates_return(112→114)` at composition_id `wo9-corrector.ts::producer_consumer::99:112:anyTransient -> wo9-corrector.ts::condition_gates_return::112:114`
- Negative control: `knowledge-store.ts` (unrelated · same neg-control as prior tests)

Ground truth held only in verifier constants · never fed to `runNativeInvestigation`.

---

## Test P Problem (blind · fed verbatim to NEX1)

> "In src/lib/nex1-orchestrator/wo9-corrector.ts, one branch of the deterministic corrector returns a retry outcome to the caller. Investigate the underlying mechanism that makes this branch fire, and identify the root cause of the retry decision using verified source evidence. Do not modify anything."

Design constraints (§8):
- Does NOT name relationships
- Does NOT name lines
- Does NOT name the target function
- Does NOT name the retry kind (`retry_same_plan`)
- Does NOT name the deciding condition (`allTransient && anyTransient`)
- Does NOT name the producer variable (`anyTransient`)
- Requires investigation

---

## TEST P RESULT (per §30 format)

```
Classification:
COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING

P1  LOCATION:                     ✓
P2  SOURCE_READ:                  ✓
P3  RELATIONSHIPS_AVAILABLE:      ✓
P4  COMPOSITION_AVAILABLE:        ✓  (target composition present at depth 2)
P5  MULTI-EVIDENCE INPUT:         ✓
P6  BEHAVIOURAL_MAPPING:          ✗  (no packet field ties composition to behaviour)
P7  CANDIDATE_HYPOTHESIS:         ✗  (0 structured hypotheses · packet.hypotheses is template heuristic on tangential file)
P8  CAUSAL_DIRECTION:             ✗  (no "root cause at line N" claim)
P9  SUPPORTING_EVIDENCE:          ✗  (no citation of composition_id or relationship_id as evidence)
P10 ALTERNATIVE/CONTRADICTORY:    ✗  (no hypothesis-set semantics · no INSUFFICIENT_EVIDENCE declaration)
P11 ROOT-CAUSE CONCLUSION:        ✗  (no candidate identified)
P12 SOURCE PROVENANCE:            ✗  (vacuous · P11 false)
P13 NEGATIVE CONTROL:             ✓  (knowledge-store not credited)
P14 ZERO FABRICATION:             ✓  (nothing claimed → nothing fabricated)
P15 DETERMINISM:                  ✓  (identical composition sets across 2 runs)
P16 CONFIDENCE:                   ✓  (FLAG_FOR_REVIEW · not inflated)
P17 NATIVE ONLY:                  ✓  (zero external model calls in runtime path)
P18 UNSAFE MODIFICATION:          ✓  (0)

Root-cause candidate:             (none · P11 fail)
Evidence chain:                   (none · P9/P10/P11 all fail)
External model:                   NONE
Hallucinations:                   0
Unsafe modifications:             0
A–O regression:                   16/16 unchanged
Track A:                          FROZEN
```

---

## What The Packet Actually Contains (For The Record)

The verifier confirmed that Fix 11's target composition is present in `packet.composed_arguments`:

```
composition_id:
  src/lib/nex1-orchestrator/wo9-corrector.ts::producer_consumer::99:112:anyTransient
   -> src/lib/nex1-orchestrator/wo9-corrector.ts::condition_gates_return::112:114
depth: 2
evidence_kind: INFERRED
```

17 total compositions in this run · target composition is one of them. The raw material for a Stage-12 root-cause reasoner is fully available.

**But the narrative fields are still emit the pre-Fix-7 template heuristic:**
```
hypotheses:       ["Top candidate src/lib/nex-cap/__tests__/work-map-api.test.ts matches 1/1 concept(s)"]
evidence_for:     ["file matches ALL extracted concepts: deterministic"]
evidence_against: []
unknown_facts:    []
```

The classifier extracted the concept `deterministic` from the problem statement, matched it to a tangential test file, and the template wrote a hypothesis about *that file* — completely unrelated to the actual root-cause question.

**Zero packet fields matching root_cause/hypothesis/candidate_cause semantics** (verifier grep returned only `candidate_files` [Fix 8] and `absence_candidates` [Fix 9] · neither is Stage-12 reasoning).

---

## Anti-False-Green Verification (§16-§17)

Six independent checks · none produced a false positive:

1. **Packet keys matching `root_cause | hypothesis | behavioural_map | causal | conclusion | candidate`** → matched only `candidate_files` (Fix 8) and `absence_candidates` (Fix 9). Both are false-positive regex matches — neither carries Stage-12 semantics.
2. **Structured hypothesis records** (objects with `claim` / `candidate` / `supporting_evidence`) → **0** found. `packet.hypotheses` remains `readonly string[]` of template heuristic strings.
3. **Composition_id cited as supporting evidence** in narrative → **False**. The target composition_id is present in `packet.composed_arguments` but not referenced from `hypotheses[]` / `evidence_for[]`.
4. **Causal direction markers** (regex `root cause .*line N`, `producer .*line N .* consumer`, `originates at line N`, etc.) → **0 matches**.
5. **Alternative-hypothesis or INSUFFICIENT_EVIDENCE declaration** → **False**. Neither H1/H2/H3-style enumeration nor honest "insufficient evidence" appears.
6. **Negative control (`knowledge-store.ts`) mentioned as candidate** → **False**. Isolated correctly.

The narrative surface contains the token `retry` (from the problem statement echo) and `deterministic` (concept extracted by classifier) — but neither counts as root-cause reasoning under §16's anti-false-green rules.

---

## A–O Regression

| Test | Pre-Test-P | Post-Test-P | Delta |
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
| O · Composition diagnostic | SOURCE_GROUNDED_COMPOSITION_RUNTIME_VERIFIED | SOURCE_GROUNDED_COMPOSITION_RUNTIME_VERIFIED | none |
| Fix 11 verification | FIX11_VERIFIED | FIX11_VERIFIED | none |
| **P · Root-cause diagnostic** | — | **COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING** | new |

- **Hallucinations: 0/17**
- **Unsafe modifications: 0/17**
- **Regressions: 0**

---

## Capability State (per §31 · promotion only on runtime evidence)

| Stage | Capability | State |
|---|---|---|
| K | Source reading | 🟢 |
| 8 | Evidence structuring | 🟢 |
| 9 | Structural restatement | 🟢 |
| 10 | Structural relationships | 🟢 |
| 11 | Relationship composition | 🟢 |
| **12** | **Root-cause reasoning** | **🔴 COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING** |
| 13 | Change-plan generation | ⚪ |
| 14 | Authorised modification (hands) | 🔒 |
| 15 | Execution (hands) | 🔒 |
| 16 | Verify / correct / reverify (hands) | 🔒 |

**Stage 12 remains 🔴.** Fix 11 built the raw material (compositions with full provenance); nothing consumes it into hypothesis form.

---

## Founder-Rule Compliance (§31)

- No production code changes for this diagnostic
- Runtime path is fully NEX1 native · zero LLM calls
- Ground truth held externally in verifier constants · never fed to runtime
- Anti-false-green: six independent axes checked · all zero for Stage-12 semantics
- Deterministic (17 identical compositions across two runs)
- Zero fabrication (nothing claimed · nothing to fabricate)
- Confidence appropriate (FLAG_FOR_REVIEW)
- Track A untouched

**A clean failure achieved via honest diagnostic. No false green. The green dot for Stage 12 has NOT been manufactured.**

---

## Fix Proposal (§27 · design only · NOT authorised · NOT built)

Presented per §27 as an outline of what a Stage-12 fix would look like — not a build request. Founder decides.

**Fix 12 · Structural Root-Cause Hypothesis Generator** — deterministic reader over `composed_arguments[]` that:

1. **For each composition**, identify the **first endpoint** as a candidate producer (root-cause candidate) and the **last endpoint** as the behavioural outcome (symptom).
2. Emit a structured `RootCauseCandidate[]` record with shape:
   ```
   {
     candidate_id, composition_id,
     candidate_endpoint: {file, line, symbol, fact_kind},
     symptom_endpoint: {file, line, symbol, fact_kind},
     supporting_relationships: readonly string[],
     evidence_kind: "HYPOTHESIS" (locked),
     confidence: number,
     alternative_candidates: readonly string[],
     provenance: readonly {file, line}[],
   }
   ```
3. **Locked HYPOTHESIS**, never PROVEN. The reasoning is structural (first endpoint in a valid composition IS earlier than the last endpoint), but claiming it as ROOT CAUSE requires a semantic step Fix 12 does NOT take. The output is "candidate root cause per structural reasoning" — an interpretive claim requires Stage 13.
4. Emit multiple candidates when multiple compositions exist (each candidate keyed by its composition_id).
5. Alternative-hypothesis handling: for each candidate, list other candidates from other compositions in the same enclosing_function as potential alternatives.
6. Confidence formula: number of supporting relationships / max supporting relationships across candidates in scope · never inflated above 0.85 (INSUFFICIENT_EVIDENCE threshold).
7. Zero natural-language emission · zero causal vocabulary · runtime defence-in-depth check identical to Fix 8/9/10.

**Test P' rerun after Fix 12** would need to check: whether P7 (candidate hypothesis) and P11 (root-cause conclusion) newly pass at runtime with proper structural provenance. P8 (causal direction) would pass by construction (first endpoint = earlier line, last endpoint = later line in composition). P10 (alternative hypotheses) would pass because Fix 12 emits alternatives.

**What Fix 12 STILL WOULD NOT DO:** semantic behavioural interpretation ("why did the developer make this the root cause") · that remains Stage 13+ territory.

**No authorization implied by this proposal.**

---

## Final Truth

> NEX1 native can locate source, extract observations, build chains, restate them, detect structural relationships, and compose those relationships into multi-hop arguments. **It cannot yet reason from a composition to identify a root-cause candidate with supporting evidence, alternative hypotheses, and honest confidence.** The composition raw material is present in the packet at runtime · nothing consumes it into hypothesis-shaped output.

## Exact Boundary

Stage 12 · the transition from **verified structural composition** to **hypothesis-shaped root-cause candidate with supporting evidence citations and alternative considerations** · is architecturally absent. Zero packet fields carry hypothesis semantics. Zero code paths read `composed_arguments[]` for reasoning purposes. `packet.hypotheses[]` remains the pre-Fix-7 template heuristic.

## STOP — DO NOT IMPLEMENT STAGE 12 DURING THIS DIAGNOSTIC

Per §30 stop condition. Founder decides next:
1. **Authorise Fix 12 · Structural Root-Cause Hypothesis Generator** (design outlined above)
2. **Pause Track B here** · Stage 11 is a solid green dot · five consecutive stages complete (K → 8 → 9 → 10 → 11)
3. **Consolidate documentation** · 20 doctrine reports now exist · a summary index would help future readers navigate the staircase

I recommend option 1 (Fix 12 · diagnostic-first authorization prompt as the next founder action). The audit is done, the gap is precise, the scope stays narrow: structural hypothesis generation without semantic interpretation. But the founder's call. **No new code built until authorized.**

**Freeze remains in force. No commits. No push. Track A untouched.**
