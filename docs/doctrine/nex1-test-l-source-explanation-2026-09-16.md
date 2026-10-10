# NEX1 Test L · Source-Level Explanation & Evidence Synthesis · Diagnostic

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Reasoning path tested:** `NEX1_NATIVE` (per §17)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**Overall classification: `SOURCE_READ_ONLY_NO_SYNTHESIS` — clean architectural boundary.**

Fix 7 (Test K) gave NEX1 the ability to read real source and emit provenance-tagged OBSERVED facts. Test L is a distinct capability class: **synthesizing multiple observed facts into a source-grounded behavioural explanation.** The diagnostic first run establishes that this capability is currently absent — the `source_inspections[]` field is stored in the investigation packet but never consumed by any code path that populates `hypotheses[]` / `evidence_for[]`. Those narrative fields are still populated by the pre-Fix-7 template heuristic on `topCandidates[0].matched_concept_tags` alone.

Zero fabrication. Confidence honestly calibrated at 0.84 · FLAG_FOR_REVIEW. Track A untouched. Zero code changes for this diagnostic (per §15).

**Final truth statement (per §20):**

> **NO · CLEAN BOUNDARY** · native NEX1 currently cannot synthesize multiple real source observations into a correct source-grounded explanation of software behaviour. The reader emits facts; nothing downstream connects them.

---

## Pre-Build Audit (Phase A · per §2)

Every code-engine file was scanned for source-fact synthesis, evidence aggregation, behaviour explanation, or hypothesis-generation over source content.

**Findings:**

| Candidate | What it does | Consumes `source_inspections[]`? |
|---|---|---|
| `native-investigation-mode.ts` | Populates hypotheses/evidence_for from `topCandidates[0].matched_concept_tags` (template · lines 593-604) | **No** · grep confirmed only 3 references: type declaration (139-141) and finalise pass-through (806-808) |
| `native-investigation-actions.ts` | Wraps primitives in InvestigationActionRecord shape | No |
| `capability-source-inspection.ts` | Emits raw facts from source | Producer, not consumer |
| `capability-i-test-synthesis.ts` | Test-case generator from structured test goals | No |
| `capability-i2-negative-proof.ts` | Negative-proof test generator | No |
| `capability-j-runtime-diagnosis.ts` | Vitest output → structured runtime findings | No |
| `capability-j2-cause-analysis.ts` | Runtime finding → structural repair proposal | No |
| `capability-k-local-value-dataflow.ts` | Runtime finding → dataflow repair proposal | No |
| `consequence-reasoner.ts` | tsc TS2322 output → AST directives | No |
| `native-programming-loop.ts` | Composition wrapper for existing capabilities | No |
| `capability-h-planning.ts` / `-h3-multigoal-planning.ts` | Plan multi-goal edits | No |

Grep receipts:
```
grep source_inspections native-investigation-mode.ts
139:  readonly source_inspections: readonly SourceInspection[];
140:  readonly source_inspections_ok: boolean;
141:  readonly source_inspections_note: string;
806:    source_inspections: input.sourceInspections,
807:    source_inspections_ok: input.inspectionsOk,
808:    source_inspections_note: input.inspectionsNote,
```
Three touch-points. Zero reads. The packet field is a data grave from the perspective of the packet's narrative fields.

**Classification of the gap: BUILD (or minimal ADAPTER + aggregator).**

Rationale: no existing function accepts `readonly SourceInspection[]` as input and returns aggregated behavioural claims. Every capability listed above is scoped to a different input type (vitest text, runtime finding, test goal, tsc output). A synthesis pass over source_inspections would be genuinely new code.

Per §15 discipline: **the diagnostic first run was executed before any BUILD.**

---

## Test L Ground Truth (Phase 0 · verified from source · withheld from NEX1)

**Scenario:** correction cycle receives both a `specialist_unavailable` failure AND a `missing_target_file` failure in the same iteration.

**Correct behaviour (verified in `wo9-corrector.ts:67-177`):**

| Step | Line | Fact | Result |
|---|---|---|---|
| Entry | 67 | `proposeCorrection` invoked with mixed diagnosis.failures | proceeds past bounds and has_failures gates |
| Rule 1 test | 108-112 | `allTransient` = every failure is `build_failed` or `runtime_failed` AND is_transient | `specialist_unavailable` fails this predicate → allTransient=false → **Rule 1 does not fire** |
| Rule 2 test | 141-146 | `allFailuresAreMissingFile` filter returns `false` when `f.kind === "specialist_unavailable" \|\| "execution_failed"` | Rule 2 does not fire |
| Escalation | 100 | `anySpecialistUnavailable = failures.some(f => f.kind === "specialist_unavailable")` | true |
| Reason selector | 166-169 | `escalationReason = anySpecialistUnavailable ? "REQUIRES_NEW_CAPABILITY" : anySignalUncorrectable ? ... : "NO_RULE_MATCHES"` | `"REQUIRES_NEW_CAPABILITY"` |
| Return | 171-177 | `{ok:false, kind:"escalate_to_founder", escalation_reason:"REQUIRES_NEW_CAPABILITY", ...}` | Final result |

**Required observations (four, for synthesis):**
- Fact A · line 108 · allTransient definition
- Fact B · line 141 · specialist_unavailable filter in allFailuresAreMissingFile
- Fact C · line 100 · anySpecialistUnavailable derivation
- Fact D · line 166 · escalationReason selector

**Correct synthesis chain:**
1. specialist_unavailable is not transient → Rule 1 does not fire (from Fact A)
2. specialist_unavailable fails the every() filter → Rule 2 does not fire (from Fact B)
3. Fall-through to default escalate branch (from control flow after both rules)
4. anySpecialistUnavailable=true → escalation_reason = REQUIRES_NEW_CAPABILITY (from Facts C+D)

**Misleading structural neighbour:** `src/lib/nex1-orchestrator/wo9-types.ts` (only type declarations, no policy).

**Negative control:** `src/lib/nex-code-brain/knowledge-store.ts` (unrelated · no vocab match · no dependency edges to top candidates).

---

## Test L Problem Statement (blind · fed verbatim)

> "Investigate src/lib/nex1-orchestrator/wo9-corrector.ts to explain what happens when a correction cycle receives both a specialist_unavailable failure and a missing_target_file failure in the same iteration. Which decision branch is taken, and what determines the escalation reason?"

Design constraints (per §5):
- Does NOT name the target function `proposeCorrection`
- Does NOT name distinctive rule literals (`RETRY_TRANSIENT`, `REINVOKE_PLAN_MISSING_FILES`, `REQUIRES_NEW_CAPABILITY`)
- Uses only failure-kind literals (`specialist_unavailable`, `missing_target_file`) which are ordinary API taxonomy names, not the answer
- Asks about BEHAVIOUR ("what happens", "which decision branch", "what determines") — not location

---

## NEX1 Output (Diagnostic First Run)

**Investigation packet:**
- Verdict: `SUFFICIENT_EVIDENCE`
- Trigger: `PRIMARY_INVESTIGATE`
- Confidence: `FLAG_FOR_REVIEW` (0.84)
- Source inspections performed: 5 (Fix 7's classifier_file_ref + top-scored selection)
- Target file wo9-corrector.ts inspection: `ok`, 11783 B read
- Inspected file list: wo9-corrector.ts, wo12-real-correction-cycle.test.ts, wo9-correction-loop.test.ts, wo3-types.ts, wo9-types.ts

**Narrative fields (unchanged from pre-Fix-7 template heuristic):**
```
hypotheses:      ["Top candidate src/lib/nex-agent-runtime/cli-mcp-surface/__tests__/surface.test.ts matches 1/1 concept(s)"]
evidence_for:    ["file matches ALL extracted concepts: escalation"]
evidence_against: []
unknown_facts:   []                          ← should have declared "cannot synthesize without aggregator"
recommended:     "top 3 candidates warrant closer inspection · confidence is GOOD but not HIGH"
```

Every substantive fact about the correction cycle behaviour is in `packet.source_inspections[]` (proven correct in Test K). Zero of those facts made it into `hypotheses[]` or `evidence_for[]`. The narrative talks about `surface.test.ts` and the concept token `escalation` — that's because the classifier's chosen top candidate was a tangential test file whose file-memory tag set matched the extracted concept `escalation`.

---

## L-Criteria Assessment

| Criterion | Result | Detail |
|---|---|---|
| **L1 · LOCATED** | ⚠ probe-quirk | Probe checks `candidate_files[]` (top-20 by score). wo9-corrector.ts is at rank >20 because its vocab-tag score is 0 · but Fix 7's `classifier_file_ref` override DOES place it in the source-inspection queue. L2 confirms actual inspection occurred. This is a probe measurement artefact, not a Fix-7 failure. |
| **L2 · READ** | ✓ | source_inspections[] contains an OK inspection of wo9-corrector.ts (11783 B) |
| **L3 · OBSERVED** | ✓ | multiple facts extracted (11 fns + 12 ifs + 29 returns + 40 strings) |
| **L4 · PROVENANCE** | ✓ | every fact has source_file + start_line + end_line |
| **L5 · SEPARATION** | ✓ | packet.source_inspections and packet.hypotheses are separate typed fields; no conflation |
| **L6 · SYNTHESIS** | ✗ | 0 source-fact tokens appear in hypotheses/evidence_for/evidence_against; the template heuristic emitted a tangential test file |
| **L7 · BEHAVIOURAL EXPLANATION** | ✗ | 0 of the 10 behaviour keywords (REQUIRES_NEW_CAPABILITY, specialist_unavailable, allFailuresAreMissingFile, etc.) appear in narrative fields |
| **L8 · NEG CONTROL** | ✓ | knowledge-store.ts absent from inspections; no misleading-neighbour attribution |
| **L9 · ZERO FABRICATION** | ✓ | 0 mismatches — every emitted fact verified against actual source at claimed lines |
| **L10 · CONFIDENCE** | ✓ | FLAG_FOR_REVIEW (0.84) — not inflated despite reading succeeded |

---

## Independent Verification (per §9)

Every fact NEX1 emitted was cross-checked against the actual file. The Test K-style verifier (window ±5 lines around claimed line, whitespace-normalised substring check) reports **0 fabrications** across all 5 inspected files.

Sample of verified facts in wo9-corrector.ts (excerpt of what actually landed in `source_inspections[]`):
- `functions`: `proposeCorrection` at line 67, `canContinueCorrection` at line 61, `initialCorrectionCycleState` at line 33, `advanceCycleState` at line 51, plus 7 internal helpers
- `if_branches`: `!canContinueCorrection(input.cycle_state)` at 73, `!input.diagnosis.has_failures` at 84, `allTransient && anyTransient` at 112, `allInPlan && allFailuresAreMissingFile` at 146
- `string_literals`: `MAX_ATTEMPTS_EXHAUSTED` at 77, `NO_RULE_MATCHES` at 88, `RETRY_TRANSIENT` at 113, `REINVOKE_PLAN_MISSING_FILES` (in evidence, near line 150), `specialist_unavailable` at 100

**All raw material for the correct answer is in `source_inspections[]`.** None of it reached the packet's narrative fields.

---

## Contamination Guard (per §7)

- No `source_inspection` record has a `source_file` derived from the problem statement (impossible by construction — that field is populated only by `path.relative(repo_root, abs_path)` after readFileSync).
- No hypothesis text contains a substring that came from the problem statement alone (guard passed).
- The behaviour keywords used by the L7 verifier are DERIVED from ground truth (kept in probe.ts as `code_literals_to_probe` equivalents), not from the problem statement — so failing to find them in the packet is a legitimate absence signal, not a probe-contamination artefact.

---

## Reasoning Path Used (per §17)

`NEX1_NATIVE`.

The runtime capability under test is fully NEX1-local: classifier → File Memory → dep-graph → source inspection → template hypothesis. No external model was invoked at any stage of the runtime path. External model (me · Claude) was used only for engineering assistance around the harness (probe design, verifier, this report). No prompt to any LLM produced the packet's hypotheses/evidence_for fields.

---

## A–L Regression

| Test | Pre-Test-L result | Post-Test-L result | Delta |
|---|---|---|---|
| A · Absence-of-token | CORRECT | CORRECT | none |
| B · Verb-vocab robustness | CORRECT | CORRECT | none |
| C · Present-token false-positive | CORRECT | CORRECT | none |
| D · Scope trap | CORRECT | CORRECT | none |
| E · Insufficient expectation | CORRECT_REFUSAL | CORRECT_REFUSAL | none |
| F · Multi-verb ambiguity | CORRECT | CORRECT | none |
| G · Cross-file navigation | CORRECT_BOTH_SURFACED | CORRECT_BOTH_SURFACED | none |
| H · Direct-edge 1-hop | CORRECT | CORRECT | none |
| I · Multi-hop | INCONCLUSIVE_1_HOP_VIA_ALT_ROUTE | INCONCLUSIVE_1_HOP_VIA_ALT_ROUTE | none |
| J · Source-reading (historical) | LOCATED_ONLY_NO_SOURCE_ANALYSIS | (unchanged per §11) | preserved |
| K · Source-level | SOURCE_LEVEL_RUNTIME_VERIFIED | SOURCE_LEVEL_RUNTIME_VERIFIED | none |
| **L · Source-explanation** | — | **SOURCE_READ_ONLY_NO_SYNTHESIS** | new |

- **Hallucinations: 0/12**
- **Unsafe modifications: 0/12**
- **Regressions: 0**

---

## Files Changed

**None.** Zero code changes were made for this diagnostic. Per §15: "The first Test L run must determine whether the current system already performs synthesis." The diagnostic itself is the test.

New files (test-only, disposable):
- `scripts/nex1-test-l/probe.ts`

Documentation:
- `docs/doctrine/nex1-test-l-source-explanation-2026-09-16.md` (this report)

Track A: **untouched**.

---

## Remaining Limitations (Test L defines them)

- **Fact aggregation is absent.** `source_inspections[]` sits in the packet unread by any narrative-generating code path.
- **Behavioural explanation is absent.** The packet has no `explanations[]` or `behaviour_narrative[]` field, and no code path that would populate one.
- **Chained observations are absent.** Even single-file "A leads to B leads to C" claims cannot be expressed; the packet has no shape for a chain of observed facts.
- **The template heuristic on `topCandidates[0].matched_concept_tags`** occupies the hypotheses slot even when a much richer source inspection exists. It should probably prefer source-fact-derived text when source_inspections is non-empty.
- **`unknown_facts[]` is under-declared.** When synthesis is impossible, the packet should honestly emit `"cannot synthesize behavioural explanation without source-fact aggregator"` rather than leaving unknown_facts empty. Currently it's silent.

None of these limitations were newly discovered by Fix 7. They are the natural next boundary the founder anticipated.

---

## Capability State

| Component | State | Evidence |
|---|---|---|
| Source reader (`capability-source-inspection.ts`) | **RUNTIME_VERIFIED** | Test K + Test L both confirm 0-fabrication reads |
| Action E · inspect_source_content | **RUNTIME_VERIFIED** | Fired 5× in Test L, all clean |
| Investigation Mode source wiring | **RUNTIME_VERIFIED** | Fix 7 wiring survives Test L run |
| Source-fact → behavioural-explanation synthesis | **NOT_FOUND** | Grep of code engine confirms zero consumer of source_inspections[] |
| Multi-fact chained observation | **NOT_FOUND** | Packet has no shape to carry chains |
| `explanations[]` or `behaviour_narrative[]` packet field | **NOT_FOUND** | Not in the type declaration |
| `PROVEN` evidence-kind emission | **DEFINED_ONLY** | Union has it; no code path emits it |

---

## Fix 8 · Source-Fact Synthesis · DESIGN PROPOSAL (not authorised · not built)

Presented as a design outline only. Do not build without founder authorisation.

### Sketch

```
Investigation Mode
    ↓ (existing) source_inspections[] populated
    ↓
NEW ACTION 7 · synthesise_observations
    ↓
capability-source-synthesis.ts · aggregateFactsIntoObservations({ inspections, target_concepts })
    ↓
- For each inspection: extract the {N} most relevant if-conditions + return literals + string literals
- Group by enclosing_function
- Emit ObservedChain[] records: [{file, function, observation_A_line, observation_B_line, ...}]
    ↓
InvestigationEvidencePacket.behaviour_observations[]
InvestigationEvidencePacket.unknown_but_derivable[]
```

### Scope (kept tight)
- Reads source_inspections[]. No new file reads.
- Emits ObservedChain records with strict provenance (each observation names file + line + verbatim text).
- Does NOT interpret behaviour. Does NOT synthesize a natural-language explanation.
- The "chain" is a structural grouping of adjacent observations within the same function body, not a semantic argument.
- Confidence: unchanged; a chain simply exists or doesn't.

### What it deliberately does NOT do
- No natural-language behavioural narrative (that would be Test M / Fix 9)
- No semantic inference over control flow
- No cross-file chains
- No LLM

### Test L' (hypothetical follow-up · not scheduled)
- Re-run same problem after Fix 8
- Expect: packet.behaviour_observations[] contains at least one ObservedChain with entries at lines 108, 141, 100, 166 in wo9-corrector.ts
- Chain grouping alone would be enough to answer the founder's Test L question via founder-level reading — because the answer emerges from the *ordered structural observations* even without semantic synthesis
- Fabrication verifier still applies: every ObservedChain entry cross-checked against actual source

### Why "structural chain" is a better next step than "semantic narrative"
- Deterministic — no interpretation risk
- Extends the honest OBSERVED/INFERRED taxonomy without ever emitting HYPOTHESIS or PROVEN inappropriately
- Testable via probe verifier
- Small (~200 LOC in one new file, plus wiring of an ACTION 7)
- Cannot fabricate policy meanings — it only rearranges observed facts

Test M (semantic behavioural narrative) would then become a genuinely separate boundary.

---

## Recommendation to Founder

**STOP after this report** — per your Test L STOP directive §21.

The next founder decision is one of these three:

1. **Authorise Fix 8 (structural fact-chain aggregation)**, then run Test L' to prove chained observation works. The safest next step. Small, deterministic, no interpretation.

2. **Design Test M (natural-language behavioural narrative) as a distinct test before considering any narrative code.** Establishes whether the founder wants NEX1 to *synthesize* explanations at all, or whether presenting an ObservedChain to a human reader is the intended endpoint.

3. **Pause Track B here.** L is a valuable boundary; catalog it and defer.

I recommend option 1 (Fix 8 · structural chains). It respects the founder's discipline that NEX1 should not fabricate behavioural claims — it just gives the human reader an easier-to-scan structural presentation of the raw observations already proven correct in Test K. It does not attempt to speak for the code.

**Freeze remains in force. No code changes. No commits. No push.**

---

## Final Truth Statement (per §20)

> **Can native NEX1 now take multiple real source observations, distinguish observation from inference, and synthesize those observations into a correct source-grounded explanation of software behaviour?**

**NO · CLEAN BOUNDARY**

Evidence: Test L classification `SOURCE_READ_ONLY_NO_SYNTHESIS`. `source_inspections[]` contains all the observations required (4/4 relevant facts extracted correctly at their exact source lines). `hypotheses[]` and `evidence_for[]` contain none of them and instead emit a template heuristic pointing to a tangential test file. Zero fabrication throughout. Confidence honest at 0.84 FLAG_FOR_REVIEW.

Source reading is proven. Source explanation is architecturally absent. Fix 8 (design proposed above) is the next candidate — but not authorised in this pass.
