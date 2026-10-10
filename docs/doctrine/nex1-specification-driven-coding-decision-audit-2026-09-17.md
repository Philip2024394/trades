# NEX1 · Specification-Driven Coding Decision Audit · Truth-Only Report

**Date:** 2026-09-17
**Task type:** AUDIT + DECISION-PREPARATION ONLY · no implementation · no fixes
**External LLM at runtime:** NONE
**Files modified:** 0
**Programming loop / beacon / pricing.ts / test file / architecture:** UNCHANGED · byte-identical

Evidence receipt: `data/nex1-spec-driven-audit/audit-2026-09-17.json` (to be emitted as JSON of key findings if founder requests · this doctrine document is the primary deliverable)

---

## 1 · Current Verified Capability (from Test 5)

Test 5 exercised the programming loop against a founder-supplied target (`pricing.ts` + `pricing.test.ts`) with real vitest execution. Runtime evidence:

```
Stage                Verdict     Actual behaviour
UNDERSTAND           VERIFIED    target file identified
INSPECT              VERIFIED    real vitest ran · 27/27 passed
REASON               SKIPPED     "baseline vitest passed · nothing to diagnose"
PLAN                 SKIPPED     "no failures · nothing to plan"
CHANGE               SKIPPED     "no failures · nothing to change"
TEST                 SKIPPED     "already covered by baseline"
DIAGNOSE             SKIPPED     "no failures · nothing to diagnose"
REPAIR               SKIPPED     "no failures · nothing to repair"
VERIFY               SKIPPED     "already verified by baseline"
LEARN                VERIFIED    "no learning required · target test already passes"
overall_verdict      "VERIFIED"  (means: nothing to fix · not: coding capability verified)
```

`pricing.ts` byte-identical before and after · SHA-256 `150158baa3b0274a` unchanged · zero customer code modified.

## 2 · Failure-Driven Capability

**Status: SUPPORTED · runtime evidence PARTIAL.**

Source evidence (native-programming-loop.ts):

- **Lines 224-249** · STAGE 2 INSPECT calls `runVitest(target_test_file, ...)` returning `TestRunResult` with `failing_tests: string[]` + `stdout_tail: string`
- **Lines 252-281** · **early-exit gate**: `if (baselineRun.ok) { /* SKIP all downstream · overallVerdict: "VERIFIED" */ }`. When vitest exits 0 (all pass), REASON never runs
- **Lines 283-329** · STAGE 3 REASON: `extractRuntimeFailures(preprocessed_vitest_stdout)` produces structured `Nex1RuntimeFailureFinding[]`
- **Line 296** · REASON's ONLY input is `rawVitestOutput: string` from a real vitest invocation

The architecture supports failure-driven repair IF a real failing test exists at baseline. What has NOT yet been runtime-verified end-to-end:
- REASON → PLAN → CHANGE → TEST → VERIFY sequence has never executed in any of Tests 1-5 because no test scenario ever produced a real baseline failure
- The theoretical architecture is complete · the runtime evidence for a full RED-GREEN transition is absent

**Runtime evidence supporting SUPPORTED:**
- Stages 1-2 executed and returned meaningful data (Test 5)
- Stage 3 (REASON) source shows correct wiring to `extractRuntimeFailures` at capability-j-runtime-diagnosis.ts
- Stages 3-9 have real implementations · not stubs

**Runtime evidence supporting PARTIAL:**
- The RED→GREEN transition has never been observed end-to-end in this session's tests
- REASON's refusal classes ("empty_output", "no_test_ran", "malformed_output", "vitest_infrastructure_error", "permission_error") never accept anything except vitest output · runtime-tested absence-of-baseline path only · presence-of-baseline path unverified

**Truthful classification: `PARTIALLY_SUPPORTED`** — the code exists · but its full runtime chain (REASON→CHANGE→VERIFY on a real failing test) has NOT been observed in these tests.

## 3 · Specification-Driven Capability

**Status: `NOT_IMPLEMENTED`.**

Source evidence:

- Grep for `specification|spec_to_test|acceptance_criteria|expected_behaviour|expected_behavior|from_spec|prose_to_test` in `src/lib/nex-agent/code-engine`: **3 files matched**, none of which convert prose into assertions:
  - `capability-a-founder-intent/vocabulary.ts` · classifier vocabulary (unrelated to test generation)
  - `capability-a-founder-intent/__tests__/coding-vocabulary-v4.test.ts` · a test for the classifier (unrelated)
  - `capability-j2-cause-analysis.ts` · failure-based cause analysis (does NOT read specifications)
- No capability converts `founder_goal: string` (natural-language spec) into assertions, expected values, test cases, or verification criteria
- No capability generates NEW failing tests from a founder problem description
- No capability detects "specification says X · implementation does Y" and produces a beacon signal
- `Nex1RuntimeFailureFinding` (capability-j-runtime-diagnosis.ts:36-49) is TEST-EXECUTION-derived · its `expected`/`actual` fields come from vitest assertion output · not from the founder's prose

**The system contains ZERO components that convert `founder_goal` prose into REASON-consumable evidence.**

Runtime evidence (Test 5): the loop received the full founder problem statement as `founder_goal` and produced NO derived assertions · NO derived expected behaviour · NO derived acceptance criteria. Only the file:line reference was extracted (by regex in UNDERSTAND stage). The remainder of the prose is discarded before REASON sees anything.

**Classification: `NOT_IMPLEMENTED`.**

## 4 · Beacon Result

The founder's "beacon" is not a discrete named component in NEX1's source. Grep for `beacon|Beacon|BEACON` in `src/lib/nex-agent`: **0 files matched.**

Interpreting the founder's usage architecturally: the "beacon" is the trigger event that causes REASON to receive actionable evidence. In the current implementation, that trigger is:

```
baselineRun.ok === false     (equivalently: vitest exit code non-zero)
```

which fires at `native-programming-loop.ts:252` and routes execution into the REASON stage (line 283).

**In Test 5:**
- `baselineRun.ok === true` (vitest exit 0 · 27 passed)
- Therefore the early-exit branch (lines 252-281) fired
- REASON was correctly and deliberately SKIPPED
- This is by-design behaviour

**Answer per the founder's classification options:**

## `BEACON_NOT_EXPECTED`

Rationale: the founder's specification (quantity=0 → total=0) is not encoded as a failing test in the current suite. The system's beacon fires on `baselineRun.ok === false`. All 27 baseline tests pass. Therefore the beacon correctly did NOT fire. There is no wiring defect · no missing connection · no bug. The architecture is behaving exactly as designed.

There is no `BEACON_WIRING_DEFECT` because there is no separate spec-driven beacon to be wired. The current architecture has ONE beacon (`baselineRun.ok === false`), and it is wired correctly.

## 5 · Exact Boundary

The precise stage where `FOUNDER SPECIFICATION` fails to become actionable coding evidence:

```
                                        founder_goal: string
                                                    │
                                                    ▼
        native-programming-loop.ts · STAGE 1 UNDERSTAND
                                                    │
                                                    ▼
                        regex: /([\w/.\-@]+\.[jt]sx?)(?::(\d+))?/g
                                                    │
                                                    ▼
                          target_test_file: string   ◄── ONLY THIS survives the goal
                                                    │
                                                    ▼
                                    (rest of prose is discarded)
                                                    │
                                                    ▼
                        native-programming-loop.ts · STAGE 2 INSPECT
                                                    │
                                                    ▼
                                    runVitest(target_test_file)
                                                    │
                                                    ▼
                             TestRunResult (based on existing tests only)
                                                    │
                                                    ▼
                                        baselineRun.ok?
                                                    │
                                     ┌─────────────┴─────────────┐
                                    yes                            no
                                     │                              │
                                     ▼                              ▼
                            EARLY EXIT · SKIP ALL              STAGE 3 REASON
                            downstream stages               extractRuntimeFailures()
                                                                    │
                                                                    ▼
                                                            Nex1RuntimeFailureFinding[]
```

**The founder's prose specification loses information at UNDERSTAND stage.** Only the file reference (extracted by regex) survives. Every noun, verb, expected behaviour, and case description in the prose is discarded. There is no capability that translates `"customers are receiving an incorrect total when quantity is zero"` into an assertion the pipeline can act on.

## 6 · Architectural Distinction (Definitive)

The current system is:

## **`FAILURE-DRIVEN`**

Evidence:
- REASON's ONLY input source is vitest stdout (line 287 of native-programming-loop.ts)
- REASON's refusal classes are all vitest-execution-related (empty_output · no_test_ran · malformed_output · vitest_infrastructure_error · permission_error) — none accept a spec description
- All downstream stages consume REASON's output; they never re-read `founder_goal`
- `founder_goal` is preserved in the loop's result for reporting, but does not flow into REASON/PLAN/CHANGE

The current system does **NOT** support:

## **`SPECIFICATION-DRIVEN`**

To support specification-driven coding, NEX1 would need at least one of:

1. A capability that transforms `founder_goal` prose into `Nex1RuntimeFailureFinding`-shaped evidence (bypasses vitest)
2. A capability that generates new failing tests from the specification (populates the test suite so REASON can detect the failure via existing vitest path)
3. A capability that inspects source and compares against parsed specification (produces a "specification violation" evidence type)

None of these exist. All require substantial deliberate architectural additions.

## 7 · Founder Decision Required

Founder must decide one of the following. **Claude does not choose.**

### `[ ] APPROVE X` · TEST-AUTHORED REPAIR PROOF

Founder authorizes creation of a failing test that captures Cases A/B/C/D of the pricing problem.

- Purpose: prove NATIVE FAILURE-DRIVEN REPAIR end-to-end
- Would runtime-verify: REASON → PLAN → CHANGE → TEST → VERIFY for one specific bug shape
- Would NOT verify: SPECIFICATION-DRIVEN CODING
- Would NOT prove: universal coding capability
- Risk: the founder must accept that writing a test "captures the bug" · not "seeds the answer"

### `[ ] APPROVE Y` · EXISTING FAILURE

Founder authorizes audit for a legitimate existing failing test in the repo.

- Purpose: same as X · without writing any new test
- Requires: repo audit to find pre-existing failing tests · none was found in Test 5 baseline
- Risk: no such test may exist · effort wasted

### `[ ] APPROVE Z` · SPECIFICATION-DRIVEN CAPABILITY

Founder authorizes design + build of a new capability that transforms specification into evidence. This is a **substantial architectural addition** and is explicitly separate from any prior authorization.

- Purpose: prove NEX1 can code from a natural-language specification without a pre-existing failing test
- Requires: new capability design · founder policy on what specification-to-assertion means · verifier · runtime evidence
- Would runtime-verify: SPECIFICATION-DRIVEN CODING end-to-end
- Risk: substantial new architecture · founder rules on generalization + zero-LLM must be preserved · could require synonym / phrase-parsing infrastructure previously declined

### `[ ] DEFER`

Founder accepts the current boundary indefinitely. NEX1's coding capability remains failure-driven only. No proof pursued.

## 8 · Compliance With Audit Rules

| Rule | Status |
|---|---|
| No implementation | ✅ · zero code changes |
| No modification of beacon | ✅ · none to modify (no beacon component exists) |
| No modification of programming loop | ✅ · byte-identical |
| No failing test created | ✅ |
| No manufactured failure | ✅ |
| No autonomous choice of Path X/Y/Z | ✅ · founder decision required |
| No external LLM | ✅ · pure source inspection |
| No synonym engine | ✅ |
| No generic NLP | ✅ |
| No target-specific hardcoding | ✅ · audit is architecture-general |
| Fix 7-19 · Q7 · Q8 · GAP 5 · Track A · nex-debugger · pricing.ts · pricing.test.ts | ✅ · all byte-identical |
| Distinction between failure-driven and specification-driven maintained | ✅ · §6 |
| Beacon question answered based on source/runtime evidence only | ✅ · §4 |
| No vague language on capability status | ✅ · exact classification: PARTIALLY_SUPPORTED / NOT_IMPLEMENTED |

## 9 · Summary Table

| Question | Answer | Source evidence |
|---|---|---|
| A · What causes REASON to execute? | `baselineRun.ok === false` (vitest non-zero exit) | native-programming-loop.ts:252-281 |
| B · What exact data does REASON require? | `rawVitestOutput: string` from real vitest invocation | native-programming-loop.ts:287 · capability-j-runtime-diagnosis.ts:77 |
| C · Where is founder prose converted to expected behaviour? | Nowhere · only file:line regex extraction in UNDERSTAND | native-programming-loop.ts:141-174 |
| D · What is the beacon? | `baselineRun.ok === false` · the vitest-exit-non-zero trigger | source lines above |
| E · Missing capability for spec-driven coding | Prose→assertions · prose→test-generation · or prose→evidence-record — none exist | grep across code-engine returned 0 relevant files |

## 10 · Master AI Engineer Statement

Audit-only. Zero implementation. Zero fixes. The evidence proves:

- NEX1's programming loop is definitively **failure-driven** by design
- The "beacon" (interpreted as the REASON-triggering event) is `baselineRun.ok === false` · a vitest-exit signal · which correctly did not fire in Test 5 because all baseline tests pass
- Specification-driven coding is `NOT_IMPLEMENTED` in current architecture
- No wiring defect exists · this is architectural design · not a bug
- To advance beyond current capability requires an explicit founder decision on Path X · Y · or Z · or explicit acceptance of the boundary (DEFER)

**Truthful classifications delivered:**

- Failure-driven capability: `PARTIALLY_SUPPORTED` (code exists · end-to-end runtime not yet observed)
- Specification-driven capability: `NOT_IMPLEMENTED`
- Beacon result: `BEACON_NOT_EXPECTED` (correctly did not fire · not a wiring defect)

**STOP · AWAIT FOUNDER DECISION.** No autonomous action on Paths X/Y/Z. No further audit unless authorized.

---

*End of NEX1 Specification-Driven Coding Decision Audit · 2026-09-17*
