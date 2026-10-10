# NEX1 Fix 9 · Evidence-to-Explanation Adapter

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation · Track A remains FROZEN)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

Fix 9 adds a deterministic evidence-to-explanation adapter — a bounded emitter that transforms verified `observed_chains[]` (Fix 8) into hard-templated structural statements with chain + file + line provenance. Every statement's `evidence_kind` is locked to `"OBSERVED"` at the TypeScript type level. Templates contain zero causal vocabulary by construction; runtime defence-in-depth check rejects any statement that would contain a forbidden causal token.

**Fix 9 verification:** `FIX9_VERIFIED` · 12/12 F9 criteria pass.

**Test M re-run — HONEST classification:** `PARTIAL_STRUCTURAL_NARRATIVE_NO_CAUSAL_SYNTHESIS` (§15 outcome B). The Fix 9 verification probe's post-Fix-9 M-classifier returned `M_PASS` — I am flagging that as a **classifier false green** per founder §19 discipline. The classifier's M6/M7/M8 checks are structural presence tests (token appears · file:line appears) that Fix 9 satisfies mechanically by re-stating source content. But the emitted narratives are *exactly* the "fact 1 → sentence 1 · fact 2 → sentence 2" pattern the founder called out in §16 as insufficient for genuine M pass. NEX1 does not connect the observations with any semantic relationship claim.

**Final truth statement:** Fix 9 built the bridge. NEX1 has not crossed it.

- Hallucinations: 0
- Unsafe modifications: 0
- Unexpected writes: 0
- External model calls in runtime path: 0
- A–M regression: 12/12 unchanged
- Production changes: YES (3 files · scoped to Fix 9)
- Track A: FROZEN

---

## Pre-Build Audit (Phase A · per §3)

Every existing capability was scanned for a chain-consumer that could produce provenance-tagged structural statements. None found.

| Component | Purpose | Consumes `observed_chains[]`? |
|---|---|---|
| `capability-source-inspection.ts` | Fact extractor | producer, not consumer |
| `capability-observed-chains.ts` | Chain aggregator | producer, not consumer |
| `native-investigation-actions.ts` | Action wrappers | no |
| `native-investigation-mode.ts` | Investigation orchestrator | passes-through, doesn't emit statements |
| `capability-i-test-synthesis.ts` | Test-case generator | no |
| `capability-i2-negative-proof.ts` | Negative-proof generator | no |
| `capability-j-runtime-diagnosis.ts` | Runtime failure parser | no |
| `capability-j2-cause-analysis.ts` | Repair proposer | no |
| `capability-k-local-value-dataflow.ts` | Structural repair proposer | no |
| `consequence-reasoner.ts` | tsc error → AST directive | no |

**Classification: gap is BUILD.** No existing consumer of chain output for narrative purposes. Founder §3 mandate satisfied: the new capability is minimally required; no existing primitive can be composed.

---

## Files Changed

| File | Change | LOC | Purpose |
|---|---|---|---|
| `src/lib/nex-agent/code-engine/capability-chain-narrative-emitter.ts` | **New** | ~330 | Deterministic adapter · hard-coded templates · forbidden-word runtime check |
| `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | Modified | +35 | ACTION 8 wiring · packet fields `chain_narratives` + `chain_narratives_note` · refusal-path plumbing |
| `scripts/nex1-fix9-verification/probe.ts` | **New** (test-only) | ~280 | F9.1-F9.12 verification + Test M re-run classifier + zero-fabrication + determinism |

**Track A untouched.** No changes to Ed25519, C6/G15, orchestrator wiring, verification connection, or any file under `nex-authority-broker/founder-authority`.

---

## What Fix 9 Does

**Public entry point:**
```ts
emitChainNarratives({ chains, max_narratives_per_chain?, max_narratives_total?, max_chains_processed? })
  → { ok: true, narratives: ChainNarrative[], stats: {...} }
```

**Output shape:**
```ts
interface ChainNarrative {
  chain_id: string;
  source_file: string;
  statement: string;
  evidence_kind: "OBSERVED";                          // type-locked · TS forbids upgrade
  supporting_fact_kinds: readonly [...][];
  provenance: readonly { source_file, start_line, end_line }[];
  template_id: "chain_summary" | "function_declaration" | "if_condition"
             | "return_statement" | "string_literal" | "import_statement";
}
```

**Six hard-coded templates**, each generating a factual re-statement of source content. No template contains any causal token by construction.

**Defence-in-depth check:** every emitted statement is scanned against a forbidden-token list (`therefore, because, causes, caused by, leads to, results in, implies, hence, so that, in order to, which means, this is why, the reason is, as a result, consequently`). Any match rejects the statement rather than emitting it. In this run: **0 rejections** — templates are causal-vocabulary-free as designed.

**Bounded output:** default 8 narratives per chain, 80 chains processed, 300 total. Refuses on missing provenance rather than fabricating.

**Deterministic:** two independent runs produce identical narrative statements (`chain_id + statement` sets match exactly).

---

## Wiring into Investigation Mode

ACTION 8 runs immediately after ACTION 7 (chain aggregation) and before ACTION 5 (absence analysis):

```
ACTION 6 · source inspection       → source_inspections[]
ACTION 7 · observed-chain build    → observed_chains[]
ACTION 8 · chain-narrative emit    → chain_narratives[]           (NEW)
ACTION 5 · absence-of-token        → absence_candidates[]
```

Two new packet fields:
```ts
readonly chain_narratives: readonly ChainNarrative[];
readonly chain_narratives_note: string;
```

**Founder discipline §16 respected:** `hypotheses[]` / `evidence_for[]` / `evidence_against[]` are **not touched** by Fix 9. Those remain the pre-Fix-7 template heuristic. Test M's original probe (which examines those fields) correctly still returns `CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS` in the A-M regression — because Fix 9 does not populate them. This is deliberate.

---

## Verification Result

| # | Criterion | Result | Detail |
|---|---|---|---|
| **F9.1** | INPUT | ✓ | 171 chains consumed from real runtime `observed_chains[]` |
| **F9.2** | OUTPUT | ✓ | 300 narratives emitted (hard-cap 300 hit) |
| **F9.3** | TARGET COVERAGE | ✓ | 8 narratives from proposeCorrection chain in target file |
| **F9.4** | MULTI-FACT REPRESENTATION | ✓ | 5 fact kinds present: chain_summary, function, if_condition, return_statement, string_literal |
| **F9.5** | PROVENANCE | ✓ | every narrative has non-empty provenance array with valid file + start_line ≤ end_line |
| **F9.6** | OBSERVED LOCK | ✓ | every `evidence_kind === "OBSERVED"` · TS type union locks this at compile time |
| **F9.7** | NO CAUSAL SYNTHESIS | ✓ | 0 forbidden-token hits across all 300 narratives |
| **F9.8** | ZERO FABRICATION | ✓ | every provenance record's line range within actual file bounds (60 sampled · 0 mismatches) |
| **F9.9** | NEGATIVE CONTROL | ✓ | 0 narratives from knowledge-store.ts |
| **F9.10** | DETERMINISM | ✓ | two independent runs → identical narrative sets (0 diff) |
| **F9.11** | NO EXTERNAL MODEL | ✓ | runtime path calls no LLM; emitter uses only local templates |
| **F9.12** | REGRESSION | ✓ | packet shape valid; A-M regression 12/12 unchanged |

**Overall: `FIX9_VERIFIED`.**

---

## Selection-order bug caught before shipping (recorded transparently)

The verification probe caught a bug in the emitter itself, forcing a correction before shipping:

**First run:** `FIX9_PARTIAL` due to F9.3 failure — 0 target-file narratives despite the target chain existing in `observed_chains[]`.

**Root cause:** the emitter sorted chains alphabetically by `chain_id` before capping at `max_chains_processed=40`. In this session's corpus, chain_ids from `__tests__/` paths sort before `wo9-corrector.ts` (ASCII `_`=95 < `w`=119), so the two large test-file chain sets consumed the entire 40-chain budget alphabetically. The founder-named target file's chains were never processed.

**Fix:** the emitter now preserves input order from `buildObservedChains`, which is itself deterministic and follows Fix 7's classifier_file_ref-first inspection ordering. Alphabetic re-sort would push `__tests__/` chains ahead of the founder-named target file. Cap raised from 40 chains / 200 total to 80 chains / 300 total. Determinism preserved because input order is deterministic by construction (Fix 8 stats confirm 0 chain_id diff between runs).

Second run: `FIX9_VERIFIED`. Recording this so a future re-run of the probe is understood.

---

## Test M Re-run · The Truthful Result

The Fix 9 verification probe includes a Test M re-classifier that examines `narrativeText = [hypotheses[], evidence_for[], evidence_against[], chain_narratives[].statement].join(...)` against M6/M7/M8. That classifier returned:

```
M_PASS
M6 hits: [proposeCorrection, canContinueCorrection, cycle_state,
          escalate_to_founder, MAX_ATTEMPTS_EXHAUSTED, diagnosis,
          has_failures, NO_RULE_MATCHES]
M7 hits: [specialist_unavailable, missing_target_file, escalate,
          escalation, returns, condition]
M8 file:line grounding: True
```

**I am flagging this as a classifier false green** per founder §19: "Optimize for a truthful result. A false green result is unacceptable."

**Why it is false:** the M6/M7/M8 classifier checks token presence and file:line presence. Fix 9 satisfies these mechanically because a re-statement of chain facts inevitably includes those tokens and provenance markers. The founder was crystal clear on this in §16:

> "If Fix 9 merely does: fact 1 → sentence 1 · fact 2 → sentence 2 · fact 3 → sentence 3 · then M remains incomplete."

That is exactly what Fix 9 emits. Sample from actual run:

```
1. "In wo9-corrector.ts, a chain grouped by enclosing function `proposeCorrection`
    contains 26 observed facts spanning lines 67-175 (1 function · 5 if_conditions
    · ... · 1 return_statement)."

2. "In src/lib/nex1-orchestrator/wo9-corrector.ts, function `proposeCorrection` is
    declared at lines 67-178."

3. "In src/lib/nex1-orchestrator/wo9-corrector.ts at lines 73-73, within
    `proposeCorrection`, an if-statement tests the condition
    `!canContinueCorrection(input.cycle_state)`."

4. "In src/lib/nex1-orchestrator/wo9-corrector.ts at lines 74-80, within
    `proposeCorrection`, a return statement returns
    `{ok: false, kind: escalate_to_founder, escalation_reason: MAX_ATTEMPTS...`"

5. "In src/lib/nex1-orchestrator/wo9-corrector.ts at line 77, within
    `proposeCorrection`, the string literal `MAX_ATTEMPTS_EXHAUSTED` appears."
```

Each sentence is a **structural re-statement** of a single fact. Not one sentence says "*when specialist_unavailable is present, rule 2's every() filter returns false at line 141, so rule 2 does not fire.*" That semantic relationship claim is what genuine M-pass requires. Fix 9 does not emit it. A human reader looking at these five sentences can conclude the cascade — but NEX1 has not done the connecting; the reader has.

**Honest Test-M-after-Fix-9 classification (§15 outcome B):**
```
PARTIAL_STRUCTURAL_NARRATIVE_NO_CAUSAL_SYNTHESIS
```

The standalone Test M probe (its classifier only looks at `hypotheses[]` / `evidence_for[]`, not `chain_narratives[]`) continues to return `CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS` in the regression. That is also honest — those legacy fields still emit the pre-Fix-7 template heuristic. Both classifiers are inadequate for genuine synthesis measurement; neither is dishonest about what it checks. But the truthful Test M state after Fix 9 is B, not A.

---

## A–M Regression

| Test | Pre-Fix-9 | Post-Fix-9 | Delta |
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
| M · Source-explanation diagnostic (original classifier) | CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS | CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS | none · legacy classifier doesn't see new field · truthful state is B not A |
| Fix 8 verification | FIX8_VERIFIED | FIX8_VERIFIED | none |

- **Hallucinations: 0/13**
- **Unsafe modifications: 0/13**
- **Regressions: 0**
- **Unexpected writes: 0**
- **External model calls in runtime path: 0**

---

## FIX 9 RESULT (per §20 format)

```
Classification:
FIX9_VERIFIED

F9.1 INPUT:                     ✓ (171 chains consumed)
F9.2 OUTPUT:                    ✓ (300 narratives)
F9.3 TARGET COVERAGE:           ✓ (8 narratives for proposeCorrection chain)
F9.4 MULTI-FACT REPRESENTATION: ✓ (5 fact kinds)
F9.5 PROVENANCE:                ✓ (100% narratives have valid provenance)
F9.6 OBSERVED LOCK:             ✓ (evidence_kind literal-typed)
F9.7 NO CAUSAL SYNTHESIS:       ✓ (0 forbidden-token hits)
F9.8 ZERO FABRICATION:          ✓ (0 mismatches, 60 sampled)
F9.9 NEGATIVE CONTROL:          ✓ (0 neg-control narratives)
F9.10 DETERMINISM:              ✓ (identical runs)
F9.11 EXTERNAL MODEL:           ✓ NONE
F9.12 REGRESSION:               ✓ 12/12 unchanged

Production changes:             YES (3 files, scoped)
Hallucinations:                 0
Unsafe modifications:           0
Unexpected writes:              0
External model calls:           0
A–M regression:                 12/12
Test M after Fix 9 (truthful):  PARTIAL_STRUCTURAL_NARRATIVE_NO_CAUSAL_SYNTHESIS
Track A:                        FROZEN
```

---

## Final Truth Statement

> **Fix 9 built the truthful, provenance-preserved bridge from verified evidence chains to structural statements.**
>
> **NEX1 has not yet crossed the bridge.** The narratives are deterministic re-statements of source content. NEX1 does not connect them into a causal explanation. Test M's synthesis remains architecturally absent · classifier false-green on token presence · genuine result is `PARTIAL_STRUCTURAL_NARRATIVE_NO_CAUSAL_SYNTHESIS`.

Per founder §22: "Fix 9 must make the evidence easier to consume without pretending that NEX1 understands the meaning of the evidence yet. Build the bridge. Do not cross it early." — bridge built · not crossed.

---

## Next Architectural Boundary

Same as anticipated in Test M report: **causal inference over chain narratives.**

The natural progression:
- 🟢 K · READ (Fix 7)
- 🟢 Fix 8 · EVIDENCE STRUCTURING
- 🟢 Fix 9 · STRUCTURAL RE-STATEMENT
- 🔴 M / N · CAUSAL SYNTHESIS (unresolved boundary)
- ⚪ O · CHANGE PLAN
- ⚪ P · AUTHORISED MODIFICATION

The gap between what Fix 9 emits and what M-pass requires is a **relationship inference** step — determining that "condition at line 141 gates return at line 149 by control-flow" and "escalation_reason at line 166 depends on anySpecialistUnavailable at line 100." Both are inferable *structurally* (line-adjacency + enclosing-function ordering + variable reference tracking) without natural-language cleverness. A future capability could compute these relationships deterministically over `observed_chains[]` — but that is **Test N territory** (structural causal inference) and requires a separate founder authorization.

**No Fix 10 proposed in this report.** Founder must decide whether next step is:
1. Test N · structural causal inference · design + diagnostic first
2. Skip N · accept Fix 9 as the presentation endpoint · a human reader consumes chain_narratives
3. Alternative path · e.g. root-cause reasoning over a specific failure pattern (rejoins J/J.2 territory)

---

## Founder-Rule Compliance

- §14 · "may describe what the source says · may not explain why" · **enforced in templates + runtime check**
- §16 · "Do not declare Test M passed merely because Fix 9 generates English sentences" · **explicitly complied with · flagged classifier false-green**
- §19 · "Optimize for a truthful result · A false green result is unacceptable" · **complied with · reported honest B not classifier's A**
- §22 · "Give NEX1 a truthful, provenance-preserved bridge · Build the bridge. Do not cross it early" · **complied with · bridge built, uncrossed**

**Freeze remains in force. No code changes beyond Fix 9. No commits. No push. Track A untouched.**
