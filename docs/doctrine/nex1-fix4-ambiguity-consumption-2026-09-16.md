# NEX1 · Fix 4 · Investigation Mode Ambiguity-Signal Consumption

**Date:** 2026-09-16
**Status:** IMPLEMENTATION COMPLETE · 6/6 CORRECT with zero regression · zero hallucinations · truth doctrine preserved · Track A untouched · freeze intact
**Author:** master_ai_engineer — NOT NEX1 runtime
**Governing directive:** Founder-authorized controlled diagnostic experiment · Fix 4 from `nex1-multi-verb-classifier-audit-2026-09-16.md` · Undercount Protection · zero classifier change · smallest reversible change
**Explicit non-authorization:** Fix 1/2/3 from prior report NOT authorized · classifier tiebreak semantics NOT changed

**Raw runtime evidence:**
- Before Fix 4: `data/nex1-absence-tests/receipt-after-classifier-fix-2026-09-16.json` (Test F REFUSED_NON_INVESTIGATE_INTENT)
- After Fix 4: `data/nex1-absence-tests/receipt-after-fix4-2026-09-16.json` (Test F ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY)

---

## §1 · What Fix 4 does

Consume the multi-verb ambiguity signal the classifier already emits. Investigation Mode now accepts a goal when either:

- Primary verb family is INVESTIGATE (unchanged behaviour · trigger = `PRIMARY_INVESTIGATE`)
- OR primary is a different family AND INVESTIGATE is in `verb_hits` AND classifier flagged `multiple_verb_families_close` (new · trigger = `ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY`)

**Zero classifier change. Zero new capability. Pure connection of existing signal to existing consumer.**

---

## §2 · Changes made (minimal · isolated · reversible)

**One file modified:** `src/lib/nex-agent/code-engine/native-investigation-mode.ts`
- ~30 LOC total (spec + trace + finalise plumbing)
- Effective logic change: ~5 LOC at the acceptance gate
- 4 new fields on `InvestigationEvidencePacket`:
  - `investigation_trigger_kind: "PRIMARY_INVESTIGATE" | "ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY" | "NOT_ACCEPTED"`
  - `primary_verb_family: string | null`
  - `investigate_in_verb_hits: boolean`
  - `multi_verb_ambiguity_flagged: boolean`

**Zero modifications to:** classifier · vocabulary · types · tests · authority modules · Track A code paths.

**Zero new dependencies.** Zero LLM invocations.

---

## §3 · Truth-doctrine preservation (founder requirement)

The evidence packet must **never pretend** an ambiguous classification was unambiguous. Verified in the receipt:

**Test A (unambiguous INVESTIGATE):**
```
investigation_trigger_kind: "PRIMARY_INVESTIGATE"
primary_verb_family: "INVESTIGATE"
multi_verb_ambiguity_flagged: false
```

**Test F (tied BUILD + INVESTIGATE):**
```
investigation_trigger_kind: "ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY"
primary_verb_family: "BUILD"          ← NOT silently rewritten to INVESTIGATE
investigate_in_verb_hits: true
multi_verb_ambiguity_flagged: true
```

The reasoning_trace also carries an explicit entry:
```
ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY · primary=BUILD · verb_hits=[BUILD:construct, INVESTIGATE:investigate] · classifier flagged multiple_verb_families_close · Fix 4 consumption path
```

**A downstream consumer of the packet can distinguish the two acceptance kinds without reading the trace.** Founder's requirement satisfied.

---

## §4 · Before / After state

| Test | Kind | Before Fix 4 (trigger · verdict) | After Fix 4 (trigger · verdict) |
|---|---|---|---|
| **A** | Known-answer | `PRIMARY_INVESTIGATE` · SUFFICIENT_EVIDENCE · rank 1 HIGH | `PRIMARY_INVESTIGATE` · SUFFICIENT_EVIDENCE · rank 1 HIGH (unchanged) |
| **B** | Rephrased genuine | `PRIMARY_INVESTIGATE` · SUFFICIENT_EVIDENCE · rank 1 HIGH | `PRIMARY_INVESTIGATE` · SUFFICIENT_EVIDENCE · rank 1 HIGH (unchanged) |
| **C** | Present requirement | `PRIMARY_INVESTIGATE` · SUFFICIENT_EVIDENCE · zero false positive | `PRIMARY_INVESTIGATE` · SUFFICIENT_EVIDENCE · zero false positive (unchanged) |
| **D** | Scope trap | `PRIMARY_INVESTIGATE` · SUFFICIENT_EVIDENCE · all LOCAL_SCOPE | `PRIMARY_INVESTIGATE` · SUFFICIENT_EVIDENCE · all LOCAL_SCOPE (unchanged) |
| **E** | Insufficient expectation | `PRIMARY_INVESTIGATE` · INSUFFICIENT_EVIDENCE · refused analysis | `PRIMARY_INVESTIGATE` · INSUFFICIENT_EVIDENCE · refused analysis (unchanged) |
| **F** | Multi-file phrasing | `NOT_ACCEPTED` · REFUSED_NON_INVESTIGATE_INTENT | **`ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY`** · SUFFICIENT_EVIDENCE · **rank 1 HIGH · missing [typescript, eslint, vitest]** |

**Aggregate: 5/6 → 6/6 CORRECT · zero regression on A-E · zero hallucinations · zero global-absence claims.**

---

## §5 · Diagnostic value of the Test F result

Per founder direction:
> *"If cap-spec-bridge.ts appears at rank 1 / HIGH → tells us: the classifier consumer was the remaining obstacle. The existing investigation machinery can handle the multi-verb formulation."*
>
> *"If Investigation Mode runs but cannot find the correct target → tells us: the routing problem is solved and we have now exposed a genuinely new reasoning/evidence limitation."*

**Actual result: Outcome 1.** Investigation reasoning generalises across:
- Original problem statement (Test A · unambiguous INVESTIGATE)
- Rephrased genuine problem (Test B · unambiguous INVESTIGATE)
- Multi-verb tied case (Test F · ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY)

Same target (`cap-spec-bridge.ts`) surfaced at rank 1 · HIGH confidence · missing same 3 concept tokens · across three differently-worded investigations of the same real problem.

**This is materially stronger evidence** than any single passing test. Three independent phrasings produced the same correct diagnosis via three different classifier paths.

---

## §6 · What Fix 4 does NOT prove

Per founder direction · this is critical:

> *"Even if it reaches 6/6, I would not immediately declare native coding proven. It would mean you've demonstrated a much stronger native investigation capability."*

Explicit non-claims:

- 6/6 does NOT prove NEX1 can code
- 6/6 does NOT prove NEX1 can plan a modification
- 6/6 does NOT prove NEX1 can execute changes safely
- 6/6 does NOT prove NEX1 can verify a change is correct
- 6/6 does NOT prove NEX1 can self-correct on failure
- 6/6 does NOT change Track A state
- 6/6 does NOT authorize any modification authority

**All 6 test outcomes remain in Level 1 (investigation only).** The chain from diagnosis to authorized modification to executed verified change is untouched.

---

## §7 · Regression check per §16-17 of prior WO discipline

**Classifier's own tests:** not affected (zero classifier change).

**Investigation Mode's contract:** extended (backward-compatible additive fields), not narrowed.

**Investigation Mode's earlier consumers (Test A · rerun):**
- Test A trigger stays `PRIMARY_INVESTIGATE` (verified · no path change for unambiguous cases)
- Test A target and confidence unchanged (rank 1 · HIGH · same missing concepts)

**Tests C, D, E:** all classify as `PRIMARY_INVESTIGATE` after Fix 4 · behaviour identical to pre-fix state.

**Zero hallucinations across all 6 tests in the after-Fix-4 receipt.**

---

## §8 · Truth-state ratchet (Prove-Before-Progression enforced)

| Capability | Prior state | New state |
|---|---|---|
| Investigation Mode acceptance layer | Refused all non-primary-INVESTIGATE | Extended: accepts under multi-verb ambiguity when INVESTIGATE is a competing hit · **explicitly labeled** |
| Native Investigation Mode aggregate | SYSTEM_CONNECTED | SYSTEM_CONNECTED (stronger evidence · 6/6 not yet VERIFIED) |
| Absence-of-token reasoning | SYSTEM_CONNECTED | SYSTEM_CONNECTED (Test F now produces same rank-1 HIGH result as A/B on differently-worded problem) |
| Classifier | unchanged | unchanged |
| Native coding capability | NOT PROVEN | **STILL NOT PROVEN** |
| G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · C1 · C3 · C6 · founder authority | UNCHANGED | UNCHANGED |

**Explicit non-advancement:**
- Investigation Mode is NOT promoted to VERIFIED. Six tests is a controlled diagnostic corpus · not real production traffic. Deferred.
- Investigation Mode is NOT promoted to PRODUCTION_READY. No HTTP surface · no rate limiting · no automatic seeding · no NCP envelope. Deferred.

---

## §9 · Track A confirmation

- **C6** activation still awaiting founder-only offline actions (Ed25519 keypair)
- **G15** trust set still empty (fail-closed)
- **C1** orchestrator → WO-04 wiring still not implemented
- **C3** programming-mission → WO-07 wiring still not implemented
- **Truth Engine Gate 3** remains CLOSED
- **NEX-13/14/15/16** designations remain PROPOSED
- **Founder authority module** never modified · never even inspected during Fix 4

**Track A: UNCHANGED THROUGHOUT.**

---

## §10 · Remaining gaps (honest · not hidden)

1. **Native coding capability unproven.** Diagnosis → plan → authorize → modify → execute → observe → verify → correct → reverify → trace remains a locked chain. Gated on Track A (C6 → C1 → C3).

2. **Corpus is small.** 6 controlled tests. Founder specifically advised broadening the class of problems (multi-file with dependency navigation · misleading location · symptom-vs-cause) as a next diagnostic.

3. **Ambiguity acceptance policy is permissive.** Current rule: accept when `multiple_verb_families_close` is flagged AND INVESTIGATE is in `verb_hits`. If future problems mix INVESTIGATE with a family that shouldn't route to Investigation Mode (e.g. REMOVE), the ambiguity signal alone accepts. Not yet a real gap · but worth flagging.

4. **Fix 4 changes only one consumer.** If future consumers of `verb_family` are added, they may need their own decisions about ambiguity. Not a fix problem · a design principle to preserve.

5. **Confidence banding.** All investigations still land in FLAG_FOR_REVIEW (0.84). The confidence formula gives full marks only when both classifier and top-candidate hit strong signals. Fix 5 (confidence → clarification loop) still not implemented.

---

## §11 · Founder's stated diagnostic ask · answered from evidence

> *"You want something like: symptom → multiple files → dependency relationship → misleading location → identify actual cause → formulate minimal change."*

Test F was multi-verb but same-problem. That is not yet the founder's target: a NEW problem class with multi-file dependency navigation and misleading location. This remains an open next test.

**Fix 4 is a step toward** that milestone — it removes the routing filter that was preventing multi-verb genuine problems from reaching Investigation Mode. But it does not itself validate that Investigation Mode can navigate cross-file dependency evidence to isolate misleading locations.

**Recommended next diagnostic (not authorized by this WO):** design a Test G that involves:
- Symptom observable in file X
- Root cause in file Y (imported by X)
- A "misleading obvious file" Z that the naïve investigator would blame
- Fair evaluation: does absence-detection + dep-graph navigation surface Y over Z?

---

## §12 · Freeze status · final

- Zero writes to `founder-authority/*`, `nex-authority-broker/*`, `nex-controlled-hands/*`, `wo2-*`, `wo13-*`, `.env*`, identities
- Zero commits · zero pushes · zero migrations · zero package installs
- Zero designation moves
- Zero external LLM invoked
- Zero fabricated files · zero hallucinated candidates
- Zero global-absence claims
- Truth Engine Gate 3 still CLOSED · G15 empty · Track A UNTOUCHED

**Freeze on all authority chains: INTACT.**

---

## §13 · Summary of the truthful position

**What advanced (evidence-cited):**
- Test F now reaches Investigation Mode via the existing multi-verb ambiguity signal · truth-doctrine preserved via `ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY` label
- Same rank-1 HIGH result for the WO-07 verification bypass across three differently-worded problem statements (A · B · F)
- Aggregate 6/6 CORRECT · zero regression · zero hallucination

**What remains locked:**
- Native coding capability unproven
- Modification authority gated on Track A
- Investigation Mode remains SYSTEM_CONNECTED, not VERIFIED (Prove-Before-Progression preserved)
- Multi-file cross-dependency problem class not yet tested

**What was NOT done:**
- Did NOT change classifier tiebreak
- Did NOT introduce semantic priority
- Did NOT add multi-verb classification to the classifier
- Did NOT authorize Fix 1/2/3 from the prior report
- Did NOT declare native coding proven

**The classifier consumer was the remaining obstacle for Test F. Fix 4 connected the existing signal. Investigation reasoning was proven adequate for the multi-verb formulation of the same real problem. Native coding remains a separate track gated on the untouched authority chain.**

---

**End of Fix 4 controlled diagnostic experiment · 6/6 CORRECT via Undercount Protection + Connect-Before-Build discipline · zero regression · truth-doctrine preserved via explicit ambiguity labeling · Track A UNCHANGED · native coding still unproven.**
