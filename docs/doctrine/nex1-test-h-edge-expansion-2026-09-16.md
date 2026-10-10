# NEX1 · Test H · Edge-Expansion Diagnostic

**Date:** 2026-09-16
**Status:** DIAGNOSTIC COMPLETE · Test H PARTIAL · Fix 5 edge-expansion capability RUNTIME-VERIFIED for the first time · test-design flaw honestly identified · Track A untouched · freeze intact
**Author:** master_ai_engineer — NOT NEX1 runtime
**Governing directive:** Founder direction · Test H to exercise edge-expansion after Test G fix

**Raw runtime evidence:** `data/nex1-test-h/receipt-2026-09-16.json` (493 lines · verbatim NEX1 output)

---

## §1 · Test H design

**Problem statement (verbatim):**

> *"The programming mission's authorization envelope determines whether specialist adapters can execute. Investigate what governs envelope validity."*

**Designed to force edge-expansion:**
- Concepts `authorization` · `envelope` in vocab → tag matches File A heavily
- Ground truth cause was assumed to be `founder-authority/trusted-anchors.ts` (real determinant · empty trust set = refuse all)
- Assumption: cross-file dep-graph edge would let NEX1 traverse from authorization.ts to trusted-anchors.ts

**Ground truth held (WITHHELD from NEX1):**
- File A · easy · high tag match: `founder-authority/authorization.ts`
- File B · real determinant · low tag match: `founder-authority/trusted-anchors.ts`

---

## §2 · Runtime result (verbatim)

**Concepts extracted:** `["authorization", "envelope"]` — exactly 2, as designed

**Reasoning trace critical excerpts:**
```
listFiles(tag=authorization) → 44 entries
listFiles(tag=envelope) → 46 entries
candidates_after_file_memory=81                    ← under 100-cap · edge-expansion CAN fire
action_4_dep_graph · buildDependencyGraph on 300 files (81 candidates + 219 broader corpus)
dep_graph edges=634
edge_expansion · 7 files structurally connected to top-10 candidates
candidates_after_edge_expansion=88 (7 added via structural edges)
combined_confidence = 0.4·0.60 + 0.6·1.00 = 0.840
```

**Top candidates (with source distinction):**

| Rank | File | Score | Evidence source |
|---|---|---|---|
| 1 | `founder-authority/__tests__/runtime-08.test.ts` | 1.00 | tag match (both concepts) |
| **2** | **`founder-authority/authorization.ts`** ← File A | **1.00** | tag match (both concepts) |
| 3 | `founder-authority/types.ts` | 1.00 | tag match |
| 4 | `workstation-integration/__tests__/runtime-10.test.ts` | 1.00 | tag match |
| 5 | `nex-cap/cap-spec-bridge.ts` | 1.00 | tag match |
| 6 | `nex1-orchestrator/__tests__/wo12-real-correction-cycle.test.ts` | 1.00 | tag match |
| 7-9 | (WO-02 authorization files) | 1.00 | tag match |
| **10** | **`nex-cap/real-workstation-adapter.ts`** | **0.60** | **EDGE-EXPANDED** (imported by cap-spec-bridge.ts) |
| 11-15 | wo11/wo5/wo6/wo7/wo8 orchestrator files | 0.60 | **EDGE-EXPANDED** (imported by wo12 test) |
| **20** | **`founder-authority/delegation.ts`** (intermediate) | — | tag match |
| — | `founder-authority/trusted-anchors.ts` ← File B | — | **NOT SURFACED** |

---

## §3 · Ground truth check

| File | Found? | Rank | Source |
|---|---|---|---|
| File A · `authorization.ts` | **YES** | 2 | tag match (concept:authorization, concept:envelope) |
| Intermediate · `delegation.ts` | YES | 20 | tag match (in top-20 barely) |
| File B · `trusted-anchors.ts` | **NO** | — | not surfaced |

**Cross-file relationship edges detected:**
- `authorization.ts → delegation.ts` (yes · verified in top edges)
- `authorization.ts → trusted-anchors.ts` — **DOES NOT EXIST as direct edge**

**Classification: PARTIAL_ONLY_FILE_A**

---

## §4 · Fix 5 edge-expansion · RUNTIME-VERIFIED for the first time

**This is the significant result.** The prior Test G fix included edge-expansion capability but it was skipped (candidate count 162 exceeded 100-cap). Test H was designed with narrower vocabulary (2 concepts · 81 candidates) to exercise edge-expansion.

Reasoning trace verified:
```
edge_expansion · 7 files structurally connected to top-10 candidates
candidates_after_edge_expansion=88 (7 added via structural edges)
```

**7 files were promoted into candidates via dep-graph edges · not concept-tag match.** Each carries a distinct evidence marker:

```
evidence_signals: [edge:imported_by_top:src/lib/nex-cap/cap-spec-bridge.ts]
evidence_signals: [edge:imported_by_top:src/lib/nex1-orchestrator/__tests__/wo12-real-correction-cycle.test.ts]
```

**Zero fabrication:** all 7 edge-expanded files are real seeded files with real import edges. Evidence source is explicit and traceable.

**Truth-doctrine preserved:** edge-derived candidates are labeled distinctly from tag-matched · downstream consumer can distinguish.

---

## §5 · Why File B (`trusted-anchors.ts`) did not surface — HONEST design flaw

**My Test H ground-truth assumption was:**
- authorization.ts imports checkFounderKeyTrusted from trusted-anchors.ts (creating a direct dep-graph edge)

**Actual code (verified post-hoc):**
- `authorization.ts:26` imports `verifyDelegationSignature` and `isDelegationRevoked` from `./delegation` — NOT from `./trusted-anchors`
- `delegation.ts` receives `trustedFounderKeys` as a **parameter** — doesn't import trusted-anchors either
- The `/execute` route (in `src/app/api/nex/programming-mission/execute/route.ts`) is where BOTH `checkFounderKeyTrusted` (from trusted-anchors) AND `verifyDelegatedAuthorization` (from authorization) are consulted independently

**The relationship I designed as "cross-file dep-graph edge" is actually a coordination at the API route layer · not a direct import.**

Additionally: my SEED_ROOTS do NOT include `src/app/api/nex/` · so route.ts is not in the seeded corpus. The route's shared-parent role is invisible to the dep-graph.

**This is a test-design flaw · not a NEX1 reasoning failure.** The dep-graph correctly represented the actual import relationships in the seeded corpus · which did NOT include the (route-layer) coordination between authorization.ts and trusted-anchors.ts.

---

## §6 · What Test H genuinely proved

| Claim | Evidence |
|---|---|
| Edge-expansion capability WORKS | 7 files added with `edge:imported_by_top:` markers · reasoning trace confirms |
| Edge-derived candidates are distinguished from tag-matched | Evidence signals carry the `edge:` prefix explicitly |
| Confidence remains honest | 0.84 · FLAG_FOR_REVIEW · not inflated to reflect wishful diagnosis |
| Zero fabrication | Every candidate is a real seeded file · every edge is a real regex-parsed import |
| Investigation Mode surfaces DIRECT import edges from top-10 candidates | Confirmed via receipt (relationships like cap-spec-bridge → real-workstation-adapter surfaced) |
| Multi-hop / non-import relationships NOT navigated | trusted-anchors.ts not surfaced despite being architecturally related |
| Non-seeded intermediary files invisible | route.ts (not in seed corpus) invisible as a common parent |

**Founder success criteria (§11 of Test H WO):**

| Criterion | Result |
|---|---|
| A · Architectural concepts extracted | ✅ 2 concepts extracted (`authorization`, `envelope`) |
| B · Candidate files identified | ✅ File A at rank 2 |
| C · Relationship/dependency evidence discovered | ⚠️ PARTIAL · direct edges detected but multi-hop not |
| D · Cross-file navigation performed | ✅ 7 files added via edge-expansion |
| E · Source evidence obtained | ❌ NOT AVAILABLE · source-reading capability still absent |
| F · Symptom location separated from causal location | ⚠️ PARTIAL · both surface as candidates but not distinguished |
| G · Evidence distinguished from hypothesis | ✅ evidence_signals prefixed correctly |
| H · Correct candidate cause identified | ⚠️ PARTIAL · File B specifically NOT surfaced |
| I · Confidence reflects actual evidence | ✅ 0.84 · honest FLAG_FOR_REVIEW |
| J · No fabricated evidence | ✅ Zero fabrication verified |

---

## §7 · Diagnostic value (what we learned)

**Positive findings:**
1. **Fix 5 edge-expansion is now runtime-verified.** For narrow-vocab problems (≤100 candidates), edge-expansion fires and promotes structurally-connected files.
2. **Investigation Mode correctly follows DIRECT import edges** from top-10 candidates and promotes connected files as separate-source candidates (score 0.5 base + connection strength).
3. **Truth doctrine invariants preserved.** Zero fabrication · zero inflation · evidence labels explicit.

**Boundary discovered:**
1. **Multi-hop relationships not automatically traversed.** If File B is 2+ hops from File A · edge-expansion doesn't reach it (currently only expands 1 hop from top-10).
2. **Non-seeded intermediary files are invisible.** If the coordinating parent (e.g. an API route) isn't in the seed corpus · the dep-graph misses architectural relationships that happen at that layer.
3. **Non-import coordination is invisible.** Relationships coordinated via function arguments · parameter passing · or shared state (rather than direct imports) don't produce dep-graph edges · so edge-expansion can't traverse them.

**Test design lesson:**
- Future edge-expansion tests must use file pairs where the relationship IS a direct import within the seeded corpus.

---

## §8 · Aggregate across all tests

| Test | Class | Result | Notes |
|---|---|---|---|
| A · Known-answer | absence-of-token | ✅ CORRECT rank 6 HIGH | 3 phrasings same target |
| B · Rephrased genuine | absence-of-token | ✅ CORRECT rank 6 HIGH | |
| C · Present tools | negative test | ✅ CORRECT · no false positive | |
| D · Scope trap | scope discipline | ✅ CORRECT · LOCAL_SCOPE preserved | |
| E · Insufficient expectation | refusal | ✅ CORRECT (correctly refused) | |
| F · Multi-verb ambiguity | routing (Fix 4) | ✅ CORRECT ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY | |
| G · Cross-file navigation | dep-graph adjacency | ✅ CORRECT_BOTH_SURFACED (via vocab expansion) | |
| **H · Edge-expansion** | **structural edges** | **⚠️ PARTIAL_ONLY_FILE_A** | Edge-expansion CAPABILITY verified · test-design flaw prevented File B from being connected |

**Aggregate: 7/8 CORRECT · 1/8 PARTIAL · 0/8 INCORRECT · 0/8 HALLUCINATIONS.**

Edge-expansion capability advanced from COMPONENT_COMPLETE (coded but unexercised) to **runtime-verified for direct-import single-hop relationships.**

---

## §9 · Truth-state ratchet (Prove-Before-Progression preserved)

| Capability | Prior state | New state |
|---|---|---|
| Edge-expansion capability · direct-import single-hop | COMPONENT_COMPLETE (coded · unexercised) | **RUNTIME-VERIFIED for single-hop direct imports** (Test H proved) |
| Cross-file navigation for multi-hop relationships | NOT_SUPPORTED | NOT_SUPPORTED (still) |
| Cross-file navigation via non-import coordination | NOT_SUPPORTED | NOT_SUPPORTED (still) |
| Investigation Mode aggregate | SYSTEM_CONNECTED | SYSTEM_CONNECTED (unchanged) |
| Native coding capability | UNPROVEN | **UNPROVEN (unchanged · gated on Track A)** |
| G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · C1 · C3 · C6 · founder authority | UNCHANGED | UNCHANGED |

**Investigation Mode NOT promoted to VERIFIED.** Test H's PARTIAL result demonstrates a specific remaining reasoning limit · not a general failure.

---

## §10 · Track A confirmation

- **C6** activation still awaiting founder-only offline actions
- **G15** trust set still empty (fail-closed)
- **C1** orchestrator → WO-04 wiring still not implemented
- **C3** programming-mission → WO-07 wiring still not implemented
- **Truth Engine Gate 3** remains CLOSED
- **NEX-13/14/15/16** designations remain PROPOSED
- **Founder authority module** never modified

**Track A: UNCHANGED THROUGHOUT.**

---

## §11 · Freeze status

- Zero writes to `founder-authority/*`, `nex-authority-broker/*`, `nex-controlled-hands/*`, `wo2-*`, `wo13-*`, `.env*`, identities
- Zero commits · zero pushes · zero migrations · zero package installs
- Zero designation moves · zero external LLM invoked
- Zero fabricated files · zero hallucinated candidates · zero global-absence claims

**Freeze on all authority chains: INTACT.**

---

## §12 · Recommended next diagnostic (only · not authorized)

Per founder's §4 direction · if H fails don't immediately build another feature · first audit the gap.

**Audit findings from Test H:**
- Dep-graph correctly represented direct imports in seeded corpus
- Edge-expansion correctly promoted files with direct import edges
- Ground-truth File B was NOT connected via direct import to File A · test-design flaw
- Multi-hop / non-import relationships remain unsupported

**Two possible next steps · founder-only decision:**

1. **Redesign Test H** with a genuinely-direct-import relationship in the seeded corpus (e.g. a file that IS directly imported by another file where both have distinguishing vocabulary). Prove edge-expansion works for the intended class · then designate CORRECT.

2. **Design Test I** for a specifically different reasoning class — e.g. multi-hop navigation. This tests whether extension of edge-expansion to 2-hop is the next needed connection. Higher risk · would require capability decision.

**No code should be authorized until the next test is designed and run.**

---

## §13 · Summary of the honest position

**What Test H proved:**
- Fix 5 edge-expansion is genuinely working (7 files promoted via structural edges · runtime-verified · zero fabrication)
- Investigation Mode correctly distinguishes tag-derived from edge-derived candidates
- Direct-import single-hop relationships are surfaced by edge-expansion

**What Test H did NOT prove:**
- Multi-hop or non-import relationships not tested (test design used a non-existent-in-corpus edge)
- File B specifically not surfaced · but this was a test-design flaw not a NEX1 failure

**What remains uncertain:**
- Whether edge-expansion generalises to the founder's target class (symptom in one file · cause in different file · connected only structurally)
- Requires a re-designed test with a real direct-import cross-file relationship

**What is unchanged:**
- Native coding capability UNPROVEN
- Track A UNCHANGED (freeze intact)
- Zero-LLM constitution preserved
- Zero fabrication invariant preserved

**The bottom line:** Test H is genuinely valuable diagnostic evidence. It ran edge-expansion for the first time under real runtime conditions and proved the capability works. It also honestly revealed a boundary — the relationship must be a direct import within the seeded corpus. A future Test H-redesign or Test I would clarify whether the boundary is scope-of-seed vs actual reasoning class.

---

**End of Test H diagnostic · edge-expansion runtime-verified for first time · test-design flaw honestly identified · Track A UNCHANGED · founder-only decision on next diagnostic.**
