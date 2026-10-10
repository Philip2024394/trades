# NEX1 · Fix 18 · Natural-Language Coding Discovery + Investigation → Programming Bridge · Truth-Only Report

**Date:** 2026-09-17
**Authorization:** Founder Fix 18 Build Authorization prompt
**External model:** NONE
**Track A status:** FROZEN
**Q7 / Fix 15 / Fix 16 / Fix 17 semantics:** UNCHANGED
**Files modified to fix the pricing bug (Test 2):** **0**
**Files modified by Claude to write code for the pricing bug:** **0**

---

## FIX18_STATUS

**`RUNTIME_VERIFIED`** (Fix 18 itself · verifier 10/10 · zero regression)

## TEST 2 RESULT

**`CODING_LOOP_PROGRESS_MADE`** (from Test 1 baseline · not full completion)

## FINAL CAPABILITY ANSWER

# **`NO — CODING LOOP NOT YET RUNTIME VERIFIED`**

Fix 18 unblocked the pipeline from Test 1's total failure (0 candidates → 8 real candidates · INSUFFICIENT_EVIDENCE → SUFFICIENT_EVIDENCE · bridge exists and runs honestly). But the full end-to-end coding loop (MODIFY → EXECUTE → VERIFY) did not complete because a new boundary emerged: **Capability A classifier vocabulary does not extract domain-specific tokens (staircase / price / quantity / unit_price) from the founder's natural-language problem** · only the language name "typescript" was extracted. Bridge correctly declined to arbitrate a TIE and stopped at the authorization boundary. NEX1 modified zero source files for the pricing bug.

---

## A · IMPLEMENTATION

### Files created

| Path | Purpose | LOC |
|---|---|---|
| `src/lib/nex-agent/code-engine/capability-repository-discovery.ts` | Deterministic bounded content-scan fallback · closes GAP 1 | ~280 |
| `src/lib/nex-agent/code-engine/capability-investigation-programming-bridge.ts` | InvestigationEvidencePacket → target proposal · closes GAP 3 | ~230 |
| `scripts/nex1-fix18-verification/probe.ts` | Fix 18 verifier · F18-1..F18-10 | ~330 |
| `scripts/nex1-coding-capability-test/test2-probe.ts` | Test 2 blind runner | ~150 |
| `data/nex1-fix18/receipt-2026-09-17.json` | Fix 18 verifier receipt (10/10 PASS) | — |
| `data/nex1-coding-capability-test/test2-receipt-2026-09-17.json` | Test 2 runtime evidence | — |
| `docs/doctrine/nex1-fix18-natural-language-coding-bridge-2026-09-17.md` | This report | doctrine |

### File modified

| Path | Change | Lines added |
|---|---|---|
| `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | Import `discoverRepositoryCandidates` + ACTION 2.5 block (fallback when FileMemory empty) | +55 |

### Files intentionally NOT touched (§8 · §9 of authorization)

Fix 12 · Fix 13 · Fix 14 · Fix 15 · Fix 16 · Fix 17 · Q7 policy · Q8 policy · nex-debugger · Track A (G15 · C6 · Ed25519 · WO-04 · execution broker · trust anchors) · native-programming-loop.ts · production-execution paths.

Verified by Fix 18 test F18-10 (checks Fix 15/16/17 source files contain zero Fix 18 modifications) + zero-LLM invariant grep (F18-7).

---

## B · DISCOVERY (GAP 1 CLOSURE · CONFIRMED)

`capability-repository-discovery.ts` implements the deterministic bounded content-scan fallback:

- **Read roots (default):** `src` + `docs/doctrine` (bounded · allowed prefixes)
- **Extensions scanned:** `.ts`, `.tsx`, `.mts`, `.cts`, `.mjs`, `.cjs`, `.js`, `.jsx`
- **Skipped directories:** `node_modules`, `.next`, `dist`, `build`, `.git`, `coverage`, `.turbo`, `.cache`, `out`
- **Bounded:** default 500 files scanned (hard cap 2000) · max 20 candidates (hard cap 50) · max 200KB per file scanned · 5 evidence lines per candidate
- **Ranking:** `match_score = 2 × filename_matches + content_matches` · deterministic sort (score desc · then path asc)
- **Provenance:** every candidate carries `evidence_lines[{ line_number, matched_token }]` from real file content
- **Zero LLM · Zero writes · Zero execution**
- **Every returned candidate is a real filesystem entry** (verified in F18-2 · every path successfully re-read)

**Test 2 runtime evidence:** the fallback fired (verified in `reasoning_trace: "action_2_5_repository_discovery_fallback · FileMemory empty · invoking deterministic content-scan"`) and produced 8 real candidate files:

```
src/app/nexapp/NexAppShell.tsx           score=2.000
src/lib/siteBoards.ts                    score=2.000
src/app/nex-appchat/page.tsx             score=1.000
src/lib/featuredPlacements.ts            score=1.000
src/lib/imageSubmissions.ts              score=1.000
src/lib/quoteRequests.ts                 score=1.000
src/lib/reviews.server.ts                score=1.000
src/lib/supportTickets.ts                score=1.000
```

All 8 exist in the repository. None are fabricated.

**However** · every candidate matched only the token `typescript` (the ONLY concept the classifier extracted). None matched `staircase`, `price`, `quantity`, or `unit_price` — because the classifier did not extract those tokens. This surfaces a new gap (GAP 4 below).

---

## C · BRIDGE (GAP 3 CLOSURE · CONFIRMED)

`capability-investigation-programming-bridge.ts` implements the InvestigationEvidencePacket → target-proposal bridge:

**Priority order (§7 of authorization · deterministic):**
1. If any `candidate_selection[N]` has `selection_state === "SELECTED"` → consume Q8 verdict verbatim as target
2. Else if any `candidate_selection` records exist but none are SELECTED → return `REQUIRE_MORE_INVESTIGATION`
3. Else if `candidate_files` exist AND there's a clear top-scoring candidate (margin/uniqueness rule) → return TOP_RANKED fallback target proposal
4. Else → `NO_INVESTIGATION_DATA`

**Bridge NEVER:**
- Invokes `runNativeProgrammingLoop` (verified F18-6 · no `runNativeProgrammingLoop\s*\(` pattern in source)
- Modifies files (F18-6 · no `writeFileSync` / `appendFileSync` in source)
- Executes commands (F18-6 · no `spawn` / `execSync` / `child_process`)
- Uses external LLM (F18-7 · zero LLM imports)
- Arbitrates tied candidates (F18-8 verified · returns REQUIRE_MORE_INVESTIGATION)
- Chooses by filename / candidate_id / array-order alone

**Test 2 runtime evidence:** bridge received a real packet with 3 Q8 selections (all `TIE` state) and returned `REQUIRE_MORE_INVESTIGATION` with truthful note: *"Q8 emitted no SELECTED state for any scope · states=[src/lib/featuredPlacements.ts=TIE, src/lib/imageSubmissions.ts=TIE, src/lib/siteBoards.ts=TIE] · bridge preserves honest uncertainty per V1 §1"*.

Perfect discipline. No target invented. No arbitrary selection.

---

## D · AUTHORITY

Fix 18 preserved every existing authorization boundary:

| Authority | Fix 18 impact |
|---|---|
| SELECT (Q8 · Fix 16) | UNCHANGED · consumed verbatim |
| MODIFY | NOT INTRODUCED · verified F18-6 (bridge zero-writes) · verified in Test 2 (0 files modified) |
| EXECUTE | NOT INTRODUCED · verified F18-6 (bridge zero-spawn) |
| AUTHORIZE | NOT INTRODUCED · bridge marks `authorization_required: true` |
| VERIFY | NOT INTRODUCED · no PROVEN evidence_kind anywhere |
| DEPLOY | NOT INTRODUCED · no CI/CD hooks |
| Track A | UNTOUCHED · zero Ed25519 / trust-anchor / WO-04 / broker imports in Fix 18 files |

Test 2 stopped at the authorization gate as designed. No autonomous invocation of `runNativeProgrammingLoop` occurred. `stage_4_authorization_gate.auto_invoke_forbidden: true`.

---

## E · EXTERNAL_MODEL

**`NONE`**

- `capability-repository-discovery.ts`: zero LLM imports (F18-7 verified · grep returns 0 matches for openai/anthropic/google/groq/llama/ollama/openrouter)
- `capability-investigation-programming-bridge.ts`: zero LLM imports (F18-7 verified)
- ACTION 2.5 wiring: zero LLM invocation (function chain: discoverRepositoryCandidates → deterministic content-scan)
- Test 2 result declared `external_model_used: "NONE"` in receipt

Claude wrote zero fix code for the pricing bug in Test 2. The only Claude-written code is:
- Fix 18 infrastructure (2 new capabilities + verifier + Test 2 probe wiring)
- This report

None of the above is a pricing bug fix.

---

## F · FABRICATION

**`0`**

- Every candidate returned by discovery is a real filesystem entry (F18-2 verified · every path successfully read back from disk)
- Nonexistent-feature problems produce zero candidates (F18-3 verified · `quantumteleportationflux` / `hyperdimensionalcurrency` → 0 results)
- No candidate names invented · no source content invented
- Every provenance line references a real line in a real file

---

## G · UNAUTHORIZED_MODIFICATION

**`0`**

Git status post-test verified · zero staircase/price/quantity/unit files modified.

---

## H · UNAUTHORIZED_EXECUTION

**`0`**

Neither the discovery capability nor the bridge invokes spawn / exec / child_process / broker / WO-04. Verified by source-inspection scans (F18-6 · F18-7 · negative-control regexes).

---

## I · DETERMINISM

**F18-9:** 5 identical discovery runs · **`distinct_signatures = 1`** · deterministic ✅

Deterministic guarantees:
- Filesystem walk sorted by `localeCompare` at each level (independent of OS `readdir` order)
- Candidates sorted by (score desc · path asc)
- No `Date.now()`, `Math.random()`, `Date.now()`, or timestamps in decision logic
- Bridge output identical for identical packet input

---

## J · REGRESSION

Post-Fix-18 status of prior capabilities:

| Probe | Exit | Signal |
|---|---|---|
| `nex1-fix15-verification/probe.ts` | 0 | 19 PASS |
| `nex1-q8-verification/probe.ts` (Fix 16) | 0 | 25 PASS signals |
| `nex1-fix17-verification/probe.ts` | 0 | 24 PASS |
| Fix 18 verifier | 0 | 10/10 PASS |

**Zero regression.** Fix 15 · Fix 16 · Fix 17 files verified untouched (F18-10).

---

## K · TEST 2 RESULT · CODING_LOOP_PROGRESS_MADE

### Delta from Test 1 → Test 2 (evidence-backed)

| Metric | Test 1 (before Fix 18) | Test 2 (after Fix 18) |
|---|---|---|
| Investigation verdict | `INSUFFICIENT_EVIDENCE` | `SUFFICIENT_EVIDENCE` |
| Candidate files discovered | 0 | 8 (all real filesystem entries) |
| Candidate rankings emitted | 0 | 3 |
| Candidate selections emitted | 0 | 3 (all `TIE` state) |
| Fix 18 fallback fired | N/A | ✅ verified in reasoning_trace |
| Bridge invoked | N/A · didn't exist | ✅ returned `REQUIRE_MORE_INVESTIGATION` |
| Authorization gate reached | ❌ pipeline stopped at Stage 0/1 | ✅ pipeline reached the gate honestly |
| Programming loop invoked | N/A · Path B stopped at UNDERSTAND | ❌ NOT invoked (bridge preserved uncertainty · correct behaviour) |
| Files modified for pricing fix | 0 | 0 |

**Fix 18 closed:**
- GAP 1 (real repository discovery) — ✅ confirmed by 8 candidates + reasoning trace
- GAP 3 (investigation → programming bridge) — ✅ confirmed by bridge emission

**Fix 18 did NOT enable full loop completion because:**

### K.1 · NEWLY SURFACED GAP 4 · Classifier concept-token vocab

The Capability A classifier extracted only ONE concept from the founder's problem:

```json
"concepts_extracted": [
  { "token": "typescript", "category": "language", "occurrences": 1 }
]
```

The founder problem contained: `staircase`, `component`, `price`, `quantity`, `unit price`, `total`, `numeric string`, `zero`. **None of these were extracted as concept tokens by the classifier.**

Result: the discovery fallback searched for `"typescript"` only. That token matches many hundreds of files across the codebase (any .ts file). The top-8 that surfaced were noisy generic matches (`NexAppShell.tsx`, `siteBoards.ts` · etc) — not the pricing utility.

Q7 correctly ranked these (they all match "typescript" equally · some slightly higher on frequency). Q8 correctly emitted `TIE` (equal supporting evidence · no differentiator). Bridge correctly declined to arbitrate.

**Classification of GAP 4:** the classifier's concept-token space is dominated by language names and universal terms · not domain nouns from the founder's problem. Extending vocab to recognize `staircase`, `price`, `quantity`, `unit_price`, `total`, `pricing` would let discovery target actual pricing files.

This is a Capability A vocabulary gap. It is NOT a Fix 18 defect. Fix 18 worked exactly as authorized — it fell back to a content-scan using whatever concept tokens the classifier produced. The classifier's output was too coarse for this specific problem.

### K.2 · Correct honest-uncertainty outcome

The bridge's `REQUIRE_MORE_INVESTIGATION` return is the **truthful capability response**. Under the current concept tokenization, no confident target can be identified. NEX1 refused to invent one. This is not failure of Fix 18; it is the honest boundary of the concept-extraction stage.

If Fix 18 had ARBITRARILY selected the top-ranked candidate despite the tie, and the programming loop had then run against `NexAppShell.tsx`, NEX1 would have "fixed" the wrong file. The bridge's discipline prevented this catastrophically wrong outcome.

---

## L · TRACE

```
Founder problem (verbatim · no hints)
    ↓
Capability A · classifyFounderIntent
    ↓ extracted concepts: ["typescript"]   ← GAP 4 surfaced here
    ↓
runNativeInvestigation
    ├── ACTION 2 · FileMemory lookup → 0 candidates
    ├── ACTION 2.5 · Fix 18 discovery fallback fired
    │     └── discoverRepositoryCandidates(concepts=["typescript"])
    │           └── 8 real candidate files
    ├── ACTION 6..14 · source inspection · chains · Q7 · Q8
    └── verdict: SUFFICIENT_EVIDENCE · 3 Q8 selections · all TIE
    ↓
bridgeInvestigationToProgrammingLoop(packet)
    └── state: REQUIRE_MORE_INVESTIGATION
        └── reason: "Q8 emitted no SELECTED · TIE across 3 scopes · preserves honest uncertainty"
    ↓
STAGE 4 · AUTHORIZATION GATE
    └── auto_invoke_forbidden: true
    └── test operator (founder / test proxy) would decide next
    └── PROBE STOPS HERE · per §10 authorization boundary
    ↓
[runNativeProgrammingLoop] · NEVER INVOKED
[CHANGE stage]           · NEVER INVOKED
[TEST stage]              · NEVER INVOKED
[VERIFY stage]            · NEVER INVOKED
[files modified for fix] · 0
```

Every arrow supported by `data/nex1-coding-capability-test/test2-receipt-2026-09-17.json`.

---

## M · REMAINING LIMITATIONS (honest · not softened)

1. **GAP 4 · Classifier concept-token vocab** — Capability A does not extract `staircase`, `price`, `quantity`, `unit_price`, `total`, `pricing` as concept tokens for this problem. Not a Fix 18 defect; a Capability A vocabulary gap that a future authorization could close.

2. **Fix 18 did not attempt to bridge into `runNativeProgrammingLoop` in Test 2** because the bridge correctly emitted `REQUIRE_MORE_INVESTIGATION`. This is not a Fix 18 shortcoming; it is the discipline the founder authorized.

3. **`native-investigation-mode.ts:576` pre-existing TypeScript error** (IndependentObserver constructor argument · shifted from line 525 → 576 by Fix 18's added lines · same defect · not caused by Fix 18).

4. **The programming loop's CHANGE stage** (which does have file-modification authority via `writeFileSync` + `AstSemanticAdapter`) was not exercised. Even if a target had been proposed, whether the loop can fix a specific pricing bug depends on whether the bug matches one of its structural-repair patterns · unproven in this test.

5. **Bridge fallback for candidate_files (when Q8 has no selections)** was implemented and unit-verified (F18-8) but not exercised in Test 2's real run because Q8 emitted 3 TIE selections · so bridge took the Q8 path.

---

## N · WHAT THIS TEST DID NOT PROVE

Even the `CODING_LOOP_PROGRESS_MADE` classification does NOT prove:

- NEX1 can locate any target from any natural-language problem — depends on classifier vocab coverage
- NEX1's programming loop can fix any pricing bug — CHANGE stage is pattern-limited
- NEX1 can complete the full BUILD → EXECUTE → VERIFY loop autonomously — never exercised
- NEX1 is production-ready — activation is a separate founder decision

The proof is narrower: **Fix 18 unblocked the pipeline · gaps 1 and 3 are closed · bridge preserves honest uncertainty · zero external LLM · authorization boundary preserved.**

---

## O · FINAL FOUNDER ANSWER

> **Can NEX1 actually code?**

# **`NO — CODING LOOP NOT YET RUNTIME VERIFIED`**

Test 2 did not complete the full loop. Zero files were modified for the pricing bug. Zero tests were executed against a proposed fix. The bridge correctly stopped at `REQUIRE_MORE_INVESTIGATION` because Q8 emitted TIE across three scopes · none of which was semantically the pricing utility · because the classifier only extracted `"typescript"` from the founder's problem.

### Most important runtime evidence supporting the answer

```json
"stage_3_bridge": {
  "state": "REQUIRE_MORE_INVESTIGATION",
  "target_proposal": null,
  "note": "Q8 emitted no SELECTED state for any scope · states=[
    src/lib/featuredPlacements.ts=TIE,
    src/lib/imageSubmissions.ts=TIE,
    src/lib/siteBoards.ts=TIE
  ] · bridge preserves honest uncertainty per V1 §1"
}
```

From `data/nex1-coding-capability-test/test2-receipt-2026-09-17.json` · `stage_3_bridge`.

### Progress relative to Test 1

- Test 1: pipeline stopped at Stage 0/1 with 0 candidates · full failure
- Test 2: pipeline reached authorization gate with 8 candidates · honest REQUIRE_MORE_INVESTIGATION at the correct boundary

**Progress: yes. Coding capability: not yet runtime-verified.**

### Missing capability responsible for Test 2 non-completion

**GAP 4 · Capability A classifier vocab does not extract domain-specific tokens** (`staircase`, `price`, `quantity`, `unit_price`, `total`, `pricing`) from a natural-language problem. Only `"typescript"` was extracted. That token is too coarse to differentiate the target pricing file from noise.

Closing GAP 4 is a Capability A vocabulary extension task · separate from Fix 18 · requires founder authorization.

---

## P · COMPLIANCE CHECKLIST

| Founder rule | Status |
|---|---|
| No external LLM in native path | ✅ · zero LLM imports in both new files · F18-7 verified |
| No fabricated repository info | ✅ · every discovery candidate is a real file · F18-2 verified |
| No fabricated execution results | ✅ · all receipts contain verbatim runtime data |
| No unauthorized modification | ✅ · 0 files modified for pricing fix · git status verified |
| No unauthorized execution | ✅ · F18-6 confirms bridge cannot spawn/exec |
| No Q8 selection bypass | ✅ · bridge consumes Q8 SELECTED verbatim · never re-selects |
| No arbitrary target selection | ✅ · F18-8 confirms bridge refuses tie-arbitration |
| No modification of Fix 15/16/17 | ✅ · F18-10 confirmed · Fix 15/16/17 verifiers still 19/25/24 PASS |
| No touching Track A | ✅ · zero Ed25519 / WO-04 / G15 / broker imports |
| No autonomous programming-loop invocation | ✅ · Test 2 probe stops at authorization gate |
| No CODING_LOOP_RUNTIME_VERIFIED claim | ✅ · classification is CODING_LOOP_PROGRESS_MADE · final answer NO |
| No inflated capability classification | ✅ · limitations listed honestly · GAP 4 named |
| Truth-only report | ✅ · matches founder rule §19 |

---

## Q · Newly Surfaced Founder Decisions (surfaced · not requested)

1. **Should Capability A classifier vocab be extended to recognize domain nouns from prose problems?** (staircase · price · quantity · unit_price · total · pricing · component · numeric string · etc.) · GAP 4 closure would require this.
2. **Should the discovery fallback boost domain nouns above language names?** Language tokens ("typescript") could be down-weighted vs domain tokens.
3. **Should the bridge attempt a "second-pass investigation" with additional concept hints (e.g., synonym expansion) rather than emitting REQUIRE_MORE_INVESTIGATION on the first tie?** — This would be Fix 17 β territory · previously not authorized.

None of these are requested by this report. Each requires separate founder authorization.

---

*End of NEX1 Fix 18 Runtime-Verified Report · 2026-09-17*
