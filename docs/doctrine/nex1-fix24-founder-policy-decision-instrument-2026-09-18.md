# NEX1 · Fix 24 · Founder Policy + Experience Model Decision Instrument

**Date drafted:** 2026-09-18
**Instrument authored by:** master_ai_engineer (Claude Opus 4.7)
**Purpose:** force the five load-bearing decisions required before Fix 24 (first cumulative learning loop) can be sensibly scoped, authored, and independently verified.
**Precedent:** matches the discipline of Q7 Ranking Policy V1 (19 decisions) and Q8 Selection Policy V1 (19 decisions), both founder-approved 2026-09-17.
**Status (updated 2026-09-18):** `DECISIONS_1-4_RECORDED · DECISIONS_4Y_AND_5_PENDING` — implementation still blocked; see §0.5 for full record.

---

## §0.5 · FOUNDER DECISIONS RECORDED · 2026-09-18 · UPDATED AFTER FINAL SYNCHRONISATION

The founder has issued authoritative selections on Decisions 1, 2, 2X, 3, 4, 4X, 5. Decision 4Y is recorded as a **CLARIFICATION DERIVED FROM 4A** (not a new founder decision · see §0.5.1). Decisions 5X and 5Y remain `PENDING` (not addressed by founder authorization; default to §8 recommendation if founder stays silent).

### Recorded selections

| # | Decision | Founder selection | Notes |
|---|---|---|---|
| 1 | Experience scope | **1B — PROBLEM + SOLUTION + VERIFICATION** | Matches Claude's recommendation |
| 2 | Problem information | **2B — STANDARD** | Matches Claude's recommendation |
| 2X | Privacy scope | **2X-b — structured/problem-derived representations; do not persist raw user prose when structural representation suffices** | Founder added: "Existing NEX requirements concerning preservation of user wording are separate and must not be overridden by this decision." |
| 3 | Retrieved evidence in Q8 | **3C — NEW TYPED EVIDENCE CLASSES** (`RETRIEVED_PRIOR_SUCCESS` / `RETRIEVED_PRIOR_FAILURE` / `RETRIEVED_SUPERFICIAL_MATCH`) | Matches Claude's recommendation. Founder added: "RETRIEVED EXPERIENCE IS EVIDENCE, NOT AUTHORITY. Exact Q8 V2 selection rules will be drafted and approved separately before implementation." |
| 3X | Q8 V2 authorship | **DEFAULT: 3X-b — V2 as V1 + additive changes documented separately; existing V1 rules unchanged** | Founder did not override; §8 default applies |
| 4 | SELECTED → EXECUTED autonomously | **4A — NEVER FOR FIX 24** | **OVERRIDES Claude's prior 4D recommendation.** Founder decision is explicit and load-bearing (see §0.6 below) |
| 4X | Initial pattern-family whitelist | **NOT APPLICABLE — no autonomous execution whitelist introduced by Fix 24** | Follows from 4A |
| 4Y | Precondition trip-wire | **CLARIFICATION DERIVED FROM DECISION 4A · NOT A NEW FOUNDER DECISION** — recorded 2026-09-18: *"Any attempt to cross the execution/authorization boundary must be rejected or escalated rather than executed or silently authorized."* | Under 4A NEVER, no autonomous execution path exists; consequently no trip-wire authorises execution — every attempt must be rejected or escalated. See §0.5.1 below. |
| 5 | Outcome-learning evidence | **5B — CONSERVATIVE VERIFIED LEARNING OUTCOME** · recorded 2026-09-18 | Governing interpretation: *"A retrieved experience may contribute evidence, but future learning/trust changes must depend on conservative verification of the resulting outcome."* An outcome counts as SUCCESS only when ALL of: `verify_exit_code == 0`, `preservation_status == "clean"`, all sibling tests green, no Fix 23c auto-revert fired. |
| 5X | Migration path | **PENDING** (not addressed by founder authorization; defaults to §8 recommendation if founder is silent) | |
| 5Y | Demotion path | **PENDING** (not addressed by founder authorization; defaults to §8 recommendation if founder is silent) | |

### §0.5.1 · Decision 4Y clarification · derived from 4A NEVER (recorded 2026-09-18)

Founder-recorded 2026-09-18 as a clarification, **NOT** as a new decision:

> **"Any attempt to cross the execution/authorization boundary must be rejected or escalated rather than executed or silently authorized."**

Classification: **CLARIFICATION DERIVED FROM DECISION 4A — NOT A NEW FOUNDER DECISION**.

The clarification does not grant any execution authority. Under Decision 4A NEVER, autonomous execution remains outside Fix 24 scope entirely; the clarification only makes explicit the required response when a system component (a retrieved experience, a Q8 V2 rule outcome, a candidate evaluation, or any future addition) appears to reach for the execution boundary: **reject or escalate; never execute; never silently authorize**.

### §0.6 · Load-bearing consequences of Decision 4A · NEVER

Decision 4A is doctrinally strict. It preserves V1 §17's invariant verbatim:

- `SELECTED ≠ MODIFIED`
- `SELECTED ≠ EXECUTED`
- `SELECTED ≠ VERIFIED`
- `SELECTED ≠ AUTHORIZED`

**Fix 24 must NOT introduce:**
- The `EXECUTABLE_SELECTED` state (previously proposed by Claude under 4D — now rejected)
- Any autonomous execution whitelist (previously proposed as 4X-a — now not applicable)
- Any automatic `SELECTED → EXECUTED` transition path (previously proposed 6 preconditions — now moot)
- Any reinterpretation of `RETRIEVED_PRIOR_SUCCESS` as execution authorization (explicitly forbidden by founder)
- Any cold-start-then-unlock-auto-execute pattern (previously proposed with N=10 threshold — now not applicable)

**Fix 24 IS still scoped to:**
- Persistence of the experience per Schema V1 (Decision 1B)
- Retrieval of prior experiences via composite key + Fix 23b tracer equivalence (Decision 2B)
- Injection of retrieved evidence into Q8 with the three typed classes (Decision 3C)
- Q8 V2 as an additive extension to V1 (Decision 3X default)
- Outcome-ledger recording (subject to Decision 5)
- Retrieval-safety-gate that emits `REJECT` on tracer refusal (Test C anti-false-green guard, preserved)

Under 4A, retrieval provides **evidence to inform Q8's selection** — but every application of a retrieved solution still requires the existing pre-Fix-24 authorization pathway (human/founder in the loop for CHANGE), exactly as coding tasks work today.

### §0.7 · Impact on the (subsequently-drafted) Freeze document

**Load-bearing honest surfacing:** the freeze document at `docs/doctrine/nex1-experience-schema-v1-and-q8-v2-doctrine-freeze-2026-09-18.md` was drafted subsequent to this instrument's original version, and it embedded Claude's prior 4D recommendation. Decision 4A now supersedes that. The freeze document contains material that is now stale:

- §2.2/A2.8 · `EXECUTABLE_SELECTED` state — must be REMOVED (4A rejects)
- §2.2/A2.10 · trust_status → `TRUSTED` unlocking auto-execute — must be REDEFINED (trust_status becomes REPORTING metadata only, never an execution gate)
- §2.3/F2.2 · pattern-family whitelist — must be REMOVED (4A rejects)
- §2.5 · Cold-start `EXECUTABLE_SELECTED` gate — must be REMOVED (state no longer exists)
- Field E6 · `trust_status` values include `TRUSTED` — this value now purely informational, not an execution gate
- §8 preamble framing survives (`Fix 24 preserves understanding, does not create it`) — still correct, still load-bearing

**Do not modify the freeze document in this task.** Per this task's rules ("Do not modify schemas / Do not create Q8 V2 yet"), the freeze document is untouched here. It will need to be reissued as `V1.1` under the amendment path once Decisions 4Y and 5 are also settled. Surfacing this to the founder for a follow-up authorization.

### §0.8 · What is still needed before Fix 24 build

Before implementation begins:

1. Decision 4Y completion (founder's truncated sentence must be finished)
2. Decision 5 selection (and 5X, 5Y sub-decisions)
3. Reissuance of the freeze document as V1.1 reflecting §0.6 corrections
4. Separate drafting of Q8 V2 selection-rules document under Q7/Q8-V1-style 19-decision discipline (founder explicitly reserved this: *"Exact Q8 V2 selection rules will be drafted and approved separately before implementation"*)
5. Then, and only then, Fix 24 Phase A pre-build audit under standard Fix arc discipline

---

**Prior evidence (already established):**
- 7 archaeology + sufficiency + representation reports (2026-09-18)
- Confirmed: current `InvestigationConclusionEntry` schema is insufficient (§2 of representation audit)
- Confirmed: ~80% of required fields already flow through runtime packet
- Confirmed: Fix 23b tracer IS the semantic equivalence engine
- Confirmed: Q8 doctrinal invariant `SELECTED ≠ EXECUTED` is founder-approved and load-bearing

---

## §0 · WHY THIS INSTRUMENT EXISTS · WHY NOW

Fix 24 must not enter implementation without founder answers to five specific questions. Each answer changes ~50-200 LOC of the resulting build AND at least one architectural boundary.

**If any of these five are left ambiguous, Claude will guess.** Guessing produced the ~500 LOC estimate that the sufficiency report falsified. This instrument prevents the same failure mode for Fix 24.

**The five decisions:**

1. What exactly is an NEX1 "experience"? (schema scope)
2. What problem information must be permanently remembered? (persistence scope)
3. Can retrieved experience influence Q8? (evidence-class + policy scope)
4. Can NEX1 ever move from SELECTED → EXECUTED automatically? (doctrinal boundary — most sensitive)
5. What evidence is required before NEX1 is allowed to learn from an outcome? (outcome-ledger discipline)

Each decision is presented with:
- Precise phrasing
- 2-4 concrete options with named consequences
- Trade-off honestly stated
- A recommendation with rationale (which the founder may reject)
- A signature line for the founder's choice

---

## §1 · DECISION 1 · WHAT IS AN NEX1 "EXPERIENCE"?

**The question:** what does the persistent record of a completed problem-solving cycle actually contain?

### Options

**Option 1A · SOLUTION-ONLY** (current Fix 17 state, unchanged)
- Persist only Q8 selection state + candidate IDs + evidence IDs + provenance
- Retrieval will only ever be by `entry_id`, `source_file`, or `selection_state`
- **Consequence:** no retrieval-by-problem-similarity possible. Fix 24 as designed is architecturally infeasible.
- **Cost:** 0 LOC
- **What Fix 24 becomes:** REPORTING-only extension, not a learning loop

**Option 1B · PROBLEM + SOLUTION + VERIFICATION** (recommended · §4 of representation audit)
- Persist: problem-side (intent + domain_tokens + target_file + function_signature + expected_semantic_change) + solution-side (operator_kind + tracer input/output + change details) + verification-side (exit_code + preservation_status + sibling_tests) + decision-side (Q8 outcome + provenance_kind)
- ~30 fields total, ~80% already flowing through runtime packet
- **Consequence:** retrieval-by-similarity works. Test A/B/C tractable. Cross-loop bridge to coding pipeline required (Hidden Gap 2).
- **Cost:** ~50-100 LOC of writer schema extension in Fix 17 + ~100 LOC of coding-outcome bridge

**Option 1C · FULL PACKET SNAPSHOT**
- Persist the entire `InvestigationEvidencePacket` verbatim, plus all downstream stage outputs
- **Consequence:** maximum information retained; storage cost and index complexity balloon; many fields have no retrieval value; brittle across schema versions
- **Cost:** ~200 LOC + ongoing schema-migration overhead
- **Trade-off:** captures everything at the cost of never knowing what matters

### Recommendation

**Option 1B.** It is the smallest schema that satisfies the founder's central question in the representation audit (§8). 1A leaves Fix 24 architecturally infeasible. 1C is defensive over-storage.

### Founder decision

- [ ] Option 1A — SOLUTION-ONLY
- [ ] **Option 1B — PROBLEM + SOLUTION + VERIFICATION** (recommended)
- [ ] Option 1C — FULL PACKET SNAPSHOT
- [ ] Other — specify: ___________

---

## §2 · DECISION 2 · WHAT PROBLEM INFORMATION MUST BE PERMANENTLY REMEMBERED?

**The question:** which specific problem-side fields must survive persistence to make retrieval-by-similarity work?

Assumes Decision 1 = 1B. If 1A chosen, Decision 2 is `NOT_APPLICABLE`.

### Options

**Option 2A · MINIMUM** (retrieval by coarse key only)
- `intent_slug` (from Capability A)
- `domain_tokens` (from Fix 19)
- `target_file` (path)
- `pattern_class` (from J.2 classifier)
- **Consequence:** retrieval filters by intent + domain + file family only. Test B works when intent+file match. Test C often produces false positives because no structural signature is stored.

**Option 2B · STANDARD** (recommended · retrieval by composite structural key)
- 2A fields + `target_function_name` + `target_function_signature` (params + return type) + `return_expression_ast_shape` (structural hash of AST, not values) + `expected_semantic_change` (from-value, to-value, at-field)
- **Consequence:** retrieval filters at 4 cascading levels of specificity. Test C reliably distinguishes superficial vs semantic match when combined with tracer equivalence check.

**Option 2C · MAXIMUM**
- 2B fields + full source snippet of enclosing function + all sibling test IDs + full call-graph one-hop
- **Consequence:** highest retrieval fidelity; large per-record footprint; some fields require ACTION 6 output that may not always be present.

### Recommendation

**Option 2B.** Enough for cascade retrieval + tracer equivalence check (representation audit §6). 2A blocks Test C reliability; 2C over-stores.

### Founder decision

- [ ] Option 2A — MINIMUM
- [ ] **Option 2B — STANDARD** (recommended)
- [ ] Option 2C — MAXIMUM
- [ ] Other — specify: ___________

**Sub-decision 2X · Personal / privacy scope:**
The user prose (task description) may contain private information. Options:
- [ ] 2X-a — Persist user_prose verbatim (highest information; privacy risk)
- [ ] **2X-b — Persist `intent_slug` + `domain_tokens` + `expected_semantic_change` only; drop verbatim prose** (recommended)
- [ ] 2X-c — Persist a redacted / hashed prose
- [ ] Other: ___________

---

## §3 · DECISION 3 · CAN RETRIEVED EXPERIENCE INFLUENCE Q8?

**The question:** when a retrieved prior experience becomes a candidate in ACTION 11, how does Q8 evaluate it? This decision determines whether retrieval is decorative or load-bearing.

### Options

**Option 3A · RETRIEVAL IS REPORTING-ONLY**
- Retrieved experiences are surfaced in the packet as informational fields but do NOT enter ACTION 11's candidate list
- Q8 policy V1 remains unchanged
- **Consequence:** retrieval provides visibility only. Test B cannot succeed — retrieval cannot influence the next investigation. Fix 24 becomes a REPORTING extension, not a learning loop.

**Option 3B · RETRIEVAL CLASSIFIED AS INSUFFICIENT (never SUPPORTING)**
- Retrieved candidates enter ACTION 11 but Fix 13 evaluator forces evidence class to `INSUFFICIENT` regardless of tracer equivalence
- **Consequence:** retrieval flags candidates but cannot advocate for them. Fresh candidate must independently win. Safe but Test B rarely benefits (no acceleration signal).

**Option 3C · RETRIEVAL WITH NEW TYPED EVIDENCE CLASSES** (recommended · §7 of representation audit)
- Extend Fix 13 evidence enum with three new classes:
  - `RETRIEVED_PRIOR_SUCCESS` — tracer-equivalence verified; prior identical fix succeeded
  - `RETRIEVED_PRIOR_FAILURE` — prior attempt at this shape failed verification
  - `RETRIEVED_SUPERFICIAL_MATCH` — surface hash matched but tracer refused / different target
- Q8 V2 policy rules:
  - `RETRIEVED_PRIOR_SUCCESS` counts as evidence for SELECTED
  - `RETRIEVED_PRIOR_FAILURE` counts as CONTRADICTING (blocking)
  - `RETRIEVED_SUPERFICIAL_MATCH` counts as INSUFFICIENT (does not select)
- **Consequence:** Test B benefits (retrieval accelerates), Test C safe (superficial match cannot win), full loop closes.

**Option 3D · RETRIEVAL WITH FIXED CONFIDENCE WEIGHT**
- Retrieved candidates enter as `STRUCTURALLY_SUPPORTING` with a fixed confidence multiplier
- Q8 confidence is currently locked to INFORMATIONAL-ONLY (V1 §4)
- **Consequence:** requires broader Q8 amendment (making confidence read-side load-bearing); introduces continuous weighting NEX1 has otherwise deliberately avoided

### Recommendation

**Option 3C.** Preserves Q8's honest-uncertainty vocabulary (still 6 primary selection states); adds 3 typed evidence classes that carry retrieval provenance without collapsing it into structural classes; keeps confidence as INFORMATIONAL-ONLY per V1 §4 Decision.

### Founder decision

- [ ] Option 3A — REPORTING-ONLY
- [ ] Option 3B — INSUFFICIENT-ONLY
- [ ] **Option 3C — NEW TYPED EVIDENCE CLASSES** (recommended)
- [ ] Option 3D — FIXED CONFIDENCE WEIGHT
- [ ] Other — specify: ___________

**Sub-decision 3X · Q8 V2 authorship:**
If 3C is chosen, Q8 policy V1 becomes V2. Version bump requires:
- [ ] 3X-a — Full V2 rewrite with founder review of every rule (like V1)
- [ ] **3X-b — V2 as V1 + additive changes documented separately; existing V1 rules unchanged** (recommended)
- [ ] Other: ___________

---

## §4 · DECISION 4 · CAN NEX1 EVER MOVE FROM SELECTED → EXECUTED AUTOMATICALLY?

**This is the single most doctrinally-sensitive decision.**

Q8 Policy V1 §17 (founder-approved 2026-09-17) locked: *"SELECTED ≠ MODIFIED · SELECTED ≠ EXECUTED · SELECTED ≠ VERIFIED · SELECTED ≠ AUTHORIZED."*

This boundary exists to prevent NEX1 from acting on incomplete evidence. Fix 24's cumulative learning loop, if closed end-to-end, will produce SELECTED outcomes for retrieved-and-verified patterns. The question is whether ANY of those may proceed to CHANGE + EXECUTE without founder-in-the-loop authorization.

### Options

**Option 4A · NEVER — V1 INVARIANT UNCHANGED**
- SELECTED remains categorically distinct from EXECUTED
- Every CHANGE requires either (a) coding-pipeline's own separate authorization path (as today for direct coding tasks) or (b) an explicit founder envelope
- **Consequence:** Fix 24 produces SELECTED, humans still gate execution. Autonomy is bounded to REPORTING + accelerated hypothesis generation.
- **Test B/C impact:** Test B produces a retrieval-informed candidate that a human reviews before EXECUTE. Test C's rejection remains a Q8 outcome, not an execution refusal.

**Option 4B · RESTRICTED AUTO-EXECUTE WITHIN BOUNDED PATTERN FAMILY** (recommended for first closure)
- SELECTED may proceed to EXECUTED autonomously **iff ALL of the following hold:**
  1. `pattern_class` is on the explicitly-authorized family list (initial: `replace_return_literal` only)
  2. Q8 evidence class includes at least one `RETRIEVED_PRIOR_SUCCESS` for identical structural shape (Decision 3 = 3C)
  3. Fix 23b tracer-equivalence check returned MATCH (not AMBIGUOUS, not REJECT)
  4. All sibling tests currently green (preservation-check pre-condition)
  5. `retrieval_source_experience` has outcome-ledger record with reuse_success_count ≥ 3 and reuse_reject_count = 0 for identical structural shape
  6. Change is preservation-check-gated and auto-reverted on any invariant violation
- **Consequence:** small class of "safe" reuses become autonomous. Everything else falls back to 4A.
- **Trade-off:** grants NEX1 a narrow autonomy zone with 6 named preconditions. First real autonomous loop.

**Option 4B** · **[SUPERSEDED BY FOUNDER DECISION 4A — NEVER FOR FIX 24]** · Historical text (RESTRICTED AUTO-EXECUTE with 6 preconditions) preserved above for archaeological record. Not selectable.

**Option 4C** · **[SUPERSEDED BY FOUNDER DECISION 4A — NEVER FOR FIX 24]**
- Historical text (FOUNDER-SIGNED SESSION AUTHORIZATION granting auto-execute within a session) preserved for archaeological record. Not selectable.
- ~~Founder signs a session-level envelope authorizing NEX1 to auto-execute within specified pattern families for the duration of the session~~
- ~~Consequence: batch-level control; not truly autonomous formation but useful for interactive coding~~
- ~~Trade-off: better than manual per-fix authorization; still requires founder presence~~

**Option 4D** · **[SUPERSEDED BY FOUNDER DECISION 4A — NEVER FOR FIX 24]**
- Historical text (ADD NEW Q8 STATE `EXECUTABLE_SELECTED`) preserved for archaeological record. Not selectable. The `EXECUTABLE_SELECTED` state is explicitly forbidden by Decision 4A and by Freeze §2.3 F2.11-F2.12.
- ~~Extend Q8 vocabulary from 6 states to 7: `SELECTED` (evidence-sufficient) vs `EXECUTABLE_SELECTED` (safe-to-execute, satisfies 4B's 6 preconditions)~~
- ~~Only `EXECUTABLE_SELECTED` may proceed to CHANGE autonomously~~
- ~~Consequence: cleanest doctrinal expression~~
- ~~Trade-off: vocabulary complexity; requires Q8 V2 anyway~~

### Recommendation · **[SUPERSEDED BY FOUNDER DECISION 4A — NEVER FOR FIX 24]**

Historical recommendation (Option 4D combined with 4B's preconditions) preserved as archaeology. **The founder overrode this recommendation on 2026-09-18 and selected Option 4A — NEVER.** Do not treat the historical recommendation as active policy.

### Founder decision · RECORDED 2026-09-18

- [x] **Option 4A — NEVER (V1 invariant unchanged)** · **SELECTED · LOAD-BEARING**
- [ ] ~~Option 4B — RESTRICTED AUTO-EXECUTE~~ · [SUPERSEDED BY 4A]
- [ ] ~~Option 4C — SESSION-SIGNED AUTHORIZATION~~ · [SUPERSEDED BY 4A]
- [ ] ~~Option 4D — NEW `EXECUTABLE_SELECTED` STATE + 4B PRECONDITIONS~~ · [SUPERSEDED BY 4A · Claude's prior recommendation overridden]

**Sub-decision 4X · initial pattern-family whitelist:**
Regardless of 4A-D, if any autonomy is authorized, the initial whitelist should be:
- [ ] 4X-a — `replace_return_literal` ONLY (recommended for first closure)
- [ ] 4X-b — `replace_return_literal` + `add_null_check` (broader)
- [ ] 4X-c — All J.2 pattern families
- [ ] Other: ___________

**Sub-decision 4Y · precondition trip-wire:**
- [ ] 4Y-a — If any of 4B's 6 preconditions fails during a live task, silently fall back to SELECTED (no notification)
- [ ] **4Y-b — Fall back to SELECTED AND emit a `precondition_failure` record to the outcome-ledger for founder review** (recommended)
- [ ] Other: ___________

---

## §5 · DECISION 5 · WHAT EVIDENCE IS REQUIRED BEFORE NEX1 IS ALLOWED TO LEARN FROM AN OUTCOME?

**The question:** what counts as "the experience worked" or "the experience failed" for the outcome-ledger?

If this is under-specified, the ledger becomes noisy and retrieval quality degrades over time. If it is over-specified, the ledger is empty and Fix 24 produces no cumulative signal.

### Options

**Option 5A · PERMISSIVE — every verified outcome counts**
- Any outcome where `exit_code == 0` counts as SUCCESS
- **Consequence:** ledger fills quickly. But an outcome that passes vitest but violates a preservation invariant would count as SUCCESS. Test C could be masked.
- **Risk:** false-green accumulation

**Option 5B · CONSERVATIVE (recommended initial)** — full verification suite
- Outcome counts as SUCCESS iff ALL:
  - `exit_code == 0`
  - `preservation_status == "clean"`
  - All sibling tests green (not just target test)
  - No Fix 23c auto-revert fired
- Outcome counts as FAILURE iff any of the above fails
- **Consequence:** ledger grows slower but every entry is trustworthy.

**Option 5C · DEFENSIVE — trust threshold** · **[PARTIALLY SUPERSEDED BY FOUNDER DECISION 4A — NEVER FOR FIX 24]**
- Historical text preserved. Under 4A the reference to "auto-execute path" is void because no such path exists.
- ~~5B's rules + `experience.reuse_success_count >= N` before the experience is marked TRUSTED (usable for Decision 4B's auto-execute path)~~
- ~~N could be 3 (aggressive), 5 (moderate), 10 (conservative)~~
- ~~Consequence: first N reuses of a fresh experience run through the human-gated path; only after crossing threshold does auto-execute become available for that specific experience.~~
- ~~Trade-off: requires cold-start period; safer.~~
- **Under Decision 5B + 4A NEVER:** the trust-threshold concept, if retained at all, applies to EVIDENCE MATURITY classification only, never to execution authority. Freeze §2.5 C.1-C.3 governs. Under founder-selected 5B (not 5C), no migration threshold is currently authorised.

**Option 5D · FULLY-SUPERVISED**
- 5B rules + explicit founder ACCEPT/REJECT signal per outcome before ledger update
- **Consequence:** no autonomy in learning-from-outcome; founder-in-the-loop for every ledger delta
- **Trade-off:** highest safety; slowest accumulation; not "cumulative formation" in any meaningful autonomous sense

### Recommendation · **[SUPERSEDED BY FOUNDER DECISION 5B — CONSERVATIVE]**

Historical text (5B initially → migrate to 5C after 10 experiences) preserved as archaeology. **The founder selected Option 5B on 2026-09-18 and did NOT authorise migration to 5C.** Under 4A NEVER, the migration rationale ("auto-execute unlock after threshold") is moot regardless. `EXECUTABLE_SELECTED` state does not exist.

### Founder decision · RECORDED 2026-09-18

- [ ] Option 5A — PERMISSIVE
- [x] **Option 5B — CONSERVATIVE** · **SELECTED · LOAD-BEARING**
- [ ] ~~Option 5C — DEFENSIVE (5B + trust threshold)~~ · [NOT SELECTED · migration to 5C not authorised]
- [ ] Option 5D — FULLY-SUPERVISED

**Sub-decision 5X · migration path:**
- [ ] 5X-a — Stay at 5B indefinitely
- [ ] **5X-b — 5B for first 10 experiences, migrate to 5C(N=3) automatically** (recommended)
- [ ] 5X-c — 5B for first 10, migrate only after founder review at each threshold
- [ ] Other: ___________

**Sub-decision 5Y · demotion path:**
If a previously-TRUSTED experience produces a FAILURE outcome (retrieved, applied, verification failed), what happens?
- [ ] 5Y-a — Mark experience as UNTRUSTED immediately (1 failure → demote)
- [ ] **5Y-b — Decrement trust: reuse_success_count reduced by K on each failure; UNTRUSTED when count drops below threshold** (recommended, K=2)
- [ ] 5Y-c — Warn but do not demote (rely on Q8 policy to weight down)
- [ ] Other — specify K: ___________

---

## §6 · CROSS-DECISION CONSISTENCY CHECK

Certain combinations are inconsistent or under-specified. Ranked constraints:

| If Decision 1 = | Then Decision 2 must be | And Decision 3 must be |
|---|---|---|
| 1A (SOLUTION-ONLY) | N/A | 3A (retrieval infeasible) |
| 1B (STANDARD) | 2A / 2B / 2C | 3B / 3C |
| 1C (FULL PACKET) | N/A (over-persists) | 3C (recommended) |

| If Decision 4 = | Then Decision 3 must be | And Decision 5 must include |
|---|---|---|
| **4A (NEVER)** · **SELECTED** | any (3C selected) | any (5B selected) |
| ~~4B or 4D (auto-execute)~~ · [SUPERSEDED BY 4A] | ~~must be 3C~~ | ~~5C or 5D~~ |
| ~~4C (session-signed)~~ · [SUPERSEDED BY 4A] | ~~3B / 3C~~ | ~~5B or 5C~~ |

**Historical founder-warning language preserved for archaeology · under 4A the auto-execute warnings are void:**
- ~~Choosing 4B/4D with 5A permits auto-execute driven by unverified outcomes. Not recommended.~~
- ~~Choosing 1A with any Decision 4 other than 4A produces `INCOHERENT_POLICY`.~~

**[SUPERSEDED · under 4A no auto-execute path exists, so these warnings are moot]**

---

## §7 · IMPLEMENTATION SCOPE AS A FUNCTION OF DECISIONS

Post-decision, Fix 24's scope is deterministic:

| Decisions | Fix 24 modules | LOC estimate |
|---|---|---|
| 1A only (all others N/A) | 0 (Fix 24 not built) | 0 |
| 1B + 2B + 3A + 4A + 5B | 3 (schema + retriever + reporting) | ~350 |
| **1B + 2B + 3C + 4A + 5B** · **FOUNDER-SELECTED · 2026-09-18** | 5 (schema + retriever + evidence-class + Q8 V2 evidence-only rules + outcome-ledger) | ~550 |
| ~~1B + 2B + 3C + 4D + 5B→5C~~ · **[SUPERSEDED BY 4A · Claude's prior full-recommendation rejected]** | ~~7 (previous + EXECUTABLE_SELECTED + safety-gate)~~ | ~~~680~~ |
| ~~1C or 2C or 3D or 4C~~ · [SUPERSEDED BY 4A/2B/3C/1B founder selections] | ~~+100-200 LOC~~ | ~~750-900~~ |

**Effective founder-selected scope: `1B + 2B + 3C + 4A + 5B` · ~550 LOC across 5 modules · Q8 V2 evidence-only rules (no autonomous execution) · outcome-ledger for evidence-maturity classification only.**

**None of these totals require external LLM at runtime.** All follow Fix arc discipline.

---

## §8 · APPROVAL BLOCK

By signing below, the founder authorises Fix 24 to be authored against the above decisions.

Absent decisions default to the recommended options unless the founder writes otherwise below.

### Decisions record

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Experience scope | ______ | |
| 2 | Problem info | ______ | |
| 2X | Privacy scope | ______ | |
| 3 | Retrieved evidence in Q8 | ______ | |
| 3X | Q8 V2 authorship | ______ | |
| 4 | SELECTED → EXECUTED | ______ | |
| 4X | Initial whitelist | ______ | |
| 4Y | Precondition trip-wire | ______ | |
| 5 | Outcome evidence | ______ | |
| 5X | Migration | ______ | |
| 5Y | Demotion | ______ | |

### Approval

- **Founder signature:** __________________________
- **Date:** __________________________
- **Q8 V2 policy version:** __________________________ (to be assigned on approval)
- **Fix 24 target LOC (derived from choices above):** __________________________
- **Fix 24 authorization to proceed:** [ ] YES  [ ] NO  [ ] AMENDMENTS REQUIRED (see below)

### Amendments (if required)

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

---

## §9 · WHAT HAPPENS AFTER APPROVAL

Once §8 approval block is signed:

1. Q8 V2 policy document is drafted (if Decision 3 = 3C, mandatory) — separate document, structured like Q8 V1
2. Q8 V2 goes through the same founder-decision instrument discipline as V1 did (19-item decision review)
3. **Only after Q8 V2 is founder-approved** does Fix 24 implementation begin
4. Fix 24 is authored under standard Fix arc discipline: Phase A pre-build audit + Phase B build + Phase C wire + Phase D verifier probe + Phase E regression + Phase F persistence
5. Test A/B/C proof standard from prior boundary report + representation audit applies
6. If any test in A/B/C fails, Fix 24 is not shipped; failure report is authored; back to founder-decision on next steps

**No implementation begins until §8 is signed AND Q8 V2 is separately approved.**

---

## §10 · WHAT THIS INSTRUMENT IS NOT

- It is not a design proposal — the schema and mechanism proposals are established in the prior representation audit (§4-§9 of that document)
- It is not a request for approval of code — no code exists yet
- It is not a research question — the architectural feasibility is established (representation audit §12 verdict)
- It is not a debate — the recommendations are honest defaults; the founder overrides any of them
- It is not exhaustive — every decision has an "Other" option; the founder may specify a choice outside those listed

**It is a mechanism to make five founder decisions explicit before ~600 LOC of code is authored against them.**

---

## §11 · WHY THIS PATTERN IS WORTH REPEATING

This instrument matches the pattern that produced Q7 V1 and Q8 V1 successfully (both founder-approved 2026-09-17):

- Q7 policy V1: 19 decisions, all authored decisions applied verbatim, Fix 15 implementation produced 18/18 verifier cases passing on first blind run.
- Q8 policy V1: 19 decisions, Fix 16 produced 24/24 verifier cases passing on first blind run.

**The record shows: when founder decisions are made ahead of code, the implementation is high-fidelity and high-first-pass-rate.** When decisions are left to Claude's inference, the sufficiency report gets falsified.

Fix 24 has 5 top-level decisions + 7 sub-decisions = 12 total. Smaller than Q7 or Q8 V1. The same discipline should produce an equally high-fidelity implementation.

---

## §12 · FINAL NOTE

**The archaeology arc is complete. The schema audit is complete. This instrument is the bridge from analysis to build.**

Once signed, this document IS the specification. Claude authors Fix 24 against the founder's five answers, no interpretation, no drift.

Every subsequent Claude output referencing Fix 24 must reference this instrument by exact decision number. Any ambiguity must return to this document, not to Claude's judgement.

**When signed, this becomes `NEX1_FIX24_POLICY_V1` — a load-bearing artefact ranked with Q7 V1 and Q8 V1.**

Zero code changes. Zero implementation. Zero further audits until §8 is signed.
