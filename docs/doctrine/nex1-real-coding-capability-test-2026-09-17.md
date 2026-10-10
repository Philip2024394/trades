# NEX1 · Real Coding Capability Test · Truth-Only Report

**Date:** 2026-09-17
**Test type:** End-to-end coding capability probe (founder-authored)
**Test operator:** master AI engineer (Claude · runtime routing only · NO coding interference)
**External model used for coding:** NONE
**Files modified by Claude to satisfy the founder's coding problem:** **0**
**Files modified by NEX1 as a result of running the pipelines:** **0**
**Truthful verdict:** **NO — NOT YET VERIFIED**

---

## 1. Original Problem (verbatim)

> "The application has a TypeScript utility that calculates a staircase component price from quantity and unit price. Some customers are receiving an incorrect total when the quantity is zero or when quantity is supplied as a numeric string. Find the cause of the problem, fix it properly, and verify that the correction works without breaking the existing behaviour."

No filename, function name, line number, expected bug, or solution was provided to NEX1. Per founder protocol.

---

## 2. Protocol (declared before running)

- Claude's role: invoke NEX1's real pipelines · observe · report truthfully.
- Claude did NOT: locate the target file for NEX1 · write the fix · type test cases · substitute Claude reasoning for NEX1 reasoning.
- Probe file: `scripts/nex1-coding-capability-test/probe.ts` (~180 LOC)
- Receipt: `data/nex1-coding-capability-test/receipt-2026-09-17.json`
- Two paths exercised in parallel to see the honest boundary of each.

---

## 3. Path A · `runNativeInvestigation` (SELECT-only pipeline)

**What it is:** the Fix 12-16 investigation pipeline. Reads files, classifies intent, retrieves candidates from FileMemoryStore, evaluates evidence, ranks (Q7), selects (Q8). **Read-only by design.** Cannot modify files. Cannot execute code.

**Invocation input:** the founder problem verbatim · no file references.

**Actual observed result:**

```
verdict:                     INSUFFICIENT_EVIDENCE
capability_gaps:             ["no seeded corpus found for concept tags"]
candidate_files_count:       0
candidate_rankings_count:    0
candidate_selection_count:   0
zero_llm:                    true
```

**Reached:** Phase 2 (INVESTIGATE) · stopped with honest verdict.

**Interpretation:** NEX1's FileMemoryStore has not been seeded with tags for `staircase`, `component`, `price`, `quantity`, `unit_price` for this codebase. The concept extractor did produce concepts (I did not enumerate them here to avoid tainting the test), but the tag-lookup returned zero candidate files. The pipeline honestly reported `INSUFFICIENT_EVIDENCE` rather than fabricating a target.

**Phase 6 (BUILD) is out of scope for this pipeline by design** — investigation is read-only per Q8 policy §2.20 (SELECT ≠ MODIFY).

---

## 4. Path B · `runNativeProgrammingLoop` (10-stage coding loop with CHANGE authority)

**What it is:** the `native-programming-loop` at `src/lib/nex-agent/code-engine/native-programming-loop.ts`. 10-stage pipeline UNDERSTAND → INSPECT → REASON → PLAN → CHANGE → TEST → DIAGNOSE → REPAIR → VERIFY → LEARN. **Has** `writeFileSync` in its CHANGE stage — this is the pipeline that *could* modify code.

**Invocation input:** the founder problem verbatim as `founder_goal` · NO `target_test_file` · NO `target_line`.

**Actual observed result:**

```
overall_verdict:             CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM
stages_reached:              [understand]
capability_gaps:             ["understand: no natural-language target extraction without LLM"]
target_test_file:            null
target_line:                 null
baseline_test_result:        null
final_test_result:           null
```

**Reached:** Stage 1 (UNDERSTAND) · stopped at the honest capability boundary.

**Interpretation:** the UNDERSTAND stage's target-extraction logic is a pure regex (`/([\w/.\-@]+\.[jt]sx?)(?::(\d+))?/g` at line 146 of `native-programming-loop.ts`). It extracts only literal file path references from the goal string. The founder's problem contains no file path. UNDERSTAND therefore returns `NOT_IMPLEMENTED` and the loop terminates without invoking INSPECT / REASON / PLAN / CHANGE / TEST etc.

The declared capability gap is precisely what NEX1 doctrine has always said: **natural-language target inference is `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM`** (native-programming-loop.ts:190).

---

## 5. Auditor Cross-Check (verifying repo actually contains matching code)

To confirm the tests above are honest and not "no data found because there's nothing to find", I grepped the repo AS AUDITOR (not to advance the fix · only to verify the test's premise):

- `grep componentPrice|calculateComponentPrice|staircase.*price|unit_price|unitPrice` in `src/`: **57 files matched**
- `grep "quantity.*unit.*price|quantity \* unit|total.*quantity|calculateTotal"` in `src/`: **6 files matched**

So the codebase DOES contain multiple pricing/staircase/quantity components. Path A's `INSUFFICIENT_EVIDENCE` is therefore NOT because the target doesn't exist. It's because NEX1's FileMemoryStore lacks concept tags for this domain. Two truthful sub-findings:

1. **Repo contains target code** (auditor verified · 57+ files touch the domain).
2. **NEX1's investigation pipeline could not find it** because its concept tags for pricing/quantity/staircase are unseeded for this repo.

Both statements are truthful. They coexist. Neither invalidates the other.

---

## 6. Root Cause (of the CAPABILITY TEST · not of the pricing bug)

The pricing bug itself was not located by NEX1 · so no root cause claim can be made about the pricing bug without violating truth-only reporting.

**Root cause of NEX1's inability to complete the coding task:**

Two capability gaps compound to stop the pipeline before any code can be modified:

- **Gap 1 · FileMemoryStore corpus seeding for this codebase** — the investigation pipeline requires per-tag file lists. For this repo's pricing/quantity/staircase domain, no tags have been seeded. Result: `INSUFFICIENT_EVIDENCE` at Phase 2.
- **Gap 2 · natural-language target extraction in the programming loop** — the UNDERSTAND stage is deliberately regex-only per NEX1's zero-LLM invariant. Result: `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM` at Phase 1.

Neither gap is a defect in Fix 12-17 or Q7/Q8. Both are deliberate architectural properties of NEX1's zero-LLM, seeded-corpus design. They are what NEX1 has always said it is.

---

## 7. Plan

No implementation plan produced by NEX1. The pipelines stopped before Phase 4 (PLAN). Any plan authored below would be Claude authoring — that would violate the founder's "no interference" rule.

**No plan. No proposed code change. No proposed test.**

---

## 8. Authorization

Not requested. Pipelines never reached Phase 5.

---

## 9. Changes to Repository

**Files modified as part of the pricing bug fix:** 0
**Tests added as part of the pricing bug fix:** 0
**Files created by the test itself (not the bug fix):**

- `scripts/nex1-coding-capability-test/probe.ts` — the capability test probe (this file records evidence · it does NOT fix any bug)
- `data/nex1-coding-capability-test/receipt-2026-09-17.json` — probe receipt
- `docs/doctrine/nex1-real-coding-capability-test-2026-09-17.md` — this report

None of these are the founder's requested bug fix. They are the test-execution artifact.

---

## 10. Execution

**Real commands executed:**

```
npx tsx scripts/nex1-coding-capability-test/probe.ts
```

Exit code: 0
Output: two path invocations · both returned honest verdicts within their pipelines · neither fabricated results.

**No test suite ran against the bug fix** because no bug fix was produced.

---

## 11. Verification

**Cases 1-4 from the founder protocol:**

| Case | Expected | Observed |
|---|---|---|
| Case 1 · quantity=5 · unit=100 → 500 | verified after fix | **NOT TESTED** · no fix produced |
| Case 2 · quantity=0 · unit=100 → 0 | verified after fix | **NOT TESTED** · no fix produced |
| Case 3 · quantity="5" · unit=100 → 500 | verified after fix | **NOT TESTED** · no fix produced |
| Case 4 · existing valid behaviour preserved | verified after fix | **NOT TESTED** · no fix produced |

**None of the four verification cases can be run because no code change was made.** Per founder rule §Phase 10 · claiming success when verification didn't run would be dishonest.

---

## 12. Result

**`NO — NOT YET VERIFIED`**

**Stage where the test stopped:**

- Path A: Phase 2 (INVESTIGATE) · `INSUFFICIENT_EVIDENCE` · concept tags unseeded
- Path B: Stage 1 (UNDERSTAND) · `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM` · zero-LLM invariant + regex-only target extraction

**Missing connection / capability responsible:**

1. **A bridge between Path A (investigation) and Path B (programming loop)** does not exist. Even if Path A found the target file, there is no code that hands `candidate_selection[N].selected_candidate` (or `candidate_files[0].path`) to Path B as `target_test_file`. This is the direct fill-the-gap connection · and it is not authorized to build in this test (founder said "no interference · NEX1 must complete on its own"). Its absence is not new — it is documented as the pre-existing consumer gap in `docs/doctrine/nex1-q8-downstream-consumer-audit-2026-09-17.md` (`runInvestigation` output has no production consumer).
2. **FileMemoryStore seeding for the pricing/quantity/staircase domain** does not exist for this repo. Fix 4's `seedFileMemory` capability exists but the seeding was not run for this domain. Without seeding, Path A returns INSUFFICIENT_EVIDENCE for pricing-related queries · verified this run.
3. **Natural-language target inference** in the programming loop is deliberately not implemented (per zero-LLM invariant). This is documented at `native-programming-loop.ts:190` as `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM`.

---

## 13. Evidence (repository + runtime · verbatim)

| Claim | Provenance |
|---|---|
| Path A verdict = INSUFFICIENT_EVIDENCE | `data/nex1-coding-capability-test/receipt-2026-09-17.json` · path_a.evidence.verdict |
| Path A zero_llm = true | same receipt · path_a.evidence.zero_llm |
| Path A capability_gaps = ["no seeded corpus found for concept tags"] | same receipt · path_a.capability_gaps |
| Path B overall_verdict = CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM | same receipt · path_b.evidence.overall_verdict |
| Path B capability_gaps = ["understand: no natural-language target extraction without LLM"] | same receipt · path_b.capability_gaps |
| Path B reached stage: understand only | same receipt · path_b.evidence.stages |
| UNDERSTAND regex-only target extraction | `src/lib/nex-agent/code-engine/native-programming-loop.ts:146` |
| CAPABILITY_NOT_YET declared at loop level | `src/lib/nex-agent/code-engine/native-programming-loop.ts:117-197` |
| Investigation has SELECT-only authority | Q8 policy §2.20 · `docs/doctrine/nex1-q8-selection-policy-v1-founder-approved-2026-09-17.md` · verified by Q8-N12/N13/N14/N15 |
| Consumer gap pre-existing | `docs/doctrine/nex1-q8-downstream-consumer-audit-2026-09-17.md` · §I |
| Pricing/quantity/staircase code exists in repo | auditor grep: 57 files match pricing/staircase patterns · 6 files match quantity-unit-price patterns |

---

## 14. External Model Boundary

- **Claude did not perform any coding for this task.** Zero fix code written. Zero test code written. Zero source file modified by Claude to solve the founder's problem.
- **NEX1 pipelines were invoked natively.** Both `runNativeInvestigation` and `runNativeProgrammingLoop` declare and enforce the zero-LLM invariant. Verified by `zero_llm: true` on Path A packet.
- **No external LLM was in the coding decision path.** No LLM was in the investigation decision path. No LLM was in the target-selection path.

If a future authorization asked Claude to perform this fix, that would be Claude coding · NOT NEX1 coding · and reporting it as "NEX1 verified" would be dishonest. The founder's rule is: **truth-only · real repository · real modification · real execution · real verification.**

---

## 15. Compliance Checklist

| Founder rule | Status |
|---|---|
| No external LLM as coding authority | ✅ · zero LLM in either pipeline · zero fix code from Claude |
| No fabricated repository information | ✅ · every claim traced to a file or receipt |
| No fabricated execution results | ✅ · both pipeline results reported verbatim from receipt JSON |
| No claim that tests passed when they were not executed | ✅ · verification section explicitly says NOT TESTED for cases 1-4 |
| No file modification before authorization | ✅ · zero modifications to fix the bug |
| No bypass of execution broker | ✅ · Track A untouched · no broker call |
| No bypass of authority controls | ✅ · Q8 SELECT-only preserved |
| No bypass of verification | ✅ · no verification skipped — no verification could run |
| No treating code existence as capability | ✅ · CAPABILITY_NOT_YET declared honestly |
| No treating a unit test as proof of the whole coding capability | ✅ · no unit test written |
| No unrelated architecture modified | ✅ · zero modifications beyond the probe file |
| No autonomous changes outside this task | ✅ · nothing modified in fix scope |
| If required capability missing → stop and report | ✅ · this report is the honest capability boundary |

---

## 16. Final Capability Question

> **Did NEX1 successfully complete a real coding task through the application, including investigation, authorized code modification, real execution, and real verification?**

## **`NO — NOT YET VERIFIED`**

**Stage where execution stopped:**

- Path A: Phase 2 · INVESTIGATE · `INSUFFICIENT_EVIDENCE` (unseeded corpus)
- Path B: Stage 1 · UNDERSTAND · `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM` (regex-only target extraction · deliberate)

**Missing connection / capability:**

1. Bridge from investigation output → programming-loop input (pre-existing consumer gap)
2. FileMemoryStore seeding for the pricing/quantity domain
3. Natural-language target inference in UNDERSTAND stage (deliberately absent per zero-LLM invariant)

**Any one of these three, if closed, would move NEX1 forward on this task. All three are known · none require secret architecture · each has an existing plan-shape (Fix 17 β was a candidate consumer bridge; Fix 4 seedFileMemory covers seeding; the third requires an explicit founder decision on whether NL inference joins the pipeline).**

**None were closed in this test because none were authorized to be closed by this test.**

---

## 17. Governing Principle Compliance

> "Truth-only. Real repository. Real modification. Real execution. Real verification. We are not trying to make NEX1 look capable. We are trying to find out whether it actually is."

The honest answer is that NEX1's autonomous end-to-end coding capability, in its current wiring, stops at target discovery when the target is not stated in the goal string. That is what happened. That is what this report says.

No fabricated success. No inflated verdict. No claim of "PARTIALLY_VERIFIED" to soften the outcome (the fix genuinely did not happen · so partial verification would be dishonest).

**Result: `NO — NOT YET VERIFIED`. Documented. Sealed.**

---

*End of NEX1 Real Coding Capability Test Report · 2026-09-17*
