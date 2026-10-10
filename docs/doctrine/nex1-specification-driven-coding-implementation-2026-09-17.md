# NEX1 · Specification-Driven Coding Capability · Implementation Report

**Author:** master_ai_engineer
**Date:** 2026-09-17
**Authorised by:** founder (Specification-Driven Coding Capability Implementation Prompt · 2026-09-17)
**Discipline:** zero-LLM · deterministic · zero fabrication · zero manufactured failure · zero hardcoded Test-5 solution
**Status:** SHIPPED (capability) · Test 5 verdict: `SPECIFICATION_INSUFFICIENT` (honest)

---

## §1 · Executive summary

The Specification-Driven Coding Decision Audit (`docs/doctrine/nex1-specification-driven-coding-decision-audit-2026-09-17.md`) established that NEX1's programming loop is architecturally **failure-driven** — REASON's only input contract is vitest textual output via `extractRuntimeFailures`, and no native component converts founder prose into a verifiable expected assertion.

This implementation authorised by the founder builds the smallest general-purpose native bridge that connects:

```
FOUNDER PROBLEM  →  UNDERSTAND (prose)
                 →  EXTRACT (deterministic regex · zero LLM)
                 →  GENERATE VERIFICATION CASES (source-inspection composition · zero LLM)
                 →  WRITE spec-derived .test.ts (ephemeral · not committed)
                 →  invoke existing runNativeProgrammingLoop
                 →  INSPECT · REASON · PLAN · CHANGE · TEST · VERIFY (unchanged)
                 →  cleanup ephemeral artifact
```

**Outcome on Test 5 (founder-verbatim prose, target pricing.ts):**
Overall verdict `SPECIFICATION_INSUFFICIENT`. The founder's prose ("Some customers are receiving an incorrect total when the quantity is zero…") is a **case-only** description — it names the failing case ("quantity is zero") but never states the correct total. Without LLM inference the extractor cannot invent an expected value that is not in the prose. This is the correct honest boundary per §5 of the authorization prompt (*"INSUFFICIENT_SPECIFICATION is preferable to guessing"*).

`src/lib/nex-shop/pricing.ts` SHA-256[0:16] before and after run: `150158baa3b0274a` → `150158baa3b0274a` (identical · zero modification · absence-of-modification invariant preserved).

---

## §2 · What was built

Three new capability files, one API-free wrapper, one component verifier, one Test 5 proof runner:

| File | LOC | Purpose |
|---|---|---|
| `src/lib/nex-agent/code-engine/capability-specification-extractor.ts` | ~230 | Regex-based prose → `ExpectedBehaviour[]` · deterministic · zero LLM |
| `src/lib/nex-agent/code-engine/capability-verification-case-generator.ts` | ~340 | `ExpectedBehaviour[]` + target file → `VerificationCase[]` · reuses `inspectFileSource` · zero LLM |
| `src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts` | ~320 | Composition wrapper · writes ephemeral spec-derived test · invokes `runNativeProgrammingLoop` · cleans up |
| `scripts/nex1-spec-driven-verification/probe.ts` | ~110 | 24-assertion component verifier |
| `scripts/nex1-spec-driven-verification/test5-spec-driven-proof.ts` | ~180 | Founder-verbatim Test 5 proof · pre+post SHA snapshots · receipt writer |

**No modifications** were made to:

- `native-programming-loop.ts` (existing failure-driven engine · reused untouched)
- `native-investigation-mode.ts` (Fix 15/16/17/18/19 · untouched)
- `capability-source-inspection.ts` (reused via import · untouched)
- `capability-j-runtime-diagnosis.ts` (REASON's failure-extraction contract preserved)
- `pricing.ts` · `pricing.test.ts` (Test 5 target · untouched · SHA-256 identical)
- All authorization gates (still in place)
- Fix 7 through Fix 19 · Q7 · Q8 · GAP 5 · Track A · nex-debugger (all preserved)

---

## §3 · Extractor design (`capability-specification-extractor.ts`)

### §3.1 · Deterministic pattern registry

Eight ordered regex patterns matching common English coding-requirement forms. Every pattern is domain-agnostic — no reference to pricing / quantity / staircase / any business term:

| ID | Pattern (English) | Assertion form | Base confidence |
|---|---|---|---|
| P1 | *"When [X] is [Y], [Z] should be [W]"* | explicit | high |
| P2 | *"When [X] is [Y], [Z] must be [W]"* | explicit | high |
| P3 | *"When [X] is [Y], [Z] should return [W]"* | explicit | high |
| P4 | *"For [X] = [Y], expect [Z] = [W]"* | explicit | high |
| P5 | *"[Z] should be [W] when [X] is [Y]"* (post-position) | explicit | high |
| P6 | *"When [X] is [Y], [Z] must be rejected/denied/refused"* | explicit | high |
| P7 | *"receiving an incorrect [Z] when [X] is [Y]"* | **case_only** | **insufficient** |
| P8 | *"[Z] must not throw"* | explicit | medium |

### §3.2 · Canonical value normalization

Language-level (NOT domain-level) canonical mappings applied to extracted values:

- Number words → digits (zero → 0 · five → 5 · ten → 10)
- Empty synonyms → `[]` (empty)
- Nullish synonyms → literal (`null` · `undefined`)
- Boolean synonyms → `true` / `false`
- Otherwise: verbatim (never invented)

### §3.3 · Confidence policy

- `high` ⇔ P1-P6 or P8 matched WITH subject + condition + expected all captured
- `medium` ⇔ explicit pattern matched but a component (typically outcome_subject) missing
- `insufficient` ⇔ P7 matched (case-only, no explicit expected)

### §3.4 · Refusal semantics

- Input truncated at 20,000 chars · noted in `stats.capped_by`
- Match cap: 50 total behaviours · 20 per pattern
- Never fabricates a subject, condition, or expected · every field is a verbatim slice or null
- `classifyExtraction(result)` collapses to one of:
  - `SPECIFICATION_HIGH_CONFIDENCE`
  - `SPECIFICATION_PARTIAL`
  - `SPECIFICATION_INSUFFICIENT`

---

## §4 · Verification-Case Generator design (`capability-verification-case-generator.ts`)

### §4.1 · Inputs

`ExtractSpecificationResult` + `target_source_file` (repo-relative or absolute) + `repo_root`.

### §4.2 · Structural matching · zero synonym engine

1. Invokes existing `inspectFileSource(target)` to obtain `SourceFunctionRecord[]`
2. Filters to `exported && named` functions
3. For each `ExpectedBehaviour` with `assertion_form === "explicit"` AND `expected_value !== null`:
   a. `findFunctionCandidates(functions, subject)`:
      - Priority 1: function whose **name** contains subject (case-insensitive substring)
      - Priority 2: function whose **parameter names** contain subject
      - Fallback: single exported function only when nothing else matched
   b. `findParamIndexBySubject(fn.param_names, subject)` — deterministic slot resolution
   c. Composes `<fnName>(<args>)` with `defaultValueForParam` for unmatched slots (language-level heuristics: arrays → `[]` · maps → `new Map()` · booleans → `true` · numeric → `1` — no domain vocabulary)
   d. `formatMatcher(expected_value)` chooses vitest matcher deterministically: `toBe` · `toEqual` · `toBeNull` · `toBeUndefined` · `toThrow`
   e. Emits `VerificationCase` with `test_code_block` = full `it(…) => { … expect(…).toX(…); }`

### §4.3 · Refusal semantics

- `refused_source_inspection_failed` when target file cannot be parsed
- `refused_no_exported_functions` when zero named exports
- `refused_no_subject_match` when subject noun matches no function name / parameter
- `refused_expected_value_missing` when behaviour is case-only or expected is null

### §4.4 · Composed test-file text

`composeTestFileText(...)` deterministically produces a valid vitest module:
- `import { describe, it, expect } from "vitest";`
- `import { <unique-fn-names> } from "<computed-specifier>";`
- One `describe(...)` per composition, containing every generated `it(...)` block

---

## §5 · Specification-Driven Loop Wrapper (`capability-specification-driven-loop.ts`)

### §5.1 · Public entry

```typescript
async runSpecificationDrivenCodingLoop({
  founder_goal: string,
  target_source_file: string,
  repo_root: string,
  test_timeout_ms?: number,
  keep_artifact?: boolean,   // default false
}): Promise<SpecificationDrivenLoopResult>
```

### §5.2 · Phased flow

| Phase | Action | Refusal exit |
|---|---|---|
| A | `extractSpecification(founder_goal)` + `classifyExtraction(...)` | `SPECIFICATION_INSUFFICIENT` when no explicit high/medium behaviours |
| B | `generateVerificationCases(...)` on target | `NO_VERIFIABLE_CASES` when refused or zero cases |
| C | Path-safety check (must be within repo root) + `fs.writeFileSync` of spec-derived `.test.ts` | `WRITE_REFUSED` on write error |
| D | Invoke `runNativeProgrammingLoop({ target_test_file: <spec-derived> })` — the existing REASON→PLAN→CHANGE→TEST→VERIFY chain runs unmodified | verdict extracted from `loopResult.overall_verdict` |
| E | Cleanup: `fs.unlinkSync` ephemeral spec-derived test file (unless `keep_artifact=true`) | non-fatal |

### §5.3 · Overall verdicts

- `CODING_LOOP_RUNTIME_VERIFIED` ⇔ `loopResult.overall_verdict === "VERIFIED"`
- `CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED` ⇔ CHANGE stage verified but overall not
- `CODING_LOOP_NOT_YET_RUNTIME_VERIFIED` ⇔ loop ran but did not reach VERIFIED / CHANGE
- `SPECIFICATION_INSUFFICIENT` · `NO_VERIFIABLE_CASES` · `WRITE_REFUSED` · `EARLY_EXIT_TARGET_MISSING` (deterministic refusals)

### §5.4 · Ephemeral artifact discipline

- Written path: `<targetDir>/<basename>.spec-derived.test.ts`
- Path-safety-checked before write (must be inside `repo_root`)
- **NOT** a checked-in file · **NOT** a modification of any existing test · **NOT** a source-code edit
- Deleted after loop terminates (unless `keep_artifact=true` for debug)
- Test 5 proof confirmed cleanup: `ephemeral_artifact_cleaned=true`

---

## §6 · Component verifier · 24/24 PASS

`scripts/nex1-spec-driven-verification/probe.ts` runs six sections of assertions covering:

- **Section A** · Pattern registry + normalization primitives (8 checks)
- **Section B** · Well-formed prose → high-confidence explicit extraction (7 checks)
- **Section C** · Case-only prose → INSUFFICIENT verdict (4 checks)
- **Section D** · Generator refuses cleanly when target missing (2 checks)
- **Section E** · Empty compose emits skip block (2 checks)
- **Section F** · Deterministic ordering across repeated calls (1 check)

Result: `PASS=24 · FAIL=0 · TOTAL=24`.

---

## §7 · Test 5 proof · founder-verbatim prose

### §7.1 · Founder problem verbatim

*"The pricing utility at src/lib/nex-shop/pricing.ts calculates a staircase component price from quantity and unit price. Some customers are receiving an incorrect total when the quantity is zero or when quantity is supplied as a numeric string. Investigate the implementation, identify the actual cause, fix it properly without breaking existing behaviour, and verify the correction with real tests."*

### §7.2 · Runtime outcome

```
overall_verdict: SPECIFICATION_INSUFFICIENT
extraction: SPECIFICATION_INSUFFICIENT · behaviours=1
generation: cases=0 refused=0
rationale: Extraction found 1 clauses; 0 explicit / 1 case-only.
  No high/medium-confidence explicit expected values → cannot generate verification cases.
```

### §7.3 · Why this is CORRECT

The extractor matched pattern P7 (*"receiving an incorrect [outcome] when [subject] is [condition]"*) which is explicitly classified as `case_only` and `insufficient` because such prose describes the failing case but never states the correct value. A deterministic parser without LLM cannot invent an expected value that is not literally stated in the prose. Doing so would violate the founder's authorization rules §5 (*"INSUFFICIENT_SPECIFICATION is preferable to guessing"*) and §14 (*"No manufactured failure"*).

### §7.4 · Absence-of-modification proofs

| File | Pre SHA-256[0:16] | Post SHA-256[0:16] | Changed |
|---|---|---|---|
| `src/lib/nex-shop/pricing.ts` | `150158baa3b0274a` | `150158baa3b0274a` | **no** |
| `src/lib/nex-shop/pricing.test.ts` | `3969a3efc2c12f39` | `3969a3efc2c12f39` | **no** |
| Ephemeral spec-derived test artifact | — | — | **cleaned up** |

Zero source modifications · zero test modifications · zero committed artifacts.

### §7.5 · Receipt

Full JSON receipt: `data/nex1-coding-capability-test/specification-driven-coding-2026-09-17.json` (schema `nex1.specification_driven_coding.receipt.v1`).

---

## §8 · Capability boundary · what this capability can and cannot do

### §8.1 · CAN

- Convert well-formed English coding requirements ("When qty is 0, total should be 0.") into real vitest test blocks
- Route those blocks through the existing REASON→PLAN→CHANGE→TEST→VERIFY chain unchanged
- Refuse deterministically and explicitly when prose is under-specified
- Preserve absence-of-modification when refused

### §8.2 · CANNOT (honest boundary · deferred to future authorization)

- Infer expected values from bug descriptions that name only the failing case (Test 5's prose shape)
- Resolve subject-noun vocabulary mismatches (e.g., "quantity" in prose vs. "qty" in code) — same architectural boundary as GAP 5, deliberately not reopened here
- Parse cross-sentence coreference ("For X, expect this. For Y, expect that. When X, do the first.")
- Semantic domain reasoning ("incorrect total for a zero-quantity purchase" → implied domain convention: `0 * anything = 0`) — this requires either an LLM or explicit codified conventions the founder has not yet authorised

### §8.3 · Why the boundary is honest, not a defect

The founder's authorization prompt §5 explicitly permits:
> *"If it cannot safely convert a statement: INSUFFICIENT_SPECIFICATION is preferable to guessing. The capability boundary must be honest."*

Test 5's outcome demonstrates exactly this discipline. No fake CHANGE stage ran. No fake pricing.ts modification. The receipt truthfully reports the reason. This is the founder-desired diagnostic outcome — not another passing test but a clean identification of a specific structural boundary.

---

## §9 · Invariants preserved

| Invariant | Status |
|---|---|
| Zero LLM (grep confirms no `openai` · `anthropic` · `claude` calls in new files) | preserved |
| Zero fabrication (no invented expected values) | preserved |
| Zero manufactured failure (no synthetic vitest output injected into REASON) | preserved |
| Zero hardcoded Test-5 solution (no `staircase` / `quantity===0` / `computeQuantityPricing` in new files) | preserved · grep-verified |
| Authorization gates intact (DISCOVERY ≠ AUTHORIZATION ≠ MODIFICATION ≠ EXECUTION ≠ VERIFICATION) | preserved · new capability is DISCOVERY + composition only |
| Absence-of-modification enforced when spec is insufficient | preserved · pricing.ts SHA-256 identical |
| Fix 7-19 · Q7 · Q8 · GAP 5 · Track A · nex-debugger untouched | preserved · zero edits to any of these files |
| REASON's failure-extraction contract preserved | preserved · new capability writes real .test.ts consumed by existing vitest path |
| Zero-LLM ledger consistent (Capability_M / Capability_M-1 pattern) | preserved · new capability declares `zero_llm: true` |

Grep verification that no Test-5-specific token appears in the new capability files:

```
$ grep -rE "staircase|quantity===0|computeQuantityPricing|pricing" src/lib/nex-agent/code-engine/capability-specification-*.ts
(no matches)
```

---

## §10 · How to invoke

```typescript
import { runSpecificationDrivenCodingLoop } from "src/lib/nex-agent/code-engine/capability-specification-driven-loop";

const result = await runSpecificationDrivenCodingLoop({
  founder_goal: "When retryCount is 0, backoffMs should be 100.",
  target_source_file: "src/lib/backoff/compute.ts",
  repo_root: process.cwd(),
});

console.log(result.overall_verdict);
// One of: CODING_LOOP_RUNTIME_VERIFIED
//       | CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED
//       | CODING_LOOP_NOT_YET_RUNTIME_VERIFIED
//       | SPECIFICATION_INSUFFICIENT
//       | NO_VERIFIABLE_CASES
//       | WRITE_REFUSED
//       | EARLY_EXIT_TARGET_MISSING
```

No API endpoint has been added in this Fix. The capability is a library function invocable by future orchestration or by a founder-authorised API wrapper. Adding a POST endpoint is an explicit follow-up decision the founder has not yet authorised.

---

## §11 · Deferred · not authorised in this Fix

- API endpoint (`POST /api/nex1/spec-driven/run`)
- Cross-sentence coreference
- Domain-convention codification ("accumulator functions return 0 when their scale parameter is 0")
- LLM-based fallback for INSUFFICIENT prose
- Vocabulary alignment (GAP 5 · known boundary · NO_FIX_REQUIRED as of 2026-09-16)
- Persistent record of spec-driven runs (analogous to `investigation-conclusion-store.ts` from Fix 17)
- CI integration

---

## §12 · Files changed / added

**Added:**
- `src/lib/nex-agent/code-engine/capability-specification-extractor.ts` (new · 230 LOC)
- `src/lib/nex-agent/code-engine/capability-verification-case-generator.ts` (new · 340 LOC)
- `src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts` (new · 320 LOC)
- `scripts/nex1-spec-driven-verification/probe.ts` (new · 110 LOC · 24/24 PASS)
- `scripts/nex1-spec-driven-verification/test5-spec-driven-proof.ts` (new · 180 LOC)
- `data/nex1-coding-capability-test/specification-driven-coding-2026-09-17.json` (new · receipt)
- `docs/doctrine/nex1-specification-driven-coding-implementation-2026-09-17.md` (this file)

**Modified:** none

**Removed:** none

---

## §13 · Honest verdict

**Capability status:** SHIPPED · component-verified (24/24) · zero LLM · zero fabrication
**Test 5 verdict:** `SPECIFICATION_INSUFFICIENT` (correct honest boundary)
**pricing.ts:** UNCHANGED (SHA-256[0:16] = `150158baa3b0274a` before and after)
**Coding-loop runtime verification on Test 5:** `NOT_YET_RUNTIME_VERIFIED_FOR_UNDER_SPECIFIED_PROSE`

The specification-driven capability is architecturally in place. To exercise the full REASON→PLAN→CHANGE→TEST→VERIFY chain end-to-end via this bridge, either:

- (a) the founder supplies a well-formed variant of Test 5's prose (e.g., adding explicit expected values), OR
- (b) a future authorised Fix expands the extractor with domain-convention codification, OR
- (c) a future authorised Fix wires a scoped LLM-adapter as a soft-fallback (would violate the current zero-LLM invariant).

Awaiting explicit founder direction before pursuing any of the above.

---

**End of report.**
