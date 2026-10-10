# NEX1 · Experience Schema V1 + Q8 V2 Doctrine · Freeze Document

**Date drafted:** 2026-09-18
**Instrument authored by:** master_ai_engineer (Claude Opus 4.7)
**Status:** `AWAITING_FOUNDER_FREEZE · CORRECTED_2026-09-18_FOR_DECISION_4A · DECISION_5_RECORDED_AS_5B`
**Precedent:** matches Q7 Ranking Policy V1 (founder-approved 2026-09-17) and Q8 Selection Policy V1 (founder-approved 2026-09-17), each of which was frozen before its Fix (15, 16) was permitted to begin.

**Prior evidence:** seven reports in the 2026-09-18 archaeology arc — do not repeat their content; consume their conclusions.

---

## §0-CORRECTION · APPLIED 2026-09-18 · DECISION 4A + DECISION 5B RECORDED

This document has been corrected to reflect the founder's binding decisions:

- **Decision 4 = 4A — NEVER FOR FIX 24.** Fix 24 introduces no autonomous execution. All `EXECUTABLE_SELECTED` provisions and their scaffolding have been removed.
- **Decision 5 = 5B — CONSERVATIVE.** An outcome counts as SUCCESS only when ALL of: `verify_exit_code == 0`, `preservation_status == "clean"`, all sibling tests green, no Fix 23c auto-revert fired.
- **Trust semantics reframed.** `E6 trust_status` values are **evidence weighting only**. They MUST NOT gate execution.
- **Cold-start reframed.** No cold-start threshold governs execution. Cold-start now governs only evidence-maturity classifications.

The constitutional invariant preserved verbatim from Q8 V1:

> **`SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED`**

Retrieved experience under Q8 V2 is **evidence, not authority**. A retrieved prior success cannot, by itself or through Q8 V2, authorize execution. A superficial match remains insufficient to establish semantic equivalence.

### §0-CORRECTION.1 · 4Y CLARIFICATION · derived from 4A · recorded 2026-09-18

Founder-recorded 2026-09-18 as a **CLARIFICATION DERIVED FROM DECISION 4A · NOT A NEW FOUNDER DECISION**:

> **"Any attempt to cross the execution/authorization boundary must be rejected or escalated rather than executed or silently authorized."**

This clarification does not grant any execution authority. Decision 4A NEVER remains the constitutional statement: autonomous execution is outside Fix 24 scope entirely. The clarification only names the required response whenever any component appears to reach for the execution boundary (a retrieved experience, a Q8 V2 rule outcome, a candidate evaluation, or a future addition): **reject or escalate; never execute; never silently authorize**.

Every subsequent section of this freeze must be read consistent with this correction. Where the previous draft contained execution-gating language, this correction replaces it with evidence-weighting language.

---

---

## §0 · PREAMBLE · WHAT THIS DOCUMENT IS AND IS NOT

This document freezes two things. Once signed, both are load-bearing artefacts and may not be silently amended.

### The two freezes

1. **`NEX1_EXPERIENCE_SCHEMA_V1`** — the exact fields that constitute one NEX1 Experience record.
2. **`NEX1_Q8_V2_DOCTRINE`** — the constitutional limits on what Q8 V2 is legally allowed to do with retrieved prior experience.

### The framing that governs both freezes

**"Fix 24 does not create NEX1's ability to understand the problem. Fix 24 creates persistence of that understanding."**

The prior archaeology arc established that NEX1 already understands problems at runtime — the runtime packet at CHANGE time carries ~80% of the fields a semantically-meaningful experience needs. What is missing is that the understanding evaporates when the packet finishes. Fix 24's mission is to preserve what has already been computed, and to permit a subsequent problem to be informed by that preserved understanding.

**Fix 24 is a persistence + retrieval + evidence-classification project. It is not an understanding project.**

This framing narrows every downstream claim. NEX1 does not become smarter after Fix 24; it becomes less forgetful. The distinction is load-bearing.

### What this document is NOT

- Not an architecture proposal (schema + policy are established in the representation audit)
- Not a code request (no code exists yet)
- Not a re-audit (seven reports precede this)
- Not a discussion — the freezes are stated, not debated
- Not exhaustive of every possible field — deliberately minimum-viable
- Not exhaustive of every possible Q8 V2 rule — deliberately minimum-viable

### What signature achieves

Signing §3 and §5 approval blocks freezes both artefacts. After that:
- Every Fix 24 file must reference the frozen fields by name only, never invent new ones
- Every Q8 V2 policy rule must fit inside the doctrinal boundaries stated here
- Any ambiguity between an implementation choice and this freeze is resolved in favour of this freeze
- Amendment requires a documented `V1.1 → V1.2` or `V2 → V2.1` migration with founder re-signature

---

## §1 · PART I · `NEX1_EXPERIENCE_SCHEMA_V1` · FREEZE

### 1.1 · Scope

The Experience Schema V1 defines exactly what one row in `data/nex1-investigation-conclusions/entries.jsonl` (or its successor store) MUST contain after Fix 24 is authored.

**Applies to:** the `replace_return_literal` pattern family only, per prior representation audit §10 (deliberately bounded).

**Version:** V1. Superseded schemas must migrate under a documented path.

### 1.2 · Field roster · 32 frozen fields in 5 blocks

#### Block A · Identity + Provenance (7 fields · unchanged from Fix 17 pattern)

| # | Field | Type | Purpose |
|---|---|---|---|
| A1 | `experience_id` | string (uuid or hash) | Row identity |
| A2 | `created_at` | ISO-8601 timestamp | Ordering |
| A3 | `investigation_id` | string | Trace back to originating investigation packet |
| A4 | `trace_id` | string | Session-scope trace identity |
| A5 | `provenance_chain_hash` | string | Immutable audit hash, existing NEX1 invariant |
| A6 | `schema_version` | literal `"V1"` | Migration marker |
| A7 | `evidence_kind` | locked literal `"INFERRED"` | Preserves Fix 15/16/17 invariant · never PROVEN |

#### Block B · Problem Representation (9 fields · new to persistence, sourced from runtime packet)

| # | Field | Type | Source at runtime | Purpose |
|---|---|---|---|---|
| B1 | `intent_slug` | string | Capability A output | Coarse retrieval filter |
| B2 | `intent_confidence` | number | Capability A output | Filter weak classifications |
| B3 | `domain_tokens` | string[] (sorted) | Fix 19 merged output | Semantic proximity |
| B4 | `coding_concepts` | string[] (sorted) | Fix 19 merged output | Semantic proximity |
| B5 | `target_file_path` | string | ACTION 2 / ACTION 3 | File-family filter |
| B6 | `target_function_name` | string | ACTION 6 structural_facts | Function-scope match |
| B7 | `target_function_signature` | { paramCount: number, paramTypes: string[], returnType: string } | ACTION 6 | Structural fingerprint |
| B8 | `return_expression_ast_shape_hash` | string | ACTION 6 + hash function | Structural signature (SHAPE only, not values) |
| B9 | `expected_semantic_change` | { from_value: string, to_value: string, at_field: string } | Fix 23b tracer input | Semantic delta |

**Personal / privacy scope note:** the verbatim `user_prose` is **deliberately NOT persisted** to reduce privacy risk. B1-B9 carry the classified representation. If verbatim prose is later required, it must be added under a documented V1.x amendment with explicit founder decision on privacy policy.

#### Block C · Solution Representation (9 fields · new to persistence, sourced from Fix 23b + operator registry)

| # | Field | Type | Source | Purpose |
|---|---|---|---|---|
| C1 | `pattern_class` | string (initial value `"replace_return_literal"`) | J.2 classifier + CHANGE stage | Family label |
| C2 | `pattern_family_version` | string | Fix 24 registry | Schema-migration marker |
| C3 | `operator_kind` | string | CHANGE stage operator output | e.g. `applyReplaceReturnLiteral` |
| C4 | `tracer_input_args` | EvalValue[] | Fix 23b `TracerInput.arg_values` | Reproducibility |
| C5 | `tracer_expected_value` | EvalValue | Fix 23b `TracerInput.expected_field_value` | Verifies fix intent |
| C6 | `literal_current_text` | string | Fix 23b `LiteralCandidate.current_text` | Literal being replaced |
| C7 | `literal_proposed_text` | string | Fix 23b `LiteralCandidate.proposed_text` | Its replacement |
| C8 | `target_line` | number (1-based) | Fix 23b `LiteralCandidate.line` | Precise location |
| C9 | `enclosing_expression` | string | Fix 23b `LiteralCandidate.enclosing_expression` | Semantic context |

#### Block D · Verification Representation (5 fields · new to persistence, sourced from EXECUTE + Fix 23c)

| # | Field | Type | Source | Purpose |
|---|---|---|---|---|
| D1 | `verify_exit_code` | number | EXECUTE stage vitest output | Baseline pass/fail |
| D2 | `preservation_status` | literal `"clean"` \| `"reverted"` | Fix 23c output | Preservation invariant |
| D3 | `reverted_at` | ISO-8601 or null | Fix 23c timestamp | Presence marks negative experience |
| D4 | `sibling_test_ids` | string[] | Preservation-check ran-tests list | Which tests remained green |
| D5 | `runtime_evidence_ids` | string[] | Packet.evidence_ids from EXECUTE | Traceable receipts |

#### Block E · Decision + Outcome-Ledger Fields (7 fields · Q8 V2 integration)

| # | Field | Type | Source | Purpose |
|---|---|---|---|---|
| E1 | `selection_state` | Q8 selection state enum | Fix 16 output | Original Q8 outcome |
| E2 | `outcome_class` | literal `"SUCCESS"` \| `"FAILURE"` \| `"REVERTED_BY_PRESERVATION"` | Derived from D1+D2 | Ledger-ready classification |
| E3 | `reuse_count` | number (starts at 0) | Outcome-ledger updater | Total times this experience was retrieved and applied |
| E4 | `reuse_success_count` | number (starts at 0) | Outcome-ledger updater | Of E3, how many verified clean |
| E5 | `reuse_reject_count` | number (starts at 0) | Retrieval-safety-gate | How many times rejected as SUPERFICIAL_MATCH |
| E6 | `trust_status` | literal `"UNVERIFIED"` \| `"VERIFIED"` \| `"TRUSTED"` \| `"UNTRUSTED"` | Evidence-maturity classification (derived from ledger) | **Evidence weighting only · MUST NOT gate execution (Decision 4A · Q8 V2 §2.3 F2.11)** · used solely to inform Q8's evidence-class rules |
| E7 | `policy_id` | locked literal `"NEX1_Q8_SELECTION_POLICY"` + `policy_version: "V2"` | Fix 16 output | Which Q8 policy authored/reused this |

### 1.3 · What is EXPLICITLY EXCLUDED from Schema V1 (defence-in-depth)

The following are NOT in V1 and MUST NOT be added silently:

- Verbatim user prose (privacy scope · §1.2 note)
- Full source-code snippets of the target function (too large; would be reconstructable from `target_file_path` + git if needed)
- LLM-generated reasoning traces (no LLM in runtime)
- Free-form "notes" fields (unstructured; would become dumping ground)
- Weights / scores / composite confidence numbers (§1.4 · Q8 V1 §2.13 constraint)
- Continuous learning parameters (out of Fix 24 scope)
- Cross-conversation IDs (out of Fix 24 scope)
- Feedback / user-rating fields (out of Fix 24 scope; separate design if ever needed)

Amendment path: any field additions require a documented V1.1 with founder re-signature and explicit rationale.

### 1.4 · Invariants preserved from Q8 V1

These Q8 V1 invariants MUST hold across Schema V1:

- `evidence_kind` locked to `"INFERRED"` (never PROVEN)
- No numerical weights, no composite scores
- No confidence-based ordering
- No filename / candidate-ID / array-order preferences hidden in fields
- All fields are typed, deterministic, and reproducible

### 1.5 · Storage location and format

- **Path:** `data/nex1-investigation-conclusions/entries.jsonl` (existing Fix 17 store; extended, not replaced)
- **Format:** JSONL, append-only, one record per line (existing Fix 17 discipline)
- **Backward compatibility:** Fix 17 V0 records (existing pre-Fix-24 rows) remain readable; retrieval treats missing V1 fields as `INSUFFICIENT_EVIDENCE` state, never as MATCH

---

## §2 · PART II · `NEX1_Q8_V2_DOCTRINE` · FREEZE

### 2.1 · Scope

Q8 V2 doctrine defines the constitutional limits on what Q8 V2 is legally allowed to do with retrieved prior experience.

**Basis:** Q8 V1 (founder-approved 2026-09-17). V2 adds capabilities; V2 must not remove or weaken V1 invariants.

### 2.2 · What Q8 V2 IS ALLOWED to do

**A2.1** · Read `NEX1_EXPERIENCE_SCHEMA_V1` records from `data/nex1-investigation-conclusions/entries.jsonl`.

**A2.2** · Filter records by `pattern_class`, `intent_slug`, `intent_confidence`, `target_function_signature`, and `return_expression_ast_shape_hash`.

**A2.3** · Verify structural equivalence between a retrieved record and a new problem by invoking Fix 23b data-flow tracer against the new problem's source using the retrieved record's `tracer_input_args`, `tracer_expected_value`, `literal_current_text`, and `literal_proposed_text`.

**A2.4** · Emit ONE of six retrieval-state outcomes for each retrieval attempt:
- `MATCH` (structural + semantic verified by tracer)
- `NO_MATCH` (no record meets composite filter)
- `AMBIGUOUS` (multiple records match at hash level; tracer disambiguation refused)
- `INSUFFICIENT_EVIDENCE` (retrieved record lacks required schema fields, e.g. V0 legacy row)
- `REJECT` (tracer detected semantic mismatch — Test C rejection)
- `REQUIRE_MORE_INVESTIGATION` (tracer refused, cannot confirm equivalence)

**A2.5** · Inject retrieved candidates into ACTION 11's `root_cause_candidates[]` **only with an explicit `candidate_source` field** tagged as one of:
- `"fresh_generated"` (default; no retrieval)
- `"retrieved_prior_success"` (retrieval MATCH + prior E2 outcome_class = SUCCESS)
- `"retrieved_prior_failure"` (retrieval MATCH + prior E2 outcome_class = FAILURE/REVERTED_BY_PRESERVATION)
- `"retrieved_superficial_match"` (retrieval REJECT — surface hash matched but tracer refused)

**A2.6** · Classify retrieved evidence at ACTION 12 (hypothesis-evidence-evaluator) using three new evidence classes:
- `RETRIEVED_PRIOR_SUCCESS` (used when `candidate_source == "retrieved_prior_success"`)
- `RETRIEVED_PRIOR_FAILURE` (used when `candidate_source == "retrieved_prior_failure"`)
- `RETRIEVED_SUPERFICIAL_MATCH` (used when `candidate_source == "retrieved_superficial_match"`)

**A2.7** · Rules R-9 / R-10 / R-11 are **DRAFT · PENDING SEPARATE Q8 V2 POLICY APPROVAL**. They are recorded here as the intended evidence semantics under Decisions 3C + 4A + 5B, but the **complete Q8 V2 operational policy will be drafted and approved separately** under the same 19-decision founder-review discipline that produced Q8 V1 (founder-approved 2026-09-17). No Fix 24 code may implement any of R-9 / R-10 / R-11 until that separate Q8 V2 operational policy is founder-approved.

The DRAFT rules below express the intended EVIDENCE WEIGHTING semantics only. None grant execution authority.

- **R-9** · **DRAFT · PENDING Q8 V2 POLICY APPROVAL** · if `RETRIEVED_SUPERFICIAL_MATCH` is present for a candidate, that candidate's `overall_status` is downgraded to `INSUFFICIENT` regardless of other classes
- **R-10** · **DRAFT · PENDING Q8 V2 POLICY APPROVAL** · if `RETRIEVED_PRIOR_FAILURE` is present for a candidate, that candidate's `overall_status` is downgraded to `CONTRADICTED` (blocking)
- **R-11** · **DRAFT · PENDING Q8 V2 POLICY APPROVAL** · `RETRIEVED_PRIOR_SUCCESS` counts as SUPPORTING evidence in the V1 R-4 SUPPORTING_MAJORITY rule, **provided** its `E6 trust_status` is `VERIFIED` or `TRUSTED`. Even when SUPPORTING, this evidence never grants execution authority — SELECTED remains distinct from EXECUTED (V1 §17 preserved).

**Explicit disposition:** the freeze document DEFINES the constitutional boundary (§2.2 A2.1-A2.6, §2.2 A2.8-A2.10) and the PERMITTED EVIDENCE CONCEPTS (three retrieval evidence classes at §2.2 A2.6). It does NOT approve R-9 / R-10 / R-11 as final operational policy. Approval of those specific rules is a separate future artifact.

**A2.8** · [REMOVED · Decision 4A · NEVER FOR FIX 24] · No new selection-state is introduced. Q8 V2 emits only the existing V1 6-state vocabulary (`SELECTED`, `NO_SELECTION`, `TIE`, `INSUFFICIENT_EVIDENCE`, `UNRESOLVED`, `REQUIRE_MORE_INVESTIGATION`). No `EXECUTABLE_SELECTED` state exists. No autonomous-execution path is created.

**A2.9** · Write outcome-ledger updates to the same `entries.jsonl` (append semantics) after every retrieval-informed application, recording per Decision 5B (CONSERVATIVE):
- `reuse_count` increment on every retrieval-driven application
- `reuse_success_count` increment ONLY when ALL hold: `verify_exit_code == 0` AND `preservation_status == "clean"` AND all sibling tests green AND no Fix 23c auto-revert fired
- `reuse_reject_count` increment on every SUPERFICIAL_MATCH rejection

**A2.10** · Compute `E6 trust_status` from the outcome-ledger using deterministic rules. **The result is evidence-maturity metadata only; it does not gate execution.** Values inform R-11 evidence weight and nothing else:
- `UNVERIFIED` — no reuse yet (E3 == 0)
- `VERIFIED` — E4 >= 1 AND (E5 / (E4 + E5)) == 0 (never rejected as superficial)
- `TRUSTED` — E4 >= 3 AND E5 == 0 (evidence maturity marker only)
- `UNTRUSTED` — E4 has decremented below 1 due to §D demotion rules (evidence discipline only)

### 2.3 · What Q8 V2 IS EXPLICITLY FORBIDDEN from doing

**F2.1** · Q8 V2 **MUST NOT** authorize CHANGE stage execution merely from `SELECTED` outcome. The V1 invariant `SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED` is preserved verbatim.

**F2.2** · [SUPERSEDED · Decision 4A · NEVER FOR FIX 24] · Q8 V2 **MUST NEVER** authorize CHANGE stage execution from ANY of its emitted states. No `EXECUTABLE_SELECTED` state exists (see A2.8). No pattern-family whitelist exists. No preconditions grant execution authority. Every CHANGE authorization continues to flow through the pre-Fix-24 pathway exactly as it does today for direct coding tasks (human/founder in the loop for CHANGE, per existing authorization gate). Retrieved evidence informs Q8; Q8 informs subsequent stages; but no Q8 output autonomously triggers CHANGE.

**F2.3** · Q8 V2 **MUST NOT** read or write confidence as a selection-weighting factor. Confidence remains INFORMATIONAL-ONLY per Q8 V1 §4 Decision 11.

**F2.4** · Q8 V2 **MUST NOT** use LLM at runtime. Zero-LLM constraint from V1 §2.13 Decision 10 preserved.

**F2.5** · Q8 V2 **MUST NOT** bypass Fix 23c preservation-check. Auto-revert on preservation violation is unconditional whenever CHANGE stage does execute (via the existing pre-Fix-24 authorization pathway).

**F2.6** · Q8 V2 **MUST NOT** hide provenance. Every `candidate_source` value flows into the selection record and every persisted experience carries its evidence class history.

**F2.7** · Q8 V2 **MUST NOT** invent new evidence classes at runtime. Only the three classes listed in §2.2/A2.6 are permitted. Adding classes requires founder amendment.

**F2.8** · Q8 V2 **MUST NOT** modify Q7 (ranking) policy. Q7 remains AUTHORITATIVE for ordering. V2 adds only to Q8's selection responsibility.

**F2.9** · Q8 V2 **MUST NOT** bridge to any store other than `data/nex1-investigation-conclusions/entries.jsonl` for retrieval. Cross-store queries (Hidden Gap 8 from sufficiency report) are OUT OF SCOPE for Fix 24 and are deferred to a future decision.

**F2.10** · Q8 V2 **MUST NOT** silently apply a retrieved fix. The runtime chain terminates at the existing authorization boundary: retrieval → tracer-equivalence check → Q8 evidence classification → Q8 selection (SELECTED / NO_SELECTION / TIE / INSUFFICIENT_EVIDENCE / UNRESOLVED / REQUIRE_MORE_INVESTIGATION) → **STOP AT EXISTING AUTHORIZATION BOUNDARY**. The subsequent CHANGE stage, if any, follows the same non-autonomous pathway that governs pre-Fix-24 coding tasks.

**F2.11** · [NEW · load-bearing constitutional] · **`TRUST IN EXPERIENCE ≠ AUTHORITY TO EXECUTE`**. A `TRUSTED` `E6 trust_status` is evidence maturity, not execution license. An experience with reuse_success_count=100 and reuse_reject_count=0 is still evidence, still requires the existing authorization pathway to become a CHANGE. The trust ladder governs evidence weight; it never governs execution.

**F2.12** · [NEW] · **No autonomous-execution provision may be reintroduced under any name.** Renames like `AUTHORIZED_SELECTED`, `HIGH_CONFIDENCE_SELECTED`, `PROVEN_SELECTED`, or any equivalent are prohibited under Fix 24. Future founder-approved policy may investigate bounded autonomous execution as a separate work item; Fix 24 does not.

### 2.4 · Trust decay + demotion (locked)

**D.1** · A previously VERIFIED or TRUSTED experience that produces a FAILURE outcome (retrieved, applied, verification failed) decrements `E4 reuse_success_count` by 2.

**D.2** · If `E4` drops below 1, `E6 trust_status` becomes `UNTRUSTED`.

**D.3** · An UNTRUSTED experience continues to be persisted (never deleted) but Q8 V2 R-9-equivalent rule forces its candidate_source classification into `RETRIEVED_PRIOR_FAILURE` on future retrievals until re-verified.

**D.4** · Re-verification path: an UNTRUSTED experience that later produces 3 consecutive SUCCESS outcomes can be restored to VERIFIED. This is deterministic ledger arithmetic, not a founder decision.

### 2.5 · Cold-start behaviour (locked · corrected under Decision 4A)

**C.1** · [CORRECTED under Decision 4A] · There is **no cold-start execution threshold**. Autonomous execution is not part of Fix 24 at any point, so no threshold can gate it. Retrieval, tracer-equivalence check, evidence classification, and Q8 selection all operate immediately from the first persisted experience — but every application of a retrieved solution follows the existing pre-Fix-24 authorization pathway (human/founder in the loop for CHANGE), regardless of experience count.

**C.2** · Cold-start may still apply to **evidence maturity classification** (not execution). While fewer than 3 experiences of a given structural shape exist, retrieval outcomes emit `INSUFFICIENT_EVIDENCE` or `REQUIRE_MORE_INVESTIGATION` rather than injecting a `RETRIEVED_PRIOR_SUCCESS` candidate. This is deterministic ledger arithmetic, not an execution gate.

**C.3** · The 3-experiences-per-shape threshold for evidence-maturity is derivable from Decision 5B trust rules (see §2.4 D-rules and A2.10 trust_status computation). It is not a separate constant and requires no separate founder decision.

---

## §3 · APPROVAL BLOCK · PART I FREEZE · SIGNED 2026-09-18

By signing below, the founder freezes `NEX1_EXPERIENCE_SCHEMA_V1` as defined in §1.

Every Fix 24 file authored subsequent to this signature MUST reference these fields verbatim. No field additions, removals, or renamings are permitted without a documented V1.1 amendment and founder re-signature.

**Founder signature:** **Philip O'Farrell** · authorised via founder message *"NEX1 · FIX 24 · FOUNDER SIGNATURE + Q8 V2 POLICY AUTHORING"* dated 2026-09-18
**Date:** **2026-09-18**
**Approved decisions:** **1B · 2B · 2X · 3C · 4A · 5B** (recorded in §0-CORRECTION and §0.5 of decision instrument)
**Amendment (if any):** **None** · schema §1 is load-bearing as authored
**Status:** `NEX1_EXPERIENCE_SCHEMA_V1 · FOUNDER-APPROVED · LOAD-BEARING`

Absent amendments, the schema in §1 becomes load-bearing on signature. **This section is now load-bearing.**

---

## §4 · WHAT SCHEMA V1 DOES AND DOES NOT PROMISE

**Promises:**
- Every persisted record after Fix 24 contains fields A1-E7 (32 fields).
- Retrieval-by-similarity is architecturally possible against these fields.
- Test C (adversarial near-miss) can be safely constructed against this schema.
- Evidence-maturity classification is enforced deterministically (§2.5 C.2).
- No LLM is required at runtime to write, read, or interpret these records.
- Retrieved experience functions as typed evidence under Q8 V2 — with `TRUST IN EXPERIENCE ≠ AUTHORITY TO EXECUTE` enforced.

**Does not promise:**
- That every retrieval will find a match (may return NO_MATCH honestly).
- That the outcome-ledger will produce meaningful trust weighting immediately (until ≥3 experiences of a shape accumulate, retrieval emits INSUFFICIENT_EVIDENCE).
- That the schema will remain unchanged past V1 — future pattern families will require V1.x extensions.
- That NEX1 becomes "more intelligent" — only that its already-computed understanding is preserved and re-usable as evidence.
- That NEX1 will generalise across pattern families — deliberately bounded to `replace_return_literal` in V1.
- **[NEW under Decision 4A]** That NEX1 gains any autonomous execution authority — Fix 24 introduces none. Every CHANGE continues to require the existing authorization pathway.

---

## §5 · APPROVAL BLOCK · PART II FREEZE · SIGNED 2026-09-18 · CONSTITUTIONAL BOUNDARY ONLY

By signing below, the founder freezes `NEX1_Q8_V2_DOCTRINE` **as a constitutional boundary only** (per founder message *"NEX1 · FIX 24 · FOUNDER SIGNATURE + Q8 V2 POLICY AUTHORING"* dated 2026-09-18). The specific operational rules R-9 / R-10 / R-11 remain **DRAFT · pending separate Q8 V2 Operational Policy approval** under the same 19-decision founder-review discipline.

**What is founder-approved (constitutional principles · load-bearing):**
- Retrieved experience is evidence, not authority.
- Trust in experience is not authority to execute.
- `SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED`.
- Any attempt to cross the execution/authorization boundary must be rejected or escalated rather than executed or silently authorized.
- Fix 24 does not grant autonomous execution authority.
- §2.2 permitted evidence concepts (A2.1-A2.6, A2.8-A2.10) are constitutional.
- §2.3 forbidden actions (F2.1-F2.12) are constitutional.
- §2.4 trust-decay semantics apply as EVIDENCE-MATURITY only.
- §2.5 cold-start semantics apply as EVIDENCE-MATURITY only.

**What remains DRAFT (operational · pending separate approval):**
- R-9 / R-10 / R-11 selection-rule effects.
- Any specific operational interaction between retrieved evidence classes and V1 8-step precedence.
- Sub-decisions 5X (migration path) and 5Y (demotion path) — pending founder decision.

**Founder signature:** **Philip O'Farrell** · authorised via founder message dated 2026-09-18
**Date:** **2026-09-18**
**Q8 policy version assigned on approval:** **`V2 (constitutional boundary only)`** · operational V2 rules require separate approval
**Amendment (if any):** **None** — R-9/R-10/R-11 remain explicitly DRAFT per §2.2 A2.7
**Status:** `NEX1_Q8_V2_DOCTRINE · FOUNDER-APPROVED (CONSTITUTIONAL BOUNDARY) · LOAD-BEARING`

Absent amendments, the doctrine in §2 becomes load-bearing on signature at the constitutional-boundary level. Operational R-9/R-10/R-11 rules remain non-implementable until separate Q8 V2 Operational Policy is founder-approved. **This section is now load-bearing at the constitutional level.**

---

## §6 · FREEZE SEMANTICS — WHAT "FROZEN" MEANS

Once §3 and §5 are signed:

**F.1** · The schema fields in §1.2 and the doctrinal boundaries in §2.2/§2.3 are canonical. Any Fix 24 code referencing them must use the exact names and constraints stated.

**F.2** · Amendment path: any change to a frozen field or a frozen rule requires:
- A separately authored `V1.1` (schema) or `V2.1` (doctrine) document
- Explicit statement of what changed and why
- Founder re-signature
- Migration plan for pre-amendment data (if schema affected)

**F.3** · Silent amendment (Claude reinterpreting a field, adding a rule, or "improving" a doctrine constraint) is prohibited. Any implementation ambiguity is resolved by returning to this document, not by Claude's judgement.

**F.4** · These freezes rank at the same load-bearing level as `NEX1_Q7_RANKING_POLICY_V1` and `NEX1_Q8_SELECTION_POLICY_V1`. They may be amended but only through the documented amendment path.

**F.5** · Post-freeze, subsequent Fix 24 tasks reference this document by exact section number for every design and implementation decision.

---

## §7 · WHAT HAPPENS AFTER BOTH FREEZES ARE SIGNED

**Sequence — locked:**

1. This document becomes canonical. All Fix 24 references trace to it.
2. Fix 24 Pre-Build Audit is authored under standard Fix arc discipline · READ-ONLY · Phase A.
3. Fix 24 Phase B (Build) authors ~7 new modules against the frozen fields and rules.
4. Fix 24 Phase C (Wire) integrates the new modules with the existing ACTION 1-15 pipeline.
5. Fix 24 Phase D (Verifier) authors a verifier probe including Tests A / B / C from prior boundary report §8.
6. Fix 24 Phase E (Regression) runs the A-S regression suite plus F15/F16 verifiers.
7. Fix 24 Phase F (Persistence) confirms JSONL append discipline preserved.

**Constitutional clause on the sequence:**

> **No phase of Fix 24 may introduce an autonomous execution path.**

Every phase, every module, every wire, every verifier assertion must stop at the existing authorization boundary. Any implementation that emits a state, envelope, or signal capable of triggering CHANGE without the pre-Fix-24 authorization pathway is a §2.3 F2.2 or F2.11 or F2.12 violation and MUST be rejected during code review.

**Blocking conditions (corrected under Decision 4A):**
- If any of Tests A / B / C fails, Fix 24 is not shipped. Failure report is authored. Return to founder for review.
- If any of Fix 24's authored modules violates a §2.3 forbidden rule (F2.1-F2.12), the module is rejected. Return to §5 for re-signature or amendment.
- If cold-start (§2.5 C.1-C.2) means fewer than 3 experiences of a given shape exist, retrieval emits `INSUFFICIENT_EVIDENCE` and Test B is deferred until enough experiences accumulate. Test C's rejection path can still be demonstrated at any stage because it is a refusal path, not a threshold-gated path.

---

## §8 · RESTATEMENT OF THE FRAMING (corrected under Decision 4A)

To be quoted in the Fix 24 build's header comment:

> **"Fix 24 does not create NEX1's ability to understand the problem. Fix 24 creates persistence of that understanding."**

And, more specifically:

> **"Fix 24 establishes the persistence and retrieval pathway for verified experience and permits retrieved experience to function as typed evidence under Q8 V2. It does not grant autonomous execution authority."**

And, most specifically (the falsifiable claim Fix 24 tests):

> **"Fix 24 tests whether persisted verified experience can be retrieved, semantically rechecked against a later problem, used as evidence, and contribute to changed future behaviour — without granting execution authority to that evidence."**

This is the constitutional statement that governs the entire build. NEX1's runtime already produces the fields in Blocks A-E; Fix 24 makes them survive persistence and become retrievable as evidence. Nothing else.

Every claim about what Fix 24 achieves must be reducible to this framing. Claims that are not — "NEX1 learns," "NEX1 becomes smarter," "NEX1 develops intelligence," "NEX1 gains autonomous execution," "bounded auto-execute becomes possible" — MUST be reformulated to fit within the framing or explicitly labelled as OUT_OF_SCOPE_FOR_FIX_24.

**Do not claim proof of learning before the Test A/B/C experiments actually pass.**

**Out of scope for Fix 24 (explicitly, per Decision 4A):**
- autonomous execution
- automatic authorization
- automatic code modification based solely on retrieved experience
- `SELECTED → EXECUTED` transition
- execution whitelists
- autonomous self-authorisation

A future founder-approved policy may investigate bounded autonomous execution as a separate work item. That policy is not designed here.

---

## §9 · FINAL NOTE

The archaeology arc took seven reports to converge on this document. The next artefact is not an eighth report. It is either §3/§5 signatures or explicit founder amendments to §1/§2.

Once signed, Fix 24 becomes an implementation task with:
- Fixed schema (32 fields · §1)
- Fixed doctrine (2.2 allowed + 2.3 forbidden + 2.4 trust + 2.5 cold-start)
- Fixed proof standard (Tests A/B/C from prior boundary report §8)
- Fixed sequence (§7)
- No decision debt left to Claude

**We will no longer be guessing whether the architecture is sufficient. We will know.**

Zero code changes. Zero implementation. Zero further audits.
