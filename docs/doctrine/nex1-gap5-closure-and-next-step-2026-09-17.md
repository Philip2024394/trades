# NEX1 · GAP 5 Closure + Founder Decision Gate + Next-Step Readiness

**Date:** 2026-09-17
**Status directive:** GAP 5 = `NO_FIX_REQUIRED` (founder-accepted per prior audit + closure prompt)
**Task type:** DECISION DOCUMENT + NEXT-TEST DESIGN · NO IMPLEMENTATION
**External model:** NONE
**Customer pricing files modified:** 0
**Fix 7-19 modifications:** 0
**Programming loop invocations:** 0
**Track A modifications:** 0

---

## 1 · GAP 5 Audit Remains `NO_FIX_REQUIRED`

Verified by prior audit at `docs/doctrine/nex1-gap5-structural-evidence-coverage-2026-09-17.md`. The native investigation pipeline is architecturally intact. The apparent "cliff" between Fix 10 and Fix 11 is legitimate design behavior · not a bug.

Confirmed pipeline drop-off table (from `data/nex1-gap5/phase1-trace-2026-09-17.json`):

```
concepts_extracted            : 9
candidate_files               : 20
source_inspections            : 5   (2 refused_too_large · 2 pure-data · 1 inspectable)
observed_chains               : 80
chain_narratives              : 293
inferred_relationships        : 1   ← Fix 10 correctly detected 1 pattern
composed_arguments            : 0   ← Fix 11 correctly refused depth<2
hypothesis / eval / rank / select : 0   (honest cascade)
```

This behavior is correct.

## 2 · No Production Changes Were Made

`git status --short | grep -E "^ M src|^ M scripts"` post-closure returns only the pre-existing modifications from Fix 12-19 work committed to no branch. No source file was modified during the GAP 5 audit or during today's closure task.

## 3 · Fix 7-19 Remain Unchanged

Verified byte-identical to their state at the completion of Fix 19. Regression evidence (executed post-Fix-19 · pre-closure):

- Fix 15 · 19 PASS · exit 0
- Fix 16 (Q8) · 25 PASS · exit 0
- Fix 17 · 24 PASS · exit 0
- Fix 18 · 11 PASS · exit 0
- Fix 19 · 13 PASS · exit 0

Zero regression.

## 4 · Q7 and Q8 Remain Unchanged

- `NEX1_RANKING_POLICY V1` · FOUNDER_APPROVED · unchanged
- `NEX1_Q8_SELECTION_POLICY V1` · FOUNDER_APPROVED · unchanged
- Fix 15 (Q7 mechanism) unchanged
- Fix 16 (Q8 mechanism) unchanged
- Selection precedence unchanged
- Tie handling unchanged
- Confidence/provenance rules unchanged

## 5 · Terminology Mismatch is a Known Capability Boundary

The following is documented and accepted:

- Founder language: `quantity`, `unit price`, `staircase`, `component`, `total`
- Repository language for the actual quantity-pricing utility (`src/lib/nex-shop/pricing.ts`): `qty`, `pricePerUnitIdr`, `tiers`, `lineTotalIdr`

Current native discovery does NOT bridge business-to-technical terminology · because no synonym / alias / semantic-search infrastructure exists in NEX1 and none is authorized. This is now a **known capability boundary** · not a defect.

The consequence: for problems described in ordinary business prose where the repository uses divergent technical identifiers, NEX1 will legitimately return `INSUFFICIENT_EVIDENCE` or `REQUIRE_MORE_INVESTIGATION` at the appropriate stage. That is honest behavior · not a failure.

## 6 · Optional Optimizations 10.A / 10.B Remain UNAUTHORIZED

Per founder directive:

- **10.A · Widen Fix 7 top-K from 5 to 10** — NOT AUTHORIZED · NOT IMPLEMENTED
- **10.B · Inverse-frequency scoring in Fix 18 discovery** — NOT AUTHORIZED · NOT IMPLEMENTED

Zero exploratory code was written for either option in this closure task. The optional-optimization stubs from the prior audit's §10 remain **surfaced only** · not built.

## 7 · No External LLM Was Used

Zero LLM at any point in this closure task. Claude authored this doctrine document · but Claude is NOT the NEX1 runtime intelligence. The runtime is native, deterministic, zero-model. Verified by:

- Fix 19 verifier's F19-6 (zero LLM imports in investigation module)
- Fix 16's Q8-N10 (zero LLM imports in selector)
- Fix 17's N-1 (zero LLM imports in reporting/persistence)
- Fix 18's F18-7 (zero LLM imports in discovery + bridge)

## 8 · No Customer Code Was Modified

Grep post-closure: `git status | grep -E "(staircase|price|quantity|unit)"` returns empty. `src/lib/nex-shop/pricing.ts` is byte-identical to its baseline.

## 9 · No Programming Loop Was Invoked

`runNativeProgrammingLoop` was NOT called during the closure task. The last invocation was Test 1 (which stopped at UNDERSTAND with `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM`). No subsequent invocation.

---

## 10 · Founder Decision Now Required

### Choice A — KEEP CURRENT BOUNDARY (Recommended by architecture · not by Claude)

NEX1 remains:
- Deterministic
- Literal + concept-driven (via CODING_LEXEME_INDEX + domain_tokens)
- Free of arbitrary business→technical translation
- Free of synonym maintenance burden

Consequences:
- Founder problems described in prose that uses vocabulary divergent from actual repo identifiers may legitimately return `INSUFFICIENT_EVIDENCE`
- No new NLP layer · no hidden semantic assumptions
- Existing constitution preserved intact

Founder decision required · not implicit:

**[ ] APPROVE A** — accept the known boundary indefinitely

### Choice B — AUTHORIZE GENERALIZED BUSINESS → TECHNICAL VOCABULARY

Only if founder explicitly wants this capability. Would require a subsequent Fix authorization with:
- Prior audit of existing concept-alias infrastructure (none currently exists per prior audits)
- Founder-authored generalized mapping mechanism (e.g., `quantity ↔ qty`, `identifier ↔ id`, `unit price ↔ pricePerUnit`)
- Explicit prohibition on: LLM · test-specific mapping · filename-selection · autonomous-authorization
- Explicit generalization (not pricing-specific)
- Provenance-preserving
- Deterministic
- Reusable across future coding problems

Founder decision required · not implicit:

**[ ] APPROVE B** — issue a subsequent authorization prompt specifying the mapping mechanism

### Choice C — DEFER

Both A and B require a founder statement. Deferring is legitimate.

**[ ] DEFER** — return to this after the next coding test proves whether the terminology-mismatch case is a genuine common recurrence or a one-off

---

## 11 · Proposed Next Controlled Coding Test

Per founder rule "identify a controlled coding task whose implementation can be discovered using the capabilities NEX1 already possesses" · the following test is proposed. Founder is invited to approve, modify, or reject the shape.

### 11.1 · Design Principles (audit-derived)

The next test should exercise NEX1's existing capabilities honestly · not force capabilities that don't exist. The test must:

- **Use natural language** — no filename / line / function name / expected patch / solution
- **Have a real code target** — a real .ts file in the repo with a real behavior gap
- **Use vocabulary that overlaps with the target's identifiers** — this is the KEY constraint · avoids the terminology-mismatch problem that Test 3 exposed
- **Have a deterministic verification method** — an existing test file that will PASS after the fix and FAIL before
- **Contain a structural pattern Fix 10 recognizes** — `producer_consumer` · `condition_gates_return` · or `selector_literal_mapping`
- **Be small enough to fit under Fix 7's 128KB byte cap**
- **Have an existing vitest test** so the programming loop's INSPECT/TEST stage has real input
- **Require an authorization step** before modification (test operator role)

### 11.2 · Proposed Test Shape (illustrative · not authoritative)

Rather than picking the target file myself (which would violate blind-test discipline), the founder is invited to author or point to a small utility in the repo where:

1. The utility's identifiers match ordinary coding vocabulary (e.g. `parseInput` · `validateConfig` · `formatMessage` · `computeChecksum` — NOT business jargon)
2. The founder problem uses those same identifiers explicitly OR uses closely-cognate coding terms already in CODING_LEXEME_INDEX
3. The utility has a bug detectable by an existing vitest test
4. The bug is one of the three patterns Fix 10 recognizes:
   - **producer_consumer** — variable produced in one function, consumed incorrectly in another
   - **condition_gates_return** — an `if` gate that returns wrong value for a boundary case (0, null, "")
   - **selector_literal_mapping** — a lookup table returns wrong result for a specific key

Example founder problem shape (illustrative · uses generic coding vocabulary):

> "The `parseTimeout` utility returns `undefined` when the input string is the literal `'0'`, but it should return `0` in that case. Investigate and fix. Existing tests in the relevant test file should pass; the failing behaviour is captured by one specific test case."

**Why this shape works with current capabilities:**
- `parseTimeout` · `timeout` · `undefined` · `string` · `test` are all in Capability A's CODING_LEXEME_INDEX (or trivially recognized)
- Fix 10's `condition_gates_return` pattern would recognize a `if (input === "0") return undefined` style bug
- Existing vitest tests provide deterministic pass/fail signal
- The test doesn't require business→technical translation
- Small utility · under byte-cap
- Native discovery has a strong chance of surfacing it because both problem and target share vocabulary

### 11.3 · What This Test Would Actually Prove

If NEX1 progresses through this test:
- ✅ UNDERSTAND → concepts extracted matching real repo identifiers
- ✅ INVESTIGATE → discovery finds real target
- ✅ EVIDENCE → source-inspection produces relationships
- ✅ HYPOTHESIS → Fix 12 generates candidates
- ✅ EVALUATE → Fix 13 classifies evidence
- ✅ Q7 → Fix 15 ranks
- ✅ Q8 → Fix 16 selects (or declines with honest state)
- ⬜ AUTHORIZE → founder authorizes if target is proposed
- ⬜ BUILD → runNativeProgrammingLoop's CHANGE stage attempts the modification
- ⬜ EXECUTE → vitest runs
- ⬜ OBSERVE → pass/fail collected
- ⬜ VERIFY → correction confirmed
- ⬜ CORRECT + REVERIFY → only if honest failure

This proves the loop on THIS ONE task. Per founder rule §14 it does NOT prove universal coding capability. But it's a concrete first proof-of-loop.

### 11.4 · What This Test Would NOT Prove

- That NEX1 can code arbitrary bugs
- That NEX1 can handle business→technical vocabulary translation
- That NEX1 can locate the right file for prose problems with divergent vocab
- That the programming loop's CHANGE stage handles all repair patterns

Each of those requires separate, later, targeted tests.

---

## 12 · Evidence Required to Declare `CODING_LOOP_RUNTIME_VERIFIED`

If the next test executes, all of the following must be observed with real evidence · NOT inferred:

1. **Real target discovered** — via native investigation · not passed as a hint · real filesystem entry
2. **Real evidence produced** — Fix 13 emits actual STRUCTURALLY_SUPPORTING evidence records · not zero
3. **Q7 authoritative ranking** — Fix 15 emits `rank_position: 1` for the correct target · not tied
4. **Q8 authoritative selection** — Fix 16 emits `selection_state: "SELECTED"` · not fallback · not TIE · not NO_SELECTION
5. **Explicit test operator authorization** — a recorded authorization event · not implicit
6. **Real file modification** — `git diff` shows the exact intended change · no other files touched · verified byte-diff
7. **Real vitest execution** — `runVitest` returns real exit code · captured stdout/stderr
8. **Real test PASS** — the specific test that captured the bug now passes · other tests unchanged
9. **Correction cycle IF triggered** — only if a genuine failure occurred · not manufactured
10. **Determinism** — 5 identical runs produce identical file changes and identical test outcome
11. **Zero LLM at runtime** — grep-verified on the coding path source
12. **Zero unauthorized modification** — grep-verified on git diff scope

If any of these 12 is missing or infered, the correct answer remains:

## `CODING_LOOP_NOT_YET_RUNTIME_VERIFIED`

---

## 13 · Compliance With Founder Directive

| Rule | Status |
|---|---|
| GAP 5 audit remains NO_FIX_REQUIRED | ✅ · confirmed · no reopening |
| No production changes | ✅ · zero source modification |
| Fix 7-19 unchanged | ✅ · verifier evidence in §3 |
| Q7/Q8 unchanged | ✅ · policies untouched |
| pricing.ts unchanged | ✅ · byte-identical |
| Terminology mismatch acknowledged as boundary | ✅ · §5 |
| 10.A / 10.B not implemented | ✅ · zero code written for either |
| No LLM at runtime | ✅ · verified |
| No customer code modified | ✅ |
| No programming loop invocation | ✅ |
| Decision A/B/DEFER surfaced | ✅ · §10 |
| Next coding test proposed | ✅ · §11 |
| Evidence bar for `RUNTIME_VERIFIED` stated | ✅ · §12 |

---

## 14 · Final Bottom Line

**Coding capability status:** `CODING_LOOP_NOT_YET_RUNTIME_VERIFIED`

The current answer to "Can NEX1 actually code?" remains **NO** · because the loop has never executed end-to-end on a real coding task. Progress made through Fix 12-19 established investigation, ranking, selection, reporting, persistence, and bridging capabilities · but the BUILD → EXECUTE → VERIFY sequence has never been exercised.

The next step is a **founder decision** on §10 · then a **founder-designed or founder-approved controlled coding test** using the shape proposed in §11 · then · only if that test succeeds with real evidence, may `CODING_LOOP_RUNTIME_VERIFIED` be considered · and only for that specific task · never as universal proof.

**STOP.** Awaiting founder decision.

---

*End of NEX1 GAP 5 Closure + Next-Step Readiness · 2026-09-17*
