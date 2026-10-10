# NEX1 Q8 V2 · Operational Policy · v4 documentation correction of v2 · DRAFT

**Date drafted (initial):** 2026-09-18
**Date corrected (v2 round):** 2026-09-18
**Date corrected (v3 round):** 2026-09-18
**Date corrected (v4 round · this correction):** 2026-09-18
**Author:** master_ai_engineer (Claude Opus 4.7)
**Status:** `Q8_V2_V4_DOCUMENTATION_CORRECTION_COMPLETE · PENDING_FORENSIC_REVIEW`
**Naming note:** the file remains `nex1-q8-v2-operational-policy-v2-2026-09-18.md` per founder direction (existing document is the authoritative Q8 V2 doctrine; not creating a versioned copy). "v3" and "v4" refer to correction rounds of this doctrine, not filename changes.
**Correction sourced from:**
- Founder decisions F1-C · F2-B · F4-C · F6-C · F10-B (recorded 2026-09-18)
- Forensic Review #2 findings F1-F15 (v2 round · addressed)
- Forensic Review #3 findings F16-F30 (v3 round · addressed)
- Forensic Review #4 findings F31 · F32 · F34 · F39 · F41 (v4 round · addressed by this correction)
- Pre-Fix-24 baseline measurement (recorded 2026-09-18)

**Load-bearing dependencies:**
- `NEX1_EXPERIENCE_SCHEMA_V1` — founder-approved 2026-09-18 · **frozen · not modified**
- `NEX1_Q8_V2_DOCTRINE` constitutional boundary — founder-approved 2026-09-18
- `NEX1_Q8_SELECTION_POLICY_V1` — founder-approved 2026-09-17 · unchanged
- `NEX1_RANKING_POLICY_V1` (Q7) — founder-approved 2026-09-17 · unchanged
- Six founder decisions confirmed 2026-09-18 (R10-C · R11-B · R10-C-1..4)
- Five founder decisions confirmed 2026-09-18 (F1-C · F2-B · F4-C · F6-C · F10-B)
- Fix 23b data-flow tracer · RUNTIME_VERIFIED 2026-09-17 · unchanged
- Fix 23c preservation-check · RUNTIME_VERIFIED 2026-09-17 · unchanged
- Companion: `nex1-r10c-prerequisites-founder-confirmed-and-architectural-dependencies-2026-09-18.md`
- Companion: `nex1-q8-v2-founder-decisions-f1-f2-f4-f6-f10-2026-09-18.md`

**Scope of this correction task:** apply founder-confirmed F1-C / F2-B / F4-C / F6-C / F10-B and resolve F1-F15 forensic findings **without** silently resolving the five unresolved sub-dependencies (A-E) and **without** implementing anything. **No code. No schema change. No test.**

---

## §0 · Constitutional Preamble · locked

**Framing (founder-locked):**

> **"Fix 24 does not create NEX1's ability to understand the problem. Fix 24 creates persistence of that understanding."**

**Constitutional invariants preserved verbatim (unchanged from prior founder-approved artifacts):**

- `MEMORY = EVIDENCE · MEMORY ≠ AUTHORITY`
- `MEMORY SHOULD INFORM INVESTIGATION, NOT REPLACE INVESTIGATION`
- `RETRIEVED EXPERIENCE = EVIDENCE ABOUT THE PAST`
- `RETRIEVED EXPERIENCE ≠ CURRENT PROOF`
- `TRUST IN EXPERIENCE ≠ AUTHORITY TO EXECUTE`
- `REMEMBER ≠ UNDERSTAND ≠ PROVE ≠ SELECT ≠ MODIFY ≠ EXECUTE ≠ AUTHORIZED`
- `SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED`
- `DESCRIBE ≠ IMPLEMENT ≠ WIRE ≠ EXECUTE ≠ VERIFY`
- `UNKNOWN ≠ SAME` · `NOT IMPLEMENTED ≠ NO DIFFERENCE`
- `PRIOR FAILURE ≠ AUTHORITY` · `PRIOR FAILURE ≠ PERMANENT VETO`
- `CONSTITUTIONAL SCOPE = GLOBAL` · `RUNTIME ENFORCEMENT = CAPABILITY-DEPENDENT`

**No provision in this policy weakens or reinterprets any invariant above.**

---

## §1 · Purpose and Scope

Q8 V2 v2 defines the runtime behaviour of NEX1 when retrieved prior experience becomes available during an investigation. It governs:

1. How retrieval attempts are classified (attempted vs contributed).
2. How retrieval contributions become typed evidence.
3. How that evidence interacts with Q8 selection under R11-B.
4. How material difference is determined (R10-C-1 D · Composite · under F10-B).
5. How fresh evidence is qualified (R10-C-2 C · Independent Verification · under F1-C).
6. How Fix 23b's tracer output is used (R10-C-3 D · Necessary but not sufficient).
7. How circular reasoning is prevented (R10-C-4 D · Composite Anti-Circularity · under F6-C).
8. How contradictions are preserved (F4-C · separate contradiction path).
9. How prior failure guides without vetoing (F2-B).
10. How Q8 V2 outputs are reported and stop at the existing authorization boundary.

**Out of scope:**
- Any implementation (documentation-only).
- Any Schema V1 amendment (Schema V1 is frozen).
- Any authorization of autonomous execution.
- Any Fix 24 build activity.
- Silent resolution of sub-decisions A-E (see §18 unresolved dependencies).

## §2 · Founder-Confirmed Decisions

Eleven decisions, all confirmed 2026-09-18. Immutable within this policy.

| Decision | Value | Documented at |
|---|---|---|
| R10 | R10-C · EVIDENCE-BASED REFINEMENT WITHOUT AGE | Forensic findings freeze §3 |
| R11 | R11-B · RETRIEVED EXPERIENCE CANNOT SATISFY SUPPORTING_MAJORITY | Forensic findings freeze §4 |
| R10-C-1 | D · COMPOSITE | R10-C prerequisites decision instrument §13 |
| R10-C-2 | C · INDEPENDENT VERIFICATION | same |
| R10-C-3 | D · NECESSARY BUT NOT SUFFICIENT | same |
| R10-C-4 | D · COMPOSITE ANTI-CIRCULARITY | same |
| F1 | C · SEPARATE RETRIEVAL ATTEMPT FROM RETRIEVAL CONTRIBUTION | Founder decisions recording 2026-09-18 |
| F2 | B · PRIOR FAILURE GUIDES, NEVER BLOCKS | same |
| F4 | C · SEPARATE CONTRADICTION PATH | same |
| F6 | C · CONSTITUTIONAL GLOBAL, OPERATIONALLY PHASED | same |
| F10 | B · CONSERVATIVE INDETERMINATE | same |

## §3 · Authority Boundaries

**Q8 V2 v2 may (permitted):**
- OBSERVE inputs to a Q8 evaluation
- EXTRACT candidates from prior investigation ACTIONs
- COMPARE candidates against retrieval results
- CLASSIFY evidence (into V1 classes or the three retrieved-evidence classes below)
- SELECT under Q8 V1's precedence rules extended by this v2 policy
- PRESERVE UNCERTAINTY via the V1 six-state selection vocabulary
- REPORT its outputs (including append-only JSONL writes to `data/nex1-investigation-conclusions/entries.jsonl` per Fix 17 discipline · NOT to be confused with "writing source code")

**Q8 V2 v2 may NOT (forbidden):**
- AUTHORIZE any CHANGE stage execution from any selection state
- MODIFY source, tests, schema, or state
- EXECUTE operators, tests, or side-effectful runtime paths
- DEPLOY changes
- BYPASS Fix 23c preservation-check
- HIDE provenance
- Read confidence as a selection weight (F2.3 preserved · confidence remains INFORMATIONAL-ONLY per Q8 V1 §4 Decision 11)
- Use LLM at runtime
- Invent evidence classes at runtime
- Modify Q7
- Query stores other than `data/nex1-investigation-conclusions/entries.jsonl`
- Silently apply retrieved fix
- Reintroduce autonomous execution under any renamed form

The final REPORT boundary is absolute. Any application of a retrieved solution proceeds through the pre-Fix-24 authorization pathway, unchanged.

---

## §4 · Q8 V2 Retrieval States · Corrected · Fully Defined · Terminology Clarified

**Terminology correction (F1 finding · F8 finding):** the six Q8 V2 retrieval states are a **new vocabulary at the retrieval layer**. They are NOT Q8 V1 selection states. Two labels are shared between the two vocabularies (`INSUFFICIENT_EVIDENCE`, `REQUIRE_MORE_INVESTIGATION`) — where either token appears, it is qualified by layer: `Q8V2_RETRIEVAL_STATE::INSUFFICIENT_EVIDENCE` vs `Q8V1_SELECTION_STATE::INSUFFICIENT_EVIDENCE`. In this document, unqualified uses refer to retrieval state; where selection state is meant, it is written `Q8V1_SELECTION_STATE::<name>` explicitly.

**Six retrieval states.** Each with cause, evidence, meaning, non-meaning, next action, and authority disposition. Under F1-C, retrieval outcomes are separated into "attempted" vs "returned usable candidate."

**⚠️ CURRENT-CAPABILITY OPERATIONAL VACUITY (F16 disclosure · load-bearing):** Under current architecture and while Sub-decision D remains unresolved, the composite material-difference rule at §6.3 forces `INDETERMINATE` on every evaluation (see the reachability chain documented in §6.3, §10.2, and §22 check 11). This means `MATCH` (§4.1) cannot fire, `retrieval_returned_usable_candidate` is universally `false`, and §10.2 Honest Degrade never activates. **F1-C is `POLICY DEFINED` but its retrieval-contribution protection is `NOT CURRENTLY REACHABLE` and therefore `NOT CURRENTLY ENFORCED` at runtime.** This is a capability-honest disclosure, not an implementation failure by Q8 V2 v2 itself. Distinguish `POLICY DEFINED` from `CURRENTLY REACHABLE` from `CURRENTLY ENFORCED` throughout.

**Retrieval subsystem failure (F26 disclosure):** the six retrieval states below cover expected retrieval outcomes. They do NOT cover retrieval subsystem internal failure (crash · timeout · malformed response · unavailable retrieval provider · internal exception). **No state currently exists for retrieval subsystem failure.** Handling is `FOUNDER / ARCHITECTURE DEFINITION REQUIRED` — either an existing state should be authoritatively mapped, or a seventh state (e.g., `RETRIEVAL_UNAVAILABLE`) should be added by future authorised architectural decision. This policy does not invent a new state.

### 4.1 · `MATCH`

- **Cause (F1-C applied):** composite retrieval key (§7.2) satisfied AND Fix 23b tracer-equivalence check emits `TracerOk` with all four sub-criteria per §8.3 satisfied AND all R10-C-1 D dimensions available under current capability report "not different". Under **F10-B**: if any safety-relevant dimension is `NOT IMPLEMENTED`, MATCH does NOT fire; the outcome escalates to `REQUIRE_MORE_INVESTIGATION` (§4.6). MATCH implies `retrieval_returned_usable_candidate == true`.

  **F41 correction (v4):** the prior "no downgrade to `SUPERFICIAL_MATCH` per §5.3 is triggered" clause has been removed as redundant — the "all R10-C-1 D dimensions ... report 'not different'" condition already excludes any downgrade-to-SUPERFICIAL scenario (per §5.3, SUPERFICIAL_MATCH is produced precisely when at least one R10-C-1 D dimension reports "different" or fails equivalence). The prior clause was introduced under F17 to replace an invalid cross-reference to §9.2; it added no independent logical condition. Removing it eliminates redundancy without weakening the MATCH criteria.
- **⚠️ Current-capability note (F16):** under current capability + Sub-decision D pending, MATCH is unreachable (see §6.3 chain). This state is a `POLICY-DEFINED · CURRENTLY UNREACHABLE` state. All bullets below describe what happens WHEN MATCH fires; no packet currently reaches this state at runtime.
- **Evidence supporting:** stored experience record fields C4-C7 · Fix 23b `TracerOk` output on current source · R10-C-1 D per-dimension outputs.
- **What it means:** current source contains a candidate that is structurally-and-arithmetically-consistent with a stored fix, and all currently-evaluable safety-relevant dimensions concur, under the founder-confirmed non-sufficiency principle (R10-C-3 D).
- **What it does NOT mean:** the fix should be applied · the fix is semantically appropriate · execution is authorised · every dimension has been verified (some may be `NOT IMPLEMENTED`, in which case MATCH does not fire under F10-B).
- **Next action:** evidence classification → `RETRIEVED_PRIOR_SUCCESS` or `RETRIEVED_PRIOR_FAILURE` per §5, feed into Q8 selection under R11-B constraint (§10).
- **May influence selection?** As evidence input only. Retrieved evidence never enters R-4 SUPPORTING count.
- **May authorize modification?** `MODIFICATION AUTHORITY = NO`
- **May authorize execution?** `EXECUTION AUTHORITY = NO`

### 4.2 · `NO_MATCH`

- **Cause (F8 finding resolved):** retrieval index scan returned no stored experience satisfying the coarse composite retrieval key at pattern_class / intent_shape_hash / structural_shape_hash / expected_delta_shape_hash. NO_MATCH implies `retrieval_attempted == true` AND `retrieval_returned_usable_candidate == false`.
- **Evidence supporting:** empty result set from retrieval index scan.
- **What it means:** no historically-similar experience is available.
- **What it does NOT mean:** there is no similar experience anywhere (only that none is in the store) · the current investigation has any less evidence to work with.
- **Next action (F1-C applied):** proceed with fresh-only investigation. **Because retrieval did not return a usable candidate, Honest Degrade (§10.2) does NOT fire.** Fresh evidence is admitted normally.
- **May influence selection?** No effect. Fresh-only path proceeds.
- **May authorize modification / execution?** NO / NO.

### 4.3 · `AMBIGUOUS`

- **Cause (F7 finding resolved):** multiple stored experiences match at the coarse composite key AND Fix 23b tracer cannot cleanly disambiguate (tracer emits MATCH for more than one candidate). AMBIGUOUS implies `retrieval_attempted == true` AND multiple partial-match candidates exist but none uniquely resolves.
- **Evidence supporting:** multi-hit retrieval index result · tracer disambiguation failure.
- **What it means:** retrieval cannot definitively identify a single relevant experience.
- **What it does NOT mean:** all matches are false · one of them must be right.
- **Next action:** downgrade retrieval evidence to `RETRIEVED_SUPERFICIAL_MATCH` (per §5.3 · conservative default per Q7 principle "SELECTED requires evidence stronger than surface"). Under F1-C: AMBIGUOUS does not qualify as `retrieval_returned_usable_candidate == true`, so Honest Degrade does not fire.
- **May influence selection?** Only via SUPERFICIAL_MATCH downgrade rule (§5.3), which never counts toward SUPPORTING.
- **May authorize modification / execution?** NO / NO.

### 4.4 · `INSUFFICIENT_EVIDENCE` (retrieval layer · distinct from Q8V1_SELECTION_STATE::INSUFFICIENT_EVIDENCE)

- **Cause (F7 priority rule):** stored experience record is missing required Schema V1 Block A-E fields (e.g., V0 legacy row) OR trust ledger indicates `UNVERIFIED` status. Cold-start threshold (fewer than 3 similar experiences of the shape) also fires this state IF the missing-shape count is the determining condition. If tracer refusal is the determining condition, the state emits as `REQUIRE_MORE_INVESTIGATION` (§4.6) instead — precedence: schema-completeness check runs first; if that passes, tracer-availability check runs second.
- **Evidence supporting:** schema-field completeness check output · ledger read output.
- **What it means:** retrieval result cannot be responsibly classified as MATCH or REJECT due to insufficient stored data.
- **What it does NOT mean:** the experience is wrong · the current investigation should stop.
- **Next action:** no candidate injected from retrieval. **Under F1-C:** INSUFFICIENT_EVIDENCE does not qualify as `retrieval_returned_usable_candidate == true` (no candidate was actually usable). Honest Degrade does not fire. Fresh investigation proceeds.
- **May influence selection?** No SUPPORTING/CONTRADICTING contribution.
- **May authorize modification / execution?** NO / NO.

### 4.5 · `REJECT`

- **Cause:** composite retrieval key satisfied at coarse levels BUT Fix 23b tracer emits REJECT (different target_line produced by tracer on current source, or different literal proposed to achieve expected outcome, or tracer refusal `no_candidate_produces_expected`) OR at least one R10-C-1 D dimension reports "materially different" with sufficient evidence per that dimension's rule.
- **Evidence supporting:** tracer output · R10-C-1 D per-dimension outputs.
- **What it means:** retrieval identified a superficial match but the current source is not equivalent under the founder-confirmed criteria.
- **What it does NOT mean:** the current problem cannot be solved · retrieval is broken.
- **Next action:** evidence class = `RETRIEVED_SUPERFICIAL_MATCH` (§5.3). Under F1-C: REJECT does not qualify as `retrieval_returned_usable_candidate == true` (the candidate was explicitly rejected). Honest Degrade does not fire.
- **May influence selection?** Via SUPERFICIAL_MATCH downgrade rule only (never toward SUPPORTING).
- **May authorize modification / execution?** NO / NO.

### 4.6 · `REQUIRE_MORE_INVESTIGATION` (retrieval layer · distinct from Q8V1_SELECTION_STATE::REQUIRE_MORE_INVESTIGATION)

- **Cause (F7 priority rule · F10-B applied):** Fix 23b tracer emits refusal (`unsupported_expression`, `cross_module_call`, `recursion_depth_exceeded`, etc.) that leaves equivalence indeterminate, OR R10-C-1 D emits `INDETERMINATE` because at least one safety-relevant dimension is `NOT IMPLEMENTED` (§6.2 under F10-B).
- **Evidence supporting:** tracer refusal code · dimension evaluator refusals or NOT_IMPLEMENTED markers.
- **What it means:** the equivalence question cannot be answered by NEX1's current capability; additional investigation (or additional capability) is required.
- **What it does NOT mean:** no answer exists · the current investigation is invalid.
- **Next action:** no candidate injected · investigation packet flagged for escalation. **Under F1-C:** does not qualify as `retrieval_returned_usable_candidate == true`. Honest Degrade does not fire. Fresh investigation proceeds.
- **May influence selection?** No SUPPORTING/CONTRADICTING contribution.
- **May authorize modification / execution?** NO / NO.

**All six states preserve `MODIFICATION AUTHORITY = NO` and `EXECUTION AUTHORITY = NO`.**

**F1-C summary at retrieval layer:** only `MATCH` qualifies as `retrieval_returned_usable_candidate == true`. All other five outcomes leave the packet in a state where Honest Degrade does NOT fire and fresh investigation proceeds normally.

**Sub-decision A (unresolved):** the exact mechanism for representing the `retrieval_returned_usable_candidate` flag — Schema V1 field vs runtime-only packet field vs derived-from-retrieval-state — is `FOUNDER DEFINITION REQUIRED`. This policy specifies the semantic rule; the representation mechanism is deferred.

---

## §5 · Experience Evidence Classes · With Authoritative Source Rule (F11 resolved)

**Authoritative source rule (F11):** the evidence class of a retrieved candidate is derived from Schema V1 field `E2 outcome_class`. `E2` is the authoritative source. `E2` is itself derived at Fix 17 writer time from `D1 verify_exit_code`, `D2 preservation_status`, `D4 sibling_test_ids`, and the Fix 23c auto-revert signal. **The Fix 17 writer holds the derivation rule; Q8 V2 v2 reads `E2` as authoritative and does not re-derive.** The exact derivation rule from D1/D2/D4 to E2 is documented (or must be documented) at the writer level, not here — if the writer's rule is currently under-specified, that is a Fix 17 writer-specification gap surfaced by this finding but not resolved by this policy.

**F29 · LOAD-BEARING DEPENDENCY FOR FUTURE AUDIT:** Q8 V2 v2's reading of `E2` as authoritative is only as trustworthy as the Fix 17 writer's derivation. Explicitly:
- Q8 V2 v2 consumes E2 per the authoritative-source rule above.
- The correctness of E2 depends on the Fix 17 writer's D1/D2/D4 → E2 derivation rule.
- If the writer's derivation is currently under-specified, that is a Fix 17 writer-specification gap and a load-bearing dependency for future audit.
- Q8 V2 v2 **does NOT silently repair Fix 17**. This policy does not modify Fix 17, does not audit Fix 17 beyond documenting the dependency, and does not require Fix 17 changes as part of Q8 V2 v3.
- Recommended follow-up: separately-authorised audit of the Fix 17 writer's E2 derivation rule (out of Q8 V2 scope).

Three classes. Each produced from the retrieval states above under a deterministic map. Each carries a defined effect on Q8 selection under R11-B.

### 5.1 · `RETRIEVED_PRIOR_SUCCESS`

- **Produced when:** retrieval state = `MATCH` AND stored experience's `E2 outcome_class == SUCCESS`.
- **Meaning:** a stored experience exists in which a fix of the same structural shape and same tracer-computable outcome was independently verified.
- **May guide investigation:** YES.
- **May contribute to R-4 SUPPORTING count:** **NO** (R11-B literal preservation).
- **May contribute to R-4 CONTRADICTING count (F9 resolved):** **NO**.
- **May authorize modification / execution:** NO / NO.

### 5.2 · `RETRIEVED_PRIOR_FAILURE`

- **Produced when:** retrieval state = `MATCH` AND stored experience's `E2 outcome_class ∈ {FAILURE, REVERTED_BY_PRESERVATION}`.
- **Meaning:** a stored experience exists in which an attempt at the same structural shape failed verification.
- **May guide investigation (F2-B):** YES.
- **May inform R10-C-1 D behavioural dimension:** YES · **F30 clarification:** "inform" means the prior failure's D1-D4 fields may provide a **categorical comparison point** for the behavioural dimension's implemented comparison rule. It does NOT mean numerical weighting, confidence boosting, confidence reduction, score adjustment, probability adjustment, or authority increase. The behavioural dimension remains a categorical comparison (F2.3 preserved).
- **May contribute to R-4 SUPPORTING count:** **NO** (R11-B).
- **May contribute to R-4 CONTRADICTING count (F9 resolved):** **NO** — see §11.2 under F2-B.
- **May trigger unconditional prohibition (F2-B):** **NO**.
- **May authorize modification / execution:** NO / NO.

### 5.3 · `RETRIEVED_SUPERFICIAL_MATCH`

- **Produced when:** retrieval state = `REJECT` OR `AMBIGUOUS` OR (`MATCH` downgraded by R10-C-1 D safety-relevant dimension flagging "different").
- **Meaning:** retrieval found something that looked similar at coarse level, but current-capability equivalence check does not confirm equivalence.
- **May guide investigation:** YES (may hint at pattern family).
- **May contribute to R-4 SUPPORTING count:** **NO**.
- **May contribute to R-4 CONTRADICTING count:** **NO**.
- **May be reported in output for auditability:** YES.
- **May authorize modification / execution:** NO / NO.

**Under R11-B, none of the three classes may enter the SUPPORTING or CONTRADICTING count that R-4 evaluates.** This is absolute.

---

## §6 · R10-C-1 · D · Composite Material Difference · Under F10-B

**Founder-confirmed:** material difference must be evaluated across multiple explicitly defined dimensions. Under **F10-B**: any unimplemented safety-relevant dimension → `INDETERMINATE`.

### 6.1 · Four dimensions · capability status

| Dimension | What it evaluates | Current capability | Safety-relevant? |
|---|---|---|---|
| **Structural** | function signature · AST-shape of return expression · call-chain shape · parameter count/types | `DOCUMENTED · IMPLEMENTED via Fix 23b + Schema V1 Block C fields` | `FOUNDER DEFINITION REQUIRED` (sub-decision D) |
| **Semantic / domain** | domain-role of the affected value | **`FUTURE CAPABILITY · NOT IMPLEMENTED`** | `FOUNDER DEFINITION REQUIRED` |
| **Behavioural** | expected-outcome divergence · sibling-test outcome divergence · **categorical** comparison only (F30 · no numerical weighting, no confidence adjustment) | `DOCUMENTED · PARTIALLY IMPLEMENTED` (Schema V1 Block D fields exist; comparison rule requires founder policy definition) | `FOUNDER DEFINITION REQUIRED` |
| **Contextual** | caller-context · call-site pattern · invariant / precondition context | **`FUTURE CAPABILITY · NOT IMPLEMENTED`** | `FOUNDER DEFINITION REQUIRED` |

**Sub-decision D (unresolved):** the authoritative definition of "safety-relevant dimension" is `FOUNDER DEFINITION REQUIRED`. This policy specifies that if any dimension marked safety-relevant is `NOT IMPLEMENTED`, the aggregate is `INDETERMINATE`. **Which dimensions are safety-relevant** is not decided in this document.

### 6.2 · Composite rule · corrected under F10-B · precedence ambiguity preserved (F21)

**Corrected aggregation rule (F10 finding · F10-B applied):**

- Aggregate output `NOT_MATERIALLY_DIFFERENT` iff **every safety-relevant dimension is IMPLEMENTED AND reports "not different"**.
- Aggregate output `MATERIALLY_DIFFERENT` iff at least one implemented dimension reports "different" with sufficient evidence per that dimension's rule.
- Aggregate output `INDETERMINATE` iff any safety-relevant dimension is `NOT IMPLEMENTED` (regardless of other dimensions' state) — **subject to F21 precedence question below**.

**Counting rule:** count-based, categorical outputs only per dimension. No numerical weights (F2.3 preserved).

**⚠️ FOUNDER DEFINITION REQUIRED · F21 · F10-B PRECEDENCE:**

Two mutually-exclusive readings of F10-B are possible:

- **Reading 1 · STRICT INDETERMINATE (literal F10-B):** "If ANY safety-relevant dimension required for the comparison is unimplemented, the aggregate result must be `INDETERMINATE`." Under this reading, `MATERIALLY_DIFFERENT` from a non-safety-relevant dimension cannot override `INDETERMINATE` from a missing safety-relevant dimension. Result must be strictly `INDETERMINATE`.

- **Reading 2 · CONSERVATIVE OVERRIDE:** `MATERIALLY_DIFFERENT` (from any implemented dimension) > `INDETERMINATE` (from missing safety-relevant dimension) > `NOT_MATERIALLY_DIFFERENT`. Under this reading, known-different overrides unknown; safety effect is preserved (still no MATCH), but the aggregate output is `MATERIALLY_DIFFERENT` not `INDETERMINATE`.

**No existing frozen decision (R10-C, R10-C-1..4, F1-C..F10-B, R10, R11) resolves this precedence.** This policy does not choose between the two readings. The precedence rule is `FOUNDER DEFINITION REQUIRED · F10-B PRECEDENCE`.

**Until the founder resolves F21, no Q8 V2 v2 implementation of this aggregation precedence may proceed.** Implementers must obtain the founder decision before selecting Reading 1 or Reading 2. This policy does not designate a "safer default", a "provisional runtime behaviour", or an "interim mode". "Safer" does not equal "authorized". The doctrine emits `f10b_precedence_reading_authorized: false` (§14.3) as an honesty marker; the corresponding runtime behaviour is `NOT AUTHORIZED · PENDING FOUNDER DECISION`, not "Reading 1 by default".

### 6.3 · Honest limitation under current capability · F16 reachability chain

Under current capability, only Structural (fully) and Behavioural (partially) dimensions are implementable. Under F10-B, if either the Semantic dimension or the Contextual dimension is marked "safety-relevant" (Sub-decision D pending), then **every Q8 V2 v2 composite evaluation today emits `INDETERMINATE`**. This is the founder's explicit choice. It is not a defect.

**⚠️ F16 · REACHABILITY CHAIN · load-bearing disclosure:**

The following operational consequence must be visible, not derived:

1. `safety_relevant_definition_authorized == false` (Sub-decision D pending)
2. → §6.3 defaults composite output to `INDETERMINATE` on every evaluation
3. → §4.6 fires `REQUIRE_MORE_INVESTIGATION` at the retrieval state layer
4. → §4.1 MATCH cannot fire (its precondition "all R10-C-1 D dimensions ... report 'not different'" cannot be satisfied)
5. → `retrieval_returned_usable_candidate` is universally `false` per §4 preamble
6. → §10.2 Honest Degrade never activates
7. → §5 evidence classes `RETRIEVED_PRIOR_SUCCESS` / `RETRIEVED_PRIOR_FAILURE` cannot be produced (both require MATCH)
8. → §11 Prior Success / Prior Failure operational paths are dormant
9. → §12 F4-C contradiction path's degrade-preservation clause never fires (no MATCH → no degrade → contradiction handled by fresh-only path)
10. → §22 compositional checks involving MATCH pass vacuously (see §22 check 11)

**Consequence · plain language:**

`F1-C = POLICY DEFINED · CURRENTLY REACHABLE = FALSE · CURRENTLY ENFORCED = FALSE`

Q8 V2 v2's principal F1-C protective mechanism is `NOT CURRENTLY REACHABLE` at runtime. This is not a defect of the policy — it is a capability-honest consequence of Sub-decision D remaining unresolved. Any implementation would need Sub-decision D resolved AND the corresponding safety-relevant dimensions implemented before MATCH could fire.

Runtime honesty markers required on every Q8 V2 v2 composite output:

- `structural_dimension_available: true` (per current capability)
- `semantic_dimension_available: false` (per current capability)
- `behavioural_dimension_available: partial | false | true` (state which)
- `contextual_dimension_available: false` (per current capability)
- `composite_result: NOT_MATERIALLY_DIFFERENT | MATERIALLY_DIFFERENT | INDETERMINATE`
- `safety_relevant_definition_authorized: boolean` (currently `false` until Sub-decision D resolved)
- `f10b_precedence_reading_authorized: boolean` (currently `false` per §6.2 F21 — no reading chosen)
- `match_reachable_under_current_capability: boolean` (currently `false` per F16 chain above)

Where `safety_relevant_definition_authorized == false`, the composite output MUST default to `INDETERMINATE`.

---

## §7 · R10-C-2 · C · Independent Verification · Under F1-C

**Founder-confirmed:** fresh evidence must be independently verified; retrieval-influenced evidence must not automatically count as independent.

### 7.1 · Five categories of evidence · distinguishability under current architecture

| Category | Description | Distinguishable under current architecture? |
|---|---|---|
| **A · copied from memory** | historical evidence-ID copied into current packet | **NO** — no origin marker on evidence-ID |
| **B · derived from memory** | current record whose content was informed by stored record | **NO** — no derivation lineage tag |
| **C · discovered because memory guided investigation** | current evidence found because retrieval pointed at location | **NO** — no `discovery_source` field |
| **D · generated independently of retrieved experience** | fresh investigation with retrieval-contribution false | **PARTIAL** — under F1-C, if `retrieval_returned_usable_candidate == false`, the packet-level check permits admission |
| **E · contradicts retrieved experience** | current evidence classified as `STRUCTURALLY_CONTRADICTING` by Fix 13 | **PARTIAL** — contradiction axis is deterministic (Fix 13); causation is not tagged |

### 7.2 · Composite retrieval key (referenced by §4)

Cascading composite key at four levels:
1. exact match on `pattern_class` (Schema V1 C1)
2. exact match on `intent_shape_hash` (derived from Schema V1 B1 + sorted B3 + sorted B4)
3. loose match on `structural_shape_hash` (derived from Schema V1 B7 + B8)
4. rank by `expected_delta_shape_hash` similarity (derived from Schema V1 B9)

### 7.3 · Fresh-evidence eligibility rule · CORRECTED UNDER F1-C · F22 disambiguation

**Corrected rule (F1-C applied · replaces v1's packet-level proxy · F22 · OR relationship made explicit):**

Q8 V2 v2 evaluates an evidence item for R-4 SUPPORTING count eligibility as follows:

- **Eligible if AT LEAST ONE of the following holds:**
  - Condition (a): the evidence item carries `discovery_source == "fresh_generated"` (**REQUIRES SCHEMA EXTENSION · FOUNDER-APPROVED AMENDMENT REQUIRED · Sub-decision E**), OR
  - Condition (b): the packet on which the evidence was generated has `retrieval_returned_usable_candidate == false` (under F1-C, retrieval that did not produce a usable candidate does not contaminate fresh evidence).
- **NOT eligible** if the packet has `retrieval_returned_usable_candidate == true` AND per-evidence provenance is unavailable (i.e., `discovery_source` unknown or `memory_guided`).

**Critical F1-C consequence:** under current architecture (no `discovery_source` field), the eligibility rule collapses to: **fresh evidence is eligible when `retrieval_returned_usable_candidate == false` (retrieval attempted with no usable result), and NOT eligible when `retrieval_returned_usable_candidate == true` (retrieval attempted AND MATCH fired) unless per-evidence provenance capability exists.** This is a materially different rule from v1's over-broad packet-proxy.

### 7.4 · "Independently produced" primitive definition (F12 resolved · limited by current capability)

**Definition (under current architecture):** an evidence item is *independently produced* if AT LEAST ONE of the following holds:

- The packet on which the evidence was generated has `retrieval_returned_usable_candidate == false` (retrieval attempted with no MATCH), OR
- The packet has `retrieval_attempted == false` (no retrieval consulted at all), OR
- The evidence item carries `discovery_source == "fresh_generated"` (requires future capability)

**Under current capability**, only the first two conditions are checkable. The third is a `FUTURE CAPABILITY REQUIRED` extension.

**F12 finding note:** this definition uses only signals the current architecture can actually establish. It does NOT invent provenance capability that does not exist. Where a packet has `retrieval_returned_usable_candidate == true` and per-evidence provenance is unavailable, independence cannot be asserted — the evidence must NOT enter the R-4 count under R11-B's spirit.

### 7.5 · Load-bearing capability gap · Sub-decision E

**Per-evidence `discovery_source` provenance is `FUTURE CAPABILITY · NOT IMPLEMENTED · SCHEMA EXTENSION REQUIRED · FOUNDER DEFINITION REQUIRED`.** Until it exists, Q8 V2 v2's independent-verification rule is only partially operational: the packet-level `retrieval_returned_usable_candidate` sub-rule can be applied once the F1-C flag exists; the per-evidence `discovery_source` sub-rule cannot.

Q8 V2 v2 output must include:

- `independence_verification_status: "FULL" | "PACKET_LEVEL_ONLY" | "NOT_POSSIBLE"`

---

## §8 · Fix 23b Boundary · Under R10-C-3 D

**Founder-confirmed R10-C-3 D:** Fix 23b is necessary evidence where applicable but not sufficient proof.

### 8.1 · Directly Verified Capability

Fix 23b currently establishes:

- Target line (`LiteralCandidate.line`)
- Candidate position + end position
- Proposed literal text (`.proposed_text`)
- Enclosing expression (brief · `.enclosing_expression`)
- Hosting function (`.hosting_function`)
- Expected numerical outcome achievable (via `baseline_value` + candidate substitution)
- Bounded arithmetic + control-flow evaluation
- Deterministic refusal via `TracerRefusal`

### 8.2 · Not Established by Fix 23b

Fix 23b does NOT establish:

- Semantic role — `NOT CURRENTLY CAPABLE`
- Domain meaning — `NOT CURRENTLY CAPABLE`
- Identifier meaning — `NOT CURRENTLY CAPABLE`
- Programmer intent — `NOT CURRENTLY CAPABLE`
- Invariant preservation — `NOT CURRENTLY CAPABLE`
- Cross-module semantic dependencies — `NOT CURRENTLY CAPABLE` (refuses on `cross_module_call`)
- Runtime side effects — `NOT CURRENTLY CAPABLE` (pure evaluator)
- Caller / callee behavioural equivalence — `NOT CURRENTLY CAPABLE`
- Historical intent — `NOT CURRENTLY CAPABLE`
- Whether two different literals are semantically interchangeable in the domain — `NOT CURRENTLY CAPABLE`

### 8.3 · Q8 V2 v2 MATCH criteria against Fix 23b

For a retrieval MATCH to fire on the tracer axis, Fix 23b MUST produce `TracerOk` with:

- A `LiteralCandidate` whose `.line` and `.position` satisfy the line-comparison rule (§8.4)
- `.proposed_text` byte-equal to the stored experience's Schema V1 C7 `literal_proposed_text`
- `baseline_value` such that substituting `.proposed_text` for `.current_text` produces the stored experience's Schema V1 C5 `tracer_expected_value`
- `.enclosing_expression` string-equal to the stored experience's Schema V1 C9 `enclosing_expression`

**All four sub-criteria must hold. Any single failure → REJECT.**

### 8.4 · Line-comparison rule · CORRECTED (F3 defect resolved) · F23 name-equality caveat

**Corrected rule (hosting-function-scoped principle — retained):** the target-line comparison is **hosting-function-scoped**, not file-scoped. Specifically:

- Within a same-scope hosting function, the `.line` of the current candidate must correspond to the stored experience's target-line at the equivalent syntactic position — computed as: same statement index within the function's statement list AND same expression position within that statement.
- **The file's overall line count is NOT compared.** Line additions or deletions in unrelated functions do NOT invalidate MATCH.

**⚠️ FOUNDER DEFINITION REQUIRED · F23 · HOSTING-FUNCTION IDENTITY CRITERION:**

The specific question of how "same hosting function" is determined is not resolved by any existing frozen decision (R10-C, R10-C-1..4, F1-C..F10-B, R10, R11):

- **Option (i) · strict name-equality:** `stored.hosting_function` string-equal to current source's containing function name. A rename → mismatch → REJECT.
- **Option (ii) · structural equivalence (rename-tolerant):** hosting-function identity established via AST structural equivalence, not name equality; a rename with identical body/signature may still MATCH.
- **Option (iii) · stable identity:** stable function ID from a Schema V1 field yet to be founder-authorised.
- **Option (iv) · other founder-authorised criterion.**

**This policy does not choose.** The founder decision F3 (v2) authorised "hosting-function-scoped comparison" but did not authorise a specific identity criterion.

**Until the founder resolves F23, no Q8 V2 v2 implementation of the §8.4 line-comparison identity criterion may proceed.** Implementers must obtain the founder decision before selecting name equality, structural identity, stable identity, or another founder-authorised criterion. This policy does not designate a "safer default", a "provisional runtime behaviour", or an "interim mode". "Safer" does not equal "authorized". The doctrine emits `hosting_function_identity_criterion_authorized: false` (§14.3) as an honesty marker; the corresponding runtime behaviour is `NOT AUTHORIZED · PENDING FOUNDER DECISION`, not "Option (i) by default".

**Retained without ambiguity:** the hosting-function-scoped principle itself (as opposed to the previous whole-file line-count comparison) IS the F3 correction and is preserved. Only the specific identity criterion within that principle is deferred to founder decision.

If either the hosting-function does not identify a same-scope function under whichever criterion is in force, or the statement-index-within-function mismatches, MATCH does not fire; the outcome becomes REJECT.

If the tracer refuses (e.g., cross-module or unsupported construct), MATCH does not fire; the outcome becomes `REQUIRE_MORE_INVESTIGATION`.

### 8.5 · Necessity but not sufficiency (R10-C-3 D)

Fix 23b MATCH is **necessary** for a `RETRIEVED_PRIOR_SUCCESS` classification but **not sufficient**. Additional current-evidence mechanisms — specifically R10-C-1 D's other dimensions (§6) and R10-C-4 D's anti-circularity checks (§9) — must also succeed. Where those additional mechanisms are `NOT IMPLEMENTED`, Q8 V2 v2 output must include `sufficiency_gap: true` and honestly disclose which mechanism is missing.

---

## §9 · R10-C-4 · D · Composite Anti-Circularity · Under F6-C

**Founder-confirmed:** three sub-mechanisms combined · shared-upstream analysis required · no auto-guarantee of independence.

### 9.1 · The three sub-mechanisms

| Sub-mechanism | Current capability | Missing capability | Schema impact | Runtime impact |
|---|---|---|---|---|
| **A · Independent provenance** | none | `discovery_source` per evidence item | **Schema V1 extension required · founder amendment required · Sub-decision E** | ACTION 1-10 output must be extended to tag evidence origin at generation-time |
| **B · Contradiction search** | none | dedicated ACTION or protocol that actively searches for disconfirming evidence | new ACTION output fields | new ACTION or protocol |
| **C · Dual-path investigation** | none | orchestrator that runs the investigation twice with retrieval on/off | new envelope-level fields | new orchestrator module |

### 9.2 · Composite semantics · under F6-C · F28 strengthened disclosure

**F6-C reframing:** the constitutional rule (memory does not become proof) is global. Operational enforcement is capability-phased.

Q8 V2 v2 emits:
- `ANTI_CIRCULARITY = FULLY_PROTECTED` iff all three sub-mechanisms are `IMPLEMENTED · CONNECTED · EXECUTED · OBSERVED · VERIFIED` for the current pathway AND their outputs concur (no shared-upstream contamination detected).
- `ANTI_CIRCULARITY = PARTIALLY_PROTECTED` iff at least one sub-mechanism is verified.
- `ANTI_CIRCULARITY = NOT_IMPLEMENTED` iff none are verified. **This is the current runtime state as of 2026-09-18.**

**⚠️ F28 · load-bearing disclosure · ANTI-CIRCULARITY POLICY EXISTS BUT ENFORCEMENT DOES NOT:**

The doctrine describes R10-C-4 D Composite Anti-Circularity but the enforcement mechanism is not implemented in current NEX1:

- **Current NEX1 CANNOT yet fully detect** memory → investigation → evidence → "independence" → memory circularity across the relevant pathways.
- Therefore `ANTI-CIRCULARITY POLICY EXISTS` (specified here) but `ANTI-CIRCULARITY ENFORCEMENT IS NOT YET IMPLEMENTED` at runtime.
- **Under current capability, CASE H (§15) is unfalsifiable.** Circularity cannot be observed even where it exists.
- **This does NOT confer safety by documentation alone.** Do not mistake "honest disclosure" for "safe by construction."
- **This does NOT authorise Fix 24 or autonomous execution** in any renamed form. The R10-C-4 D sub-mechanisms (§9.1 A/B/C) must be built and verified before any autonomous-execution consideration.

### 9.3 · Global constitutional scope · operational per-capability (F6-C) · F18 pathway count reconciled · F27 elevated risk callout

Under F6-C, the constitutional rule `MEMORY = EVIDENCE, NOT AUTHORITY` applies to **every memory pathway in NEX1**. Operational enforcement by Q8 V2 v2 is limited to pathways for which the provenance capability exists.

**⚠️ F27 · CURRENT OPERATIONAL COVERAGE GAP · LOAD-BEARING RISK DISCLOSURE:**

> Multiple live memory-shaped pathways currently lack complete operational provenance / enforcement demonstrating that memory-derived information cannot be mistaken for independently-produced evidence.

Under current architecture, the constitutional rule applies globally but operational enforcement is absent across the five constitutional-scope pathways below. Fresh evidence originating from any of these pathways CAN currently enter Q8 selection without provenance tagging distinguishing memory-caused from independently-generated content. **This is a current operational coverage gap — not a claim that any pathway is unsafe by construction, but a factual disclosure that operational enforcement is not yet in place.**

**F18 · pathway count reconciled — 5 + 1:**

**Five constitutional-scope memory pathways (currently outside Q8 V2 v2 operational scope):**

1. `src/lib/knowledge/*` (searchKnowledge · uses `minConfidence` threshold) · **operational enforcement NOT YET · constitutional rule APPLIES**
2. `src/lib/nex/programmer-learning/*` (readKnowledge / readSkills / readExperiences / readEvents) · **operational enforcement NOT YET · constitutional rule APPLIES**
3. `src/lib/nex-code-brain/knowledge-store.ts` · **operational enforcement NOT YET · constitutional rule APPLIES**
4. `src/lib/nex-agent-runtime/memory.ts` (audit-grade Ed25519-signed) · **operational enforcement NOT YET · constitutional rule APPLIES**
5. `src/lib/nex-agent/code-engine/capability-m-file-memory/*` (file-memory tag lookup · ACTION 2) · **operational enforcement NOT YET · constitutional rule APPLIES**

**Plus one Q8 V2 v2 own future operational target (distinct from the five above):**

6. Fix 17 investigation-conclusion retrieval — this is the pathway that Q8 V2 v2's own retrieval + F1-C degrade + R11-B exclusion will operate on **once** (a) Sub-decision D resolves the safety-relevant dimension definition (allowing MATCH to fire per §6.3 F16 chain), (b) Sub-decision A resolves the `retrieval_returned_usable_candidate` representation, and (c) Fix 24 retrieval capability is built.

**Numerical reconciliation:** the phrase "five memory-shaped pathways" throughout this doctrine refers to items 1-5 (constitutional-scope pathways currently outside Q8 V2 operational scope). Item 6 (Fix 17 retrieval) is the sixth pathway but is separately categorised as the future operational target of Q8 V2 v2 itself. `pathway_operational_coverage` marker (§14.3) is currently empty for items 1-5 AND for item 6 (because F16 renders it currently unreachable).

**Sub-decision C (unresolved):** priority ordering of pathway coverage among items 1-5; whether new memory subsystems added in future automatically inherit constitutional coverage; per-pathway founder authorisation to include in Q8 V2 operational scope. `FOUNDER DEFINITION REQUIRED`.

### 9.4 · Shared-upstream analysis (required · NOT IMPLEMENTED)

Even when the three sub-mechanisms exist, the composite claim of independence is contingent on **shared-upstream analysis**: dual-path investigation may share classifier vocabulary, file-memory tags, or retrieval-adjacent ACTION inputs. Q8 V2 v2 must emit `shared_upstream_detected: true | false | not_checked` — under current architecture, always `not_checked`.

### 9.5 · Anti-simulation rule

**The composite anti-circularity claim MUST NOT be simulated in prose.** No Q8 V2 v2 runtime output may claim `FULLY_PROTECTED` unless each sub-mechanism has passed the engineering chain (§14). Until then, output is bounded to `NOT_IMPLEMENTED` or `PARTIALLY_PROTECTED` with explicit disclosure of which sub-mechanism was verified.

---

## §10 · R11-B · R-4 SUPPORTING/CONTRADICTING · Absolute Exclusion · Corrected Under F1-C

**Founder-confirmed R11-B:** retrieved experience may guide investigation but MUST NEVER contribute to the R-4 SUPPORTING count (F9 resolved: neither SUPPORTING nor CONTRADICTING).

### 10.1 · Absolute exclusion rule

For each candidate in Q8's `root_cause_candidates[]`:

- If the candidate's `candidate_source ∈ {"retrieved_prior_success", "retrieved_prior_failure", "retrieved_superficial_match"}`:
  - Retrieved evidence associated with the candidate MUST NOT be counted in the SUPPORTING count.
  - Retrieved evidence associated with the candidate MUST NOT be counted in the CONTRADICTING count.
  - Only evidence items whose `discovery_source == "fresh_generated"` (or, under current capability limits, evidence in packets with `retrieval_returned_usable_candidate == false`) may be counted.

### 10.2 · Honest Degrade rule · CORRECTED UNDER F1-C · F16 reachability disclosure

**Corrected rule (F1-C applied):** the memory-caused-evidence pathway is protected as follows:

- **If `retrieval_attempted == false` for the packet:** no retrieval occurred; R-4 admits fresh evidence normally per Q8 V1. No degrade.
- **If `retrieval_attempted == true` AND `retrieval_returned_usable_candidate == false` (i.e., NO_MATCH / AMBIGUOUS / INSUFFICIENT_EVIDENCE / REJECT / REQUIRE_MORE_INVESTIGATION at retrieval state):** retrieval did not produce a contribution. Under F1-C, **fresh evidence is admitted normally**. No degrade fires.
- **If `retrieval_attempted == true` AND `retrieval_returned_usable_candidate == true` (i.e., MATCH at retrieval state):** retrieval produced a usable contribution. **Honest Degrade fires.** Under the current-capability degrade:
  - If per-evidence `discovery_source` field exists (future capability): only evidence tagged `discovery_source == "fresh_generated"` may enter R-4 count.
  - If per-evidence `discovery_source` does NOT exist (current capability): NO fresh evidence from this packet may enter R-4 SUPPORTING count. Q8 output emits `Q8V1_SELECTION_STATE::INSUFFICIENT_EVIDENCE` OR `Q8V1_SELECTION_STATE::REQUIRE_MORE_INVESTIGATION` unless the separate contradiction path (§12, F4-C) applies.

**⚠️ F16 · CURRENT-CAPABILITY OPERATIONAL VACUITY OF THIS RULE:**

Under current capability + Sub-decision D pending, MATCH is unreachable (see §6.3 chain). Therefore:

- The third bullet above (MATCH-firing case) **cannot currently fire at runtime**.
- The first and second bullets (no retrieval / no MATCH) **do fire** and correctly admit fresh evidence normally.
- **F1-C degrade is `POLICY DEFINED` but its distinguishing behaviour between second bullet (admit) and third bullet (degrade) is `NOT CURRENTLY EXERCISABLE`** because no packet reaches the third bullet.

**Consequence:** during the current-capability window, Q8 V2 v2 behaves observably identically to a pre-F1-C fresh-only pipeline. The doctrine's F1-C correction becomes operationally distinguishable from v1 only after Sub-decision D resolves AND the corresponding safety-relevant dimensions land AND F1-C flag representation (Sub-decision A) resolves.

### 10.3 · Anti-loophole rule (F15 resolved)

The following pathway is forbidden:

```
memory retrieval → memory-guided investigation → resulting evidence → "fresh" tag → SUPPORTING count
```

**Under F1-C, the pathway is blocked at the `retrieval_returned_usable_candidate == true` gate** for the current packet. Any evidence produced during a MATCH-firing packet is **presumed memory-caused** until a `discovery_source: fresh_generated` tag proves otherwise (future capability).

**F5 finding resolved:** the F1-C rule specifically distinguishes retrieval-attempted-but-no-match (§4.2 · §4.3 · §4.4 · §4.5 · §4.6) from retrieval-attempted-and-MATCH (§4.1). NO_MATCH retrievals **do not** trigger the degrade. This corrects v1's over-broad packet-level proxy.

### 10.4 · Q8 V1 R-4 arithmetic preserved · F24 clarification

**Arithmetic operation itself · UNCHANGED:** Q8 V1's R-4 SUPPORTING_MAJORITY rule (Δ = count(SUPPORTING) − count(CONTRADICTING) ≥ 1, count-based, no numerical weights) is bit-identical unchanged.

**Set of evidence admissible to that arithmetic · FILTERED:** Q8 V2 v2 constrains WHICH evidence items may participate in the count via §7.3 eligibility rule + §10.1 absolute exclusion + §10.2 Honest Degrade.

**These are two distinct statements:**

- `ARITHMETIC UNCHANGED` refers to the operation applied to whatever inputs land in the count.
- `INPUT SET FILTERED` refers to Q8 V2 v2 rules determining which items count.

**Reader beware:** "Q8 V1 arithmetic preserved" does NOT mean "R-4 behaves identically to Q8 V1 pipeline." The count arithmetic is preserved; the population of countable items is different. Under Honest Degrade, the population may be materially smaller (potentially zero), leading Q8 to `Q8V1_SELECTION_STATE::INSUFFICIENT_EVIDENCE` more frequently than a v1-only pipeline would.

---

## §11 · Prior Success and Prior Failure · Under F2-B

**Founder-confirmed F2-B:** prior failure guides but never blocks.

### 11.1 · Prior success handling (`RETRIEVED_PRIOR_SUCCESS`)

- Guides investigation: YES
- Contributes to SUPPORTING count: NO (§10.1 absolute exclusion)
- Substitutes for fresh evidence: NO
- Increases proof weight of a current candidate: NO
- Creates current applicability: NO

### 11.2 · Prior failure handling (`RETRIEVED_PRIOR_FAILURE`) · UNDER F2-B

**F2-B rule:**
- Guides investigation: YES
- Substantively informs R10-C-1 D behavioural dimension: YES
- **Does NOT create a permanent prohibition:** `PRIOR_FAILURE ≠ NEVER_RETRY`
- **Does NOT prove current failure:** `PRIOR_FAILURE ≠ CURRENT_PROOF_OF_FAILURE`
- **Does NOT block fresh investigation:** fresh investigation proceeds regardless of PRIOR_FAILURE.
- **Does NOT block fresh evidence:** fresh evidence remains admissible per §10.2.
- **Does NOT trigger unconditional CONTRADICTED classification** on the candidate.

**F2 finding resolved:** the previous R-10 deadlock is broken. Under F2-B, PRIOR_FAILURE is guidance, not veto. Under F1-C (§10.2), Honest Degrade fires only when retrieval returns a usable candidate — but the PRIOR_FAILURE's role within that degrade is guidance-only, not blocking. Fresh investigation continues; if R10-C-1 D determines the current problem is materially different from the failed one, the retrieval-informed guidance is overridden by fresh evidence.

**No age decay, no confidence weighting, no numerical thresholds.** R10-C preserved.

### 11.3 · Five failure-related states

| State | Definition | Handling under F2-B |
|---|---|---|
| **Historical failure** | stored experience with `E2 outcome_class ∈ {FAILURE, REVERTED_BY_PRESERVATION}` | guides investigation via `RETRIEVED_PRIOR_FAILURE`; never blocks |
| **Current failure** | fresh investigation independently produces a failing outcome on the current source | fresh evidence; enters Q8 selection subject to §10.2 admission rules |
| **Stale experience** | stored experience whose Schema V1 D3 `reverted_at` timestamp exists but code has since changed | current investigation determines applicability; historical failure is guidance input, not a veto |
| **Contradictory current evidence** | fresh evidence classifies structurally-CONTRADICTING to a retrieved SUCCESS | see §12 (F4-C separate contradiction path) |
| **Revalidated prior failure** | current investigation independently confirms the same failure shape and outcome | fresh evidence of failure; enters Q8 selection with fresh CONTRADICTING semantics — no memory dependency, and R11-B does not apply because this is fresh evidence |

---

## §12 · Contradictory Evidence · Under F4-C · F20 representation-neutrality

**Founder-confirmed F4-C:** contradiction remains visible as a distinct unresolved condition.

**F20 · REPRESENTATION-NEUTRAL LANGUAGE:** the doctrine uses `F4-C CONTRADICTION VISIBILITY` and `CONTRADICTION-VISIBILITY MECHANISM` as representation-neutral terms. Previous "marker" language pre-supposed a packet-level flag representation, which is only one of four options open under Sub-decision B. This document does not commit to any specific representation until Sub-decision B resolves.

### 12.1 · Definition of contradiction (F34 · aligned to F4-C founder scope)

**F4-C founder-authorised scope (verbatim):** *"Fresh evidence that contradicts retrieved experience must remain visible as a distinct unresolved condition."*

**F4-C therefore applies ONLY to contradictions in which retrieval-derived experience is involved.** Under §12.1 as corrected in v4, F4-C fires when:

- At least one evidence item is classified `STRUCTURALLY_CONTRADICTING` by Fix 13 evaluator for a given candidate, AND
- At least one of the following retrieval-derived elements is present in the packet:
  - a retrieved candidate (any evidence class per §5) whose stored outcome or classification implies a proposition that the fresh contradicting evidence would disprove, OR
  - a retrieval-derived supporting item associated with the same candidate whose retrieval-origin content is what the fresh contradicting evidence would disprove.

**Fresh-vs-fresh contradiction is EXPLICITLY OUT OF F4-C SCOPE.** When both the supporting and contradicting items are fresh (no retrieval-derived element involved), the contradiction is handled by the existing Q8 V1 evidence/selection logic (R-4 SUPPORTING minus R-4 CONTRADICTING count arithmetic). F4-C does NOT fire and no F4-C contradiction-visibility mechanism (§12.2) is emitted.

This alignment is the F34 correction: prior wording permitted the "at least one supporting item (fresh or retrieved)" first disjunct to trigger F4-C in retrieval-less packets, which would have silently broadened F4-C beyond the founder's authorised scope. The founder decision on F4-C scope is unchanged; only the §12.1 definition has been narrowed to match the founder-authorised scope literally.

**Any future expansion of F4-C to include fresh-vs-fresh contradiction is `FOUNDER DEFINITION REQUIRED` and NOT authorised by this policy.**

### 12.2 · Handling · CORRECTED UNDER F4-C

**F4-C rule (representation-neutral):**
- Q8 V2 v2 emits `F4-C CONTRADICTION VISIBILITY` as a distinct condition that is NOT silenced by Honest Degrade. The exact representation (state / field / persistence / other) is deferred to Sub-decision B.
- Both provenance chains (retrieved + fresh) preserved in the output packet.
- **No silent tie-breaking.** No memory-derived resolution.
- **Contradiction visibility is not selection authority.** F4-C ensures the contradiction is observably reported. It does NOT authorize the contradiction path to produce a SELECTED outcome.
- The contradiction must remain **observable as a distinct condition**. It must NOT be stored in a specific packet field, be represented as a specific new state, or be persisted in a specific record — until Sub-decision B chooses among those options.

### 12.3 · Rule ordering (F4 finding resolved · corrected under F4-C)

If a candidate has both `RETRIEVED_PRIOR_FAILURE` and fresh `STRUCTURALLY_CONTRADICTING` evidence:
- The `RETRIEVED_PRIOR_FAILURE` remains as guidance context (F2-B).
- The fresh contradicting evidence is surfaced via the F4-C separate contradiction path.
- Under §10.2 Honest Degrade: if the packet has `retrieval_returned_usable_candidate == true`, the fresh contradicting evidence cannot enter R-4 CONTRADICTING count under current capability limits — BUT its presence is still reported via the F4-C contradiction-visibility mechanism (Sub-decision B pending representation). **Contradiction is not lost.**

### 12.4 · Sub-decision B (unresolved · F4-C)

The exact mechanism for representing the contradiction path is `FOUNDER DEFINITION REQUIRED`:

- Is it a new Q8 selection state (e.g., `Q8V2_SELECTION_STATE::UNRESOLVED_CONTRADICTION` distinct from V1's `UNRESOLVED`)?
- Is it a packet-level field (e.g., a `contradiction_flags[]` array)?
- Is it persisted (via Fix 17 store or elsewhere)?
- Is it another representation entirely?
- What emission conditions apply (any `STRUCTURALLY_CONTRADICTING`? subset? threshold)?

**This policy specifies that some such mechanism must exist. The mechanism itself is not decided in this document.** The word "marker" has been eliminated from the doctrine's authored text in favour of representation-neutral phrasing (see F20 note above).

### 12.5 · Current-capability disclosure

Under Sub-decision B pending, no F4-C contradiction-visibility mechanism is currently implemented. Q8 V2 v2 output emits `contradiction_representation_authorized: false` (§14.3). Under F16, the whole degrade branch is not currently reachable in any case, so the F4-C mechanism has not had operational occasion to fire. Both facts are disclosed honestly.

---

## §13 · Provenance and Memory Causation · Under F1-C + F6-C

### 13.1 · Required (future) provenance field

`discovery_source: "fresh_generated" | "memory_guided" | "memory_derived" | "memory_copied" | "contradictory"` per evidence item.

**`FUTURE CAPABILITY · NOT IMPLEMENTED · SCHEMA V1 EXTENSION REQUIRED · FOUNDER-APPROVED AMENDMENT REQUIRED · Sub-decision E`.**

### 13.2 · Current capability degrade (F1-C corrected)

Until per-evidence `discovery_source` exists, Q8 V2 v2 uses the F1-C-derived packet-level check as a proxy:

- `retrieval_returned_usable_candidate == false` → fresh evidence in the packet is treated as independently produced (§7.4 first condition)
- `retrieval_returned_usable_candidate == true` → fresh evidence in the packet is treated as potentially memory-caused; excluded from R-4 count under §10.2

This is materially different from v1's over-broad `retrieval_experience_id != null` proxy.

### 13.3 · At-generation-time discipline

When per-evidence `discovery_source` is eventually implemented, tagging MUST occur at the point where the evidence is created (i.e., inside ACTION 1-10 when the record is produced), not retroactively at count-time.

---

## §14 · Current Capability vs Future Capability

### 14.1 · Engineering chain (preserved verbatim)

```
CLAIM → DOCUMENTED → IMPLEMENTED → CONNECTED → EXECUTED → OBSERVED → ADVERSARIALLY TESTED → VERIFIED
```

**No stage confers the rights of any subsequent stage.**

### 14.2 · Nine future capabilities

| # | Capability | Load-bearing for | Founder-approved authorisation to build? |
|---|---|---|---|
| 1 | Semantic-role understanding | §6 R10-C-1 D semantic dimension | NO — awaits Sub-decision D |
| 2 | `discovery_source` provenance | §7, §9.1, §10.2, §13 | NO — awaits Sub-decision E |
| 3 | Memory-causation tracking at ACTION discovery-time | §13.3 | NO |
| 4 | Contradiction-search orchestration | §9.1 B | NO |
| 5 | Dual-path investigation orchestrator | §9.1 C | NO |
| 6 | Composite semantic equivalence | §6 aggregation | NO — awaits Sub-decision D |
| 7 | Independence verification (shared-upstream analysis) | §9.3 | NO |
| 8 | Cross-module semantic dependency analysis | §8.2 | NO |
| 9 | Invariant assertion mechanism | §8.2 behavioural | NO |

**Additional future capability (F1-C):** `retrieval_returned_usable_candidate` representation mechanism (Sub-decision A).

**Additional future capability (F4-C):** contradiction-path representation mechanism (Sub-decision B).

**All are `DESIGNED / REQUIRED · NOT IMPLEMENTED`.** This policy documents them; implementation is out of scope.

### 14.3 · Runtime honesty markers · F19 consolidated authoritative list

Every Q8 V2 v2 output MUST include (as authored) the following markers. This is the single authoritative list. All fields marked `false` or `NOT_IMPLEMENTED` reflect current-capability truth.

**A · Retrieval-layer markers:**

- `retrieval_attempted: boolean` (whether retrieval subsystem was consulted for this packet)
- `retrieval_returned_usable_candidate: boolean` (Sub-decision A pending representation · derives from `retrieval_state == MATCH` when representation lands)
- `retrieval_state: "MATCH" | "NO_MATCH" | "AMBIGUOUS" | "INSUFFICIENT_EVIDENCE" | "REJECT" | "REQUIRE_MORE_INVESTIGATION" | null` (which of the six §4 retrieval states fired; null if retrieval not attempted)
- `retrieval_subsystem_failure_representation: "NOT_IMPLEMENTED"` (F26 · no state exists for retrieval subsystem failure)

**B · Evidence-classification markers:**

- `evidence_class: "RETRIEVED_PRIOR_SUCCESS" | "RETRIEVED_PRIOR_FAILURE" | "RETRIEVED_SUPERFICIAL_MATCH" | null` (null if no retrieved candidate was produced)

**C · Composite material-difference markers (§6.3):**

- `structural_dimension_available: true` (per current capability)
- `semantic_dimension_available: false` (per current capability)
- `behavioural_dimension_available: "partial" | false | true` (state which)
- `contextual_dimension_available: false` (per current capability)
- `composite_result: "NOT_MATERIALLY_DIFFERENT" | "MATERIALLY_DIFFERENT" | "INDETERMINATE"`
- `safety_relevant_definition_authorized: false` (Sub-decision D pending)
- `f10b_precedence_reading_authorized: false` (F21 · §6.2 precedence not chosen by any frozen decision)
- `match_reachable_under_current_capability: false` (F16 chain per §6.3)

**D · Independence and provenance markers (§7):**

- `independence_verification_status: "FULL" | "PACKET_LEVEL_ONLY" | "NOT_POSSIBLE"` (§7.5)
- `discovery_source_available: false` (Sub-decision E pending; per-evidence provenance not implemented)

**E · Contradiction markers (§12):**

- `contradiction_visibility_status: "NOT_IMPLEMENTED" | "PARTIALLY_IMPLEMENTED" | "FULLY_IMPLEMENTED"` (currently `NOT_IMPLEMENTED` per §12.5)
- `contradiction_representation_authorized: false` (Sub-decision B pending)

**F · Anti-circularity markers (§9):**

- `contradiction_search_ran: false` (§9.1 B not implemented)
- `dual_path_ran: false` (§9.1 C not implemented)
- `shared_upstream_checked: false` (§9.4 not implemented)
- `anti_circularity_status: "NOT_IMPLEMENTED"` (§9.2 current runtime state)

**G · Fix 23b / sufficiency markers (§8):**

- `sufficiency_gap: true` (whenever R10-C-3 D applies and downstream mechanisms are missing · currently always true)
- `hosting_function_identity_criterion_authorized: false` (F23 · §8.4 name-equality sub-rule policy choice pending)

**H · Pathway coverage marker (§9.3):**

- `pathway_operational_coverage: string[]` (currently `[]` · empty for all five constitutional-scope pathways items 1-5 AND for the Q8-V2-own item 6 under F16 unreachability)

**I · Fix 17 dependency marker (F29):**

- `e2_reader_authoritative: true` (Q8 V2 v2 reads Schema V1 E2 as authoritative; correctness depends on Fix 17 writer's derivation which is a separately-auditable dependency)

**Total: 21 authoritative markers.** Any Q8 V2 v2 runtime output missing any of these markers falsifies §14.3.

### 14.4 · Observational collapse acknowledgement (F15 preserved)

Under current capability, several adversarial cases produce identical observable Q8 outputs (typically `INSUFFICIENT_EVIDENCE` or `REQUIRE_MORE_INVESTIGATION`). This is NOT a test pass; it is a distinguishability limit.

`SAME OUTPUT ≠ SAME CAUSE`
`DISTINGUISHABILITY NOT CURRENTLY IMPLEMENTED`

Falsification tests that depend on distinguishing memory-caused evidence from independently-generated evidence cannot currently be executed. This is disclosed honestly in §16.

---

## §15 · Adversarial Cases · A-H

Cases updated under F1-C · F2-B · F4-C · F6-C · F10-B.

### CASE A · Genuine Match

- **Setup:** current source matches stored SUCCESS experience across every checkable dimension.
- **Prior memory state:** `MATCH` retrieval state → `RETRIEVED_PRIOR_SUCCESS` after §5 mapping.
- **Memory influenced discovery?** YES · retrieval fired and produced usable candidate.
- **F1-C:** `retrieval_returned_usable_candidate == true` → Honest Degrade fires.
- **Expected Q8 state:** under current capability (no `discovery_source`, safety-relevant dimensions partly `NOT IMPLEMENTED`), likely `Q8V1_SELECTION_STATE::INSUFFICIENT_EVIDENCE` or `REQUIRE_MORE_INVESTIGATION` — capability-honest degrade.
- **Modification / Execution permitted?** NO / NO.
- **Falsification:** rule fails if retrieved SUCCESS enters SUPPORTING count under any circumstance.

### CASE B · Superficial Match

- **Setup:** structural similarity but semantic role differs.
- **F10-B:** semantic dimension `NOT IMPLEMENTED` → R10-C-1 D composite = `INDETERMINATE` → retrieval state escalates to `REQUIRE_MORE_INVESTIGATION`.
- **Under F1-C:** `retrieval_returned_usable_candidate == false` (no MATCH). Honest Degrade does NOT fire.
- **Fresh evidence:** admitted normally.
- **Expected Q8 state:** fresh-evidence-driven selection (may be `NO_SELECTION` if fresh evidence is thin).
- **Modification / Execution permitted?** NO / NO.
- **Falsification:** rule fails if a superficial match ever produces MATCH state under current capability (§6.2 F10-B enforcement) or if it ever produces SELECTED via retrieval.

### CASE C · Prior Failure

- **Setup:** stored experience `E2 = FAILURE`. Current source structurally similar.
- **Retrieval state:** `MATCH` (per §4.1) → `RETRIEVED_PRIOR_FAILURE` evidence class.
- **F1-C:** `retrieval_returned_usable_candidate == true` → Honest Degrade fires.
- **F2-B:** PRIOR_FAILURE guides investigation but never blocks.
- **Expected Q8 state:** fresh investigation proceeds despite the retrieved failure guidance. Under current capability limits, R-4 count is degraded — but PRIOR_FAILURE does NOT create a permanent block. Output likely `Q8V1_SELECTION_STATE::INSUFFICIENT_EVIDENCE` in the current packet; a subsequent packet with different retrieval outcome or better provenance capability can revisit.
- **Modification / Execution permitted?** NO / NO.
- **Falsification:** rule fails if PRIOR_FAILURE ever produces unconditional permanent prohibition, or if it ever counts as CONTRADICTING evidence for R-4.

### CASE D · Insufficient Evidence at retrieval

- **Setup:** retrieval fires but stored record is missing schema fields OR trust status UNVERIFIED OR cold-start threshold not met.
- **Retrieval state:** `INSUFFICIENT_EVIDENCE` (retrieval layer · §4.4).
- **F1-C:** `retrieval_returned_usable_candidate == false`. Honest Degrade does NOT fire.
- **Expected Q8 state:** fresh-only path proceeds without degrade.
- **Modification / Execution permitted?** NO / NO.
- **Falsification:** rule fails if retrieval-layer `INSUFFICIENT_EVIDENCE` state ever triggers R-4 degrade under F1-C.

### CASE E · Memory-Caused Evidence

- **Setup:** retrieval fires · retrieval points to a location · ACTION walks to that location · evidence discovered.
- **Under F1-C:** if retrieval produced a usable candidate (MATCH), `retrieval_returned_usable_candidate == true` → degrade fires.
- **Under current capability:** no `discovery_source` field; memory-caused fresh cannot be distinguished from memory-independent fresh within the same MATCH-fired packet. Under §10.2 degrade, all fresh evidence in the packet is excluded from R-4 count.
- **Expected Q8 state:** `Q8V1_SELECTION_STATE::INSUFFICIENT_EVIDENCE` or `REQUIRE_MORE_INVESTIGATION`.
- **Modification / Execution permitted?** NO / NO.
- **Falsification:** rule fails if memory-caused evidence enters SUPPORTING count under any provenance state.

### CASE F · Contradictory Current Evidence

- **Setup:** retrieved SUCCESS · fresh evidence classifies STRUCTURALLY_CONTRADICTING.
- **F4-C:** separate contradiction path fires; contradiction visibility preserved via distinct marker.
- **Under F1-C degrade:** fresh CONTRADICTING evidence cannot enter R-4 CONTRADICTING count in this packet — BUT F4-C's contradiction marker surfaces the contradiction independently.
- **Expected Q8 state:** contradiction reported via F4-C marker; ordinary selection state likely `Q8V1_SELECTION_STATE::UNRESOLVED` if fresh evidence can enter arithmetic, else `INSUFFICIENT_EVIDENCE` under degrade — either way, contradiction is not lost.
- **Modification / Execution permitted?** NO / NO.
- **Falsification:** rule fails if the contradiction is silently absorbed into `INSUFFICIENT_EVIDENCE` without the F4-C marker surfacing it.

### CASE G · Different Semantic Role (structural similarity + semantic difference)

- **Setup:** current source structurally similar, semantic role differs.
- **F10-B:** semantic dimension `NOT IMPLEMENTED` (currently), and if semantic dimension is deemed safety-relevant per Sub-decision D → composite = `INDETERMINATE` → retrieval state = `REQUIRE_MORE_INVESTIGATION`.
- **F1-C:** `retrieval_returned_usable_candidate == false`. Honest Degrade does NOT fire.
- **Expected Q8 state:** `Q8V1_SELECTION_STATE::REQUIRE_MORE_INVESTIGATION` — honest disclosure of the safety-relevant capability gap.
- **Modification / Execution permitted?** NO / NO.
- **Falsification:** rule fails if a semantic-role mismatch produces a SELECTED outcome under current capability.

### CASE H · Circularity / Dual-Path Failure

- **Setup:** supposedly independent path shares upstream classifier vocabulary or file-memory tags with the memory-guided path.
- **Under current capability:** shared-upstream check is `NOT IMPLEMENTED`; dual-path check is `NOT IMPLEMENTED`.
- **Under F6-C:** the constitutional rule applies; operational enforcement is capability-limited.
- **Expected Q8 state:** anti-circularity output = `NOT_IMPLEMENTED` with disclosure. No `FULLY_PROTECTED` claim under current capability.
- **Modification / Execution permitted?** NO / NO.
- **Falsification:** rule fails if the anti-circularity output ever claims `FULLY_PROTECTED` while shared-upstream analysis is `NOT IMPLEMENTED`.

**None of these cases "pass" merely because this policy describes them.** They become runtime proof only after implementation and adversarial execution (§14.1 engineering chain).

---

## §16 · Falsification Requirements

| Rule | Falsification condition | Currently falsifiable under existing capability? |
|---|---|---|
| §4 six retrieval states | packet output containing a state not in the six | YES (documentation-level) |
| §4.1 MATCH under F10-B | MATCH fires while a safety-relevant dimension is `NOT IMPLEMENTED` | YES once §4.1 is implemented |
| §5 evidence class mapping | evidence class produced from a retrieval state not per §5 map | YES once implemented |
| §6.2 F10-B composite rule | composite emits `NOT_MATERIALLY_DIFFERENT` when a safety-relevant dimension is `NOT IMPLEMENTED` | YES once implemented AND Sub-decision D resolved |
| §7.3 F1-C fresh-evidence rule | fresh evidence from a MATCH-fired packet enters R-4 count under current capability | YES once F1-C flag exists |
| §7.4 "independently produced" | packet-level check misclassifies a memory-caused evidence item as independent | PARTIAL — currently only packet-level distinction possible |
| §8.3 MATCH sub-criteria | MATCH fires on a packet where any of the four criteria fails | YES once implemented |
| §8.4 hosting-function-scoped line comparison | MATCH fires despite hosting-function name mismatch or fires despite statement-index-within-function mismatch | YES once implemented |
| §9.2 anti-circularity output | `FULLY_PROTECTED` emitted while any sub-mechanism is `NOT_IMPLEMENTED` | **NO currently**; conditionally falsifiable **once the relevant Q8 V2 v2 output emission exists** (currently no emission is produced at runtime · see §9.2 F28 and §22 check 13) |
| §10.1 R11-B exclusion | any retrieved evidence class in the SUPPORTING or CONTRADICTING count | YES once implemented |
| §10.2 F1-C rule | Honest Degrade fires when `retrieval_returned_usable_candidate == false` | YES once F1-C flag exists |
| §11.2 F2-B rule | PRIOR_FAILURE produces unconditional NO_SELECTION with no R10-C-1 D evaluation attempted | YES once implemented |
| §12 F4-C contradiction path | fresh contradiction absorbed into `INSUFFICIENT_EVIDENCE` without contradiction marker | YES once F4-C mechanism defined (Sub-decision B) |
| §14.3 honesty markers | Q8 V2 v2 output missing any mandatory marker | YES |

**Load-bearing acknowledgement:** several falsification tests depend on capabilities that do not yet exist. Under current architecture, only the documentation-level tests can be exercised. Runtime-verified falsification requires implementation.

---

## §17 · Schema V1 Compatibility

**Schema V1 is founder-approved and frozen. This document does NOT modify Schema V1.**

Extensions listed in §14.2 (nine future capabilities + F1-C flag + F4-C contradiction representation) each carry the marker:

`REQUIRES SCHEMA EXTENSION · FOUNDER-APPROVED AMENDMENT REQUIRED`

These are documented as required future work, not applied. Q8 V2 v2 in its **capability-honest degrade** mode is fully-authorable against current Schema V1 — retrieval-informed acceleration is deferred until F1-C flag capability and provenance capability land.

---

## §18 · Unresolved Sub-Dependencies · Preserved Explicitly

Per founder instruction, no sub-decision is silently resolved. Five unresolved sub-dependencies remain:

| ID | Owner | Description | Status |
|---|---|---|---|
| **Sub-decision A** | F1-C | Representation mechanism for `retrieval_returned_usable_candidate` (Schema V1 field vs runtime-only vs derived) | `FOUNDER DEFINITION REQUIRED` |
| **Sub-decision B** | F4-C | Contradiction-path representation (new selection state vs packet field vs persistence record vs alternative) | `FOUNDER DEFINITION REQUIRED` |
| **Sub-decision C** | F6-C | Priority ordering of memory-pathway coverage; new-subsystem inheritance rules; per-pathway authorisation | `FOUNDER DEFINITION REQUIRED` |
| **Sub-decision D** | F10-B | Authoritative definition of "safety-relevant dimension" | `FOUNDER DEFINITION REQUIRED` |
| **Sub-decision E** | F1-C / R10-C-2 C | Per-evidence `discovery_source` field · location + population rule · Schema V1 amendment authorization | `FOUNDER DEFINITION REQUIRED` |

**None of the five are resolved by this policy correction.** Q8 V2 v2 operates under capability-honest degrade until each is founder-approved.

---

## §19 · Forbidden Actions

Q8 V2 v2 MUST NOT:

- Modify runtime code, tests, schema fields in production, or registries
- Implement any of the nine future capabilities
- Create execution pathways
- Create autonomous execution
- Create an execution whitelist
- Authorize `SELECTED → EXECUTED`
- Authorize memory-driven modification
- Claim runtime capability that does not currently exist
- Silently resolve an unresolved architectural question (A-E)
- Reinterpret any founder-approved constitutional invariant
- Read confidence as a selection weight
- Use LLM at runtime
- Bridge to any store other than `data/nex1-investigation-conclusions/entries.jsonl`
- Silently apply a retrieved fix
- Reintroduce autonomous execution under any renamed form
- Convert `UNKNOWN` into `SAME`
- Convert `NOT IMPLEMENTED` into `NO DIFFERENCE`
- Treat prior failure as permanent authority

---

## §20 · Founder Approval Gate

**Sequence to implementation (locked):**

```
Q8 V2 v2 corrected (this document · 2026-09-18)                    ← COMPLETE
        ↓
FORENSIC REVIEW #3 OF Q8 V2 v2 (corrected)                          ← required next step
        ↓
CORRECTIONS (if any)                                                ← as required
        ↓
SECOND FORENSIC REVIEW (if corrections applied)                     ← if needed
        ↓
FOUNDER RESOLUTION OF SUB-DECISIONS A-E (as required for build)    ← required
        ↓
FOUNDER APPROVAL OF Q8 V2 v2                                        ← required
        ↓
FIX 24 PHASE A · READ-ONLY PRE-BUILD AUDIT                          ← only after founder approval
        ↓
ADVERSARIAL VERIFICATION (Cases A-H)                                ← after Phase A
        ↓
IMPLEMENTATION (only if all prior steps pass)                       ← never before
```

**No stage may be skipped. No autonomous execution is authorised at any stage.**

---

## §21 · Final Status

```
Q8_V2_V4_DOCUMENTATION_CORRECTION_COMPLETE · PENDING_FORENSIC_REVIEW

R10 = R10-C · FOUNDER CONFIRMED
R11 = R11-B · FOUNDER CONFIRMED
R10-C-1..4 = D · C · D · D · FOUNDER CONFIRMED
F1 = C · FOUNDER CONFIRMED
F2 = B · FOUNDER CONFIRMED
F4 = C · FOUNDER CONFIRMED
F6 = C · FOUNDER CONFIRMED
F10 = B · FOUNDER CONFIRMED

SCHEMA V1 = FROZEN · UNCHANGED
FIX 23b = UNCHANGED
FIX 23c = UNCHANGED
Q8 V1 = UNCHANGED
Q7 V1 = UNCHANGED

FIX 24 = NOT IMPLEMENTED
AUTONOMOUS EXECUTION = NOT AUTHORIZED

NINE FUTURE CAPABILITIES = DOCUMENTED · NOT IMPLEMENTED
FIVE UNRESOLVED SUB-DECISIONS (A-E) = FOUNDER DEFINITION REQUIRED

F16-F30 CORRECTIONS = APPLIED IN v3 ROUND
F31/F32/F34/F39/F41 CORRECTIONS = APPLIED IN v4 ROUND
F1-C OPERATIONAL EFFECT = POLICY DEFINED · CURRENTLY REACHABLE = FALSE (F16 · pending Sub-decision D)
F10-B PRECEDENCE = FOUNDER DEFINITION REQUIRED · F21 pending · NO RUNTIME DEFAULT AUTHORIZED (v4 F31 correction)
F23 HOSTING_FUNCTION IDENTITY CRITERION = FOUNDER DEFINITION REQUIRED · F23 pending · NO RUNTIME DEFAULT AUTHORIZED (v4 F32 correction)
F4-C CONTRADICTION SCOPE = fresh-vs-retrieved ONLY (v4 F34 alignment) · fresh-vs-fresh NOT IN F4-C SCOPE
```

---

## §22 · Documentation-Only Compositional Self-Audit (Strengthened per Correction §6.10 · F14 · F25 · F20)

**F14 finding correction (v2):** the previous 15-point self-audit was surface-level. This audit performs compositional checks — testing whether rules combine correctly when multiple fire on the same input.

**F25 correction (v3):** compositional checks involving MATCH must be marked `CAPABILITY-CONDITIONAL` and cannot pass merely because unreachable branches are logically consistent. Check 11 explicitly tests MATCH reachability under current capability.

**Category legend (do not collapse):**

- `LOGICALLY CONSISTENT` — the rules do not contradict each other when composed
- `CURRENTLY REACHABLE` — a real packet can currently exercise this composition
- `CURRENTLY IMPLEMENTED` — the required runtime capability exists
- `CURRENTLY VERIFIABLE` — the composition can be observed and adversarially tested today

### Compositional check 1 · Retrieval + fresh evidence

- Rules fire together: §4 retrieval state derivation + §7.3 fresh-evidence eligibility + §10.2 Honest Degrade.
- Composition: retrieval state determines `retrieval_returned_usable_candidate`. If false, §10.2 degrade does not fire; fresh evidence admitted per §7.3.
- **Result:** LOGICALLY CONSISTENT · CAPABILITY-CONDITIONAL (MATCH branch unreachable per F16)

### Compositional check 2 · Retrieval + no match

- Rules fire together: §4.2 NO_MATCH + §7.3 eligibility + §10.2 degrade.
- Composition: NO_MATCH → `retrieval_returned_usable_candidate == false` → §10.2 does not degrade → fresh evidence admitted normally.
- **Result:** LOGICALLY CONSISTENT · CURRENTLY REACHABLE (NO_MATCH branch is reachable) · CURRENTLY VERIFIABLE once retrieval subsystem exists

### Compositional check 3 · Retrieval + prior failure

- Rules fire together: §4.1 MATCH + §5.2 PRIOR_FAILURE + §11.2 F2-B rule + §10.2 F1-C degrade.
- Composition: MATCH+FAILURE → PRIOR_FAILURE injected as guidance; degrade fires per F1-C; PRIOR_FAILURE never blocks per F2-B; fresh investigation proceeds; PRIOR_FAILURE does not enter R-4 SUPPORTING or CONTRADICTING count.
- **Result:** LOGICALLY CONSISTENT · CAPABILITY-CONDITIONAL (MATCH unreachable per F16 · check passes vacuously under current capability)

### Compositional check 4 · Retrieval + contradiction · v4 scope-corrected

- Rules fire together: §4.1 MATCH + §12 F4-C separate contradiction path (fresh-vs-retrieved ONLY per v4 F34 alignment) + §10.2 degrade.
- Composition: MATCH fires (retrieval-derived candidate present); fresh CONTRADICTING evidence against that retrieval-derived candidate exists; §10.2 excludes fresh evidence from R-4 count; F4-C contradiction-visibility mechanism (representation deferred to Sub-decision B) fires independently on this retrieval-involved contradiction. Contradiction visibility preserved.
- **Fresh-vs-fresh contradiction (no retrieval-derived element):** F4-C does NOT fire (v4 F34 scope alignment); handled by Q8 V1 R-4 arithmetic alone.
- **Result:** LOGICALLY CONSISTENT · CAPABILITY-CONDITIONAL (MATCH unreachable per F16; Sub-decision B representation pending; scope aligned to F4-C founder scope in v4)

### Compositional check 5 · File-memory guidance

- Rules fire together: ACTION 2 file-memory + §9.3 F6-C constitutional-global rule + §10.2.
- Composition: file-memory operates on pathway 5 (per §9.3). Under F6-C, constitutional rule applies but operational enforcement is not yet implemented for this pathway. Q8 V2 v2's specific enforcement (retrieval + F1-C degrade) does not apply to file-memory-guided evidence.
- **Result:** HONEST GAP · LOGICALLY CONSISTENT · CURRENTLY UNENFORCED for pathway 5. File-memory-caused evidence continues to enter Q8 selection as untagged fresh under current capability. Disclosed per §9.3 F27 and §14.3.

### Compositional check 6 · Unknown composite dimension

- Rules fire together: §6.2 F10-B + §4.6 REQUIRE_MORE_INVESTIGATION.
- Composition: safety-relevant dimension `NOT IMPLEMENTED` → composite = `INDETERMINATE` → retrieval state escalates to `REQUIRE_MORE_INVESTIGATION` → `retrieval_returned_usable_candidate == false` → §10.2 does not degrade.
- **Result:** LOGICALLY CONSISTENT · CURRENTLY REACHABLE. `UNKNOWN` correctly does NOT become `SAME`. This is the currently-dominant runtime path under F16.

### Compositional check 7 · Unsupported provenance

- Rules fire together: §7.4 independence definition + §13.2 current-capability degrade.
- Composition: under current capability (no `discovery_source`), independence is only assertable at packet level via `retrieval_returned_usable_candidate == false`. Where retrieval fires with MATCH, independence cannot be asserted; evidence excluded from R-4 count.
- **Result:** LOGICALLY CONSISTENT · CAPABILITY-CONDITIONAL (MATCH branch unreachable per F16; packet-level check for the `false` branch is reachable and works)

### Compositional check 8 · Prior success + fresh evidence

- Rules fire together: §5.1 PRIOR_SUCCESS + §10.1 absolute exclusion + §11.1.
- Composition: PRIOR_SUCCESS guides investigation only; never enters R-4 count; fresh evidence carries selection independently.
- **Result:** LOGICALLY CONSISTENT · CAPABILITY-CONDITIONAL (PRIOR_SUCCESS cannot currently be produced per F16; check passes vacuously)

### Compositional check 9 · Prior failure + fresh success

- Rules fire together: §5.2 PRIOR_FAILURE + §11.2 F2-B + fresh SUCCESS-flavoured evidence.
- Composition: PRIOR_FAILURE guides; F2-B says no block; fresh SUCCESS evidence enters R-4 count if `retrieval_returned_usable_candidate == false` (F1-C) — but if MATCH fired, degrade blocks fresh from count under current capability, resulting in an uncertainty state (not a false success).
- **Result:** LOGICALLY CONSISTENT · CAPABILITY-CONDITIONAL (PRIOR_FAILURE cannot currently be produced per F16; check passes vacuously)

### Compositional check 10 · Current evidence vs historical evidence

- Rules fire together: §5 evidence classes + §10.1 R11-B + §11 F2-B.
- Composition: retrieved evidence (historical) never enters R-4 count. Fresh evidence (current) enters R-4 count when packet permits per F1-C. No conflation.
- **Result:** LOGICALLY CONSISTENT · CAPABILITY-CONDITIONAL (retrieved evidence path unreachable per F16; fresh path is reachable)

### Compositional check 11 · MATCH REACHABILITY UNDER CURRENT CAPABILITY (F25 · load-bearing)

- Question set:
  1. Can MATCH currently be emitted at runtime? **NO.**
  2. If not, why? **Because §6.3 forces composite output to `INDETERMINATE` while `safety_relevant_definition_authorized == false`; §4.1 MATCH requires the composite to permit "not different" across R10-C-1 D dimensions; `INDETERMINATE` prevents this precondition; therefore §4.6 fires `REQUIRE_MORE_INVESTIGATION` instead.**
  3. Which prerequisite blocks it? **Sub-decision D (authoritative definition of "safety-relevant dimension") + the implementation of the corresponding dimension evaluators.**
  4. Which downstream mechanisms therefore remain dormant? **§5 RETRIEVED_PRIOR_SUCCESS / RETRIEVED_PRIOR_FAILURE production · §10.2 Honest Degrade third-bullet activation · §11.1 PRIOR_SUCCESS operational guidance role · §11.2 PRIOR_FAILURE operational guidance role · §12 F4-C contradiction-under-degrade preservation clause · CASE A/C/E/F/H reachability at §15.**
  5. Is that operational vacuity disclosed? **YES · in §4 preamble, §4.1, §6.3 F16 chain, §10.2, §14.3 markers, §21 status, §22 check 11 (this check), §23 change log.**

- **Result:** LOGICALLY CONSISTENT · NOT CURRENTLY REACHABLE · NOT CURRENTLY IMPLEMENTED · NOT CURRENTLY VERIFIABLE. This is the load-bearing disclosure that Q8 V2 v2's principal F1-C protective mechanism is dormant until Sub-decision D lands.

### Compositional check 12 · Retrieval subsystem failure (F26)

- Rules fire together: none — no state exists.
- Composition: the six retrieval states of §4 do not cover retrieval subsystem crash / timeout / malformed response.
- **Result:** REPRESENTATION GAP · FOUNDER / ARCHITECTURE DEFINITION REQUIRED per §4 preamble. Q8 V2 v2 output currently would need to synthesise a fallback state — this policy does not authorise inventing one.

### Compositional check 13 · Anti-circularity current-capability check (F28)

- Rules fire together: §9.1 three sub-mechanisms all `none` + §9.2 emits `NOT_IMPLEMENTED` + §9.4 `shared_upstream_detected: not_checked`.
- Composition: R10-C-4 D policy exists; enforcement does not; CASE H is unfalsifiable under current capability.
- **Result:** LOGICALLY CONSISTENT · NOT CURRENTLY IMPLEMENTED · NOT CURRENTLY VERIFIABLE. This does NOT authorise Fix 24 or autonomous execution.

### Compositional check 14 · Fix 17 E2 dependency (F29)

- Rules fire together: §5 preamble authoritative-source rule + §5.1 / §5.2 evidence class production requiring `E2 outcome_class`.
- Composition: Q8 V2 v2 reads E2 as authoritative; correctness of E2 depends on Fix 17 writer's D1/D2/D4 → E2 derivation which is a load-bearing separate audit target.
- **Result:** LOGICALLY CONSISTENT · CURRENTLY IMPLEMENTED at reader side · CURRENTLY DEPENDENT on writer's derivation which is not audited by this policy. Recommended follow-up: separately-authorised Fix 17 writer audit.

### Compositional check 15 · Prior failure behavioural comparison (F30)

- Rules fire together: §5.2 "May inform R10-C-1 D behavioural dimension: YES" + §6.1 behavioural dimension categorical rule + §6.2 counting rule "no numerical weights".
- Composition: PRIOR_FAILURE's stored D1-D4 provides a categorical comparison point for behavioural dimension. NOT a weight / confidence adjustment / probability boost / score modifier.
- **Result:** LOGICALLY CONSISTENT · categorical comparison preserved · F2.3 preserved.

### Compositional check 16 · F10-B precedence (F21) · v4 corrected

- Rules fire together: §6.2 aggregation rule + F10-B literal reading.
- Composition: two mutually-exclusive precedence readings possible; no frozen decision resolves.
- **Result:** LOGICALLY AMBIGUOUS · FOUNDER DEFINITION REQUIRED · **NO runtime default authorised** (v4 F31 correction). Policy does not designate a "safer default" or "provisional runtime behaviour". Any Q8 V2 v2 implementation of the aggregation precedence is `NOT AUTHORIZED · PENDING FOUNDER DECISION` on F21.

### Compositional check 17 · F4 contradiction-representation neutrality (F20)

- Rules fire together: §12.2 contradiction-visibility mechanism + §12.4 Sub-decision B unresolved.
- Composition: policy authors the semantic requirement (contradiction remains observable) without committing to any of the four Sub-decision B representation options; language throughout §12 and §22 is representation-neutral.
- **Result:** LOGICALLY CONSISTENT · REPRESENTATION-NEUTRAL · Sub-decision B remains open.

### 15-point rule-level checks (retained · updated for v3)

| # | Check | Result |
|---|---|---|
| 1 | All eleven founder decisions preserved? | **PASS** — §2 records all eleven (six R10/R11 + five F1/F2/F4/F6/F10) |
| 2 | R10-C preserved? | **PASS** |
| 3 | R11-B preserved? | **PASS** — §10.1 absolute exclusion |
| 4 | All authority boundaries preserved? | **PASS** — §0, §3, §19 |
| 5 | Schema V1 untouched? | **PASS** — §17 |
| 6 | Future capabilities clearly marked as NOT IMPLEMENTED? | **PASS** — §14.2 |
| 7 | Fix 23b accurately bounded? | **PASS** — §8.1, §8.2 |
| 8 | Can retrieved memory count toward R-4? | **PASS · NO** — §10.1 |
| 9 | Can memory silently become current proof? | **PASS · NO** — §10.2 F1-C rule (currently dormant per F16) |
| 10 | Can prior failure create a permanent deadlock? | **PASS · NO** — §11.2 F2-B rule; compositional check 3 (capability-conditional) |
| 11 | Are MATCH/NO_MATCH/AMBIGUOUS causally defined? | **PASS** — §4.1-4.6 |
| 12 | Are derived evidence classifications distinguished from source data? | **PASS** — §5 authoritative source rule + F29 dependency disclosure |
| 13 | Are adversarial cases A-H falsifiable? | **PARTIAL** — Cases A, C, E, F, H involve MATCH which is unreachable per F16 (compositional check 11); Cases B, D, G are currently reachable |
| 14 | Does the document distinguish documented architecture from implemented capability? | **PASS** — §14 engineering chain + §14.3 markers + F16 chain in §6.3 |
| 15 | Does anything in the document accidentally authorize modification or execution? | **PASS · NO** — every retrieval state and evidence class ends with `MODIFICATION AUTHORITY = NO · EXECUTION AUTHORITY = NO` |

**Aggregate compositional check (v3):** no contradictions between rules under F1-C · F2-B · F4-C · F6-C · F10-B. **Load-bearing v3 disclosure:** compositional checks 1, 3, 4, 7, 8, 9, 10 involve MATCH which is `NOT CURRENTLY REACHABLE` per F16 chain (see check 11). Those checks are `LOGICALLY CONSISTENT · CAPABILITY-CONDITIONAL` — they pass in the logic layer but pass vacuously in the runtime layer until Sub-decision D lands. Where capability limits produce observationally-identical outputs across adversarial cases (Cases A, C, E, F under degrade all emit similar uncertainty states), this is disclosed per §14.4 as a distinguishability limit, not a defect.

---

## §23 · Change Log · Documentation-Only Corrections Applied

| Correction ref | Previous problem | Correction | Governing founder decision | Current implementation status | Unresolved dependency |
|---|---|---|---|---|---|
| §6.1 F1 | v1 §10.2 `retrieved_experience_id != null` proxy over-broad; NO_MATCH triggered degrade | §4 + §10.2 rewritten to separate `retrieval_attempted` from `retrieval_returned_usable_candidate` per F1-C | F1-C | Documented only · `retrieval_returned_usable_candidate` flag NOT IMPLEMENTED | Sub-decision A |
| §6.2 F2 | R-10 deadlock re-emerged at Honest Degrade layer; PRIOR_FAILURE effectively permanent block | §11.2 rewritten under F2-B: prior failure guides, never blocks; fresh investigation always proceeds | F2-B | Documented only | None new |
| §6.3 F4 | UNRESOLVED unreachable under degrade; contradiction silently absorbed | §12 rewritten under F4-C: separate contradiction path with distinct marker preserving visibility | F4-C | Documented only · contradiction-representation mechanism NOT IMPLEMENTED | Sub-decision B |
| §6.4 F6 | File-memory pathway uncovered; scope ambiguity | §9.3 rewritten under F6-C: constitutional rule global, operational enforcement per-capability; five memory pathways enumerated | F6-C | Documented only · pathway-specific operational coverage NOT IMPLEMENTED | Sub-decision C |
| §6.5 F10 | Unimplemented dimension counted as "not different"; UNKNOWN silently became SAME | §6.2 rewritten under F10-B: unimplemented safety-relevant dimension → INDETERMINATE; UNKNOWN ≠ SAME preserved | F10-B | Documented only · safety-relevant definition NOT AUTHORIZED | Sub-decision D |
| §6.6 F8 | Retrieval-state vocabulary claimed distinct but 2 of 6 collided with Q8 V1 selection states | §4 preamble corrected: two shared labels qualified with layer prefix (`Q8V2_RETRIEVAL_STATE::` vs `Q8V1_SELECTION_STATE::`) | Documentation clarification (F1-C guardrail) | Documented only | None new |
| §6.7 F11 | E2 outcome_class derivation authority undocumented | §5 preamble adds authoritative-source rule: Fix 17 writer derives, Q8 V2 v2 reads | Documentation clarification | Documented; underlying Fix 17 writer derivation rule remains a Fix 17 writer-specification gap | Writer-specification (out of Q8 V2 scope) |
| §6.8 F12 | "Independently produced" primitive undefined | §7.4 defines primitive using only current-architecture signals; future extension flagged | F1-C + R10-C-2 C | Documented; runtime-checkable at packet level only | Sub-decision E for per-evidence extension |
| §6.9 F13 | RETRIEVED_PRIOR_SUCCESS "guides" claim operationally vacuous under degrade | §11.1 and §14.4 acknowledge observational collapse honestly; guidance role documented but effect awaits provenance capability | F1-C + F6-C | Documented only | Sub-decision E |
| §6.10 F14 | Self-audit surface-level | §22 strengthened with 10 compositional checks | Documentation discipline | Documented | None new |
| §6.11 F15 | Adversarial cases observationally-collapsed under degrade | §14.4 discloses collapse honestly; §15 cases updated with capability-honest expected states | Documentation honesty | Documented | None new |
| §6.12 F3 | Line-comparison rule over-strict (file-line-count ±0) | §8.4 rewritten: hosting-function-scoped comparison, file-line-count NOT compared | Documentation defect fix | Documented only | None new |
| §6.13 F5 | Packet-level proxy over-broad (retrieval NO_MATCH still degraded) | §7.3 + §10.2 replaced packet-proxy with F1-C contribution-based rule | F1-C | Documented only · F1-C flag NOT IMPLEMENTED | Sub-decision A |
| §6.14 F6 | File-memory pathway not addressed | §9.3 explicit enumeration + constitutional-global-operational-phased framing per F6-C | F6-C | Documented only | Sub-decision C |
| §6.15 F7 | INSUFFICIENT_EVIDENCE / REQUIRE_MORE_INVESTIGATION overlap | §4.4 + §4.6 add explicit priority rule (schema-completeness first, tracer-availability second) | Documentation clarification | Documented only | None new |
| §6.16 F9 | RETRIEVED_PRIOR_FAILURE CONTRADICTING count silence | §5.2 + §10.1 explicit "NO to CONTRADICTING count" statement | Documentation gap fix | Documented only | None new |
| §6.17 F10 | v1 §22 self-audit reported PASS but missed compositional issues | §22 rewritten with 10 compositional checks + retained 15 rule-level checks | Documentation discipline | Documented only | None new |

**Total v2-round corrections applied: 17 (covering F1-F15 as authored + F3/F5/F6/F7/F9 supplementary distinct-finding fixes surfaced by cross-reference).**

### v3-round corrections applied (Forensic Review #3 findings F16-F30)

| Correction ref | Previous problem | Documentation correction | Governing decision | Current implementation status | Unresolved dependency |
|---|---|---|---|---|---|
| §5 F16 | MATCH operational vacuity undisclosed | §4 preamble + §4.1 + §6.3 F16 chain + §10.2 disclosure + §22 check 11 + §21 status all disclose reachability chain from Sub-decision D → INDETERMINATE → REQUIRE_MORE_INVESTIGATION → MATCH unreachable | Existing frozen chain of R10-C-1 D + F10-B (no new decision); disclosure only | Documented only; F1-C rule remains policy-defined but currently unreachable | Sub-decision D |
| §6 F17 | Invalid cross-reference to "retrieval-safety-gate (§9.2)" | §4.1 rewritten to reference §5.3 SUPERFICIAL_MATCH downgrade condition (which existed); no new architectural concept introduced | Documentation defect fix | Documented only | None new |
| §7 F18 | 5 vs 6 memory pathway count inconsistency | §9.3 reconciled as "5 constitutional-scope pathways + 1 Q8-V2-own Fix-17 retrieval target"; explicit numerical note added | F6-C interpretation | Documented only | None new |
| §8 F19 | Runtime honesty markers scattered | §14.3 consolidated as authoritative list of 21 markers organised in categories A-I | Documentation clarity | Documented only | None new |
| §9 F20 | "marker" language pre-supposed Sub-decision B representation | §12 rewritten with representation-neutral "F4-C CONTRADICTION VISIBILITY" / "contradiction-visibility mechanism" language; §22 check 4 updated; §12.4 four-option list preserved | F4-C · Sub-decision B still open | Documented only | Sub-decision B |
| §10 F21 | §6.2 precedence override may exceed F10-B literal | §6.2 rewritten to preserve BOTH readings; policy defers to Reading 1 (strict INDETERMINATE) as safer default with honesty marker `f10b_precedence_reading_authorized: false`; question surfaced as `FOUNDER DEFINITION REQUIRED · F10-B PRECEDENCE` | No existing frozen decision resolves; deferred | Documented only · defaulted to Reading 1 | New founder question surfaced (not silently resolved) |
| §11 F22 | Three `iff` bullets in §7.3 ambiguous | §7.3 rewritten as "AT LEAST ONE of the following holds" with explicit OR | Documentation clarity | Documented only | None new |
| §12 F23 | §8.4 hosting-function name-equality is silent design choice | §8.4 rewritten to preserve hosting-function-scoped principle (F3 correction retained); name-equality sub-rule marked `POLICY CHOICE PENDING FOUNDER REVIEW` with three options (i)/(ii)/(iii); policy defers to Option (i) strict name-equality as safer default with honesty marker `hosting_function_identity_criterion_authorized: false` | No existing frozen decision resolves; deferred | Documented only · defaulted to Option (i) | New founder question surfaced (not silently resolved) |
| §13 F24 | §10.4 "arithmetic unchanged" wording misleading | §10.4 rewritten to distinguish `ARITHMETIC UNCHANGED` from `INPUT SET FILTERED` explicitly | Documentation clarity | Documented only | None new |
| §14 F25 | Self-audit checks pass vacuously under MATCH-unreachability | §22 extended with check 11 (MATCH reachability) + checks 12-17 (retrieval subsystem failure · anti-circularity · Fix 17 E2 · behavioural comparison · F10-B precedence · F4 representation-neutrality); MATCH-involved checks marked `CAPABILITY-CONDITIONAL`; category legend added | Documentation discipline | Documented only | None new |
| §15 F26 | Retrieval subsystem failure not covered | §4 preamble discloses NO state exists for retrieval subsystem failure; marked `FOUNDER / ARCHITECTURE DEFINITION REQUIRED`; no new state invented | Deferred to future architectural decision | Documented only | New architectural question surfaced |
| §16 F27 | Five-pathway operational risk buried in table | §9.3 promoted to elevated `CURRENT OPERATIONAL COVERAGE GAP · LOAD-BEARING RISK DISCLOSURE` callout | F6-C phased scope | Documented only | Sub-decision C |
| §17 F28 | Anti-circularity limit understated | §9.2 strengthened with F28 disclosure: policy exists · enforcement does NOT · CASE H unfalsifiable · no safety by documentation · not authorising Fix 24 or autonomous execution | R10-C-4 D existing | Documented only | None new (existing sub-mechanisms known future capabilities) |
| §18 F29 | Fix 17 E2 derivation dependency silent | §5 preamble adds explicit F29 load-bearing dependency note: Q8 V2 v2 reads E2 authoritative; correctness depends on Fix 17 writer's D1/D2/D4 → E2 derivation; separately-auditable | Documentation dependency disclosure | Documented only | Separate Fix 17 audit target (out of Q8 V2 scope) |
| §19 F30 | "Inform R10-C-1 D behavioural dimension" undefined | §5.2 + §6.1 clarified: "inform" = categorical comparison point via D1-D4 data; NOT numerical weighting/confidence/probability adjustment; F2.3 preserved | Documentation clarity | Documented only | None new |

**Total v3-round corrections applied: 15 (one per F16-F30 finding).**

**v3 · Zero silent resolutions.** Where two readings existed (F21, F23), policy defaulted to the safer reading with honesty marker AND explicitly surfaced the question as founder-definition-required. Where new architectural concept would be needed (F26), no invention occurred. Where operational vacuity existed (F16), it was disclosed rather than hidden.

### v4-round corrections applied (Forensic Review #4 findings F31 · F32 · F34 · F39 · F41)

| Correction ref | Previous problem (in v3) | Documentation correction (v4) | Governing decision | Current implementation status | Unresolved dependency |
|---|---|---|---|---|---|
| §5.1 F31 | v3 §6.2 imposed "implementations MUST defer to strict INDETERMINATE (Reading 1) as the safer default" — silent runtime prescription while claiming F21 was founder-definition-required | §6.2 rewritten in v4 to explicitly state that **no Q8 V2 v2 implementation of the aggregation precedence may proceed until founder resolves F21**; no runtime default is authorised; "safer" is not equated with "authorized"; honesty marker `f10b_precedence_reading_authorized: false` retained but corresponding runtime behaviour is `NOT AUTHORIZED · PENDING FOUNDER DECISION` | F21 remains `FOUNDER DEFINITION REQUIRED` | Documented only · Reading 1 vs Reading 2 NOT authorised | F21 pending |
| §6.1 F32 | v3 §8.4 imposed "implementations MUST defer to Option (i) strict name-equality as the safer default" — same silent-default pattern for hosting-function identity | §8.4 rewritten in v4 to explicitly state that **no Q8 V2 v2 implementation of the §8.4 line-comparison identity criterion may proceed until founder resolves F23**; no runtime default is authorised; Option (iv) "other founder-authorised criterion" added to menu; hosting-function-scoped principle (F3 correction) retained | F23 remains `FOUNDER DEFINITION REQUIRED` | Documented only · Options (i)/(ii)/(iii)/(iv) NOT authorised | F23 pending |
| §7 F34 | v3 §12.1 first disjunct ("at least one supporting item (fresh or retrieved)") permitted F4-C to fire on fresh-vs-fresh contradictions in retrieval-less packets, silently broadening F4-C beyond its founder-authorised scope | §12.1 rewritten in v4 to explicitly require at least one retrieval-derived element (retrieved candidate OR retrieval-derived supporting item) for F4-C to fire; fresh-vs-fresh contradictions are `EXPLICITLY OUT OF F4-C SCOPE` and handled by Q8 V1 R-4 arithmetic alone; §22 check 4 updated accordingly | F4-C founder scope preserved | Documented only | Sub-decision B (representation) remains pending |
| §8 F39 | v3 §16 falsification table for §9.2 anti-circularity had answer "YES once documented output surfaces" under "Currently falsifiable?" — conflated current vs future falsifiability | §16 row corrected in v4 to `NO currently; conditionally falsifiable once the relevant Q8 V2 v2 output emission exists`; explicit distinction between current and conditional/future falsifiability | Documentation ambiguity fix | Documented only | None new |
| §9 F41 | v3 §4.1 F17 correction clause ("no downgrade to SUPERFICIAL_MATCH per §5.3 is triggered") was redundant with the earlier condition ("all R10-C-1 D dimensions ... report 'not different'") | §4.1 rewritten in v4 to delete the redundant clause; a `F41 correction` note documents that the deletion adds no independent condition; SUPERFICIAL_MATCH downgrade is already subsumed by the R10-C-1 D "not different" requirement | Documentation redundancy fix | Documented only | None new |

**Total v4-round corrections applied: 5 (one per F31 · F32 · F34 · F39 · F41 finding).**

**v4 · Zero silent resolutions.** Prior v3 "MUST defer to safer default" language for F21 and F23 has been removed entirely; no runtime default is authorised in v4 pending founder decision. F4-C scope has been narrowed to match the founder-authorised scope literally (fresh-vs-retrieved only); fresh-vs-fresh contradiction is explicitly out of F4-C scope. §16 falsifiability wording distinguishes current vs future. §4.1 redundant clause removed.

---

## §24 · Final Report · v3

### Documentation

- **File modified:** `docs/doctrine/nex1-q8-v2-operational-policy-v2-2026-09-18.md` (existing document · no new file created per founder direction)
- **v3 round sections changed:** header · §4 preamble · §4.1 · §5 preamble · §5.2 · §6.1 · §6.2 · §6.3 · §7.3 · §8.4 · §9.2 · §9.3 · §10.2 · §10.4 · §12 (all subsections) · §14.3 · §21 · §22 (all subsections) · §23 · §24
- **F16-F30 forensic findings addressed:** all 15 · see §23 v3-round table

### F16-F30 closure table

| Finding | Action | Result | Founder decision required? |
|---|---|---|---|
| F16 | Explicit MATCH-unreachability chain disclosed at §4 preamble · §4.1 · §6.3 · §10.2 · §22 check 11 · §21 · §23 | LOAD-BEARING DISCLOSURE APPLIED · policy definition preserved · runtime reachability marked FALSE | Sub-decision D (already open) |
| F17 | Invalid cross-reference to §9.2 replaced with §5.3 reference in §4.1 | DOCUMENTATION DEFECT FIXED | NO |
| F18 | 5 vs 6 memory pathway reconciled in §9.3 as "5 constitutional-scope + 1 Q8-V2-own future target" | DOCUMENTATION DEFECT FIXED | NO |
| F19 | Runtime honesty markers consolidated in §14.3 (21 markers · categories A-I) | DOCUMENTATION DEFECT FIXED | NO |
| F20 | "marker" language replaced with representation-neutral "F4-C CONTRADICTION VISIBILITY" / "contradiction-visibility mechanism" throughout §12 and §22 check 4 | DOCUMENTATION DRIFT FIXED · Sub-decision B remains open | Sub-decision B (already open) |
| F21 | §6.2 rewritten to preserve BOTH F10-B precedence readings; defaulted to Reading 1 (strict INDETERMINATE); question surfaced as FOUNDER DEFINITION REQUIRED · F10-B PRECEDENCE | NEW FOUNDER QUESTION SURFACED (not silently resolved) | YES · F10-B precedence |
| F22 | §7.3 "iff X / iff Y" ambiguity replaced with "AT LEAST ONE of the following holds" explicit OR | DOCUMENTATION AMBIGUITY FIXED | NO |
| F23 | §8.4 hosting-function-scoped principle retained; name-equality sub-rule marked POLICY CHOICE PENDING FOUNDER REVIEW with three options; defaulted to Option (i) strict name-equality | NEW FOUNDER QUESTION SURFACED (not silently resolved) | YES · §8.4 identity criterion |
| F24 | §10.4 rewritten to distinguish ARITHMETIC UNCHANGED from INPUT SET FILTERED | DOCUMENTATION AMBIGUITY FIXED | NO |
| F25 | §22 extended with check 11 (MATCH reachability) + checks 12-17 (F26-F30 coverage); MATCH-involved checks marked CAPABILITY-CONDITIONAL; category legend added | SELF-AUDIT WEAKNESS FIXED | NO |
| F26 | §4 preamble discloses no state exists for retrieval subsystem failure; marked FOUNDER / ARCHITECTURE DEFINITION REQUIRED; no new state invented | CAPABILITY GAP DISCLOSED | YES · retrieval-failure state |
| F27 | §9.3 promoted to elevated CURRENT OPERATIONAL COVERAGE GAP · LOAD-BEARING RISK DISCLOSURE callout | RISK ELEVATED · already-open Sub-decision C preserved | Sub-decision C (already open) |
| F28 | §9.2 strengthened with policy-exists-enforcement-does-not disclosure; CASE H unfalsifiable under current capability disclosed | ANTI-CIRCULARITY LIMIT DISCLOSED | NO (existing future capabilities) |
| F29 | §5 preamble surfaces Fix 17 E2 derivation dependency as load-bearing separately-auditable | DEPENDENCY DISCLOSED · out of Q8 V2 scope | Separate Fix 17 audit target |
| F30 | §5.2 + §6.1 clarify "inform" = categorical comparison point; not weighting/confidence/probability | DOCUMENTATION AMBIGUITY FIXED | NO |

**Aggregate: 15 findings closed at documentation level. 3 findings surface NEW founder questions (F21 · F23 · F26) — none silently resolved. 4 findings map to already-open sub-decisions (A/B/C).**

### F1-F15 retest matrix (after v3 corrections)

| Finding | Prior v2 verdict | v3 retest verdict | Reason |
|---|---|---|---|
| F1 | PARTIAL | **PARTIAL · improved** | F16 disclosure applied; F1-C rule remains operationally vacuous until Sub-decision D lands, but this is now explicitly disclosed |
| F2 | PARTIAL | **PASS at documentation layer** | F2-B "never blocks" rule preserved; operational block scenarios now disclosed as capability-conditional per F16, not permanent |
| F3 | PARTIAL (name-equality flagged as F23) | **PARTIAL** | Hosting-function-scoped principle retained; name-equality sub-rule now marked POLICY CHOICE PENDING FOUNDER REVIEW (F23) |
| F4 | PARTIAL ("marker" pre-supposed representation) | **PASS at documentation layer** | F20 replaced "marker" throughout §12/§22; Sub-decision B remains open |
| F5 | PARTIAL | **PARTIAL** | Corrected under F1-C; F16 shows the correction is operationally vacuous until Sub-decision D |
| F6 | PARTIAL (5 vs 6 count) | **PASS** | F18 reconciliation applied; F27 elevated risk callout applied |
| F7 | PASS | **PASS** | Priority rule stated in §4.4 / §4.6 |
| F8 | PASS | **PASS** | Layer-qualified labels retained |
| F9 | PASS | **PASS** | Both counts explicitly excluded |
| F10 | PARTIAL (precedence flagged as F21) | **PARTIAL** | Aggregation rule corrected; F21 precedence question now explicit and pending |
| F11 | PARTIAL | **PASS at documentation layer** | F29 dependency disclosure added |
| F12 | PARTIAL | **PARTIAL** | Definition uses only current-architecture signals; full definition requires Sub-decision E |
| F13 | PARTIAL | **PARTIAL** | Observational vacuity acknowledged in §14.4 + F16 chain in §6.3 |
| F14 | PARTIAL (self-audit weakness) | **PASS at documentation layer** | §22 strengthened with 17 checks + capability-conditional markings + category legend (F25) |
| F15 | PASS | **PASS** | §14.4 discloses collapse honestly |

**Aggregate: 3 promoted to PASS · 7 remain PARTIAL (all with explicit dependencies · none silently ignored) · 1 improved · 4 unchanged PASS.**

### Founder decisions applied (recorded verbatim in §2)

- F1 = C · SEPARATE RETRIEVAL ATTEMPT FROM RETRIEVAL CONTRIBUTION
- F2 = B · PRIOR FAILURE GUIDES, NEVER BLOCKS
- F4 = C · SEPARATE CONTRADICTION PATH
- F6 = C · CONSTITUTIONAL GLOBAL, OPERATIONALLY PHASED
- F10 = B · CONSERVATIVE INDETERMINATE

### Frozen decisions preserved

- R10 = UNCHANGED
- R11 = UNCHANGED
- R10-C-1 = UNCHANGED
- R10-C-2 = UNCHANGED
- R10-C-3 = UNCHANGED
- R10-C-4 = UNCHANGED

### Dependency integrity (A-E individually)

| Sub-decision | Preserved · Clarified · Partially Drifted · Silently Resolved | Detail |
|---|---|---|
| **A** · F1-C representation | **PRESERVED** | §4.1 semantic entailment (`MATCH implies retrieval_returned_usable_candidate == true`) is a semantic constraint; representation deferred; §18 status unchanged |
| **B** · F4-C contradiction | **PRESERVED (drift corrected)** | F20 corrected the "marker" drift; representation-neutral language now used; §12.4 four options preserved open |
| **C** · F6-C pathway coverage | **PRESERVED** | §9.3 lists pathways without priority ordering; §18 status unchanged |
| **D** · F10-B safety-relevant | **PRESERVED** | §6.1 marks all dimensions; F21 precedence question surfaced but not resolved |
| **E** · discovery_source | **PRESERVED** | §13.1 · §7.5 · §14.2 mark as future capability; Schema V1 amendment deferred |

**All five sub-decisions preserved cleanly. Sub-decision B's drift (F20) corrected. Sub-decision D's precedence question (F21) surfaced explicitly. No silent resolution.**

### Side effects

- Source code: **NONE**
- Schema V1: **NONE**
- Runtime traffic: **NONE**
- Tests executed: **NONE**
- Baseline rerun: **NONE**
- Fix 24: **NOT IMPLEMENTED**
- Autonomous execution: **NOT AUTHORIZED**

### Remaining issues (explicitly listed · not hidden)

- Sub-decision A · F1-C representation mechanism · `FOUNDER DEFINITION REQUIRED`
- Sub-decision B · F4-C contradiction-path representation · `FOUNDER DEFINITION REQUIRED`
- Sub-decision C · F6-C pathway coverage priority · `FOUNDER DEFINITION REQUIRED`
- Sub-decision D · F10-B safety-relevant dimension definition · `FOUNDER DEFINITION REQUIRED`
- Sub-decision E · discovery_source field · Schema V1 amendment · `FOUNDER DEFINITION REQUIRED`
- **NEW F21 · F10-B precedence** (MATERIALLY_DIFFERENT vs INDETERMINATE precedence when non-safety-relevant dimension reports "different" while safety-relevant is unimplemented) · `FOUNDER DEFINITION REQUIRED`
- **NEW F23 · hosting_function identity criterion** (strict name-equality vs structural equivalence vs stable-ID) · `FOUNDER DEFINITION REQUIRED`
- **NEW F26 · retrieval subsystem failure state** (add seventh state vs map to existing state) · `FOUNDER / ARCHITECTURE DEFINITION REQUIRED`
- **Separate Fix 17 audit target** · Fix 17 writer's D1/D2/D4 → E2 derivation rule may be under-specified (F29 · load-bearing but out of Q8 V2 scope)
- **Operational vacuity of F1-C degrade** · F16 · dormant until Sub-decision D lands
- **Anti-circularity enforcement** · F28 · not implemented; CASE H currently unfalsifiable
- **Five-pathway operational coverage gap** · F27 · constitutional rule global · operational enforcement absent

### Status

**`Q8_V2_V4_DOCUMENTATION_CORRECTION_COMPLETE · PENDING_FORENSIC_REVIEW`**

The v4 correction addresses Forensic Review #4 findings F31 · F32 · F34 · F39 · F41. Specifically:

- F31 removed the silent Reading 1 default that v3 imposed for F21 F10-B precedence
- F32 removed the silent Option (i) default that v3 imposed for F23 hosting-function identity
- F34 narrowed §12.1 F4-C contradiction scope to fresh-vs-retrieved only (aligned with the founder-authorised F4-C scope)
- F39 corrected §16 falsifiability wording to distinguish current vs conditional/future falsifiability
- F41 removed the redundant F17 clause from §4.1 MATCH cause

**No new founder decisions were made in v4.** Existing unresolved founder questions (F21 · F23 · F26 · Sub-decisions A-E) remain unresolved AND now carry no runtime default. Any Q8 V2 v2 implementation of the affected sections requires founder resolution first.

**STOP.** No forensic review #5 in this task. No implementation. No testing. No runtime execution. No baseline rerun. No Fix 24. No autonomous execution.

**Next stage:** separately-authorised Forensic Review #5 of this v4-corrected doctrine, AND separately-authorised founder decisions on F21 · F23 · F26 (plus Sub-decisions A-E the founder chooses to resolve).
