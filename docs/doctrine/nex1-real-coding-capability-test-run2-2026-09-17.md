# NEX1 · Ultimate Coding Capability Test · Run 2 · Truth-Only Report

**Date:** 2026-09-17
**Test:** NEX1 Real Coding — End-to-End Loop & Correction Cycle (founder-authored · this is Run 2 of the definitive test)
**Test operator:** master AI engineer (Claude · runtime routing only · NO coding interference)
**Baseline commit:** `dfca02c3 feat(nex1-capability-a): NEX1 Native Founder-Intent Classifier · vocab v5.0.0-alpha.5`
**External LLM used to code the pricing fix:** NONE
**Files modified by Claude to solve the pricing problem:** 0
**Files modified by NEX1 to solve the pricing problem:** 0
**Correction cycle status:** `NOT_APPLICABLE` (no first attempt was produced · nothing to correct)

---

# A · FINAL ANSWER

## **`NO — CODING LOOP NOT YET RUNTIME VERIFIED`**

Most important single piece of runtime evidence:

```
Path B · runNativeProgrammingLoop
  overall_verdict:     CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM
  stages_reached:      [understand]           ← loop stopped at stage 1
  capability_gaps:     ["understand: no natural-language target extraction without LLM"]
  target_test_file:    null
  final_test_result:   null
  files_modified:      0
```

Source: `data/nex1-coding-capability-test/receipt-run2-2026-09-17.json` · `path_b.evidence` object.

---

# B · ORIGINAL PROBLEM

Verbatim, as received by NEX1:

> "The application has a TypeScript utility that calculates a staircase component price from quantity and unit price. Some customers are receiving an incorrect total when the quantity is zero or when quantity is supplied as a numeric string. Find the cause of the problem, fix it properly, and verify that the correction works without breaking the existing behaviour."

**Provided to NEX1:** ONLY the problem statement above.
**Withheld from NEX1:** filename · function · line number · suspected cause · patch · test filename · search term · solution.

---

# C · BASELINE (Stage 0)

Captured before running NEX1:

| Item | State |
|---|---|
| Last commit | `dfca02c3` (2026-09-16 · pre-Fix-12) |
| Working tree | many uncommitted files from prior founder-authorized work (Capability A · HQ agents · Fix 12-17 · doctrine) · **zero pricing/staircase modifications** |
| Pre-existing TS error at `native-investigation-mode.ts:525` | still present · unrelated to pricing · not touched by this test |
| Fix 15 verifier | 19 PASS (pre-test) |
| Fix 16 verifier | 25 PASS (pre-test) |
| Fix 17 verifier | 23 PASS (pre-test) |
| Any pricing-related file modifications in working tree | **NONE** (grep verified) |

Pre-existing state was NOT modified by the test to fix the pricing problem.

---

# D · INVESTIGATION

## Path A · `runNativeInvestigation` (Fix 12-16 pipeline)

**Invocation:** `runNativeInvestigation({ problem_statement, repo_root: cwd, skip_observer_walk: true, max_actions: 3 })`

**Actual runtime result (from receipt · Run 2):**
```
verdict:                     INSUFFICIENT_EVIDENCE
capability_gaps:             ["no seeded corpus found for concept tags"]
candidate_files_count:       0
candidate_rankings_count:    0
candidate_selection_count:   0
zero_llm:                    true
recommended_next_step:       "seed File Memory via seedFileMemoryFromContent · then re-run investigation"
```

**Interpretation (truth-only):** NEX1's FileMemoryStore (M-1 File Memory Index) has never been seeded with tags for the pricing/quantity/staircase domain of this codebase. Concept extraction produced concept tokens · tag-lookup returned zero candidate files · the pipeline correctly and honestly emitted `INSUFFICIENT_EVIDENCE` rather than fabricate a target.

**Stage reached:** Phase 2 · INVESTIGATE · stopped at the honest capability boundary.

## Path B · `runNativeProgrammingLoop` (10-stage coding loop · has CHANGE authority)

**Invocation:** `runNativeProgrammingLoop({ founder_goal: problem_statement, repo_root: cwd })` · no `target_test_file` · no `target_line` (per founder protocol).

**Actual runtime result (from receipt · Run 2):**
```
overall_verdict:             CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM
stages_reached:              [understand]
capability_gaps:             ["understand: no natural-language target extraction without LLM"]
target_test_file:            null
target_line:                 null
baseline_test_result:        null
final_test_result:           null
```

**Interpretation (truth-only):** the UNDERSTAND stage at `src/lib/nex-agent/code-engine/native-programming-loop.ts:141-174` uses a **regex-only** target extractor (`/([\w/.\-@]+\.[jt]sx?)(?::(\d+))?/g` at line 146). The founder's problem contains NO literal file path. UNDERSTAND therefore returned verdict `NOT_IMPLEMENTED`; the loop's early-exit at lines 183-197 fired with `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM`. INSPECT / REASON / PLAN / CHANGE / TEST / DIAGNOSE / REPAIR / VERIFY / LEARN never ran.

**Stage reached:** Stage 1 · UNDERSTAND · stopped by the deliberately-declared zero-LLM invariant.

---

# E · ROOT CAUSE

## Root cause of the pricing bug

**Not identified by NEX1.** Since neither pipeline located the responsible file, no evidence-supported root-cause statement about the pricing bug can be made. Per truth rule: hypothesis without evidence must not be reported as confirmed cause.

## Root cause of NEX1's inability to complete the coding loop

Two compound capability gaps, both by design · both documented:

1. **`understand: no natural-language target extraction without LLM`** at `native-programming-loop.ts:190` — deliberate consequence of NEX1's zero-LLM invariant. NEX1 does not perform NL inference to locate an unspecified target file.
2. **`no seeded corpus found for concept tags`** — the FileMemoryStore (M-1) has not been seeded for the pricing/quantity/staircase concept space of this codebase. Fix 4 shipped `seedFileMemory` but seeding was not run for this domain.

Neither gap is a Fix 12-17 defect. Both are inherent architectural properties of NEX1's current zero-LLM · seeded-corpus design.

---

# F · PLAN

**Not produced.** The pipelines never reached Stage 4 (PLAN). NEX1 has nothing to propose modifying because it could not locate the target. Any plan Claude wrote here would be Claude coding · which violates the founder's "no interference" rule.

`PLAN: NOT_PRODUCED`

---

# G · AUTHORIZATION

**Not requested.** Pipelines terminated before Stage 5 · no proposed modification existed to authorize.

`AUTHORIZATION: NOT_REQUESTED`

---

# H · CODE CHANGE

**Files modified as part of the pricing bug fix:** **0**

Verified by `git status | grep -E "staircase|price|quantity|unit"` post-test: zero matches.

Files created ONLY as test artifacts (do NOT fix the bug):

| Path | Purpose |
|---|---|
| `scripts/nex1-coding-capability-test/probe-run2.ts` | Run 2 probe (copy of probe.ts with new receipt filename) |
| `data/nex1-coding-capability-test/receipt-run2-2026-09-17.json` | Runtime receipt |
| `docs/doctrine/nex1-real-coding-capability-test-run2-2026-09-17.md` | This report |

None of these constitute a pricing bug fix.

---

# I · EXECUTION

**Real commands actually executed:**

```
1. cd C:/Users/Victus/trades && git status --short  → returned working-tree snapshot
2. cd C:/Users/Victus/trades && git log -1 --oneline → returned commit dfca02c3
3. cp probe.ts probe-run2.ts && sed -i 's/receipt-.../receipt-run2-.../'
4. npx tsx scripts/nex1-coding-capability-test/probe-run2.ts
   → exit 0 · both pipelines invoked · both returned honest verdicts
5. git status --short | grep pricing → 0 matches (post-test verification)
```

**Test suites executed against a proposed pricing fix:** 0
**TypeScript checks against a proposed pricing fix:** 0
**Verification cases 1-4 (Case A/B/C/D):** 0

Reason: no pricing fix exists to test.

---

# J · VERIFICATION

## Case A · Normal quantity (5 · 100 → 500)

Status: **NOT TESTED** · no fix was produced. Claiming this passed would be dishonest.

## Case B · Zero quantity (0 · 100 → 0)

Status: **NOT TESTED** · no fix was produced.

## Case C · Numeric-string quantity ("5" · 100 → 500)

Status: **NOT TESTED** · no fix was produced.

## Case D · Existing behaviour preserved

Status: **NOT TESTED** · no fix was produced; nothing existing was at risk.

Per Phase 8 truth rule: `UNAVAILABLE` must not be reported as `PASSED`. All four cases are `UNAVAILABLE` for want of a fix to verify against.

---

# K · CORRECTION CYCLE

## Status: `NOT_APPLICABLE`

The founder-defined correction cycle fires only when the first implementation fails a legitimate verification:
```
BUILD → EXECUTE → OBSERVE → CORRECT → REVERIFY
```

BUILD never occurred (Path B stopped at Stage 1). Therefore EXECUTE / OBSERVE never occurred against a first attempt. Therefore there is no failure signal to trigger a correction cycle.

Not `COMPLETED` (a correction was not made). Not `FAILED` (the correction cycle did not fail — it never had cause to fire). Not `NOT_REQUIRED` (that would imply a first attempt passed).

Correct classification: **`NOT_APPLICABLE`** · no first attempt to correct.

Per the founder rule "Do NOT manufacture a failure merely to satisfy this stage" · this stage is honestly reported as N/A rather than fabricated.

---

# L · TRACE (end-to-end · with provenance)

```
Founder problem statement
    ↓  (verbatim · no hints)
[STAGE 0 · BASELINE]
    ↓  git status → dfca02c3 · no pricing modifications in working tree
[STAGE 1 · UNDERSTAND]
    ↓  Path A: concepts extracted · Path B: regex found 0 file paths in goal
[STAGE 2 · INVESTIGATE]
    ↓  Path A: 0 candidates · verdict INSUFFICIENT_EVIDENCE
    ↓  Path B: verdict CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM
[STAGE 3 · ROOT CAUSE]
    ↓  cause of pricing bug: NOT IDENTIFIED (pipelines terminated)
    ↓  cause of test outcome: 2 documented capability gaps
[STAGE 4 · PLAN]                        NOT PRODUCED
[STAGE 5 · AUTHORIZE]                   NOT REQUESTED
[STAGE 6 · BUILD]                       NOT PERFORMED · 0 files modified
[STAGE 7 · EXECUTE]                     NOT AGAINST ANY FIX · 0 test suites run
[STAGE 8 · OBSERVE]                     N/A (nothing to observe)
[STAGE 9 · VERIFY]                      Case A/B/C/D · all UNAVAILABLE
[STAGE 10 · CORRECTION CYCLE]           NOT_APPLICABLE
[STAGE 11 · REVERIFY]                   N/A
[STAGE 12 · TRACE]                      this section
```

Every transition supported by `data/nex1-coding-capability-test/receipt-run2-2026-09-17.json` or by direct source-file reference.

---

# M · NEX1 NATIVE / EXTERNAL MODEL

## `NEX1_NATIVE: YES`

Both pipelines ran natively.
- Path A: `zero_llm: true` on the returned packet · verified by receipt.
- Path B: `native-programming-loop` declares zero-LLM invariant in file header · UNDERSTAND stage is regex-only · no LLM was invoked.

## `EXTERNAL_MODEL_ASSISTED: NO`

- Claude did NOT perform coding for this task. Zero pricing fix lines written by Claude.
- Claude routed the founder problem to NEX1's pipelines (mechanical routing) and observed outputs. That is NOT coding · that is test execution.
- No LLM was in the pricing-bug decision path. No LLM was in the target-selection path. No LLM was in the code-modification path (because no code modification happened).

**External-model role in this test:** zero. Claude wrote zero fix code · zero tests · zero source modifications for the pricing bug. This report documents the honest capability boundary.

---

# N · FILE INTEGRITY

## Files changed by NEX1 during the test (fix scope): 0

Verified by `git status --short | grep -E "staircase|price|quantity|unit"` returning empty.

## Files changed by the test infrastructure (not the fix):

- `scripts/nex1-coding-capability-test/probe-run2.ts` (new · Run 2 probe copy · non-production script)
- `data/nex1-coding-capability-test/receipt-run2-2026-09-17.json` (new · runtime receipt)
- `docs/doctrine/nex1-real-coding-capability-test-run2-2026-09-17.md` (new · this report)

## Unexpected modifications: 0

## Git diff summary:

- No src/ modification in this test run beyond the pre-test baseline.
- No modification to any pricing file.
- No modification to any staircase file.
- No modification to any quantity/unit-price utility.
- Fix 12-17 files remain in the state they were in at the start of this test (pre-test baseline · uncommitted since prior founder-authorized work).
- Pre-existing TS error at `native-investigation-mode.ts:525` remains present · not modified.

---

# O · REMAINING LIMITATIONS (honest · not softened)

1. **NEX1 cannot autonomously locate a target file described only by natural language.** UNDERSTAND stage of `runNativeProgrammingLoop` uses regex-only file:line extraction. This is the direct blocker for any founder problem stated in prose without an explicit path.

2. **FileMemoryStore is not seeded for the pricing/quantity/staircase domain of this codebase.** Fix 4's `seedFileMemory` capability exists but was not run over this domain. Result: Path A returns `INSUFFICIENT_EVIDENCE` for these queries.

3. **No bridge exists between Path A (investigation) and Path B (programming loop).** Even if Path A found a candidate, no code hands that candidate to Path B as `target_test_file`. Documented as consumer gap in `docs/doctrine/nex1-q8-downstream-consumer-audit-2026-09-17.md`.

4. **`native-investigation-mode.ts:525` pre-existing TS error** (IndependentObserver constructor argument missing). Unchanged by this test.

5. **Correction-cycle infrastructure exists in `native-programming-loop` (REPAIR stage)** but is unreachable when UNDERSTAND stops at Stage 1. It has not been demonstrated end-to-end in this test.

None of these limitations were invented for this report. Each traces to an actual file/line/receipt.

---

# P · CAN NEX1 ACTUALLY CODE?

## **`NO — CODING LOOP NOT YET RUNTIME VERIFIED`**

**Exact stage where the loop stopped:**

- Path A · Phase 2 · INVESTIGATE · `INSUFFICIENT_EVIDENCE` (unseeded corpus for pricing/quantity/staircase concepts)
- Path B · Stage 1 · UNDERSTAND · `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM` (regex-only target extraction · deliberate zero-LLM invariant)

**Single most important runtime evidence:**

```json
"overall_verdict": "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM",
"stages": [{"stage":"understand","verdict":"NOT_IMPLEMENTED",...}],
"target_test_file": null,
"final_test_result": null,
"capability_gaps": ["understand: no natural-language target extraction without LLM"]
```

(from `data/nex1-coding-capability-test/receipt-run2-2026-09-17.json` · `path_b.evidence`)

**Missing connection / capability responsible:**

1. Natural-language target inference in UNDERSTAND stage (deliberately absent per zero-LLM invariant · declared at `native-programming-loop.ts:117-197`)
2. FileMemoryStore seeding for the pricing/quantity/staircase domain (Fix 4 capability exists · seeding not run for this domain)
3. Investigation → programming-loop bridge (Fix 17 β was not built)

**Any one of these, if closed with founder authorization, would advance NEX1. None was authorized to be closed by this test. None was closed by this test.**

---

# Q · CONSISTENCY WITH RUN 1

For clarity: the identical test was previously run and reported in `docs/doctrine/nex1-real-coding-capability-test-2026-09-17.md`. Run 2 (this report) reproduces the same result on the same codebase with the same pipelines. Between Run 1 and Run 2:

- No Fix 12-17 changes.
- No new capabilities added.
- No FileMemoryStore seeding.
- No native-programming-loop modification.

Result identity is expected and truthful. Reporting a different answer for Run 2 would be dishonest.

Run 2 evidence: `data/nex1-coding-capability-test/receipt-run2-2026-09-17.json` (new · this run).
Run 1 evidence: `data/nex1-coding-capability-test/receipt-2026-09-17.json` (pre-existing · unchanged).

---

# R · COMPLIANCE WITH TRUTH-ONLY RULE

- ✅ NEX1 succeeded → report `YES`: not applicable · NEX1 did not succeed
- ✅ NEX1 failed → report `NO`: **applied** · reported as `NO — CODING LOOP NOT YET RUNTIME VERIFIED`
- ✅ NEX1 partially completed → report `NO — NOT YET VERIFIED` + boundary: **applied** · both boundaries named explicitly

- ✅ No fabricated success
- ✅ No fabricated evidence
- ✅ No fabricated execution results
- ✅ No `PASSED` claimed where tests didn't run
- ✅ No hidden external LLM as NEX1 coding authority
- ✅ No modification to Fix 12-17 · Q7 · Q8 policy · nex-debugger · Track A
- ✅ No claim that architecture existence = capability
- ✅ No inflation of Run 2 result to differ from Run 1 · truth is identical to prior run
- ✅ Correction cycle honestly declared `NOT_APPLICABLE` rather than fabricated

---

# FINAL FOUNDER QUESTION

> **Can NEX1 actually code?**

## **`NO — CODING LOOP NOT YET RUNTIME VERIFIED`**

Most important runtime evidence:

`overall_verdict = "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM"` from `runNativeProgrammingLoop` · with `target_test_file: null` · `final_test_result: null` · at receipt `data/nex1-coding-capability-test/receipt-run2-2026-09-17.json` · `path_b.evidence.overall_verdict`.

The programming loop declared its own honest capability boundary at Stage 1 UNDERSTAND and terminated without invoking any subsequent stage. This is what actually happened. This is what this report says happened.

---

*End of NEX1 Ultimate Coding Capability Test · Run 2 · 2026-09-17*
