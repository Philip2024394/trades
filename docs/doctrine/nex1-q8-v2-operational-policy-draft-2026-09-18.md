# NEX1 Q8 V2 · Operational Policy · DRAFT

**Date drafted:** 2026-09-18
**Instrument authored by:** master_ai_engineer (Claude Opus 4.7)
**Status:** `Q8_V2_POLICY_DRAFT · PENDING_FOUNDER_REVIEW`
**Precedent:** matches the 19-decision discipline of Q7 Ranking Policy V1 (founder-approved 2026-09-17, 18/18 verifier cases on first blind run) and Q8 Selection Policy V1 (founder-approved 2026-09-17, 24/24 verifier cases).
**Depends on:**
- `NEX1_EXPERIENCE_SCHEMA_V1` — founder-approved 2026-09-18 (§3 of freeze doc)
- `NEX1_Q8_V2_DOCTRINE` constitutional boundary — founder-approved 2026-09-18 (§5 of freeze doc)
- `NEX1_Q8_SELECTION_POLICY_V1` — founder-approved 2026-09-17 (unchanged)
- `NEX1_RANKING_POLICY_V1` (Q7) — founder-approved 2026-09-17 (unchanged)
- Fix 23b data-flow tracer — RUNTIME_VERIFIED 2026-09-17 (unchanged)
- Fix 23c preservation-check — RUNTIME_VERIFIED 2026-09-17 (unchanged)
- Fix 17 investigation-conclusion-store — RUNTIME_VERIFIED 2026-09-17 (writer extended by Fix 24)

**Prior evidence:** seven archaeology reports + Founder Policy Decision Instrument + Freeze document. Not repeated here.

**No implementation.** This is a POLICY-AUTHORING TASK ONLY. Zero code, zero schema, zero runtime, zero test.

---

## §0 · PREAMBLE · CONSTITUTIONAL FRAMING

**Framing (locked · from founder):**

> **"Fix 24 does not create NEX1's ability to understand the problem. Fix 24 creates persistence of that understanding."**

**Q8 V2 constitutional statements (from freeze §5 · founder-approved 2026-09-18):**

> **"Q8 V2 may determine what evidence is relevant. It may not authorize execution of a change."**

> **"Fix 24 may retrieve and reuse experience as evidence. Retrieved experience cannot independently authorize modification or execution."**

**Governing invariants preserved from Q8 V1 §17 verbatim:**

- `SELECTED ≠ MODIFIED`
- `SELECTED ≠ EXECUTED`
- `SELECTED ≠ VERIFIED`
- `SELECTED ≠ AUTHORIZED`

**Governing invariants added by Q8 V2 (from freeze §2.3 F2.11-F2.12):**

- `TRUST IN EXPERIENCE ≠ AUTHORITY TO EXECUTE`
- `RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY`
- No autonomous-execution provision may be reintroduced under any renamed form.

**No claim of intelligence** (per founder Part 10): this policy does NOT describe Q8 V2 as creating AGI, consciousness, self-awareness, autonomous intelligence, or equivalent. The purpose is to determine whether NEX1 can reliably reason over prior verified experience.

---

## §1 · PURPOSE · ANSWERS TO FOUNDER'S TEN QUESTIONS

Per founder Part 3, Q8 V2 must answer:

1. **What counts as a retrieved prior experience?** — A row in `data/nex1-investigation-conclusions/entries.jsonl` conforming to `NEX1_EXPERIENCE_SCHEMA_V1` (all 32 fields · A1-E7) with `E2 outcome_class` ∈ {`SUCCESS`, `FAILURE`, `REVERTED_BY_PRESERVATION`} — never a partial or malformed row.

2. **How is the new problem compared with the stored experience?** — Composite retrieval key at four cascading levels: (a) exact match on `pattern_class`, (b) exact match on `intent_shape_hash`, (c) loose match on `structural_shape_hash`, (d) rank by `expected_delta_shape_hash` similarity. Then confirmed by Fix 23b tracer-equivalence check.

3. **What evidence classes are permitted?** — Only three: `RETRIEVED_PRIOR_SUCCESS`, `RETRIEVED_PRIOR_FAILURE`, `RETRIEVED_SUPERFICIAL_MATCH`. Adding classes at runtime is forbidden (F2.7).

4. **How does NEX1 preserve uncertainty?** — By emitting the existing Q8 V1 six-state vocabulary (`SELECTED`, `NO_SELECTION`, `TIE`, `INSUFFICIENT_EVIDENCE`, `UNRESOLVED`, `REQUIRE_MORE_INVESTIGATION`) and never inventing a seventh state; retrieval outcomes reuse this same vocabulary.

5. **When must NEX1 refuse to treat an experience as relevant?** — When (a) tracer refuses evaluation, (b) tracer produces a target_line different from the stored one, (c) stored record is missing required schema fields (V0 legacy or malformed), (d) two retrieved experiences contradict, (e) trust_status is UNTRUSTED.

6. **How are prior success, prior failure and superficial similarity represented?** — Via `candidate_source` field on `RootCauseCandidate` (`"fresh_generated"` | `"retrieved_prior_success"` | `"retrieved_prior_failure"` | `"retrieved_superficial_match"`) plus corresponding evidence-class classification at Fix 13 evaluator.

7. **How does Q8 interact with Fix 23b semantic equivalence?** — Q8 V2 invokes Fix 23b tracer with the stored experience's `tracer_input_args`, `tracer_expected_value`, `literal_current_text`, `literal_proposed_text` against the NEW problem's source. If tracer identifies the same relative target, semantic match is confirmed. If different target or refusal, semantic match fails and retrieval is downgraded.

8. **How does Q8 prevent superficial similarity from becoming false equivalence?** — The retrieval-safety-gate consults Fix 23b BEFORE emitting an evidence class. Surface hash match without tracer confirmation produces `RETRIEVED_SUPERFICIAL_MATCH`, never `RETRIEVED_PRIOR_SUCCESS`.

9. **What evidence is sufficient, insufficient, contradictory or ambiguous?** — Sufficient: tracer-confirmed + trust_status VERIFIED or TRUSTED. Insufficient: schema fields missing, trust_status UNVERIFIED, cold-start (see §2.5 of freeze). Contradictory: two retrieved experiences produce opposite evidence classes for the same candidate. Ambiguous: hash matches at multiple retrieval levels without tracer disambiguation.

10. **Where does Q8 stop and the existing authorization boundary begin?** — Q8 V2 terminates on emitting a selection state. **The authorization boundary begins immediately after that emission.** No Q8 V2 output autonomously triggers CHANGE. Every application of a retrieved solution flows through the same pre-Fix-24 authorization pathway (human/founder in the loop for CHANGE).

---

## §2 · THE NINETEEN DECISIONS · UNDER 19-DECISION DISCIPLINE

Each decision follows the founder's Part 6 structure: statement · alternatives · consequence · evidence · what it does NOT permit · adversarial failure modes · falsifiability · status.

### Decision Q8V2-1 · What triggers Q8 V2 retrieval evaluation?

- **Statement:** Q8 V2 retrieval fires during ACTION 11 (root-cause hypothesis generation) if ACTIONs 1-10 have produced at least one structural candidate.
- **Alternatives considered:** (a) trigger at ACTION 1 (too early — no problem shape known); (b) trigger at ACTION 15 (too late — retrieved evidence would not enter comparison); (c) trigger at ACTION 11 (chosen).
- **Consequence:** Retrieved candidates augment ACTION 11 output, do not replace it.
- **Evidence:** ACTION 11 is where `root_cause_candidates[]` is populated (Fix 12 verifier V1-V14).
- **Does NOT permit:** replacing fresh candidate generation with retrieval; retrieval-only investigation.
- **Adversarial:** retrieval-firing-earlier could bias ACTIONs 3-10 to confirm the retrieved answer.
- **Falsifiability:** if Q8 V2 selection accepts a retrieved candidate without ACTIONs 1-10 having independently produced structural evidence, the trigger is broken.
- **Status:** DRAFT.

### Decision Q8V2-2 · What is the retrieval key composition?

- **Statement:** Composite key: (pattern_class · exact) ∧ (intent_shape_hash · exact) ∧ (structural_shape_hash · loose) ∧ (expected_delta_shape_hash · similarity rank).
- **Alternatives:** (a) single-hash retrieval (too coarse, Test C-vulnerable); (b) four-level cascade (chosen).
- **Consequence:** Retrieval cheap at coarse levels, semantically confirmed only at finest level via tracer.
- **Evidence:** Representation audit §6 — four cascading levels demonstrated tractable.
- **Does NOT permit:** retrieval by verbatim prose similarity (privacy scope 2X-b).
- **Adversarial:** attacker crafts a superficially-matching problem to trigger unsafe retrieval — mitigated by tracer confirmation (Q8V2-5).
- **Falsifiability:** if retrieval fires without at least one hash matching, the retriever is broken.
- **Status:** DRAFT.

### Decision Q8V2-3 · How does retrieval interact with fresh candidate generation?

- **Statement:** Retrieved candidates ADD to the `root_cause_candidates[]` array with `candidate_source ∈ {"retrieved_prior_success", "retrieved_prior_failure", "retrieved_superficial_match"}`; fresh candidates continue to be generated with `candidate_source = "fresh_generated"`.
- **Alternatives:** (a) replace (rejected — biases the investigation); (b) augment (chosen).
- **Consequence:** Q8 V2 selector sees a mixed candidate list and applies rules per Q8V2-13.
- **Evidence:** Freeze §2.2 A2.5.
- **Does NOT permit:** skipping fresh generation when retrieval finds a match.
- **Adversarial:** retrieved candidate could crowd out fresh candidate that would have won — mitigated by Q8V2-13 additivity.
- **Falsifiability:** if fresh-candidate generation is skipped when retrieval fires, the additivity is broken.
- **Status:** DRAFT.

### Decision Q8V2-4 · How is provenance preserved on retrieved candidates?

- **Statement:** Each retrieved candidate carries: `candidate_source`, `retrieved_experience_id`, `retrieval_state`, `tracer_equivalence_verified` (boolean), and inherits `E1 selection_state` + `E2 outcome_class` + `E6 trust_status` from the stored experience.
- **Alternatives:** (a) opaque retrieval (rejected — loses provenance); (b) full pass-through (chosen).
- **Consequence:** Downstream stages know exactly which stored experience contributed.
- **Evidence:** Freeze §1.2 Block E · §2.3 F2.6.
- **Does NOT permit:** anonymised or hashed provenance.
- **Adversarial:** retrieved evidence used without provenance could be uncredibly weighted — mitigated by mandatory field.
- **Falsifiability:** any packet field missing `candidate_source` or `retrieved_experience_id` on a retrieved candidate fails the invariant.
- **Status:** DRAFT.

### Decision Q8V2-5 · How is semantic equivalence verified?

- **Statement:** Q8 V2 invokes Fix 23b `traceDataFlowForLiteralCandidates(input)` against the NEW problem's source with the stored experience's `tracer_input_args` (C4), `tracer_expected_value` (C5), `literal_current_text` (C6), `literal_proposed_text` (C7). Equivalence MATCH requires: same function found, same relative target_line, and tracer_expected_value produced.
- **Alternatives:** (a) hash-only (rejected — Test C fails); (b) tracer confirmation (chosen).
- **Consequence:** Semantic equivalence is a runtime check, not a stored assertion.
- **Evidence:** Representation audit §2, §11 · Fix 23b `TracerRefusal` states already handle all failure modes.
- **Does NOT permit:** treating tracer refusal (`unsupported_expression`, `cross_module_call`, etc.) as MATCH.
- **Adversarial:** stored experience with malformed tracer inputs — mitigated by required schema fields (C4-C7 mandatory).
- **Falsifiability:** if Q8 V2 emits `RETRIEVED_PRIOR_SUCCESS` on a candidate where tracer returned refusal or different target, the check is broken.
- **Status:** DRAFT.

### Decision Q8V2-6 · What are the retrieval outcome states?

- **Statement:** Six states, reusing Q8 V1 vocabulary: `MATCH`, `NO_MATCH`, `AMBIGUOUS`, `INSUFFICIENT_EVIDENCE`, `REJECT`, `REQUIRE_MORE_INVESTIGATION`.
- **Alternatives:** (a) new vocabulary (rejected — vocabulary proliferation); (b) reuse Q8 V1 six-state (chosen).
- **Consequence:** Retrieval state and Q8 selection state use the same words; readers do not need to learn two dictionaries.
- **Evidence:** Freeze §2.2 A2.4.
- **Does NOT permit:** inventing a seventh state (F2.7).
- **Adversarial:** state confusion between retrieval and selection — mitigated by explicit `retrieval_state` field distinct from `selection_state`.
- **Falsifiability:** any output containing a state not in the six is a violation.
- **Status:** DRAFT.

### Decision Q8V2-7 · Mapping retrieval outcome → evidence class

- **Statement:**
  - `MATCH` + stored `E2 outcome_class == SUCCESS` → evidence class `RETRIEVED_PRIOR_SUCCESS`
  - `MATCH` + stored `E2 outcome_class ∈ {FAILURE, REVERTED_BY_PRESERVATION}` → `RETRIEVED_PRIOR_FAILURE`
  - `REJECT` → `RETRIEVED_SUPERFICIAL_MATCH`
  - `AMBIGUOUS` → `RETRIEVED_SUPERFICIAL_MATCH` (conservative)
  - `INSUFFICIENT_EVIDENCE` → no candidate injected
  - `REQUIRE_MORE_INVESTIGATION` → no candidate injected + investigation packet flagged
- **Alternatives:** (a) direct mapping (chosen); (b) probabilistic mapping with weights (rejected — no runtime weights per V1 F2.3).
- **Consequence:** Deterministic map, no hidden inference.
- **Evidence:** Freeze §2.2 A2.6.
- **Does NOT permit:** dynamically choosing an evidence class based on non-schema signals.
- **Adversarial:** AMBIGUOUS being softly treated as MATCH — mitigated by conservative downgrade.
- **Falsifiability:** any output producing `RETRIEVED_PRIOR_SUCCESS` for an AMBIGUOUS retrieval fails the map.
- **Status:** DRAFT.

### Decision Q8V2-8 · What are the three evidence classes' semantics?

- **Statement:**
  - `RETRIEVED_PRIOR_SUCCESS` — a stored experience exists in which the current retrieval's structural shape was fixed by a specific change that was independently verified (D1=0, D2=clean, all sibling tests green, no auto-revert) and remains VERIFIED or TRUSTED in the outcome ledger.
  - `RETRIEVED_PRIOR_FAILURE` — a stored experience exists in which an attempt at this structural shape failed verification (D1≠0 OR D2=reverted OR auto-revert fired).
  - `RETRIEVED_SUPERFICIAL_MATCH` — surface hash matched a stored experience but tracer refused / different target / AMBIGUOUS.
- **Alternatives:** (a) fewer classes (loses fidelity); (b) more classes (violates F2.7); (c) three (chosen).
- **Consequence:** Downstream rules can express nuanced weighting on typed evidence.
- **Evidence:** Founder Part 4.
- **Does NOT permit (per founder Part 4 literally):**
  - `RETRIEVED_PRIOR_SUCCESS ≠ permission to repeat the previous change.`
  - `RETRIEVED_PRIOR_FAILURE ≠ automatic diagnosis of the new problem.`
  - `RETRIEVED_SUPERFICIAL_MATCH ≠ semantic equivalence.`
- **Adversarial:** rebranding `RETRIEVED_PRIOR_SUCCESS` as execution license — mitigated by F2.11 constitutional statement.
- **Falsifiability:** any code that uses `RETRIEVED_PRIOR_SUCCESS` to trigger CHANGE without going through the pre-Fix-24 authorization pathway is a violation.
- **Status:** DRAFT.

### Decision Q8V2-9 · How do the three classes affect Q8 selection? · R-9 / R-10 / R-11 REVIEWED

**R-9 (proposed):** if `RETRIEVED_SUPERFICIAL_MATCH` is present for a candidate, that candidate's overall_status is downgraded to `INSUFFICIENT` regardless of other classes.

- **Review under 19-decision discipline:**
  - **Consequence:** Superficial matches cannot select, no matter what other supporting evidence exists on the candidate.
  - **Alternative rejected:** ignoring superficial matches (Test C would fail).
  - **Does NOT permit:** SUPPORTING evidence overriding a SUPERFICIAL_MATCH downgrade.
  - **Adversarial:** attacker adds SUPPORTING structural evidence to a superficially-matched candidate hoping to bypass the downgrade — R-9 preserves the downgrade.
  - **Falsifiability:** Test C — a candidate with SUPERFICIAL_MATCH plus SUPPORTING evidence must NOT be SELECTED.
  - **Status:** DRAFT · policy retains R-9 unchanged pending founder review.

**R-10 (proposed):** if `RETRIEVED_PRIOR_FAILURE` is present for a candidate, that candidate's overall_status is downgraded to `CONTRADICTED` (blocking).

- **Review under 19-decision discipline:**
  - **Consequence:** A candidate that previously failed cannot re-select even if new SUPPORTING evidence appears.
  - **Alternative rejected:** softer weighting (would allow "try again" behaviour without founder authorization).
  - **Does NOT permit:** overriding failure history with fresh SUPPORTING evidence.
  - **Adversarial:** stored FAILURE was itself a false-fail (e.g., preservation-check bug at time of storage). Under R-10 the failure blocks forever until UNTRUSTED demotion.
  - **Refinement proposal for founder consideration:** allow SUPPORTING structural evidence to override PRIOR_FAILURE only when the FAILURE record is older than N days AND the tracer produces a materially different literal (i.e., the new fix is not the same as the failed fix). If founder rejects the refinement, R-10 remains as-drafted.
  - **Falsifiability:** if any code allows a `RETRIEVED_PRIOR_FAILURE` candidate to SELECT without founder-approved refinement, the rule is broken.
  - **Status:** DRAFT · refinement proposal appended for founder consideration.

**R-11 (proposed):** `RETRIEVED_PRIOR_SUCCESS` counts as SUPPORTING evidence in the V1 R-4 SUPPORTING_MAJORITY rule, provided its `E6 trust_status` is `VERIFIED` or `TRUSTED`.

- **Review under 19-decision discipline:**
  - **Consequence:** A single retrieved-and-verified success can contribute to the SUPPORTING count, but never on its own — R-4 SUPPORTING_MAJORITY requires the SUPPORTING count > CONTRADICTING count, so at least one fresh structural evidence is still required.
  - **Alternative rejected:** allowing SUCCESS alone to drive selection (would violate 4A NEVER — SUCCESS becomes execution license).
  - **Does NOT permit:** selection where the only SUPPORTING evidence is retrieved.
  - **Refinement proposal for founder consideration:** require at least 1 fresh SUPPORTING structural evidence in addition to any retrieved SUPPORTING evidence, before R-4 can fire. This makes the "solo retrieved success" case explicit `NO_SELECTION`. If founder approves, this becomes a new sub-rule R-11.1.
  - **Adversarial:** stored SUCCESS was itself a false-green. Mitigated by trust_status gate — trust decay demotes such records.
  - **Falsifiability:** Test B — a candidate with ONE `RETRIEVED_PRIOR_SUCCESS` and ZERO fresh structural evidence must NOT SELECTED under proposed R-11.1.
  - **Status:** DRAFT · R-11.1 refinement proposal appended.

**R-12 (new · proposed):** every Q8 V2 selection output must record `retrieved_evidence_contributed: boolean` — TRUE if any retrieved evidence class was present in the SUPPORTING or CONTRADICTING count that produced the final selection state, else FALSE.

- **Rationale:** reporting field enabling adversarial verification (Test C's runtime trace must show whether retrieval actually contributed to the selection).
- **Does NOT permit:** hiding retrieval participation.
- **Status:** DRAFT.

### Decision Q8V2-10 · How is `E6 trust_status` computed and consumed?

- **Statement:** Computed deterministically from outcome-ledger per freeze §2.2 A2.10 (UNVERIFIED / VERIFIED / TRUSTED / UNTRUSTED). Consumed ONLY by R-11 as a gate on `RETRIEVED_PRIOR_SUCCESS` participation. Never consumed by any execution decision.
- **Alternatives:** (a) trust as execution gate (rejected · violates 4A · F2.11); (b) trust as evidence gate only (chosen).
- **Does NOT permit:** trust_status affecting CHANGE stage decisions.
- **Adversarial:** trust_status appearing in execution-path code — must fail F2.11 review during Fix 24 Phase A.
- **Falsifiability:** any Fix 24 code that references trust_status outside the R-11 evaluator is a violation.
- **Status:** DRAFT.

### Decision Q8V2-11 · Trust decay + re-verification rules (from freeze §2.4 D.1-D.4)

- **Statement:** FAILURE decrements `E4 reuse_success_count` by 2. When E4 < 1, trust_status becomes UNTRUSTED. UNTRUSTED experiences continue to be persisted (never deleted) but retrieval maps them to `RETRIEVED_PRIOR_FAILURE`. Re-verification path: 3 consecutive SUCCESS outcomes restore VERIFIED.
- **Alternatives:** (a) delete on failure (loses evidence); (b) preserve + demote (chosen).
- **Does NOT permit:** experience deletion.
- **Adversarial:** attacker triggers artificial failures to demote a legitimate experience — mitigated by 5B CONSERVATIVE strict outcome-verification requirements.
- **Falsifiability:** any UNTRUSTED experience contributing to a SELECTED outcome via `RETRIEVED_PRIOR_SUCCESS` is a violation.
- **Status:** DRAFT.

### Decision Q8V2-12 · Cold-start rules (from freeze §2.5 C.1-C.3 · corrected under 4A)

- **Statement:** No execution threshold. Evidence-maturity threshold: while fewer than 3 experiences of a given structural shape exist, retrieval emits `INSUFFICIENT_EVIDENCE` or `REQUIRE_MORE_INVESTIGATION`.
- **Alternatives:** (a) execution threshold (rejected under 4A); (b) evidence-maturity threshold (chosen).
- **Does NOT permit:** any cold-start unlock for CHANGE stage.
- **Adversarial:** attacker seeds 3+ artificial experiences of a shape — mitigated by 5B strict outcome-verification (artificial experiences must pass exit_code=0 + preservation clean + all sibling tests + no auto-revert).
- **Falsifiability:** first Fix 24 real run where retrieval fires as MATCH on fewer than 3 stored experiences is a violation.
- **Status:** DRAFT.

### Decision Q8V2-13 · How contradictions are handled

- **Statement:** If two retrieved experiences produce opposite evidence classes for the same candidate (one PRIOR_SUCCESS, one PRIOR_FAILURE), Q8 V2 emits selection state `UNRESOLVED` with `contradiction_evidence_ids` field populated. Neither retrieved evidence contributes to R-4 SUPPORTING_MAJORITY under contradiction. Fresh candidate generation continues.
- **Alternatives:** (a) silently pick the more-recent record (rejected · founder Part 9 Case E); (b) surface contradiction (chosen).
- **Does NOT permit:** silent tie-breaking on stored evidence.
- **Adversarial:** contradictory stored records — mitigated by explicit UNRESOLVED emission with both provenance chains.
- **Falsifiability:** any Q8 V2 output silently choosing between contradicting retrieved records is a violation.
- **Status:** DRAFT.

### Decision Q8V2-14 · Q8 V2 reporting contract

- **Statement:** Every Q8 V2 output must include: `selection_state`, `selected_candidate`, `retrieval_state`, `retrieved_experience_ids[]` (may be empty), `candidate_sources_used[]`, `retrieved_evidence_contributed` (Q8V2-9 R-12), `contradiction_evidence_ids[]` (may be empty), `tracer_equivalence_verified` (per candidate), `provenance_chain_hash`.
- **Alternatives:** (a) minimal reporting (loses auditability); (b) full reporting (chosen).
- **Does NOT permit:** dropping any of the above fields on any output.
- **Adversarial:** truncated reporting hiding retrieval participation — mitigated by mandatory fields.
- **Falsifiability:** any Q8 V2 output missing any of the 9 fields is a violation.
- **Status:** DRAFT.

### Decision Q8V2-15 · Hard execution boundary · CONSTITUTIONAL (locked by founder)

- **Statement:** Q8 V2 may `OBSERVE → EXTRACT → COMPARE → CLASSIFY → SELECT EVIDENCE → PRESERVE UNCERTAINTY → REPORT`. Q8 V2 may NOT `AUTHORIZE → MODIFY → EXECUTE → DEPLOY`.
- **Alternatives:** NONE — this is a founder constitutional statement.
- **Consequence:** Every Fix 24 module must terminate at REPORT. The CHANGE stage remains outside Q8 V2's authority.
- **Does NOT permit:** any renamed provision equivalent to execution authority.
- **Adversarial:** renamed autonomous-execution provisions (`AUTHORIZED_SELECTED`, `PROVEN_SELECTED`, `HIGH_CONFIDENCE_SELECTED`) — forbidden by F2.12.
- **Falsifiability:** any Q8 V2 code that writes to disk, invokes vitest, or calls an operator is a violation.
- **Status:** FOUNDER-APPROVED (constitutional boundary per freeze §5).

### Decision Q8V2-16 · Integration with Fix 23b

- **Statement:** Q8 V2 invokes Fix 23b `traceDataFlowForLiteralCandidates()` as a READ-ONLY equivalence check. Fix 23b remains authoritative for semantic evaluation. Q8 V2 does not modify Fix 23b behaviour, does not extend its safe-evaluator, and does not accept tracer refusals as MATCH.
- **Alternatives:** (a) new equivalence engine (rejected · representation audit §2 identifies Fix 23b as sufficient); (b) reuse Fix 23b (chosen).
- **Does NOT permit:** extending Fix 23b's safe evaluator to accept additional constructs.
- **Adversarial:** Fix 23b refusal being coerced into MATCH — mitigated by Q8V2-5 explicit refusal handling.
- **Falsifiability:** any Q8 V2 test case where MATCH is emitted on tracer refusal is a violation.
- **Status:** DRAFT.

### Decision Q8V2-17 · Integration with Fix 23c preservation-check

- **Statement:** Q8 V2 has NO interaction with Fix 23c at runtime. Preservation-check remains a coding-pipeline concern that runs AFTER CHANGE, which is downstream of Q8 V2's REPORT boundary.
- **Alternatives:** (a) Q8 V2 consulting preservation-check (rejected · Q8 V2 ends at REPORT before CHANGE runs); (b) no interaction (chosen).
- **Does NOT permit:** Q8 V2 inferring preservation success/failure at selection time.
- **Adversarial:** none anticipated.
- **Falsifiability:** any Q8 V2 code that reads or writes Fix 23c state is a violation.
- **Status:** DRAFT.

### Decision Q8V2-18 · Forbidden behaviours (locked by freeze §2.3 F2.1-F2.12)

Preserved verbatim from freeze §2.3:
- F2.1 · MUST NOT authorize CHANGE from SELECTED alone
- F2.2 · MUST NEVER authorize CHANGE from ANY emitted state
- F2.3 · MUST NOT read confidence as selection weighting
- F2.4 · MUST NOT use LLM at runtime
- F2.5 · MUST NOT bypass Fix 23c preservation-check (when CHANGE runs)
- F2.6 · MUST NOT hide provenance
- F2.7 · MUST NOT invent new evidence classes at runtime
- F2.8 · MUST NOT modify Q7 policy
- F2.9 · MUST NOT bridge to cross-store queries
- F2.10 · MUST NOT silently apply a retrieved fix
- F2.11 · TRUST IN EXPERIENCE ≠ AUTHORITY TO EXECUTE
- F2.12 · No autonomous-execution renames

- **Status:** FOUNDER-APPROVED (constitutional).

### Decision Q8V2-19 · Falsifiability standard · Test A/B/C/D/E

Q8 V2 policy is falsified by any of:

- **Test A · Genuine match** (founder Part 9 Case A) — expected: retrieve · compare · classify · use as evidence · preserve provenance · continue through normal verification. If Test A does NOT produce a runtime trace containing `retrieved_experience_id != null` and `tracer_equivalence_verified == true`, Q8V2-4 or Q8V2-5 are broken.

- **Test B · Superficial match** (founder Part 9 Case B) — expected: detect mismatch · preserve uncertainty · reject or escalate. If Test B produces `RETRIEVED_PRIOR_SUCCESS` where tracer identified different target_line, Q8V2-5 or Q8V2-7 are broken.

- **Test C · Prior failure** (founder Part 9 Case C) — expected: retrieve as negative evidence · do not repeat blindly · preserve failure provenance. If Test C produces a SELECTED candidate matching a `RETRIEVED_PRIOR_FAILURE` record without R-10 refinement founder-approved, Q8V2-9 R-10 is broken.

- **Test D · Insufficient evidence** (founder Part 9 Case D) — expected: `INSUFFICIENT_EVIDENCE` state, no forced decision. If Test D produces SELECTED under evidence-thin conditions (cold-start, malformed record), Q8V2-12 or Q8V2-8 are broken.

- **Test E · Contradictory evidence** (founder Part 9 Case E) — expected: preserve both provenance chains · surface contradiction · do not silently choose. If Test E produces SELECTED with only one of two contradicting retrieved records reported, Q8V2-13 is broken.

- **Status:** DRAFT · verifier probe will be authored under Fix 24 Phase D once Q8 V2 operational policy is founder-approved.

---

## §3 · WHAT Q8 V2 EXPLICITLY DOES NOT PERMIT

Restated for readability across the whole policy:

1. **No autonomous execution.** Q8 V2 terminates at REPORT.
2. **No autonomous authorization.** Retrieval is evidence; CHANGE requires the pre-Fix-24 authorization pathway.
3. **No autonomous modification.** No Fix 24 module writes to `src/`, `data/`, or invokes an operator directly from Q8 V2 output.
4. **No autonomous deployment.** Fix 24 does not touch build, CI, or release pipelines.
5. **No renaming of autonomous execution.** F2.12 preserved.
6. **No confidence-driven selection.** F2.3 preserved.
7. **No cross-store queries.** F2.9 preserved.
8. **No LLM.** F2.4 preserved.
9. **No hidden provenance.** F2.6 preserved.
10. **No invention of new evidence classes at runtime.** F2.7 preserved.

---

## §4 · FIX 24 DEPENDENCY

**Q8 V2 policy approval is a prerequisite to Fix 24 implementation.**

But **Q8 V2 policy approval does NOT itself authorize autonomous execution**.

After Q8 V2 is founder-approved, the next permitted action is:

> **Fix 24 Phase A · PRE-BUILD AUDIT · READ-ONLY.**

Not implementation. Not Phase B. Pre-build audit only.

Phase A produces a documentation-only artefact that verifies:
- Every Q8V2-1..Q8V2-19 decision has a source-code touchpoint identified
- Every touchpoint is confirmed to be under existing zero-LLM constraint
- Every schema field (A1-E7) has a runtime source identified
- No F2.1-F2.12 violation is possible in the proposed connection points
- Fix 24 Phase B scope is confirmed at ~550 LOC (from decision instrument §7) or amended with documented reasoning

Only after Phase A is founder-reviewed and approved does Phase B (Build) become permitted.

---

## §5 · REFINEMENT PROPOSALS FOR FOUNDER CONSIDERATION

The 19-decision review surfaced two refinement proposals to R-10 and R-11 that the founder may accept, reject, or defer:

**R-10 refinement (proposed):**
> Allow SUPPORTING structural evidence to override `RETRIEVED_PRIOR_FAILURE` only when: (a) the FAILURE record is older than N days (N = founder-approved constant, initially proposed at 90), AND (b) the tracer produces a materially different literal from the failed one.
>
> Rationale: prevents permanent lockout when the underlying code has evolved past the original failure. Preserves safety by requiring tracer confirmation of "different fix."
>
> Founder decision required: ACCEPT / REJECT / DEFER.

**R-11.1 refinement (proposed):**
> Require at least 1 fresh SUPPORTING structural evidence in addition to any retrieved SUPPORTING evidence, before R-4 SUPPORTING_MAJORITY can fire.
>
> Rationale: guarantees that no candidate SELECTED under Q8 V2 is exclusively evidenced by retrieval. Anti-Test-C hardening.
>
> Founder decision required: ACCEPT / REJECT / DEFER.

Both refinements strengthen the constitutional invariant `RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY`. Both are optional.

---

## §6 · DOCUMENTATION-ONLY CONSISTENCY AUDIT

Per founder Part 11, audit against seven artifacts:

### 6.1 · Against `NEX1_EXPERIENCE_SCHEMA_V1` (freeze §1 · founder-approved)

- Q8V2-1 references ACTION 11 · consistent with schema Block E context.
- Q8V2-2 references B1-B8 (intent_shape_hash, structural_shape_hash) and C1 (pattern_class) — all present in Schema V1.
- Q8V2-5 references C4-C7 (tracer fields) — all present.
- Q8V2-10 references E6 trust_status — present with evidence-maturity semantics preserved.
- Q8V2-11 references E4 reuse_success_count — present.
- Q8V2-12 references cold-start threshold — matches freeze §2.5 C.1-C.3.
- **Verdict: NO CONTRADICTION with Schema V1.** ✓

### 6.2 · Against Founder Policy Decision Instrument

- Recorded decisions: 1B / 2B / 2X-b / 3C / 4A / 5B all reflected consistently.
- 4Y clarification reflected in Q8V2-15 hard-execution-boundary statement.
- 5X / 5Y remain PENDING — Q8V2-11 uses freeze §2.4 D.1-D.4 as governing rules (which are founder-approved constitutional per §5 signature).
- **Verdict: NO CONTRADICTION with the instrument.** ✓

### 6.3 · Against Q8 V1 (Selection Policy V1 · founder-approved 2026-09-17)

- Q8 V1 §17 invariant (SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED) preserved verbatim (Q8V2 §0 preamble).
- Q8 V1 8-step precedence rule ordering unchanged; Q8V2-9 adds R-9/R-10/R-11 as ADDITIVE rules (per freeze §2.2 A2.7).
- Q8 V1 §4 Decision 11 (confidence INFORMATIONAL-ONLY) preserved (Q8V2-18 F2.3).
- **Verdict: NO CONTRADICTION with Q8 V1.** ✓

### 6.4 · Against Fix 23b semantic-equivalence machinery

- Q8V2-5 and Q8V2-16 invoke Fix 23b as READ-ONLY equivalence check.
- Q8V2-5 respects all `TracerRefusal` states (`unsupported_expression`, `cross_module_call`, etc.).
- No proposal to extend Fix 23b's safe-evaluator.
- **Verdict: NO CONTRADICTION with Fix 23b.** ✓

### 6.5 · Against Fix 23c preservation/verification boundary

- Q8V2-17 states Q8 V2 has NO interaction with Fix 23c at runtime.
- Preservation-check remains authoritative on CHANGE outcomes.
- **Verdict: NO CONTRADICTION with Fix 23c.** ✓

### 6.6 · Against Fix 24 Freeze (Schema V1 + Q8 V2 Doctrine constitutional boundary)

- All Q8V2 decisions defer to freeze §2.2 A2.1-A2.10 and §2.3 F2.1-F2.12.
- R-9/R-10/R-11 remain marked DRAFT per freeze §2.2 A2.7 disposition.
- Refinement proposals R-10 and R-11.1 in §5 are surfaced for founder review, not silently applied.
- **Verdict: NO CONTRADICTION with the freeze.** ✓

### 6.7 · Against the founder's 4A / 5B decisions

- 4A NEVER: Q8V2-15 constitutional statement + Q8V2-18 F2.2 preserved.
- 5B CONSERVATIVE: Q8V2-8 outcome_class SUCCESS definition matches (exit_code=0 AND preservation clean AND sibling tests green AND no auto-revert).
- **Verdict: NO CONTRADICTION with 4A / 5B.** ✓

### 6.8 · Additional audit items

- **Duplicated rules:** none detected.
- **Missing decisions:** none of the 19 required decisions are missing.
- **Ambiguous terminology:** none detected. Every state, class, and field is defined against Schema V1 or Q8 V1 vocabulary.
- **Rules that accidentally imply execution authority:** none detected. Every rule terminates at REPORT.
- **Rules that require founder approval:** R-9 / R-10 / R-11 (DRAFT); R-10 refinement (proposal); R-11.1 refinement (proposal); Q8 V2 policy as a whole (DRAFT).
- **Version-numbering consistency:** Q8 V1 remains V1; Q8 V2 = this policy + freeze §5 constitutional boundary combined. Fix 15 Q7 unchanged.

---

## §7 · FINAL STATUS

**`Q8_V2_POLICY_DRAFT_READY_FOR_FOUNDER_REVIEW`**

## §8 · WHAT HAPPENS NEXT

Per founder rules:

1. Founder reviews this DRAFT policy at their pace.
2. Founder decides on the 19 decisions Q8V2-1 through Q8V2-19 (either accepting all as DRAFT, accepting with amendments, or rejecting specific decisions).
3. Founder decides on R-10 and R-11.1 refinement proposals (accept / reject / defer).
4. If accepted, this document becomes `NEX1_Q8_V2_OPERATIONAL_POLICY_V1` — load-bearing artefact ranked alongside Q7 V1 / Q8 V1 / Schema V1 / Q8 V2 Doctrine.
5. After Q8 V2 operational policy is founder-approved, Fix 24 Phase A pre-build audit becomes permitted.
6. **Not before.**

## §9 · WHAT THIS DOCUMENT IS NOT

- Not an implementation.
- Not a schema change.
- Not a runtime code addition.
- Not an authorization for autonomous execution.
- Not a claim of intelligence, learning, generalisation beyond persistence + retrieval + evidence classification.

## §10 · FINAL FRAMING

Restated for the Q8 V2 record:

> **"Q8 V2 may determine what evidence is relevant. It may not authorize execution of a change."**

> **"Fix 24 may retrieve and reuse experience as evidence. Retrieved experience cannot independently authorize modification or execution."**

> **"Fix 24 does not create NEX1's ability to understand the problem. Fix 24 creates persistence of that understanding."**

Zero code changes. Zero implementation. Zero autonomous execution. Awaiting founder review.
